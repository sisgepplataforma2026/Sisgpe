/**
 * TESTE — QUANDO O ASSOCIADO PEDIU, E QUEM FEZ CADA ETAPA
 *
 * "Na observação tem que constar a data da solicitação e a informação",
 * "controle de quem fez o voucher" e "quando aprovar deve aparecer" — você,
 * 30/09/2026.
 *
 * O DEFEITO DE FUNDO. `DATA_SOLICITACAO` recebia `new Date()` na hora de
 * gravar. Numa solicitação manual isso é o instante em que a secretaria
 * transcreve o e-mail — e o e-mail chegou dias antes. Essa coluna existe
 * desde 22/09 para medir o PRAZO DE ATENDIMENTO até a DATA_EMISSAO; com as
 * duas nascendo do mesmo clique, o prazo dava sempre perto de zero. Um número
 * que existe e mente é pior do que um número que falta, porque ninguém
 * desconfia dele.
 *
 * O FUSO TEM SEÇÃO PRÓPRIA AQUI, e não é preciosismo: `new Date("2026-09-24")`
 * é lido como UTC e, no horário de Vitória, devolve 23/09. O pedido andaria
 * um dia para trás e continuaria plausível — ninguém acharia nunca.
 *
 * E A FRASE DO CERTIFICADO É MEDIDA INTEIRA. Em 23/09 a flexão por sexo foi
 * aplicada ao "portador/portadora" e o "empregado" ficou cravado no
 * masculino: o papel de uma associada saía "PORTADORA do CPF … EMPREGADO da
 * instituição". As asserções de então mediam a palavra que eu lembrei de
 * olhar. Estas medem a oração de identificação do começo ao fim.
 *
 * O QUE ESTE TESTE NÃO PROVA: o PDF. No emulador o Drive é dublê e a
 * conversão HTML→PDF não roda.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* ══════════════════════════════════════════════════════════════════
   PARTE 1 — A DATA DO PEDIDO, NORMALIZADA
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · A data do pedido não é a data da digitação");

const HOJE = new Date(2026, 8, 30);   // 30/09/2026
function dia(d) {
  return d ? [String(d.getDate()).padStart(2, "0"),
              String(d.getMonth() + 1).padStart(2, "0"),
              d.getFullYear()].join("/") : "";
}

b.igual(dia(g.voucherDataPedido_("2026-09-24", HOJE)), "24/09/2026",
  "'AAAA-MM-DD' vira o dia certo — e NÃO o anterior, que é o que new Date() daria no fuso de Vitória");
b.igual(dia(g.voucherDataPedido_("24/09/2026", HOJE)), "24/09/2026",
  "'DD/MM/AAAA' também é aceito, para quem chamar de outro lugar");
b.igual(dia(g.voucherDataPedido_(new Date(2026, 8, 24, 23, 40), HOJE)), "24/09/2026",
  "Date com hora tardia não escorrega para o dia seguinte");

b.igual(dia(g.voucherDataPedido_("", HOJE)), "30/09/2026", "vazio vira hoje");
b.igual(dia(g.voucherDataPedido_(null, HOJE)), "30/09/2026", "nulo vira hoje");
b.igual(dia(g.voucherDataPedido_("banana", HOJE)), "30/09/2026", "texto ilegível vira hoje, em vez de gravar lixo");

/* O FUTURO É RECUSADO, o passado não. Data de amanhã é erro de digitação
   sempre; data de três meses atrás pode ser atraso real da secretaria — e é
   justamente esse caso que a medição de prazo existe para mostrar. */
b.igual(dia(g.voucherDataPedido_("2026-12-01", HOJE)), "30/09/2026",
  "data no FUTURO é recusada e vira hoje");
b.igual(dia(g.voucherDataPedido_("2026-01-05", HOJE)), "05/01/2026",
  "data bem antiga é ACEITA — atraso real não pode ser escondido");

/* A hora é zerada: o que se guarda é um DIA. Hora falsa daria impressão de
   precisão que o dado não tem. */
const zerada = g.voucherDataPedido_("2026-09-24", HOJE);
b.ok(zerada.getHours() === 0 && zerada.getMinutes() === 0,
  "a hora vem zerada — o dado é um dia, não um instante");

/* ══════════════════════════════════════════════════════════════════
   PARTE 2 — A GRAVAÇÃO SEPARA AS DUAS DATAS
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · O que vai para a planilha");

let shA = ss.getSheetByName("Associados");
if (!shA) { shA = ss.insertSheet("Associados"); shA.appendRow(["CPF", "Nome", "Filiado", "Email", "Sexo"]); }
shA.appendRow(["11144477735", "MARCELHA ALINE PINTO GOMES", "SIM", "marcelha@escola.com.br", "F"]);
shA.appendRow(["52998224725", "ATILA DE SOUZA", "SIM", "atila@escola.com.br", "M"]);

function linhaDoProtocolo(proto) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const iP = cab.indexOf("NUMERO_PROTOCOLO");
  const l = dados.filter(r => String(r[iP] || "").trim() === proto)[0];
  if (!l) return null;
  const o = {};
  cab.forEach((c, i) => { o[c] = l[i]; });
  return o;
}

const ONTEM = new Date();
ONTEM.setDate(ONTEM.getDate() - 6);
const ontemIso = ONTEM.getFullYear() + "-" +
  String(ONTEM.getMonth() + 1).padStart(2, "0") + "-" +
  String(ONTEM.getDate()).padStart(2, "0");

const salvo = g.voucherCriarSolicitacao({
  cpf: "11144477735", nome: "MARCELHA ALINE PINTO GOMES",
  email: "marcelha@escola.com.br",
  dataPedido: ontemIso,
  escola: "SOCIEDADE EDUCACAO E GESTAO DE EXCELENCIA S.A.",
  cnpjEscola: "37745762000127",
  instituicao: "SOCIEDADE EDUCACAO E GESTAO DE EXCELENCIA S.A.",
  quem: "PROPRIO", modalidade: "POS_GRADUACAO", curso: "Direito Marítimo",
  areaCurso: "HUMANAS", periodo: "2027", percentual: "70",
  observacoes: "Mandou o contracheque junto.",
  aprovar: true
}, TOKEN);

b.ok(salvo && salvo.ok, "a solicitação foi salva", salvo && salvo.mensagem);
const linha = salvo && salvo.ok ? linhaDoProtocolo(salvo.protocolo) : null;
b.ok(!!linha, "e a linha existe na planilha");

if (linha) {
  b.igual(String(linha.DATA_SOLICITACAO_TEXTO), dia(ONTEM),
    "DATA_SOLICITACAO guarda o dia em que o ASSOCIADO PEDIU");
  b.ok(String(linha.DATA_REGISTRO_TEXTO || "").indexOf(dia(new Date())) === 0,
    "e DATA_REGISTRO guarda o dia em que a secretaria DIGITOU",
    String(linha.DATA_REGISTRO_TEXTO));
  b.ok(String(linha.DATA_SOLICITACAO_TEXTO) !== String(linha.DATA_REGISTRO_TEXTO),
    "as duas são diferentes — que é o ponto inteiro desta entrega");

  /* ════════════════════════════════════════════════════════════════
     PARTE 3 — O CABEÇALHO DA OBSERVAÇÃO
     ════════════════════════════════════════════════════════════════ */
  b.fluxo("BOLSAS · O cabeçalho que o sistema escreve na observação");

  const obs = String(linha.OBSERVACOES || "");
  b.ok(obs.indexOf("Pedido solicitado em " + dia(ONTEM)) === 0,
    "começa com 'Pedido solicitado em <data do pedido>' — a redação que você definiu",
    obs.split("\n")[0]);
  b.ok(/registrado por \S+ em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(obs),
    "e diz quem registrou e quando, com hora",
    obs.split("\n")[0]);
  b.ok(obs.indexOf("Titular — Pós-Graduação · Direito Marítimo · 70%") > -1,
    "a segunda linha traz beneficiário, modalidade, curso e percentual",
    (obs.split("\n")[1] || ""));
  b.ok(obs.indexOf("Mandou o contracheque junto.") > -1,
    "e o que a pessoa digitou continua lá, embaixo");
  b.ok(obs.indexOf("──────────") > -1, "separados por uma linha");
  b.ok(obs.indexOf("POS_GRADUACAO") === -1,
    "a modalidade sai por extenso, nunca com o valor do banco");

  /* O cabeçalho é montado DEPOIS das regras: tem de trazer o percentual
     CONCEDIDO, não o que foi digitado. */
  b.ok(obs.indexOf(String(linha.PERCENTUAL_APLICADO) + "%") > -1,
    "o percentual do cabeçalho é o CONCEDIDO, o mesmo que foi gravado",
    linha.PERCENTUAL_APLICADO + "%");
}

/* Observação vazia não pode deixar um separador solto pendurado. */
const semObs = g.voucherCriarSolicitacao({
  cpf: "52998224725", nome: "ATILA DE SOUZA", email: "atila@escola.com.br",
  escola: "COLEGIO EXEMPLO", quem: "PROPRIO", modalidade: "GRADUACAO",
  curso: "Biomedicina", areaCurso: "SAUDE", periodo: "2027", percentual: "50",
  observacoes: ""
}, TOKEN);
if (semObs && semObs.ok) {
  const o2 = String((linhaDoProtocolo(semObs.protocolo) || {}).OBSERVACOES || "");
  b.ok(o2.indexOf("──────────") === -1,
    "sem observação digitada, não sobra separador pendurado");
  b.ok(o2.indexOf("Pedido solicitado em") === 0, "e o cabeçalho continua lá");
}

/* ══════════════════════════════════════════════════════════════════
   PARTE 4 — A FRASE DO CERTIFICADO, MEDIDA INTEIRA
   ══════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · A identificação do titular concorda em gênero, inteira");

function textoCert(reg) {
  const html = g.gerarHtmlDocumentoVoucher_({
    reg: reg, protocolo: reg.NUMERO_PROTOCOLO, codigo: "VAL-TESTE",
    percentual: reg.PERCENTUAL_APLICADO, rg: reg.RG_SOLICITANTE
  });
  return html.slice(html.indexOf("<body"))
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
const REG = {
  NUMERO_PROTOCOLO: "BOLSA-2026-000001",
  NOME_SOLICITANTE: "MARCELHA ALINE PINTO GOMES", CPF_SOLICITANTE: "11144477735",
  SEXO_SOLICITANTE: "F", ESCOLA_SELECIONADA: "SOCIEDADE EDUCACAO S.A.",
  ESCOLA_FANTASIA: "UVV", CNPJ_ESCOLA: "37745762000127",
  TIPO_BENEFICIARIO: "TITULAR", NOME_BENEFICIARIO: "MARCELHA ALINE PINTO GOMES",
  MODALIDADE: "POS_GRADUACAO", CURSO: "Direito Marítimo",
  PERIODO_REFERENCIA: "2027", PERCENTUAL_APLICADO: "70", REGIME: "ANUAL"
};

/* A ORAÇÃO INTEIRA, e não a palavra. Foi medir só o "portador" que deixou o
   "empregado" passar de 23/09 até 30/09. */
const daAssociada = textoCert(REG);
b.ok(/portadora do CPF n.?\s+[\d.\-]+\s*,\s*empregada da institui..o\s+UVV/.test(daAssociada),
  "associada: 'portadora … empregada' — a frase concorda do começo ao fim",
  (daAssociada.match(/portadora[^.]{0,70}/) || [""])[0]);
b.ok(daAssociada.indexOf("empregado da") === -1,
  "e não sobra nenhum 'empregado' no masculino no documento dela");

const doAssociado = textoCert(Object.assign({}, REG, {
  NOME_SOLICITANTE: "ATILA DE SOUZA", NOME_BENEFICIARIO: "ATILA DE SOUZA", SEXO_SOLICITANTE: "M"
}));
b.ok(/portador do CPF n.?\s+[\d.\-]+\s*,\s*empregado da institui..o\s+UVV/.test(doAssociado),
  "associado: 'portador … empregado'",
  (doAssociado.match(/portador[^.]{0,70}/) || [""])[0]);

/* SEXO DESCONHECIDO não vira chute pelo primeiro nome: qualquer "Darci"
   erraria, e ninguém perceberia. */
const semSexo = textoCert(Object.assign({}, REG, {
  NOME_SOLICITANTE: "DARCI PEREIRA", NOME_BENEFICIARIO: "DARCI PEREIRA", SEXO_SOLICITANTE: ""
}));
b.ok(/portador\(a\) do CPF/.test(semSexo) && /empregado\(a\) da/.test(semSexo),
  "sexo desconhecido: 'portador(a) … empregado(a)' nos DOIS, sem adivinhar pelo nome");

/* ══════════════════════════════════════════════════════════════════
   PARTE 5 — QUEM FEZ, NA TELA
   ══════════════════════════════════════════════════════════════════ */
if (!dom.jsdomDisponivel()) {
  b.naoTestavel("a seção 'Quem fez' no modal", "jsdom não instalado (npm i)");
  b.resumo();
  return;
}

(async function () {
  b.fluxo("BOLSAS · 'Quem fez' aparece só para a etapa que aconteceu");

  const tela = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  if (tela.win.initCertificadoAdmin) tela.win.initCertificadoAdmin();
  await tela.assentar(120);
  const doc = tela.doc;

  const lista = g.listarSolicitacoesVoucher();
  const aprovada = lista.filter(x => x.protocolo === salvo.protocolo)[0];
  b.ok(!!aprovada, "a solicitação aprovada veio na listagem");
  b.ok(String(aprovada.registradoPor || "").length > 0,
    "a listagem passou a mandar quem REGISTROU", aprovada.registradoPor);
  b.ok(String(aprovada.aprovadoPor || "").length > 0,
    "e quem APROVOU", aprovada.aprovadoPor);
  b.igual(String(aprovada.emitidoPor || ""), "",
    "e 'emitido por' vem VAZIO — o certificado ainda não foi gerado");

  /* ABRE PELO BOTÃO DA LINHA, como quem atende abre. As funções da tela
     vivem dentro de um IIFE e não estão no `window` — e chamar por dentro
     testaria a função, não o caminho que a pessoa percorre. */
  await tela.assentar(300);
  const btnAbrir = doc.querySelector('.cert-btn-abrir-modal[data-prot="' + salvo.protocolo + '"]');
  b.ok(!!btnAbrir, "a linha da solicitação está na tabela, com o botão de abrir");
  if (btnAbrir) { tela.clicar(btnAbrir); await tela.assentar(200); }

  b.igual(doc.getElementById("cmi-quemBox").style.display, "",
    "a seção aparece quando há alguma etapa com autor");
  b.igual(doc.getElementById("cmi-regBox").style.display, "",
    "a linha de 'Registrado por' aparece");
  b.igual(doc.getElementById("cmi-aprBox").style.display, "",
    "a de 'Aprovado por' também — era o seu 'quando aprovar deve aparecer'");
  b.igual(doc.getElementById("cmi-emiBox").style.display, "none",
    "e a de 'Emitido por' fica ESCONDIDA — afirmaria uma emissão que não houve");

  /* O e-mail vira nome na leitura; a coluna continua guardando o e-mail. */
  const txtReg = doc.getElementById("cmi-registrado").textContent;
  b.ok(txtReg.indexOf("@") === -1,
    "o e-mail do usuário vira nome legível na tela", txtReg);
  b.ok(/\d{2}\/\d{2}\/\d{4}/.test(txtReg),
    "e a data acompanha o nome — 'aprovado por quem' sem 'quando' não responde nada",
    txtReg);

  /* PENDENTE: registrada, nunca aprovada. A segunda solicitação do teste
     ficou assim de propósito. */
  const btnPend = doc.querySelector('.cert-btn-abrir-modal[data-prot="' + semObs.protocolo + '"]');
  b.ok(!!btnPend, "a solicitação pendente também está na tabela");
  if (btnPend) { tela.clicar(btnPend); await tela.assentar(200); }
  b.igual(doc.getElementById("cmi-regBox").style.display, "",
    "na pendente, 'Registrado por' continua aparecendo");
  b.igual(doc.getElementById("cmi-aprBox").style.display, "none",
    "mas 'Aprovado por' some — não fica um travessão afirmando o contrário");

  /* ══════════════════════════════════════════════════════════════
     PARTE 6 — O CAMPO NA TELA DE NOVA SOLICITAÇÃO
     ══════════════════════════════════════════════════════════════ */
  b.fluxo("BOLSAS · O campo 'Data do pedido' no formulário");

  tela.clicar("#certBtnNova");
  await tela.assentar(100);
  const campo = doc.getElementById("certNvDataPedido");
  b.ok(!!campo, "o campo existe");
  b.igual(campo.getAttribute("type"), "date", "é um calendário, não texto livre");

  const hojeIso = new Date().getFullYear() + "-" +
    String(new Date().getMonth() + 1).padStart(2, "0") + "-" +
    String(new Date().getDate()).padStart(2, "0");
  b.igual(campo.value, hojeIso, "nasce com HOJE — o palpite certo na maioria das vezes");
  b.igual(campo.getAttribute("max"), hojeIso,
    "e o calendário não deixa escolher o futuro");
  b.ok(doc.getElementById("certNvOrgDataPedido").textContent.indexOf("hoje") > -1,
    "com a origem à vista, pedindo correção se o e-mail é mais antigo",
    doc.getElementById("certNvOrgDataPedido").textContent.trim());

  b.resumo();
})();
