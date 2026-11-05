/**
 * ROBÔ DA MEMÓRIA GASTANDO MENOS IA (05/11/2026). O usuário: "Como fazer o
 * meu projeto gastar menos?" — e, mostrada a análise, "SIM".
 *
 * Backend real (MemoriaEvolutiva.gs + MemoriaCore.gs), Gmail e IA simulados,
 * dados FICTÍCIOS.
 *
 * Prova:
 *   - e-mail que o próprio SISGEP gerou (ofício, reenvio, voucher, recibo,
 *     [HML]) NÃO chama a IA e ganha a etiqueta de ignorado;
 *   - e-mail escrito à mão CHAMA a IA (o robô continua aprendendo);
 *   - o 2º e-mail da mesma categoria, sem nada novo, NÃO chama de novo
 *     (antes, "o dobro de palavras do resumo" deixava quase tudo passar);
 *   - com palavras-chave novas, chama;
 *   - o gatilho novo é 1 vez por dia, às 22h.
 * NÃO PROVA: a conta real da Anthropic (ver console → Usage depois de uns dias).
 */
const b = require("./base");
const { g } = b.subir({});

g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-ficticia");

/* Gmail simulado: as conversas de "Enviados" e as etiquetas que cada uma ganha. */
let conversas = [];
const etiquetas = {};
function conversa(assunto, corpo) {
  const c = { assunto, corpo, rotulos: [] };
  c.thread = {
    getMessages: () => [{ getSubject: () => assunto, getPlainBody: () => corpo, getTo: () => "escola@exemplo.com", getDate: () => new Date(2026, 10, 5) }],
    addLabel: l => { c.rotulos.push(l.nome); }
  };
  return c;
}
g.GmailApp.getUserLabelByName = n => etiquetas[n] || null;
g.GmailApp.createLabel = n => (etiquetas[n] = { nome: n });
g.GmailApp.search = () => conversas.filter(c => !c.rotulos.length).map(c => c.thread);

/* IA simulada: conta as chamadas e devolve um padrão válido. */
let chamadasIA = 0;
g.UrlFetchApp.fetch = function () {
  chamadasIA++;
  const padrao = { categoria: "X", saudacao: "Prezados", tom: "formal", resumo: "Prezados, solicita", expressoes_chave: [] };
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ text: JSON.stringify(padrao) }] }) };
};

const LONGO = " Texto de exemplo para passar do mínimo de oitenta caracteres do robô da memória, sem dado real nenhum.";

b.fluxo("ROBÔ DA MEMÓRIA · gastar menos IA");
b.passo("1. O que o SISGEP gera sozinho não vai para a IA");
const gerados = [
  conversa("Ofício de Filiação nº 123 — Escola Exemplo", "Prezados, Encaminhamos, em anexo, o Ofício de Filiação nº 123 acompanhado da ficha." + LONGO),
  conversa("Reenvio do ofício 123", "Prezados, Reenviamos o Ofício nº 123 porque, até o momento, não identificamos o desconto." + LONGO),
  conversa("Certificado de Bolsa de Estudo — protocolo 55", "Segue o certificado." + LONGO),
  conversa("Complementação de documentos — Maria Exemplo", "Faltam documentos." + LONGO),
  conversa("Recibo para assinatura — Nº 9", "Segue o recibo." + LONGO),
  conversa("[HML] Qualquer coisa", "Teste da homologação." + LONGO)
];
conversas = gerados.slice();
let r = g.memoriaEvolutivaGmail();
b.igual(chamadasIA, 0, "6 e-mails gerados pelo sistema: nenhuma chamada de IA");
b.ok(r.ok && r.ignorados === 6, "os 6 contam como ignorados", JSON.stringify(r));
b.ok(gerados.every(c => c.rotulos[0] === "SISGEP_Ignorado"), "e ganham a etiqueta de ignorado (não voltam na próxima rodada)");

b.passo("2. O que a pessoa escreve à mão continua sendo estudado");
const mao = conversa("Cobrança de mensalidade em atraso — Escola Exemplo", "Prezados, conforme conversamos, solicitamos a regularização da mensalidade." + LONGO);
conversas.push(mao);
r = g.memoriaEvolutivaGmail();
b.igual(chamadasIA, 1, "e-mail escrito à mão: 1 chamada de IA");
b.igual(mao.rotulos[0], "SISGEP_Aprendido", "e ganha a etiqueta de aprendido");

b.passo("3. O mesmo assunto de novo, sem nada novo: não chama de novo");
const repetido = conversa("Cobrança — outra escola", "Prezados, solicitamos de novo a regularização." + LONGO + LONGO + LONGO + LONGO);
conversas.push(repetido);
g.memoriaEvolutivaGmail();
b.igual(chamadasIA, 1, "2º e-mail de COBRANÇA, bem mais longo que o resumo, sem palavra-chave nova: nenhuma chamada a mais");
b.igual(repetido.rotulos[0], "SISGEP_Ignorado", "fica como ignorado");
const novo = conversa("Cobrança com cláusula", "Prezados, solicitamos, nos termos da clausula 38, a mensalidade em cobranca. Atenciosamente." + LONGO);
conversas.push(novo);
g.memoriaEvolutivaGmail();
b.igual(chamadasIA, 2, "com palavras-chave novas (cláusula, mensalidade, atenciosamente): chama");

b.passo("4. O gatilho passa a 1 vez por dia");
/* Espia a montagem do gatilho (o emulador não expõe o detalhe). */
const det = {};
const novoOrig = g.ScriptApp.newTrigger;
g.ScriptApp.newTrigger = function (fn) {
  const spec = novoOrig(fn), tbOrig = spec.timeBased;
  spec.timeBased = function () {
    const tb = tbOrig();
    ["everyMinutes", "everyHours", "everyDays", "atHour"].forEach(k => {
      const f = tb[k]; tb[k] = n => { if (fn === "memoriaEvolutivaGmail") det[k] = n; return f(n); };
    });
    return tb;
  };
  return spec;
};
g.configurarTriggerMemoriaEvolutiva();
g.configurarTriggerMemoriaEvolutiva();   // de novo: não pode duplicar
const gat = g.ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "memoriaEvolutivaGmail");
b.igual(gat.length, 1, "um gatilho só, mesmo configurando duas vezes");
det.dias = det.everyDays; det.hora = det.atHour;
b.ok(!det.everyHours, "não é mais de 6 em 6 horas");
b.ok(det.dias === 1 && det.hora === 22, "1 vez por dia, às 22h", JSON.stringify(det));

b.naoTestavel("a conta real", "ver console.anthropic.com → Usage alguns dias depois de publicar");
b.resumo();
