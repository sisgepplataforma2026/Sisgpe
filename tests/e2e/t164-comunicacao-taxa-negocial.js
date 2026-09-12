/**
 * TESTE — A COMUNICAÇÃO DA TAXA NEGOCIAL ÀS ESCOLAS
 *
 * O PEDIDO, por voz, em 11/09/2026:
 *
 *   "preciso enviar um e-mail pras escolas com ofício... pra todas as escolas
 *    da base. Tem que ver a questão da cota de e-mails por dia: se chegar
 *    próximo da cota ele trava, joga para o dia seguinte, porque até o final do
 *    mês todas as escolas devem ter sido comunicadas. Que seja escalonado, não
 *    tudo de uma vez."
 *
 * ESTE TESTE EXISTE PARA PROVAR AS TRÊS DIFERENÇAS para o motor que já havia
 * (`TaxaAssistencial.gs`), porque cada uma nasceu de um defeito real:
 *
 *   1. REPREPARAR NÃO APAGA. Lá, `prepararFilaTaxaAssistencial` chama
 *      `clearContents()`: numa campanha de vinte dias, clicar "Preparar" duas
 *      vezes apaga quem já recebeu e todo mundo recebe de novo.
 *   2. A FILA É POR ENDEREÇO. Lá era por escola, e o limite virando no meio de
 *      uma escola de vários contatos deixava a linha PENDENTE depois de um
 *      deles já ter recebido — reproduzido no t161, 4 envios para 3 endereços.
 *   3. A COTA MANDA. Lá o teto é `100` escrito no código, com ZERO consultas à
 *      cota. Aqui o `CotaEmail.gs` responde antes de cada envio.
 *
 * E prova o que faltava: o AVISO. O `enviarAlerteLimiteDiario` do outro arquivo
 * é chamado duas vezes e não existe em lugar nenhum do projeto.
 *
 * O QUE NÃO COBRE: PDF de verdade (DocumentApp não é emulado), agendamento de
 * gatilho e entrega de e-mail. Substituídos por dublê — o objeto aqui é a
 * contabilidade da fila, o orçamento e as travas.
 */
const b = require("./base");
const { g, amb } = b.subir({ gmailAliases: ["secretaria@sindeducacao.com"] });
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const props = g.PropertiesService.getScriptProperties();

/* ── dublês: o que o emulador não alcança e não é o objeto do teste ────── */
let pdfsGerados = [];
g.obterPastaPorTipo_ = function () { return { getId: () => "PASTA-TN" }; };
g.gerarPDFUniversal_ = function (cfg) {
  pdfsGerados.push(cfg.nomeArquivo);
  return { pdf: { getBlob: () => ({ nome: cfg.nomeArquivo }), getId: () => "PDF-" + pdfsGerados.length } };
};
let agendou = 0, removeu = 0;
g.tnCom_agendarProximo_ = function () { agendou++; };
g.tnCom_removerTriggers_ = function () { removeu++; };
g.gerarProximoNumeroSeguro_ = function () { return "521/2026"; };

const ABA = "COMUNICACAO_TAXA_NEGOCIAL";
const comAlias = () => { g.GmailApp.getAliases = () => ["secretaria@sindeducacao.com",
                                                        "financeiro@sindeducacao.com"]; };
const semAlias = () => { g.GmailApp.getAliases = () => ["secretaria@sindeducacao.com"]; };

/** A base de escolas: uma com 3 contatos, uma com 1, uma sem nenhum. */
function montarEscolas(comContatoNovo) {
  const sh = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
  sh.clearContents();
  sh.getRange(1, 1, 1, 3).setValues([["Escola (Razão Social)", "CNPJ", "E-mails (todos)"]]);
  sh.getRange(2, 1, 3, 3).setValues([
    ["COLEGIO ALFA", "11.111.111/0001-11",
     comContatoNovo ? "a1@alfa.com, a2@alfa.com, a3@alfa.com, novo@alfa.com"
                    : "a1@alfa.com, a2@alfa.com, a3@alfa.com"],
    ["COLEGIO BETA", "22.222.222/0001-22", "b1@beta.com"],
    ["ESCOLA SEM CONTATO", "33.333.333/0001-33", ""]
  ]);
}

const filaLinhas = () => {
  const sh = ss.getSheetByName(ABA);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
};
const porStatus = (st) => filaLinhas().filter(r => String(r[5]) === st);
const emailsEnviados = () => amb.outbox.map(m => String(m.to || "")).filter(Boolean);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Preparar: uma linha por ENDEREÇO, não por escola");

montarEscolas(false);
passo("primeira preparação");
const p1 = g.tnCom_preparar_({ competencia: "setembro/2026", dataAlvo: "2026-09-30" },
                             "wanderson@sindeducacao.com");

ok(p1.ok === true, "a fila foi preparada", p1.mensagem);
igual(porStatus("PENDENTE").length, 4,
   "4 endereços pendentes — 3 da ALFA + 1 da BETA, e NÃO 2 escolas");
igual(porStatus("SEM_EMAIL").length, 1,
   "a escola sem contato vira SEM_EMAIL, que não é falha de envio");
igual(p1.contagem.escolas, 3, "as três escolas foram lidas");

passo("o teto nasce calculado, com a conta à mostra");
ok(p1.tetoSugerido.teto > 0, "sugeriu um teto", JSON.stringify(p1.tetoSugerido));
ok(String(p1.tetoSugerido.conta).indexOf("÷") > -1,
   "e mostra a divisão que o produziu, em vez de um número sem origem",
   p1.tetoSugerido.conta);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Repreparar NÃO apaga — a diferença que motivou o arquivo novo");

passo("marca uma linha como já enviada e prepara de novo");
const sh = ss.getSheetByName(ABA);
sh.getRange(2, 6).setValue("ENVIADO");
montarEscolas(true);            /* o cadastro ganhou um contato novo */
const p2 = g.tnCom_preparar_({}, "wanderson@sindeducacao.com");

igual(porStatus("ENVIADO").length, 1,
   "quem já recebeu CONTINUA como enviado — no motor antigo isso seria apagado");
igual(porStatus("PENDENTE").length, 4,
   "3 pendentes de antes + 1 contato novo, sem duplicar os que já estavam");
igual(p2.contagem.acrescentados, 1,
   "só o contato novo foi acrescentado");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Liberar barra quando o remetente não é o esperado");

passo("sem o alias do financeiro");
semAlias();
const barrado = g.tnCom_liberar_();
ok(barrado.ok === false, "recusa liberar", barrado.mensagem.slice(0, 70));
ok(String(barrado.mensagem).indexOf("alias") > -1,
   "e diz o que fazer para destravar, em vez de só negar");
igual(props.getProperty("TN_COM_LIBERADA"), null,
   "e a campanha NÃO fica marcada como liberada");

passo("com o alias ativo");
comAlias();
const liberado = g.tnCom_liberar_();
ok(liberado.ok === true, "libera", liberado.mensagem);
igual(liberado.remetente.real, "financeiro@sindeducacao.com",
   "e o remetente medido é o que as escolas vão ver");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O lote pergunta à cota antes de enviar");

passo("teto de 2 por dia, com 4 na fila");
amb.outbox.length = 0; pdfsGerados = []; agendou = 0;
g.tnCom_ajustarTeto_(2);
const l1 = g.tnCom_enviarLote_();

igual(l1.enviados, 2, "manda só o que o teto do dia permite", l1.mensagem);
igual(emailsEnviados().length, 2, "dois e-mails saíram de verdade");
ok(l1.restam >= 2, "e o resto continua na fila", "restam " + l1.restam);
ok(agendou >= 1, "reagendou sozinho — a campanha não para por falta de gatilho");

passo("o PDF é por ESCOLA, não por endereço");
ok(pdfsGerados.length <= 2, "não gerou um PDF por e-mail da mesma escola",
   pdfsGerados.length + " PDF(s) para " + emailsEnviados().length + " envios");

passo("chamar de novo no mesmo dia não fura o teto");
const l2 = g.tnCom_enviarLote_();
igual(l2.enviados, 0, "o teto do dia já foi alcançado", l2.mensagem);
igual(l2.motivo, "TETO", "e o motivo é o TETO, não a cota do Google");
ok(String(l2.mensagem).indexOf("amanhã") > -1,
   "a mensagem diz o que acontece a seguir, em vez de só 'limite atingido'",
   l2.mensagem);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A cota do Google no fim");

passo("cota abaixo da reserva do resto do SISGEP");
g.tnCom_ajustarTeto_(500);
g.__cotaEmailRestante = 10;          /* reserva padrão é 40 */
amb.outbox.length = 0;
const l3 = g.tnCom_enviarLote_();

igual(l3.enviados, 0, "não manda nada");
igual(l3.motivo, "RESERVA", "e diz que foi a reserva, não o teto da campanha");
/* A caixa NÃO fica vazia aqui, e é de propósito: sai o AVISO. Afirmar
   "nenhum e-mail" seria afrouxar o teste até ele deixar de provar o que
   importa — que nenhuma ESCOLA recebeu e que o usuário FOI avisado. */
const paraEscola = emailsEnviados().filter(e => /alfa\.com|beta\.com/.test(e));
const paraFinanceiro = emailsEnviados().filter(e => e.indexOf("financeiro@") > -1);
igual(paraEscola.length, 0, "nenhuma escola recebeu ofício");
igual(paraFinanceiro.length, 1,
   "e saiu UM aviso para o financeiro — é o que o motor antigo nunca fez",
   String((amb.outbox[0] || {}).subject || ""));
ok(String((amb.outbox[0] || {}).body || "").indexOf("amanhã") > -1,
   "o aviso diz que a campanha volta sozinha, para ninguém tentar refazer",
   String((amb.outbox[0] || {}).body || "").slice(0, 90));
igual(porStatus("ERRO").length, 0,
   "e NENHUMA linha foi marcada com erro — cota não é veredito sobre o envio");

g.__cotaEmailRestante = 1500;

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Pausar e o aviso que o motor antigo nunca teve");

passo("a função de aviso existe de verdade");
igual(typeof g.tnCom_avisar_, "function",
   "diferente do enviarAlerteLimiteDiario, que é chamado 2x no TaxaAssistencial e não existe");
igual(typeof g.enviarAlerteLimiteDiario, "undefined",
   "prova de que o do outro arquivo continua sem existir");

passo("pausar trava o lote");
g.tnCom_pausar_();
const pausado = g.tnCom_enviarLote_();
igual(pausado.motivo, "PAUSADA", "o lote se recusa a rodar pausado");
igual(pausado.enviados, 0, "e não manda nada");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O painel");

const st = g.tnCom_status_();
igual(st.numero, "521/2026", "o número do ofício, um para todas");
ok(st.total > 0, "conta o total", "total=" + st.total);
ok(st.comunicadas >= 2, "e quantas já foram", "comunicadas=" + st.comunicadas);
igual(st.aCorrigir, 1, "a escola sem e-mail aparece em 'a corrigir', separada das falhas");
ok(st.remetente.ok === true, "e mostra o remetente medido");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Testar com uma escola ESCOLHIDA");

/* Pedido do usuario: "eu quero escolher uma escola para testar". Antes o unico
   jeito de ver um oficio antes de soltar a base era por o teto em 1 e liberar
   — e quem recebia era a primeira linha da fila, que segue a ordem da aba
   Escolas. Escolher importa: ele quer mandar para uma escola que conhece. */

/* Refaz a fila limpa para este fluxo. O cabecalho volta na mao de proposito:
   o tnCom_aba_ so escreve cabecalho quando CRIA a aba, entao limpar sem
   reescrever deixaria o mapa de colunas vazio — e foi exatamente o que
   aconteceu na primeira rodada deste teste. */
(function limparFila() {
  const sh = ss.getSheetByName(ABA);
  sh.clearContents();
  sh.getRange(1, 1, 1, g.TN_COM_CAB.length).setValues([g.TN_COM_CAB]);
})();
montarEscolas(false);
comAlias();
g.tnCom_preparar_({ competencia: "setembro/2026", dataAlvo: "2026-09-30" }, "wanderson@sindeducacao.com");
g.__cotaEmailRestante = 1500;

passo("texto curto demais");
igual(g.tnCom_testar_("al", "wanderson@x").ok, false,
   "recusa menos de 3 letras — evita casar com meia base por engano");

passo("nome que não existe");
const semEscola = g.tnCom_testar_("colegio inexistente", "wanderson@x");
igual(semEscola.ok, false, "recusa escola que não está pendente");
ok(String(semEscola.mensagem).indexOf("Nenhuma escola") > -1,
   "dizendo isso em palavras", semEscola.mensagem);

passo("texto que casa com mais de uma");
const varias = g.tnCom_testar_("colegio", "wanderson@x");
igual(varias.ok, false, "não escolhe pela pessoa");
ok(Array.isArray(varias.varias) && varias.varias.length === 2,
   "devolve as opções — quem decide qual escola recebe documento oficial é ela",
   (varias.varias || []).join(" · "));

/* A BUSCA QUE MOSTRA O QUE ACHOU — 11/09/2026.

   "Tinha que abrir uma busca por nome da escola." A versao anterior pedia um
   pedaco do nome e ja perguntava se podia mandar o oficio de verdade — uma
   confirmacao sobre um nome que a pessoa ainda nao tinha visto. E empurrou
   para pior: sem ver a lista, ele criou uma escola FALSA na base de 679 reais
   so para conseguir testar. */
passo("a busca lista quem casou, sem enviar nada");
amb.outbox.length = 0;
const busca = g.tnCom_buscarEscolas_("colegio");
igual(busca.ok, true, "a busca responde");
igual(busca.itens.length, 2, "achou as duas escolas que casam");
igual(busca.itens[0].escola, "COLEGIO ALFA", "em ordem alfabética");
igual(busca.itens[0].emails.length, 3, "com quantos endereços cada uma tem");
ok(!!busca.itens[0].cnpj, "e o CNPJ, para distinguir escolas de nome parecido");
igual(amb.outbox.length, 0, "e NADA foi enviado — busca só lê");

passo("busca curta demais não varre a base inteira");
igual(g.tnCom_buscarEscolas_("c").itens.length, 0, "menos de 2 letras devolve vazio");

passo("nome exato vence a ambiguidade — é o clique na lista");
const exato = g.tnCom_buscarEscolas_("COLEGIO ALFA");
igual(exato.itens.length, 1, "o nome inteiro acha uma só");

passo("a escola escolhida, com seus TRÊS endereços");
amb.outbox.length = 0; pdfsGerados = [];
const teste = g.tnCom_testar_("ALFA", "wanderson@sindeducacao.com");

ok(teste.ok === true, "envia", String(teste.mensagem).slice(0, 80));
igual(teste.escola, "COLEGIO ALFA", "para a escola certa");
igual(teste.enviados.length, 3,
   "para os TRÊS endereços dela — meia escola é o estado que este arquivo existe para não criar");
igual(pdfsGerados.length, 1, "com um PDF só, nominal, reaproveitado nos três");
ok(String(teste.linkPdf).indexOf("drive.google.com") > -1,
   "e devolve o link do PDF para conferir sem abrir o e-mail");

passo("ela não recebe de novo no envio geral");
ok(String(teste.mensagem).indexOf("não receberá de novo") > -1,
   "a mensagem avisa que conta como comunicada");
const aindaPendenteAlfa = filaLinhas().filter(
  r => String(r[2]) === "COLEGIO ALFA" && String(r[5]) === "PENDENTE");
igual(aindaPendenteAlfa.length, 0,
   "e nenhuma linha da ALFA continua pendente");

/* A BUSCA MOSTRA QUEM JA RECEBEU — 12/09/2026.

   Ele cadastrou uma escola "Teste", correta e completa, buscou por ela e a
   tela respondeu "nenhuma escola pendente com TESTE no nome". A escola
   existia, estava na fila e estava certa: so ja tinha sido comunicada. A
   busca escondia ENVIADO, entao tres situacoes diferentes — nao existe / ja
   recebeu / sem e-mail — sairam pela mesma frase, e ele passou uma hora
   procurando defeito no cadastro, que nao tinha defeito nenhum.

   A partir daqui, quem ja recebeu APARECE, com o motivo escrito e sem poder
   ser clicada. */
passo("a escola já comunicada continua aparecendo na busca");
amb.outbox.length = 0;
const jaFoi = g.tnCom_buscarEscolas_("ALFA");
igual(jaFoi.itens.length, 1, "ela não some da busca só porque já recebeu");
igual(jaFoi.itens[0].status, "ENVIADO", "e a busca diz em que situação ela está");
igual(jaFoi.itens[0].podeEnviar, false, "marcada como não-clicável — não recebe duas vezes");
ok(String(jaFoi.itens[0].motivo).indexOf("já comunicada") > -1,
   "com o motivo em palavras, não em silêncio", jaFoi.itens[0].motivo);
ok(String(jaFoi.itens[0].motivo).indexOf("/") > -1,
   "e a data em que recebeu, que é o que a pessoa quer saber", jaFoi.itens[0].motivo);
igual(amb.outbox.length, 0, "e continua sem enviar nada — busca só lê");

passo("quem ainda pode receber segue clicável");
const beta = g.tnCom_buscarEscolas_("BETA");
igual(beta.itens.length, 1, "achou");
igual(beta.itens[0].podeEnviar, true, "e essa pode ser clicada");
ok(beta.itens[0].emails.length > 0, "com os endereços que receberiam agora");

passo("a contagem separa quem pode de quem não pode");
const todosCol = g.tnCom_buscarEscolas_("colegio");
igual(todosCol.total, 2, "as duas continuam na lista");
igual(todosCol.podem, 1, "mas só uma pode receber agora");
ok(String(todosCol.mensagem).indexOf("pode(m) receber agora") > -1,
   "e a tela recebe isso escrito", todosCol.mensagem);

passo("nome que não está na fila manda para o botão que resolve");
const fora = g.tnCom_buscarEscolas_("escola que nunca existiu");
igual(fora.itens.length, 0, "não inventa resultado");
ok(String(fora.mensagem).indexOf("Preparar fila") > -1,
   "e diz o que fazer: a fila é uma fotografia, quem foi cadastrado depois não está nela",
   fora.mensagem);
ok(String(fora.mensagem).indexOf("não apaga nem duplica") > -1,
   "avisando que o botão é seguro — senão ninguém clica");

passo("tentar enviar para quem já recebeu explica o motivo");
const denovo = g.tnCom_testar_("COLEGIO ALFA", "wanderson@sindeducacao.com");
igual(denovo.ok, false, "recusa o segundo envio");
ok(String(denovo.mensagem).indexOf("já comunicada") > -1,
   "dizendo que ela já foi comunicada, não um 'não achei' seco", denovo.mensagem);
igual(amb.outbox.length, 0, "e nada saiu");

passo("sem o alias, nem testa");
semAlias();
igual(g.tnCom_testar_("BETA", "wanderson@x").ok, false,
   "a trava do remetente vale para o teste também — é onde ela mais importa");
comAlias();

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A tela precisa saber o que está GUARDADO, não o que está selecionado");

/* DE ONDE VEIO, 11/09/2026, na producao. O usuario trocou a CCT .docx por um
   PDF, viu o nome no campo de arquivo e entendeu que ja valia. Nao valia: o
   campo mostra a ESCOLHA do navegador, e o arquivo so e gravado quando
   "Preparar fila" roda. Ele chegou a um clique de mandar 100 oficios com a
   CCT antiga.

   O status passa a devolver o que esta de fato no oficio, para a tela poder
   dizer — em vez de a pessoa so descobrir abrindo um e-mail ja enviado. */

passo("depois de preparar com uma CCT");
g.PropertiesService.getScriptProperties()
  .setProperty("TN_COM_CCT_NOME", "CCT-SindEducacao-2026-2027.pdf");
const stCct = g.tnCom_status_();
igual(stCct.cctGuardada, "CCT-SindEducacao-2026-2027.pdf",
   "o status diz QUAL arquivo está guardado no ofício");
ok(stCct.tetoDia > 0, "e qual teto está valendo de verdade", "teto=" + stCct.tetoDia);

passo("sem CCT nenhuma");
g.PropertiesService.getScriptProperties().deleteProperty("TN_COM_CCT_NOME");
igual(g.tnCom_status_().cctGuardada, "",
   "devolve vazio — a tela mostra 'nenhuma anexada' em vermelho, sem inventar");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A porta única, e o que ela recusa");

/* O google.script.run só alcança função global SEM underline, então a tela
   precisa de uma porta. UMA, não oito: o teto de exposição do projeto está em
   204 e o exposicao-teto.json diz que ele só desce.

   E a porta NÃO custou teto — o t6 conta função que devolve dado real SEM
   token, e esta recusa antes de qualquer coisa. Eu quase subi o teto por
   engano achando que toda global conta; está registrado no proprio json. */

passo("sem token");
b.bloqueia(() => g.comunicacaoTaxaNegocial("status", {}, ""),
   "recusa sem sessão");

passo("com sessão sem o módulo Documentos");
const tokenSemModulo = b.logar(g, "joscimar");   /* escolas,sindicalizacao */
b.bloqueia(() => g.comunicacaoTaxaNegocial("status", {}, tokenSemModulo),
   "recusa quem não tem o módulo Documentos");

passo("o que MUDA estado exige administrador");
const tokenUsuario = b.logar(g, "rogerio");      /* financeiro,rh — não é admin */
b.bloqueia(() => g.comunicacaoTaxaNegocial("liberar", {}, tokenUsuario),
   "liberar exige administrador — decide o que 679 escolas recebem");
b.bloqueia(() => g.comunicacaoTaxaNegocial("preparar", {}, tokenUsuario),
   "preparar também");

passo("ação desconhecida não explode nem faz nada");
const tokenAdmin = b.logar(g, "wanderson");
const bobo = g.comunicacaoTaxaNegocial("apagar_tudo", {}, tokenAdmin);
igual(bobo.ok, false, "recusa ação que não existe");
ok(String(bobo.mensagem).indexOf("desconhecida") > -1,
   "dizendo que não conhece, em vez de cair em algum caminho por acidente",
   bobo.mensagem);

passo("o laço e o gatilho continuam FORA da porta");
igual(typeof g.tnCom_enviarLote_, "function", "o laço existe");
ok(String(g.tnCom_enviarLote_.name).slice(-1) === "_",
   "e é privado — um anônimo não dispara 679 e-mails");
ok(String(g.tnCom_loteAgendado_.name).slice(-1) === "_",
   "o handler de gatilho também, e funciona assim no Apps Script");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A tela está ligada ao Portal");

const fs = require("fs");
const idx = fs.readFileSync(require("./load").RAIZ + "/index.html", "utf8");

ok(idx.indexOf("ComunicacaoTNAdmin") > -1, "o arquivo da tela é incluído no index");
ok(idx.indexOf('id="mComunicacaoTN"') > -1, "existe o container da página");
ok(idx.indexOf('data-sub-mod="comunicacaoTN"') > -1, "existe o botão no submenu do Financeiro");
ok(/data-subs="[^"]*comunicacaoTN/.test(idx), "e ele está na lista de submódulos do grupo");
ok(idx.indexOf('comunicacaoTN:["mComunicacaoTN"') > -1, "a página está registrada");
ok(idx.indexOf("initComunicacaoTN") > -1, "e o gancho que inicializa a tela existe");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A tabela da fila não fica trancada atrás do Liberar");

/* Ate 12/09/2026 a tabela com TODAS as escolas e a situacao de cada uma
   vivia dentro do bloco ACOMPANHAR, que so aparece depois de Liberar envio.
   Quem estava testando ANTES de liberar — a ordem certa de trabalhar — nao
   tinha como ver a situacao de escola nenhuma. A unica janela para a fila era
   a busca, e a busca escondia quem ja havia recebido. Resultado: uma escola
   correta ficou invisivel por duas portas ao mesmo tempo. */
const tela = fs.readFileSync(require("./load").RAIZ + "/ComunicacaoTNAdmin.html", "utf8");

const iFila  = tela.indexOf('id="ctnFila"');
const iAcomp = tela.indexOf('id="ctnAcompanhar"');
const iCorpo = tela.indexOf('id="ctnCorpo"');

ok(iFila > -1, "existe um bloco próprio para a fila");
ok(iCorpo > iFila, "e a tabela mora dentro dele");
ok(iAcomp > -1 && iAcomp < iFila && iCorpo > iAcomp,
   "fora do bloco de acompanhamento, que só aparece depois de liberar");
ok(tela.indexOf('g("ctnFila").style.display = (s.total > 0)') > -1,
   "e quem manda nela é TER FILA, não ter liberado");
ok(tela.indexOf("if (s.total > 0) ctnListar();") > -1,
   "a tabela carrega sempre que houver fila");

/* A lista da busca precisa distinguir quem pode receber de quem nao pode —
   senao o cinza da tela nao teria de onde vir. */
ok(tela.indexOf("i.podeEnviar") > -1, "a lista da busca lê o podeEnviar do backend");
ok(tela.indexOf("cursor:not-allowed") > -1, "e quem não pode não convida ao clique");
ok(tela.indexOf("i.motivo") > -1, "mostrando o motivo, em vez de um cinza sem explicação");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O PDF nominal e a CCT anexa",
  "DocumentApp não é emulado — a geração do documento e o anexo da CCT " +
  "continuam sem teste executável. Roteiro manual antes do primeiro disparo.");
naoTestavel("O gatilho reagendando sozinho de hora em hora",
  "o emulador não reproduz agendamento do Apps Script. Aqui se prova que a " +
  "função de reagendar É CHAMADA; que ela dispara no ar, só no ar.");
naoTestavel("O limite de CHAMADAS ao serviço Gmail",
  "MailApp.getRemainingDailyQuota conta DESTINATÁRIOS. O que estourou em " +
  "09/09 foi o limite de chamadas, que o Google não expõe. A segunda linha de " +
  "defesa é o oficio_ehLimiteDoGmail_, tratado no laço.");

resumo();
