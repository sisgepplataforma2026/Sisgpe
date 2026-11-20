/**
 * t130 — A TRAVA CONTRA A REGRESSÃO QUE EU MESMO CAUSEI
 *
 * 01/09/2026. Este teste existe por causa de um erro meu, cometido hoje.
 *
 * O QUE ACONTECEU
 *
 * Ao fechar as funções abertas do Módulo 03, pus porta de módulo no
 * `processarFichasParaOficio`. Atualizei os chamadores das TELAS e não vi um
 * chamador interno, em `.gs`: o `gerarOficioWebComFichas` (OficioService.gs)
 * chamava `processarFichasParaOficio(dados.fichas)` sem passar token.
 *
 * Resultado: TODO ofício com ficha anexada passou a morrer lá dentro, com
 * "Sessão inválida" engolido pelo catch e devolvido como `{erro: true}`. É o
 * caminho do ofício de filiação com a ficha assinada — a operação viva do
 * sindicato. A porta que eu pus para proteger o dado quebrou o uso legítimo.
 *
 * POR QUE PASSOU DESPERCEBIDO
 *
 * A suíte inteira ficou VERDE. Nenhum teste exercitava esse caminho, e o
 * `catch` transformava a exceção em `{erro: true}` — que ninguém checava. É a
 * assinatura do defeito que este projeto mais encontra: o sistema deixa de
 * funcionar sem que nada dê erro à vista.
 *
 * O QUE ESTE TESTE FAZ
 *
 * Varre TODO o código de servidor procurando chamada de função com porta
 * feita a partir de outro `.gs` sem passar token. Não é sobre estas funções:
 * é sobre a classe inteira de erro. Se eu (ou qualquer um) puser porta numa
 * função e esquecer um chamador interno, o teste fica vermelho ANTES de o
 * arquivo sair daqui.
 *
 * O CASO LEGÍTIMO QUE A VARREDURA PRECISA ACEITAR
 *
 * `CentralEmailIA.gs` chama `listarHistoricoOficios` de dentro de um helper
 * privado que não tem token, e os chamadores DELE também não têm — são as
 * funções `*_CentralLegacy`. Ali a chamada está dentro de try/catch que
 * degrada com aviso ("Não foi possível consultar..."), e dar token a elas é
 * mudança maior que esta rodada carrega. Fica na lista de exceções ABAIXO,
 * declarada com motivo — que é diferente de ficar despercebida.
 */

const b = require("./base");
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");

/* As funções com porta que outros .gs chamam por dentro. */
const COM_PORTA = [
  "processarFichasParaOficio", "buscarEscolasParaOficio", "listarEscolasOficios",
  "consultarEscolaDashboardOficios", "diagnosticarDeParaEscolas",
  "getTemplateConteudo", "gerarOficioWeb", "gerarOficioWebComFichas",
  "previewOficioWeb", "getDashboardOficiosData", "listarHistoricoOficios",
  "listarStatusOficios", "atualizarStatusOficio", "dashboardFilaEnvioResumo",
  "dashboardFilaEnvioGraficos", "dashboardFilaEnvioErrosRecentes",
  "dashboardFilaPendenciasCriticas"
];

/* Exceções declaradas: chamada sem token que fica, COM motivo escrito. */
const TOLERADAS = {
  "CentralEmailIA.gs:listarHistoricoOficios":
    "helper privado buscarContextoEscolaSisgep_ chamado pelas funções " +
    "*_CentralLegacy, que não têm token. A chamada está em try/catch que " +
    "degrada com aviso visível ao usuário. Dar token às legadas é mudança " +
    "maior; fica declarada em vez de despercebida"
};

const arquivos = fs.readdirSync(RAIZ).filter(f => f.endsWith(".gs"));

b.fluxo("TODO O SISTEMA · porta posta, token esquecido");

b.passo("1. nenhuma chamada interna de função com porta sem passar token");
const achados = [];
arquivos.forEach(function (arq) {
  const linhas = fs.readFileSync(path.join(RAIZ, arq), "utf8").split("\n");
  linhas.forEach(function (linha, i) {
    const t = linha.trim();
    if (t.indexOf("//") === 0 || t.indexOf("*") === 0) return;
    COM_PORTA.forEach(function (nome) {
      if (!new RegExp("[^_a-zA-Z0-9.]" + nome + "\\s*\\(").test(linha)) return;
      if (new RegExp("function\\s+" + nome).test(linha)) return;
      /* A chamada pode abrir um objeto e fechar linhas abaixo — olha adiante
         até o fecho, senão toda chamada multilinha viraria falso positivo. */
      let trecho = linha, k = i;
      while (k + 1 < linhas.length && !/\)\s*;?\s*$/.test(trecho.trim()) &&
             k - i < 40) {
        k++; trecho += "\n" + linhas[k];
      }
      if (/token|Token|TOKEN/.test(trecho)) return;
      if (TOLERADAS[arq + ":" + nome]) return;
      achados.push(arq + ":" + (i + 1) + "  " + nome);
    });
  });
});
b.igual(achados, [], "nenhuma chamada interna perdeu o token");

b.passo("2. as exceções continuam sendo as declaradas — nem mais, nem outras");
/* Exceção que ninguém revisa vira buraco permanente. Este passo garante que a
   lista não cresça em silêncio. */
b.igual(Object.keys(TOLERADAS).length, 1,
  "uma exceção declarada, com motivo escrito");
b.ok(String(TOLERADAS["CentralEmailIA.gs:listarHistoricoOficios"]).length > 80,
  "e o motivo é escrito por extenso, não uma etiqueta");

b.fluxo("TODO O SISTEMA · a regressão específica, travada pelo comportamento");

b.passo("3. E O TESTE QUE FALTAVA — ofício COM ficha anexada funciona");
/* O passo 1 pega o padrão lendo o código; este pega o efeito rodando. Os dois
   juntos porque um pega o erro que eu não escrevi ainda, e o outro o que eu
   escrevi de um jeito que a varredura não enxerga. */
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let ctrl = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (!ctrl) ctrl = ss.insertSheet(g.PLANILHA_REGISTRO);
ctrl.getRange(1, 1, 1, 10).setValues([[
  "Número do Ofício", "Data", "TIPO", "Escola", "CNPJ", "E-mail",
  "Status", "CONFIG", "Observações", "Link"]]);

const comFicha = g.gerarOficioWebComFichas({
  tipo: "FILIACAO",
  escola: "Modelo Educacional LTDA",
  cnpj: "12345678000199",
  email: "secretaria@modelo.com",
  colaboradores: ["Maria Aparecida Souza"],
  cpfs: ["11144477735"],
  fichas: [{ base64: "Y29udGV1ZG8=", nome: "ficha-assinada.pdf" }],
  confirmarDuplicata: true
}, ADM);

b.ok(comFicha && !comFicha.erro,
  "gerarOficioWebComFichas gera o ofício com a ficha anexada",
  comFicha && comFicha.erro ? "ERRO: " + comFicha.mensagem : "gerou");
b.ok(!/sess[ãa]o inv[áa]lida/i.test(String(comFicha && comFicha.mensagem || "")),
  "e não morre em 'Sessão inválida' por token que não desceu",
  String(comFicha && comFicha.mensagem || "(sem mensagem de erro)").substring(0, 46));
b.ok(!!(comFicha && comFicha.dados && comFicha.dados.numero),
  "e sai com número de ofício",
  comFicha && comFicha.dados ? String(comFicha.dados.numero) : "(sem número)");

b.passo("4. e a ficha anexada realmente foi processada, não descartada");
/* Gerar o ofício sem o anexo seria a mesma falha com outra cara: a escola
   receberia o ofício sem a ficha que ele diz encaminhar. */
const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
const linhasFila = fila ? fila.getDataRange().getValues() : [];
const cab = linhasFila.length ? linhasFila[0] : [];
const colNum = cab.indexOf("NUMERO_OFICIO");
const colAnexos = cab.indexOf("ANEXOS_JSON");
const numero = comFicha && comFicha.dados ? String(comFicha.dados.numero) : "";
const naFila = linhasFila.slice(1).filter(
  l => String(l[colNum] || "").trim() === numero);
b.igual(naFila.length, 1, "o ofício com ficha entrou na fila de envio");

/* DOIS anexos: o PDF do ofício E a ficha assinada. Um só significaria que a
   ficha foi descartada no caminho — a escola receberia o ofício dizendo que
   encaminha a ficha, sem a ficha. É a mesma forma do defeito do reenvio, que
   levava o ofício e deixava a carta para trás. */
let anexos = [];
try { anexos = JSON.parse(String(naFila[0][colAnexos] || "[]")); } catch (e) {}
b.igual(anexos.length, 2, "a fila leva DOIS anexos, não um");
b.ok(anexos.some(a => /ficha/i.test(String(a && a.nome || ""))),
  "e um deles é a ficha, que é o que o token esquecido descartava",
  anexos.map(a => String(a && a.nome || "?").substring(0, 26)).join(" + "));

b.naoTestavel(
  "se o PDF anexado abre na caixa de quem recebe",
  "o emulador registra o envio e o conteúdo em base64, mas não gera PDF nem " +
  "entrega e-mail. O que se prova aqui é que o anexo atravessa o caminho " +
  "inteiro sem ser descartado"
);

b.resumo();
