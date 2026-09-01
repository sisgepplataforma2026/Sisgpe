/**
 * LIMPEZA E CENSO DAS PROPRIEDADES DO SCRIPT
 *
 * Criado em 01/09/2026, depois de medir a produção e achar 593 sessões
 * vencidas ocupando 185 KB dos 500 KB disponíveis — 37% do teto, acumulando
 * desde 09/07 a 3,48 KB por dia. No ritmo medido, o armazenamento estoura por
 * volta de 30/11/2026.
 *
 * POR QUE ISSO É GRAVE E NÃO SÓ BAGUNÇA
 *
 * O que quebra quando o teto chega é o LOGIN, porque é ali que a sessão é
 * gravada (`Sessao.gs`, no `salvarSessaoUsuario_`). E o login da produção é a
 * porta da emissão de ofícios, que é a única operação viva do sindicato. O
 * erro não vai dizer "excesso de sessões velhas": vai dizer que não conseguiu
 * gravar, e ninguém vai ligar uma coisa à outra.
 *
 * POR QUE ESTE ARQUIVO EXISTE, EM VEZ DE USAR O `Sessao.gs`
 *
 * O `Sessao.gs` do repositório já tem `limparSessoesExpiradas_`, e ela roda na
 * homologação com gatilho diário desde 31/08. Só que o repositório e o projeto
 * de produção DIVERGEM — é fato registrado no CLAUDE.md, e o pull de 05/08 já
 * veio parcial. Levar o `Sessao.gs` inteiro para a produção para ganhar uma
 * função de manutenção significaria sobrescrever o arquivo do login com uma
 * versão que ninguém conferiu linha a linha. É a pior troca possível.
 *
 * Este arquivo não toca em nada que existe. Só acrescenta funções. Se der
 * errado, apaga o arquivo e a produção volta exatamente ao que era.
 *
 * O QUE ELE FAZ DE DIFERENTE DO `Sessao.gs`
 *
 * 1. VAI EM LOTES. Na homologação foram 62 exclusões em 19 segundos — cerca de
 *    0,3 s cada. Na produção são 593, o que daria uns 3 minutos, contra um
 *    limite de execução de 6. Perto demais para confiar. Aqui o padrão é 200
 *    por execução (~1 minuto): roda-se três vezes até `concluido` vir `true`.
 *
 * 2. NÃO USA `setProperties(obj, true)`. Esse modo apaga tudo que não está no
 *    objeto e resolveria a faxina numa chamada só — e é exatamente por isso que
 *    não está aqui: um erro na montagem do objeto zera as 96 propriedades de
 *    configuração da produção de uma vez. Exclusão uma a uma é mais lenta e não
 *    tem como errar em bloco.
 *
 * 3. FAZ CENSO POR FAMÍLIA. Sessão não é a única coisa que se acumula: o
 *    `TOKEN_GUIA_` tem o mesmo defeito — o `buscarGuiaPorToken_`
 *    (`GuiasPagamento.gs:2191`) devolve `null` quando o token venceu, mas não
 *    apaga. O censo conta essas famílias e NÃO mexe nelas: apagar token de
 *    guia é decisão de produto, não de manutenção, e este arquivo não toma
 *    decisão de produto.
 *
 * A GARANTIA QUE IMPORTA
 *
 * Só apaga o que tem `expiraEm` no passado. Sessão viva não é tocada — e isso
 * não é promessa de comentário, é o que o `t116` cobra em execução, do mesmo
 * jeito que o `t115` cobra a função do `Sessao.gs`. Uma limpeza que apaga
 * sessão viva derruba a pessoa no meio do trabalho e troca um problema lento
 * por um imediato que ninguém liga à faxina que rodou de madrugada.
 *
 * QUANDO APAGAR ESTE ARQUIVO
 *
 * No dia em que a produção for sincronizada com o repositório e passar a ter o
 * `Sessao.gs` de lá, esta ponte fica redundante: remover o arquivo e o gatilho
 * `lpLimpezaDiaria`, deixando o `limparSessoesExpiradasDiario` como único.
 * Dois gatilhos fazendo a mesma faxina não causam dano — a operação é
 * idempotente —, mas é configuração duplicada, que é como se perde o rastro do
 * que está ligado.
 */

var LP_PREFIXO_SESSAO = "SESSAO_SISGEP_";
var LP_LOTE_PADRAO = 200;

/** Famílias conhecidas, para o censo. A ordem importa: a primeira que casar vence. */
var LP_FAMILIAS = [
  { rotulo: "Sessões de login",       prefixo: "SESSAO_SISGEP_" },
  { rotulo: "Tokens de guia",         prefixo: "TOKEN_GUIA_" },
  { rotulo: "Bloqueio de login",      prefixo: "LOGIN_" },
  { rotulo: "Recuperação de senha",   prefixo: "RECUPERAR_SENHA_" }
];

/** Classifica uma chave numa família, ou em "Configuração e outras". */
function lp_familia_(chave) {
  for (var i = 0; i < LP_FAMILIAS.length; i++) {
    if (String(chave).indexOf(LP_FAMILIAS[i].prefixo) === 0) return LP_FAMILIAS[i].rotulo;
  }
  return "Configuração e outras";
}

/**
 * PORTA DA MANUTENÇÃO — quem pode rodar isto.
 *
 * Isto não é zelo teórico: o `t6-exposicao` reprovou a primeira versão deste
 * arquivo. No Apps Script NÃO existe rota para `google.script.run` — toda
 * função global é endpoint para qualquer página do projeto, inclusive as
 * páginas anônimas que o `Code.gs` serve. Sem porta, um visitante qualquer
 * chamaria `lpRemoverGatilho()` e desligaria a faxina em silêncio; ninguém
 * perceberia até o armazenamento encher e o login parar.
 *
 * A porta usa só o que o Apps Script dá de fábrica, sem depender de nenhum
 * helper do projeto — este arquivo tem de funcionar colado num ambiente cujo
 * código diverge do repositório.
 *
 * No editor, `getActiveUser` e `getEffectiveUser` devolvem a mesma pessoa: o
 * dono rodando à mão. Num app publicado "executar como eu", o visitante tem
 * `getActiveUser` vazio (anônimo) ou diferente do dono. Só o primeiro caso
 * passa.
 */
function lp_exigirDono_() {
  var quem = "", dono = "";
  try { quem = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
  try { dono = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) {}
  if (!quem || !dono || quem !== dono) {
    throw new Error(
      "Sem permissão: função de manutenção. Só roda pelo editor do Apps Script, " +
      "por quem é dono do script.");
  }
  return quem;
}

/**
 * Conta as propriedades por família e mede o espaço. NÃO apaga nada e NÃO
 * devolve valor nenhum de propriedade — só contagem e tamanho, para que
 * rodar isto nunca possa vazar segredo.
 */
function lp_censo_() {
  var todas = PropertiesService.getScriptProperties().getProperties();
  var nomes = Object.keys(todas);

  var porFamilia = {};
  var bytes = 0;
  var sessoesVivas = 0, sessoesVencidas = 0, sessoesQuebradas = 0;
  var maisAntiga = null, maisNova = null;
  var agora = new Date().getTime();

  nomes.forEach(function (chave) {
    var valor = String(todas[chave] == null ? "" : todas[chave]);
    bytes += chave.length + valor.length;

    var fam = lp_familia_(chave);
    if (!porFamilia[fam]) porFamilia[fam] = { itens: 0, bytes: 0 };
    porFamilia[fam].itens++;
    porFamilia[fam].bytes += chave.length + valor.length;

    if (chave.indexOf(LP_PREFIXO_SESSAO) !== 0) return;
    try {
      var s = JSON.parse(valor);
      var expira = Number(s.expiraEm || 0);
      var criado = Number(s.criadoEm || 0);
      if (criado) {
        if (!maisAntiga || criado < maisAntiga) maisAntiga = criado;
        if (!maisNova || criado > maisNova) maisNova = criado;
      }
      if (expira && expira > agora) sessoesVivas++; else sessoesVencidas++;
    } catch (e) {
      sessoesQuebradas++;
    }
  });

  return {
    total: nomes.length,
    bytes: bytes,
    porFamilia: porFamilia,
    sessoesVivas: sessoesVivas,
    sessoesVencidas: sessoesVencidas,
    sessoesQuebradas: sessoesQuebradas,
    maisAntiga: maisAntiga,
    maisNova: maisNova
  };
}

/** Data legível, ou travessão quando não há. */
function lp_data_(ms) {
  if (!ms) return "—";
  try {
    return Utilities.formatDate(new Date(Number(ms)), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  } catch (e) {
    return String(ms);
  }
}

/**
 * CENSO — só lê. Ponto de partida: rodar isto antes de qualquer limpeza, para
 * saber o tamanho do problema e ter com que comparar depois.
 */
function censoPropriedades() {
  lp_exigirDono_();
  var c = lp_censo_();
  var teto = 500 * 1024;
  var pct = (c.bytes / teto) * 100;

  var l = [];
  l.push("═══════════════════════════════════════════════════════════");
  l.push("  CENSO DAS PROPRIEDADES DO SCRIPT");
  l.push("═══════════════════════════════════════════════════════════");
  l.push("  Propriedades no total : " + c.total);
  l.push("  Espaço usado          : " + (c.bytes / 1024).toFixed(1) +
         " KB de 500 KB  (" + pct.toFixed(1) + "%)");
  l.push("");
  l.push("  ── por família ────────────────────────────────────────");
  Object.keys(c.porFamilia).sort().forEach(function (fam) {
    var f = c.porFamilia[fam];
    l.push("  " + fam + ": " + f.itens + "  (" + (f.bytes / 1024).toFixed(1) + " KB)");
  });
  l.push("");
  l.push("  ── sessões ────────────────────────────────────────────");
  l.push("  Vivas, a preservar    : " + c.sessoesVivas);
  l.push("  Vencidas, a apagar    : " + c.sessoesVencidas);
  l.push("  Corrompidas           : " + c.sessoesQuebradas);
  l.push("  Mais antiga           : " + lp_data_(c.maisAntiga));
  l.push("  Mais nova             : " + lp_data_(c.maisNova));

  if (pct >= 70) {
    l.push("");
    l.push("  ⚠ ACIMA DE 70% DO TETO — o que quebra ao encher é o LOGIN.");
  }
  l.push("═══════════════════════════════════════════════════════════");

  var texto = l.join("\n");
  Logger.log(texto);
  return {
    ok: true, total: c.total, bytes: c.bytes, percentual: Number(pct.toFixed(1)),
    sessoesVivas: c.sessoesVivas, sessoesVencidas: c.sessoesVencidas,
    sessoesCorrompidas: c.sessoesQuebradas, relatorio: texto
  };
}

/**
 * Varre as sessões e remove as vencidas, EM LOTES.
 *
 * @param {boolean} simular  true = só conta, não apaga.
 * @param {number}  limite   máximo de exclusões nesta execução (padrão 200).
 * @returns {Object} com `concluido` dizendo se ainda sobrou trabalho.
 */
function lp_limparSessoes_(simular, limite) {
  var max = Number(limite) > 0 ? Number(limite) : LP_LOTE_PADRAO;
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  var agora = new Date().getTime();

  var vivas = 0, vencidas = 0, corrompidas = 0, apagadas = 0, restam = 0;

  Object.keys(todas).forEach(function (chave) {
    if (chave.indexOf(LP_PREFIXO_SESSAO) !== 0) return;

    var expirada = false;
    try {
      var s = JSON.parse(String(todas[chave]));
      var expira = Number(s.expiraEm || 0);
      /* SESSÃO VIVA — não se toca, e é aqui que mora a única forma de esta
         função causar dano. Apagar uma destas derruba a pessoa no meio do
         trabalho. */
      if (expira && expira > agora) { vivas++; return; }
      expirada = true;
      vencidas++;
    } catch (e) {
      /* JSON quebrado nunca vai autenticar ninguém e ocupa espaço igual. */
      corrompidas++;
      expirada = true;
    }

    if (!expirada) return;
    if (simular) return;
    if (apagadas >= max) { restam++; return; }

    props.deleteProperty(chave);
    try { CacheService.getScriptCache().remove(chave); } catch (eCache) {}
    apagadas++;
  });

  var alvo = vencidas + corrompidas;
  var sobra = simular ? alvo : restam;

  var l = [];
  l.push("═══════════════════════════════════════════════════════════");
  l.push("  LIMPEZA DE SESSÕES" + (simular ? " — SIMULAÇÃO (nada foi apagado)" : ""));
  l.push("═══════════════════════════════════════════════════════════");
  l.push("  Vivas, preservadas    : " + vivas);
  l.push("  Vencidas encontradas  : " + vencidas);
  l.push("  Corrompidas           : " + corrompidas);
  l.push("  Apagadas nesta execução: " + apagadas + (simular ? "" : "  (teto do lote: " + max + ")"));
  l.push("  Ainda por apagar      : " + sobra);
  l.push(sobra > 0
    ? "  ➜ RODE DE NOVO — ainda sobrou trabalho."
    : "  ✅ CONCLUÍDO — não há mais sessão vencida.");
  l.push("═══════════════════════════════════════════════════════════");

  var texto = l.join("\n");
  Logger.log(texto);
  return {
    ok: true, simulacao: simular === true, vivas: vivas, vencidas: vencidas,
    corrompidas: corrompidas, apagadas: apagadas, restam: sobra,
    concluido: sobra === 0, relatorio: texto
  };
}

/** SIMULAÇÃO — conta o que seria apagado, sem apagar. Comece por aqui. */
function simularLimpezaSessoes() {
  lp_exigirDono_();
  return lp_limparSessoes_(true, 0);
}

/**
 * LIMPEZA REAL, um lote de 200 por execução. Rode quantas vezes forem
 * necessárias, até o relatório dizer CONCLUÍDO.
 */
function limparSessoesLote() {
  lp_exigirDono_();
  return lp_limparSessoes_(false, LP_LOTE_PADRAO);
}

/**
 * Ponto de entrada do gatilho.
 *
 * NÃO leva `lp_exigirDono_`, de propósito: gatilho roda sem usuário ativo, e a
 * porta barraria a própria faxina diária. O risco de deixar aberta é aceitável
 * porque esta função só apaga sessão JÁ VENCIDA — quem a chamasse de fora não
 * conseguiria derrubar ninguém nem ler nada. É o contrário de `lpRemoverGatilho`,
 * que desligaria a proteção e por isso é fechada.
 */
function lpLimpezaDiaria() {
  return lp_limparSessoes_(false, 5000);
}

/**
 * Instala o gatilho diário às 3h. Apaga o anterior antes de criar, para não
 * acumular gatilho duplicado a cada reinstalação.
 */
function lpInstalarGatilho() {
  lp_exigirDono_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "lpLimpezaDiaria") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("lpLimpezaDiaria").timeBased().everyDays(1).atHour(3).create();
  Logger.log("✅ Gatilho instalado — limpeza diária às 3h (lpLimpezaDiaria).");
  return { ok: true, mensagem: "Gatilho lpLimpezaDiaria instalado (diário, 3h)." };
}

/** Remove o gatilho. */
function lpRemoverGatilho() {
  lp_exigirDono_();
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "lpLimpezaDiaria") { ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log("✅ Gatilho removido (" + n + ").");
  return { ok: true, removidos: n };
}
