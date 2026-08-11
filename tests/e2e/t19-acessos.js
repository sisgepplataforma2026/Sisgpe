/**
 * TESTE — LOGS DE ACESSO (tela 16.2)
 *
 * ⚠️ O QUE ESTE TESTE NÃO ALCANÇA
 * O endereço de quem acessou. Não é limitação do teste: o Apps Script não
 * entrega o IP do chamador da web app. A tela diz isso por escrito, e aqui
 * fica registrado como **não testável por não existir**.
 *
 * O que ele prova por execução: que entrar, errar a senha, ser bloqueado e
 * sair deixam rastro consultável; que a auditoria não interfere no login; e
 * que a senha nunca chega na trilha.
 *
 * O último ponto é o que mais importa. Esta é a única ponte que passa perto
 * de credencial. Se a senha digitada vazasse para o log, a trilha de
 * auditoria — que é lida por administradores e exportada em fiscalização —
 * viraria um arquivo de senhas em texto puro.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

function acessos(filtro) {
  return g.auditoriaConsultar(
    Object.assign({ modulo: "Segurança", limite: 500 }, filtro || {}), ADM).acoes;
}

/* ══════════ 1. ENTRADA ══════════ */
b.fluxo("ACESSO · Entrada no sistema");

b.passo("1. Login bem-sucedido entra na trilha");
// b.logar() chama autenticarUsuario de verdade — as entradas do seed já
// deviam estar registradas antes de este teste escrever qualquer coisa.
const entradas = acessos({ acao: "ENTRAR" });
b.ok(entradas.length >= 2, "quem entrou fica registrado sem ninguém pedir",
  entradas.length + " entrada(s) · " + entradas.map(a => a.usuario).join(", "));

b.passo("2. Classificado como Segurança › Acesso");
b.ok(entradas[0].modulo === "Segurança" && entradas[0].submodulo === "Acesso" &&
     entradas[0].origem === "LOGIN",
  "a tela filtra por isto", entradas[0].modulo + " › " + entradas[0].submodulo);

/* ══════════ 2. TENTATIVA FALHA E BLOQUEIO ══════════ */
b.fluxo("ACESSO · Tentativa falha e bloqueio");

b.passo("3. Senha errada entra na trilha");
const antesFalha = acessos({ acao: "SENHA_INCORRETA" }).length;
g.autenticarUsuario("wanderson", "senha-errada-de-proposito");
const depoisFalha = acessos({ acao: "SENHA_INCORRETA" });
b.ok(depoisFalha.length === antesFalha + 1,
  "a tentativa que falhou deixa rastro", antesFalha + " → " + depoisFalha.length);

b.passo("4. Usuário que nem existe também é registrado");
// É o caso que mais interessa numa apuração: alguém varrendo nomes de
// usuário. Se só as contas reais fossem registradas, a varredura passaria
// invisível.
g.autenticarUsuario("invasor-que-nao-existe", "123456");
const doDesconhecido = acessos({ acao: "SENHA_INCORRETA" })
  .filter(a => String(a.usuario).indexOf("invasor") > -1);
b.ok(doDesconhecido.length === 1,
  "tentativa contra conta inexistente fica registrada", doDesconhecido[0].usuario);

b.passo("5. A tentativa é marcada como FALHA, não como sucesso");
b.ok(doDesconhecido[0].resultado === "FALHA",
  "o card de falhas do painel tem em que se apoiar", doDesconhecido[0].resultado);

b.passo("6. Repetir até estourar o limite gera o BLOQUEIO");
const max = g.LOGIN_TENTATIVAS_CONFIG.MAX_TENTATIVAS;
for (let i = 0; i < max + 1; i++) g.autenticarUsuario("rogerio", "errada" + i);
const bloqueios = acessos({ acao: "BLOQUEIO_POR_TENTATIVAS" });
b.ok(bloqueios.length >= 1,
  "o bloqueio é registrado, não só o Logger",
  bloqueios.length ? bloqueios[0].usuario + " · " + bloqueios[0].justificativa : "não registrou");

b.passo("7. Bloqueio é ação crítica");
b.ok(bloqueios[0].critica === true,
  "aparece no card de críticas do dashboard", "critica=" + bloqueios[0].critica);

/* ══════════ 3. A SENHA NUNCA ENTRA NA TRILHA ══════════ */
b.fluxo("ACESSO · Nenhuma senha na trilha");

b.passo("8. A senha digitada não aparece em campo nenhum de nenhum registro");
// Varredura em TODOS os campos de TODOS os registros de acesso. Se a senha
// vazasse para cá, a trilha viraria um arquivo de senhas em texto puro —
// lida por administradores e exportada em fiscalização.
const SENHA_MARCADA = "MinhaSenhaSecreta#2026";
g.autenticarUsuario("wanderson", SENHA_MARCADA);
const tudo = acessos();
const vazou = tudo.filter(a => JSON.stringify(a).indexOf(SENHA_MARCADA) > -1);
b.ok(vazou.length === 0, "senha digitada não chega ao log",
  vazou.length ? "VAZOU em " + vazou.length + " registro(s)" : tudo.length + " registros varridos");

b.passo("9. Nem no campo de detalhe, que é texto livre");
const comDetalhe = tudo.filter(a => a.justificativa);
b.ok(comDetalhe.every(a => String(a.justificativa).indexOf(SENHA_MARCADA) === -1),
  "o detalhe conta a tentativa, não o que foi digitado",
  comDetalhe.length ? comDetalhe[0].justificativa : "");

/* ══════════ 4. A AUDITORIA NÃO ATRAPALHA O LOGIN ══════════ */
b.fluxo("ACESSO · A auditoria não derruba a entrada");

b.passo("10. Auditoria quebrada não impede alguém de entrar");
// Trocar log por porta trancada seria o pior negócio possível: ninguém entra
// no sistema porque a auditoria teve um problema.
const guardada = g.aud_deAcesso_;
g.aud_deAcesso_ = function () { throw new Error("falha simulada da auditoria"); };
let r = null, derrubou = false;
try { r = g.autenticarUsuario("wanderson", "Senha@2026"); } catch (e) { derrubou = true; }
g.aud_deAcesso_ = guardada;
b.ok(derrubou === false && r && r.ok === true,
  "o login conclui mesmo com a auditoria falhando",
  derrubou ? "LANÇOU" : "ok=" + (r && r.ok));

b.passo("11. E a saída também não");
// Sessão descartável de propósito, e de joscimar. Duas correções aqui:
// a primeira versão encerrava a sessão do próprio ADM — o token usado em
// todas as consultas deste arquivo — e o teste se derrubava sozinho três
// passos adiante. A segunda usava rogerio, que o passo 6 acabara de
// bloquear de propósito. Efeito colateral de teste é tão real quanto
// efeito colateral de código.
const TOKEN_DESCARTE = b.logar(g, "joscimar");
const guardada2 = g.aud_deAcesso_;
g.aud_deAcesso_ = function () { throw new Error("falha simulada"); };
let derrubou2 = false;
try { g.encerrarSessaoUsuario(TOKEN_DESCARTE); } catch (e) { derrubou2 = true; }
g.aud_deAcesso_ = guardada2;
b.ok(derrubou2 === false, "logout conclui mesmo com a auditoria falhando", "");

/* ══════════ 5. SAÍDA ══════════ */
b.fluxo("ACESSO · Saída");

b.passo("12. Sair registra QUEM saiu");
// O nome tem que ser lido antes de a sessão ser destruída. Depois não há
// mais de onde tirar — e o registro sairia anônimo, sem responder "até que
// horas fulano ficou no sistema".
const TOKEN_SAIDA = b.logar(g, "joscimar");
g.encerrarSessaoUsuario(TOKEN_SAIDA);
const saidas = acessos({ acao: "SAIR" }).filter(a => String(a.usuario).indexOf("joscimar") > -1);
b.ok(saidas.length >= 1 && saidas[0].usuario.indexOf("@") > -1,
  "a saída sai com nome, não anônima",
  saidas.length ? saidas[0].usuario : "não achou ou saiu sem identificação");

/* ══════════ 6. PERMISSÃO ══════════ */
b.fluxo("ACESSO · Permissão");

b.passo("13. Quem não tem o módulo não lê os acessos");
// A lista de acessos diz quem trabalha em que horário e quem errou senha —
// e o histórico de erro de senha de uma pessoa é constrangedor sem ser útil
// para quem não apura segurança.
b.bloqueia(() => g.auditoriaConsultar({ modulo: "Segurança" }, FIN), "nega quem não tem o módulo");
b.bloqueia(() => g.auditoriaConsultar({ modulo: "Segurança" }, ""), "nega token vazio");

b.naoTestavel("Endereço de rede de quem acessou",
  "o Apps Script não entrega o IP do chamador da web app — a informação não " +
  "existe, não é o teste que não alcança");
b.naoTestavel("A tela AuditoriaAcessos.html",
  "sem DOM — roteiro manual: sair e entrar de novo, e conferir que as duas " +
  "linhas aparecem em Auditoria e Compliance › Logs de Acesso");

b.resumo();
process.exit(0);
