import 'dotenv/config';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const CANVAS_SELECTOR = '#JWTS_myCanvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_ROOT = path.join(__dirname, '..', 'debug-screenshots');
const DEBUG_DIR = path.join(DEBUG_ROOT, new Date().toISOString().replace(/[:.]/g, '-'));
let debugDirReady = null;

function ensureDebugDir() {
  if (!debugDirReady) {
    // limpa execuções antigas — é só material de debug, não precisa acumular
    debugDirReady = rm(DEBUG_ROOT, { recursive: true, force: true }).then(() =>
      mkdir(DEBUG_DIR, { recursive: true })
    );
  }
  return debugDirReady;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEnter(message = '\n> Pressione Enter para o próximo clique...') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function timestamp() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function log(msg) {
  console.log(`[uau ${timestamp()}] ${msg}`);
}

function logError(msg, err) {
  console.error(`[uau ${timestamp()}] ${msg} —`, err.message);
}

function slug(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

let stepCount = 0;

async function saveScreenshot(page, filenameSuffix) {
  await ensureDebugDir();
  const n = String(stepCount).padStart(2, '0');
  const file = path.join(DEBUG_DIR, `${n}-${filenameSuffix}.png`);
  try {
    await page.locator(CANVAS_SELECTOR).screenshot({ path: file, timeout: 5000 });
  } catch (err) {
    logError(`Não consegui salvar screenshot do passo ${stepCount}`, err);
  }
}

async function step(page, description, action) {
  stepCount += 1;
  log(`Passo ${stepCount}: ${description}`);
  try {
    await action();
  } catch (err) {
    logError(`Passo ${stepCount} FALHOU (${description})`, err);
    await saveScreenshot(page, `ERRO-${slug(description)}`);
    throw err;
  }
  await saveScreenshot(page, slug(description));
}

async function clickCanvas(page, x, y, label = '') {
  const description = label ? `clique em (${x}, ${y}) — ${label}` : `clique em (${x}, ${y})`;
  await step(page, description, () =>
    page.locator(CANVAS_SELECTOR).click({ position: { x, y } })
  );
  await wait(300); // dá tempo do app remoto registrar o clique/foco antes de digitar
}

async function dblClickCanvas(page, x, y, label = '') {
  const description = label ? `duplo clique em (${x}, ${y}) — ${label}` : `duplo clique em (${x}, ${y})`;
  await step(page, description, () =>
    page.locator(CANVAS_SELECTOR).dblclick({ position: { x, y } })
  );
  await wait(300);
}

async function typeText(page, text) {
  await step(page, `digitar "${text}"`, () =>
    page.keyboard.type(text, { delay: 120 }) 
  );
}

async function pressKey(page, key, label = '') {
  const description = label ? `tecla ${key} — ${label}` : `tecla ${key}`;
  await step(page, description, () => page.locator(CANVAS_SELECTOR).press(key));
}

// mesmo dia de hoje, só que no mês seguinte; se o mês seguinte não tiver esse
// dia (ex: dia 31 caindo num mês de 30 dias), usa o último dia dele
function nextMonthSameDay() {
  const today = new Date();
  const month = (today.getMonth() + 1) % 12;
  const year = today.getFullYear() + (today.getMonth() === 11 ? 1 : 0);
  const lastDayNextMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(today.getDate(), lastDayNextMonth);
  return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
}

export async function runUauXtFlow(page) {
  await ensureDebugDir();
  log(`Screenshots de cada passo vão em: ${DEBUG_DIR}`);

  log('Aguardando o UAU XT carregar...');
  await wait(10000);

  await clickCanvas(page, 55, 312, 'abre tela de login/seleção do UAU');
  await wait(8000);

  await typeText(page, 'Almaz');
  await wait(8000);

  await clickCanvas(page, 950, 335, 'campo de senha/PIN');
  await wait(8000);

  await typeText(page, '123');
  await wait(8000);

  await pressKey(page, 'Enter', 'confirma login');

  log('Aguardando o UAU XT autenticar...');
  await wait(22000);

  await clickCanvas(page, 503, 587, 'fecha popup "Nova Interface" (Ver)');
  await wait(10000);

  await clickCanvas(page, 33, 229, 'lupa');
  await wait(10000);

  await typeText(page, 'manutencoes');
  await wait(10000);

  // navegação após abrir a busca "manutencoes" — ainda não sei o que cada
  // clique abaixo seleciona (opção de menu / confirmação), só as coordenadas
  // gravadas; ajustar label quando o fluxo completo for confirmado
  await clickCanvas(page, 219, 353);
  await wait(5000);

  await clickCanvas(page, 96, 262);
  await wait(5000);

  await clickCanvas(page, 137, 108);
  await wait(5000);

  // sequência nova — cliques ainda não confirmados; espera Enter no terminal
  // antes de cada um pra dar tempo de anotar o que ele faz
  await clickCanvas(page, 412, 109);
  await wait(5000);

  await clickCanvas(page, 580, 186);
  await wait(5000);

  await typeText(page, 'watdb'); // obra
  await wait(5000);

  await clickCanvas(page, 337, 211);
  await wait(5000);

  await dblClickCanvas(page, 426, 208);
  await wait(5000);

  await clickCanvas(page, 482, 105);
  await wait(5000);

  await typeText(page, '1918'); // número da venda
  await wait(5000);

  await dblClickCanvas(page, 235, 165);
  await wait(5000);

  await clickCanvas(page, 1019, 261);
  await wait(5000);

  await dblClickCanvas(page, 625, 246);
  await wait(5000);

  await clickCanvas(page, 1021, 258);
  await wait(5000);

  await clickCanvas(page, 1021, 258);
  await wait(5000);

  await clickCanvas(page, 1021, 258);
  await wait(5000);

  await dblClickCanvas(page, 622, 248);
  await wait(5000);

  await clickCanvas(page, 1020, 259);
  await wait(5000);

  await dblClickCanvas(page, 628, 248);
  await wait(5000);

  await clickCanvas(page, 1018, 262);
  await wait(5000);

  await dblClickCanvas(page, 623, 251);
  await wait(5000);

  await clickCanvas(page, 1020, 259);
  await wait(5000);

  await dblClickCanvas(page, 629, 249);
  await wait(5000);

  await clickCanvas(page, 1018, 260);
  await wait(5000);

  await dblClickCanvas(page, 627, 251);
  await wait(5000);

  await clickCanvas(page, 1019, 260);
  await wait(5000);

  await clickCanvas(page, 535, 324);
  await wait(5000);

  await clickCanvas(page, 482, 383, 'sistema define "sobre" = Livre');
  await wait(5000);

  await clickCanvas(page, 328, 351);
  await wait(5000);

  // valor real = metade do saldo a devolver (varia por venda); por enquanto
  // digita o texto literal só pra testar o fluxo, trocar depois pelo cálculo
  await typeText(page, '1149,78');
  await wait(5000);

  await clickCanvas(page, 461, 351);
  await wait(5000);

  await typeText(page, 'Multa de quebra contratual (50%)'); // Multa de quebra contratual (50%)
  await wait(5000);

  await clickCanvas(page, 985, 352);
  await wait(5000);

  await clickCanvas(page, 525, 328);
  await wait(5000);

  await clickCanvas(page, 483, 383);
  await wait(5000);

  // await typeText(page, '40,22'); // juros + multa somados
  // await waitForEnter();

  await clickCanvas(page, 331, 348);
  await wait(5000);

  // await typeText(page, 'Juros e multa');
  // await waitForEnter();

  await typeText(page, '40,22'); // juros + multa somados
  await wait(5000);

  await clickCanvas(page, 485, 349); 
  await wait(5000); 

  await typeText(page, 'Juros e multa'); // juros e multa
  await wait(5000);

  await clickCanvas(page, 1000, 349); //inserir
  await wait(5000);

  await clickCanvas(page, 703, 600);
  await wait(5000);

  await clickCanvas(page, 479, 501);
  await wait(5000);

  await clickCanvas(page, 471, 507);
  await wait(5000);

  await clickCanvas(page, 145, 495);
  await wait(5000);

  await dblClickCanvas(page, 145, 495);
  await wait(5000);

  await clickCanvas(page, 490, 614);
  await wait(5000);

  await step(page, 'clique (sem posição — centro do canvas)', () =>
    page.locator(CANVAS_SELECTOR).click()
  );
  await wait(5000);

  await clickCanvas(page, 753, 666);
  await wait(5000);

  await clickCanvas(page, 623, 670, 'campo de data — vencimento');
  await wait(5000);

  await typeText(page, nextMonthSameDay()); // mesmo dia de hoje, mês seguinte
  await wait(5000);

  await clickCanvas(page, 620, 698, 'campo de intervalo de parcelas');
  await wait(5000);

  await typeText(page, '30');
  await wait(5000);

  await clickCanvas(page, 383, 53);
  await wait(5000);

  await clickCanvas(page, 684, 56);
  await wait(5000);

  await clickCanvas(page, 329, 54);
  await wait(5000);

  // await clickCanvas(page, 710, 439);
  // await wait(5000);

  await clickCanvas(page, 629, 52);
  await wait(5000);

  await clickCanvas(page, 630, 446);
  await wait(5000);

  await clickCanvas(page, 430, 211);
  await wait(5000);

  await clickCanvas(page, 708, 449);
  await wait(5000);

  await clickCanvas(page, 1021, 12);
  await wait(5000);

  log('Fluxo UAU XT concluído.');
}
