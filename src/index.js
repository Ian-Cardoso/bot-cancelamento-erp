import { loginGamma } from './browser.js';
import { loginUau, processarCota } from './uau.js';
import { lerLinhasPlanilha, atualizarStatus } from './sharepoint.js';
import { calcularValorFinal } from './uauApi.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(' Bot Almaz — iniciando ');

  const { linhas, colunaStatus } = await lerLinhasPlanilha();
  const pendentes = linhas.filter((l) => String(l.status ?? '').trim().toLowerCase() === 'normal');

  if (pendentes.length === 0) {
    console.log('[main] Nenhuma cota com status "Normal" pra processar.');
    return;
  }

  console.log(`[main] ${pendentes.length} cota(s) pendente(s) de cancelamento.`);

  const { page } = await loginGamma();

  console.log('[main] Login enviado, aguardando 25s o app carregar...');
  await wait(25_000);

  await loginUau(page);

  for (const linha of pendentes) {
    console.log(`[main] Processando venda: empresa=${linha.empresa} obra=${linha.obra} num_ven=${linha.num_ven} (linha ${linha.linha} da planilha)`);
    try {
      const { valorTotal, valorFinal, jurosMultaTotal } = await calcularValorFinal(linha);
      console.log(`[main] ValorTotal=${valorTotal.toFixed(2)} ValorFinal (valor_pago)=${valorFinal.toFixed(2)} JurosMultaTotal=${jurosMultaTotal.toFixed(2)}`);

      await processarCota(page, {
        obra: String(linha.obra),
        numVenda: String(linha.num_ven),
        valorPago: valorFinal,
        jurosMulta: jurosMultaTotal,
      });

      await atualizarStatus(linha.linha, colunaStatus, 'Cancelado');
      console.log(`[main] Linha ${linha.linha} marcada como Cancelado.`);
    } catch (err) {
      console.error(`[main] Falha ao processar linha ${linha.linha} (empresa=${linha.empresa} obra=${linha.obra} num_ven=${linha.num_ven}):`, err.message);
      // segue pra próxima cota — um erro isolado não deve travar o lote inteiro
    }
  }

  console.log(' Bot Almaz — fluxo concluído ');
}

main().catch((err) => {
  console.error('[main] Erro:', err);
  process.exit(1);
});
