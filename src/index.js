import { loginGamma } from './browser.js';
import { runUauXtFlow } from './uau.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(' Bot Almaz — iniciando ');

  const { page } = await loginGamma();

  console.log('[main] Login enviado, aguardando 25s o app carregar...');
  await wait(25_000);

  await runUauXtFlow(page);

  console.log(' Bot Almaz — fluxo inicial concluído ');
}

main().catch((err) => {
  console.error('[main] Erro:', err);
  process.exit(1);
});
