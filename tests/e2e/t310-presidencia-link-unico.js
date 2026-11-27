/**
 * ÁREA DA PRESIDÊNCIA · LINK ÚNICO PARA OS TRÊS (27/11/2026). Pedido: "Não pode ser um link para os três?" + nomes "Leonil, Wanderson e Marcelha".
 * Servidor real (emulador), base/filas/robô FALSOS. Prova: o link único entra, mas só age depois de declarar quem é (um dos três); o nome vai para o registro
 * (PEDIDO_POR); nome fora da lista é recusado; link pessoal antigo continua valendo; gerar o link único cancela os antigos e usa o endereço /exec.
 * NÃO PROVA: a tela no celular (t305) nem a produção.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const agora = new Date().toISOString();
g.cingLerBase_ = () => ({ lidoEm: agora, evento: "x", total: 0, linhas: [] });
g.cingFilaPronta_ = () => true; g.cingGravarFila_ = () => {}; g.cingDispararRobo_ = () => ({ acionado: true, motivo: "" });
g.cingPdfs_ = () => ({}); g.cingSincronizarEmissoes_ = () => 0; g.cingSincronizarResultado_ = () => 0;
b.fluxo("PRESIDÊNCIA · link único");
b.igual(g.PRES_PESSOAS, ["Leonil", "Wanderson", "Marcelha"], "os três nomes, como o usuário escreveu");
const U = "u".repeat(32);
g.presRegistrarAcesso_("*", U);
let e = g.presidencia_estado(U);
b.ok(e.ok && e.precisaEscolher === true && e.pessoas.length === 3, "só com o link: a tela precisa perguntar 'Quem está usando?'", JSON.stringify(e).slice(0, 80));
b.ok(g.presidencia_conferir(U, [{ nome: "Fulano de Tal", categoria: "convite" }]).escolher === true, "sem dizer quem é, não confere nem gera");
e = g.presidencia_estado(U + "|Leonil");
b.ok(e.ok && e.nome === "Leonil", "com '|Leonil' entra como Leonil", JSON.stringify(e).slice(0, 80));
b.ok(g.presidencia_estado(U + "|Wanderson").nome === "Wanderson" && g.presidencia_estado(U + "|Marcelha").nome === "Marcelha", "e como Wanderson e como Marcelha");
b.ok(g.presidencia_estado(U + "|Invasor").precisaEscolher === true, "nome fora dos três: volta a perguntar (não vale)");
const r = g.presidencia_gerar(U + "|Marcelha", [{ nome: "Convidado Um Teste", categoria: "convite" }], true);
b.ok(r.ok && r.pedidos === 1, "gera usando o nome declarado", r.mensagem);
b.igual(g.cingEmissoes_()[0].PEDIDO_POR, "PRES:Marcelha", "o registro guarda quem pediu (PRES:Marcelha)");
b.ok(g.presidencia_estado("z".repeat(32) + "|Leonil").negado === true, "token errado continua recusado");
b.passo("link pessoal antigo continua valendo");
const P = "p".repeat(32); g.presRegistrarAcesso_("Wanderson", P);
b.ok(g.presidencia_estado(P).nome === "Wanderson", "o link pessoal já entregue segue funcionando até ser trocado");
b.passo("gerar o link único");
g.__usuarioAtivoEmail = ""; b.ok(g.presidenciaGerarLinksSISGEP().erro === true, "de fora do editor: recusa");
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
g.getSistemaUrlBase = () => "https://script.google.com/macros/s/ABC123/dev";
const L = g.presidenciaGerarLinksSISGEP();
b.ok(L.length >= 3 && /\/exec\?page=presidencia&k=[0-9a-f]{64}$/.test(L[1]) && !/\/dev/.test(L[1]), "um link só, terminado em /exec (o /dev é de teste)", L[1]);
b.ok(g.presidencia_estado(P).negado === true && g.presidencia_estado(U).negado === true, "os links anteriores deixam de valer");
const novo = (L[1].match(/k=([0-9a-f]{64})$/) || [])[1];
b.ok(g.presidencia_estado(novo).precisaEscolher === true && g.presidencia_estado(novo + "|Leonil").nome === "Leonil", "o link novo entra e pergunta quem é");
b.resumo();
