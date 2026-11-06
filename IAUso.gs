/* ================================================================
   IAUso.gs — QUANTO CADA CHAMADA DE IA GASTA (05/11/2026)

   Pedido do usuário, na auditoria de custo de IA: "Faça" (etapa 1 —
   medição). Até aqui a Anthropic devolvia em cada resposta quantos
   tokens a chamada usou (entrada, saída, cache gravado, cache lido) e o
   SISGEP jogava isso fora. Sem esse número não existe "custo por
   módulo" — toda economia era estimativa.

   Toda chamada à API da Anthropic passa por iaFetch_(modulo, opcoes):
   faz a MESMA chamada de antes e, depois, anota uma linha na aba IA_Uso.
   A anotação nunca derruba a chamada: se a planilha falhar, a resposta
   segue igual e só a linha se perde.

   O que fica na linha: quando, módulo, modelo, tokens (entrada, saída,
   cache gravado, cache lido), tempo em ms, código HTTP e o custo
   estimado em dólar pela tabela do Haiku 4.5. NÃO fica: o texto da
   pergunta nem da resposta (pode ter dado pessoal — LGPD).
   ================================================================ */

var IA_USO_ABA = "IA_Uso";
var IA_USO_URL = "https://api.anthropic.com/v1/messages";
/* US$ por milhão de tokens — Claude Haiku 4.5 (o único modelo do sistema).
   Se um dia entrar outro modelo, a coluna MODELO diz qual foi; o custo
   desta coluna é a conta pelo Haiku. */
var IA_USO_PRECO = { entrada: 1.0, saida: 5.0, cacheGrava: 1.25, cacheLe: 0.10 };
var IA_USO_CAB = ["DATA", "MODULO", "MODELO", "ENTRADA", "SAIDA", "CACHE_GRAVADO", "CACHE_LIDO",
                  "MS", "HTTP", "CUSTO_USD"];

/** A chamada à Anthropic, medida. Devolve a resposta do UrlFetchApp como sempre. */
function iaFetch_(modulo, opcoes) {
  var t0 = Date.now();
  var resp = UrlFetchApp.fetch(IA_USO_URL, opcoes);
  try { iaUsoAnotar_(modulo, opcoes, resp, Date.now() - t0); } catch (e) {}
  return resp;
}

function iaUsoAnotar_(modulo, opcoes, resp, ms) {
  var modelo = "";
  try { modelo = String(JSON.parse(String((opcoes && opcoes.payload) || "{}")).model || ""); } catch (e) {}
  var codigo = 0, u = {};
  try { codigo = resp.getResponseCode(); } catch (e) {}
  try { u = (JSON.parse(resp.getContentText() || "{}").usage) || {}; } catch (e) {}
  var ent = Number(u.input_tokens) || 0, sai = Number(u.output_tokens) || 0,
      grava = Number(u.cache_creation_input_tokens) || 0, le = Number(u.cache_read_input_tokens) || 0;
  var custo = (ent * IA_USO_PRECO.entrada + sai * IA_USO_PRECO.saida +
               grava * IA_USO_PRECO.cacheGrava + le * IA_USO_PRECO.cacheLe) / 1e6;
  var sh = iaUsoAba_();
  sh.appendRow([new Date(), String(modulo || "?"), modelo, ent, sai, grava, le, ms, codigo,
                Math.round(custo * 1e6) / 1e6]);
}

function iaUsoAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(IA_USO_ABA);
  if (!sh) { sh = ss.insertSheet(IA_USO_ABA); sh.appendRow(IA_USO_CAB); sh.setFrozenRows(1); }
  return sh;
}

/** Resumo por módulo (para o administrador): chamadas, tokens, custo e tempo. */
function iaUsoResumo(tokenSessao, dias) {
  /* Só administrador pelo SISGEP; sem token, só o dono do projeto no editor. */
  try { exigirAdminOuSessao_(tokenSessao, "financeiro", "iaUsoResumo", true); }
  catch (e) { return { ok: false, mensagem: e.message }; }
  var desde = Date.now() - (Number(dias) || 30) * 864e5;
  var v = iaUsoAba_().getDataRange().getValues().slice(1);
  var por = {};
  v.forEach(function (l) {
    if (!(l[0] instanceof Date) || l[0].getTime() < desde) return;
    var m = String(l[1]), p = por[m] || (por[m] = { modulo: m, chamadas: 0, entrada: 0, saida: 0, cacheLido: 0, custo: 0, ms: [] });
    p.chamadas++; p.entrada += Number(l[3]) || 0; p.saida += Number(l[4]) || 0;
    p.cacheLido += Number(l[6]) || 0; p.custo += Number(l[9]) || 0; p.ms.push(Number(l[7]) || 0);
  });
  var lista = Object.keys(por).map(function (k) {
    var p = por[k], ms = p.ms.sort(function (a, b) { return a - b; });
    var pct = function (q) { return ms.length ? ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] : 0; };
    return { modulo: p.modulo, chamadas: p.chamadas, entrada: p.entrada, saida: p.saida, cacheLido: p.cacheLido,
             custoUsd: Math.round(p.custo * 10000) / 10000,
             msMedio: ms.length ? Math.round(ms.reduce(function (a, b) { return a + b; }, 0) / ms.length) : 0,
             msP95: pct(0.95) };
  }).sort(function (a, b) { return b.custoUsd - a.custoUsd; });
  return { ok: true, dias: Number(dias) || 30, modulos: lista,
           totalUsd: Math.round(lista.reduce(function (s, x) { return s + x.custoUsd; }, 0) * 10000) / 10000 };
}
