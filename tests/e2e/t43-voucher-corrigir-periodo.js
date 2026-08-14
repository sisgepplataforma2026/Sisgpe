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

b.naoTestavel("A faixa na tela e o apóstrofo protetor na planilha real",
  "a faixa se confere abrindo o modal no ar; o apóstrofo, olhando a célula no Sheets");

b.resumo();
process.exit(0);
