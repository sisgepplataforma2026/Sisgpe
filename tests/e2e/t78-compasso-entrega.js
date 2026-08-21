/**
 * O INGRESSO CHEGA NA PESSOA — E SÓ NELA
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. A verificação de completude achou o buraco central do módulo: a
 * cadeia V2 ia até a emissão e PARAVA. O ingresso existia no Firestore e o
 * associado nunca ficava sabendo.
 *
 * O usuário descreveu o fluxo e o requisito, nas palavras dele: "eu só preciso
 * que seja testado todas as funções, só preciso que o ingresso seja confiável,
 * o QR Code, que não tenha duplicidade". E: "que seja simples porque nem todo
 * associado tem tanta habilidade com informática".
 *
 * O DESENHO QUE ESTE TESTE GUARDA
 *
 * O associado não tem conta no SISGEP. Então o que ele recebe é um link, e o
 * token HMAC É A CREDENCIAL. Isso só é seguro se o token realmente não puder
 * ser forjado nem reaproveitado — e é exatamente isso que as asserções abaixo
 * medem, EXECUTANDO a função de validação contra mocks, não lendo o código.
 *
 * A TABELA-VERDADE DO TOKEN, que é o coração
 *
 *   vazio ............................ recusa
 *   formato errado ................... recusa
 *   prefixo de outro evento .......... recusa
 *   assinatura HMAC não bate ......... recusa   ← é o que impede forjar
 *   assinatura bate, não foi emitido . recusa   ← é o que impede reusar
 *   token cancelado .................. recusa
 *   ingresso cancelado ............... recusa
 *   tudo certo ....................... devolve o ingresso
 *
 * E TODAS as recusas devolvem null igual, sem distinguir o caso: dizer "token
 * válido mas cancelado" para quem chutou já entrega informação.
 *
 * VER NÃO É ENTRAR
 *
 * A rota pública mostra o ingresso e NÃO faz check-in. Se abrir o link
 * consumisse a entrada, quem conferisse o próprio ingresso em casa chegaria na
 * portaria com ele já utilizado. É o erro mais fácil de cometer aqui.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. tirar a conferência do HMAC .............................. 1 falha
 *   2. aceitar token que não consta em qrTokens ................. 1 falha
 *   3. mostrar ingresso cancelado ............................... 1 falha
 *   4. a rota pública passar a escrever ......................... 1 falha
 *   5. marcar entrega de WhatsApp já no preparar ................ 1 falha
 *   6. tirar o orçamento de tempo do lote ....................... 1 falha
 *   7. o lote parar de devolver o que faltou .................... 1 falha
 *   8. o PDF voltar a depender de host externo ................. 2 falhas
 *   9. o lote parar de conferir a cota do Gmail ................. 1 falha
 *
 * O QUE A MUTAÇÃO CORRIGIU NO PRÓPRIO TESTE
 *
 * Na primeira rodada, TRÊS mutações sobreviveram — todas por asserção minha
 * frouxa, procurando no arquivo inteiro em vez do corpo da função. A #1 foi a
 * mais instrutiva: ela mostrou que o HMAC NÃO é o que impede forjar um
 * ingresso (quem impede é o índice qrTokens), e sim o que barra o lixo antes
 * de gastar leitura do Firestore numa rota pública. A asserção passou a medir
 * isso, que é o que a camada de fato entrega.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

const semComentario = s => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const ent = semComentario(ler("EventosEntrega.gs"));
const code = semComentario(ler("Code.gs"));

/** Recorta o corpo de uma função top-level, já sem a chave de fechamento. */
function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1], corpo: codigo.slice(m.index + m[0].length, i - 1) };
}

fluxo("ENTREGA · O ingresso chega na pessoa, e só nela");

/* ─── 1. A TABELA-VERDADE DO TOKEN, executada ─── */
passo("o que o link público aceita e o que recusa");

/* Mundo de mentira: um evento, um ingresso emitido, um token válido.
   A assinatura é determinística sobre o ingressoId, como no sistema real. */
const EVENTO = "festa-compasso-2026";
const assinar = id => "sig(" + id + ")";
const tokenBom = "C26.ING-1.sig(ING-1)";

function validarCom(token, mundo) {
  mundo = mundo || {};
  const { corpo } = corpoDe(ent, "compasso_validarQrTokenPublico_");
  const qrTokens = Object.assign(
    { ["hash:" + tokenBom]: { eventoId: EVENTO, ingressoId: "ING-1", status: "ATIVO" } },
    mundo.qrTokens || {});
  const ingressos = Object.assign(
    { "ING-1": { ingressoId: "ING-1", eventoId: EVENTO, numero: "FCV-2026-000001",
                 nome: "Maria", status: "EMITIDO" } },
    mundo.ingressos || {});

  const EMISSAO_CFG = { EVENTO_ID: EVENTO };
  const compasso_gerarQrToken_ = id => {
    if (!id) throw new Error("ingressoId obrigatório.");
    return "C26." + id + "." + assinar(id).replace("sig(" + id + ")", "sig(" + id + ")");
  };
  const compasso_hash_ = t => "hash:" + t;
  const fs_get_ = (col, id) => (col === "qrTokens" ? qrTokens[id] : ingressos[id]) || null;

  return new Function(
    "token", "EMISSAO_CFG", "compasso_gerarQrToken_", "compasso_hash_", "fs_get_",
    corpo
  )(token, EMISSAO_CFG, compasso_gerarQrToken_, compasso_hash_, fs_get_);
}

igual(validarCom(""), null, "token vazio → recusa");
igual(validarCom("qualquer-coisa"), null, "formato errado → recusa");
igual(validarCom("XX9.ING-1.sig(ING-1)"), null,
      "prefixo de outro evento → recusa");
igual(validarCom("C26..sig()"), null, "sem ingressoId → recusa");

igual(validarCom("C26.ING-1.assinatura-inventada"), null,
      "assinatura HMAC que não bate → recusa");

/* CORREÇÃO DE MEDIÇÃO (21/08): a asserção acima dizia que o HMAC "é o que
   impede forjar". A mutação provou que não é — tirando a conferência do HMAC,
   o token inventado continua sendo recusado, porque o hash dele não consta em
   qrTokens. Quem barra a forja é a consulta ao índice.

   O que o HMAC faz, e é real, é barrar ANTES de gastar uma leitura do
   Firestore. Numa página pública isso importa: qualquer um pode disparar a
   rota com lixo, e cada lixo custaria uma leitura. Então a asserção passa a
   medir isso — que é o que a camada de fato entrega. */
function fsGetChamadoCom(token) {
  const { corpo } = corpoDe(ent, "compasso_validarQrTokenPublico_");
  let chamou = 0;
  const EMISSAO_CFG = { EVENTO_ID: EVENTO };
  const compasso_gerarQrToken_ = id => {
    if (!id) throw new Error("ingressoId obrigatório.");
    return "C26." + id + ".sig(" + id + ")";
  };
  new Function("token", "EMISSAO_CFG", "compasso_gerarQrToken_", "compasso_hash_", "fs_get_", corpo)(
    token, EMISSAO_CFG, compasso_gerarQrToken_,
    t => "hash:" + t,
    () => { chamou++; return null; }
  );
  return chamou;
}

igual(fsGetChamadoCom("C26.ING-1.assinatura-inventada"), 0,
      "token com assinatura errada é barrado SEM tocar no Firestore",
      "a rota é pública: sem o HMAC, cada chute de qualquer um custaria uma leitura");

igual(fsGetChamadoCom(tokenBom) > 0, true,
      "e o token legítimo chega até a consulta do índice");

igual(validarCom("C26.ING-99.sig(ING-99)", { ingressos: {} }), null,
      "assinatura bate mas o token não foi emitido → recusa",
      "estar bem formado não basta: tem de constar em qrTokens");

igual(validarCom(tokenBom, {
        qrTokens: { ["hash:" + tokenBom]: { eventoId: EVENTO, ingressoId: "ING-1", status: "CANCELADO" } }
      }), null,
      "token cancelado → recusa");

igual(validarCom(tokenBom, {
        ingressos: { "ING-1": { ingressoId: "ING-1", eventoId: EVENTO, status: "CANCELADO" } }
      }), null,
      "ingresso cancelado → recusa");

igual(validarCom(tokenBom, {
        qrTokens: { ["hash:" + tokenBom]: { eventoId: "outro-evento", ingressoId: "ING-1", status: "ATIVO" } }
      }), null,
      "token de OUTRO evento → recusa");

const bom = validarCom(tokenBom);
ok(bom && bom.numero === "FCV-2026-000001",
   "token legítimo → devolve o ingresso certo");

/* Todas as recusas são o MESMO null — sem vazar qual foi o motivo. */
ok(/return null;/.test(ent) && !/erro:\s*'token/i.test(ent),
   "toda recusa devolve o mesmo nada",
   "distinguir 'inválido' de 'cancelado' entrega informação a quem chutou");

/* ─── 2. ver não é entrar ─── */
passo("a rota pública NÃO faz check-in");

const pagina = corpoDe(ent, "compasso_paginaIngressoPublica_").corpo;
const ESCRITAS_PROIBIDAS = ["fs_set_", "compasso_checkin", "UTILIZADO", "setValue"];
igual(ESCRITAS_PROIBIDAS.filter(m => new RegExp(m).test(pagina)), [],
      "a página pública não escreve nada nem marca entrada",
      "se abrir o link consumisse o ingresso, conferir em casa queimaria a entrada");

ok(/p\.page === "ingresso"/.test(code),
   "a rota ?page=ingresso existe no doGet");

/* NADA pode gatear o visitante anônimo antes desta rota. A primeira versão
   desta asserção comparava a posição com o primeiro getSessaoUsuario do
   ARQUIVO, que nem está dentro do doGet — media a coisa errada e reprovou
   sem motivo. O que importa é o trecho de doGet ATÉ a rota. */
const doGet = code.slice(code.indexOf("function doGet"),
                         code.indexOf('p.page === "ingresso"'));
const PORTEIROS = ["getSessaoUsuario", "exigirModulo_", "exigirSessao",
                   "createHtmlOutputFromFile(\"Login\")"];
igual(PORTEIROS.filter(p => doGet.indexOf(p) >= 0), [],
      "nada exige sessão antes desta rota, dentro do doGet",
      "o associado não tem conta no SISGEP — cair no login seria o fim do fluxo");

/* ─── 3. o PDF não pode depender de script externo ─── */
passo("o QR dentro do PDF");

/* Escopado ao CORPO da função do PDF. A primeira versão procurava no arquivo
   inteiro, e passava mesmo quando o call site voltava a apontar para um host
   externo — a função helper continuava definida logo acima. */
const pdf = corpoDe(ent, "compasso_ingressoPdf_").corpo;

ok(/compasso_qrPngDataUri_\s*\(/.test(pdf),
   "o PDF embute o QR como imagem base64",
   "o template da tela gera QR por script de CDN, e script NÃO roda na " +
   "conversão para PDF — o código sairia em branco no papel");

ok(!/https?:\/\//.test(pdf),
   "e o HTML do PDF não busca NENHUM host externo",
   "o conversor não busca host externo de forma confiável — lição do VoucherPdf.gs");
ok(!/cdnjs|qrcode\.min\.js|<script/.test(pdf),
   "e o HTML do PDF não tem script nenhum");

ok(/UMA entrada/.test(pdf),
   "o PDF avisa que o ingresso vale para uma entrada só");

/* ─── 4. a entrega fica registrada ─── */
passo("por onde e quando o ingresso saiu");

ok(/entregaCanais/.test(ent) && /entregaEmailEm/.test(ent) && /entregaWhatsEm/.test(ent),
   "cada canal grava sua própria data",
   "é daqui que sai o filtro A ENVIAR da tela de gestão");

ok(/compasso_auditar_\('ENTREGA_INGRESSO'/.test(ent),
   "e toda entrega vira linha de auditoria");

/* O WhatsApp em dois tempos: preparar NÃO marca entrega. */
const prepara = corpoDe(ent, "compasso_prepararIngressoWhatsApp").corpo;
ok(!/compasso_registrarEntrega_/.test(prepara),
   "preparar o WhatsApp NÃO marca entrega",
   "o sistema não sabe se a pessoa apertou enviar — quem confirma é ela");

const confirma = corpoDe(ent, "compasso_confirmarEnvioWhatsApp").corpo;
ok(/compasso_registrarEntrega_/.test(confirma),
   "e existe o passo separado que confirma");

ok(/wa\.me|telefone: fone/.test(ent) && !/UrlFetchApp[\s\S]{0,80}whats/i.test(ent),
   "o WhatsApp sai pelo wa.me, não por API",
   "o projeto não tem API de WhatsApp — e o usuário pediu semiautomatizado");

/* ─── 5. o lote respeita as travas reais ─── */
passo("enviar em lote sem estourar cota nem tempo");

/* Escopado ao corpo do LOTE. No arquivo inteiro isto passava por causa do
   compasso_capacidadeEnvio, que também lê a cota — e o lote podia ter parado
   de conferir sem ninguém notar. */
const loteCorpo = corpoDe(ent, "compasso_enviarLoteEmail").corpo;
ok(/MailApp\.getRemainingDailyQuota/.test(loteCorpo),
   "o lote lê a cota diária de e-mail ANTES de começar",
   "melhor avisar que restam 40 do que mandar 40 e falhar no 41");

ok(/compasso_capacidadeEnvio/.test(ent),
   "e a tela consegue perguntar a capacidade antes de a pessoa selecionar 300");

ok(/COMPASSO_LOTE_SEGUNDOS\s*=\s*\d+/.test(ent),
   "há orçamento de tempo declarado");
const orc = Number((ent.match(/COMPASSO_LOTE_SEGUNDOS\s*=\s*(\d+)/) || [])[1] || 0);
ok(orc > 0 && orc <= 300, "e cabe nos 6 minutos (" + orc + "s)");

ok(/Date\.now\(\) - inicio > COMPASSO_LOTE_SEGUNDOS/.test(loteCorpo),
   "o laço confere o tempo a cada envio");

ok(/restantes: restantes/.test(loteCorpo) && /parcial: restantes\.length > 0/.test(loteCorpo),
   "e devolve o que FALTOU, para continuar de onde parou",
   "sem isso um lote de 380 sumiria pela metade sem ninguém saber");

ok(/try \{ r = compasso_enviarIngressoEmail/.test(loteCorpo),
   "uma falha individual não derruba o lote inteiro",
   "quem não tem e-mail vira uma linha no relatório, não o fim do trabalho");

/* ─── 6. nada exposto sem trava ─── */
passo("as funções novas");

const semTrava = (ent.match(/^function\s+([A-Za-z0-9_]+)/gm) || [])
  .map(m => m.replace(/^function\s+/, ""))
  .filter(n => !/_$/.test(n))
  .filter(nome => !/exigirAdminOuSessao_\s*\(/.test(corpoDe(ent, nome).corpo));
igual(semTrava, [],
      "nenhuma função nova fica alcançável sem identificar quem chama",
      "mesma regra do t76 — a página pública é _ e entra pelo doGet");

/* ─── limites ─── */
fluxo("LIMITES · O que este arquivo NÃO prova");

aviso("que o e-mail chega de fato na caixa da pessoa",
      "o emulador não entrega e-mail. Só se prova enviando um de verdade " +
      "em homologação e abrindo a caixa");

aviso("que o PDF sai com o QR legível",
      "getAs(MimeType.PDF) roda no servidor do Google e o emulador não tem. " +
      "É o ponto mais provável de erro nesta entrega — abrir o PDF e LER o QR " +
      "com o celular é o teste que vale");

aviso("que o link abre para quem não está logado",
      "só se prova abrindo o link numa aba anônima, sem sessão do SISGEP");

resumo();
