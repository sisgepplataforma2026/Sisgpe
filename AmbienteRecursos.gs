// ============================================================================
// 📁 ARQUIVO: AmbienteRecursos.gs
// 🏷️  SISGEP — Resolução de pastas do Drive por ambiente
// ============================================================================
//
// O QUE ORIGINOU ESTE ARQUIVO
//
// 20/08/2026. O projeto de homologação recebeu os 219 arquivos do repositório
// e passou a rodar com o MESMO código de produção — inclusive os IDs de pasta
// do Drive, que estavam cravados linha a linha:
//
//     Comprovantes.gs:36   PASTA_COMPROVANTES_ID = "1IsHNs..."   ← produção
//     Voucher.gs:8         PASTA_VOUCHER_DOCUMENTOS_ID = "1PyMA0..." ← produção
//     SistemaConfig.gs:564 PASTA_RECIBO_ID = PASTAS.RECIBOS      ← produção
//     SistemaConfig.gs:569 PASTA_RELATORIOS_ID = PASTAS.RELATORIOS ← produção
//
// Medido: o ID de Comprovantes era byte a byte o mesmo na main e no branch de
// homologação. Ou seja, testar Comprovantes, Recibos, Relatórios ou Voucher na
// homologação gravava arquivo dentro da pasta de PRODUÇÃO — e, por causa do
// setSharing usado nesses fluxos, gravava já público.
//
// O erro era SILENCIOSO. Nada quebrava, nada avisava; o arquivo simplesmente
// aparecia no lugar errado, misturado ao acervo real do sindicato.
//
// O QUE NÃO SE FEZ AQUI
//
// Não se inventou mecanismo novo. O sistema JÁ tinha um, e ele já funcionava
// em dois lugares certos:
//
//     getAmbienteAtual()            lê a Script Property SISGEP_AMBIENTE
//     getPlanilhaId()               troca a planilha por ambiente
//     getPastaOficiosDestinoId_()   troca a pasta de OFÍCIOS por ambiente
//
// Ofícios já estava isolado. Este arquivo estende o mesmo mecanismo aos
// quatro recursos que ficaram de fora. Quem for acrescentar um quinto,
// acrescente na tabela RECURSOS_AMBIENTE — não crie outra convenção.
//
// A TRAVA, QUE É O PONTO CENTRAL
//
// Resolver o ID certo não basta: se a pasta de homologação não estiver
// configurada, o comportamento antigo volta em silêncio. Por isso
// getRecursoId_ LANÇA ERRO quando o ambiente é homologação e a resolução caiu
// no ID de produção. Nada é gravado, e a mensagem diz exatamente qual chave
// falta configurar.
//
// Em produção a trava nunca dispara: o ambiente é "producao" e o ID de
// produção é o correto.
//
// ORDEM DE CARGA — IMPORTANTE
//
// No Apps Script cada arquivo .gs é avaliado em sequência no mesmo escopo
// global. Código de TOPO de um arquivo não enxerga função declarada em
// arquivo que ainda não foi avaliado. Por isso:
//
//     getRecursoId_ SÓ pode ser chamada de DENTRO do corpo de uma função.
//
// Nunca em `var X = getRecursoId_(...)` no topo de outro arquivo. Foi essa a
// razão de as declarações de PASTA_RECIBO_ID e PASTA_RELATORIOS_ID em
// SistemaConfig.gs terem sido mantidas como estão — elas passam a valer
// apenas como PADRÃO DE PRODUÇÃO, e quem grava arquivo chama esta função.
//
// ============================================================================

/* ════════════════════════════════════════════════════════════════════════════
   TABELA DE RECURSOS

   Uma linha por pasta que existe nos dois ambientes. O valor de `producao` é
   o mesmo que estava cravado no código antes desta mudança — foi copiado, não
   redigitado, justamente porque `I` maiúsculo e `l` minúsculo são idênticos na
   tela e já custaram um dia de depuração neste projeto.
   ════════════════════════════════════════════════════════════════════════════ */
var RECURSOS_AMBIENTE = {
  COMPROVANTES: {
    rotulo:      "Comprovantes e despesas avulsas",
    producao:    "1IsHNsqHJCiMkjZiqmY3rOor_g7IoUgcv",
    homologacao: "1COhM0dIacpViZPajSrTuPA9Mfwq6Xkta"
  },
  RECIBOS: {
    rotulo:      "Recibos (pasta raiz, subpasta por ano)",
    producao:    "1gudfaRCd3LxScSsqbF1kJXeI796LHr9b",
    homologacao: "1tc21Wyl4ulIxEqlXpH6LtCKnjOwssnjr"
  },
  RELATORIOS: {
    rotulo:      "Relatórios gerados",
    producao:    "14_ea7nIXNSrMuKe8bByZ5AaEKXbUzJZr",
    homologacao: "1dIl0eav3fXD_eh_u9y-jnYquQ4UgGbQS"
  },
  VOUCHER_DOCUMENTOS: {
    rotulo:      "Documentos anexados ao voucher/bolsa",
    producao:    "1PyMA0bm0FZuyYONlY4dNNo3pgJRiI63n",
    homologacao: "1sNj2mcvuS8Cl7nojHMmdlIFyVZProPDu"
  }
};

/* Prefixo da Script Property que sobrepõe a tabela acima. Serve para trocar
   uma pasta sem mexer em código — por exemplo, apontar a homologação para uma
   pasta descartável durante um teste. A chave é o nome do recurso:

       SISGEP_PASTA_COMPROVANTES = <id>
       SISGEP_PASTA_RECIBOS      = <id>
*/
var RECURSOS_PREFIXO_PROPRIEDADE = "SISGEP_PASTA_";

/**
 * Devolve o ID da pasta do Drive correspondente a `chave` no ambiente atual.
 *
 * Ordem de resolução:
 *   1. Script Property  SISGEP_PASTA_<CHAVE>   — se existir, vence
 *   2. RECURSOS_AMBIENTE[chave][ambienteAtual]
 *   3. RECURSOS_AMBIENTE[chave].producao       — último recurso
 *
 * @param {string} chave     Nome do recurso (ver RECURSOS_AMBIENTE).
 * @param {Object=} opcoes   { semTrava: true } desliga o erro de contaminação.
 *                           Use APENAS em diagnóstico, nunca em gravação.
 * @return {string} ID da pasta.
 * @throws Se a chave não existir, ou se o ambiente for homologação e a
 *         resolução tiver caído no ID de produção (com semTrava desligado).
 */
function getRecursoId_(chave, opcoes) {
  var nome = String(chave || "").trim().toUpperCase();
  var cfg  = RECURSOS_AMBIENTE[nome];

  if (!cfg) {
    throw new Error(
      "AmbienteRecursos: recurso desconhecido \"" + chave + "\". " +
      "Recursos disponíveis: " + Object.keys(RECURSOS_AMBIENTE).join(", ") + "."
    );
  }

  var semTrava = !!(opcoes && opcoes.semTrava);
  var ambiente = recursos_ambienteAtual_();
  var origem   = "";
  var id       = "";

  /* 1 — sobreposição por Script Property. */
  var sobreposto = recursos_lerPropriedade_(RECURSOS_PREFIXO_PROPRIEDADE + nome);
  if (sobreposto) {
    id     = sobreposto;
    origem = "propriedade";
  } else if (cfg[ambiente]) {
    /* 2 — tabela, no ambiente atual. */
    id     = String(cfg[ambiente]).trim();
    origem = "tabela/" + ambiente;
  } else {
    /* 3 — último recurso: produção. */
    id     = String(cfg.producao || "").trim();
    origem = "tabela/producao (fallback)";
  }

  if (!id) {
    throw new Error(
      "AmbienteRecursos: recurso \"" + nome + "\" (" + cfg.rotulo + ") " +
      "não tem ID configurado para o ambiente \"" + ambiente + "\"."
    );
  }

  /* ── A TRAVA ────────────────────────────────────────────────────────────
     Homologação escrevendo no ID de produção é exatamente o defeito que este
     arquivo existe para impedir. Falha alto, e diz o que configurar.        */
  if (!semTrava && ambiente === "homologacao" && id === String(cfg.producao).trim()) {
    throw new Error(
      "AmbienteRecursos: BLOQUEADO. O ambiente é HOMOLOGAÇÃO, mas a pasta " +
      "resolvida para \"" + nome + "\" (" + cfg.rotulo + ") é a de PRODUÇÃO. " +
      "Gravar aqui contaminaria o acervo real do sindicato. " +
      "Configure a pasta de homologação em RECURSOS_AMBIENTE." + nome +
      ".homologacao, ou na Script Property " +
      RECURSOS_PREFIXO_PROPRIEDADE + nome + "."
    );
  }

  return id;
}

/**
 * Ambiente atual, sem depender da ordem de carga dos arquivos.
 *
 * getAmbienteAtual() vive em SistemaConfig.gs. Como esta função é chamada de
 * dentro de corpos de função (nunca no topo), ela normalmente está disponível
 * — mas o guard `typeof` segue o padrão já usado em SistemaConfig.gs:145 e
 * evita que uma mudança de ordem de arquivos derrube tudo.
 *
 * Na ausência dela, o padrão é "producao" — que é o comportamento antigo, e é
 * seguro: em produção a trava não dispara e a pasta certa é usada.
 */
function recursos_ambienteAtual_() {
  try {
    if (typeof getAmbienteAtual === "function") {
      return String(getAmbienteAtual() || "producao").toLowerCase();
    }
  } catch (e) {
    Logger.log("AmbienteRecursos: falha ao ler ambiente — " + e.message);
  }
  return "producao";
}

/** Lê uma Script Property sem estourar se o serviço estiver indisponível. */
function recursos_lerPropriedade_(chave) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(chave);
    return v ? String(v).trim() : "";
  } catch (e) {
    return "";
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   DIAGNÓSTICO

   Sufixo `_` de propósito: o editor do Apps Script roda função com underscore,
   mas o google.script.run NÃO a alcança. Ou seja, dá para conferir o ambiente
   abrindo o projeto e clicando em Executar, sem abrir mais uma porta na web.

   Rode isto no projeto de HOMOLOGAÇÃO para responder, de uma vez, a pergunta
   que nenhum arquivo do repositório consegue responder sozinho: a Script
   Property SISGEP_AMBIENTE está mesmo setada?
   ════════════════════════════════════════════════════════════════════════════ */
function diagnosticoAmbienteRecursos_() {
  var ambiente = recursos_ambienteAtual_();
  var bruto    = recursos_lerPropriedade_("SISGEP_AMBIENTE");

  var linhas = [];
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  DIAGNÓSTICO DE AMBIENTE — SISGEP");
  linhas.push("═══════════════════════════════════════════════════════════");
  linhas.push("  Script Property SISGEP_AMBIENTE : " +
              (bruto ? "\"" + bruto + "\"" : "(NÃO DEFINIDA)"));
  linhas.push("  Ambiente resolvido              : " + ambiente.toUpperCase());

  if (!bruto) {
    linhas.push("");
    linhas.push("  ⚠️  A propriedade NÃO está definida. O sistema está");
    linhas.push("      operando como PRODUÇÃO. Se este é o projeto de");
    linhas.push("      homologação, ele está lendo e gravando na planilha");
    linhas.push("      e nas pastas de produção.");
    linhas.push("      Corrija em: ⚙️ Configurações do projeto →");
    linhas.push("      Propriedades do script → SISGEP_AMBIENTE = homologacao");
  }

  linhas.push("");
  linhas.push("  PLANILHA");
  try {
    linhas.push("    id em uso : " +
                (typeof getPlanilhaId === "function" ? getPlanilhaId() : "(indisponível)"));
  } catch (e) {
    linhas.push("    id em uso : ERRO — " + e.message);
  }

  linhas.push("");
  linhas.push("  PASTAS DO DRIVE");
  Object.keys(RECURSOS_AMBIENTE).forEach(function (nome) {
    var cfg = RECURSOS_AMBIENTE[nome];
    var id, situacao;
    try {
      id = getRecursoId_(nome, { semTrava: true });
      if (ambiente === "homologacao" && id === String(cfg.producao).trim()) {
        situacao = "❌ APONTA PARA PRODUÇÃO — gravação será bloqueada";
      } else {
        situacao = "✅ ok";
      }
    } catch (e) {
      id = "(erro)";
      situacao = "❌ " + e.message;
    }
    linhas.push("    " + nome);
    linhas.push("      " + cfg.rotulo);
    linhas.push("      id : " + id);
    linhas.push("      " + situacao);
  });

  linhas.push("═══════════════════════════════════════════════════════════");

  var texto = linhas.join("\n");
  Logger.log(texto);
  return texto;
}
