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

// Texto de cada benefício. A estrutura é a mesma nos três, na ordem em que a
// pessoa lê: o que recebemos dela, o que ela precisa fazer, o que NÃO está
// garantido, como ela vai ser avisada e em quanto tempo.
//
// A ordem importa: o aviso de que o formulário não confirma nada vem ANTES
// da promessa de retorno. Invertido, a pessoa lê "vamos te avisar" e entende
// que já está reservado — e cobra a vaga depois.
//
// Texto do China Park definido pelo usuário em 2026-08-05. Alterar só com
// pedido dele: é comunicação institucional que sai em nome do sindicato.
var BENEF_LINKS = {
  chinapark: {
    rotulo: "China Park Eco Resort",
    rota: "?portal=chinapark",
    modulo: "beneficios",
    titulo: "Hospedagem no China Park Eco Resort",
    abertura: "Recebemos sua manifestação de interesse em se hospedar no China Park Eco Resort.",
    instrucao: "Para dar continuidade à análise da sua solicitação, pedimos que preencha o formulário abaixo com as informações necessárias:",
    // A menção à Presidência saiu a pedido do usuário em 2026-08-05. A
    // aprovação continua existindo no sistema — o que mudou é que ela não é
    // anunciada ao solicitante, que não precisa saber a instância interna.
    importante: "o preenchimento deste formulário não confirma a reserva. A solicitação será analisada pela Secretaria do SindEducação-ES, conforme a disponibilidade de vagas no período solicitado.",
    retorno: "Após a conclusão da análise, você será informado sobre o resultado por e-mail e/ou WhatsApp.",
    // Os dois avisos abaixo entram já na PRIMEIRA mensagem, a pedido do
    // usuário. A pessoa precisa saber do prazo e da não devolução antes de
    // pedir, não na hora de confirmar — descobrir depois é o que gera
    // discussão no balcão.
    condicoes: [
      "A confirmação dos hóspedes deve ser feita até 24 horas antes da data de entrada.",
      "Em caso de desistência após a confirmação da reserva, o valor pago não será devolvido."
    ],
    prazo: "Prazo de resposta: nossa equipe retornará o mais breve possível após a análise da disponibilidade junto ao China Park."
  },
  voucher: {
    rotulo: "Voucher de Bolsa de Estudo",
    rota: "?portal=voucher",
    modulo: "beneficios",
    titulo: "Solicitação de Voucher — Bolsa de Estudo",
    abertura: "Recebemos seu interesse em solicitar o voucher de bolsa de estudo do SindEducação-ES.",
    instrucao: "Para dar continuidade à análise da sua solicitação, pedimos que preencha o formulário abaixo com as informações necessárias:",
    importante: "o preenchimento deste formulário não garante a concessão do voucher. A solicitação será analisada pela Secretaria do SindEducação-ES, que confere a regularidade do seu cadastro de associado antes da emissão.",
    retorno: "Após a conclusão da análise, você será informado sobre o resultado por e-mail e/ou WhatsApp.",
    prazo: "Prazo de resposta: nossa equipe retornará o mais breve possível após a conferência do cadastro."
  },
  oftalmo: {
    rotulo: "Exame oftalmológico",
    rota: "?portal=oftalmo",
    modulo: "beneficios",
    titulo: "Agendamento de Exame Oftalmológico",
    abertura: "Recebemos seu interesse em agendar o exame oftalmológico oferecido pelo SindEducação-ES.",
    instrucao: "Para dar continuidade ao seu agendamento, pedimos que preencha o formulário abaixo com as informações necessárias:",
    importante: "o agendamento só pode ser feito nas datas liberadas pela Secretaria do SindEducação-ES. Se não houver data disponível no momento, o formulário informará, e você poderá tentar novamente quando uma nova data for aberta.",
    retorno: "Após a confirmação do agendamento, você será informado sobre o dia e o horário por e-mail e/ou WhatsApp.",
    prazo: "Prazo de resposta: nossa equipe retornará o mais breve possível após a confirmação da agenda com a clínica parceira."
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

    // O negrito e o itálico usam a marcação do WhatsApp (*texto* e _texto_).
    // Quem receber por outro canal vê os asteriscos — é o preço de a mensagem
    // ser, antes de tudo, uma mensagem de WhatsApp.
    var linhas = [];
    linhas.push("*SINDEDUCAÇÃO-ES*");
    linhas.push("*" + cfg.titulo + "*");
    linhas.push("");
    linhas.push(nome ? ("Olá, *" + nome + "*!") : "Olá!");
    linhas.push("");
    linhas.push(cfg.abertura);
    linhas.push("");
    linhas.push(cfg.instrucao);
    linhas.push("");
    linhas.push(url);
    linhas.push("");
    linhas.push("*Importante:* " + cfg.importante);
    if (cfg.condicoes && cfg.condicoes.length) {
      linhas.push("");
      linhas.push("*Condições da reserva:*");
      cfg.condicoes.forEach(function (c) { linhas.push("• " + c); });
    }
    linhas.push("");
    linhas.push(cfg.retorno);
    linhas.push("");
    linhas.push("_" + cfg.prazo + "_");

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
