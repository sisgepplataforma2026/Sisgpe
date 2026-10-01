/**
 * TESTE — ENVIO DO CERTIFICADO DE BOLSA (VoucherEnvio.gs)
 *
 * O QUE ESTE TESTE EXISTE PARA PROVAR
 *
 * O envio é o passo em que o documento sai do sistema e chega em gente de
 * fora — o associado e a instituição de ensino. Errar aqui não é uma tela
 * torta: é certificado na caixa de entrada errada, ou cópia mandada para uma
 * faculdade quando o associado não queria que ela soubesse.
 *
 * Três coisas foram descobertas justamente por rodar isto, e cada uma virou
 * um passo abaixo:
 *
 *   1. voucherPrepararEnvio lia solic.EMAIL_INSTITUICAO, uma coluna que eu
 *      não tinha criado. Defeito meu, e silencioso: devolvia "" sempre.
 *   2. buscarEmailRhEscolaVoucher_ nunca achava e-mail nenhum, porque a
 *      coluna real do cadastro — "E-mail (principal)" — não estava na lista
 *      que ele procura. Defeito ANTERIOR a este trabalho, valendo para as
 *      679 escolas.
 *   3. voucherPreviaSegura estava sem trava. Prévia não grava nada, e por
 *      isso pareceu inofensiva — mas devolve o documento inteiro de um
 *      associado real, e era alcançável sem login (t6 acusou: 216 · teto 215).
 *
 * NÃO É COBERTURA COMPLETA. Aqui não se prova entrega de e-mail (o emulador
 * registra, não manda), nem PDF, nem o modal. Isso continua "não testado"
 * pela REGRA Nº -1 e depende de execução no sistema no ar.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");   // ADMINISTRADOR — tem tudo
const ESC = b.logar(g, "joscimar");    // escolas,sindicalizacao — NÃO tem benefícios

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
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

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · Porta de entrada do envio");

b.passo("1. Anônimo não passa em nenhuma das quatro");
b.bloqueia(() => g.voucherPreviaSegura(),
  "voucherPreviaSegura recusa sem sessão");
b.bloqueia(() => g.voucherPrepararEnvio(PROTOCOLO),
  "voucherPrepararEnvio recusa sem sessão");
b.bloqueia(() => g.voucherEnviarPorEmail(PROTOCOLO, {}),
  "voucherEnviarPorEmail recusa sem sessão");
b.bloqueia(() => g.voucherRegistrarAberturaWhatsApp(PROTOCOLO),
  "voucherRegistrarAberturaWhatsApp recusa sem sessão");

b.passo("2. Logado, mas sem o módulo Benefícios");
b.bloqueia(() => g.voucherPreviaSegura(ESC),
  "joscimar (escolas/sindicalização) é recusado na prévia");
b.bloqueia(() => g.voucherPrepararEnvio(PROTOCOLO, ESC),
  "joscimar é recusado no preparo do envio");
b.bloqueia(() => g.voucherEnviarPorEmail(PROTOCOLO, {}, ESC),
  "joscimar é recusado no envio por e-mail");

b.passo("3. Quem tem o módulo passa da porta");
/* A trava não pode ser rígida a ponto de barrar quem deveria entrar — uma
 * porta que recusa todo mundo passa nos testes de segurança e não serve. */
let previa = null, erroPrevia = null;
try { previa = g.voucherPreviaSegura(ADM); } catch (e) { erroPrevia = String(e.message || e); }
b.ok(!erroPrevia || !/sess|permiss|autoriza|administrador/i.test(erroPrevia),
  "administrador NÃO é barrado pela trava da prévia",
  erroPrevia ? "erro: " + erroPrevia.slice(0, 90) : "passou");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · Preparo do envio");

b.passo("4. Protocolo não emitido não tem o que enviar");
const semEmissao = g.voucherPrepararEnvio(NAO_EMITIDO, ADM);
b.ok(semEmissao && semEmissao.ok === false && /ainda não foi emitido/i.test(semEmissao.mensagem || ""),
  "protocolo sem emissão é recusado com o motivo certo",
  String(semEmissao && semEmissao.mensagem || "").slice(0, 80));

b.passo("5. Protocolo vazio");
const semProt = g.voucherPrepararEnvio("", ADM);
b.ok(semProt && semProt.ok === false, "protocolo em branco é recusado",
  String(semProt && semProt.mensagem || ""));

b.passo("6. Preparo completo do protocolo emitido");
const p = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.ok(p && p.ok === true, "preparo devolve ok", String(p && p.mensagem || ""));
b.igual(p.nome, "Beatriz do Nascimento Campos", "nome vem da emissão");
b.igual(p.codigo, "A1B2C3D4", "código de validação vem da emissão");
b.igual(p.curso, "Pedagogia", "curso vem da solicitação");
b.igual(p.periodo, "2026/2", "período vem da solicitação");
b.igual(p.instituicao, "IESES", "instituição de ensino vem da solicitação");
b.igual(p.emailAssociado, "beatriz@exemplo.com", "e-mail do associado");
b.ok(p.temPdf === true, "reconhece que há PDF emitido");

b.passo("7. Telefone vira link de WhatsApp — e o formato importa");
b.igual(p.telefone, "(27) 99876-5432", "telefone formatado para leitura");
b.ok(/^https:\/\/wa\.me\/5527998765432\?text=/.test(p.whatsappUrl),
  "link do wa.me com 55 + DDD + número", p.whatsappUrl.slice(0, 45));
b.ok(p.textoWhatsApp.indexOf("Beatriz") > -1 && p.textoWhatsApp.indexOf(PROTOCOLO) > -1,
  "texto do zap traz o primeiro nome e o protocolo");

b.passo("8. Telefone que não serve devolve link VAZIO, não link torto");
/* Vazio é resposta legítima: fixo de 8 dígitos não tem WhatsApp. Um wa.me
 * montado com número curto abre em "número inválido" no celular, e quem
 * emitiu conclui que o cadastro perdeu o contato. */
b.igual(g.voucherTelefoneParaZap_("33334444"), "", "fixo de 8 dígitos não vira link");
b.igual(g.voucherTelefoneParaZap_("não tem"), "", "campo com texto não vira link");
b.igual(g.voucherTelefoneParaZap_("27998765432"), "5527998765432", "celular com 11 dígitos ganha o 55");
b.igual(g.voucherTelefoneParaZap_("5527998765432"), "5527998765432", "número que já tem 55 não ganha outro");

semearSolicitacao({ TELEFONE: "3333-4444" });
const semZap = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.igual(semZap.whatsappUrl, "", "preparo com telefone fixo devolve whatsappUrl vazio");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · De onde vem o e-mail da instituição de ensino");

b.passo("9. Gravado na solicitação — origem SOLICITACAO");
semearSolicitacao({ EMAIL_INSTITUICAO: "secretaria@ieses.edu.br" });
const eSolic = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.igual(eSolic.emailInstituicao, "secretaria@ieses.edu.br", "usa o e-mail gravado");
b.igual(eSolic.origemEmailInstituicao, "SOLICITACAO", "e diz que foi alguém que digitou");

b.passo("10. Não gravado, mas achado no cadastro de Escolas — origem CADASTRO");
/* Este passo é o que teria pego o defeito nº 2: com "E-mail (principal)"
 * fora da lista de colunas procuradas, a busca devolvia "" para toda escola
 * e a origem ficava vazia — sem erro, sem log, sem sintoma na tela. */
const abaEsc = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
abaEsc.clear();
abaEsc.getRange(1, 1, 1, 4).setValues([["Escola (Razão Social)", "CNPJ", "E-mail (principal)", "UF"]]);
abaEsc.getRange(2, 1, 1, 4).setValues([["IESES", "02213188000181", "rh@ieses.edu.br", "ES"]]);

semearSolicitacao({});   // sem EMAIL_INSTITUICAO
const eCad = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.igual(eCad.emailInstituicao, "rh@ieses.edu.br", "acha o e-mail pelo CNPJ da instituição");
b.igual(eCad.origemEmailInstituicao, "CADASTRO", "e avisa que veio do cadastro, podendo estar velho");

b.passo("11. O gravado VENCE o cadastro");
semearSolicitacao({ EMAIL_INSTITUICAO: "secretaria@ieses.edu.br" });
const eVence = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.igual(eVence.emailInstituicao, "secretaria@ieses.edu.br", "quem digitou tem a palavra final");
b.igual(eVence.origemEmailInstituicao, "SOLICITACAO", "origem correta");

b.passo("12. Não achou em lugar nenhum — campo vazio, sem inventar");
semearSolicitacao({ INSTITUICAO_ENSINO: "Faculdade Que Não Está Na Base", CNPJ_INSTITUICAO: "99888777000166" });
const eVazio = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.igual(eVazio.emailInstituicao, "", "não inventa e-mail");
b.igual(eVazio.origemEmailInstituicao, "", "origem vazia, e a tela mostra a caixa em branco");
b.ok(!!eVazio.whatsappUrl, "o resto do preparo continua funcionando sem o e-mail da instituição");

b.passo("13. Campo com vários e-mails: usa o primeiro");
b.igual(g.voucherPrimeiroEmail_("a@x.com, b@y.com; c@z.com"), "a@x.com", "separador vírgula/ponto-e-vírgula");
b.igual(g.voucherPrimeiroEmail_("  RH@IESES.EDU.BR "), "rh@ieses.edu.br", "normaliza para minúsculo");
b.igual(g.voucherPrimeiroEmail_("não informado"), "", "texto que não é e-mail devolve vazio");
b.igual(g.voucherPrimeiroEmail_(null), "", "nulo devolve vazio");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · Envio por e-mail");

semearSolicitacao({ EMAIL_INSTITUICAO: "secretaria@ieses.edu.br" });

function ultimoEmail() { return amb.outbox[amb.outbox.length - 1] || null; }
function zerarCaixa() { amb.outbox.length = 0; }

b.passo("14. Envio padrão — associado no TO, instituição em cópia");
zerarCaixa();
const env = g.voucherEnviarPorEmail(PROTOCOLO, {}, ADM);
b.ok(env && env.ok === true, "envio devolve ok", String(env && env.mensagem || ""));
const m1 = ultimoEmail();
b.ok(!!m1, "um e-mail foi de fato entregue ao MailApp");
b.igual(m1 && m1.to, "beatriz@exemplo.com", "destinatário é o associado");
b.igual(m1 && m1.cc, "secretaria@ieses.edu.br", "instituição vai em CÓPIA, não no destinatário");
b.ok(String(m1 && m1.subject || "").indexOf(PROTOCOLO) > -1, "assunto traz o protocolo");
b.ok(String(m1 && m1.htmlBody || "").indexOf("A1B2C3D4") > -1, "corpo traz o código de validação");

b.passo("15. Desligar a cópia para a instituição");
/* enviarInstituicao:false existe porque o associado pode preferir levar o
 * documento pessoalmente. Mandar por fora disso é decidir pela vida dele. */
zerarCaixa();
const semCopia = g.voucherEnviarPorEmail(PROTOCOLO, { enviarInstituicao: false }, ADM);
b.ok(semCopia.ok === true, "envio sem cópia devolve ok");
b.igual(semCopia.copia, "", "a resposta confirma que não houve cópia");
b.ok(!ultimoEmail().cc, "nenhum CC saiu no e-mail");

b.passo("16. Corrigir o e-mail da instituição na hora do envio");
zerarCaixa();
const corrigido = g.voucherEnviarPorEmail(PROTOCOLO, { copia: "coordenacao@ieses.edu.br" }, ADM);
b.ok(corrigido.ok === true, "envio com cópia corrigida devolve ok");
b.igual(ultimoEmail().cc, "coordenacao@ieses.edu.br", "o que a pessoa digitou vale mais que o sugerido");

b.passo("17. E-mail de cópia inválido é recusado ANTES de sair");
zerarCaixa();
const copiaTorta = g.voucherEnviarPorEmail(PROTOCOLO, { copia: "ieses.edu.br" }, ADM);
b.ok(copiaTorta && copiaTorta.ok === false && /não parece válido/i.test(copiaTorta.mensagem || ""),
  "cópia sem @ é recusada", String(copiaTorta && copiaTorta.mensagem || "").slice(0, 70));
b.igual(amb.outbox.length, 0, "e NADA foi enviado — nem para o associado");

b.passo("18. Sem e-mail do associado e sem destinatário informado");
semearSolicitacao({ EMAIL: "" });
zerarCaixa();
const semDestino = g.voucherEnviarPorEmail(PROTOCOLO, {}, ADM);
b.ok(semDestino && semDestino.ok === false && /e-mail do associado/i.test(semDestino.mensagem || ""),
  "recusa em vez de mandar para lugar nenhum", String(semDestino && semDestino.mensagem || "").slice(0, 70));
b.igual(amb.outbox.length, 0, "nada saiu");

b.passo("19. Destinatário digitado supre o cadastro vazio");
zerarCaixa();
const digitado = g.voucherEnviarPorEmail(PROTOCOLO, { para: "beatriz.pessoal@exemplo.com" }, ADM);
b.ok(digitado.ok === true, "envio com destinatário digitado funciona");
b.igual(ultimoEmail().to, "beatriz.pessoal@exemplo.com", "vai para quem foi digitado");

b.passo("20. Protocolo não emitido não dispara e-mail");
zerarCaixa();
const naoEmitido = g.voucherEnviarPorEmail(NAO_EMITIDO, { para: "x@y.com" }, ADM);
b.ok(naoEmitido.ok === false, "recusa antes de montar a mensagem");
b.igual(amb.outbox.length, 0, "nenhum e-mail saiu de protocolo não emitido");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · Rastro do que foi enviado");

semearSolicitacao({ EMAIL_INSTITUICAO: "secretaria@ieses.edu.br" });

b.passo("21. WhatsApp registra ABERTURA, nunca entrega");
/* O SISGEP não manda zap — não há API nenhuma no projeto. Registrar
 * "ENVIADO" seria afirmar uma entrega que ninguém pode confirmar. */
const zap = g.voucherRegistrarAberturaWhatsApp(PROTOCOLO, ADM);
b.ok(zap && zap.ok === true, "registro da abertura devolve ok", String(zap && zap.mensagem || ""));

b.passo("22. O histórico de envios volta no preparo seguinte");
const comHistorico = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.ok(Array.isArray(comHistorico.envios), "campo de envios anteriores é lista");
const canais = (comHistorico.envios || []).map(e => String(e.canal || ""));
b.ok(canais.indexOf("ENVIAR_EMAIL") > -1,
  "os e-mails enviados aparecem no histórico", "canais: " + canais.join(", "));
b.ok(canais.indexOf("ABRIR_WHATSAPP") > -1,
  "a abertura do zap aparece como ABRIR_WHATSAPP, não como envio");

b.passo("23. O rastro diz para ONDE foi, não só que foi");
const comDestino = (comHistorico.envios || []).filter(e => /@/.test(String(e.destino || "")));
b.ok(comDestino.length > 0,
  "o destino do e-mail fica gravado na trilha",
  comDestino.length ? String(comDestino[0].destino).slice(0, 60) : "nenhum registro com endereço");

b.passo("23b. E diz QUEM mandou — em CADA canal, não em algum");
/* A trilha aceita registro sem usuário e grava "—". Um rastro que diz que o
 * certificado de alguém foi enviado, mas não por quem, não responde à única
 * pergunta que se faz meses depois.
 *
 * A primeira versão deste passo perguntava "algum registro tem autor?" e
 * SOBREVIVEU à mutação que tirava a sessão do envio por e-mail: o registro
 * do WhatsApp, que continuava com autor, respondia sozinho pelo conjunto.
 * Asserção sobre "pelo menos um" cobre o canal que já funciona e deixa passar
 * o que quebrou. Por isso agora é canal por canal. */
["ENVIAR_EMAIL", "ABRIR_WHATSAPP"].forEach(function (canal) {
  const doCanal = (comHistorico.envios || []).filter(e => String(e.canal || "") === canal);
  const semAutor = doCanal.filter(e => {
    const q = String(e.quem || "").trim();
    return !q || q === "—";
  });
  b.ok(doCanal.length > 0 && semAutor.length === 0,
    "todo registro de " + canal + " traz o usuário que agiu",
    doCanal.length === 0 ? "nenhum registro deste canal"
      : semAutor.length ? semAutor.length + " de " + doCanal.length + " sem autor"
      : "quem: " + doCanal[0].quem);
});

b.passo("24. Duas emissões do mesmo protocolo: vale a última");
gravar("Voucher_Emitidos", {
  ID_EMISSAO: "EMI-0002",
  DATA_EMISSAO: "12/08/2026 15:00",
  PROTOCOLO: PROTOCOLO,
  NOME_SOLICITANTE: "Beatriz do Nascimento Campos",
  CODIGO_VALIDACAO: "Z9Y8X7W6",
  LINK_ARQUIVO: "https://drive.google.com/file/d/2ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLl/view",
  PERCENTUAL: "70",
  USUARIO: "wanderson"
});
const reemitido = g.voucherPrepararEnvio(PROTOCOLO, ADM);
b.igual(reemitido.codigo, "Z9Y8X7W6", "pega o código da reemissão, não o da primeira via");

b.resumo();
