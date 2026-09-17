/**
 * TESTE — CORRIGIR O PERÍODO QUE FALTOU
 *
 * Duas solicitações da base real foram criadas antes de o período virar
 * obrigatório. Elas não emitem — e a trava está certa — mas também não
 * tinham conserto pelo sistema: o lápis da lista é "Ver / Ações", aprova e
 * emite, não edita campo. Ficavam travadas dos dois lados.
 *
 * O QUE ESTE ARQUIVO PRECISA PROVAR, em ordem de importância:
 *
 *   1. Que a correção NÃO vira porta lateral para furar a trava. Bastaria
 *      criar sem período e preencher depois para burlar "um por pessoa por
 *      janela" — então a mesma checagem da criação roda aqui, antes de
 *      gravar.
 *   2. Que ela só PREENCHE o que está vazio. Trocar período existente move a
 *      bolsa de janela e é outra decisão.
 *   3. Que depois de corrigida a solicitação volta a emitir — que é o motivo
 *      de tudo isto existir.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");
g.setupVoucherModuleFase1 && g.setupVoucherModuleFase1();

const CPF = "11144477735";
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const sh = ss.getSheetByName(g.VOUCHER_ABA_SOLICITACOES || "Voucher_Solicitacoes");
const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
  .map(function (c) { return String(c || "").trim(); });

/* A LINHA ANTIGA, escrita direto na aba — é o único jeito de reproduzir o que
 * já está gravado, porque a criação de hoje recusa sem período. */
function linhaAntiga(protocolo, nome, beneficiario, curso) {
  const linha = new Array(cab.length).fill("");
  function poe(n, v) { const i = cab.indexOf(n); if (i > -1) linha[i] = v; }
  poe("NUMERO_PROTOCOLO", protocolo);
  poe("ID_SOLICITACAO", "SOL-" + protocolo);
  poe("CPF_SOLICITANTE", CPF);
  poe("NOME_SOLICITANTE", nome);
  poe("NOME_BENEFICIARIO", beneficiario || nome);
  poe("TIPO_BENEFICIARIO", beneficiario ? "FILHO" : "TITULAR");
  poe("SITUACAO_SINDICAL", "ASSOCIADO");
  poe("STATUS_VALIDACAO_SINDICAL", "VALIDADO");
  poe("MODALIDADE", "GRADUACAO");
  poe("CURSO", curso || "Pedagogia");
  poe("REGIME", "SEMESTRAL");
  poe("PERIODO_REFERENCIA", "");
  poe("PERCENTUAL_APLICADO", 70);
  poe("STATUS_SOLICITACAO", "APROVADO");
  poe("ESCOLA_SELECIONADA", "COLEGIO DE TESTE");
  poe("INSTITUICAO_ENSINO", "MULTIVIX");
  sh.appendRow(linha);
  return protocolo;
}

/* Os protocolos na ordem das linhas, para achar a linha de um protocolo sem
   reler a aba inteira em cada asserção. */
function todasLinhas() {
  return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues()
    .map(function (l) { return String(l[cab.indexOf("NUMERO_PROTOCOLO")] || ""); });
}

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("CORRIGIR · A linha sem período ganha conserto");

const PROT = linhaAntiga("BOLSA-ANTIGA-1", "MARIA DE TESTE", "", "Pedagogia");

b.passo("1. Antes de corrigir, ela não emite");
const antes = g.gerarDocumentoVoucher(PROT, "CERTIFICADO", {});
b.igual(antes.ok, false, "a emissão é recusada");
b.igual(antes.semPeriodo, true, "pela falta de período");

b.passo("2. Corrigir grava e diz que já pode emitir");
const r = g.voucherCorrigirPeriodo(PROT, "2026/2", token);
b.igual(r.ok, true, "gravou", r.mensagem);
b.igual(r.periodo, "2026/2", "com o período normalizado");
b.ok(/pode ser emitida/i.test(r.mensagem || ""),
  "e a mensagem diz o que mudou na prática", r.mensagem);

b.passo("3. A lista já mostra o período");
const s1 = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(function (x) { return x.protocolo === PROT; })[0];
b.igual(s1 && s1.periodoReferencia, "2026/2", "sem apóstrofo e sem data");

b.passo("4. E agora ela emite");
const depois = g.gerarDocumentoVoucher(PROT, "CERTIFICADO", {});
b.igual(depois.ok, true, "a emissão passa", depois.mensagem || "");

b.passo("5. O rastro sobrevive à ação seguinte");
/* ESTE PASSO NASCEU DE UM DEFEITO MEU, no mesmo dia. A primeira versão
 * gravava o carimbo em OBSERVACOES — e `atualizarStatusSolicitacao_`
 * SOBRESCREVE essa coluna. A emissão do passo 4 trocava o texto por
 * "Voucher emitido." e o registro de quem corrigiu sumia. O teste pegou
 * porque lia DEPOIS da emissão; lendo antes, teria passado e a promessa de
 * rastro seria falsa.
 *
 * O rastro passou para Voucher_Auditoria, que é append-only. */
const shAud = ss.getSheetByName("Voucher_Auditoria");
b.ok(!!shAud, "a aba de auditoria existe");
const aud = shAud.getRange(1, 1, shAud.getLastRow(), shAud.getLastColumn()).getValues();
const daCorrecao = aud.filter(function (l) {
  return String(l[2]) === PROT && String(l[3]) === "CORRECAO_PERIODO";
});
b.igual(daCorrecao.length, 1, "a correção virou uma linha de auditoria");
b.ok(/Período preenchido \(2026\/2\)/.test(String(daCorrecao[0][6] || "")),
  "com o período que entrou", String(daCorrecao[0][6] || "").slice(0, 80));
b.ok(!!String(daCorrecao[0][5] || "").trim(), "e com quem fez", String(daCorrecao[0][5]));
/* E a emissão que veio depois NÃO apagou nada: são linhas diferentes. */
b.ok(aud.filter(function (l) { return String(l[2]) === PROT; }).length >= 1,
  "a emissão posterior não apagou o registro da correção");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("CORRIGIR · As duas recusas que fazem a porta ser estreita");

b.passo("5b. Gravado COM o apóstrofo protetor");
/* O Sheets converte "2026/2" em 1º de fevereiro — foi o defeito que originou
 * tudo isto. O apóstrofo diz "isto é texto"; ele não faz parte do valor e
 * não sai no certificado.
 *
 * O emulador NÃO converte nada, então ele não prova que a conversão foi
 * evitada — prova só que o apóstrofo está sendo escrito. O efeito real
 * continua "não testado" e se confere olhando a célula no Sheets. Sem esta
 * asserção, porém, uma mutação que removesse a proteção passava sem ninguém
 * ver, e foi o que aconteceu na primeira bateria. */
const cru = String(sh.getRange(
  todasLinhas().indexOf(PROT) + 1, cab.indexOf("PERIODO_REFERENCIA") + 1).getValue());
b.igual(cru.charAt(0), "'", "a célula guarda o apóstrofo protetor", JSON.stringify(cru));
b.igual(g.voucherPeriodoTexto_(cru), "2026/2",
  "e a leitura o remove — o certificado nunca vê o apóstrofo");

b.passo("6. Não troca período que JÁ existe");
/* Trocar move a bolsa de janela — é outra decisão, com outras
 * consequências, e não entra por esta porta. */
const jaTem = g.voucherCorrigirPeriodo(PROT, "2027/1", token);
b.igual(jaTem.ok, false, "recusado");
b.igual(jaTem.jaTem, true, "marcado como 'já tem'");
b.ok(/só preenche o que está em branco/i.test(jaTem.mensagem || ""),
  "e a recusa explica o limite da ação", jaTem.mensagem);
const s2 = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(function (x) { return x.protocolo === PROT; })[0];
b.igual(s2 && s2.periodoReferencia, "2026/2", "o período anterior não foi mexido");

b.passo("7. NÃO vira atalho para a duplicata — é a asserção central");
/* Sem esta checagem bastaria criar sem período e preencher depois para furar
 * "um por pessoa por janela". A mesma pessoa já tem bolsa em 2026/2 (a que
 * acabou de ser corrigida), então preencher outra linha com o mesmo período
 * tem que ser recusado. */
const PROT2 = linhaAntiga("BOLSA-ANTIGA-2", "MARIA DE TESTE", "", "Direito");
const dup = g.voucherCorrigirPeriodo(PROT2, "2026/2", token);
b.igual(dup.ok, false, "recusado");
b.igual(dup.duplicado, true, "como duplicata");
b.ok(String(dup.mensagem || "").indexOf(PROT) > -1,
  "e a mensagem diz QUAL protocolo já ocupa a janela", dup.mensagem);

b.passo("8. Mas em janela livre a mesma linha é corrigida");
const ok2 = g.voucherCorrigirPeriodo(PROT2, "2027/1", token);
b.igual(ok2.ok, true, "2027/1 passa", ok2.mensagem);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("CORRIGIR · O que a ação recusa de entrada");

b.passo("9. Sem período informado");
const semNada = g.voucherCorrigirPeriodo(PROT2, "", token);
b.igual(semNada.ok, false, "recusado");
b.ok(/informe o período/i.test(semNada.mensagem || ""), "com a frase certa", semNada.mensagem);

b.passo("10. Protocolo que não existe");
const semProt = g.voucherCorrigirPeriodo("BOLSA-QUE-NAO-EXISTE", "2026/1", token);
b.igual(semProt.ok, false, "recusado");
b.ok(/não encontrada/i.test(semProt.mensagem || ""), "dizendo que não achou", semProt.mensagem);

b.passo("11. A porta dupla protege");
b.bloqueia(function () { g.voucherCorrigirPeriodo(PROT, "2026/1", "token-que-nao-existe"); },
  "sem sessão, não corrige");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("EMISSÃO · O registro diz EM FACE DE QUEM e QUANDO");

b.passo("12. O carimbo nomeia o beneficiário, não o titular");
/* Pedido do usuário em 13/08/2026. Era "Voucher emitido." — uma frase que
 * não responde a única pergunta que se faz meses depois, olhando a linha:
 * "esse voucher saiu para quem, e em que dia?".
 *
 * O nome do beneficiário pode ser o do FILHO, não o do titular — e é
 * justamente esse o caso em que a frase genérica engana. */
const PROT_FILHO = "BOLSA-COM-FILHO";
linhaAntiga(PROT_FILHO, "MARIA DE TESTE", "JOAO FILHO DE TESTE", "Pedagogia");
g.voucherCorrigirPeriodo(PROT_FILHO, "2029/1", token);
const emitida = g.gerarDocumentoVoucher(PROT_FILHO, "CERTIFICADO", {});
b.igual(emitida.ok, true, "emitiu", emitida.mensagem || "");

const obsFinal = String(sh.getRange(
  todasLinhas().indexOf(PROT_FILHO) + 1, cab.indexOf("OBSERVACOES") + 1).getValue());
b.ok(/em face de JOAO FILHO DE TESTE/.test(obsFinal),
  "diz em face de quem — e é o nome do filho", obsFinal);
b.ok(!/em face de MARIA DE TESTE/.test(obsFinal),
  "e NÃO o do titular, que é o erro que a frase genérica escondia");
b.ok(/em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(obsFinal),
  "com a data e a hora", obsFinal);

b.passo("13. Sem beneficiário gravado, cai no titular — e diz");
const PROT_TITULAR = "BOLSA-SO-TITULAR";
linhaAntiga(PROT_TITULAR, "CARLOS DE TESTE", "", "Direito");
g.voucherCorrigirPeriodo(PROT_TITULAR, "2029/2", token);
g.gerarDocumentoVoucher(PROT_TITULAR, "CERTIFICADO", {});
const obsTit = String(sh.getRange(
  todasLinhas().indexOf(PROT_TITULAR) + 1, cab.indexOf("OBSERVACOES") + 1).getValue());
b.ok(/em face de CARLOS DE TESTE/.test(obsTit),
  "usa o nome do solicitante quando não há beneficiário", obsTit);
b.ok(!/não identificado/.test(obsTit), "e não cai no texto de reserva");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("RELATÓRIO · Quem tem mais de uma bolsa na mesma janela");

b.passo("14. Acha o titular com duas bolsas na mesma janela");
/* A regra nova impede criar assim, então a duplicata é escrita direto na
 * aba — que é exatamente o estado em que a base real pode estar, porque as
 * linhas antigas foram criadas com a trava que chaveava por curso. */
linhaAntiga("BOLSA-DUP-1", "DUPLICADO DE TESTE", "", "Pedagogia");
linhaAntiga("BOLSA-DUP-2", "DUPLICADO DE TESTE", "", "Direito");
[["BOLSA-DUP-1"], ["BOLSA-DUP-2"]].forEach(function (par) {
  const i = todasLinhas().indexOf(par[0]) + 1;
  sh.getRange(i, cab.indexOf("PERIODO_REFERENCIA") + 1).setValue("2028/1");
});

const rel = g.voucherRelatorioDuplicidades(token);
b.igual(rel.ok, true, "o relatório roda", rel.mensagem);
const oDup = (rel.pessoas || []).filter(function (p) {
  return p.nome === "DUPLICADO DE TESTE" && p.periodo === "2028/1";
})[0];
b.ok(!!oDup, "achou a pessoa com duas bolsas na mesma janela");
b.igual(oDup && oDup.bolsas.length, 2, "com as duas listadas");
b.ok((oDup.bolsas || []).some(function (x) { return x.protocolo === "BOLSA-DUP-1"; }) &&
     (oDup.bolsas || []).some(function (x) { return x.protocolo === "BOLSA-DUP-2"; }),
  "nomeando os dois protocolos");
b.ok((oDup.bolsas || []).every(function (x) { return x.linha > 1; }),
  "e a linha da planilha, para achar sem procurar");

b.passo("15. Não acusa quem tem uma bolsa em cada semestre");
/* Renovação não é duplicidade — e um relatório que acusa renovação vira
 * relatório que ninguém abre. */
const semDuplicata = (rel.pessoas || []).filter(function (p) {
  return p.nome === "MARIA DE TESTE";
});
b.igual(semDuplicata.length, 0, "MARIA, com bolsas em janelas diferentes, não aparece");

b.passo("15b. Indeferida não conta como bolsa ocupando a janela");
/* Uma solicitação INDEFERIDA não ocupa período — se contasse, o relatório
 * acusaria como duplicata uma bolsa que foi negada, e mandaria alguém
 * investigar um caso resolvido. Mutação que sobreviveu na primeira bateria:
 * sem este caso, ignorar o status não quebrava nada. */
linhaAntiga("BOLSA-NEG-1", "NEGADO DE TESTE", "", "Pedagogia");
linhaAntiga("BOLSA-NEG-2", "NEGADO DE TESTE", "", "Direito");
[["BOLSA-NEG-1", "APROVADO"], ["BOLSA-NEG-2", "INDEFERIDO"]].forEach(function (par) {
  const i = todasLinhas().indexOf(par[0]) + 1;
  sh.getRange(i, cab.indexOf("PERIODO_REFERENCIA") + 1).setValue("2028/2");
  sh.getRange(i, cab.indexOf("STATUS_SOLICITACAO") + 1).setValue(par[1]);
});
const relNeg = g.voucherRelatorioDuplicidades(token);
b.igual((relNeg.pessoas || []).filter(function (p) {
  return p.nome === "NEGADO DE TESTE";
}).length, 0, "a indeferida não vira duplicidade");

b.passo("15c. Linha SEM período não entra no relatório");
/* Ela não ocupa janela nenhuma — é outro problema, com correção própria (o
 * "⚠ sem período"). Juntá-las aqui criaria um grupo falso: duas linhas sem
 * período apareceriam como "duas bolsas na mesma janela", e a janela nem
 * existe. Outra mutação que sobreviveu por falta deste caso. */
linhaAntiga("BOLSA-VAZIA-1", "SEM PERIODO DE TESTE", "", "Pedagogia");
linhaAntiga("BOLSA-VAZIA-2", "SEM PERIODO DE TESTE", "", "Direito");
const relVazio = g.voucherRelatorioDuplicidades(token);
b.igual((relVazio.pessoas || []).filter(function (p) {
  return p.nome === "SEM PERIODO DE TESTE";
}).length, 0, "as duas sem período não viram duplicidade");
b.ok((relVazio.pessoas || []).every(function (p) { return !!p.periodo; }),
  "e nenhum grupo do relatório tem janela vazia");

b.passo("16. O relatório é SÓ LEITURA");
const antesDoRel = sh.getLastRow();
g.voucherRelatorioDuplicidades(token);
b.igual(sh.getLastRow(), antesDoRel, "rodar de novo não escreve nada na aba");
const aindaLa = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(function (x) { return x.protocolo === "BOLSA-DUP-1"; });
b.igual(aindaLa.length, 1, "e não apaga nem cancela nada");

b.passo("17. Traz o texto pronto para quem roda pelo editor");
b.ok(/VOUCHERS EM DUPLICIDADE/.test(rel.relatorio || ""),
  "o relatório vem formatado", String(rel.relatorio || "").split("\n")[0]);
b.ok(/DUPLICADO DE TESTE/.test(rel.relatorio || ""), "com os nomes dentro");

b.passo("18. A porta dupla protege o relatório");
b.bloqueia(function () { g.voucherRelatorioDuplicidades("token-que-nao-existe"); },
  "sem sessão, não lê");

b.naoTestavel("A faixa na tela e o apóstrofo protetor na planilha real",
  "a faixa se confere abrindo o modal no ar; o apóstrofo, olhando a célula no Sheets");

b.resumo();
