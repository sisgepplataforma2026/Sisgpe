/**
 * TESTE — PAINEL DE CONFIGURAÇÕES
 *
 * O defeito que originou este teste (2026-08-06): os quatro cards do topo de
 * Configurações mostravam, respectivamente, "[object Object]", "Configurada",
 * "SISGEP" e "Administrador".
 *
 * Só o primeiro era visivelmente errado. Os outros três eram PIORES, porque
 * pareciam certos:
 *   · "Planilha: Configurada" era texto de reserva — o código não abria
 *     planilha nenhuma. Dava garantia sem verificar.
 *   · "Versão: SISGEP" não é versão. A 2.1.0 existia e nunca chegou à tela.
 *   · "Usuário: Administrador" estava escrito no HTML. Aparecia para
 *     qualquer pessoa logada, inclusive quem não é administrador.
 *
 * É o caso de manual da REGRA Nº -1: a tela abre, os cards aparecem, e três
 * dos quatro estão mentindo.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

b.fluxo("CONFIGURAÇÕES · Os quatro indicadores dizem a verdade");

b.passo("1. O painel responde");
const p = g.getConfigPainel(ADM);
b.ok(p && p.ok === true, "getConfigPainel responde", p ? "ok" : "não respondeu");

b.passo("2. Ambiente é TEXTO, não objeto");
// Era este o "[object Object]": getConfigPublica devolve
// ambiente:{nome,isProducao} e a tela jogava o objeto em textContent.
b.ok(typeof p.ambiente === "string" && typeof p.ambienteRotulo === "string",
  "ambiente e rótulo são strings",
  p.ambiente + " → " + p.ambienteRotulo);
b.ok(String(p.ambienteRotulo).indexOf("[object") === -1,
  'nunca produz a palavra "[object Object]"', p.ambienteRotulo);

b.passo("3. Homologação é sinalizada");
// Quem não percebe que está em homologação acha que gravou em produção.
b.ok(p.ambienteAlerta === (p.ambiente === "homologacao"),
  "o alerta acompanha o ambiente de verdade",
  "ambiente=" + p.ambiente + ", alerta=" + p.ambienteAlerta);

b.passo("4. A planilha é ABERTA, não presumida");
// O card antigo dizia "Configurada" sem tentar abrir nada.
b.ok(p.planilhaOk === true, "planilhaSisgep_ abriu de verdade", p.planilha);
b.ok(!/^Configurada$/.test(p.planilha),
  'não devolve mais o texto de reserva "Configurada"', p.planilha);

b.passo("5. O ID da planilha não é exposto inteiro");
// A tela fica aberta na mesa. Só o final identifica qual é.
b.ok(p.planilha.indexOf(g.PLANILHA_ID) === -1,
  "o ID completo não aparece no card", p.planilha);
b.ok(/…\w{6}\)/.test(p.planilha) || p.planilha.indexOf("…") > -1,
  "mostra só os últimos dígitos", p.planilha);

b.passo("6. A versão é a versão, não o nome do sistema");
b.ok(/^\d+\.\d+\.\d+$/.test(p.versao), "versão em formato de versão",
  p.versao + " — " + p.versaoDescricao);
b.ok(p.versao !== "SISGEP", 'não devolve mais o texto de reserva "SISGEP"', p.versao);

b.passo("7. O usuário é quem está logado, não texto fixo");
b.ok(p.usuario && p.usuario !== "Administrador" && p.usuario !== "—",
  "nome vem da sessão", p.usuario + " (" + p.perfil + ")");

b.passo("8. O perfil vem da sessão pelo MESMO critério do resto do projeto");
// A primeira versão desta função lia sessao.administrador — campo que não
// existe. Resultado: "Usuário" para todo mundo, o mesmo defeito do card
// antigo, só que invertido. O critério real é o de Sessao.gs:395-401,
// normalizar o perfil e procurar "ADMIN".
const pf = g.getConfigPainel(FIN);
b.ok(pf.ok === true, "responde para o outro usuário", pf.usuario + " (" + pf.perfil + ")");
// O flag é o que vale, não a grafia: a planilha pode trazer "Administrador",
// "ADMINISTRADOR" ou "Admin Financeiro" — a normalização resolve as três.
b.ok(p.administrador === true && /ADMIN/i.test(p.perfil),
  "quem tem perfil de administrador é reconhecido como admin",
  p.usuario + " → perfil=" + p.perfil + ", administrador=" + p.administrador);
b.ok(pf.administrador === false,
  "quem não tem, não é promovido pelo painel",
  pf.usuario + " → perfil=" + pf.perfil + ", administrador=" + pf.administrador);
b.ok(p.usuario !== pf.usuario, "cada sessão devolve o seu usuário",
  p.usuario + " ≠ " + pf.usuario);

b.fluxo("CONFIGURAÇÕES · Sessão");

b.passo("9. Sem sessão não responde");
// getConfigPublica é global e sem token — está entre as funções expostas
// anonimamente. A nova exige sessão.
b.bloqueia(() => g.getConfigPainel(""), "getConfigPainel nega token vazio");
b.bloqueia(() => g.getConfigPainel("token-inventado"), "nega token inválido");

b.naoTestavel("Aparência dos cards e o banner de homologação", "exige navegador");

b.resumo();
process.exit(0);
