/**
 * PDFs DO ROBÔ → PASTAS DA EQUIPE (15 e 16/11/2026). O robô baixa os PDFs para a pasta privada dele e anota em pdfs-estado.json;
 * o SISGEP copia os novos para INGRESSOS FESTA COMPASSO 2026 em lotes de 20, SEM tocar no que a equipe já salvou, com link aberto,
 * e informa ao robô (pdfs-existentes.json) quais nomes já existem. A equipe criou 3 SUBPASTAS por categoria (16/11/2026: "cada pasta
 * com seu ingresso"): o SISGEP varre raiz + subpastas e copia cada PDF novo para a subpasta da categoria dele. Pastas FALSAS
 * (sem Drive); dados FICTÍCIOS. NÃO PROVA: o Drive de verdade (makeCopy usa a conta do Financeiro, dona das pastas).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const compart = [], robo = {}, salvos = [];
let idSeq = 0;
function mkPasta(nome) {
  const p = { nome, arqs: [], subs: [] };
  p.getFiles = () => { let i = 0; return { hasNext: () => i < p.arqs.length, next: () => p.arqs[i++] }; };
  p.getFolders = () => { let i = 0; return { hasNext: () => i < p.subs.length, next: () => p.subs[i++] }; };
  p.getFoldersByName = n => { const r = p.subs.filter(s => s.nome === n); let i = 0; return { hasNext: () => i < r.length, next: () => r[i++] }; };
  p.__add = n => { const f = { getName: () => n, getId: () => "id" + (++idSeq), setSharing: (a, pe) => compart.push(n + ":" + a + ":" + pe) }; p.arqs.push(f); return f; };
  return p;
}
const raiz = mkPasta("INGRESSOS FESTA COMPASSO 2026"), sAss = mkPasta("INGRESSOS ASSOCIADOS"), sAco = mkPasta("INGRESSOS ACOMPANHANTES"), sCon = mkPasta("INGRESSOS CONVIDADOS");
raiz.subs.push(sAss, sAco, sCon); raiz.__add("Inscricoes_Festa_2026_Telefones.xlsx");
const nomeDe = i => "TickOne - Pessoa " + i + ".pdf";
const tipoDe = i => (i % 3 === 1 ? "Associado" : i % 3 === 2 ? "Acompanhante Associado" : "Convite");
for (let i = 1; i <= 10; i++) sAss.__add(nomeDe(i));   // a equipe JÁ salvou estes 10 à mão, DENTRO de uma subpasta
const feitos = {};
for (let i = 1; i <= 25; i++) feitos["EX-" + i] = { arquivo: "TickOne - Existente Acentuada " + i + ".pdf", existente: true };   // sem arquivo no robô; vêm PRIMEIRO (antes travavam o lote)
for (let i = 1; i <= 45; i++) { feitos["TK-" + i] = { arquivo: nomeDe(i) }; if (i > 10) robo[nomeDe(i)] = "%PDF"; }
robo["pdfs-estado.json"] = JSON.stringify({ feitos });
robo["pdfs-existentes.json"] = "{}";
g.cingLerBase_ = () => ({ lidoEm: new Date().toISOString(), linhas: Array.from({ length: 45 }, (_, k) => ({ codigo: "TK-" + (k + 1), tipo: tipoDe(k + 1), nome: "Pessoa " + (k + 1), cpf: "", tel: "", escola: "", cidade: "", ref: "" })) });
g.cingPastaRobo_ = () => ({ getFilesByName: n => { const tem = n in robo; let usado = false; return { hasNext: () => tem && !usado, next: () => { usado = true; return { getBlob: () => ({ getDataAsString: () => robo[n] }), setContent: t => { robo[n] = t; salvos.push(n); }, makeCopy: (nome, pasta) => pasta.__add(nome) }; } }; } });
g.DriveApp = { getFolderById: () => raiz, Access: { ANYONE_WITH_LINK: "ANYONE_WITH_LINK" }, Permission: { VIEW: "VIEW" } };
const todosPdfs = () => [raiz, sAss, sAco, sCon].reduce((a, p) => a.concat(p.arqs.map(f => f.getName()).filter(n => /\.pdf$/i.test(n))), []);
b.fluxo("PDFs · do robô para as pastas da equipe (com subpastas)");
let r = g.compassoIngressos_sincronizarPdfs(TOKEN);
b.ok(r.ok && r.copiados === 20 && r.faltam === 15 && r.total === 45, "1º lote: os 10 que a equipe já tinha (numa subpasta) NÃO entram, os 25 'existentes' não travam; copia 20 e faltam 15", JSON.stringify(r));
let ex = JSON.parse(robo["pdfs-existentes.json"]);
b.ok(r.existentesAtualizado === true && ex.atualizadoEm && ex.nomes.length === 10 && ex.nomes.indexOf(nomeDe(3)) >= 0 && ex.nomes.indexOf("Inscricoes_Festa_2026_Telefones.xlsx") < 0, "informa ao robô os 10 PDFs que a equipe já tinha, achados DENTRO da subpasta (só .pdf)", String((ex.nomes || []).length));
r = g.compassoIngressos_sincronizarPdfs(TOKEN); b.ok(r.copiados === 15 && r.faltam === 0 && todosPdfs().length === 45 && !todosPdfs().some(n => /Existente Acentuada/.test(n)), "2º lote: os 15 restantes; 45 PDFs no total e nada dos 'existentes' foi copiado", JSON.stringify(r));
const catDe = n => { const k = Number(n.match(/Pessoa (\d+)/)[1]); return k % 3; };
const copiados = pasta => pasta.arqs.filter(f => /Pessoa/.test(f.getName()) && Number(f.getName().match(/Pessoa (\d+)/)[1]) > 10);   // só o que o SISGEP copiou (os 10 primeiros são da equipe)
b.ok(copiados(sAss).length > 0 && copiados(sAss).every(f => catDe(f.getName()) === 1) && copiados(sAco).length > 0 && copiados(sAco).every(f => catDe(f.getName()) === 2) && copiados(sCon).length > 0 && copiados(sCon).every(f => catDe(f.getName()) === 0), "cada PDF novo foi para a SUBPASTA da categoria: Associado → ASSOCIADOS, Acompanhante → ACOMPANHANTES, Convite → CONVIDADOS");
b.ok(!raiz.arqs.some(f => /\.pdf$/i.test(f.getName())), "nenhum PDF foi parar na raiz");
b.ok(compart.length === 35 && compart.every(x => /:ANYONE_WITH_LINK:VIEW$/.test(x)), "só os 35 copiados ganham link aberto; os que a equipe salvou ficam como estão");
r = g.compassoIngressos_sincronizarPdfs(TOKEN);
b.ok(r.copiados === 0 && r.faltam === 0 && JSON.parse(robo["pdfs-existentes.json"]).nomes.length === 45, "depois disso não copia nada de novo, e o robô passa a saber dos 45");
const n0 = salvos.length; g.compassoIngressos_sincronizarPdfs(TOKEN);
b.ok(salvos.length === n0, "sem mudança nas pastas: não reescreve o arquivo do robô à toa");
b.fluxo("PDFs · o 📎 PDF da lista enxerga as subpastas");
g.CacheService.getScriptCache().remove("CING_PDFS_V2");
const mapa = g.cingPdfs_();
b.ok(mapa["pessoa 3"] && /\/file\/d\/id\d+\/view$/.test(mapa["pessoa 3"]) && mapa["pessoa 20"] && Object.keys(mapa).length === 45, "cingPdfs_ acha os PDFs que estão dentro das subpastas (a equipe separou por categoria)", String(Object.keys(mapa).length));
delete robo["pdfs-estado.json"]; [raiz, sAss, sAco, sCon].forEach(p => { p.arqs = []; });
b.ok(g.compassoIngressos_sincronizarPdfs(TOKEN).copiados === 0, "sem o estado do robô: não faz nada");
delete robo["pdfs-existentes.json"]; b.ok(g.compassoIngressos_sincronizarPdfs(TOKEN).ok === true, "sem o arquivo de existentes (robô ainda não criou): segue sem erro");
b.ok(g.compassoIngressos_sincronizarPdfs("token-invalido").ok === false, "sem sessão válida, recusa");
b.resumo();
