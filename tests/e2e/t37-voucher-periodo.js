/**
 * TESTE — UM VOUCHER POR PESSOA, POR CURSO, POR PERÍODO
 *
 * A regra, nas palavras do usuário em 13/08/2026:
 *
 *   "Somente um voucher por semestre ou por ano (no caso do integral)."
 *   "Renovação é por curso — somente um por vez (semestre ou anual)."
 *   "Não pode gerar duas vezes para a mesma pessoa."
 *
 * O QUE ESTE TESTE EXISTE PARA PROVAR, em ordem de importância:
 *
 *   1. Que a segunda emissão na mesma janela NÃO ACONTECE. Emitir dois
 *      certificados de bolsa para a mesma pessoa no mesmo semestre é o
 *      erro que a escola vê antes do sindicato — e não tem desfazer:
 *      o documento já saiu por e-mail.
 *   2. Que a trava NÃO PEGA QUEM NÃO DEVE. Dois filhos do mesmo associado,
 *      cursos diferentes, mesmo ano, é o caso NORMAL de uma família. A trava
 *      antiga bloqueava isso — e um bloqueio errado é indistinguível, para
 *      quem atende, de um sistema quebrado.
 *   3. Que a recusa TRAZ O PROTOCOLO ANTERIOR. Sem ele a pessoa não tem o
 *      que fazer com a recusa; com ele, ela reenvia o que já existe, que é
 *      o que o associado queria desde o começo.
 *   4. Que RECUSADO e CANCELADO liberam a janela. Erro de digitação recusado
 *      hoje não pode impedir a solicitação certa amanhã.
 *   5. Que a data do envio fica NA LINHA, não só na auditoria — pedido do
 *      usuário no mesmo dia: "tem que salvar em observações a data de envio
 *      do voucher".
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const ESC = b.logar(g, "joscimar");          // sem benefícios
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();

const CPF_M = "11144477735";                  // Marcelo, o titular
const CPF_O = "52998224725";                  // outro associado

function shSol() { return ss.getSheetByName("Voucher_Solicitacoes"); }
function linhaDo(protocolo) {
  const sh = shSol();
  const tudo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const cab = tudo[0].map(c => String(c || "").trim());
  for (let l = tudo.length - 1; l >= 1; l--) {
    if (String(tudo[l][cab.indexOf("NUMERO_PROTOCOLO")] || "").trim() !== protocolo) continue;
    const o = {}; cab.forEach((n, i) => { if (n) o[n] = tudo[l][i]; });
    o.__linha = l + 1;
    return o;
  }
  return null;
}
function mudarStatus(protocolo, novo) {
  const sh = shSol();
  const l = linhaDo(protocolo);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  sh.getRange(l.__linha, cab.indexOf("STATUS_SOLICITACAO") + 1).setValue(novo);
}
function criar(extra) {
  return g.voucherCriarSolicitacao(Object.assign({
    cpf: CPF_M, nome: "Marcelo Alves de Oliveira", email: "marcelo@exemplo.com",
    escola: "COLEGIO SAO JOSE", instituicao: "MULTIVIX",
    modalidade: "GRADUACAO", area: "HUMANAS", curso: "Administracao",
    regime: "SEMESTRAL", periodo: "2026/1", percentual: 70, aprovar: true
  }, extra || {}), ADM);
}

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · Como se lê um período escrito por gente");

b.passo("1. Os formatos que a vida escreve");
[["2026/2", "2026", "2"], ["2026.1", "2026", "1"], ["2026-2", "2026", "2"],
 ["2026 1", "2026", "1"], ["2026", "2026", ""], ["", "", ""]].forEach(function (c) {
  const p = g.voucherPeriodoPartes_(c[0]);
  b.igual(p.ano + "|" + p.semestre, c[1] + "|" + c[2], 'lê "' + c[0] + '"');
});

b.passo("2. O invertido não vira um ano que nunca casa com nada");
/* "2/2026" digitado por quem tem pressa. Se o ano saísse como "2", a janela
 * nunca coincidiria com nada e a trava estaria DESLIGADA em silêncio —
 * exatamente o defeito que não dá para perceber olhando a tela. */
const inv = g.voucherPeriodoPartes_("2/2026");
b.igual(inv.ano, "2026", "o ano é quem tem 4 dígitos, não quem vem primeiro");
b.igual(inv.semestre, "2", "e o outro número é o semestre");

b.passo("3. Semestre só é 1 ou 2");
b.igual(g.voucherPeriodoPartes_("2026/10").semestre, "",
  "'10' não é semestre — não inventa uma janela que não existe");

b.passo("4. A matriz da janela");
const M = [
  ["SEMESTRAL", "2026/1", "SEMESTRAL", "2026/1", true,  "mesmo ano e mesmo semestre conflita"],
  ["SEMESTRAL", "2026/2", "SEMESTRAL", "2026/1", false, "semestres diferentes NÃO conflitam"],
  ["SEMESTRAL", "2027/1", "SEMESTRAL", "2026/1", false, "anos diferentes NÃO conflitam"],
  ["ANUAL",     "2026",   "SEMESTRAL", "2026/1", true,  "a integral cobre o semestre do mesmo ano"],
  ["SEMESTRAL", "2026/2", "ANUAL",     "2026",   true,  "e a integral já concedida barra o semestral"],
  ["ANUAL",     "2026",   "ANUAL",     "2027",   false, "integral de outro ano é outra bolsa"],
  ["SEMESTRAL", "",       "SEMESTRAL", "2026/1", false, "sem ano de um lado não se afirma conflito"],
  /* OS DOIS PERÍODOS EM BRANCO — achado por mutação. Sem a guarda do ano
   * vazio, "" e "" são "o mesmo ano", e duas linhas sem período nenhum
   * viravam aviso de duplicata uma da outra. Numa base com dado antigo
   * incompleto isso encheria a tela de alerta sobre nada. */
  ["SEMESTRAL", "",       "SEMESTRAL", "",       false, "dois períodos em branco não são a mesma janela"],
  /* OS DOIS CASOS ABAIXO SÃO OS ÚNICOS QUE PROVAM A REGRA DO ANUAL.
   *
   * Achados por mutação em 13/08/2026: apagando a regra do ANUAL inteira, os
   * casos "ANUAL 2026 × SEMESTRAL 2026/1" continuavam passando — não porque
   * a regra funcionasse, mas porque "2026" não tem semestre e caía na regra
   * seguinte, a do semestre desconhecido. A asserção era minha, e ela estava
   * medindo outra coisa.
   *
   * Aqui a integral vem COM o semestre escrito — alguém digitou "2026/1" numa
   * bolsa anual, que é o que acontece quando o campo aceita texto livre. Sem
   * a regra do ANUAL, os semestres diferem e o segundo voucher do ano sai. */
  ["ANUAL",     "2026/1", "SEMESTRAL", "2026/2", true,
    "a integral cobre o ano mesmo quando o período dela veio com semestre"],
  ["SEMESTRAL", "2026/1", "ANUAL",     "2026/2", true,
    "e a integral já concedida barra o semestre seguinte do mesmo ano"]
];
M.forEach(function (c) {
  b.igual(g.voucherPeriodoJanelaConflita_(c[0], c[1], c[2], c[3]), c[4], c[5]);
});

b.passo("5. Semestral sem o semestre é INCERTO — avisa, não trava");
/* MUDOU EM 13/08/2026, a pedido do usuário. Antes travava por precaução.
 * Travar por dado que FALTA é recusar o atendimento por um defeito do
 * formulário, não por uma regra do sindicato. A origem foi atacada na tela —
 * o período virou dois seletores e não nasce mais sem semestre; o INCERTO
 * existe para o que JÁ ESTÁ GRAVADO. */
b.igual(g.voucherPeriodoJanelaSituacao_("SEMESTRAL", "2026", "SEMESTRAL", "2026/1"), "INCERTO",
  "mesmo ano, semestre desconhecido de um lado: incerto");
b.igual(g.voucherPeriodoJanelaConflita_("SEMESTRAL", "2026", "SEMESTRAL", "2026/1"), false,
  "e incerto NÃO trava");
b.igual(g.voucherPeriodoJanelaSituacao_("SEMESTRAL", "2026/1", "SEMESTRAL", "2026/1"), "CONFLITA",
  "com os dois semestres à vista, volta a ser conflito");
b.igual(g.voucherPeriodoJanelaSituacao_("SEMESTRAL", "2026/1", "SEMESTRAL", "2027/1"), "LIVRE",
  "e ano diferente é livre, sem aviso nenhum");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · A trava na criação");

b.passo("6. A primeira solicitação passa e nasce PRIMEIRA_VEZ");
const p1 = criar();
b.ok(p1.ok, "criou", p1.mensagem);
b.igual(p1.tipo, "PRIMEIRA_VEZ", "a primeira do Marcelo em Administração é primeira vez");
b.igual(String(linhaDo(p1.protocolo).TIPO_SOLICITACAO), "PRIMEIRA_VEZ",
  "e ficou GRAVADO na linha — a dedução depende de linhas que podem mudar depois");

b.passo("7. A segunda no MESMO semestre é recusada");
const p2 = criar();
b.ok(!p2.ok, "recusada");
b.ok(p2.duplicado === true, "e marcada como duplicidade, não como erro genérico");
b.igual(p2.bloqueio && p2.bloqueio.protocolo, p1.protocolo,
  "a recusa TRAZ o protocolo anterior — sem ele a pessoa não tem o que fazer");
b.ok(/semestre/i.test(p2.mensagem), "e a mensagem diz por qual janela", p2.mensagem);

b.passo("8. E não gravou linha nenhuma");
b.igual(linhaDo(p2.protocolo || "___"), null, "nada foi escrito na recusa");

b.passo("9. O semestre seguinte passa — e é RENOVAÇÃO");
const p3 = criar({ periodo: "2026/2" });
b.ok(p3.ok, "2026/2 passa", p3.mensagem);
b.igual(p3.tipo, "RENOVACAO", "mesmo curso, janela nova: renovação");
b.ok(p3.renovacao === true, "e a tela recebe o sinalizador pronto");

b.passo("10. Curso diferente na MESMA janela NÃO passa mais");
/* ESTE PASSO AFIRMAVA O CONTRÁRIO ATÉ 13/08/2026, e estava verde.
 *
 * A trava chaveava por pessoa + CURSO + janela, então duas bolsas no mesmo
 * semestre em cursos diferentes eram duas janelas separadas. Medido no
 * emulador, o mesmo titular chegou a criar TRÊS vouchers para 2026/2 —
 * Pedagogia, Direito e um MBA — sem nada barrar.
 *
 * O usuário fechou a regra no mesmo dia: "para ele mesmo é somente um por
 * semestre ou ano". O benefício é por PESSOA e por PERÍODO, não por
 * matrícula: quem estuda duas coisas ao mesmo tempo continua tendo direito a
 * uma bolsa. O curso saiu da chave.
 *
 * A premissa deste passo morreu com a regra nova — não é o teste que estava
 * errado na época, é a regra que mudou. Fica registrado para ninguém
 * "consertar" a trava daqui a seis meses achando que é defeito. */
const p4 = criar({ curso: "Direito", area: "HUMANAS", periodo: "2026/2", percentual: 50 });
b.igual(p4.ok, false, "Direito em 2026/2 é barrado — já há bolsa nesta janela");
b.ok(/somente um por semestre/i.test(p4.mensagem || ""),
  "e a recusa diz a regra, não só que existe outra", p4.mensagem);
/* O `tipo` não vem mais: recusada, a solicitação não chega a existir, e não
 * há de que dizer "primeira vez" ou "renovação". Antes vinha porque ela era
 * criada. */
b.ok(!p4.tipo, "e não devolve tipo — não há solicitação para tipificar");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · A família não pode ser confundida com duplicata");

b.passo("11. Dois filhos, cursos diferentes, mesmo ano");
const f1 = criar({ curso: "", modalidade: "ENSINO_FUNDAMENTAL", regime: "ANUAL",
  periodo: "2026", tipoBeneficiario: "FILHO", ordemFilho: "1",
  beneficiario: "Ana Alves de Oliveira", percentual: 100 });
b.ok(f1.ok, "a 1ª filha entra", f1.mensagem);
const f2 = criar({ curso: "", modalidade: "ENSINO_MEDIO", regime: "ANUAL",
  periodo: "2026", tipoBeneficiario: "FILHO", ordemFilho: "2",
  beneficiario: "Bruno Alves de Oliveira", percentual: 100 });
b.ok(f2.ok, "o 2º filho TAMBÉM entra — é o caso normal de uma família", f2.mensagem);

b.passo("12. Mas o MESMO filho duas vezes no mesmo ano, não");
const f3 = criar({ curso: "", modalidade: "ENSINO_FUNDAMENTAL", regime: "ANUAL",
  periodo: "2026", tipoBeneficiario: "FILHO", ordemFilho: "1",
  beneficiario: "Ana Alves de Oliveira", percentual: 100 });
b.ok(!f3.ok, "recusado");
b.igual(f3.bloqueio && f3.bloqueio.protocolo, f1.protocolo, "apontando a bolsa da Ana");
b.ok(/ano/i.test(f3.mensagem), "e dizendo que a janela é o ano (regime anual)", f3.mensagem);

b.passo("13. Dois irmãos com o MESMO nível também não se bloqueiam");
/* Sem curso, a chave cai para a modalidade — e é aqui que a chave por pessoa
 * tem que segurar sozinha: mesma modalidade, mesmo ano, pessoas diferentes. */
const f4 = criar({ curso: "", modalidade: "ENSINO_FUNDAMENTAL", regime: "ANUAL",
  periodo: "2026", tipoBeneficiario: "FILHO", ordemFilho: "3",
  beneficiario: "Carla Alves de Oliveira", percentual: 60 });
b.ok(f4.ok, "a Carla entra no mesmo fundamental da Ana, no mesmo ano", f4.mensagem);

b.passo("14. Outro associado, mesmo curso, mesma janela: passa");
const o1 = g.voucherCriarSolicitacao({
  cpf: CPF_O, nome: "Joana Ribeiro", modalidade: "GRADUACAO", area: "HUMANAS",
  curso: "Administracao", regime: "SEMESTRAL", periodo: "2026/1",
  percentual: 70, aprovar: true
}, ADM);
b.ok(o1.ok, "a trava é por PESSOA, não pelo curso em si", o1.mensagem);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · O que ocupa a janela e o que a libera");

b.passo("15. RECUSADO libera a janela");
mudarStatus(p1.protocolo, "RECUSADO");
const p5 = criar();
b.ok(p5.ok, "com a anterior recusada, 2026/1 volta a aceitar", p5.mensagem);

b.passo("16. CANCELADO também");
mudarStatus(p5.protocolo, "CANCELADO");
const p6 = criar();
b.ok(p6.ok, "cancelou, pode refazer", p6.mensagem);

b.passo("17. ANALISE ocupa — não é preciso estar aprovada para segurar a vaga");
mudarStatus(p6.protocolo, "ANALISE");
const p7 = criar();
b.ok(!p7.ok, "uma em análise já impede a segunda");
b.ok(/an[aá]lise/i.test(String(p7.bloqueio && p7.bloqueio.status || "")) ||
     p7.bloqueio.status === "ANALISE", "e a recusa mostra em que estado está a anterior",
     p7.bloqueio && p7.bloqueio.status);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · A consulta que a tela faz");

b.passo("18. Exige o módulo Benefícios");
b.bloqueia(() => g.voucherChecarPeriodo({ cpf: CPF_M, modalidade: "GRADUACAO" }),
  "recusa anônimo");
b.bloqueia(() => g.voucherChecarPeriodo({ cpf: CPF_M, modalidade: "GRADUACAO" }, ESC),
  "e recusa quem não tem Benefícios");

b.passo("19. Sem CPF completo não afirma nada");
const semCpf = g.voucherChecarPeriodo({ cpf: "111", modalidade: "GRADUACAO" }, ADM);
b.igual(semCpf.bloqueado, false, "não bloqueia com CPF pela metade");
b.igual(semCpf.tipo, "", "e não chuta 'primeira vez' antes de saber de quem se trata");

b.passo("20. Com os dados na mão, devolve o bloqueio inteiro");
const ck = g.voucherChecarPeriodo({
  cpf: CPF_M, beneficiario: "Marcelo Alves de Oliveira", modalidade: "GRADUACAO",
  curso: "Administracao", regime: "SEMESTRAL", periodo: "2026/1"
}, ADM);
b.ok(ck.bloqueado, "bloqueado");
b.ok(!!ck.bloqueio.protocolo, "com protocolo", ck.bloqueio.protocolo);
b.ok(!!ck.mensagem, "e com a frase pronta para a tela", ck.mensagem);

b.passo("21. Fora da janela, devolve RENOVAÇÃO com a última à vista");
const ren = g.voucherChecarPeriodo({
  cpf: CPF_M, beneficiario: "Marcelo Alves de Oliveira", modalidade: "GRADUACAO",
  curso: "Administracao", regime: "SEMESTRAL", periodo: "2027/1"
}, ADM);
b.igual(ren.bloqueado, false, "2027/1 não é bloqueado");
b.igual(ren.tipo, "RENOVACAO", "é renovação");
b.ok(!!ren.ultima && !!ren.ultima.protocolo, "e a última vem junto, para a tela mostrar qual foi");
b.ok(ren.vezes >= 2, "com a contagem de quantas já houve", ren.vezes);

b.passo("22. Curso escrito diferente é o MESMO curso");
/* "administração" e "ADMINISTRACAO" não podem ser dois cursos: se fossem, a
 * trava seria contornável por acidente de digitação. */
const acento = g.voucherChecarPeriodo({
  cpf: CPF_M, beneficiario: "Marcelo Alves de Oliveira", modalidade: "GRADUACAO",
  curso: "  administração  ", regime: "SEMESTRAL", periodo: "2026/1"
}, ADM);
b.ok(acento.bloqueado, "acento, caixa e espaço não abrem uma segunda vaga");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · O incerto avisa e deixa passar");

b.passo("23. Uma anterior sem semestre não impede a gravação");
const CPF_I = "35374350770";
function criarI(extra) {
  return g.voucherCriarSolicitacao(Object.assign({
    cpf: CPF_I, nome: "Rita Souza", modalidade: "GRADUACAO", area: "SAUDE",
    curso: "Enfermagem", regime: "SEMESTRAL", periodo: "2026", percentual: 50,
    aprovar: true
  }, extra || {}), ADM);
}
const i1 = criarI();
b.ok(i1.ok, "a primeira, gravada só com o ano (dado antigo)", i1.mensagem);
const i2 = criarI({ periodo: "2026/2" });
b.ok(i2.ok, "a segunda PASSA — o sistema não sabe o semestre da anterior", i2.mensagem);

b.passo("24. Mas a consulta avisa, e o aviso nomeia a anterior");
const ckI = g.voucherChecarPeriodo({
  cpf: CPF_I, beneficiario: "Rita Souza", modalidade: "GRADUACAO",
  curso: "Enfermagem", regime: "SEMESTRAL", periodo: "2026/1"
}, ADM);
b.igual(ckI.bloqueado, false, "não bloqueia");
b.ok(!!ckI.incerto, "mas devolve o incerto separado do bloqueio");
b.ok(/n[ãa]o d[áa] para saber/i.test(ckI.mensagemIncerteza),
  "com a frase pronta, que admite não saber", ckI.mensagemIncerteza);
b.ok(ckI.mensagemIncerteza.indexOf(i1.protocolo) > -1,
  "e aponta qual é a anterior", i1.protocolo);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · A exceção autorizada");

const CPF_X = "15350946056";
function criarX(extra) {
  return g.voucherCriarSolicitacao(Object.assign({
    cpf: CPF_X, nome: "Paulo Dias", modalidade: "GRADUACAO", area: "ENGENHARIA",
    curso: "Civil", regime: "SEMESTRAL", periodo: "2026/1", percentual: 60,
    aprovar: true
  }, extra || {}), ADM);
}
const x1 = criarX();
b.ok(x1.ok, "a primeira do Paulo", x1.mensagem);

b.passo("25. Sem exceção, continua travado");
b.ok(!criarX().ok, "duplicata recusada como antes");

b.passo("26. Exceção SEM justificativa não vale");
const semTexto = criarX({ excecao: { justificativa: "ok" } });
b.ok(!semTexto.ok, "recusada");
b.ok(/motivo/i.test(semTexto.mensagem),
  "e a mensagem pede o motivo — não repete a recusa genérica", semTexto.mensagem);

b.passo("27. Exceção sem o campo preenchido também não");
b.ok(!criarX({ excecao: {} }).ok, "objeto vazio não é autorização");

b.passo("28. Quem NÃO é administrador não autoriza");
/* joscimar não tem Benefícios, então nem chega aqui. É preciso alguém COM o
 * módulo e SEM o perfil de administrador — senão o teste provaria a barreira
 * errada e passaria por acidente. */
const abaU = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
abaU.getRange(abaU.getLastRow() + 1, 1, 1, 8).setValues([[
  "marcela", g.gerarHashSenha_("Senha@2026"), "Marcela", "marcela@sindeducacao.com",
  "USUARIO", "ATIVO", "NAO", "beneficios"
]]);
const COMUM = b.logar(g, "marcela");
const porComum = g.voucherCriarSolicitacao({
  cpf: CPF_X, nome: "Paulo Dias", modalidade: "GRADUACAO", area: "ENGENHARIA",
  curso: "Civil", regime: "SEMESTRAL", periodo: "2026/1", percentual: 60,
  aprovar: true, excecao: { justificativa: "a faculdade perdeu o documento e pediu outro" }
}, COMUM);
b.ok(!porComum.ok, "recusada mesmo com justificativa boa");
b.ok(/administrador/i.test(porComum.mensagem),
  "e a mensagem diz a quem recorrer", porComum.mensagem);

b.passo("29. Administrador com motivo escrito passa");
const JUSTIF = "a faculdade extraviou o primeiro e exigiu segunda via oficial";
const xOk = criarX({ excecao: { justificativa: JUSTIF } });
b.ok(xOk.ok, "gravou", xOk.mensagem);
b.ok(xOk.excecao === true, "e a resposta diz que foi por exceção");

b.passo("30. E o rastro ficou nos três lugares");
const linhaX = linhaDo(xOk.protocolo);
b.igual(String(linhaX.EXCECAO_DUPLICIDADE), x1.protocolo,
  "coluna EXCECAO_DUPLICIDADE com o protocolo da anterior");
b.ok(String(linhaX.OBSERVACOES).indexOf(JUSTIF) > -1,
  "a justificativa por extenso nas observações");
b.ok(/Exce[çc][ãa]o autorizada por/.test(String(linhaX.OBSERVACOES)),
  "com quem autorizou e quando", String(linhaX.OBSERVACOES).split("\n")[0]);
const trilha = g.aud_consultar_({ modulo: "Benefícios", registroId: xOk.protocolo, limite: 50 });
const atos = ((trilha && trilha.acoes) || []).filter(a => /EXCECAO/.test(String(a.acao || "")));
b.igual(atos.length, 1, "e UM registro próprio na trilha, não diluído na criação");
b.ok(String(atos[0] && atos[0].justificativa || "").indexOf(JUSTIF) > -1,
  "a trilha guarda o motivo", (atos[0] || {}).acao);

b.passo("31. A exceção NÃO abre a porta para a próxima");
b.ok(!criarX().ok,
  "a seguinte volta a ser recusada — exceção vale para um caso, não para o par");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · A listagem mostra a etiqueta");

b.passo("23. A lista devolve o tipo gravado");
const lista = g.listarSolicitacoesVoucher(ADM);
const arr = (lista && (lista.solicitacoes || lista.dados || lista)) || [];
const achou = (Array.isArray(arr) ? arr : []).find(s => s.protocolo === p3.protocolo);
b.ok(!!achou, "a solicitação renovada está na lista");
b.igual(achou && achou.tipoSolicitacao, "RENOVACAO", "e a lista carrega a etiqueta");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ENVIO · A data fica na linha, não só na auditoria");

b.passo("24. O carimbo entra em OBSERVACOES");
/* PERÍODO LIVRE, e não 2026/1: com a regra de "uma por pessoa por período"
 * (13/08/2026), este CPF já ocupa 2026/1 desde o passo 1. O passo aqui é
 * sobre o CARIMBO nas observações, não sobre a trava — usar uma janela
 * ocupada faria ele falhar por um motivo que não é o dele. */
const alvo = criar({ curso: "Pedagogia", periodo: "2029/1", observacoes: "veio por e-mail dia 10" });
b.ok(alvo.ok, "solicitação para carimbar", alvo.mensagem);
g.voucherRegistrarEnvio_(alvo.protocolo, "EMAIL", "marcelo@exemplo.com", { email: "wanderson" });
const obs1 = String(linhaDo(alvo.protocolo).OBSERVACOES || "");
b.ok(/veio por e-mail dia 10/.test(obs1),
  "o que a secretaria escreveu CONTINUA lá — carimbo não apaga texto humano");
b.ok(/Enviado por e-mail em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(obs1),
  "e a data do envio foi carimbada", obs1.split("\n").pop());
b.ok(/marcelo@exemplo\.com/.test(obs1), "com o destino");
b.ok(/por wanderson/.test(obs1), "e com quem enviou");

b.passo("25. Reenviar acrescenta OUTRA linha");
g.voucherRegistrarEnvio_(alvo.protocolo, "EMAIL", "outro@exemplo.com", { email: "wanderson" });
const obs2 = String(linhaDo(alvo.protocolo).OBSERVACOES || "");
b.igual((obs2.match(/Enviado por e-mail em/g) || []).length, 2,
  "dois envios, dois carimbos — é o reenvio que se quer enxergar");

b.passo("26. WhatsApp diz ABERTO, nunca 'enviado'");
g.voucherRegistrarEnvio_(alvo.protocolo, "WHATSAPP_ABERTO", "", { email: "wanderson" });
const obs3 = String(linhaDo(alvo.protocolo).OBSERVACOES || "");
b.ok(/WhatsApp aberto em/.test(obs3), "carimbo do zap", obs3.split("\n").pop());
b.ok(!/WhatsApp enviado/i.test(obs3),
  "o sistema não envia zap — afirmar entrega que não se pode confirmar é pior que não registrar");

b.passo("27. Protocolo que não existe não quebra nem inventa linha");
const antes = shSol().getLastRow();
const r = g.voucherAnotarEnvioNaObservacao_("BOLSA-INEXISTENTE", "EMAIL", "x@y.com", {});
b.igual(r, false, "devolve false");
b.igual(shSol().getLastRow(), antes, "e não criou linha nenhuma");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PERÍODO · A trava na tela");

const t = dom.montar(g, ["Scripts_Certificado.html"], { token: ADM });
const doc = t.doc, win = t.win;
function el(id) { return doc.getElementById(id); }

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(60);

  b.passo("28. A caixa da trava existe e começa vazia");
  t.clicar("#certBtnNova");
  await t.assentar(30);
  b.ok(!!el("certNvTrava"), "existe #certNvTrava");
  b.igual(el("certNvTrava").innerHTML, "", "e começa vazia — não acusa antes de saber");
  b.igual(el("certNvSalvarAprovar").disabled, false, "com os botões liberados");

  b.passo("29. Preenchido um caso duplicado, a trava aparece");
  t.digitar("#certNvCpf", CPF_M);
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.digitar("#certNvCurso", "Administracao");
  t.escolher("#certNvRegime", "SEMESTRAL");
  /* O período agora são DOIS seletores, e não um campo de texto: foi assim
   * que o caso "2026 sem semestre" deixou de existir na entrada nova. */
  t.escolher("#certNvPeriodoAno", "2026");
  t.escolher("#certNvPeriodoSem", "1");
  await t.assentar(420);
  const html = el("certNvTrava").innerHTML;
  b.ok(/cert-nv-trava/.test(html), "a trava foi desenhada");
  b.ok(/Já existe voucher/.test(html), "com o título da recusa");
  b.ok(/BOLSA|SOL|\d/.test(html), "e com o protocolo anterior à vista");

  b.passo("30. E os dois botões de salvar ficam desabilitados");
  b.igual(el("certNvSalvarAprovar").disabled, true, "salvar e aprovar travado");
  b.igual(el("certNvSalvarAnalise").disabled, true, "salvar em análise travado");

  b.passo("31. Salvar por outro caminho também é barrado");
  /* O botão desabilitado é APARÊNCIA. Aqui ele é reabilitado à mão — que é o
   * que uma tela em estado estranho, um Enter no formulário ou uma
   * refatoração futura fariam — e o clique tem que continuar sem gravar.
   * Isso prova que a regra está no código de nvSalvar, não no atributo. */
  const antesTela = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length;
  el("certNvSalvarAprovar").disabled = false;
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(60);
  b.igual(t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length, antesTela,
    "nvSalvar não chegou a chamar o backend");

  b.passo("32. Trocar para um período livre solta a trava");
  t.escolher("#certNvPeriodoAno", "2027");
  await t.assentar(420);
  b.igual(el("certNvSalvarAprovar").disabled, false, "botão liberado de novo");
  b.ok(!/cert-nv-trava/.test(el("certNvTrava").innerHTML), "e a trava sumiu");

  b.passo("33. E aparece a etiqueta de renovação no lugar");
  b.ok(/cert-nv-renov/.test(el("certNvTrava").innerHTML),
    "renovação é informação, não impedimento", el("certNvTrava").innerHTML);

  b.passo("34. Fechar e reabrir não carrega a trava do atendimento anterior");
  t.escolher("#certNvPeriodoAno", "2026");
  await t.assentar(420);
  b.igual(el("certNvSalvarAprovar").disabled, true, "travado de novo");
  t.clicar("#certNvCancelar");
  t.clicar("#certBtnNova");
  await t.assentar(60);
  b.igual(el("certNvSalvarAprovar").disabled, false,
    "o próximo atendimento abre com os botões valendo");
  b.igual(el("certNvTrava").innerHTML, "", "e sem a caixa vermelha de outro caso");

  b.passo("35. O semestre só é perguntado quando o regime é semestral");
  /* O passo 34 reabriu o formulário limpo — preenche de novo, senão o que
   * vem a seguir mediria um formulário vazio e passaria por acidente. */
  t.digitar("#certNvCpf", CPF_M);
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.digitar("#certNvCurso", "Administracao");
  t.escolher("#certNvRegime", "ANUAL");
  await t.assentar(60);
  b.igual(el("certNvPeriodoSem").style.display, "none",
    "bolsa anual não pergunta semestre — ele não existe ali");
  b.igual(el("certNvPeriodoSem").value, "",
    "e o valor é limpo, para não virar '2026/1' numa bolsa do ano inteiro");
  t.escolher("#certNvRegime", "SEMESTRAL");
  await t.assentar(60);
  b.igual(el("certNvPeriodoSem").style.display, "",
    "voltou a semestral, volta a perguntar");

  b.fluxo("PERÍODO · A exceção na tela");

  b.passo("36. Com a trava desenhada, o administrador vê o botão");
  t.escolher("#certNvPeriodoAno", "2026");
  t.escolher("#certNvPeriodoSem", "1");
  await t.assentar(420);
  b.ok(!!el("certNvAbrirExcecao"), "botão 'Autorizar exceção' presente para admin");
  b.igual(el("certNvSalvarAprovar").disabled, true, "e o salvar segue travado");

  b.passo("37. A caixa da justificativa só abre no clique");
  b.igual(el("certNvExcecaoBox").style.display, "none", "começa escondida");
  t.clicar("#certNvAbrirExcecao");
  await t.assentar(30);
  b.igual(el("certNvExcecaoBox").style.display, "block", "abriu");

  b.passo("38. Justificativa curta não destrava nada");
  t.digitar("#certNvExcecaoTexto", "ok");
  t.clicar("#certNvExcecaoConfirmar");
  await t.assentar(30);
  b.igual(el("certNvSalvarAprovar").disabled, true,
    "'ok' não é motivo — o salvar continua travado");

  b.passo("39. Com o motivo escrito, o salvar libera");
  t.digitar("#certNvExcecaoTexto", "a faculdade extraviou e exigiu segunda via");
  t.clicar("#certNvExcecaoConfirmar");
  await t.assentar(30);
  b.igual(el("certNvSalvarAprovar").disabled, false, "liberado");
  b.ok(/cert-nv-trava/.test(el("certNvTrava").innerHTML),
    "e a caixa vermelha CONTINUA à vista — é o lembrete de que isto é exceção");

  b.passo("40. E a justificativa viaja junto no salvamento");
  const antesExc = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length;
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(120);
  const chamada = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop();
  b.igual(t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length, antesExc + 1,
    "o backend foi chamado");
  b.ok(!!(chamada && chamada.args[0] && chamada.args[0].excecao),
    "com a exceção no payload");
  b.ok(/extraviou/.test(String(chamada.args[0].excecao.justificativa || "")),
    "e a justificativa é a que foi escrita",
    (chamada.args[0].excecao || {}).justificativa);

  b.passo("41. Reabrir o formulário não carrega a exceção do caso anterior");
  t.clicar("#certBtnNova");
  await t.assentar(60);
  b.igual(el("certNvTrava").innerHTML, "", "caixa limpa");
  b.igual(el("certNvSalvarAprovar").disabled, false, "botões valendo");
  /* A justificativa anterior descrevia OUTRA duplicata. Se sobrevivesse, o
   * próximo caso seria gravado com um motivo que não é o dele. */
  t.digitar("#certNvCpf", CPF_M);
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.digitar("#certNvCurso", "Administracao");
  t.escolher("#certNvRegime", "SEMESTRAL");
  t.escolher("#certNvPeriodoAno", "2026");
  t.escolher("#certNvPeriodoSem", "1");
  await t.assentar(420);
  b.igual(el("certNvSalvarAprovar").disabled, true,
    "a mesma duplicata volta a travar — a autorização anterior não vale para ela");

  b.fluxo("TELA · O que era silêncio agora fala");

  b.passo("42. Campo obrigatório em falta marca o campo, e não grava");
  /* Relatado em 13/08/2026 como "não está salvando": a modalidade estava em
   * "—", o sistema recusava com a frase certa, e a frase ia para a faixa de
   * mensagem que fica ATRÁS do modal. */
  t.clicar("#certNvCancelar");
  t.clicar("#certBtnNova");
  await t.assentar(60);
  t.digitar("#certNvCpf", CPF_M);
  t.digitar("#certNvNome", "Marcelo Alves de Oliveira");
  const antesVal = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length;
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(60);
  b.igual(t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length, antesVal,
    "sem modalidade, não vai para o backend");
  b.ok(/dc2626|rgb\(220, 38, 38\)/i.test(el("certNvModalidade").style.borderColor || ""),
    "e o campo que falta fica marcado em vermelho",
    el("certNvModalidade").style.borderColor);

  b.passo("43. Preenchida, a marca some");
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.digitar("#certNvCurso", "Pedagogia");
  t.escolher("#certNvRegime", "SEMESTRAL");
  t.escolher("#certNvPeriodoAno", "2027");
  t.escolher("#certNvPeriodoSem", "2");
  await t.assentar(420);
  t.clicar("#certNvSalvarAnalise");
  await t.assentar(120);
  b.igual(el("certNvModalidade").style.borderColor, "",
    "a marca vermelha sai quando o campo é preenchido");

  b.passo("44. O botão de emitir acha a linha pelo protocolo, sem depender do id");
  /* "O botão de emitir não acontece nada": a linha era procurada só pelo
   * ID_SOLICITACAO, e linha antiga não tem esse campo. O `if(s)` sem `else`
   * transformava a falha em silêncio absoluto. */
  const btnEmitir = doc.querySelector(".cert-btn-emitir-rapido");
  b.ok(!!btnEmitir, "há um botão de emitir na lista");
  b.ok(!!btnEmitir.getAttribute("data-prot"), "e ele carrega o protocolo junto do id",
    btnEmitir.getAttribute("data-prot"));
  btnEmitir.setAttribute("data-id", "ID-QUE-NAO-EXISTE");
  const antesEmit = t.chamadas.filter(c => c.fn === "gerarDocumentoCertBolsaCompleto").length;
  btnEmitir.dispatchEvent(new win.Event("click", { bubbles: true }));
  await t.assentar(120);
  b.igual(t.chamadas.filter(c => c.fn === "gerarDocumentoCertBolsaCompleto").length, antesEmit + 1,
    "com o id inválido, o protocolo salva o clique");

  b.passo("45. E quando nem o protocolo bate, ele RECLAMA");
  const btn2 = doc.querySelector(".cert-btn-emitir-rapido");
  btn2.setAttribute("data-id", "NADA");
  btn2.setAttribute("data-prot", "NADA");
  const antes2 = t.chamadas.filter(c => c.fn === "gerarDocumentoCertBolsaCompleto").length;
  btn2.dispatchEvent(new win.Event("click", { bubbles: true }));
  await t.assentar(60);
  b.igual(t.chamadas.filter(c => c.fn === "gerarDocumentoCertBolsaCompleto").length, antes2,
    "não emite nada");
  b.ok(/n[ãa]o consegui identificar/i.test(el("certMsgBox").textContent || ""),
    "mas diz o que houve — silêncio é o pior defeito possível",
    (el("certMsgBox").textContent || "").slice(0, 60));

  b.resumo();
  process.exit(process.exitCode || 0);
})();
