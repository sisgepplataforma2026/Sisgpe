/**
 * TESTE — TRILHA ÚNICA DE AUDITORIA
 *
 * ⚠️ O QUE ESTE TESTE NÃO ALCANÇA
 * O emulador não fala com o Firestore. A gravação real no
 * sisgep-plataforma é **NÃO TESTADA** e só o usuário confirma, rodando
 * firebaseTestarConexao() depois de configurar as propriedades.
 *
 * O que ele prova, por execução: a montagem dos 14 campos do §15, a
 * classificação de ação crítica, o fallback para planilha quando o Firestore
 * não está configurado, a ponte com os logs antigos e a permissão.
 *
 * O fallback é a parte mais importante daqui. auditar_() é chamada de dentro
 * de fluxos que mexem em dinheiro; se ela lançar exceção, derruba o
 * pagamento junto. O teste força os dois modos de falha e confere que a
 * operação sobrevive.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

/* ══════════ 1. OS 14 CAMPOS DO §15 ══════════ */
b.fluxo("AUDITORIA · Montagem do registro (§15)");

b.passo("1. Todos os 14 campos existem no registro montado");
const r = g.aud_montar_({
  registroId: "DESP-2026-0412", modulo: "Financeiro", submodulo: "Pagamentos",
  acao: "lancar_no_banco",
  sessao: { email: "rogerio@sindeducacao.com", perfil: "USUARIO", setor: "Financeiro", token: "sess_abc123456789" },
  valorAnterior: { status: "APROVADA", valor: 1250 },
  valorNovo: { status: "LANCADA", valor: 1250 },
  justificativa: "Lote 08/2026, banco 341",
  documento: "comprovante-0412.pdf"
});
const campos = ["registroId","modulo","submodulo","acao","usuario","perfil","setor",
                "sessao","origem","dataHora","valorAnterior","valorNovo",
                "justificativa","documento","resultado"];
const faltando = campos.filter(c => !(c in r));
b.ok(faltando.length === 0, "os campos obrigatórios do §15 estão presentes",
  faltando.length ? "FALTOU: " + faltando.join(", ") : campos.length + " campos");

b.passo("2. A ação é normalizada para maiúsculas");
// "lancar_no_banco" e "LANCAR_NO_BANCO" têm que virar o mesmo valor, senão o
// filtro por ação no painel devolve metade dos registros.
b.ok(r.acao === "LANCAR_NO_BANCO", "ação normalizada", r.acao);

b.passo("3. Quem agiu vem da sessão, sem precisar repetir");
b.ok(r.usuario === "rogerio@sindeducacao.com" && r.perfil === "USUARIO" && r.setor === "Financeiro",
  "usuário, perfil e setor extraídos da sessão",
  r.usuario + " · " + r.perfil + " · " + r.setor);

b.passo("4. O token da sessão é truncado");
// Guardar o token inteiro no log permitiria reusar a sessão de outra pessoa
// a partir da auditoria. 12 caracteres bastam para correlacionar.
b.ok(r.sessao.length <= 12 && r.sessao.length > 0,
  "só um prefixo do token vai para o log", r.sessao);

b.passo("5. Valor anterior e novo ficam como objeto, não texto");
b.ok(typeof r.valorAnterior === "object" && r.valorAnterior.status === "APROVADA",
  "estrutura preservada — dá para consultar depois", JSON.stringify(r.valorAnterior));

b.passo("6. Campos ausentes viram marcador, não quebram");
const min = g.aud_montar_({ modulo: "Documentos", acao: "EMITIR" });
b.ok(min.usuario === "—" && min.perfil === "—" && min.valorAnterior === null,
  "registro mínimo é montado sem erro", "usuario=" + min.usuario);

/* ══════════ 2. AÇÃO CRÍTICA ══════════ */
b.fluxo("AUDITORIA · Classificação de ação crítica");

b.passo("7. Ações que mexem em dinheiro ou desfazem são críticas");
["EXCLUIR", "CANCELAR", "ESTORNAR", "DESFILIAR", "APROVAR", "LANCAR_NO_BANCO"]
  .forEach(a => b.ok(g.aud_ehCritica_(a) === true, a + " é crítica", ""));

b.passo("8. Consulta e listagem não são");
["CONSULTAR", "LISTAR", "ABRIR_TELA"].forEach(a =>
  b.ok(g.aud_ehCritica_(a) === false, a + " não é crítica", ""));

b.passo("9. A classificação pega a ação composta");
// "CANCELAR_RESERVA_PARQUE" tem que ser crítica, não só "CANCELAR" exato.
b.ok(g.aud_ehCritica_("CANCELAR_RESERVA_PARQUE") === true,
  "ação composta é reconhecida", "");

/* ══════════ 3. O FALLBACK — A PARTE QUE NÃO PODE FALHAR ══════════ */
b.fluxo("AUDITORIA · Fallback (Firestore ausente)");

b.passo("10. Sem Firebase configurado, grava na planilha");
// É o cenário de hoje: as propriedades do Firebase ainda não estão no
// projeto. A trilha tem que funcionar assim mesmo.
b.ok(g.firebaseDisponivel_() === false,
  "o emulador não tem Firebase configurado — é o cenário do fallback", "");
const g1 = g.auditar_({
  registroId: "AG-001", modulo: "Assembleias", acao: "DELIBERAR",
  sessao: { email: "wanderson@sindeducacao.com" },
  valorNovo: { resultado: "APROVADO" }
});
b.ok(g1.ok === true && g1.destino === "PLANILHA",
  "gravou, e disse onde", g1.destino);

b.passo("11. O registro chegou mesmo na aba de reserva");
const abaAud = ss.getSheetByName("SISGEP_Auditoria");
b.ok(!!abaAud && abaAud.getLastRow() >= 2, "aba criada com o registro",
  abaAud ? abaAud.getLastRow() - 1 + " linha(s)" : "aba não existe");

b.passo("12. auditar_ NUNCA lança — nem com lixo na entrada");
// Esta é a garantia que permite chamá-la de dentro de um fluxo de pagamento.
let lancou = false;
[null, undefined, {}, { modulo: "X" }, { acao: "Y" }, "string solta", 42].forEach(entrada => {
  try { g.auditar_(entrada); } catch (e) { lancou = true; }
});
b.ok(lancou === false, "nenhuma entrada inválida derruba a chamada",
  "7 entradas malformadas testadas");

b.passo("13. Chamada sem módulo ou ação é ignorada, não gravada");
const antes = abaAud.getLastRow();
const vazio = g.auditar_({ justificativa: "sem módulo nem ação" });
b.ok(vazio.ok === false && abaAud.getLastRow() === antes,
  "não polui a trilha com registro inútil", vazio.mensagem);

/* ══════════ 4. PONTE COM OS LOGS ANTIGOS ══════════ */
b.fluxo("AUDITORIA · Migração dos 28 pontos que já gravam log");

b.passo("14. Formato do LOG_SISTEMA (ofícios) é traduzido");
const p1 = g.aud_deLogSistema_({
  usuario: "marcelha@sindeducacao.com", numero: "041/2026", tipo: "FILIACAO",
  escola: "Escola Modelo", cnpj: "12.345.678/0001-90", codigo: "ABC123"
});
b.ok(p1.ok === true, "log antigo de ofício entra na trilha nova", p1.destino);

b.passo("15. E chega com módulo e submódulo certos");
const trilha = g.auditoriaConsultar({ registroId: "041/2026" }, ADM);
const oficio = (trilha.acoes || [])[0];
b.ok(!!oficio && oficio.modulo === "Documentos" && oficio.submodulo === "Ofícios",
  "classificado como Documentos › Ofícios",
  oficio ? oficio.modulo + " › " + oficio.submodulo + " · " + oficio.acao : "não achou");

b.passo("16. Formato do log financeiro é traduzido");
const p2 = g.aud_deLogFinanceiro_({
  idRegistro: "DESP-0412", modulo: "Financeiro", usuario: "rogerio@sindeducacao.com",
  valorAnterior: 1000, valorNovo: 1250, motivo: "Correção de nota fiscal"
});
b.ok(p2.ok === true, "log antigo financeiro entra na trilha", p2.destino);

/* ══════════ 5. CONSULTA E PAINEL ══════════ */
b.fluxo("AUDITORIA · Consulta e painel (item 16)");

b.passo("17. A consulta devolve a trilha e diz de onde leu");
const c = g.auditoriaConsultar({}, ADM);
b.ok(c.ok && c.fonte === "PLANILHA" && c.acoes.length >= 3,
  "leu da reserva e informou a fonte", c.fonte + ", " + c.acoes.length + " ações");

b.passo("18. Filtro por módulo");
const cf = g.auditoriaConsultar({ modulo: "Financeiro" }, ADM);
b.ok(cf.acoes.length >= 1 && cf.acoes.every(a => a.modulo === "Financeiro"),
  "só o módulo pedido", cf.acoes.length + " registro(s)");

b.passo("19. Filtro por ação crítica");
const cc = g.auditoriaConsultar({ apenasCriticas: true }, ADM);
b.ok(cc.acoes.every(a => a.critica === true), "só as críticas",
  cc.acoes.length + " crítica(s) de " + c.acoes.length);

b.passo("20. O painel conta o que o item 16 pede");
const painel = g.auditoriaPainel(ADM);
b.ok(painel.ok && typeof painel.hoje === "number" && typeof painel.criticas === "number",
  "hoje, críticas, falhas e por módulo",
  painel.total + " total · " + painel.hoje + " hoje · " + painel.criticas + " críticas");
b.ok(Object.keys(painel.porModulo).length >= 2,
  "agrupa por módulo", Object.keys(painel.porModulo).join(", "));

/* ══════════ 6. PERMISSÃO ══════════ */
b.fluxo("AUDITORIA · Permissão");

b.passo("21. Quem não tem o módulo não lê a trilha");
// A trilha mostra quem fez o quê no sindicato inteiro. É das telas mais
// sensíveis do sistema.
b.bloqueia(() => g.auditoriaConsultar({}, FIN), "auditoriaConsultar nega");
b.bloqueia(() => g.auditoriaPainel(FIN), "auditoriaPainel nega");

b.passo("22. Sem sessão");
b.bloqueia(() => g.auditoriaConsultar({}, ""), "nega token vazio");

b.passo("23. firebaseTestarConexao exige administrador");
b.bloqueia(() => g.firebaseTestarConexao(FIN), "só administrador testa a conexão");

b.naoTestavel("Gravação real no Firestore do sisgep-plataforma",
  "o emulador não faz rede — rodar firebaseTestarConexao() após configurar");
b.naoTestavel("Regras de segurança do Firestore",
  "conta de serviço passa por cima delas, por desenho do Firebase");

b.resumo();
process.exit(0);
