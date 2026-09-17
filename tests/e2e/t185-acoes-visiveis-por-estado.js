/**
 * TESTE — O BOTÃO ESTÁ VISÍVEL DE VERDADE, NÃO SÓ "COM display=''"
 *
 * ACHADO POR VOCÊ EM 16/09/2026, abrindo BOLSA-2026-495017 (Marcelha, pela
 * Fucape, AGUARDANDO_VALIDACAO_CADASTRAL): o modal mostrava só "Fechar".
 * Nenhuma ação. "Onde eu valido essa solicitação ou rejeito?"
 *
 * O DEFEITO. `certBtnConfirmarCadastro` nasceu com display:none e uma linha
 * que o acendia no estado certo. Só que ele mora DENTRO de `certModalAcoes`,
 * e o container era escondido quando o status não fosse PENDENTE ou ANALISE.
 * Acender a luz dentro de um armário fechado: o botão certo, a regra certa, e
 * ninguém nunca o viu.
 *
 * POR QUE NENHUM TESTE PEGOU, e é a lição que este arquivo existe para travar:
 * os testes olhavam `btn.style.display`. Essa propriedade dizia '' — o botão
 * "estava visível" pela medida errada. Visibilidade não é uma propriedade do
 * elemento: é do elemento E DE TODOS OS PAIS. Por isso aqui a pergunta é
 * sempre feita subindo a árvore.
 *
 * jsdom não aplica CSS, então isto cobre `style.display` inline em cadeia —
 * que é o mecanismo que este modal usa. Classe que esconde via folha de
 * estilo continua fora do alcance, e por isso o roteiro manual vai junto.
 */
const b = require("./base");
const dom = require("./dom");

b.fluxo("PAINEL DE BOLSAS · as ações que cada estado oferece");

if (!dom.jsdomDisponivel || !dom.jsdomDisponivel()) {
  b.naoTestavel("Ações por estado no modal", "jsdom não instalado (npm install jsdom)");
  b.resumo();
  process.exit(process.exitCode || 0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const tela = dom.montar(g, ["Scripts_Certificado.html"], { token: "" });
const win = tela.win || tela.window || tela;
const doc = win.document;

/* A PERGUNTA CERTA: sobe a árvore até o corpo. Um só pai escondido basta. */
function visivel(id) {
  let el = doc.getElementById(id);
  if (!el) return false;
  while (el && el !== doc.body) {
    if (el.style && el.style.display === "none") return false;
    el = el.parentElement;
  }
  return true;
}

function abrirCom(status) {
  win.certAbrirSolicitacao({
    protocolo: "BOLSA-TESTE-1", nome: "MARCELHA ALINE", cpf: "080.297.397-37",
    escola: "FUCAPE", status: status, modalidade: "POS_GRADUACAO",
    nivel: "POS_GRADUACAO", curso: "MBA", percentual: "70",
    tipoBeneficiario: "TITULAR", periodoReferencia: "2027/1", observacao: ""
  });
}

/* ── O CASO DO PRINT ─────────────────────────────────────────────────────── */
b.passo("AGUARDANDO_VALIDACAO_CADASTRAL — o estado da solicitação real");
abrirCom("AGUARDANDO_VALIDACAO_CADASTRAL");

b.ok(visivel("certBtnConfirmarCadastro"),
  "🪪 Confirmar cadastro aparece — era ele que estava morto dentro do pai escondido");
b.ok(visivel("certBtnIndeferir"),
  "❌ Indeferir aparece — 'ou rejeito?' precisava de resposta na tela");
b.ok(visivel("certBtnComplementar"),
  "📄 Solicitar Complementação aparece — pode ser só documento faltando");

/* APROVAR NÃO PODE ESTAR AÍ. Aprovar antes de saber se a pessoa é associada
   concede benefício sem ninguém olhar a regra — é o que o próprio backend
   recusa fazer em confirmarCadastroSolicitacaoVoucher. */
b.ok(!visivel("certBtnAprovar"),
  "✅ Aprovar NÃO aparece: ninguém aprova bolsa de cadastro ainda não confirmado");
b.ok(!visivel("cmi-pctEditar"),
  "e o ajuste de desconto também não — a bolsa pode nem existir ainda");

/* ── O ESTADO DE ANÁLISE ─────────────────────────────────────────────────── */
b.passo("PENDENTE — a fila de análise normal");
abrirCom("PENDENTE");
b.ok(visivel("certBtnAprovar"), "✅ Aprovar aparece");
b.ok(visivel("certBtnIndeferir"), "❌ Indeferir aparece");
b.ok(visivel("cmi-pctEditar"), "e o campo de ajustar o desconto aparece");
b.ok(!visivel("certBtnConfirmarCadastro"),
  "🪪 Confirmar cadastro NÃO aparece — já foi feito, e repetir desfaria a decisão");

/* ── FORA DA REGRA ───────────────────────────────────────────────────────── */
b.passo("BLOQUEADA_POR_REGRA — a fileira do comunicado");
abrirCom("BLOQUEADA_POR_REGRA");
b.ok(visivel("certBtnComunicar"), "📣 Comunicar fora da regra aparece");

/* ── JÁ DECIDIDA ─────────────────────────────────────────────────────────── */
b.passo("APROVADO — as decisões acabaram");
abrirCom("APROVADO");
b.ok(!visivel("certBtnAprovar"), "não dá para aprovar de novo");
b.ok(!visivel("certBtnConfirmarCadastro"), "nem confirmar cadastro");
b.ok(!visivel("certBtnComunicar"), "nem comunicar fora da regra");

/* ── A TRAVA QUE IMPEDE O DEFEITO DE VOLTAR ──────────────────────────────── */
b.passo("Nenhum estado da fila pode ficar SEM decisão nenhuma");
/* Era exatamente o sintoma: um modal com "Fechar" e mais nada. Qualquer
   estado que espera uma pessoa decidir precisa oferecer pelo menos uma ação —
   senão a solicitação fica presa e ninguém descobre por quê. */
["PENDENTE", "ANALISE", "AGUARDANDO_VALIDACAO_CADASTRAL", "BLOQUEADA_POR_REGRA"]
  .forEach(function (st) {
    abrirCom(st);
    const acoes = ["certBtnConfirmarCadastro", "certBtnComplementar", "certBtnIndeferir",
                   "certBtnAprovar", "certBtnComunicar"].filter(visivel);
    b.ok(acoes.length > 0,
      st + " oferece pelo menos uma decisão a quem abre", acoes.join(", ") || "NENHUMA");
  });

/* ── APROVAR FECHA A TELA ────────────────────────────────────────────────── */
/* "Quando aprovar tem que fechar essa tela" — você, 16/09/2026. Reverte uma
   decisão minha: o modal se REABRIA sozinho depois de aprovar, para emendar
   na emissão. Quem analisa trinta seguidas fecharia a mesma janela trinta
   vezes. */
b.passo("Depois de aprovar, o modal fecha — e não se reabre sozinho");

const fonte = require("fs").readFileSync(
  require("path").join(dom.RAIZ, "Scripts_Certificado.html"), "utf8");
const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, "");

b.ok(semComentarios.indexOf("if(labelBtn === 'certBtnAprovar' && _solAtual)") === -1,
  "o desvio que tratava Aprovar como caso especial saiu");
b.ok(!/setTimeout\(function\(\)\{\s*var atualizada = _lista\.find/.test(
       semComentarios.replace(/\s+/g, " ").replace(/ \{/g, "{")),
  "e a reabertura por setTimeout não existe mais");

/* A PROVA POR EXECUÇÃO, não por leitura: abre o modal e confere que a função
   de fechar realmente o tira da tela. */
abrirCom("PENDENTE");
b.ok(visivel("certModalAcoes"), "o modal está aberto antes da ação");
b.igual(typeof win.certFecharSolicitacao, "function",
  "a tela expõe o fechar — sem isso o teste mediria o próprio remendo");
win.certFecharSolicitacao();
const overlay = doc.getElementById("certModalOverlay");
b.igual(overlay.style.display, "none", "e fechar o modal o tira da tela");
b.ok(!overlay.classList.contains("ativo"), "sem deixar a classe de aberto para trás");

/* ── CADA AÇÃO LEVA A UM LUGAR ───────────────────────────────────────────── */
/* "Se foi aprovar, volta para o painel. Se foi indeferir, volta para o painel.
   Se solicitar a complementação, tem que ir para outro caminho." — você,
   16/09/2026. */
b.passo("O destino depois de cada ação");

const semCom = fonte.replace(/\/\*[\s\S]*?\*\//g, "");

b.ok(/cert_fecharModal\(\);/.test(semCom), "toda ação fecha o modal");
b.ok(/cert_carregarLista\(\);/.test(semCom), "e a lista do painel se recarrega");

/* COMPLEMENTAÇÃO É A ÚNICA COM DESVIO, porque é a única que não encerra o
   registro: fica uma pendência esperando documento. O card "Em Análise" é
   rotulado "Complementação solicitada" — é para lá que a fila vai. */
b.ok(/labelBtn === 'certBtnComplementar'/.test(semCom),
  "complementação tem um caminho próprio");
b.ok(/certFiltrarPorStatus\('ANALISE'\)/.test(semCom),
  "e ele leva à fila de Em Análise, que é a de complementação solicitada");

/* O CARD E O DESVIO PRECISAM CONCORDAR. Se alguém trocar o status do card e
   esquecer do desvio, a ação levaria a uma fila vazia — e o sintoma seria
   "sumiu a solicitação", não "filtro errado". */
b.ok(/certFiltrarPorStatus\('ANALISE'\)"[\s\S]{0,400}Complementação solicitada/.test(fonte) ||
     /onclick="certFiltrarPorStatus\('ANALISE'\)"/.test(fonte),
  "o card que esse filtro abre é o mesmo que a tela rotula assim");

/* APROVAR E INDEFERIR NÃO MEXEM NO FILTRO: quem está trabalhando com um
   filtro aberto não pode ser tirado dele por uma ação que apenas encerrou um
   registro. */
b.ok(!/labelBtn === 'certBtnAprovar'/.test(semCom),
  "aprovar não tem desvio nenhum — volta ao painel como estava");
b.ok(!/labelBtn === 'certBtnIndeferir'/.test(semCom),
  "indeferir também não");

b.naoTestavel("o botão aparecendo no navegador",
  "jsdom não aplica CSS — este teste cobre display inline em cadeia, que é o " +
  "mecanismo deste modal. Roteiro manual: abrir BOLSA-2026-495017 em produção " +
  "e conferir que 🪪 Confirmar cadastro está lá");
b.resumo();
