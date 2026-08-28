// ================================================================
// 📄 ARQUIVO: PrevencaoDuplicata.gs
// 👉 AÇÃO: Criar NOVO arquivo no GAS
//          Clique no "+" ao lado de "Arquivos" → nomeie "PrevencaoDuplicata"
// ================================================================
//
// AVISO DE OFÍCIO REPETIDO NAS ÚLTIMAS 24 HORAS.
//
// Não bloqueia nada: a mesma escola pode legitimamente receber dois ofícios
// do mesmo tipo no mesmo dia (uma remessa nova de fichas, uma correção). O
// papel daqui é dar ao atendente informação suficiente para reconhecer, em
// dois segundos, se o ofício citado é o mesmo caso que ele está emitindo.
//
// CORREÇÃO DE 18/08/2026 — quatro defeitos medidos, não deduzidos.
// Estão cobertos por tests/e2e/t50-duplicata-oficio.js.
//
//  1. Citava o ofício MAIS ANTIGO da janela. A varredura devolvia na
//     primeira linha que casasse, e a planilha está em ordem de emissão.
//     Com 276, 277 e 278 emitidos no dia, o aviso falava do 276 enquanto o
//     próximo número era o 279 — foi exatamente o que o usuário viu na tela
//     e reportou ("Quando gera é o 279 tem erro nessa mensagem acima").
//     Agora devolve o mais recente e diz quantos são.
//
//  2. Filiação casava com Desfiliação. A comparação era por substring dos
//     8 primeiros caracteres, e a palavra "desfiliação" contém "filiação"
//     inteira. Agora o tipo passa por normalizarTipoOficio_ dos dois lados
//     e compara chave canônica.
//
//  3. Taxa Negocial casava com Oposição à Taxa Negocial, pelo mesmo motivo
//     ("taxa neg" está dentro de "oposição à taxa negocial").
//
//  4. Escola de nome parecido virava duplicata mesmo com CNPJ diferente. O
//     nome e o CNPJ eram testados em OU, então o nome vencia. Agora, quando
//     as duas linhas têm CNPJ, o CNPJ decide sozinho; o nome só entra como
//     âncora em registro antigo, gravado sem CNPJ.

function verificarDuplicata(params) {
  try {
    const ss    = SpreadsheetApp.openById(PLANILHA_ID);
    const sheet = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sheet || sheet.getLastRow() < 2) return { duplicata: false };

    const h         = getHeaderMap_(sheet);
    const colEscola = h["Escola (Razão Social)"];
    const colCnpj   = h["CNPJ"];
    const colTipo   = h["TIPO"] || h["Tipo"];
    const colData   = h["Data envio ofício"];
    const colNumero = h["Número do Ofício"];

    if (!colEscola || !colData) return { duplicata: false };

    const agora     = new Date();
    const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const dados     = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    const buscaEscola = duplicata_normalizarNome_(params.escola);
    const buscaCnpj   = String(params.cnpj || "").replace(/\D/g, "");
    const buscaTipo   = duplicata_chaveTipo_(params.tipo);

    const achados = [];

    for (let i = 0; i < dados.length; i++) {
      const linha     = dados[i];
      const escola    = duplicata_normalizarNome_(linha[colEscola - 1]);
      const cnpj      = String(colCnpj ? linha[colCnpj - 1] || "" : "").replace(/\D/g, "");
      const tipoBruto = String(colTipo ? linha[colTipo - 1] || "" : "");
      const dataEnvio = linha[colData - 1] ? new Date(linha[colData - 1]) : null;
      const numero    = colNumero ? String(linha[colNumero - 1] || "").trim() : "";

      if (!dataEnvio || isNaN(dataEnvio.getTime()) || dataEnvio < limite24h) continue;
      if (!duplicata_mesmaEscola_(buscaEscola, buscaCnpj, escola, cnpj)) continue;
      if (!duplicata_mesmoTipo_(buscaTipo, tipoBruto)) continue;

      achados.push({
        numero: numero,
        escola: String(linha[colEscola - 1] || "").trim(),
        tipo:   tipoBruto.trim(),
        data:   dataEnvio
      });
    }

    if (!achados.length) return { duplicata: false };

    // O atendente precisa reconhecer o que ACABOU de sair, não a primeira
    // emissão do dia. Ordena por data e devolve o topo.
    achados.sort(function(a, b) { return b.data.getTime() - a.data.getTime(); });
    const ultimo = achados[0];

    let dataFmt = "";
    try {
      dataFmt = Utilities.formatDate(ultimo.data, Session.getScriptTimeZone(), "dd/MM/yyyy 'às' HH:mm");
    } catch(e) { dataFmt = String(ultimo.data); }

    return {
      duplicata:       true,
      escola:          ultimo.escola,
      tipo:            ultimo.tipo,
      numeroExistente: ultimo.numero,
      dataExistente:   dataFmt,
      quantidade:      achados.length
    };
  } catch(e) {
    Logger.log("verificarDuplicata erro: " + e.message);
    return { duplicata: false };
  }
}

/** Nome de escola comparável: sem acento, sem pontuação, minúsculo. */
function duplicata_normalizarNome_(valor) {
  return String(valor || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Chave canônica do tipo. Usa normalizarTipoOficio_ (HelperOficios.gs), que
 * já sabe separar filiação de desfiliação e taxa negocial de oposição. Se o
 * tipo gravado não for reconhecido — registro antigo, texto livre — cai no
 * nome normalizado, que ao menos não confunde tipos diferentes.
 */
function duplicata_chaveTipo_(tipo) {
  const texto = String(tipo || "").trim();
  if (!texto) return "";
  try {
    const chave = normalizarTipoOficio_(texto);
    if (chave && chave !== "DESCONHECIDO") return chave;
  } catch(e) { /* HelperOficios ausente: segue pelo nome normalizado */ }
  return duplicata_normalizarNome_(texto);
}

/** Tipo em branco na busca significa "qualquer tipo" — comportamento antigo. */
function duplicata_mesmoTipo_(buscaTipo, tipoDaLinha) {
  if (!buscaTipo) return true;
  return duplicata_chaveTipo_(tipoDaLinha) === buscaTipo;
}

/**
 * Mesma escola. Regra em ordem de confiança:
 *   1. as duas linhas têm CNPJ  → só o CNPJ decide (nome parecido não conta);
 *   2. alguma delas sem CNPJ    → compara o nome normalizado, aceitando que
 *      um contenha o outro ("TESTE LTDA" x "TESTE"), com piso de 6 letras
 *      para o lado curto não virar coringa.
 */
function duplicata_mesmaEscola_(buscaEscola, buscaCnpj, escolaLinha, cnpjLinha) {
  if (buscaCnpj.length === 14 && cnpjLinha.length === 14) return buscaCnpj === cnpjLinha;
  if (!buscaEscola || !escolaLinha) return false;
  if (buscaEscola === escolaLinha) return true;

  const curto = buscaEscola.length <= escolaLinha.length ? buscaEscola : escolaLinha;
  const longo = curto === buscaEscola ? escolaLinha : buscaEscola;
  return curto.length >= 6 && longo.indexOf(curto) > -1;
}
