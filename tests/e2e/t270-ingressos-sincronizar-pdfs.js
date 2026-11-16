/**
 * PDFs DO ROBÔ → PASTA DA EQUIPE (15/11/2026). O robô baixa os PDFs para a pasta privada dele e anota em pdfs-estado.json;
 * o SISGEP copia os novos para INGRESSOS FESTA COMPASSO 2026 em lotes de 20, SEM tocar no que a equipe já salvou, com link
 * aberto, e informa ao robô (pdfs-existentes.json) quais nomes a pasta já tem. Pastas FALSAS (sem Drive); dados FICTÍCIOS.
 * NÃO PROVA: o Drive de verdade (makeCopy entre a pasta do robô e a da equipe usa a conta do Financeiro, dona das duas).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const compart = [], robo = {}, equipe = [], salvos = [];
const nomeDe = i => "TickOne - Pessoa " + i + ".pdf";
for (let i = 1; i <= 10; i++) equipe.push(nomeDe(i));   // a equipe JÁ salvou estes 10 à mão
equipe.push("anotacoes.txt");                            // e há outro arquivo qualquer na pasta
const feitos = {};
/* 25 ingressos que o robô marcou como "existente" (a equipe já os tinha com o nome escrito de outro jeito): NÃO têm arquivo no robô e vêm PRIMEIRO na lista — antes travavam o lote */
for (let i = 1; i <= 25; i++) feitos["EX-" + i] = { arquivo: "TickOne - Existente Acentuada " + i + ".pdf", existente: true };
for (let i = 1; i <= 45; i++) { feitos["TK-" + i] = { arquivo: nomeDe(i) }; if (i > 10) robo[nomeDe(i)] = "%PDF"; }
robo["pdfs-estado.json"] = JSON.stringify({ feitos });
robo["pdfs-existentes.json"] = "{}";   // o robô cria este arquivo vazio; o SISGEP só atualiza o conteúdo
g.cingPastaRobo_ = () => ({ getFilesByName: n => { const tem = n in robo; let usado = false; return { hasNext: () => tem && !usado, next: () => { usado = true; return { getBlob: () => ({ getDataAsString: () => robo[n] }), setContent: t => { robo[n] = t; salvos.push(n); }, makeCopy: (nome, pasta) => { pasta.__add(nome); return { setSharing: (a, p) => compart.push(nome + ":" + a + ":" + p) }; } }; } }; } });
const destino = { __add: n => equipe.push(n), getFiles: () => { let i = 0; return { hasNext: () => i < equipe.length, next: () => ({ getName: () => equipe[i++] }) }; } };
g.DriveApp = { getFolderById: () => destino, Access: { ANYONE_WITH_LINK: "ANYONE_WITH_LINK" }, Permission: { VIEW: "VIEW" } };
b.fluxo("PDFs · do robô para a pasta da equipe");
let r = g.compassoIngressos_sincronizarPdfs(TOKEN);
b.ok(r.ok && r.copiados === 20 && r.faltam === 15 && r.total === 45, "1º lote: os 10 que a equipe já tinha NÃO entram e os 25 'existentes' não travam; copia 20 e faltam 15", JSON.stringify(r));
let ex = JSON.parse(robo["pdfs-existentes.json"]);
b.ok(r.existentesAtualizado === true && ex.atualizadoEm && ex.nomes.length === 10 && ex.nomes.indexOf(nomeDe(3)) >= 0 && ex.nomes.indexOf("anotacoes.txt") < 0, "informa ao robô os 10 PDFs que a pasta já tinha (só .pdf)", String((ex.nomes || []).length));
r = g.compassoIngressos_sincronizarPdfs(TOKEN); b.ok(r.copiados === 15 && r.faltam === 0 && equipe.filter(n => /\.pdf$/.test(n)).length === 45 && !equipe.some(n => /Existente Acentuada/.test(n)), "2º lote: os 15 restantes; a pasta fica com 45 PDFs e nada dos 'existentes' foi copiado", JSON.stringify(r));
b.ok(compart.length === 35 && compart.every(x => /:ANYONE_WITH_LINK:VIEW$/.test(x)), "só os 35 copiados ganham link aberto (qualquer pessoa com o link, só ver); os da equipe ficam como estão");
r = g.compassoIngressos_sincronizarPdfs(TOKEN);
b.ok(r.copiados === 0 && r.faltam === 0 && JSON.parse(robo["pdfs-existentes.json"]).nomes.length === 45, "depois disso não copia nada de novo, e o robô passa a saber dos 45");
const n0 = salvos.length; g.compassoIngressos_sincronizarPdfs(TOKEN);
b.ok(salvos.length === n0, "sem mudança na pasta: não reescreve o arquivo do robô à toa");
delete robo["pdfs-estado.json"]; equipe.length = 0;
b.ok(g.compassoIngressos_sincronizarPdfs(TOKEN).copiados === 0, "sem o estado do robô: não faz nada");
delete robo["pdfs-existentes.json"]; b.ok(g.compassoIngressos_sincronizarPdfs(TOKEN).ok === true, "sem o arquivo de existentes (robô ainda não criou): segue sem erro");
b.ok(g.compassoIngressos_sincronizarPdfs("token-invalido").ok === false, "sem sessão válida, recusa");
b.resumo();
