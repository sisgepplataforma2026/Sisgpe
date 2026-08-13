/**
 * TESTE — O MODAL DE ENVIO DO CERTIFICADO, na tela
 *
 * DOM real (jsdom), backend real (gas.js), cliques reais. Clicar aqui executa
 * o mesmo caminho do navegador da secretaria até a planilha e de volta.
 *
 * O QUE ESTE ARQUIVO EXISTE PARA PROVAR, em ordem de importância:
 *
 *   1. Que o modal manda para QUEM está escrito no campo — e não para o
 *      sugerido, quando a pessoa corrigiu. Errar aqui é mandar o certificado
 *      de um associado para o endereço de outro.
 *   2. Que desmarcar a cópia realmente impede a cópia. O associado pode não
 *      querer que a faculdade dele saiba, e mandar assim mesmo é decidir
 *      pela vida dele.
 *   3. Que o aviso de reenvio aparece ANTES de clicar. Reenvio é rotina neste
 *      módulo — o associado perde o e-mail, a escola pede de novo.
 *   4. Que abrir o modal de outro protocolo não mostra dado do anterior,
 *      inclusive quando a resposta do primeiro chega atrasada.
 *
 * O QUE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: aparência,
 * CSS, entrega real do e-mail e o wa.me abrindo no celular.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("VOUCHER · Modal de envio");
  b.naoTestavel("tela do modal de envio", "jsdom não instalado — rode: npm install jsdom");
  b.resumo();
  process.exit(0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

g.setupVoucherModuleFase1();

const PROTO_A = "BOLSA-2026-000111";
const PROTO_B = "BOLSA-2026-000222";

function gravar(aba, campos) {
  const sh = ss.getSheetByName(aba);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length)
    .setValues([cab.map(c => (campos[c] !== undefined ? campos[c] : ""))]);
}

function semear(protocolo, nome, email, telefone, extras) {
  const campos = {
    ID_SOLICITACAO: "SOL-" + protocolo, CPF_SOLICITANTE: "11144477735",
    NOME_SOLICITANTE: nome, EMAIL: email, TELEFONE: telefone,
    ESCOLA_SELECIONADA: "MULTIVIX", INSTITUICAO_ENSINO: "IESES",
    CNPJ_INSTITUICAO: "02213188000181", CURSO: "Pedagogia",
    PERIODO_REFERENCIA: "2026/2", PERCENTUAL_APLICADO: "70",
    SITUACAO_SINDICAL: "ASSOCIADO", STATUS_VALIDACAO_SINDICAL: "VALIDADO",
    STATUS_SOLICITACAO: "EMITIDO", NUMERO_PROTOCOLO: protocolo
  };
  Object.keys(extras || {}).forEach(k => { campos[k] = extras[k]; });
  gravar("Voucher_Solicitacoes", campos);
  gravar("Voucher_Emitidos", {
    ID_EMISSAO: "EMI-" + protocolo, DATA_EMISSAO: "12/08/2026 10:30",
    PROTOCOLO: protocolo, NOME_SOLICITANTE: nome, CPF: "11144477735",
    ESCOLA: "MULTIVIX", TIPO_DOCUMENTO: "CERTIFICADO",
    CODIGO_VALIDACAO: "COD" + protocolo.slice(-3),
    LINK_ARQUIVO: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view",
    PERCENTUAL: "70", USUARIO: "wanderson"
  });
}

semear(PROTO_A, "Beatriz do Nascimento Campos", "beatriz@exemplo.com", "(27) 99876-5432",
       { EMAIL_INSTITUICAO: "secretaria@ieses.edu.br" });
semear(PROTO_B, "Carlos Alberto Souza", "carlos@exemplo.com", "3333-4444", {});

const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const win = t.win, doc = t.doc;
function el(id) { return doc.getElementById(id); }

(async function () {

  /* A tela só liga os botões dentro do init, que no navegador roda no
   * DOMContentLoaded. Sem chamá-lo aqui, os cliques do teste não fazem nada
   * — e o teste acusaria a tela de não enviar quando o defeito seria dele. */
  win.initCertificadoAdmin();
  await t.assentar(60);

  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("VOUCHER · O modal abre e traz o que o backend mandou");

  b.passo("1. Os elementos do modal existem");
  ["certEnvioOverlay", "certEnvPara", "certEnvCopia", "certEnvCopiaAtiva",
   "certEnvAnexo", "certEnvBtnEmail", "certEnvBtnZap", "certEnvHistorico",
   "certEnvAlerta"].forEach(function (id) {
    b.ok(!!el(id), "existe #" + id);
  });

  b.passo("2. Abrir preenche com o dado do protocolo");
  win.certAbrirEnvio(PROTO_A);
  await t.assentar(60);
  b.igual(el("certEnvPara").value, "beatriz@exemplo.com", "e-mail do associado preenchido");
  b.igual(el("certEnvCopia").value, "secretaria@ieses.edu.br", "e-mail da instituição preenchido");
  b.ok(t.texto("#certEnvNome") === "Beatriz do Nascimento Campos", "nome na tela",
    t.texto("#certEnvNome"));
  b.ok(String(t.texto("#certEnvCurso")).indexOf("Pedagogia") > -1, "curso e período na tela");

  b.passo("3. A origem do e-mail sugerido aparece");
  /* Campo preenchido sem dizer de onde veio passa impressão de conferido. */
  const dica = t.texto("#certEnvOrigemDica") || "";
  b.ok(/digitado/i.test(dica), "diz que o e-mail foi digitado na solicitação", dica.slice(0, 60));

  b.passo("4. Telefone válido habilita o WhatsApp");
  b.ok(!el("certEnvBtnZap").disabled, "botão do zap habilitado com celular");
  b.ok(String(t.texto("#certEnvTelefone")).indexOf("99876") > -1, "telefone formatado na tela");

  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("VOUCHER · O que a tela realmente manda");

  b.passo("5. Enviar usa o que está NO CAMPO, não o sugerido");
  /* A asserção mais importante do arquivo. Se a tela mandar o sugerido em vez
   * do digitado, o certificado de um associado vai para o endereço de outro
   * e ninguém descobre — o envio "deu certo". */
  t.digitar("#certEnvPara", "beatriz.pessoal@exemplo.com");
  t.digitar("#certEnvCopia", "coordenacao@ieses.edu.br");
  t.clicar("#certEnvBtnEmail");
  await t.assentar(80);

  const envio = t.chamadas.filter(c => c.fn === "voucherEnviarPorEmail").pop();
  b.ok(!!envio, "a tela chamou voucherEnviarPorEmail");
  b.igual(envio && envio.args[0], PROTO_A, "com o protocolo certo");
  b.igual(envio && envio.args[1].para, "beatriz.pessoal@exemplo.com",
    "com o destinatário DIGITADO, não o sugerido");
  b.igual(envio && envio.args[1].copia, "coordenacao@ieses.edu.br",
    "e com a cópia corrigida");
  b.ok(envio && envio.args[2] === TOKEN, "e com o token de sessão");

  b.passo("6. Desmarcar a cópia impede a cópia de verdade");
  /* `marcar` e não `clicar`: evento de clique programático não é confiável e
   * o jsdom não alterna o checkbox nem dispara `change` para ele. Com
   * clicar(), a caixa ficava marcada, a tela nunca via a mudança, e o teste
   * acusava o campo de "não desabilitar" — defeito do andaime, não da tela. */
  t.marcar("#certEnvCopiaAtiva", false);
  await t.assentar(20);
  b.ok(el("certEnvCopia").disabled, "o campo da cópia fica desabilitado");
  b.ok(!!el("certEnvCopia").value, "mas o endereço continua à vista, não some");

  t.clicar("#certEnvBtnEmail");
  await t.assentar(80);
  const semCopia = t.chamadas.filter(c => c.fn === "voucherEnviarPorEmail").pop();
  b.ok(semCopia && semCopia.args[1].enviarInstituicao === false,
    "a tela avisa o backend para NÃO mandar cópia");
  b.igual(semCopia && semCopia.args[1].copia, "", "e não manda endereço nenhum de cópia");

  b.passo("7. Sem destinatário, não chama o backend");
  const antes = t.chamadas.filter(c => c.fn === "voucherEnviarPorEmail").length;
  t.digitar("#certEnvPara", "   ");
  t.clicar("#certEnvBtnEmail");
  await t.assentar(60);
  b.igual(t.chamadas.filter(c => c.fn === "voucherEnviarPorEmail").length, antes,
    "nenhuma chamada nova — a tela barrou antes de sair");

  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("VOUCHER · Reenvio — o aviso vem antes do clique");

  b.passo("8. Enviar recarrega o histórico SOZINHO, sem reabrir o modal");
  /* Esta asserção nasceu de uma mutação que sobreviveu: tirar o
   * `envAbrir(protocolo)` do sucesso do envio não derrubava nada, porque o
   * passo seguinte reabria o modal na mão. Quem opera não reabre — manda,
   * e o histórico tem que passar a mostrar o envio que acabou de fazer.
   * Sem isso, reenviar duas vezes seguidas não acusa a segunda. */
  win.certAbrirEnvio(PROTO_A);
  await t.assentar(80);
  const antesDoEnvio = (t.texto("#certEnvHistorico") || "").length;

  t.marcar("#certEnvCopiaAtiva", true);
  t.digitar("#certEnvPara", "beatriz@exemplo.com");
  t.clicar("#certEnvBtnEmail");
  await t.assentar(150);      // envio + recarga do preparo, sem reabrir nada

  const hist = t.texto("#certEnvHistorico") || "";
  b.ok(hist.length > antesDoEnvio,
    "o histórico cresceu sozinho depois do envio",
    "antes " + antesDoEnvio + " · depois " + hist.length);
  b.ok(/e-mail/i.test(hist), "e mostra os envios feitos", hist.slice(0, 70));

  b.passo("9. E o AVISO de reenvio aparece, não enterrado sob a lista");
  const alerta = el("certEnvAlerta");
  b.ok(alerta.style.display !== "none", "o aviso está visível");
  b.ok(/já foi enviado/i.test(alerta.textContent || ""),
    "e diz quantas vezes já foi enviado", (alerta.textContent || "").trim().slice(0, 60));

  b.passo("10. Protocolo nunca enviado NÃO mostra aviso");
  /* Aviso que aparece sempre não é aviso, é ruído — e ninguém mais lê. */
  win.certAbrirEnvio(PROTO_B);
  await t.assentar(80);
  b.ok(el("certEnvAlerta").style.display === "none", "sem aviso no protocolo virgem");
  b.ok(/nunca enviado/i.test(t.texto("#certEnvHistorico") || ""),
    "e o histórico diz 'nunca enviado'", t.texto("#certEnvHistorico"));

  b.passo("11. Telefone que não serve desabilita o WhatsApp");
  /* Carlos tem fixo de 8 dígitos. Um wa.me montado com número curto abre em
   * "número inválido" no celular, e quem enviou conclui que o cadastro
   * perdeu o contato — quando o contato nunca serviu. */
  b.ok(el("certEnvBtnZap").disabled, "botão do zap desabilitado com telefone fixo");

  b.passo("11b. Ao abrir, os campos são limpos ANTES de a resposta chegar");
  /* O instante que ninguém testa e todo mundo vê.
   *
   * Entre clicar em Enviar e o servidor responder passa quase meio segundo
   * com a planilha carregada. Se os campos não forem limpos nesse intervalo,
   * o modal mostra o e-mail do associado ANTERIOR — e quem for rápido no
   * clique manda o certificado de um para o endereço do outro.
   *
   * A mutação que removia a limpeza sobrevivia porque eu só olhava depois
   * da resposta, quando o conteúdo certo já tinha chegado por cima. */
  win.certAbrirEnvio(PROTO_A);
  await t.assentar(60);
  b.igual(el("certEnvPara").value, "beatriz@exemplo.com", "modal carregado com A");

  const idxLimpeza = t.chamadas.length;
  t.atrasar("voucherPrepararEnvio", idxLimpeza, 150);
  win.certAbrirEnvio(PROTO_B);
  await t.assentar(20);          // resposta de B ainda não chegou
  b.igual(el("certEnvPara").value, "",
    "o campo do e-mail já está vazio, não com o e-mail de A");
  b.ok(!/beatriz/i.test(t.texto("#certEnvNome") || ""),
    "e o nome de A não está mais na tela", t.texto("#certEnvNome"));
  await t.assentar(220);         // deixa B chegar, para não sujar o passo seguinte

  b.passo("12. Trocar de protocolo troca TODO o conteúdo");
  b.igual(el("certEnvPara").value, "carlos@exemplo.com", "e-mail é o do novo protocolo");
  b.ok(String(t.texto("#certEnvNome")).indexOf("Carlos") > -1, "nome é o do novo protocolo");
  b.ok(String(t.texto("#certEnvSub")).indexOf(PROTO_B) > -1, "e o protocolo no cabeçalho");

  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("VOUCHER · Corrida ao trocar de protocolo depressa");

  b.passo("13. Resposta atrasada do protocolo anterior é descartada");
  /* Abrir A e, antes da resposta chegar, abrir B. Se a tela aceitar a
   * resposta atrasada de A, o modal mostra o cabeçalho de B com os dados de
   * A — e quem enviar manda o certificado de Carlos para a Beatriz. */
  const idx = t.chamadas.length;
  t.atrasar("voucherPrepararEnvio", idx, 120);   // A vai demorar
  win.certAbrirEnvio(PROTO_A);
  await t.assentar(10);
  win.certAbrirEnvio(PROTO_B);                   // B chega primeiro
  await t.assentar(220);                         // tempo para A chegar atrasado

  b.igual(el("certEnvPara").value, "carlos@exemplo.com",
    "o modal continua mostrando B, mesmo com a resposta de A chegando depois");
  b.ok(String(t.texto("#certEnvSub")).indexOf(PROTO_B) > -1,
    "e o protocolo no cabeçalho continua o de B");

  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("VOUCHER · WhatsApp — abre, não envia");

  b.passo("14. Abrir o zap registra ABERTURA, não entrega");
  win.certAbrirEnvio(PROTO_A);
  await t.assentar(80);
  let urlAberta = null;
  win.open = function (u) { urlAberta = u; return null; };
  t.clicar("#certEnvBtnZap");
  await t.assentar(80);

  b.ok(String(urlAberta || "").indexOf("https://wa.me/") === 0,
    "abriu o link do wa.me numa aba", String(urlAberta || "").slice(0, 40));
  const zap = t.chamadas.filter(c => c.fn === "voucherRegistrarAberturaWhatsApp").pop();
  b.ok(!!zap, "e registrou a abertura no backend");
  b.igual(zap && zap.args[0], PROTO_A, "com o protocolo certo");

  b.passo("15. O registro aparece como ABERTO, nunca como enviado");
  await t.assentar(120);
  const hist2 = t.texto("#certEnvHistorico") || "";
  b.ok(/whatsapp aberto/i.test(hist2),
    "o histórico diz 'WhatsApp aberto'", hist2.slice(0, 80));
  /* A trilha grava o canal no campo do destino quando não há destino — e o
   * WhatsApp não tem endereço. Sem filtro, a linha saía "WhatsApp aberto
   * WHATSAPP_ABERTO", com o nome interno da ação vazando para a tela de
   * quem opera. A mutação que remove o filtro sobrevivia porque eu só
   * checava se "WhatsApp aberto" aparecia — e aparecia, com lixo colado. */
  b.ok(!/WHATSAPP_ABERTO/.test(hist2),
    "e NÃO mostra o nome interno da ação",
    /WHATSAPP_ABERTO/.test(hist2) ? "vazou: " + hist2.slice(0, 70) : "");
  b.ok(!/ENVIAR_EMAIL/.test(hist2),
    "nem o nome interno do envio por e-mail");

  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("VOUCHER · Fechar");

  b.passo("16. O botão fechar fecha");
  t.clicar("#certEnvFechar");
  await t.assentar(20);
  b.ok(!el("certEnvioOverlay").classList.contains("ativo"), "modal fechado");

  b.passo("17. Clicar DENTRO da caixa não fecha");
  /* Sem o teste de alvo no listener do overlay, clicar num campo do
   * formulário fecharia o modal e perderia o que a pessoa digitou. */
  win.certAbrirEnvio(PROTO_A);
  await t.assentar(60);
  t.clicar("#certEnvPara");
  await t.assentar(20);
  b.ok(el("certEnvioOverlay").classList.contains("ativo"),
    "modal continua aberto ao clicar num campo");

  b.resumo();
  process.exit(0);
})();
