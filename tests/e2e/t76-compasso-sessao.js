/**
 * NENHUMA FUNÇÃO DO COMPASSO PODE FICAR ALCANÇÁVEL SEM IDENTIFICAR QUEM CHAMA
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. A análise do módulo de festas mediu os 18 arquivos do Compasso
 * da Vida 2026 e achou 32 funções globais sem "_" no fim e sem trava nenhuma.
 * No Apps Script isso não é detalhe de estilo: toda função global sem "_" é
 * alcançável por google.script.run a partir de QUALQUER página do projeto,
 * inclusive as públicas. Entre as 32:
 *
 *   compasso_regenerarQrToken   devolve o QR TOKEN VÁLIDO em texto claro
 *   compasso_validarDecisaoAdmin aprova a própria inscrição
 *   compasso_validacaoListar    nome, CPF e escola de todos os inscritos
 *   compasso_checkinManual      libera entrada na portaria
 *   compasso_simularMassa       grava 2.500 inscrições falsas
 *   emissao_limparTestes        ZERA o contador de vagas do evento
 *
 * É a mesma classe já corrigida em Sindicalização (SIND-C), Escolas (ESC-A a
 * ESC-D), Comunicação (COM-A a COM-C) e Benefícios (BEN-A). A camada Compasso
 * veio de outro branch e nunca passou por essa varredura.
 *
 * POR QUE exigirAdminOuSessao_ E NÃO exigirModulo_
 *
 * Porque estas telas ainda abrem por showModalDialog dentro da planilha, e ali
 * não existe tokenSessao. Uma trava que exigisse token deixaria a Central de
 * Validação e a portaria inutilizáveis. A porta dupla aceita token OU conta
 * Google administradora, e recusa anônimo — que é exatamente o buraco.
 *
 * O QUE ESTE TESTE GUARDA
 *
 * 1. NENHUMA função exposta dos 11 arquivos fica sem trava. A lista é apurada
 *    do código, não escrita à mão: uma função nova entra na conta sozinha.
 * 2. As ações irreversíveis exigem ADMIN, não só acesso ao módulo.
 * 3. O modo teste falha FECHADO — sem a propriedade, vale produção.
 * 4. Nenhum ID de planilha de produção fixo nos arquivos de Eventos.
 * 5. As duas telas mandam o token em toda chamada.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. tirar a trava de compasso_validarDecisaoAdmin ............ 1 falha
 *   2. rebaixar compasso_regenerarQrToken de admin p/ módulo .... 1 falha
 *   3. voltar o modo teste para o padrão !== 'false' ........... 2 falhas
 *   4. devolver o ID fixo de produção à busca de associado ..... 2 falhas
 *   5. parar de concatenar o token no api() da portaria ........ 1 falha
 *   6. expor uma função nova sem trava ......................... 1 falha
 *   7. tirar a trava do check-in manual da portaria ............ 1 falha
 *   8. ignorar o EVENTO_MODO_TESTE=false explicito ............. 1 falha
 *   9. produção passar a herdar modo teste .................... 2 falhas
 *  10. ignorar o EVENTO_MODO_TESTE=true explicito .............. 1 falha
 *  11. a tela parar de receber a origem do modo ................ 1 falha
 *
 * NOTA DE MÉTODO: a primeira rodada de mutação deu 0 em tudo, inclusive na
 * linha de base. Não era o teste — era a leitura do resultado: a regex que eu
 * usava para extrair o número casava com o `0` de `[0m` do código ANSI de cor,
 * nunca com a contagem. Medição de mutação também precisa ser conferida.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");

/* Os arquivos da festa. EventosAgenda/EventosPainel já tinham trava própria
   (exigirModulo_) e entram na varredura pelo mesmo critério. */
const ARQUIVOS = [
  "EventosEmissao.gs", "EventosEmissaoV2.gs", "EventosCheckin.gs",
  "EventosCheckinPainel.gs", "EventosInscricoesV2.gs", "EventosValidacao.gs",
  "EventosIngresso.gs", "EventosSeguranca.gs", "EventosSimulador.gs",
  "EventosFirebaseCusto.gs", "EventosPainel.gs", "EventosAgenda.gs"
];

const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

/* Comentário é intenção; o teste olha o que EXECUTA. Sem isto, a própria
   documentação desta correção faria as asserções passarem. */
const semComentario = s => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** Recorta o corpo de cada função top-level de um arquivo .gs. */
function funcoesDe(codigo) {
  const out = [];
  const re = /^function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/gm;
  let m;
  while ((m = re.exec(codigo)) !== null) {
    const nome = m[1], args = m[2];
    /* Fecha por contagem de chaves a partir da abertura. Basta para este
       projeto: os .gs não têm chave dentro de string em posição de topo. */
    let prof = 1, i = re.lastIndex;
    while (i < codigo.length && prof > 0) {
      const c = codigo[i];
      if (c === "{") prof++;
      else if (c === "}") prof--;
      i++;
    }
    out.push({ nome, args, corpo: codigo.slice(re.lastIndex, i) });
  }
  return out;
}

fluxo("COMPASSO · Quem chama tem de se identificar");

/* ─── 1. a varredura: nenhuma exposta sem trava ─── */
passo("as funções alcançáveis pelo google.script.run");

const TRAVA = /exigirAdminOuSessao_\s*\(|exigirModulo_\s*\(|exigirSessaoDocumentos_\s*\(/;

const expostas = [];
const semTrava = [];
ARQUIVOS.forEach(arq => {
  funcoesDe(semComentario(ler(arq))).forEach(f => {
    if (/_$/.test(f.nome)) return;            // privada: a web não alcança
    expostas.push(arq + ":" + f.nome);
    if (!TRAVA.test(f.corpo)) semTrava.push(arq + ":" + f.nome);
  });
});

ok(expostas.length >= 30,
   "a varredura encontrou as funções expostas (" + expostas.length + ")",
   "se este número desabar, o recorte quebrou e as asserções abaixo viram vácuo");

igual(semTrava, [],
      "nenhuma função exposta fica sem trava de identidade",
      "toda global sem _ é alcançável por google.script.run de qualquer página");

/* ─── 2. o que exige administrador, não só acesso ao módulo ─── */
passo("as ações que não podem ser de qualquer usuário do módulo");

const ADMIN_OBRIGATORIO = {
  "EventosSeguranca.gs":    ["compasso_regenerarQrToken"],
  "EventosEmissaoV2.gs":    ["compasso_cancelarIngressoV2"],
  "EventosCheckin.gs":      ["compasso_desfazerCheckin"],
  "EventosInscricoesV2.gs": ["compasso_criarInclusaoAdministrativa"],
  "EventosIngresso.gs":     ["compasso_configurarArteBaseDrive"],
  "EventosSimulador.gs":    ["compasso_simulacaoIniciar", "compasso_simulacaoExecutarLote",
                             "compasso_simularMassa", "compasso_testeDuplicidade",
                             "compasso_testeQrReutilizado"],
  "EventosEmissao.gs":      ["emissao_limparTestes", "emissao_cancelarIngresso",
                             "emissao_ativarProducao", "emissao_ativarTeste"]
};

const semAdmin = [];
Object.keys(ADMIN_OBRIGATORIO).forEach(arq => {
  const mapa = {};
  funcoesDe(semComentario(ler(arq))).forEach(f => { mapa[f.nome] = f.corpo; });
  ADMIN_OBRIGATORIO[arq].forEach(nome => {
    const corpo = mapa[nome];
    if (corpo === undefined) { semAdmin.push(arq + ":" + nome + " (sumiu)"); return; }
    /* O 4º argumento de exigirAdminOuSessao_ é exigeAdmin. */
    if (!/exigirAdminOuSessao_\s*\([^)]*,\s*true\s*\)/.test(corpo)) semAdmin.push(arq + ":" + nome);
  });
});

igual(semAdmin, [],
      "as 14 ações irreversíveis exigem administrador",
      "regerar QR devolve entrada válida; limparTestes zera as 2.000 vagas");

/* ─── 3. o modo teste: fecha em produção, abre sozinho em homologação ─── */
passo("as quatro combinações de configuração");

const emissao = semComentario(ler("EventosEmissao.gs"));

/* Aqui o teste EXECUTA a função, em vez de varrer texto. É o único jeito de
   provar uma tabela-verdade: quatro combinações, quatro respostas. O corpo é
   extraído do .gs real e avaliado contra um PropertiesService de mentira. */
function modoTesteCom(evento, ambiente) {
  const achada = funcoesDe(emissao).find(f => f.nome === "emissao_modoTeste_");
  if (!achada) throw new Error("emissao_modoTeste_ não encontrada");
  /* funcoesDe fecha UMA posição depois da chave final, então o corpo vem com
     o `}` de fechamento junto. Para as asserções de regex isso é inofensivo;
     para new Function() é erro de sintaxe. Corta aqui, no ponto de uso, em
     vez de mudar funcoesDe e mexer no que já passa. */
  const corpo = { corpo: achada.corpo.replace(/\}\s*$/, "") };
  const props = {};
  if (evento   !== null) props.EVENTO_MODO_TESTE = evento;
  if (ambiente !== null) props.SISGEP_AMBIENTE   = ambiente;
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null)
    })
  };
  return new Function("PropertiesService", corpo.corpo)(PropertiesService);
}

igual(modoTesteCom(null, null), false,
      "nada declarado → PRODUÇÃO",
      "falha fechado: sem configuração nenhuma, o período é exigido");

igual(modoTesteCom(null, "homologacao"), true,
      "só SISGEP_AMBIENTE=homologacao → TESTE, sem mais nada a configurar",
      "REGRA Nº 0.6 — o sistema já sabe onde está; não é a pessoa que conta de novo");

igual(modoTesteCom("false", "homologacao"), false,
      "EVENTO_MODO_TESTE=false vence a herança",
      "dá para exigir o período dentro da homologação, se for isso que se quer testar");

igual(modoTesteCom("true", null), true,
      "EVENTO_MODO_TESTE=true vence em qualquer ambiente");

/* A trava que importa: produção NÃO pode virar teste por herança. */
igual(modoTesteCom(null, "producao"), false,
      "SISGEP_AMBIENTE=producao nunca herda modo teste");

ok(!/getProperty\('EVENTO_MODO_TESTE'\)\s*!==\s*'false'/.test(emissao),
   "e o padrão antigo (!== 'false') não voltou");

passo("a origem do modo aparece para quem olha");

ok(/function\s+emissao_modoTesteOrigem_/.test(emissao),
   "existe função que explica DE ONDE veio o modo");

ok(/modoTesteOrigem/.test(semComentario(ler("EventosPainel.gs"))),
   "o status da tela devolve a origem junto do fato");

ok(/modoTesteOrigem/.test(ler("EventoPainel.html")),
   "e a tarja MODO TESTE carrega a origem",
   "tarja sem causa visível engana quem passa o olho");

/* ─── 4. nenhuma planilha de produção fixa ─── */
passo("o ID da planilha");

const PRODUCAO_ID = "1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E";
const comIdFixo = ARQUIVOS.filter(a => ler(a).indexOf(PRODUCAO_ID) >= 0);

igual(comIdFixo, [],
      "nenhum arquivo de Eventos carrega o ID de produção fixo",
      "com ele, a busca de associado de HOMOLOGAÇÃO lia a base real de 8.000 pessoas");

ok(/SpreadsheetApp\.openById\(getPlanilhaId\(\)\)/.test(emissao),
   "a busca de associado resolve a planilha por getPlanilhaId()");

ok(!/PLANILHA_ID\s*:/.test(emissao.slice(0, emissao.indexOf("function"))),
   "e o EMISSAO_CFG não declara PLANILHA_ID",
   "chamar getPlanilhaId() no topo dependeria da ordem de avaliação dos .gs");

/* ─── 5. as telas mandam o token ─── */
passo("o que a tela envia junto");

["EventosPortaria.html", "EventosValidacaoAdmin.html"].forEach(tela => {
  const html = ler(tela);
  ok(/var COMPASSO_TOKEN=/.test(html),
     tela + " lê o token da URL");
  ok(/r\[fn\]\.apply\(r,\(args\|\|\[\]\)\.concat\(\[COMPASSO_TOKEN\]\)\)/.test(html),
     tela + " concatena o token em toda chamada",
     "é um dispatcher só — se ele não mandar, nenhuma chamada manda");
});

/* Contraprova do desenho: as 9 chamadas passam os argumentos posicionais
   completos, então o token cai sempre no último parâmetro. Se alguém omitir um
   argumento no meio, o token vira o argumento errado e a trava recusa. */
const chamadas = ["EventosPortaria.html", "EventosValidacaoAdmin.html"]
  .reduce((n, t) => n + (ler(t).match(/api\('compasso_/g) || []).length, 0);
/* 21/08: subiu de 9 para 12 com o bloco de pagamento (pagamentoOpcoes,
   confirmarPagamento, estornarPagamento). O número é trava proposital, e
   funcionou: ele reprovou assim que as chamadas novas entraram, e só subiu
   depois de eu conferir uma a uma que passam todos os argumentos
   posicionais — sem isso o token cairia no parâmetro errado e a trava de
   sessão recusaria a chamada legítima. */
igual(chamadas, 12, "as 12 chamadas das telas continuam passando pelo dispatcher");

/* ─── 6. o simulador mantém as duas travas ─── */
passo("simulador: quem chama E onde está");

const sim = semComentario(ler("EventosSimulador.gs"));
ok(/compasso_assertHomologacao_\s*\(\s*\)/.test(sim),
   "a trava de ambiente continua de pé",
   "exigirAdminOuSessao_ diz QUEM; assertHomologacao_ diz ONDE — não se substituem");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("que a trava recusa de fato um anônimo",
      "isto varre CÓDIGO. A recusa só se prova chamando as funções no projeto " +
      "no ar, sem sessão — e o emulador não sobe google.script.run");

aviso("que a Central de Validação e a portaria continuam funcionando",
      "o token novo muda a assinatura de 32 funções. Nenhuma das duas telas " +
      "foi aberta desde a mudança: pela REGRA Nº -1 o veredito é NÃO TESTADO");

aviso("nada sobre o motor V1 x V2",
      "a emissão ligada na tela continua sendo a V1, de QR falsificável. " +
      "Isto aqui fechou o acesso; não trocou o motor");

resumo();
