import 'dotenv/config';

const { UAU_API_BASE_URL, UAU_API_INTEGRATION_TOKEN, UAU_API_LOGIN, UAU_API_SENHA } = process.env;

let logAtivo = true;

/**
 * Liga/desliga os logs `[uauApi ...]` de autenticação e busca. Usado pelo
 * preview.js pra manter a saída limpa, sem timestamp de cada passo.
 */
export function setLogAtivo(ativo) {
  logAtivo = ativo;
}

function log(msg) {
  if (logAtivo) console.log(`[uauApi ${new Date().toISOString().slice(11, 23)}] ${msg}`);
}

function requireEnv() {
  const missing = ['UAU_API_BASE_URL', 'UAU_API_INTEGRATION_TOKEN', 'UAU_API_LOGIN', 'UAU_API_SENHA']
    .filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Faltam variáveis de ambiente da API do UAU no .env: ${missing.join(', ')}`);
  }
}

function baseHeaders() {
  return {
    'X-INTEGRATION-Authorization': UAU_API_INTEGRATION_TOKEN,
    'Content-Type': 'application/json',
  };
}

function extrairToken(bodyText) {
  const trimmed = bodyText.trim().replace(/^"|"$/g, '');
  try {
    const json = JSON.parse(bodyText);
    if (typeof json === 'string') return json;
    const campo = json.token ?? json.Token ?? json.access_token ?? json.retorno ?? json.Retorno;
    if (campo) return campo;
  } catch {
    // resposta não é JSON — assume que o corpo já é o próprio token
  }
  return trimmed;
}

/**
 * Autentica na API do UAU e retorna o token JWT.
 */
export async function autenticarUau() {
  requireEnv();

  log(`Autenticando na API do UAU (login=${UAU_API_LOGIN})...`);

  const res = await fetch(`${UAU_API_BASE_URL}/Autenticador/AutenticarUsuario`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ Login: UAU_API_LOGIN, Senha: UAU_API_SENHA }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Falha ao autenticar na API do UAU (${res.status}): ${bodyText}`);
  }

  const token = extrairToken(bodyText);
  if (!token) {
    throw new Error(`Não consegui extrair o token JWT da resposta de autenticação: ${bodyText}`);
  }
  log('Autenticado com sucesso.');
  return token;
}

function parseNumeroApi(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return Number(valor.replace(',', '.'));
  return 0;
}

/**
 * Busca as parcelas recebidas de uma venda. A API embrulha o resultado
 * como [{ Recebidas: [...] }] (serialização de DataSet do .NET) — o array
 * de parcelas de verdade é esse `Recebidas`, cujo item [0] é uma linha de
 * schema (nomes de tipo tipo "System.Decimal, mscorlib, ...") e deve ser
 * descartado por quem consome o retorno.
 */
export async function buscarParcelasRecebidas({ empresa, obra, num_ven }, token) {
  log(`Buscando parcelas recebidas: empresa=${empresa} obra=${obra} num_ven=${num_ven}`);

  const res = await fetch(`${UAU_API_BASE_URL}/Venda/BuscarParcelasRecebidas`, {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      Authorization: token,
    },
    body: JSON.stringify({ empresa, obra, num_ven }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Falha ao buscar parcelas recebidas (${res.status}): ${bodyText}`);
  }

  const json = JSON.parse(bodyText);
  const recebidas = json[0]?.Recebidas ?? [];
  log(`Resposta recebida: ${recebidas.length} linha(s) (inclui 1 linha de metadados no índice 0).`);
  return recebidas;
}

/**
 * Regra de negócio: descarta Array[0] (metadados). Soma ValorConf_Rec +
 * VlCorrecaoConf_Rec de todas as parcelas restantes e só então divide por
 * 2 (valorPago). Soma, à parte, VlJurosParcConf_Rec + VlMulta_Rec de todas
 * as parcelas — sem dividir — pro campo "Juros e multa".
 */
export function calcularValorFinalDeParcelas(parcelas) {
  const validas = parcelas.slice(1);

  const valorTotal = validas.reduce(
    (soma, parcela) => soma + parseNumeroApi(parcela.ValorConf_Rec) + parseNumeroApi(parcela.VlCorrecaoConf_Rec),
    0
  );
  const jurosMultaTotal = validas.reduce(
    (soma, parcela) => soma + parseNumeroApi(parcela.VlJurosParcConf_Rec) + parseNumeroApi(parcela.VlMulta_Rec),
    0
  );

  return { valorTotal, valorFinal: valorTotal / 2, jurosMultaTotal };
}

/**
 * Fluxo completo para uma venda: autentica (se token não for passado),
 * busca as parcelas recebidas e aplica a regra de negócio.
 */
export async function calcularValorFinal({ empresa, obra, num_ven }, token) {
  const authToken = token ?? (await autenticarUau());
  const parcelas = await buscarParcelasRecebidas({ empresa, obra, num_ven }, authToken);
  const resultado = calcularValorFinalDeParcelas(parcelas);
  log(
    `${Math.max(parcelas.length - 1, 0)} parcela(s) somada(s): valorTotal=${resultado.valorTotal.toFixed(2)} valorFinal=${resultado.valorFinal.toFixed(2)} jurosMultaTotal=${resultado.jurosMultaTotal.toFixed(2)}`
  );
  return resultado;
}
