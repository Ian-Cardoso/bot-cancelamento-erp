import { lerLinhasPlanilha } from './sharepoint.js';
import { calcularValorFinal, setLogAtivo } from './uauApi.js';

async function main() {
  setLogAtivo(false);

  const { linhas } = await lerLinhasPlanilha();
  const pendentes = linhas.filter((l) => String(l.status ?? '').trim().toLowerCase() === 'normal');

  console.log(`\nCotas pendentes (status Normal): ${pendentes.length}\n`);

  for (const linha of pendentes) {
    const { valorTotal, valorFinal, jurosMultaTotal } = await calcularValorFinal(linha);
    console.log(
      `linha ${linha.linha}: empresa = ${linha.empresa} obra = ${linha.obra} num_ven = ${linha.num_ven} -> valorTotal = ${valorTotal.toFixed(2)} valorFinal = ${valorFinal.toFixed(2)} jurosMultaTotal = ${jurosMultaTotal.toFixed(2)}`
    );
  }
}

main().catch((err) => {
  console.error('[preview] Erro:', err);
  process.exit(1);
});
