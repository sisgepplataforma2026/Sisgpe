/**
 * O BECO SEM SAÍDA DO ACOMPANHANTE, E O QUE NÃO PODE VOLTAR A SER SILENCIOSO
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. A verificação de completude do módulo de festas achou uma
 * condição que nunca podia ser satisfeita:
 *
 *   EventosEmissaoV2.gs:36   if (cat === 'acompanhante' && pagamentoStatus !== 'PAGO')
 *                                return {ok:false, erro:'...após confirmação do pagamento.'}
 *
 * E a varredura do projeto inteiro não achou UMA linha que escrevesse 'PAGO'.
 * Na prática: acompanhante jamais conseguiria ingresso pela V2, e os R$ 500
 * não tinham caminho. O usuário confirmou como o dinheiro entra — "recebeu
 * através de Pix e cartão" — e mandou pôr o botão.
 *
 * O SEGUNDO BURACO, DA MESMA VERIFICAÇÃO
 *
 * A V1 lança receita no Financeiro; a V2 não lançava nada. Agora o
 * lançamento acontece na confirmação do pagamento, que é o momento certo.
 *
 * A PROPRIEDADE QUE MAIS IMPORTA AQUI
 *
 * `cadastrarReceita` exige o módulo "financeiro" (Receita.gs:83) e quem opera
 * a Central tem "eventos". A V1 resolveu engolindo a exceção num catch e
 * escrevendo no Logger — a receita some e ninguém fica sabendo. Este teste
 * existe sobretudo para impedir que essa solução volte: o resultado do
 * lançamento TEM de voltar no retorno e chegar na tela.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. aceitar forma de pagamento fora da lista ................. 1 falha
 *   2. aceitar valor zero ou vazio .............................. 1 falha
 *   3. confirmar pagamento de associado (que é gratuito) ........ 1 falha
 *   4. deixar confirmar duas vezes o mesmo pagamento ............ 1 falha
 *   5. engolir a falha da receita, como a V1 faz ................ 2 falhas
 *   6. permitir estorno com ingresso já emitido ................. 1 falha
 *   7. rebaixar o estorno de admin para módulo .................. 1 falha
 *   8. tirar Pix da lista de formas ............................. 1 falha
 *   9. a lista parar de mandar o pagamento para a tela .......... 1 falha
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

/* Comentário é intenção; o teste olha o que EXECUTA. */
const semComentario = s => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const pag  = semComentario(ler("EventosPagamento.gs"));
const tela = ler("EventosValidacaoAdmin.html");
const val  = semComentario(ler("EventosValidacao.gs"));

fluxo("PAGAMENTO · O beco sem saída do acompanhante");

/* ─── 1. o beco está fechado ─── */
passo("alguém escreve PAGO");

const emissaoV2 = semComentario(ler("EventosEmissaoV2.gs"));
ok(/pagamentoStatus\s*!==\s*'PAGO'/.test(emissaoV2),
   "a emissão V2 continua exigindo pagamentoStatus === PAGO",
   "se esta trava sumir, acompanhante passa sem pagar");

/* Quem escreve PAGO, no projeto inteiro. Antes de 21/08 este número era 0 —
   e era exatamente por isso que o acompanhante nunca conseguia ingresso. */
const escrevemPago = fs.readdirSync(RAIZ)
  .filter(f => f.endsWith(".gs"))
  .filter(f => /pagamentoStatus\s*=\s*COMPASSO_PAGAMENTO_STATUS\.PAGO|pagamentoStatus\s*=\s*'PAGO'/
                 .test(semComentario(ler(f))));

ok(escrevemPago.length >= 1,
   "existe quem escreva PAGO: " + (escrevemPago.join(", ") || "NINGUÉM"),
   "antes deste arquivo o número era ZERO — a condição da V2 era insatisfazível");

/* ─── 2. o que a confirmação recusa ─── */
passo("as recusas da confirmação");

ok(/compasso_formasPagamento_\(\)\.indexOf\(forma\)\s*<\s*0/.test(pag),
   "recusa forma fora da lista",
   "forma livre entra na receita e quebra a conciliação do Financeiro");

ok(/if\s*\(!\(valor\s*>\s*0\)\)/.test(pag),
   "recusa valor zero ou vazio");

ok(/categoria\s*\|\|\s*''\)\.toLowerCase\(\)\s*!==\s*'acompanhante'/.test(pag),
   "recusa confirmar pagamento de quem não é acompanhante",
   "associado e convidado são gratuitos — confirmar ali lançaria receita que não existe");

ok(/=== COMPASSO_PAGAMENTO_STATUS\.PAGO\)\s*\n?\s*return \{ ok: false/.test(pag) ||
   /pagamentoStatus \|\| ''\) === COMPASSO_PAGAMENTO_STATUS\.PAGO/.test(pag),
   "recusa confirmar duas vezes o mesmo pagamento",
   "sem isso, dois cliques viram duas receitas");

ok(/LockService\.getScriptLock\(\)/.test(pag),
   "e tudo acontece sob LockService");

/* ─── 3. A TRAVA CENTRAL: a receita não pode falhar em silêncio ─── */
passo("o lançamento no Financeiro");

ok(/return \{ ok: false, motivo: e\.message \}/.test(pag),
   "a falha da receita vira MOTIVO no retorno, não log",
   "a V1 engole num catch e escreve no Logger — a receita some e ninguém sabe");

ok(/receita: receita/.test(pag),
   "e o resultado sobe junto da resposta da confirmação");

ok(/receita&&r\.receita\.ok/.test(tela) && /NAO foi lancada/.test(tela),
   "a tela mostra quando a receita NÃO foi lançada",
   "com o motivo, para a pessoa lançar à mão na Central Financeira");

/* Mira ONDE o erro poderia morrer: o caminho do dinheiro. O
   diagnosticoPagamentoCompasso_ usa Logger.log de propósito — é um
   diagnóstico, existe para imprimir. Proibir Logger no arquivo inteiro era
   asserção grosseira, e reprovou por um motivo que não é defeito. */
const caminhoDinheiro = ["compasso_confirmarPagamento",
                         "compasso_estornarPagamento",
                         "compasso_lancarReceita_"]
  .map(nome => {
    const i = pag.indexOf("function " + nome);
    const j = pag.indexOf("\nfunction ", i + 1);
    return pag.slice(i, j < 0 ? pag.length : j);
  }).join("\n");

ok(!/Logger\.log/.test(caminhoDinheiro),
   "nenhum Logger.log nas três funções que movem dinheiro",
   "é ali que a V1 enterra a falha da receita — o erro tem de subir, não ser logado");

/* ─── 4. estorno ─── */
passo("desfazer");

const corpoEstorno = pag.slice(pag.indexOf("function compasso_estornarPagamento"));
ok(/exigirAdminOuSessao_\([^)]*,\s*true\s*\)/.test(corpoEstorno.slice(0, 400)),
   "estornar exige ADMINISTRADOR",
   "é apagar registro de dinheiro recebido");

ok(/if\s*\(ins\.ingressoId\)/.test(corpoEstorno),
   "recusa estorno se o ingresso já foi emitido",
   "o QR está na mão da pessoa e a vaga foi consumida — cancele o ingresso antes");

ok(/motivo\)\s*return \{ ok: false, erro: 'Motivo é obrigatório/.test(pag),
   "e exige motivo");

/* ─── 5. formas de recebimento ─── */
passo("Pix e Cartão, que é como o dinheiro entra");

ok(/indexOf\('Pix'\)\s*<\s*0.*unshift\('Pix'\)/s.test(pag),
   "Pix está na lista de formas",
   "o usuário confirmou: recebe por Pix e cartão");

ok(/EMISSAO_CFG\.FORMAS_PAGAMENTO/.test(pag),
   "e as formas antigas de EMISSAO_CFG continuam valendo",
   "a V1 valida contra aquela lista — tirar de lá quebraria emissão antiga");

/* ─── 6. a tela recebe o que precisa ─── */
passo("o que a Central manda para a tela");

ok(/categoria:String\(x\.categoria\|\|''\)\.toLowerCase\(\)/.test(val),
   "a lista devolve a categoria",
   "sem ela a tela não sabe se mostra o bloco de pagamento");

ok(/pagamento:compasso_pagamentoDaInscricao_\(x\)/.test(val),
   "e devolve o pagamento");

ok(/ingressoId:x\.ingressoId/.test(val),
   "e o ingressoId, porque o estorno depende dele");

ok(/categoria\|\|''\)!=='acompanhante'/.test(tela.replace(/\s/g, "")) ||
   /!=='acompanhante'/.test(tela),
   "a tela esconde o bloco quando não é acompanhante",
   "campo de pagamento em inscrição gratuita induz a lançar receita falsa");

/* ─── 7. REGRA Nº 0.6: o valor nasce preenchido, com a origem à vista ─── */
passo("o que a pessoa não precisa digitar");

ok(/valorSugerido/.test(pag) && /valorSugerido/.test(tela),
   "o valor do evento chega preenchido na tela");

ok(/origemValor/.test(pag) && /origemValor/.test(tela),
   "e a origem do valor aparece junto",
   "sugerir com origem à vista, nunca impor em silêncio");

/* ─── 8. nada exposto sem trava ─── */
passo("as funções novas");

const expostasSemTrava = (pag.match(/^function\s+([A-Za-z0-9_]+)/gm) || [])
  .map(m => m.replace(/^function\s+/, ""))
  .filter(n => !/_$/.test(n))
  .filter(nome => {
    const i = pag.indexOf("function " + nome);
    return !/exigirAdminOuSessao_\s*\(/.test(pag.slice(i, i + 500));
  });
igual(expostasSemTrava, [],
      "nenhuma função nova fica alcançável sem identificar quem chama",
      "mesma regra do t76");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("que a receita chega mesmo na Central Financeira",
      "cadastrarReceita exige o módulo financeiro e o emulador não sobe " +
      "a sessão da Central. Só se prova confirmando um pagamento no ar e " +
      "abrindo a tela de Receitas");

aviso("que o ingresso é entregue depois de emitido",
      "continua NÃO havendo entrega na V2 — pagar e emitir passaram a " +
      "funcionar, mas o associado segue sem receber o ingresso. É o outro " +
      "buraco da mesma verificação, e ele não foi fechado aqui");

resumo();
