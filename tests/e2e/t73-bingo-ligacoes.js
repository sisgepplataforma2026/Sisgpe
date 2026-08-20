/**
 * BINGO — TODA CHAMADA DE TELA TEM DE ACHAR A FUNÇÃO NO BACKEND
 *
 * O QUE ORIGINOU
 *
 * 20/08/2026, ao finalizar o módulo. O painel administrativo chamava
 *
 *     google.script.run...bingo_expirarManifestacoes(RODADA, TOKEN)
 *
 * e o backend expunha `bingo_expirarManifestacoesPendentes`. Nome errado por
 * uma palavra: botão morto.
 *
 * E não era cosmético, por causa de ONDE ele era o único caminho. O
 * BingoSorteio expira manifestação a cada número sorteado — mas quando alguém
 * canta bingo, a rodada PAUSA e ninguém sorteia mais nada. Aí o único jeito de
 * expirar o prazo era o botão. Que estava morto. Manifestação não confirmada
 * travava a rodada para sempre, exatamente no caso que o botão existia para
 * resolver.
 *
 * POR QUE UM TESTE, E NÃO SÓ A CORREÇÃO
 *
 * Erro de nome entre `.html` e `.gs` não aparece em nenhuma validação de
 * sintaxe: os dois arquivos estão perfeitos, isolados. Só aparece quando
 * alguém clica — e neste módulo, no meio de um sorteio ao vivo com 300
 * pessoas assistindo.
 *
 * Este teste cruza os dois lados. Roda em 40ms e não depende de ninguém
 * clicar.
 *
 * MUTAÇÕES MATADAS (20/08/2026)
 *
 *   1. voltar o nome errado em BingoAdmin.html .................. 1 falha
 *   2. renomear uma função do backend sem mexer na tela ......... 1 falha
 *   3. apagar a rota ?bingo-inscricao de Code.gs ................ 1 falha
 *   4. tirar o LockService de bingo_inscrever ................... 1 falha
 *   5. trocar a recusa do teto por corte silencioso ............. 1 falha
 *   6. pôr token de sessão no link público de inscrição ......... 1 falha
 *
 * DUAS DELAS SOBREVIVERAM NA PRIMEIRA RODADA, e o motivo vale registro: as
 * asserções liam o arquivo INTEIRO, comentários inclusive. O comentário que
 * explica a rota cita `p["bingo-inscricao"]`; o que explica o link cita
 * `?bingo-inscricao=`. O regex achava a prosa correta enquanto o código já
 * estava quebrado — teste verde provando o comentário, não o comportamento.
 *
 * Corrigido com semCom(): comentário é intenção, o teste olha o que executa.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = f => fs.readFileSync(path.join(RAIZ, f), "utf8");

const GS   = fs.readdirSync(RAIZ).filter(f => /^Bingo.*\.gs$/.test(f)).sort();
const HTML = fs.readdirSync(RAIZ).filter(f => /^Bingo.*\.html$/.test(f)).sort();

/* Todas as funções que os .gs do Bingo declaram. */
const declaradas = new Set();
GS.forEach(f => {
  const m = ler(f).match(/^function\s+([A-Za-z0-9_]+)/gm) || [];
  m.forEach(x => declaradas.add(x.replace(/^function\s+/, "")));
});

fluxo("BINGO · Cada chamada de tela acha sua função");

/* ─── 1. o inventário ─── */
passo("os dois lados");

ok(GS.length >= 10, GS.length + " arquivos .gs do Bingo",
   "backend do módulo");
ok(HTML.length >= 4, HTML.length + " telas do Bingo",
   HTML.join(", "));
ok(declaradas.size >= 40, declaradas.size + " funções declaradas no backend");

/* ─── 2. NENHUMA tela chama função que não existe ─── */
passo("o defeito que originou este arquivo");

const quebradas = [];
HTML.forEach(f => {
  const src = ler(f);
  /* Pega `bingo_alguma_coisa(` em qualquer posição — inclusive depois da
     cadeia de handlers, que é onde a chamada real fica. Um regex ancorado em
     `google.script.run.` não pegaria, e foi assim que o defeito passou. */
  const chamadas = src.match(/\bbingo_[A-Za-z0-9_]+\s*\(/g) || [];
  new Set(chamadas.map(c => c.replace(/\s*\($/, ""))).forEach(fn => {
    /* Funções definidas dentro do próprio .html não contam. */
    if (new RegExp("function\\s+" + fn + "\\s*\\(").test(src)) return;
    if (!declaradas.has(fn)) quebradas.push(f + " → " + fn);
  });
});

igual(quebradas, [],
      "nenhuma tela chama função inexistente",
      "bingo_expirarManifestacoes (sem 'Pendentes') era o caso real");

/* Contraprova: o nome CERTO está lá, e o errado não. Sem isto, apagar a
   chamada inteira também deixaria o teste verde. */
const admin = ler("BingoAdmin.html");
ok(/bingo_expirarManifestacoesPendentes\s*\(/.test(admin),
   "o painel chama bingo_expirarManifestacoesPendentes");
ok(!/bingo_expirarManifestacoes\s*\(/.test(admin),
   "e o nome truncado não voltou");

/* ─── 3. a inscrição existe de ponta a ponta ─── */
passo("o começo do fluxo, que não existia");

ok(fs.existsSync(path.join(RAIZ, "BingoInscricao.gs")), "BingoInscricao.gs existe");
ok(fs.existsSync(path.join(RAIZ, "BingoInscricao.html")), "BingoInscricao.html existe");

/* SEM COMENTÁRIO. Duas asserções deste arquivo nasceram furadas por
   ignorar isto, e as mutações 3 e 6 sobreviveram em 20/08/2026: o
   comentário que EXPLICA a rota também contém `p["bingo-inscricao"]`, e o
   que explica o link também contém `?bingo-inscricao=`. O regex achava o
   texto certo na prosa enquanto o código já estava errado.

   Comentário é a intenção; o teste tem de olhar o que EXECUTA. */
const semCom = t => t.replace(/\/\*[\s\S]*?\*\//g, "")
                     .replace(/<!--[\s\S]*?-->/g, "")
                     .replace(/^\s*\/\/.*$/gm, "");

const code = semCom(ler("Code.gs"));
ok(/if\s*\(\s*p\["bingo-inscricao"\]\s*\)/.test(code),
   "Code.gs tem a rota pública ?bingo-inscricao",
   "sem ela a página existe e ninguém alcança");
ok(/createHtmlOutputFromFile\("BingoInscricao"\)/.test(code),
   "e a rota serve o arquivo certo");

const insc = ler("BingoInscricao.gs");
["bingo_inscricaoEstado", "bingo_inscrever", "bingo_inscricaoPreencher"].forEach(fn => {
  ok(new RegExp("function\\s+" + fn + "\\s*\\(").test(insc), fn + " existe");
});

/* ─── 4. o teto de 300 ─── */
passo("o teto que o usuário pediu");

ok(/BINGO_LIMITE_INSCRITOS_PADRAO\s*=\s*300/.test(insc),
   "o padrão é 300 inscritos");

ok(/LockService\.getScriptLock\(\)/.test(insc),
   "bingo_inscrever usa LockService",
   "sem lock, dois cliques simultâneos passam do teto");

/* A contagem TEM de estar dentro do lock. Ler o total fora dele e decidir
   dentro é o mesmo que não ter lock. */
const corpo = insc.slice(insc.indexOf("function bingo_inscrever"));
const iLock = corpo.indexOf("lock.waitLock");
const iCont = corpo.indexOf("bingo_contarInscritos_");
ok(iLock >= 0 && iCont > iLock,
   "e conta as vagas DEPOIS de pegar o lock, não antes");

/* Recusa, não corta — a mesma regra do teto da Lixeira. */
ok(/esgotado:\s*true/.test(insc) && /vagas deste sorteio já foram preenchidas/.test(insc),
   "o 301º é RECUSADO, com mensagem",
   "cortar em silêncio deixaria a pessoa achando que se inscreveu");

/* ─── 5. o link público não carrega credencial ─── */
passo("o link que vai para o WhatsApp");

const eventos = semCom(ler("EventosAdmin.html"));
const trecho = eventos.slice(eventos.indexOf("evCopiarLinkInscricao"));
/* A LINHA QUE MONTA A URL, não a primeira que cita o parâmetro. */
const linhaLink = (trecho.match(/var\s+url\s*=[^;]*bingo-inscricao[^;]*/) || [""])[0];

ok(linhaLink.length > 0, "o painel monta o link de inscrição");
ok(!/sessao/.test(linhaLink),
   "e o link NÃO leva token de sessão",
   "levaria a credencial de quem gerou para dentro de todo grupo onde fosse colado");

/* ─── 6. o termo é gravado, não só marcado ─── */
passo("o termo de compromisso");

ok(/termoVersao:/.test(insc) && /termoHash:/.test(insc) && /termoAceitoEm:/.test(insc),
   "o aceite grava versão, hash e data",
   "guardar só `true` não prova COM O QUE a pessoa concordou");

ok(/BINGO_TERMO_VERSAO\s*=\s*'[\d.]+'/.test(insc),
   "e a versão do termo é declarada");

/* ─── 7. o convite não está cravado no HTML ─── */
passo("o texto que muda a cada sorteio");

/* Comentário que EXPLICA o desenho não é texto renderizado, e citar
   "Dia dos Pais" ao justificar por que o convite é configurável é
   legítimo. Por isso a varredura tira comentários antes de acusar —
   mesmo critério do semComentarios() em t71. Sem isso, o teste puniria
   justamente quem documenta a decisão. */
const tela = semCom(ler("BingoInscricao.html"));
ok(!/Dia dos Pais|China Park|tvsindeducacao/i.test(tela),
   "nenhum texto de evento específico está cravado na tela",
   "o convite muda a cada sorteio — vem da configuração");

const cfg = ler("BingoConfig.gs");
["conviteTexto", "premios", "inscricoesAte", "sorteioEm", "limiteInscritos"].forEach(c => {
  ok(new RegExp(c + "\\s*:").test(cfg), "config tem " + c);
});

/* ─── 8. a inscrição fecha sozinha no prazo ─── */
passo("o fechamento automático");

ok(/function\s+bingo_inscricaoFechada_/.test(insc),
   "existe bingo_inscricaoFechada_");
ok(/Date\.now\(\)\s*>\s*limite\.getTime\(\)/.test(insc),
   "que compara com o prazo configurado",
   "ninguém precisa lembrar de fechar às 12h de uma quarta-feira");

/* O prazo é reconferido DENTRO do lock: a pessoa pode ter aberto a página
   antes do encerramento e clicado depois. */
const depoisLock = corpo.slice(iLock);
ok(depoisLock.indexOf("bingo_inscricaoFechada_") >= 0,
   "e é reconferido dentro do lock, não só na abertura da página");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("que a inscrição funciona contra o Firestore real",
      "isto cruza CÓDIGO. fs_set_/fs_get_ só se provam no ambiente no ar");

aviso("que o e-mail com o link da cartela chega",
      "envio de e-mail não é testável no emulador");

aviso("que o Firebase carrega dentro do HtmlService",
      "BingoAssociado importa firebase de gstatic.com; o sandbox pode barrar. " +
      "Há fallback por polling, então degrada em vez de quebrar — mas só se " +
      "confirma no ar");

resumo();
