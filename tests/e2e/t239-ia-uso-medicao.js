/**
 * MEDIÇÃO DE USO DA IA (05/11/2026). Auditoria de custo, etapa 1 — o usuário:
 * "Faça". Toda chamada à Anthropic passa por iaFetch_ (IAUso.gs) e deixa uma
 * linha na aba IA_Uso: módulo, modelo, tokens, tempo, HTTP, custo estimado.
 *
 * Backend real, IA simulada, dados FICTÍCIOS.
 * Prova:
 *   - nenhum arquivo .gs chama a API da Anthropic por fora do iaFetch_;
 *   - a linha guarda tokens (inclusive cache gravado/lido), custo e módulo;
 *   - a linha NÃO guarda o texto da pergunta nem da resposta (LGPD);
 *   - se a planilha falhar, a chamada segue com a mesma resposta;
 *   - a Sofia e a Caixa anotam com o nome certo;
 *   - o resumo soma por módulo, e só administrador vê.
 * NÃO PROVA: os números reais da Anthropic (só no ar).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson"), OUTRO = b.logar(g, "joscimar");

b.fluxo("IA_USO · medição de cada chamada");
b.passo("1. Ninguém chama a Anthropic por fora");
const raiz = path.join(__dirname, "..", "..");
const fora = fs.readdirSync(raiz).filter(f => f.endsWith(".gs") && f !== "IAUso.gs")
  .filter(f => /UrlFetchApp\.fetch\(\s*["']https:\/\/api\.anthropic\.com/.test(fs.readFileSync(path.join(raiz, f), "utf8")));
b.igual(fora, [], "todo .gs usa iaFetch_ para falar com a IA");

b.passo("2. A linha da chamada");
let resposta = { content: [{ text: "SEGREDO-DA-RESPOSTA" }], usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 300, cache_read_input_tokens: 4000 } };
g.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(resposta) }) };
const r = g.iaFetch_("teste", { payload: JSON.stringify({ model: "claude-haiku-4-5-20251001", messages: [{ role: "user", content: "SEGREDO-DA-PERGUNTA" }] }) });
b.ok(JSON.parse(r.getContentText()).content[0].text === "SEGREDO-DA-RESPOSTA", "a resposta volta igual");
const aba = () => g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName("IA_Uso").getDataRange().getValues();
let v = aba();
b.igual(v[0], ["DATA", "MODULO", "MODELO", "ENTRADA", "SAIDA", "CACHE_GRAVADO", "CACHE_LIDO", "MS", "HTTP", "CUSTO_USD"], "cabeçalho da aba IA_Uso");
const l = v[1];
b.igual([l[1], l[2], l[3], l[4], l[5], l[6], l[8]], ["teste", "claude-haiku-4-5-20251001", 1000, 200, 300, 4000, 200], "módulo, modelo, tokens e HTTP");
/* 1000×1 + 200×5 + 300×1,25 + 4000×0,10 = 2.775 por milhão */
b.igual(l[9], 0.002775, "custo estimado pela tabela do Haiku 4.5");
b.ok(!JSON.stringify(v).includes("SEGREDO"), "nem pergunta nem resposta vão para a planilha");

b.passo("3. Se a planilha falhar, a chamada não cai");
const abrir = g.SpreadsheetApp.openById;
g.SpreadsheetApp.openById = () => { throw new Error("planilha fora do ar"); };
let ok = false;
try { ok = JSON.parse(g.iaFetch_("teste", { payload: "{}" }).getContentText()).content[0].text === "SEGREDO-DA-RESPOSTA"; } catch (e) {}
g.SpreadsheetApp.openById = abrir;
b.ok(ok, "planilha fora do ar: a resposta da IA chega do mesmo jeito");

b.passo("4. Os módulos se identificam");
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "x");
resposta = { content: [{ text: "Pode votar quem está em dia." }], usage: { input_tokens: 20000, output_tokens: 300 } };
g.chatSISGEP({ mensagem: "quem pode votar na assembleia?", dominio: "Geral", historico: [] }, ADM);
resposta = { content: [{ text: '{"ok":true}' }], usage: { input_tokens: 500, output_tokens: 50 } };
g.vpeChamarIA_("teste", null, "caixa-categorizar");
g.vpeChamarIA_("teste");
const mods = aba().slice(1).map(x => x[1]);
b.ok(mods.includes("sofia") && mods.includes("caixa-categorizar") && mods.includes("voucher-pedidos"), "sofia, caixa-categorizar e (sem nome) voucher-pedidos", mods.join(","));

b.passo("5. O resumo por módulo");
const res = g.iaUsoResumo(ADM, 30);
b.ok(res.ok && res.modulos[0].modulo === "sofia" && res.modulos[0].chamadas === 1, "a Sofia aparece primeiro (a mais cara)", JSON.stringify(res).slice(0, 200));
b.ok(res.modulos.every(m => typeof m.msP95 === "number"), "com tempo médio e P95 por módulo");
const neg = g.iaUsoResumo(OUTRO, 30);
b.ok(!neg.ok, "quem não é administrador não vê", neg.mensagem);

b.naoTestavel("os números reais", "conferir a aba IA_Uso no ar depois de alguns usos");
b.resumo();
