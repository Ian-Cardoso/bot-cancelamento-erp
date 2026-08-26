import 'dotenv/config';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function requireEnv(names) {
  const env = process.env;
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Faltam variáveis no .env: ${missing.join(', ')}`);
  }
  return Object.fromEntries(names.map((name) => [name, env[name]]));
}

async function graphFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Graph API ${res.status} em ${url}: ${body}`);
  }
  return res.json();
}

async function getAccessToken() {
  const { SP_TENANT_ID, SP_CLIENT_ID, SP_CLIENT_SECRET } = requireEnv([
    'SP_TENANT_ID',
    'SP_CLIENT_ID',
    'SP_CLIENT_SECRET',
  ]);

  const body = new URLSearchParams({
    client_id: SP_CLIENT_ID,
    client_secret: SP_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${SP_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha ao autenticar no Azure AD (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.access_token;
}

function encodeSharingUrl(url) {
  const base64 = Buffer.from(url, 'utf8').toString('base64');
  const encoded = base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `u!${encoded}`;
}

async function getDriveItemFromShareUrl(token) {
  const { SP_FILE_SHARE_URL } = requireEnv(['SP_FILE_SHARE_URL']);
  const shareId = encodeSharingUrl(SP_FILE_SHARE_URL);
  const item = await graphFetch(`${GRAPH_BASE}/shares/${shareId}/driveItem?$select=id,parentReference`, token);
  return { driveId: item.parentReference.driveId, itemId: item.id };
}

let conexaoCache = null;
async function getConexao() {
  if (!conexaoCache) {
    const token = await getAccessToken();
    const { driveId, itemId } = await getDriveItemFromShareUrl(token);
    conexaoCache = { token, driveId, itemId };
  }
  return conexaoCache;
}

async function getUsedRangeValues({ token, driveId, itemId }) {
  const { SP_SHEET_NAME } = requireEnv(['SP_SHEET_NAME']);
  const encodedSheet = encodeURIComponent(SP_SHEET_NAME);
  const range = await graphFetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodedSheet}/usedRange(valuesOnly=true)`,
    token
  );
  return range.values;
}

function colunaParaLetra(indiceZeroBased) {
  let letra = '';
  let n = indiceZeroBased;
  while (n >= 0) {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  }
  return letra;
}

function normalizeHeader(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function indexarColunas(headerRow) {
  const colunas = { empresa: -1, obra: -1, num_ven: -1, status: -1 };
  headerRow.forEach((cell, i) => {
    const h = normalizeHeader(cell);
    if (h === 'empresa') colunas.empresa = i;
    else if (h === 'obra') colunas.obra = i;
    else if (h === 'num_ven' || h === 'numero_venda' || h === 'numvenda' || h === 'venda') colunas.num_ven = i;
    else if (h === 'status') colunas.status = i;
  });

  const faltando = Object.entries(colunas)
    .filter(([, i]) => i === -1)
    .map(([nome]) => nome);
  if (faltando.length > 0) {
    throw new Error(`Não encontrei as colunas na planilha: ${faltando.join(', ')}`);
  }
  return colunas;
}

export async function lerLinhasPlanilha() {
  const conexao = await getConexao();
  const values = await getUsedRangeValues(conexao);

  if (!values || values.length < 2) {
    return { linhas: [], colunaStatus: -1 };
  }

  const [headerRow, ...dataRows] = values;
  const colunas = indexarColunas(headerRow);

  const linhas = dataRows
    .map((row, i) => ({
      linha: i + 2, // +2: pula o cabeçalho e compensa índice base 0
      empresa: row[colunas.empresa],
      obra: row[colunas.obra],
      num_ven: row[colunas.num_ven],
      status: row[colunas.status],
    }))
    .filter((r) => r.empresa !== '' && r.obra !== '' && r.num_ven !== '' && r.empresa != null && r.obra != null && r.num_ven != null);

  return { linhas, colunaStatus: colunas.status };
}

export async function atualizarStatus(numeroLinha, colunaStatusIndex, novoStatus) {
  const conexao = await getConexao();
  const { SP_SHEET_NAME } = requireEnv(['SP_SHEET_NAME']);
  const encodedSheet = encodeURIComponent(SP_SHEET_NAME);
  const endereco = `${colunaParaLetra(colunaStatusIndex)}${numeroLinha}`;

  await graphFetch(
    `${GRAPH_BASE}/drives/${conexao.driveId}/items/${conexao.itemId}/workbook/worksheets/${encodedSheet}/range(address='${endereco}')`,
    conexao.token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[novoStatus]] }),
    }
  );
}
