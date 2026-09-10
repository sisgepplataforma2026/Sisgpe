/**
 * TESTE — COMPROVANTE DE ENVIO, E A HONESTIDADE DELE
 *
 * O QUE ORIGINOU, 10/09/2026. O usuário:
 *
 *   "isso é uma falha, como vou provar que foi enviado se não tenho a prova
 *    que a escola recebeu"
 *
 * Propus protocolo de recebimento — a escola clica e confirma. Ele derrubou:
 *
 *   "Não vai burocratizar? Já que o email é pessoal"
 *
 * Estava certo. Protocolo faz A ESCOLA trabalhar, e se ela não clicar não se
 * ganha nada — só uma lista de pendência que nunca esvazia, que é o item 74
 * outra vez. Escopo fechado por ele: **"Só preciso da confirmação do email
 * enviado."**
 *
 * O QUE ESTE TESTE MEDE, e é a parte que importa: não que o comprovante SAIA,
 * mas que ele não MINTA. Um comprovante que exagera só falha na hora em que é
 * usado, e essa hora é uma disputa. Por isso as asserções são quase todas
 * sobre o que ele se recusa a afirmar.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const SEM_MODULO = b.logar(g, "rogerio");   // financeiro,rh — não tem documentos
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CAB = ["NUMERO_OFICIO", "TIPO", "ESCOLA", "CNPJ", "EMAIL_PRINCIPAL",
             "EMAILS_TODOS", "STATUS", "DATA_ENVIO", "DATA_CONFIRMACAO",
             "MENSAGEM_ID", "STATUS_RECEBIMENTO", "OBSERVACOES",
             "ULTIMO_ERRO", "ANEXOS_JSON", "COMPROVACAO_ENVIO", "COMPROVACAO_EM"];

const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS") ||
             ss.insertSheet("FILA_ENVIO_OFICIOS");
fila.getRange(1, 1, 1, CAB.length).setValues([CAB]);

const d = (a, m, dia) => new Date(a, m - 1, dia, 14, 8);

/* OS CINCO CASOS, e cada um existe para uma frase que o comprovante NÃO pode
   dizer. O 701 é o melhor cenário possível; os outros são os que a fila real
   tem aos montes. */
fila.getRange(2, 1, 5, CAB.length).setValues([
  /* completo: id, conferido, sem devolução, resposta de GENTE */
  ["701/2026", "Filiação", "EMEF Monte Alvo", "00.000.000/0001-00",
   "ana.ribeiro@montealvo.com.br", "ana.ribeiro@montealvo.com.br", "ENVIADO",
   d(2026, 9, 4), d(2026, 9, 5), "1a06df76da28c73c", "CONFIRMADO",
   "Confirmado manualmente pelo operador.", "", '[{"nome":"Oficio 701.pdf"}]',
   "EM ENVIADOS", d(2026, 9, 9)],

  /* o caso comum da fila: sem id, sem conferência, caixa de setor */
  ["702/2026", "Filiação", "EMEF Santa Rita", "",
   "contato@santarita.com.br", "contato@santarita.com.br", "ENVIADO",
   d(2026, 7, 15), "", "GMAILAPP_SEM_ID", "", "", "", "[]", "", ""],

  /* confirmação AUTOMÁTICA — não pode sair com o mesmo peso da de gente */
  ["703/2026", "Filiação", "EMEF Bela Vista", "",
   "joao.silva@belavista.com.br", "joao.silva@belavista.com.br", "ENVIADO",
   d(2026, 8, 20), d(2026, 8, 22), "", "CONFIRMADO",
   "Confirmação localizada automaticamente no Gmail.", "", "[]", "", ""],

  /* devolvido: o comprovante tem de CONTRARIAR o envio */
  ["704/2026", "Filiação", "EMEF Do Vale", "",
   "morto@dovale.com.br", "morto@dovale.com.br", "FALHA_ENTREGA",
   d(2026, 8, 1), "", "", "", "", "E-mail não chegou ao destino", "[]", "", ""],

  /* sem DATA_ENVIO — as ~50 linhas assim que apareceram na planilha real */
  ["705/2026", "Filiação", "EMEF Sem Data", "",
   "sec@semdata.com.br", "sec@semdata.com.br", "ENVIADO",
   "", "", "", "", "", "", "[]", "", ""]
]);

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · comprovante de envio");

passo("a porta");

let recusou = false;
try {
  const r = g.comprovanteDeEnvioOficio("701/2026", SEM_MODULO);
  recusou = !!(r && r.ok === false);
} catch (e) { recusou = /sess|permiss|autoriza|acesso ao m/i.test(e.message); }
ok(recusou, "quem não tem o módulo documentos não tira comprovante",
   "sai nome de escola, CNPJ e os contatos dela");

passo("o melhor caso: tudo que existe, com o peso certo");

const r1 = g.comprovanteDeEnvioOficio("701/2026", TOKEN);
igual(r1.ok, true, "o comprovante do 701 sai", r1.mensagem);

const por = n => (r1.evidencias.filter(e => e.item === n)[0] || {});
igual(por("Caixa de Enviados").prova, "forte",
      "conferido em Enviados vale prova FORTE",
      "é a única linha que diz 'procurei e está lá'");
igual(por("Resposta da escola").prova, "forte",
      "e a confirmação registrada por uma PESSOA também");
igual(por("Devolução").prova, "fraca",
      "mas ausência de devolução é INDÍCIO, não prova",
      "prova que o servidor aceitou; não prova que alguém leu");

passo("A DISTINÇÃO QUE MAIS IMPORTA: gente x varredura automática");

/* A confirmação automática vem de busca no Gmail — e foi ela que deixou uma
   assinatura "Outlook" confirmar ofício que tinha quicado (item 49). Sair com
   o mesmo peso da leitura de uma pessoa seria repetir aquele erro num
   documento que vai ser usado para provar alguma coisa. */
const r3 = g.comprovanteDeEnvioOficio("703/2026", TOKEN);
const resp3 = r3.evidencias.filter(e => e.item === "Resposta da escola")[0];
igual(resp3.prova, "fraca",
      "confirmação AUTOMÁTICA vale menos que a de uma pessoa",
      "mesma coluna, mesma palavra CONFIRMADO — peso diferente, e com razão");
ok(/autom/i.test(r3.html) && /quic/i.test(r3.html),
   "  e o documento explica por quê, em vez de só rebaixar em silêncio");

passo("o caso comum da fila: o comprovante admite o que não tem");

const r2 = g.comprovanteDeEnvioOficio("702/2026", TOKEN);
const por2 = n => (r2.evidencias.filter(e => e.item === n)[0] || {});
igual(por2("Identificador da mensagem").prova, "nenhuma",
      "sem id, a linha diz que não prova nada");
ok(/não guardado/i.test(r2.html),
   "  e aparece escrito, não em branco",
   "campo vazio o leitor preenche com otimismo");
ok(/02\/09\/2026/.test(r2.html),
   "  com o motivo: até 02/09 o envio não devolvia identificador",
   "sem isso a ausência parece defeito deste ofício, e é do sistema de então");
igual(por2("Caixa de Enviados").prova, "nenhuma",
      "e conferência que não passou por aqui não vira prova");

passo("GMAILAPP_SEM_ID não é identificador");

ok(!/GMAILAPP_SEM_ID/.test(r2.html),
   "o marcador não é exibido como se fosse prova",
   "é o texto que se gravava quando NÃO havia id — o oposto de uma prova");

passo("endereço nominal x caixa de setor — a diferença fica à vista");

ok(/endereço nominal/.test(r1.html),
   "o 701 vai para pessoa, e o documento diz isso");
ok(/caixa de setor/.test(r2.html),
   "o 702 vai para contato@, e o documento diz isso também",
   "'mandei para o setor' é evidência mais fraca de que alguém leu");
igual(g.oficioComprovante_classificarEndereco_("joao.silva@x.com"), "nominal",
      "nome.sobrenome é nominal");
igual(g.oficioComprovante_classificarEndereco_("secretaria@x.com"), "generico",
      "secretaria@ é setor");
igual(g.oficioComprovante_classificarEndereco_("joao@x.com"), "indefinido",
      "e o ambíguo fica INDEFINIDO, não é chutado para nominal",
      "chutar inflaria a força justamente onde o comprovante é mais fraco");

passo("ofício devolvido: o comprovante CONTRARIA o envio");

const r4 = g.comprovanteDeEnvioOficio("704/2026", TOKEN);
igual(r4.evidencias.filter(e => e.item === "Devolução")[0].prova, "contraria",
      "devolução registrada contraria o envio",
      "o pior desfecho possível é este comprovante sair parecendo favorável");
ok(/NÃO chegou/.test(r4.html),
   "  e o documento diz, em letras, que NÃO chegou");

passo("sem DATA_ENVIO: não afirma o que não sabe");

const r5 = g.comprovanteDeEnvioOficio("705/2026", TOKEN);
igual(r5.evidencias.filter(e => e.item === "Envio")[0].prova, "nenhuma",
      "sem data, o envio não é afirmado");
ok(/sem data registrada/i.test(r5.html),
   "  e o documento diz que não dá para afirmar quando, ou se, saiu",
   "são ~50 linhas assim na planilha real");

passo("o rodapé diz o que e-mail NÃO prova");

ok(/não é/i.test(r1.html) && /leu/i.test(r1.html),
   "o documento declara que não prova leitura",
   "sem isso ele induz a erro por omissão — e só falha quando for usado");
ok(/aviso de recebimento|protocolo assinado/i.test(r1.html),
   "  e aponta o que vale mais, para disputa de verdade");

passo("não custa cota");

/* Um comprovante que gasta orçamento de Gmail competiria com o envio de
   ofício — foi exatamente isso que derrubou o reenvio do 407 (item 77). */
const fonte = String(g.oficioComprovante_dados_) + String(g.oficioComprovante_html_) +
              String(g.comprovanteDeEnvioOficio);
ok(!/GmailApp|MailApp/.test(fonte),
   "o comprovante não fala com o Gmail",
   "ler e enviar saem do mesmo orçamento");

passo("ofício que não existe");

const rX = g.comprovanteDeEnvioOficio("999/2026", TOKEN);
igual(rX.ok, false, "número inexistente devolve recusa, não comprovante vazio");

/* ══════════════════════════════════════════════════════════════════════════ */
naoTestavel("se o PDF impresso sai legível",
  "o emulador não converte HTML em PDF. O que se prova aqui é o conteúdo e o " +
  "peso de cada evidência. Quem responde pelo papel é imprimir um.");

naoTestavel("se o comprovante convence quem for julgar",
  "isso não é questão de código. O que dá para garantir é que ele não " +
  "afirma mais do que o sistema sabe — e é isso que este teste mede.");

resumo();
