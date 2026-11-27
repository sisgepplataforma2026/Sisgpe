/**
 * REENVIO · AS PESSOAS DOS 16 OFÍCIOS DE JUNHO APARECEM (27/11/2026). Pedido do usuário: "só preciso enxergar as pessoas que estão dentro do ofício;
 * não é para reenviar automático". Backend real (preverReenvioOficio), Registro FALSO com as linhas vazias como em produção.
 * Prova: abrir o reenvio do 232 e do 223 passa a listar as pessoas; os outros 14 também ficam preenchidos; ofício fora da lista não é tocado;
 * NADA é enviado; se o reparo falhar, a prévia sai como antes. NÃO PROVA: a planilha de produção.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 6).setValues([["Número do Ofício", "Tipo", "Escola (Razão Social)", "E-mail (principal)", "Colaborador(es)", "Status"]]);
const linhas = [["223/2026", "Filiação", "", "", "", "ENVIADO"], ["232/2026", "Filiação", "", "", "", "ENVIADO"], ["225/2026", "Desfiliação", "", "", "", "ENVIADO"],
  ["300/2026", "Filiação", "COLEGIO ALFA", "rh@alfa.exemplo.com", "", "ENVIADO"]];   // 300: fora da lista e sem nomes — não pode ser tocado
reg.getRange(2, 1, linhas.length, 6).setValues(linhas);
g.reunirAnexosReenvioOficio_ = () => ({ blobs: [], itens: [{ nome: "Oficio.pdf", origem: "pacote original da fila" }], reconstruido: true });
const URL = n => "https://drive.google.com/file/d/ARQ-" + n.replace("/", "-") + "/view";
const col = (i) => reg.getRange(2 + i, 5).getValue();
const enviadosAntes = amb.outbox.length;
b.fluxo("REENVIO · pessoas dos ofícios de junho");
const pv232 = g.preverReenvioOficio({ numero: "232/2026", escola: "MC MULTIVIX CARIACICA", tipo: "Filiação", url: URL("232/2026") }, TOKEN);
b.ok(pv232.ok && pv232.motivo, "a prévia do 232 sai", pv232.mensagem);
b.igual(pv232.motivo.pessoas.map(p => p.nome), ["MYLLENA SANTOS DA SILVA", "CAMILA SILVA DOS SANTOS"], "o 232 lista Myllena e Camila");
g.ofDest_cacheRegistro_ = null;
const pv223 = g.preverReenvioOficio({ numero: "223/2026", escola: "MULTIVIX VITORIA", tipo: "Filiação", url: URL("223/2026") }, TOKEN);
b.igual(pv223.motivo.pessoas.map(p => p.nome), ["CLEBER PAIZANTE DA ROCHA", "SABRINA SACHL DOS SANTOS FERREIRA"], "o 223 lista Cleber e Sabrina");
b.ok(col(2).indexOf("LARISSA") > -1, "e os outros ofícios da lista também foram preenchidos (o 225)");
b.igual(col(3), "", "ofício FORA da lista (300) não foi tocado");
b.igual(amb.outbox.length, enviadosAntes, "NADA foi enviado: só passou a mostrar as pessoas");
b.passo("o reenvio de ofício fora da lista segue como antes");
const pv300 = g.preverReenvioOficio({ numero: "300/2026", escola: "COLEGIO ALFA", tipo: "Filiação", url: URL("300/2026") }, TOKEN);
b.ok(pv300.ok && pv300.motivo && pv300.motivo.pessoas.length === 0, "300: prévia normal, sem pessoas (nada a mostrar), sem erro");
b.passo("se o reparo falhar, a prévia sai como antes");
reg.getRange(3, 5).setValue("");            // esvazia o 232 de novo
g.ofrReparoDoOficio_ = () => { throw new Error("falha simulada"); };
g.ofDest_cacheRegistro_ = null;
const pvErr = g.preverReenvioOficio({ numero: "232/2026", escola: "MC MULTIVIX CARIACICA", tipo: "Filiação", url: URL("232/2026") }, TOKEN);
b.ok(pvErr.ok && pvErr.motivo && pvErr.motivo.pessoas.length === 0, "com o reparo quebrado, a prévia sai igual a hoje (sem pessoas), sem derrubar nada");
b.resumo();
