/**
 * RODA A SUÍTE INTEIRA E DIZ O QUE FALHOU.
 *
 * O QUE ORIGINOU
 *
 * 19/08/2026, o segundo deploy de homologação. A suíte reprovou no CI e o
 * log terminava assim:
 *
 *     ✓ e o voucher continua aceitando certidão de casamento e de nascimento
 *     ═══ RESUMO ═══
 *       Passou: 22   Falhou: 0
 *     ##[error]Process completed with exit code 1.
 *
 * Tudo verde na tela, e mesmo assim erro. O `npm test` era um laço de uma
 * linha que guardava um `falhou=1` e não dizia de QUEM. Para descobrir o
 * arquivo culpado era preciso vasculhar milhares de linhas de log atrás de
 * um stack trace perdido no meio — e a cauda do log, que é o que se lê
 * primeiro, mostrava justamente os testes que passaram.
 *
 * Um relator que não nomeia o culpado transforma cada falha de CI numa
 * caçada. Este nomeia.
 *
 * O QUE ELE FAZ DIFERENTE
 *
 *   1. roda cada arquivo e guarda o CÓDIGO DE SAÍDA — não o texto da saída.
 *      Teste que estoura antes da primeira asserção não imprime "Falhou"
 *      nenhum: imprime stack trace e sai com 1. Ler o texto e não o código
 *      foi o erro de método que deixou passar o caminho cravado em 19/08;
 *   2. no fim, imprime um bloco com os arquivos que falharam e as últimas
 *      linhas de cada um — é o que a cauda do log passa a mostrar;
 *   3. distingue REPROVOU (asserção falhou) de ESTOUROU (o processo morreu),
 *      porque as duas pedem investigação diferente.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PASTA = path.join(__dirname, "e2e");
const arquivos = fs.readdirSync(PASTA)
  .filter(f => /^t\d+.*\.js$/.test(f))
  .sort((a, b) => {
    const na = parseInt(a.match(/^t(\d+)/)[1], 10);
    const nb = parseInt(b.match(/^t(\d+)/)[1], 10);
    return na - nb;
  });

const falhas = [];
let totalAsserts = 0;

for (const arq of arquivos) {
  const r = spawnSync(process.execPath, [path.join(PASTA, arq)], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const saida = (r.stdout || "") + (r.stderr || "");
  process.stdout.write(saida);

  /* Soma as asserções para o total do fim. Só informativo. */
  const m = saida.match(/Passou:\S*\s*(\d+)/);
  if (m) totalAsserts += Number(m[1]);

  if (r.status !== 0) {
    /* ESTOUROU x REPROVOU. Se o resumo saiu, o teste chegou ao fim e
       reprovou uma asserção. Se não saiu, o processo morreu antes. */
    const chegouAoFim = /RESUMO/.test(saida);
    falhas.push({
      arquivo: arq,
      codigo: r.status,
      tipo: chegouAoFim ? "REPROVOU" : "ESTOUROU",
      cauda: saida.trim().split("\n").slice(-14).join("\n")
    });
  }
}

console.log("");
console.log("═".repeat(66));
if (!falhas.length) {
  console.log("SUÍTE VERDE — " + arquivos.length + " arquivos, " +
              totalAsserts + " asserções, nenhuma falha.");
  console.log("═".repeat(66));
  process.exit(0);
}

console.log("SUÍTE VERMELHA — " + falhas.length + " de " + arquivos.length +
            " arquivo(s) com problema:");
console.log("═".repeat(66));
falhas.forEach(f => {
  console.log("");
  console.log("  " + f.tipo + "  " + f.arquivo + "   (saiu com " + f.codigo + ")");
  console.log("  " + "-".repeat(62));
  f.cauda.split("\n").forEach(l => console.log("  | " + l));
});
console.log("");
console.log("═".repeat(66));
console.log("Resumo: " + falhas.map(f => f.arquivo).join(", "));
console.log("═".repeat(66));
process.exit(1);
