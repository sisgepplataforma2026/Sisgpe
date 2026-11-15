/**
 * PDFs DO ROBÔ → PASTA DA EQUIPE (15/11/2026). O robô baixa os PDFs para a pasta privada dele e anota em pdfs-estado.json;
 * o SISGEP copia os novos para INGRESSOS FESTA COMPASSO 2026 em lotes de 20, sem copiar de novo, e a lista passa a mostrar
 * "📎 PDF". Pasta do robô e pasta da equipe FALSAS (sem Drive); dados FICTÍCIOS. NÃO PROVA: o Drive de verdade (makeCopy
 * entre a pasta do robô e a da equipe usa a conta do Financeiro, dona das duas).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const compart = [], robo = {}, equipe = [];   // robo: nome → conteúdo; equipe: lista de nomes na pasta de destino
const feitos = {}; for (let i = 1; i <= 45; i++) { const nome = "TickOne - Pessoa " + i + ".pdf"; feitos["TK-" + i] = { arquivo: nome }; robo[nome] = "%PDF"; }
robo["pdfs-estado.json"] = JSON.stringify({ feitos });
g.cingPastaRobo_ = () => ({ getFilesByName: n => { const tem = n in robo; let usado = false; return { hasNext: () => tem && !usado, next: () => { usado = true; return { getBlob: () => ({ getDataAsString: () => robo[n] }), makeCopy: (nome, pasta) => { pasta.__add(nome); return { setSharing: (a, p) => compart.push(nome + ":" + a + ":" + p) }; } }; } }; } });
const destino = { __add: n => equipe.push(n), getFiles: () => { let i = 0; return { hasNext: () => i < equipe.length, next: () => ({ getName: () => equipe[i++] }) }; } };
g.DriveApp = { getFolderById: () => destino, Access: { ANYONE_WITH_LINK: "ANYONE_WITH_LINK" }, Permission: { VIEW: "VIEW" } };
b.fluxo("PDFs · do robô para a pasta da equipe");
let r = g.compassoIngressos_sincronizarPdfs(TOKEN);
b.ok(r.ok && r.copiados === 20 && r.faltam === 25 && r.total === 45, "1º lote: copia 20 e diz que faltam 25", JSON.stringify(r));
r = g.compassoIngressos_sincronizarPdfs(TOKEN); b.ok(r.copiados === 20 && r.faltam === 5, "2º lote: mais 20", JSON.stringify(r));
r = g.compassoIngressos_sincronizarPdfs(TOKEN); b.ok(r.copiados === 5 && r.faltam === 0 && equipe.length === 45, "3º lote: os 5 últimos; total 45", JSON.stringify(r));
b.ok(compart.length === 45 && compart.every(x => /:ANYONE_WITH_LINK:VIEW$/.test(x)), "cada PDF copiado fica com link aberto (qualquer pessoa com o link, só ver) — decisão do usuário: só se envia a quem solicitou");
r = g.compassoIngressos_sincronizarPdfs(TOKEN); b.ok(r.copiados === 0 && r.faltam === 0 && equipe.length === 45, "depois disso não copia nada de novo (sem duplicar)");
equipe.length = 0; delete robo["pdfs-estado.json"];
b.ok(g.compassoIngressos_sincronizarPdfs(TOKEN).copiados === 0, "sem o arquivo do robô: não faz nada");
b.ok(g.compassoIngressos_sincronizarPdfs("token-invalido").ok === false, "sem sessão válida, recusa");
b.resumo();
