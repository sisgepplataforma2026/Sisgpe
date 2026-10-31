/**
 * TESTE — EXPORTAÇÕES (tela 16.5)
 *
 * ⚠️ O QUE ESTE TESTE NÃO ALCANÇA
 * O arquivo gerado. O emulador não cria planilha no Drive nem produz PDF, e
 * o conteúdo real do que foi exportado continua **NÃO TESTADO**.
 *
 * O que ele prova por execução: que exportar deixa rastro, que o rastro diz
 * QUANTO saiu e SE levava dado pessoal, e que exportar a própria auditoria
 * também é auditado.
 *
 * A marcação de dado pessoal é o centro daqui. Se ela errar para menos, o
 * card vermelho fica vazio enquanto a base sai pela porta; se errar para
 * mais, tudo vira vermelho e o alerta deixa de significar coisa alguma.
 * Marcar errado nos dois sentidos tem o mesmo efeito prático: ninguém olha.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

function exportacoes() {
  return g.auditoriaConsultar({ acao: "EXPORTAR", limite: 500 }, ADM).acoes;
}
function detalhe(a) {
  var v = a.valorNovo;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v || {};
}

/* ══════════ 1. O REGISTRO ══════════ */
b.fluxo("EXPORTAÇÃO · O que fica registrado");

b.passo("1. Exportar deixa rastro");
const antes = exportacoes().length;
g.aud_deExportacao_({
  modulo: "Base de Associados", submodulo: "Exportações",
  formato: "CSV", total: 8014, dadoPessoal: true,
  filtros: { fila: "Filiados" }, usuario: "wanderson@sindeducacao.com"
});
const depois = exportacoes();
b.ok(depois.length === antes + 1, "uma linha por exportação",
  antes + " → " + depois.length);

b.passo("2. A ação é EXPORTAR, e EXPORTAR é crítica");
// Já estava no catálogo desde o começo — o que se trava aqui é que continue.
const ultima = depois[0];
b.ok(ultima.acao === "EXPORTAR" && ultima.critica === true,
  "cai direto no card de críticas do painel", ultima.acao + " · crítica=" + ultima.critica);

b.passo("3. O rastro diz QUANTO saiu");
// Sem o número, "exportou a base" e "exportou um registro" ficam iguais na
// lista — e são coisas muito diferentes numa apuração.
b.ok(detalhe(ultima).total === 8014, "o volume fica registrado",
  detalhe(ultima).total + " registros");

b.passo("4. E diz SE levava dado pessoal");
b.ok(detalhe(ultima).dadoPessoal === true, "a marcação chega à tela",
  "dadoPessoal=" + detalhe(ultima).dadoPessoal);

b.passo("5. O aviso também vai no texto, não só num campo");
// A tela lê o campo; quem varre a lista lê o texto. Os dois precisam contar
// a mesma história.
b.ok(String(ultima.justificativa).indexOf("DADO PESSOAL") > -1,
  "salta aos olhos de quem só passa o olho", ultima.justificativa);

b.passo("6. O filtro aplicado fica junto");
b.ok(String(ultima.justificativa).indexOf("fila=Filiados") > -1,
  "dá para saber o que exatamente foi levado", ultima.justificativa);

/* ══════════ 2. A MARCAÇÃO DE DADO PESSOAL ══════════ */
b.fluxo("EXPORTAÇÃO · Dado pessoal, marcado pelo que é");

b.passo("7. Exportação sem dado pessoal NÃO é marcada");
// Se tudo virasse vermelho, o card perderia a função. Relatório de ofícios
// leva número, tipo, escola, CNPJ e data — nada que identifique pessoa.
g.aud_deExportacao_({
  modulo: "Documentos", submodulo: "Relatórios de Ofícios",
  formato: "EXCEL", total: 41, dadoPessoal: false,
  usuario: "marcelha@sindeducacao.com"
});
const semPessoal = exportacoes()[0];
b.ok(detalhe(semPessoal).dadoPessoal === false &&
     String(semPessoal.justificativa).indexOf("DADO PESSOAL") === -1,
  "o alerta continua significando alguma coisa", semPessoal.justificativa);

b.passo("8. A base de associados É marcada, mesmo com o CPF mascarado");
// Ponto que eu tinha errado antes: assocExportarFila já mascara o CPF. Mas a
// LGPD não fala em CPF — fala em dado que identifica. Nome completo, e-mail
// e escola juntos identificam a pessoa sem nenhum CPF.
/* A base tem que ser semeada com o cabeçalho REAL — SIND_ASS_COLUNAS —, não
   com um inventado. A primeira versão deste teste criou a aba com seis
   colunas de nomes próprios; o filtro não achou ninguém, a exportação saiu
   com ZERO linhas, e o passo 9 ("não leva CPF sem máscara") passou por não
   haver linha nenhuma para checar. Passar por vacuidade é o pior tipo de
   verde: parece cobertura e não é. */
(function semearBase() {
  const cols = g.SIND_ASS_COLUNAS;
  let a = ss.getSheetByName(g.SIND_ASS_ABA);
  if (!a) a = ss.insertSheet(g.SIND_ASS_ABA);
  a.getRange(1, 1, 1, cols.length).setValues([cols]);

  function linha(nome, cpf, email) {
    const l = cols.map(() => "");
    l[cols.indexOf("Nome fantasia")] = "Escola A";
    l[cols.indexOf("Nome")] = nome;
    l[cols.indexOf("CPF")] = cpf;          // CPF INTEIRO na base, de propósito
    // "S", não "SIM": é o que a base de produção guarda, e o que
    // AssociadosBase.gs:116 reconhece. Semear com o valor errado fazia o
    // filtro não achar ninguém e a exportação sair vazia.
    l[cols.indexOf("Filiado")] = "S";
    l[cols.indexOf("E-mail")] = email;
    l[cols.indexOf("Cidade")] = "Vitória";
    l[cols.indexOf("MATRICULA")] = "M-1";
    return l;
  }
  a.getRange(2, 1, 2, cols.length).setValues([
    linha("Maria Silva", "12345678901", "maria@escola.com"),
    linha("João Souza", "98765432100", "joao@escola.com")
  ]);
})();
const antesBase = exportacoes().length;
let expBase = null;
try { expBase = g.assocExportarFila("FILIADOS", ADM); } catch (e) { expBase = { erro: e.message }; }
const daBase = exportacoes().filter(a => a.modulo === "Base de Associados");
b.ok(daBase.length >= 1 && detalhe(daBase[0]).dadoPessoal === true &&
     detalhe(daBase[0]).total >= 2,
  "exportar a base é marcado como dado pessoal, e com gente dentro",
  daBase.length ? "marcado · " + daBase[0].justificativa : "não registrou (" +
    (expBase && expBase.erro ? expBase.erro : "sem erro") + ")");

b.passo("9. E o CPF exportado sai mascarado");
// A marcação de dado pessoal não substitui o mascaramento — as duas coisas
// valem juntas.
const linhasExp = (expBase && expBase.linhas) ? expBase.linhas.slice(1) : [];
const temCpfInteiro = linhasExp.some(l => /^\d{11}$/.test(String(l[1]).replace(/\D/g, "")));
// A exigência de haver linha é parte da asserção: sem dado, "não achei CPF
// inteiro" não prova nada.
b.ok(linhasExp.length >= 2 && !temCpfInteiro,
  "o arquivo leva os associados, e nenhum CPF sem máscara",
  linhasExp.length + " linha(s) · CPF exportado: " +
  (linhasExp[0] ? String(linhasExp[0][1]) : "—"));

/* ══════════ 3. EXPORTAR A AUDITORIA TAMBÉM É AUDITADO ══════════ */
b.fluxo("EXPORTAÇÃO · A trilha se registra saindo");

b.passo("10. Levar a trilha embora também deixa rastro");
// Seria contraditório: a única ação sem registro seria justamente a de levar
// o registro embora.
g.aud_deExportacao_({
  modulo: "Auditoria e Compliance", submodulo: "Exportações",
  formato: "CSV", total: 1204, dadoPessoal: false,
  usuario: "wanderson@sindeducacao.com"
});
const daAuditoria = exportacoes().filter(a => a.modulo === "Auditoria e Compliance");
b.ok(daAuditoria.length >= 1, "exportar auditoria é auditado",
  daAuditoria.length + " registro(s)");

/* ══════════ 4. A EXPOSIÇÃO QUE FOI FECHADA ══════════ */
b.fluxo("EXPORTAÇÃO · Sessão nas exportações que levam CPF sem máscara");

b.passo("11. exportarAssociadosOficio passou a exigir sessão");
// Montava planilha com a coluna CPF SEM máscara e não pedia sessão nenhuma.
// Toda função global do Apps Script é chamável por quem tem a URL.
b.bloqueia(() => g.exportarAssociadosOficio({ colaboradores: [{ nome: "X", cpf: "1" }] }),
  "nega chamada sem token");
b.bloqueia(() => g.exportarAssociadosOficio({ colaboradores: [{ nome: "X", cpf: "1" }] }, ""),
  "nega token vazio");

b.passo("12. exportarEscolaEAssociados também");
b.bloqueia(() => g.exportarEscolaEAssociados({ colaboradores: [] }), "nega chamada sem token");

/* ══════════ 5. A AUDITORIA NÃO IMPEDE A EXPORTAÇÃO ══════════ */
b.fluxo("EXPORTAÇÃO · A auditoria não derruba a exportação");

b.passo("13. Auditoria quebrada não impede exportar");
const guardada = g.aud_deExportacao_;
g.aud_deExportacao_ = function () { throw new Error("falha simulada"); };
let derrubou = false, res = null;
try { res = g.assocExportarFila("FILIADOS", ADM); } catch (e) { derrubou = true; }
g.aud_deExportacao_ = guardada;
b.ok(derrubou === false && res && res.ok === true,
  "a exportação conclui mesmo com a auditoria falhando",
  derrubou ? "LANÇOU" : "ok=" + (res && res.ok));

/* ══════════ 6. PERMISSÃO ══════════ */
b.fluxo("EXPORTAÇÃO · Permissão");

b.passo("14. Quem não tem o módulo não vê a lista de exportações");
// A lista mostra quem levou a base embora e quando. É das telas mais
// sensíveis do módulo.
b.bloqueia(() => g.auditoriaConsultar({ acao: "EXPORTAR" }, FIN), "nega quem não tem o módulo");
b.bloqueia(() => g.auditoriaConsultar({ acao: "EXPORTAR" }, ""), "nega token vazio");

b.naoTestavel("O arquivo gerado (planilha, PDF, CSV)",
  "o emulador não cria arquivo no Drive — conferir abrindo o arquivo exportado");
b.naoTestavel("Exportação feita por fora do SISGEP",
  "abrir a planilha do Google direto, copiar e colar de uma tela, tirar print " +
  "ou baixar anexo de e-mail não passa pelo sistema — a lista responde 'o que " +
  "saiu pelo SISGEP', não 'o que saiu do sindicato'");

b.resumo();
