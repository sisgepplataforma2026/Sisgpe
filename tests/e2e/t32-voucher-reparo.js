/**
 * TESTE — REPARO DO CABEÇALHO DESALINHADO DE Voucher_Solicitacoes
 *
 * O que este teste tem que provar, nesta ordem de importância:
 *
 *   1. Que a trava de mapa vencido MORDE. O reparo é posicional: ele reescreve
 *      a linha 1 confiando que a coluna N guarda o que o mapa diz. Se a aba
 *      mudou desde o diagnóstico, aplicar o mapa troca o rótulo de colunas que
 *      estavam certas — troca um estrago por outro, maior. Esta é a asserção
 *      que não pode falhar.
 *   2. Que o DADO não se mexe. Só a linha 1 é reescrita.
 *   3. Que sem prévia não se aplica, e que a prévia vale uma vez só.
 *   4. Que existe backup antes da escrita.
 *
 * A aba do teste é montada com o cabeçalho REAL da planilha do sindicato,
 * medido pelo voucherDiagnosticoColunas em 12/08/2026, e com uma linha cujos
 * valores são os mesmos que apareceram no log — o que permite conferir se o
 * reparo põe cada valor sob o nome certo.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* UMA CONTA QUE FALTAVA — e a falta escondia um buraco.
 *
 * As três contas do seed são: um ADMINISTRADOR e dois usuários sem
 * Benefícios. Com esse elenco, a mutação que trocava `exigeAdmin` de true
 * para false no reparo SOBREVIVIA: os dois não-admins eram recusados de
 * qualquer jeito, por não terem o módulo. O teste não conseguia distinguir
 * "só administrador" de "qualquer um com Benefícios".
 *
 * Marcela abaixo é exatamente quem faltava: tem Benefícios, emite
 * certificado todo dia, e NÃO pode reescrever o cabeçalho da planilha. */
(function criarUsuarioBeneficios() {
  const aba = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
  aba.getRange(aba.getLastRow() + 1, 1, 1, 8).setValues([[
    "marcela", g.gerarHashSenha_("Senha@2026"), "Marcela",
    "marcela@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "beneficios"
  ]]);
})();

const ADM = b.logar(g, "wanderson");
const ESC = b.logar(g, "joscimar");    // sem o módulo benefícios
const BEN = b.logar(g, "marcela");     // COM benefícios, sem ser administrador

/* A linha da solicitação como ela está hoje — na ORDEM DAS COLUNAS, que é o
 * que interessa. Os valores são os do log real, com o CPF trocado por um
 * fictício: dado pessoal não entra em arquivo versionado. */
const VALORES = [
  "", "", new Date(2026, 5, 9), "11144477735", "Wanderson Nascimento Castelo",
  "w@teste.com", "(27) 99999-9999", "ASSOCIADO", "VALIDADO", "FILHO",
  "Fulano de Tal", new Date(2015, 1, 10), 11, "Wanderson Nascimento Castelo",
  "FILHO", "NAO", "CENTRO EDUCACIONAL INFANTIL - ABC DO SABER", 1,
  "13.004.995/0001-00", "VITORIA - ES", "EDUCACAO_INFANTIL", "Educação Infantil",
  "", 1, "ANUAL", 2026, 100, "DECLARACAO_RH", "", "", "APROVADO", "PORTAL",
  "financeiro@exemplo.com", "Wanderson Nascimento Castelo", new Date(2026, 5, 10),
  "", "Aprovado em teste.", "BOLSA-2026-468890"
];

function montarAba(cabecalho) {
  const velha = ss.getSheetByName("Voucher_Solicitacoes");
  if (velha) ss.deleteSheet(velha);
  const sh = ss.insertSheet("Voucher_Solicitacoes");
  sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  sh.getRange(2, 1, 1, VALORES.length).setValues([VALORES]);
  return sh;
}
function cab(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v || "").trim());
}
function dado(sh) {
  return sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
}
function limparConsentimento() {
  try { g.PropertiesService.getScriptProperties().deleteProperty(g.VOUCHER_REPARO_PROP); } catch (e) {}
}
function backups() {
  return ss.getSheets().map(s => s.getName()).filter(n => n.indexOf("BACKUP_VOUCHER_SOLIC_") === 0);
}

const HOJE = g.VOUCHER_REPARO_CABECALHO_ESPERADO;
const CERTO = g.VOUCHER_REPARO_MAPA_REAL;

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · O mapa do reparo é coerente consigo mesmo");

b.passo("1. As quatro checagens que dão confiança na reconstrução");
const canon = g.VOUCHER_COLUNAS_SOLICITACOES_();
b.igual(CERTO.length, HOJE.length, "o mapa tem exatamente o número de colunas da aba");
b.ok(CERTO.every(h => canon.indexOf(h) > -1), "todo nome do mapa existe no catálogo canônico",
  CERTO.filter(h => canon.indexOf(h) === -1).join(", "));
b.igual(new Set(CERTO).size, CERTO.length, "nenhum nome repetido no mapa");
b.igual(canon.filter(h => CERTO.indexOf(h) === -1).sort(),
  ["CNPJ_INSTITUICAO", "EMAIL_INSTITUICAO", "INSTITUICAO_ENSINO"],
  "o que sobra do canônico são exatamente as 3 colunas novas");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · Quem pode mandar reparar");

b.passo("2. Sem sessão e sem o módulo, ninguém repara");
montarAba(HOJE); limparConsentimento();
b.bloqueia(() => g.voucherRepararColunasPrevia(), "prévia recusa anônimo");
b.bloqueia(() => g.voucherRepararColunasAplicar(), "aplicar recusa anônimo");
b.bloqueia(() => g.voucherRepararColunasPrevia(ESC), "prévia recusa quem não tem benefícios");
b.bloqueia(() => g.voucherRepararColunasAplicar(ESC), "aplicar recusa quem não tem benefícios");

b.passo("2b. Ter Benefícios NÃO basta — reescrever cabeçalho é de administrador");
/* Marcela emite certificado todos os dias e precisa do módulo inteiro. Nada
 * disso a autoriza a renomear as colunas da planilha: uma coisa é operar o
 * sistema, outra é mexer na estrutura do dado de todo mundo. */
b.bloqueia(() => g.voucherRepararColunasPrevia(BEN),
  "prévia recusa usuário de Benefícios que não é administrador");
b.bloqueia(() => g.voucherRepararColunasAplicar(BEN),
  "aplicar recusa usuário de Benefícios que não é administrador");

b.igual(cab(montarAba(HOJE)).join("|"), HOJE.join("|"), "nada foi escrito nas tentativas recusadas");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · Sem prévia não se aplica");

b.passo("3. Aplicar direto, sem ter olhado a prévia, é recusado");
montarAba(HOJE); limparConsentimento();
const semPrevia = g.voucherRepararColunasAplicar(ADM);
b.ok(semPrevia && semPrevia.ok === false && /prévia|previa/i.test(semPrevia.mensagem || ""),
  "aplicar sem prévia recente é recusado", String(semPrevia && semPrevia.mensagem || "").slice(0, 70));
b.igual(cab(ss.getSheetByName("Voucher_Solicitacoes")).join("|"), HOJE.join("|"),
  "e o cabeçalho continua exatamente como estava");
b.igual(backups().length, 0, "nenhum backup foi criado — nada chegou a ser tocado");

b.passo("4. A prévia NÃO grava — só mostra");
const previa = g.voucherRepararColunasPrevia(ADM);
b.ok(previa && previa.ok === true, "prévia responde ok");
b.igual(previa.trocam, 13, "ela conta 13 colunas com rótulo trocado");
b.igual(cab(ss.getSheetByName("Voucher_Solicitacoes")).join("|"), HOJE.join("|"),
  "e o cabeçalho continua intacto depois da prévia");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · A trava de mapa vencido — a asserção que não pode falhar");

/* A CORRIDA QUE ESTA TRAVA EXISTE PARA PEGAR
 *
 * A primeira versão destes passos chamava a prévia sobre a aba já alterada.
 * Não servia: a prévia recusava primeiro e o `aplicar` caía por falta de
 * consentimento — recusa certa, motivo errado, e o guard do `aplicar`
 * continuava sem uma linha de prova.
 *
 * O cenário real é outro, e é uma corrida: a prévia roda com a aba ainda
 * íntegra e libera o consentimento; ALGUÉM MEXE NA ABA nos 15 minutos
 * seguintes; o `aplicar` roda com um mapa que já não descreve a planilha.
 * Aí sim é o guard dele que tem que morder — e é isso que se testa abaixo,
 * concedendo o consentimento direto, como se a prévia tivesse rodado antes
 * da alteração. */
function consentimentoValido() {
  g.PropertiesService.getScriptProperties().setProperty(
    g.VOUCHER_REPARO_PROP, JSON.stringify({ quando: new Date().getTime() }));
}

b.passo("5. Coluna a mais DEPOIS da prévia: o aplicar recusa");
/* O mapa é posicional. Uma coluna inserida desloca o que vem depois, e
 * aplicar assim renomearia colunas que estavam certas — troca um estrago
 * por outro, maior. */
const comExtra = montarAba(HOJE);
comExtra.getRange(1, HOJE.length + 1).setValue("COLUNA_NOVA_DA_SECRETARIA");
consentimentoValido();
const rExtra = g.voucherRepararColunasAplicar(ADM);
b.ok(rExtra && rExtra.ok === false && /colunas|mudou|diagn/i.test(rExtra.mensagem || ""),
  "recusa quando a aba tem número de colunas diferente do mapa",
  String(rExtra && rExtra.mensagem || "").slice(0, 90));
b.igual(cab(comExtra)[11], "INSTITUICAO_ENSINO", "e não escreveu nada");
b.igual(backups().length, 0, "nem backup, porque nem chegou a tocar na aba");

b.passo("6. UMA célula do cabeçalho diferente: o aplicar recusa");
const mexida = HOJE.slice();
mexida[20] = "OUTRO_NOME_QUALQUER";
const shMexida = montarAba(mexida);
consentimentoValido();
const rMexida = g.voucherRepararColunasAplicar(ADM);
b.ok(rMexida && rMexida.ok === false && /coluna 21|mudou|diagn/i.test(rMexida.mensagem || ""),
  "recusa quando UMA célula do cabeçalho não bate",
  String(rMexida && rMexida.mensagem || "").slice(0, 95));
b.igual(cab(shMexida).join("|"), mexida.join("|"), "e a aba fica exatamente como estava");
b.igual(backups().length, 0, "nenhum backup — porque nada foi escrito");

b.passo("6b. A prévia também recusa aba que não bate — e NÃO libera consentimento");
limparConsentimento();
const previaMexida = g.voucherRepararColunasPrevia(ADM);
b.ok(previaMexida && previaMexida.ok === false, "prévia recusa a aba alterada",
  String(previaMexida && previaMexida.mensagem || "").slice(0, 70));
b.igual(g.PropertiesService.getScriptProperties().getProperty(g.VOUCHER_REPARO_PROP), null,
  "e não deixa consentimento para trás — prévia recusada não autoriza nada");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · O reparo em si");

b.passo("7. Aplica: a linha 1 vira o que cada coluna de fato guarda");
limparConsentimento();
const sh = montarAba(HOJE);
const dadoAntes = dado(sh).map(v => (v instanceof Date ? v.getTime() : v));
g.voucherRepararColunasPrevia(ADM);
const r = g.voucherRepararColunasAplicar(ADM);
b.ok(r && r.ok === true, "reparo responde ok", String(r && r.mensagem || ""));

const cabDepois = cab(sh);
b.igual(cabDepois.slice(0, CERTO.length), CERTO, "a linha 1 passa a ser o mapa reconstruído");

b.passo("8. E o DADO não se mexeu — nem uma célula");
const dadoDepois = dado(sh).map(v => (v instanceof Date ? v.getTime() : v));
b.igual(dadoDepois.slice(0, dadoAntes.length), dadoAntes, "todos os valores continuam onde estavam");

b.passo("9. Agora cada valor está sob o nome certo — TODAS as colunas");
/* Aqui não vale conferir por amostra.
 *
 * A primeira versão deste passo checava nove campos escolhidos a dedo, e
 * sobreviveu à mutação que TROCAVA PARENTESCO com ENTEADO_DECLARADO_IR
 * dentro do mapa. Um mapa errado é o pior defeito possível deste arquivo —
 * é ele que decide o nome de cada coluna — e o teste passava porque os dois
 * campos trocados não estavam na amostra.
 *
 * Agora a tabela abaixo é o esperado COMPLETO: para cada nome de coluna, o
 * valor que tem que aparecer embaixo dele. Qualquer permuta no mapa cai. */
function porNome(nome) {
  const i = cab(sh).indexOf(nome);
  return i === -1 ? undefined : dado(sh)[i];
}
const ESPERADO = {
  ID_SOLICITACAO: "", DATA_SOLICITACAO: "", CPF_SOLICITANTE: "11144477735",
  NOME_SOLICITANTE: "Wanderson Nascimento Castelo", EMAIL: "w@teste.com",
  TELEFONE: "(27) 99999-9999", SITUACAO_SINDICAL: "ASSOCIADO",
  STATUS_VALIDACAO_SINDICAL: "VALIDADO", TIPO_BENEFICIARIO: "FILHO",
  NOME_BENEFICIARIO: "Fulano de Tal", IDADE_BENEFICIARIO: 11,
  NOME_TITULAR_ASSOCIADO: "Wanderson Nascimento Castelo", PARENTESCO: "FILHO",
  ENTEADO_DECLARADO_IR: "NAO",
  ESCOLA_SELECIONADA: "CENTRO EDUCACIONAL INFANTIL - ABC DO SABER",
  UNIDADE_ESCOLA: 1, CNPJ_ESCOLA: "13.004.995/0001-00", CIDADE_ESCOLA: "VITORIA - ES",
  MODALIDADE: "EDUCACAO_INFANTIL", CURSO: "Educação Infantil", AREA_CURSO: "",
  ORDEM_FILHO: 1, REGIME: "ANUAL", PERIODO_REFERENCIA: 2026,
  PERCENTUAL_APLICADO: 100, TIPO_DOCUMENTO_VINCULO: "DECLARACAO_RH",
  LINK_CONTRACHEQUE: "", LINK_DOC_PESSOAL: "", STATUS_SOLICITACAO: "APROVADO",
  CANAL_ENTRADA: "PORTAL", USUARIO_CADASTRO: "financeiro@exemplo.com",
  USUARIO_VALIDACAO: "Wanderson Nascimento Castelo", DATA_EMISSAO: "",
  OBSERVACOES: "Aprovado em teste.", NUMERO_PROTOCOLO: "BOLSA-2026-468890"
};
const erradas = [];
Object.keys(ESPERADO).forEach(function (nome) {
  const v = porNome(nome);
  if (JSON.stringify(v) !== JSON.stringify(ESPERADO[nome])) {
    erradas.push(nome + " = " + JSON.stringify(v) + " (esperado " + JSON.stringify(ESPERADO[nome]) + ")");
  }
});
b.ok(erradas.length === 0,
  "as " + Object.keys(ESPERADO).length + " colunas de valor conhecido batem com o nome",
  erradas.length ? erradas.slice(0, 3).join(" · ") : "");

/* As três colunas de data ficam de fora da tabela porque a comparação é por
 * identidade de objeto Date; checadas aqui pelo tipo e pelo ano. */
b.ok(porNome("DATA_NASCIMENTO_BENEFICIARIO") instanceof Date &&
     porNome("DATA_NASCIMENTO_BENEFICIARIO").getFullYear() === 2015,
  "DATA_NASCIMENTO_BENEFICIARIO traz a data de nascimento (2015)");
b.ok(porNome("DATA_VALIDACAO") instanceof Date &&
     porNome("DATA_VALIDACAO").getFullYear() === 2026,
  "DATA_VALIDACAO traz a data de validação (2026)");
b.ok(porNome("DATA_SOLICITACAO_TEXTO") instanceof Date,
  "DATA_SOLICITACAO_TEXTO traz a data da solicitação");

b.passo("10. As 3 colunas novas entram no fim, vazias");
["INSTITUICAO_ENSINO", "CNPJ_INSTITUICAO", "EMAIL_INSTITUICAO"].forEach(function (h) {
  const i = cab(sh).indexOf(h);
  b.ok(i >= CERTO.length, h + " está depois da última coluna que já existia", "posição " + (i + 1));
});
b.igual(porNome("INSTITUICAO_ENSINO"), "", "e vem vazia — o dado da instituição nunca foi coletado");

b.passo("11. O backup foi feito ANTES de escrever");
const bks = backups();
b.igual(bks.length, 1, "existe exatamente um backup", bks.join(", "));
const bk = ss.getSheetByName(bks[0]);
b.igual(bk.getRange(1, 1, 1, HOJE.length).getValues()[0].map(String), HOJE,
  "e ele guarda o cabeçalho DE ANTES do reparo");

b.passo("12. A prévia vale UMA vez — o consentimento é consumido ao ser usado");
/* Esta asserção nasceu de uma mutação que sobreviveu: trocar o
 * `deleteProperty` por um `getProperty` — ou seja, tornar o consentimento
 * reutilizável — não derrubava nada. O passo seguinte ainda dava recusa, mas
 * pela trava do cabeçalho, não pela do consentimento. Duas travas em série,
 * e a de trás cobrindo a da frente: a da frente podia sumir sem ninguém ver.
 *
 * Por isso agora se olha direto na ScriptProperties. */
b.igual(g.PropertiesService.getScriptProperties().getProperty(g.VOUCHER_REPARO_PROP), null,
  "o consentimento foi apagado ao ser usado");

const deNovo = g.voucherRepararColunasAplicar(ADM);
b.ok(deNovo && deNovo.ok === false && /prévia|previa|consentimento/i.test(deNovo.mensagem || ""),
  "segunda aplicação é recusada POR FALTA DE CONSENTIMENTO",
  String(deNovo && deNovo.mensagem || "").slice(0, 70));
b.igual(backups().length, 1, "e nenhum segundo backup foi criado");

b.passo("13. Reparo aplicado duas vezes desalinharia de novo — a trava impede");
/* Depois do reparo o cabeçalho já não é o que o mapa descreve. Rodar o
 * reparo outra vez sobre a aba corrigida aplicaria a permutação por cima da
 * permutação, e o estrago voltaria — pior, com backup do estado bom já
 * sobrescrito na cabeça de quem opera. Por isso a trava tem que morder mesmo
 * com consentimento em mãos. */
consentimentoValido();
const terceira = g.voucherRepararColunasAplicar(ADM);
b.ok(terceira && terceira.ok === false && /coluna|mudou|diagn/i.test(terceira.mensagem || ""),
  "com consentimento válido, ainda assim recusa — a aba já não é a que o mapa descreve",
  String(terceira && terceira.mensagem || "").slice(0, 95));
b.igual(cab(sh).slice(0, CERTO.length), CERTO, "e o reparo feito continua de pé");
b.igual(backups().length, 1, "e nenhum backup novo foi criado por cima");

b.passo("14. Consentimento é consumido mesmo quando o reparo é recusado depois");
/* Se o consentimento sobrevivesse a uma recusa, quem apanhou da trava do
 * cabeçalho poderia ficar tentando de novo sem nunca reler a prévia — e a
 * prévia é justamente onde a pessoa vê o que vai mudar. */
const shOutra = montarAba(HOJE);
shOutra.getRange(1, HOJE.length + 1).setValue("COLUNA_INTRUSA");
consentimentoValido();
const recusado = g.voucherRepararColunasAplicar(ADM);
b.ok(recusado && recusado.ok === false, "recusado pela trava do cabeçalho, como esperado");
b.igual(g.PropertiesService.getScriptProperties().getProperty(g.VOUCHER_REPARO_PROP), null,
  "e mesmo assim o consentimento foi queimado — nova tentativa exige nova prévia");

b.resumo();
process.exit(0);
