import 'dotenv/config';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

export async function loginGamma() {
  const { GAMMA_URL, GAMMA_USER, GAMMA_PASSWORD } = process.env;

  if (!GAMMA_URL || !GAMMA_USER || !GAMMA_PASSWORD) {
    throw new Error('Faltam variáveis de ambiente do Gamma no .env (GAMMA_URL, GAMMA_USER, GAMMA_PASSWORD)');
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('[browser] Acessando', GAMMA_URL);
  await page.goto(GAMMA_URL);

  await page.getByRole('textbox', { name: 'Usuário:' }).click();
  await page.getByRole('textbox', { name: 'Usuário:' }).fill(GAMMA_USER);

  await page.getByRole('textbox', { name: 'Senha:' }).click();
  await page.getByRole('textbox', { name: 'Senha:' }).fill(GAMMA_PASSWORD);

  await page.getByRole('button', { name: 'Entrar' }).click();

  console.log('[browser] Login enviado, aguardando o app (HTML5/canvas) carregar...');

  return { browser, context, page };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  loginGamma()
    .then(() => console.log('[browser] Login concluído. Deixe a janela aberta pra inspecionar.'))
    .catch((err) => {
      console.error('[browser] Erro:', err.message);
      process.exit(1);
    });
}
