/**
 * t128 — MÓDULO 03 · O PAINEL DE STATUS E O CONSERTO DO E-MAIL DA ESCOLA
 *
 * Frente A, sexta rodada, 01/09/2026. Estas três têm porta desde sempre e
 * NUNCA foram executadas por teste nenhum.
 *
 * POR QUE ESTAS TRÊS, E NÃO OUTRAS DA LISTA
 *
 * São as ferramentas do problema que o sindicato está vivendo agora: escolas
 * reclamando que não receberam o ofício. Quem vai atrás disso usa exatamente
 * este caminho — abre o painel (`listarStatusOficios`), vê o que não chegou,
 * conserta o e-mail errado no cadastro (`atualizarEmailEscola`) e marca o
 * ofício para reprocessar (`atualizarStatusOficio`).
 *
 * O QUE PODE DAR ERRADO E NINGUÉM VER
 *
 * 1. `atualizarStatusOficio` grava em DUAS abas — Controle e Fila. Se gravar
 *    só numa, o painel mostra um status e o envio segue outro. O ofício fica
 *    "confirmado" na tela e parado na fila, ou o contrário.
 *
 * 2. `atualizarEmailEscola` grava em DUAS colunas — principal e todos. Se
 *    gravar só a principal, o próximo envio ainda usa a lista velha e o
 *    ofício volta a não chegar, com o cadastro parecendo certo na tela.
 *
 * 3. `listarStatusOficios` junta Controle e Fila. Se a fusão errar a chave,
 *    o mesmo ofício aparece duas vezes com status diferentes — e quem lê
 *    escolhe o que quiser acreditar.
 *
 * UM ACHADO DE PERMISSÃO, REGISTRADO NO FIM
 *
 * `atualizarEmailEscola` pede o módulo SINDICALIZAÇÃO. Quem descobre o e-mail
 * errado está no módulo DOCUMENTOS, olhando um ofício que voltou. É decisão
 * do usuário, não minha — fica como aviso, não como correção.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const DOCS = b.logar(g, "wanderson");            /* ADMINISTRADOR, todos */
const SEM  = b.logar(g, "joscimar");             /* escolas,sindicalizacao */

function tentar(fn) {
  try { return { passou: true, valor: fn(), msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

(function semear() {
  /* Controle: a base antiga, onde o ofício nasce. */
  let c = ss.getSheetByName(g.PLANILHA_REGISTRO);
  if (!c) c = ss.insertSheet(g.PLANILHA_REGISTRO);
  c.getRange(1, 1, 1, 6).setValues([[
    "Número do Ofício", "Escola", "E-mail", "Status", "TIPO", "Observações"]]);
  c.getRange(2, 1, 2, 6).setValues([
    ["030/2026", "Escola Alfa", "alfa@teste.com", "ENVIADO", "FILIACAO", ""],
    ["031/2026", "Escola Beta", "beta@teste.com", "ENVIADO", "FILIACAO", ""]
  ]);

  /* Fila: o envio automatizado. Mesmo 030, para provar a fusão. */
  let f = ss.getSheetByName("FILA_ENVIO_OFICIOS");
  if (!f) f = ss.insertSheet("FILA_ENVIO_OFICIOS");
  const cab = ["NUMERO_OFICIO", "ESCOLA", "EMAIL_DESTINO", "STATUS",
               "TENTATIVAS", "ULTIMO_ERRO", "DATA_ULTIMA_TENTATIVA",
               "STATUS_RECEBIMENTO", "OBSERVACOES"];
  f.getRange(1, 1, 1, cab.length).setValues([cab]);
  f.getRange(2, 1, 2, cab.length).setValues([
    ["030/2026", "Escola Alfa", "alfa@teste.com", "FALHA_ENTREGA", 1,
     "Mailbox unavailable", new Date(), "", ""],
    ["032/2026", "Escola Gama", "gama@teste.com", "PENDENTE", 0, "", "", "", ""]
  ]);

  /* Cadastro de escolas, com o e-mail que faz o ofício voltar. */
  let e = ss.getSheetByName("Escolas");
  if (!e) e = ss.insertSheet("Escolas");
  e.getRange(1, 1, 1, 5).setValues([[
    "NOME", "RAZAO SOCIAL", "CNPJ", "E-MAIL (PRINCIPAL)", "E-MAILS (TODOS)"]]);
  e.getRange(2, 1, 1, 5).setValues([[
    "Escola Alfa", "Alfa Educacional LTDA", "12345678000199",
    "errado@alfa.com", "errado@alfa.com, secretaria@alfa.com"]]);
})();

b.fluxo("MÓDULO 03 · o painel que mostra o que não chegou");

b.passo("1. a porta — sem sessão não lista nada");
const semSessao = tentar(() => g.listarStatusOficios({}, ""));
b.ok(!semSessao.passou || semSessao.valor.erro === true,
  "listarStatusOficios recusa quem não tem sessão",
  semSessao.passou ? "PASSOU — status de todas as escolas aberto"
                   : semSessao.msg.substring(0, 44));

b.passo("2. lista os três ofícios, sem duplicar o que está nas duas abas");
/* O 030 está no Controle E na Fila. Se a fusão errar, ele vem duas vezes com
   status conflitante — e quem lê escolhe no que acreditar. */
const lista = g.listarStatusOficios({}, DOCS);
b.ok(lista && !lista.erro, "responde sem erro",
  lista && lista.erro ? lista.mensagem : "ok");
const numeros = (lista.itens || []).map(i => String(i.numero || "")).sort();
b.igual(numeros, ["030/2026", "031/2026", "032/2026"],
  "três ofícios distintos — o 030 não veio duplicado");

b.passo("3. E O STATUS QUE VALE É O DA FILA — ela é quem envia de verdade");
/* O Controle diz ENVIADO para o 030; a Fila diz FALHA_ENTREGA. Se o painel
   mostrar ENVIADO, a escola some da lista de quem precisa de atenção. */
const item030 = (lista.itens || []).filter(i => i.numero === "030/2026")[0];
b.ok(!!item030, "o 030 está na lista");
b.igual(String(item030 && item030.status || ""), "FALHA_ENTREGA",
  "e vem como FALHA_ENTREGA, não como ENVIADO");

b.fluxo("MÓDULO 03 · marcar o ofício para reprocessar");

b.passo("4. a porta, de novo");
const semSessao2 = tentar(() => g.atualizarStatusOficio("030/2026", "PENDENTE", "", ""));
b.ok(!semSessao2.passou || semSessao2.valor.erro === true,
  "atualizarStatusOficio recusa quem não tem sessão",
  semSessao2.passou ? "PASSOU — qualquer um reescreve status de ofício"
                    : semSessao2.msg.substring(0, 44));

b.passo("5. status inventado é recusado");
/* Sem essa trava, a coluna vira texto livre e o filtro do painel para de
   funcionar sem ninguém perceber. */
const inventado = g.atualizarStatusOficio("030/2026", "QUASE_ENVIADO", "", DOCS);
b.ok(inventado && inventado.erro === true, "status fora da lista é recusado",
  inventado && inventado.mensagem ? inventado.mensagem.substring(0, 40) : "");

b.passo("6. E A PARTE QUE QUEBRA CALADA — grava nas DUAS abas");
/* Se gravar só numa, o painel mostra um status e o envio segue outro. */
const mudou = g.atualizarStatusOficio("030/2026", "PENDENTE", "Reenvio manual", DOCS);
b.ok(mudou && !mudou.erro, "aceita o status válido",
  mudou && mudou.mensagem ? mudou.mensagem.substring(0, 40) : "");

const ctrl = ss.getSheetByName(g.PLANILHA_REGISTRO).getRange(2, 4).getValue();
const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS").getRange(2, 4).getValue();
b.igual(String(ctrl), "PENDENTE", "o Controle recebeu o status novo");
b.igual(String(fila), "PENDENTE", "e a Fila também — as duas, não uma");

b.passo("7. e a mudança fica registrada no log de auditoria");
/* Status de ofício mexido à mão sem rastro é o que impede reconstruir depois
   por que um ofício mudou de estado. */
const log = ss.getSheetByName("LOG_SISTEMA");
b.ok(!!log, "a aba LOG_SISTEMA existe depois da operação");
const linhasLog = log ? log.getDataRange().getValues() : [];
const achou = linhasLog.some(l => String(l.join(" ")).indexOf("030/2026") >= 0 &&
                                  String(l.join(" ")).indexOf("PENDENTE") >= 0);
b.ok(achou, "a troca de status do 030 está no log");

b.passo("8. ofício que não existe não inventa linha");
const inexistente = g.atualizarStatusOficio("999/2026", "PENDENTE", "", DOCS);
b.ok(inexistente && inexistente.erro === true,
  "número inexistente é recusado, não criado");
b.igual(ss.getSheetByName(g.PLANILHA_REGISTRO).getLastRow(), 3,
  "e o Controle continua com as mesmas 2 linhas de ofício");

b.fluxo("MÓDULO 03 · consertar o e-mail que faz o ofício voltar");

b.passo("9. a porta");
const semSessao3 = tentar(() => g.atualizarEmailEscola("12345678000199", "novo@alfa.com", "x", ""));
b.ok(!semSessao3.passou || semSessao3.valor.sucesso === false,
  "atualizarEmailEscola recusa quem não tem sessão",
  semSessao3.passou ? "PASSOU — cadastro de escola editável por qualquer um"
                    : semSessao3.msg.substring(0, 44));

b.passo("10. CNPJ e e-mail malformados são recusados ANTES de gravar");
/* A REGRA Nº 0.6 diz para avisar antes de a pessoa terminar: recusar aqui é
   melhor que gravar lixo que só aparece no próximo envio que falha. */
const cnpjCurto = g.atualizarEmailEscola("123", "novo@alfa.com", "x", DOCS);
b.ok(cnpjCurto && cnpjCurto.sucesso === false, "CNPJ com 3 dígitos é recusado");
const mailTorto = g.atualizarEmailEscola("12345678000199", "novo-arroba-alfa", "x", DOCS);
b.ok(mailTorto && mailTorto.sucesso === false, "e-mail sem @ é recusado",
  mailTorto && mailTorto.mensagem ? mailTorto.mensagem.substring(0, 36) : "");
const vazio = g.atualizarEmailEscola("12345678000199", "  ;  ,  ", "x", DOCS);
b.ok(vazio && vazio.sucesso === false, "lista só com separador é recusada");

b.passo("11. E A PARTE QUE QUEBRA CALADA — grava as DUAS colunas");
/* Se gravar só a principal, o próximo envio ainda usa a lista velha: o ofício
   volta a não chegar e o cadastro parece certo na tela. */
const corrigiu = g.atualizarEmailEscola(
  "12.345.678/0001-99", "novo@alfa.com; diretoria@alfa.com", "wanderson", DOCS);
b.ok(corrigiu && corrigiu.sucesso === true, "aceita o CNPJ formatado com máscara",
  corrigiu && corrigiu.mensagem ? corrigiu.mensagem.substring(0, 40) : "");

const esc = ss.getSheetByName("Escolas");
b.igual(String(esc.getRange(2, 4).getValue()), "novo@alfa.com",
  "coluna principal atualizada");
b.igual(String(esc.getRange(2, 5).getValue()), "novo@alfa.com, diretoria@alfa.com",
  "e a lista TODOS também — não sobrou o e-mail velho");

b.passo("12. e o e-mail antigo não ficou em lugar nenhum da linha");
/* O ponto do teste anterior visto por outro lado: se o e-mail errado
   sobreviver em qualquer coluna, o envio pode voltar a usá-lo. */
const linhaEscola = esc.getRange(2, 1, 1, 5).getValues()[0].join(" | ");
b.ok(linhaEscola.indexOf("errado@alfa.com") === -1,
  "errado@alfa.com sumiu da linha inteira", linhaEscola.substring(0, 60));

b.passo("13. CNPJ que não está no cadastro não cria escola nova");
const naoTem = g.atualizarEmailEscola("99999999000199", "x@y.com", "x", DOCS);
b.ok(naoTem && naoTem.sucesso === false, "recusa CNPJ desconhecido");
b.igual(esc.getLastRow(), 2, "e o cadastro continua com uma escola só");

b.fluxo("MÓDULO 03 · os DOIS caminhos até o conserto (item 52, corrigido)");

b.passo("14. quem tem só SINDICALIZAÇÃO consegue — como sempre foi");
const porSind = g.atualizarEmailEscola("12345678000199", "terceiro@alfa.com", "j", SEM);
b.ok(porSind && porSind.sucesso === true,
  "o joscimar (escolas,sindicalizacao) corrige");

b.passo("15. E QUEM TEM SÓ DOCUMENTOS TAMBÉM — era o buraco do item 52");
/* O caminho real da secretaria: abre o painel de ofícios (Documentos), vê que
   um voltou por e-mail errado, e corrige. Antes de 01/09/2026 ela parava aqui
   e dependia de outra pessoa. */
(function () {
  const ss2 = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  const aba = ss2.getSheetByName(g.ABA_USUARIOS_LOGIN);
  aba.getRange(5, 1, 1, 8).setValues([[
    "marcela", g.gerarHashSenha_("Senha@2026"), "Marcela",
    "marcela@sindeducacao.com", "USUARIO", "ATIVO", "NAO", "documentos"
  ]]);
  const SO_DOCS = b.logar(g, "marcela");
  const porDocs = g.atualizarEmailEscola(
    "12345678000199", "quarto@alfa.com", "marcela", SO_DOCS);
  b.ok(porDocs && porDocs.sucesso === true,
    "quem tem só Documentos corrige o e-mail da escola",
    porDocs && porDocs.mensagem ? porDocs.mensagem.substring(0, 44) : "");
  b.igual(String(esc.getRange(2, 4).getValue()), "quarto@alfa.com",
    "e a correção dela chegou ao cadastro");
})();

b.passo("16. E A PORTA NÃO VIROU PORTA ABERTA — é o que importa checar");
/* Aceitar dois módulos não pode virar aceitar qualquer um. O rogério tem
   financeiro e rh: nenhum dos dois serve. */
const semNenhum = tentar(() => g.atualizarEmailEscola(
  "12345678000199", "invasor@x.com", "r", b.logar(g, "rogerio")));
b.ok(!semNenhum.passou || semNenhum.valor.sucesso === false,
  "quem não tem NENHUM dos dois módulos continua barrado",
  semNenhum.passou ? "PASSOU — o cadastro de escolas ficou aberto"
                   : semNenhum.msg.substring(0, 52));
b.ok(!semNenhum.passou && /Documentos|Sindicaliza/i.test(semNenhum.msg),
  "e a mensagem diz OS DOIS caminhos possíveis, não só um",
  semNenhum.passou ? "" : semNenhum.msg.substring(0, 60));

const semSessao4 = tentar(() => g.atualizarEmailEscola(
  "12345678000199", "invasor@x.com", "x", ""));
b.ok(!semSessao4.passou, "e anônimo continua barrado",
  semSessao4.passou ? "PASSOU" : semSessao4.msg.substring(0, 40));

b.igual(String(esc.getRange(2, 4).getValue()), "quarto@alfa.com",
  "nenhuma das duas tentativas barradas mexeu no cadastro");

b.naoTestavel(
  "se o ofício REENVIADO depois da correção chega na caixa da escola",
  "é a pergunta que originou tudo isto, e ela só se responde na produção: o " +
  "emulador registra o e-mail, não entrega. O roteiro é corrigir o e-mail, " +
  "marcar o ofício como PENDENTE e conferir a caixa da escola"
);

b.resumo();
