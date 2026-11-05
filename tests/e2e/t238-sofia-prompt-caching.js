/**
 * SOFIA COM PROMPT CACHING (05/11/2026). O usuário: "Como fazer o meu projeto
 * gastar menos?" → "Sofia não gasta?" → "Clarooo".
 *
 * Backend real (ChatIACore.gs), IA simulada, dados FICTÍCIOS.
 *
 * Prova:
 *   - o prompt de sistema vai em blocos: o 1º (regras + Estatuto/CCT) com
 *     cache_control, o 2º (memória, dados, data) sem;
 *   - a marca interna nunca chega à IA;
 *   - duas perguntas DIFERENTES sobre o Estatuto mandam o MESMO 1º bloco
 *     (é isso que faz a 2ª pagar ~10%) e 2º blocos diferentes;
 *   - a segunda leitura também vai com o bloco fixo em cache;
 *   - nada do conteúdo se perdeu: juntando os blocos, o texto é o de antes.
 * NÃO PROVA: o desconto de verdade — a Anthropic devolve
 * cache_read_input_tokens no uso; conferir no console → Usage.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "sk-teste");

const enviados = [];
function encenar(respostas) {
  let n = 0;
  g.UrlFetchApp = {
    fetch(url, opts) {
      enviados.push(JSON.parse(opts.payload));
      const t = respostas[n++] || respostas[respostas.length - 1];
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ text: t }] }) };
    }
  };
}

b.fluxo("SOFIA · cache DESLIGADO por padrão (05/11/2026)");
b.passo("0. Sem a chave SOFIA_CACHE: o texto de sempre, sem cache");
encenar(["ok"]);
g.chatSISGEP({ mensagem: "quem pode participar da votação na assembleia?", dominio: "Geral", historico: [] }, TOKEN);
const s0 = enviados[0].system;
b.ok(Array.isArray(s0) && s0.length === 1 && !s0[0].cache_control, "um bloco só, sem cache_control");
b.ok(/=== ESTATUTO —/.test(s0[0].text) && /DADOS REAIS DO SISTEMA/.test(s0[0].text) && !s0[0].text.includes("SISGEP_FIM_DA_PARTE_FIXA"), "o prompt inteiro, sem a marca");
enviados.length = 0;
g.PropertiesService.getScriptProperties().setProperty("SOFIA_CACHE", "SIM");

b.fluxo("SOFIA · prompt caching");
b.passo("1. Uma pergunta sobre o Estatuto");
encenar(["Podem votar os associados em dia."]);
let r = g.chatSISGEP({ mensagem: "quem pode participar da votação na assembleia?", dominio: "Geral", historico: [] }, TOKEN);
b.ok(r && r.ok, "a Sofia respondeu", JSON.stringify(r).slice(0, 200));
const s1 = enviados[0].system;
b.ok(Array.isArray(s1) && s1.length === 2, "o system vai em 2 blocos", typeof s1);
b.ok(s1[0].cache_control && s1[0].cache_control.type === "ephemeral" && !s1[1].cache_control, "o 1º com cache, o 2º sem");
b.ok(/=== ESTATUTO —/.test(s1[0].text) && /Você é o assistente de IA do SISGEP/.test(s1[0].text), "o 1º bloco tem as regras e o Estatuto");
b.ok(/DADOS REAIS DO SISTEMA/.test(s1[1].text) && !/DADOS REAIS DO SISTEMA/.test(s1[0].text), "os dados do dia ficam no 2º, fora do cache");
b.ok(!JSON.stringify(enviados[0]).includes("SISGEP_FIM_DA_PARTE_FIXA"), "a marca interna não chega à IA");
b.ok(s1[0].text.length > 60000, "o bloco fixo é grande (é onde está o gasto): " + s1[0].text.length + " caracteres");

b.passo("2. Outra pergunta, outra pessoa no assunto: o bloco fixo é o MESMO");
encenar(["O mandato da diretoria é de 4 anos."]);
g.chatSISGEP({ mensagem: "qual é o mandato da diretoria?", dominio: "Geral", historico: [] }, TOKEN);
const s2 = enviados[1].system;
b.ok(s2[0].text === s1[0].text, "1º bloco idêntico entre perguntas diferentes (a IA reaproveita o cache)");

b.passo("3. Pergunta sem Estatuto: um bloco fixo menor, ainda separado");
encenar(["Temos associados cadastrados."]);
g.chatSISGEP({ mensagem: "quantos associados temos?", dominio: "Geral", historico: [] }, TOKEN);
const s3 = enviados[2].system;
b.ok(Array.isArray(s3) && s3[0].cache_control && !/=== ESTATUTO —/.test(s3[0].text), "sem o Estatuto, o bloco fixo só tem as regras");

b.passo("4. A função de blocos");
const sem = g.chatSistemaEmBlocos_("prompt sem marca");  // (com a chave ligada)
b.ok(sem.length === 1 && !sem[0].cache_control && sem[0].text === "prompt sem marca", "sem a marca: um bloco só, sem cache (como antes)");
const com = g.chatSistemaEmBlocos_("FIXO" + g.CHAT_MARCA_CACHE_ + "VARIAVEL");
b.igual(com.map(x => x.text), ["FIXO", "VARIAVEL"], "com a marca: corta exatamente nela");

b.naoTestavel("o desconto na conta", "console.anthropic.com → Usage: procurar 'cache read' depois de usar a Sofia");
b.resumo();
