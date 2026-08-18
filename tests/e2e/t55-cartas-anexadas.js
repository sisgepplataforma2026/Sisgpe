/**
 * TESTE — A CARTA DO LOTE VAI ANEXADA NO E-MAIL DA ESCOLA
 *
 * O QUE ORIGINOU
 *
 * O usuário, em 18/08/2026, disse duas vezes, para não haver dúvida:
 * "as cartas devem vir junto no e-mail anexado" e "as cartas o lote deve ser
 * anexada no e-mail". O caso real dele: as cartas de oposição foram
 * escaneadas num PDF só, por escola, e ele anexa esse arquivo no ofício.
 *
 * Isso não é detalhe de conveniência. O corpo do e-mail diz "acompanhado da
 * carta de oposição". Se o arquivo não for junto, o documento afirma um
 * anexo que não existe: a escola recebe uma ordem para não descontar sem a
 * prova de que alguém se opôs, e num questionamento é o sindicato que fica
 * sem o papel.
 *
 * O QUE ESTE TESTE PROVA, POR EXECUÇÃO
 *
 * Emite um ofício de verdade por gerarOficioWeb, com um PDF único de cartas
 * (o formato do lote), e lê a FILA DE ENVIO — a estrutura que o envio real
 * consome — conferindo que a lista de anexos guardada tem o PDF do ofício
 * E a carta.
 *
 * Por que pela fila e não pela caixa de saída: emitir NÃO envia. A emissão
 * gera o PDF, grava o registro e enfileira; o envio é o passo seguinte
 * ("Enviar e-mail agora"), que lê ANEXOS_JSON e anexa cada arquivo. Medi
 * isso ao escrever a primeira versão deste teste, que espiava a caixa de
 * saída e a encontrava vazia — o teste estava errado, não o sistema.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: a entrega
 * pelo Gmail e como o anexo chega na caixa da escola. O emulador registra o
 * envio, não envia.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;

b.fluxo("ANEXOS · A carta escaneada do lote vai junto");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const CAB = ["Item", "Nome", "CPF", "Ficha / Arquivo", "TIPO", "Número do Ofício",
             "Escola (Razão Social)", "CNPJ", "Data envio ofício", "Status",
             "Link PDF", "Link Ficha", "E-mail (principal)", "E-mails (todos)", "CONFIG"];
let abaReg = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (abaReg) ss.deleteSheet(abaReg);
abaReg = ss.insertSheet(g.PLANILHA_REGISTRO);
abaReg.getRange(1, 1, 1, CAB.length).setValues([CAB]);

b.seedUsuarios(g);
const token = b.logar(g, "wanderson");

function arquivo(nome, texto) {
  return { nome: nome, tipo: "application/pdf", base64: g.Utilities.base64Encode(texto) };
}

function emitir(tipo, pessoas, anexos) {
  return g.gerarOficioWeb({
    tipo: tipo,
    escola: "COLEGIO EXEMPLO LTDA",
    cnpj: "36136001000105",
    email: "diretoria@colegioexemplo.com.br",
    colaboradores: pessoas,
    fichas: anexos,
    confirmarDuplicata: true
  }, token);
}

/** A fila é o que o envio real consome. */
function anexosDaFila(numero) {
  const sh = ss.getSheetByName("FILA_ENVIO_OFICIOS") ||
             ss.getSheetByName("Fila_Envio_Oficios") ||
             ss.getSheets().filter(s => /fila/i.test(s.getName()))[0];
  if (!sh || sh.getLastRow() < 2) return null;
  const h = g.getHeaderMap_(sh);
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][h["NUMERO_OFICIO"] - 1] || "").trim() !== String(numero).trim()) continue;
    try { return JSON.parse(String(dados[i][h["ANEXOS_JSON"] - 1] || "[]")); }
    catch (e) { return null; }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   1. O caso do usuário: um PDF único com todas as cartas
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
const res = emitir("Oposição à Taxa Negocial",
  [{ nome: "CLARA GOMES" }, { nome: "ANA LIMA" }, { nome: "JOAO REIS" }],
  [arquivo("Cartas_COLEGIO_EXEMPLO_18-08-2026.pdf", "TRES CARTAS DIGITALIZADAS")]);

b.ok(res && !res.erro, "o ofício de oposição em lote é emitido",
  res && res.erro ? String(res.mensagem).slice(0, 140) : "");

const numero = res && res.dados && res.dados.numero;
b.ok(!!numero, "o ofício recebe número", String(numero || ""));

b.passo("2");
const anexos = anexosDaFila(numero);
b.ok(Array.isArray(anexos), "o ofício entrou na fila de envio com lista de anexos",
  anexos ? anexos.length + " anexo(s)" : "fila não encontrada");

b.igual(anexos ? anexos.length : 0, 2,
  "são DOIS anexos: o PDF do ofício e o PDF das cartas");

b.passo("3");
const nomes = (anexos || []).map(a => String(a.nome || ""));

/* O sistema RENOMEIA o arquivo anexado para Fichas_<ESCOLA>_<data> — foi o
   pedido do usuário: "na hora de salvar pode colocar o nome da escola e a
   data". Minha primeira asserção procurava o nome original do arquivo e
   reprovava o comportamento CERTO. Confere a regra de nomeação, não o nome
   que o atendente deu ao arquivo no computador dele. */
b.ok(nomes.some(n => /^Fichas_.+_\d{2}-\d{2}-\d{4}/i.test(n)),
  "a carta anexada aparece com nome da escola e data",
  nomes.join(" · "));
b.ok(nomes.some(n => /^Of[ií]cio/i.test(n)),
  "e o PDF do próprio ofício também vai", nomes.join(" · "));

/* Todo anexo precisa de fileId — é por ele que o envio busca o arquivo no
   Drive. Item sem fileId é ignorado no envio, em silêncio. */
b.passo("4");
b.ok((anexos || []).every(a => a && String(a.fileId || "").length > 0),
  "todo anexo tem fileId — sem ele o envio pula o arquivo sem avisar");

/* ═══════════════════════════════════════════════════════════
   2. Contraprova: sem carta, vai só o ofício
   ═══════════════════════════════════════════════════════════

   Sem isto, uma função que anexasse dois arquivos fixos passaria acima.
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
const semCarta = emitir("Taxa Negocial", [{ nome: "PEDRO ALVES" }], []);
b.ok(semCarta && !semCarta.erro, "emite sem anexo nenhum");
const anexos2 = anexosDaFila(semCarta && semCarta.dados && semCarta.dados.numero);
b.igual(anexos2 ? anexos2.length : -1, 1,
  "sem carta anexada, vai só o PDF do ofício");

/* ═══════════════════════════════════════════════════════════
   3. Várias cartas separadas também vão todas
   ═══════════════════════════════════════════════════════════

   O lote costuma vir num arquivo só, mas quem anexa uma por pessoa não pode
   perder nenhuma pelo caminho.
   ═══════════════════════════════════════════════════════════ */
b.passo("6");
const varias = emitir("Oposição à Taxa Negocial",
  [{ nome: "CLARA GOMES" }, { nome: "ANA LIMA" }, { nome: "JOAO REIS" }],
  [arquivo("carta_clara.pdf", "A"), arquivo("carta_ana.pdf", "B"), arquivo("carta_joao.pdf", "C")]);
b.ok(varias && !varias.erro, "emite com 3 cartas separadas");
const anexos3 = anexosDaFila(varias && varias.dados && varias.dados.numero);
b.igual(anexos3 ? anexos3.length : 0, 4,
  "vão 4 anexos: o ofício + as 3 cartas");

/* ═══════════════════════════════════════════════════════════
   4. O corpo do e-mail guardado na fila é o da oposição
   ═══════════════════════════════════════════════════════════

   O e-mail que sai é o HTML gravado na fila. Se ali estiver o texto da
   cobrança, a escola recebe a ordem contrária junto com as cartas.
   ═══════════════════════════════════════════════════════════ */
b.passo("7");
function htmlDaFila(numero) {
  const sh = ss.getSheets().filter(s => /fila/i.test(s.getName()))[0];
  if (!sh || sh.getLastRow() < 2) return "";
  const h = g.getHeaderMap_(sh);
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][h["NUMERO_OFICIO"] - 1] || "").trim() === String(numero).trim()) {
      return String(dados[i][h["HTML_BODY"] - 1] || "");
    }
  }
  return "";
}
const corpo = htmlDaFila(numero).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
b.ok(/oposi(ç|c)(ã|a)o/i.test(corpo), "o corpo guardado fala em oposição");
b.ok(/n(ã|a)o seja realizado/i.test(corpo), "e manda NÃO descontar");
b.ok(!/tr(ê|e)s parcelas mensais e sucessivas/i.test(corpo),
  "e não é o texto da cobrança");

b.naoTestavel("Entrega pelo Gmail e aparência do anexo na caixa da escola",
  "o emulador registra o envio, não envia — só a emissão no sistema no ar prova isso");

b.resumo();
