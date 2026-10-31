/**
 * TESTE — ENVIO IMEDIATO USA O ID ÚNICO DA FILA
 *
 * Reproduz o incidente real da Homologação: dois registros podem ter o mesmo
 * NUMERO_OFICIO depois de importar histórico de Produção e gerar um novo
 * ofício em HML. O botão precisa enviar a linha recém-gerada pelo filaId,
 * nunca adivinhar apenas pelo número.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;
const outbox = r.amb.outbox;
const fs = require("fs");
const path = require("path");

b.fluxo("FILA · ID único vence número duplicado");

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

function emitir(email, nome) {
  return g.gerarOficioWeb({
    tipo: "Oposição à Taxa Negocial",
    escola: "COLEGIO EXEMPLO LTDA",
    cnpj: "36136001000105",
    email: email,
    colaboradores: [{ nome: nome }],
    fichas: [],
    confirmarDuplicata: true
  }, token);
}

const antigo = emitir("antigo@colegioexemplo.com.br", "REGISTRO ANTIGO");
const novo = emitir("novo@colegioexemplo.com.br", "REGISTRO NOVO");

b.ok(antigo && antigo.dados && antigo.dados.filaId, "primeira emissão devolve filaId");
b.ok(novo && novo.dados && novo.dados.filaId, "segunda emissão devolve filaId");

const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
const hm = g.getHeaderMap_(fila);
const dados = fila.getRange(2, 1, fila.getLastRow() - 1, fila.getLastColumn()).getValues();
let linhaAntiga = -1, linhaNova = -1;
for (let i = 0; i < dados.length; i++) {
  const id = String(dados[i][hm.ID - 1] || "");
  if (id === String(antigo.dados.filaId)) linhaAntiga = i + 2;
  if (id === String(novo.dados.filaId)) linhaNova = i + 2;
}

b.ok(linhaAntiga > 1 && linhaNova > 1, "as duas linhas foram encontradas pelo ID");

// Força a colisão de número que ocorreu na HML real.
fila.getRange(linhaNova, hm.NUMERO_OFICIO).setValue(antigo.dados.numero);

outbox.length = 0;
const envio = g.enviarOficioDaFilaAgora(antigo.dados.numero, token, novo.dados.filaId);

b.ok(envio && envio.ok === true, "envio por filaId é aceito", envio && envio.mensagem);
b.igual(outbox.length, 1, "somente um e-mail é enviado");
b.ok(String((outbox[0] || {}).to || "").indexOf("novo@colegioexemplo.com.br") > -1,
  "o destinatário é o registro NOVO indicado pelo filaId",
  String((outbox[0] || {}).to || ""));

const statusAntigo = String(fila.getRange(linhaAntiga, hm.STATUS).getValue() || "").toUpperCase();
const statusNovo = String(fila.getRange(linhaNova, hm.STATUS).getValue() || "").toUpperCase();
/* Em 02/09/2026 a fila passou a nascer AGUARDANDO_DESTINATARIOS, e não mais
   PENDENTE: os destinatários são conferidos entre emitir e enviar. A asserção
   aqui nunca foi sobre o nome do status — é sobre a linha antiga NÃO SER
   TOCADA quando o envio é endereçado por filaId. Ela passa a medir isso pelo
   estado em que a linha nasce, que é o que "não tocada" significa. */
b.igual(statusAntigo, g.OFDEST_STATUS_AGUARDANDO,
  "registro antigo com mesmo número não é tocado — continua como nasceu");
b.igual(statusNovo, "ENVIADO", "registro indicado pelo filaId vira ENVIADO");

b.fluxo("TELA · filaId chega ao backend");
const fonte = fs.readFileSync(path.join(__dirname, "..", "..", "OficiosScripts.html"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

b.ok(/var\s+filaId\s*=\s*dadosGerados\.filaId/.test(fonte),
  "a tela lê filaId retornado pela geração");
b.ok(/enviarEmailOficioAgora\([^,]+,\s*[^)]+filaId/.test(fonte),
  "o botão de envio recebe filaId");
b.ok(/\.enviarOficioDaFilaAgora\(numero,\s*SISGEP_TOKEN_SESSAO,\s*filaId/.test(fonte),
  "a chamada ao backend envia número + token + filaId");

b.resumo();
