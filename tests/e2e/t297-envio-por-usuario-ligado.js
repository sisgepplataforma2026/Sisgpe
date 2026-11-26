/**
 * ENVIO EM NOME DE QUEM ESTÁ LOGADO — LIGADO NO CERTIFICADO DE VOUCHER E NA DECLARAÇÃO (26/11/2026, "sim" do usuário; ofício e recibo NÃO).
 * Pedido: "se eu entrei na conta da Marcela, ofícios, certificados e declarações saem em nome da secretaria; se é o financeiro, é a parte
 * financeira; as demais são com a Marcela". Prova: certificado enviado pela Marcela vai pelo leitor da Secretaria (fica nos Itens enviados
 * DELA); pelo financeiro, pelo caminho de sempre (conta do Financeiro); leitor desligado → caminho de sempre; leitor ligado que FALHA → erro,
 * sem cair para o Financeiro (evita envio duplicado); quem não marca o remetente (ofício, recibo) segue exatamente como antes.
 * NÃO PROVA: o e-mail chegando e a pasta Itens enviados de verdade (só no ar, com o leitor ligado).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");   // financeiro (pelo nome)
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline", "secretaria@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["fulano", g.gerarHashSenha_("Senha@2026"), "Fulano de Tal", "fulano@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const MAR = b.logar(g, "marcelha"), FUL = b.logar(g, "fulano");
const PROTOCOLO = "VCH-2026-000042";
const NAO_EMITIDO = "VCH-2026-999999";

/* ── monta as abas do módulo pelo caminho real do sistema ── */
g.setupVoucherModuleFase1();

function gravar(nomeAba, campos) {
  const sh = ss.getSheetByName(nomeAba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(c => String(c || "").trim());
  const linha = cab.map(c => (campos[c] !== undefined ? campos[c] : ""));
  sh.getRange(sh.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
  return sh.getLastRow();
}

function limparSolicitacoes() {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
}

/** A solicitação base. Os passos que mexem no e-mail da instituição regravam. */
function semearSolicitacao(extras) {
  limparSolicitacoes();
  const campos = {
    ID_SOLICITACAO: "SOL-0001",
    CPF_SOLICITANTE: "11144477735",
    NOME_SOLICITANTE: "Beatriz do Nascimento Campos",
    EMAIL: "beatriz@exemplo.com",
    TELEFONE: "(27) 99876-5432",
    ESCOLA_SELECIONADA: "MULTIVIX",
    INSTITUICAO_ENSINO: "IESES",
    CNPJ_INSTITUICAO: "02213188000181",
    CURSO: "Pedagogia",
    PERIODO_REFERENCIA: "2026/2",
    PERCENTUAL_APLICADO: "70",
    STATUS_SOLICITACAO: "APROVADO",
    NUMERO_PROTOCOLO: PROTOCOLO
  };
  Object.keys(extras || {}).forEach(k => { campos[k] = extras[k]; });
  gravar("Voucher_Solicitacoes", campos);
}

semearSolicitacao({});
gravar("Voucher_Emitidos", {
  ID_EMISSAO: "EMI-0001",
  DATA_EMISSAO: "12/08/2026 10:30",
  PROTOCOLO: PROTOCOLO,
  ID_SOLICITACAO: "SOL-0001",
  NOME_SOLICITANTE: "Beatriz do Nascimento Campos",
  CPF: "11144477735",
  ESCOLA: "MULTIVIX",
  TIPO_DOCUMENTO: "CERTIFICADO",
  CODIGO_VALIDACAO: "A1B2C3D4",
  LINK_ARQUIVO: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view",
  PERCENTUAL: "70",
  USUARIO: "wanderson"
});


let leitor = [];
const ligarLeitor = (ligado, falha) => { g.cxgLigada_ = () => ligado; g.cxgApi_ = (op, args) => { if (falha) throw new Error("Caixa da secretaria@: erro de teste"); leitor.push({ op, args }); return { ok: true, anexos: [] }; }; };
const zerar = () => { leitor = []; amb.outbox.length = 0; };

b.fluxo("ENVIO POR USUÁRIO · certificado de voucher");
b.passo("1. Marcela logada: sai pelo leitor da Secretaria");
ligarLeitor(true); zerar();
const r1 = g.voucherEnviarPorEmail(PROTOCOLO, {}, MAR);
b.ok(r1 && r1.ok !== false, "o envio responde ok", r1 && r1.mensagem);
b.ok(leitor.length === 1 && leitor[0].op === "novoEmail" && /Certificado de Bolsa de Estudo/.test(leitor[0].args.assunto), "o leitor da Secretaria recebeu o certificado (operação novoEmail)", JSON.stringify(leitor.map((x) => x.op)));
b.ok(/beatriz@exemplo\.com/.test(leitor[0] && leitor[0].args.para), "para o associado", leitor[0] && leitor[0].args.para);
b.igual(amb.outbox.length, 0, "e NADA saiu pela conta do Financeiro (não cai nos Itens enviados dela)");

b.passo("2. Outro usuário (que não é a Marcela nem o financeiro): também pela Secretaria");
zerar();
g.voucherEnviarPorEmail(PROTOCOLO, {}, FUL);
b.ok(leitor.length === 1 && amb.outbox.length === 0, "'as demais são com a Marcela'");

b.passo("3. Financeiro logado: pelo caminho de sempre");
zerar();
g.voucherEnviarPorEmail(PROTOCOLO, {}, ADM);
b.ok(leitor.length === 0 && amb.outbox.length === 1 && amb.outbox[0].via === "GmailApp", "o leitor NÃO foi usado; saiu pela conta do sistema (Financeiro), como sempre", amb.outbox.map((x) => x.via).join(","));

b.passo("4. Leitor desligado: tudo como hoje");
ligarLeitor(false); zerar();
g.voucherEnviarPorEmail(PROTOCOLO, {}, MAR);
b.ok(leitor.length === 0 && amb.outbox.length === 1, "sem o leitor configurado, o e-mail sai como sempre (nada deixa de sair)");

b.passo("5. Leitor ligado que FALHA: erro, sem cair para o Financeiro");
ligarLeitor(true, true); zerar();
let falhou = false, r5 = null; try { r5 = g.voucherEnviarPorEmail(PROTOCOLO, {}, MAR); } catch (e) { falhou = true; }
b.ok(falhou || (r5 && r5.ok === false), "o envio acusa erro", r5 && r5.mensagem);
b.igual(amb.outbox.length, 0, "e NÃO saiu pela conta do Financeiro (evita e-mail duplicado se o leitor tiver mandado)");

b.fluxo("ENVIO POR USUÁRIO · ofício e recibo NÃO mudam");
ligarLeitor(true); zerar();
g.enviarComoRascunhoSISGEP_({ to: "escola@exemplo.com", subject: "Ofício 232/2026", htmlBody: "<p>x</p>", attachments: [], name: "SindEducação-ES", replyTo: "secretaria@sindeducacao.com" }, "Segue ofício.");
b.ok(leitor.length === 0 && amb.outbox.length === 1, "quem não marca o remetente (ofício, recibo) segue pela conta do sistema, mesmo com o leitor ligado");
const raiz = path.join(__dirname, "../..");
const usam = fs.readdirSync(raiz).filter((f) => f.endsWith(".gs") && f !== "EnvioPorUsuario.gs" && /envioRemetentePorSessao_|envioPelaSecretaria_|envioViaSecretariaDisponivel_/.test(fs.readFileSync(path.join(raiz, f), "utf8"))).sort();
b.igual(usam, ["DeclaracaoDiretor.gs", "EmailOficios.gs", "VoucherEnvio.gs", "VoucherEnvioFamilia.gs"], "só estes quatro arquivos usam as funções novas");
["FilaOficios.gs", "Oficios.gs", "Recibo.gs", "ReciboDiversos.gs", "RelatoriosOficios.gs", "OficiosReenvioMotivo.gs"].forEach((f) => {
  const t = fs.existsSync(path.join(raiz, f)) ? fs.readFileSync(path.join(raiz, f), "utf8") : "";
  b.ok(!/envioRemetentePorSessao_|\.remetente\s*=/.test(t), f + ": não marca remetente (continua como antes)");
});
const decl = fs.readFileSync(path.join(raiz, "DeclaracaoDiretor.gs"), "utf8");
b.ok(/op\.remetente = envioRemetentePorSessao_\(sessao\);\s*\/\/[^\n]*\n\s*enviarComoRascunhoSISGEP_\(op,/.test(decl), "a declaração marca o remetente logo antes de enviar");
b.naoTestavel("o e-mail chegando e a pasta Itens enviados da Secretaria", "só no ar, com o leitor da Secretaria ligado");
b.resumo();
