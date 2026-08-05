// ============================================================================
// ARQUIVO: BeneficiosLinkInteresse.gs
//
// Componente compartilhado: monta o link do formulário público de um benefício
// e a mensagem de WhatsApp que o acompanha.
//
// POR QUE ISTO EXISTE
// O atendimento começa no WhatsApp. Antes disto, a Marcélia precisava copiar
// o endereço do formulário de algum lugar e escrever a mensagem na mão, toda
// vez. O botão "Enviar Link de Interesse" nas telas de benefício chama daqui.
//
// POR QUE É UM ARQUIVO SÓ, E NÃO UM POR BENEFÍCIO
// O que se repete entre China Park, Voucher e Oftalmologia é exatamente isto:
// montar a URL, montar o texto, abrir o WhatsApp. São três coisas. O resto
// (preço, disponibilidade, aprovação) é diferente em cada benefício e continua
// no arquivo de cada um. Não se criou um "motor de formulários" — seria um
// projeto próprio, e o sistema está em produção com dado real.
//
// LIMITE CONHECIDO
// Só aparecem aqui os benefícios que têm rota pública de verdade em Code.gs.
// Guriri Beach e Assefaz são atendidos pelo Portal Público do Associado, que
// é outro projeto Apps Script — quando ganharem rota neste projeto, entram na
// lista abaixo e o botão passa a funcionar para eles sem mais nenhuma mudança.
// ============================================================================

var BENEF_LINKS = {
  chinapark: {
    rotulo: "China Park Eco Resort",
    rota: "?portal=chinapark",
    modulo: "beneficios",
    titulo: "Hospedagem no China Park Eco Resort",
    intro: "Para seguirmos com o seu pedido de hospedagem, preencha o formulário abaixo.",
    aviso: "O preenchimento não confirma a reserva: a solicitação passa por análise da secretaria e aprovação da Presidência."
  },
  voucher: {
    rotulo: "Voucher de Bolsa de Estudo",
    rota: "?portal=voucher",
    modulo: "beneficios",
    titulo: "Solicitação de Voucher — Bolsa de Estudo",
    intro: "Para solicitar o voucher, preencha o formulário abaixo.",
    aviso: "A solicitação passa por conferência do cadastro antes da emissão."
  },
  oftalmo: {
    rotulo: "Exame oftalmológico",
    rota: "?portal=oftalmo",
    modulo: "beneficios",
    titulo: "Agendamento de exame oftalmológico",
    intro: "Para agendar o seu exame, preencha o formulário abaixo.",
    aviso: "O formulário só aceita agendamento nas datas liberadas pela secretaria."
  }
};

/**
 * Monta link e mensagem do benefício. Não grava nada e não muda status —
 * é só preparação de texto, por isso exige sessão e módulo, mas não é
 * uma ação reversível que precise de trilha de auditoria.
 *
 * @param {string} beneficio  chave de BENEF_LINKS
 * @param {Object} opcoes     { telefone, nome } — ambos opcionais
 * @param {string} tokenSessao
 * @return {{ok:boolean, url?:string, texto?:string, telefone?:string, mensagem?:string}}
 */
function beneficiosPrepararLinkInteresse(beneficio, opcoes, tokenSessao) {
  try {
    var chave = String(beneficio || "").trim().toLowerCase();
    var cfg = BENEF_LINKS[chave];
    if (!cfg) {
      return { ok: false, mensagem: "Benefício sem formulário público cadastrado: " + beneficio };
    }

    exigirModulo_(tokenSessao, cfg.modulo, false);

    opcoes = opcoes || {};
    var nome = String(opcoes.nome || "").trim();
    var url  = benefUrlBase_() + cfg.rota;

    var linhas = [];
    linhas.push("*SINDEDUCAÇÃO-ES*");
    linhas.push("*" + cfg.titulo + "*");
    linhas.push("");
    linhas.push(nome ? ("Olá, *" + nome + "*.") : "Olá!");
    linhas.push(cfg.intro);
    linhas.push("");
    linhas.push(url);
    linhas.push("");
    linhas.push("_" + cfg.aviso + "_");

    return {
      ok: true,
      beneficio: chave,
      rotulo: cfg.rotulo,
      url: url,
      texto: linhas.join("\n"),
      telefone: benefTelefoneWhats_(opcoes.telefone)
    };
  } catch (erro) {
    Logger.log("beneficiosPrepararLinkInteresse: " + erro);
    return { ok: false, mensagem: String(erro && erro.message ? erro.message : erro) };
  }
}

/** Lista os benefícios que têm formulário público — alimenta o seletor da tela. */
function beneficiosListarLinksInteresse(tokenSessao) {
  try {
    exigirModulo_(tokenSessao, "beneficios", false);
    var itens = [];
    Object.keys(BENEF_LINKS).forEach(function (k) {
      itens.push({ chave: k, rotulo: BENEF_LINKS[k].rotulo });
    });
    return { ok: true, itens: itens };
  } catch (erro) {
    return { ok: false, mensagem: String(erro && erro.message ? erro.message : erro), itens: [] };
  }
}

/**
 * URL de publicação do app. getSistemaUrlBase() já resolve e guarda em cache;
 * o fallback existe para o caso de o script ainda não ter sido publicado,
 * quando ScriptApp.getService().getUrl() devolve vazio.
 */
function benefUrlBase_() {
  var url = "";
  try {
    if (typeof getSistemaUrlBase === "function") url = String(getSistemaUrlBase() || "");
    if (!url) url = String(ScriptApp.getService().getUrl() || "");
  } catch (e) {
    Logger.log("benefUrlBase_: " + e);
  }
  return url;
}

/**
 * Normaliza o telefone para o formato que o wa.me aceita.
 * Devolve "" quando não dá para usar — a tela então só mostra o link para
 * copiar, em vez de abrir uma conversa com número errado.
 */
function benefTelefoneWhats_(valor) {
  var fone = String(valor || "").replace(/\D/g, "");
  if (!fone) return "";
  if (fone.length === 10 || fone.length === 11) fone = "55" + fone;
  return fone.length >= 12 ? fone : "";
}
