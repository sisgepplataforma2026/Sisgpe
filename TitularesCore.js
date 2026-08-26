// ============================================================================
// ARQUIVO: TitularesCore.gs
// LGPD — INVENTÁRIO DE DADOS E DIREITOS DO TITULAR (item 16.8).
//
// DUAS COISAS DIFERENTES NA MESMA TELA, e é proposital:
//
//   INVENTÁRIO ....... onde o sindicato guarda dado pessoal, com que base
//                      legal e por quanto tempo. Sai do CÓDIGO.
//   PEDIDOS .......... o que os titulares pediram (art. 18) e o relógio de
//                      15 dias de cada um. Cadastro com fluxo.
//
// Estão juntos porque quem atende um pedido de acesso precisa do inventário
// aberto na frente: a resposta do art. 19 é justamente "quais dados seus eu
// tenho, onde, por quê e por quanto tempo".
//
// POR QUE O INVENTÁRIO SAI DO CÓDIGO, E NÃO DE CADASTRO
// Mesma razão de Retenção e Descarte: inventário mantido à mão envelhece e
// passa a mentir numa fiscalização, enquanto o sistema continua guardando o
// que guarda. Aqui ele é montado lendo as constantes reais e contando as
// linhas reais — se alguém acrescentar uma coluna de dado pessoal e não
// atualizar este arquivo, o inventário fica incompleto, mas nunca falso
// sobre o que declara.
//
// O QUE ESTE MÓDULO NÃO FAZ
// Não executa o direito. Marcar um pedido de exclusão como RESPONDIDO não
// apaga nada — apagar é ato humano, feito nas telas dos módulos, e o
// registro aqui é a prova de que foi atendido no prazo. Prometer execução
// automática seria pior que não ter tela: alguém marcaria como respondido
// achando que o sistema apagou.
// ============================================================================

var TIT_ABA = "SISGEP_DireitosTitular";
var TIT_MODULO = "auditoria";
var TIT_PRAZO_PADRAO_DIAS = 15;   // art. 19, II — dias corridos

var TIT_COLUNAS = [
  "ID", "RECEBIDO_EM", "REGISTRADO_POR", "TITULAR_NOME", "TITULAR_CONTATO",
  "REFERENCIA", "TIPO", "DESCRICAO", "ESTADO", "RESPOSTA",
  "RESPONDIDO_EM", "RESPONDIDO_POR", "CANAL_RESPOSTA"
];

/* Os direitos do art. 18. Os rótulos são os da lei, não invenção minha —
 * quem atende precisa reconhecer o pedido pelo nome que o titular usou. */
var TIT_TIPOS = {
  CONFIRMACAO:   "Confirmação de existência de tratamento",
  ACESSO:        "Acesso aos dados",
  CORRECAO:      "Correção de dado incompleto ou desatualizado",
  ANONIMIZACAO:  "Anonimização, bloqueio ou eliminação de dado desnecessário",
  PORTABILIDADE: "Portabilidade a outro fornecedor",
  ELIMINACAO:    "Eliminação de dado tratado com consentimento",
  COMPARTILHAMENTO: "Informação sobre compartilhamento com terceiros",
  REVOGACAO:     "Revogação do consentimento"
};

var TIT_TRANSICOES = {
  RECEBIDO:       ["EM_ATENDIMENTO"],
  EM_ATENDIMENTO: ["RESPONDIDO", "NEGADO"],
  RESPONDIDO:     [],
  NEGADO:         []
};

var TIT_ROTULO_ESTADO = {
  RECEBIDO: "Recebido", EM_ATENDIMENTO: "Em atendimento",
  RESPONDIDO: "Respondido", NEGADO: "Negado"
};

function tit_aba_() { return abaSisgep_(TIT_ABA, TIT_COLUNAS); }

/* ==========================================================================
 * INVENTÁRIO — lido do código
 * ========================================================================== */

/** Conta linhas de uma aba sem quebrar se ela não existir. */
function tit_contar_(nomeAba) {
  try {
    var aba = planilhaSisgep_().getSheetByName(nomeAba);
    if (!aba) return null;
    var n = aba.getLastRow() - 1;
    return n > 0 ? n : 0;
  } catch (e) { return null; }
}

/**
 * Onde o sindicato guarda dado pessoal.
 *
 * "n/d" onde o volume não é contável de forma barata — e n/d é resposta
 * honesta. Inventar um número aqui seria pior que deixar em branco, porque
 * este é um documento que se apresenta.
 */
function tit_inventario_() {
  var anosVisitas = (typeof VIS_LGPD_RETENCAO_ANOS_ === "number") ? VIS_LGPD_RETENCAO_ANOS_ : 5;

  return [
    {
      onde: "Base de Associados",
      dados: "Nome, CPF, endereço, telefone, e-mail, matrícula, escola",
      volume: tit_contar_(typeof SIND_ASS_ABA !== "undefined" ? SIND_ASS_ABA : "Associados"),
      base: "Execução de contrato (filiação sindical)",
      guarda: "Enquanto durar a filiação, mais o prazo prescricional",
      expurgo: "Não automático — exclusão é ato humano"
    },
    {
      onde: "Escolas",
      dados: "CNPJ, nome e contato do responsável",
      volume: tit_contar_("Escolas"),
      base: "Execução de contrato e legítimo interesse",
      guarda: "Enquanto houver relação com a escola",
      expurgo: "Não automático"
    },
    {
      onde: "Visitas",
      dados: "Geolocalização do check-in do diretor",
      volume: null,
      base: "Legítimo interesse (comprovação de visita)",
      guarda: anosVisitas + " anos",
      expurgo: "Automático — ver Retenção e Descarte"
    },
    {
      onde: "Escolas › Receita Federal",
      dados: "Retorno bruto da consulta de CNPJ",
      volume: null,
      base: "Legítimo interesse (validação cadastral)",
      guarda: "5 anos",
      expurgo: "Automático — ver Retenção e Descarte"
    },
    {
      onde: "Trilha de auditoria",
      dados: "E-mail de quem agiu, horário e ação",
      volume: tit_contar_(typeof AUD_ABA_RESERVA !== "undefined" ? AUD_ABA_RESERVA : "SISGEP_Auditoria"),
      base: "Cumprimento de obrigação legal (art. 37 da LGPD)",
      guarda: "Indeterminada — é registro de prestação de contas",
      expurgo: "Nenhum, por desenho"
    },
    {
      onde: "Ofícios",
      dados: "Nome e CPF de associados citados no documento",
      volume: tit_contar_(typeof PLANILHA_REGISTRO !== "undefined" ? PLANILHA_REGISTRO : "Registro"),
      base: "Execução de contrato e exercício regular de direito",
      guarda: "Documento institucional — guarda permanente",
      expurgo: "Nenhum"
    }
  ];
}

/* ==========================================================================
 * PRAZO
 * ========================================================================== */

function tit_prazoDias_() {
  try {
    var aba = planilhaSisgep_().getSheetByName("CONFIG");
    if (aba && aba.getLastRow() >= 2) {
      var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < dados.length; i++) {
        if (String(dados[i][0]).trim().toUpperCase() === "LGPD_PRAZO_TITULAR_DIAS") {
          var v = parseInt(dados[i][1], 10);
          if (!isNaN(v) && v > 0) return v;
        }
      }
    }
  } catch (e) {
    Logger.log("tit_prazoDias_ — usando o padrão: " + e.message);
  }
  return TIT_PRAZO_PADRAO_DIAS;
}

/**
 * Situação do prazo. Dias CORRIDOS — o art. 19, II fala em 15 dias, sem
 * qualificar como úteis, e contar dias úteis daria mais folga do que a lei
 * concede. Na dúvida sobre prazo, o lado seguro é o mais apertado.
 */
function tit_prazo_(recebidoEm, estado) {
  var parado = (estado === "RESPONDIDO" || estado === "NEGADO");
  var d = (recebidoEm instanceof Date) ? recebidoEm : new Date(recebidoEm);
  if (isNaN(d.getTime())) return { conhecido: false };

  var limite = new Date(d.getTime());
  limite.setDate(limite.getDate() + tit_prazoDias_());
  var diasRestantes = Math.ceil((limite.getTime() - new Date().getTime()) / (24 * 3600 * 1000));

  return {
    conhecido: true, parado: parado, limite: limite, diasRestantes: diasRestantes,
    vencido: !parado && diasRestantes < 0,
    vencendo: !parado && diasRestantes >= 0 && diasRestantes <= 3,
    diasConfigurados: tit_prazoDias_()
  };
}

/* ==========================================================================
 * PEDIDOS
 * ========================================================================== */

function titRegistrar(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, TIT_MODULO, true);
  dados = dados || {};

  var recebido = dados.recebidoEm ? new Date(dados.recebidoEm) : new Date();
  if (isNaN(recebido.getTime())) return { ok: false, mensagem: "Data do pedido inválida." };
  if (recebido.getTime() > new Date().getTime() + 60000) {
    return { ok: false, mensagem: "A data do pedido não pode estar no futuro." };
  }
  if (!TIT_TIPOS[String(dados.tipo || "").toUpperCase()]) {
    return { ok: false, mensagem: "Escolha o tipo de pedido (art. 18)." };
  }
  var nome = String(dados.titularNome || "").trim();
  if (nome.length < 3) return { ok: false, mensagem: "Informe o nome do titular." };
  var contato = String(dados.titularContato || "").trim();
  if (!contato) {
    // Sem contato não há como responder — e não responder é o que gera a
    // multa, mesmo que o pedido tenha sido registrado direitinho.
    return { ok: false, mensagem: "Informe um contato do titular: é por onde a resposta vai sair." };
  }

  var aba = tit_aba_();
  var ano = recebido.getFullYear();
  var seq = 0;
  if (aba.getLastRow() >= 2) {
    aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues().forEach(function (l) {
      var m = String(l[0]).match(/^TIT-(\d{4})-(\d+)$/);
      if (m && Number(m[1]) === ano) seq = Math.max(seq, Number(m[2]));
    });
  }
  var id = "TIT-" + ano + "-" + String(seq + 1).padStart(3, "0");

  aba.appendRow([
    id, recebido, sessao.email || sessao.usuario || "—", nome, contato,
    String(dados.referencia || "").trim(), String(dados.tipo).toUpperCase(),
    String(dados.descricao || "").trim(), "RECEBIDO", "", "", "", ""
  ]);

  auditar_({
    registroId: id, modulo: "Auditoria e Compliance", submodulo: "Direitos do Titular",
    acao: "REGISTRAR_PEDIDO_TITULAR", sessao: sessao,
    valorNovo: { estado: "RECEBIDO", tipo: String(dados.tipo).toUpperCase() },
    // O nome do titular fica na aba, não na justificativa da trilha — a
    // trilha é lida por mais gente e exportada com mais frequência.
    justificativa: TIT_TIPOS[String(dados.tipo).toUpperCase()]
  });

  return { ok: true, id: id,
    mensagem: "Pedido " + id + " registrado. Prazo de " + tit_prazoDias_() + " dias a partir de hoje." };
}

function tit_linha_(id) {
  var aba = tit_aba_();
  if (aba.getLastRow() < 2) return null;
  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, TIT_COLUNAS.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][0]) === String(id)) return { linha: i + 2, valores: dados[i], aba: aba };
  }
  return null;
}

function titAvancar(id, para, dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, TIT_MODULO, true);
  para = String(para || "").toUpperCase();
  dados = dados || {};

  var r = tit_linha_(id);
  if (!r) return { ok: false, mensagem: "Pedido não encontrado." };

  var atual = String(r.valores[8]).toUpperCase();
  if ((TIT_TRANSICOES[atual] || []).indexOf(para) === -1) {
    return { ok: false, mensagem: "De " + (TIT_ROTULO_ESTADO[atual] || atual) +
      " não se vai para " + (TIT_ROTULO_ESTADO[para] || para) + "." };
  }

  if (para === "RESPONDIDO" || para === "NEGADO") {
    var texto = String(dados.resposta || "").trim();
    var minimo = (para === "NEGADO") ? 20 : 10;
    if (texto.length < minimo) {
      return { ok: false, mensagem: (para === "NEGADO")
        ? "Justifique a negativa (mínimo 20 caracteres). O titular tem direito a saber por quê, e a ANPD pode ser acionada."
        : "Descreva o que foi respondido ao titular (mínimo 10 caracteres)." };
    }
    var canal = String(dados.canal || "").trim();
    if (!canal) return { ok: false, mensagem: "Informe por onde a resposta foi enviada." };

    r.aba.getRange(r.linha, 10).setValue(texto);
    r.aba.getRange(r.linha, 11).setValue(new Date());
    r.aba.getRange(r.linha, 12).setValue(sessao.email || sessao.usuario || "—");
    r.aba.getRange(r.linha, 13).setValue(canal);
  }

  r.aba.getRange(r.linha, 9).setValue(para);

  var prazo = tit_prazo_(r.valores[1], atual);
  auditar_({
    registroId: id, modulo: "Auditoria e Compliance", submodulo: "Direitos do Titular",
    acao: "PEDIDO_TITULAR_" + para, sessao: sessao,
    valorAnterior: { estado: atual }, valorNovo: { estado: para },
    // Se respondeu fora do prazo, isso fica registrado. É o tipo de coisa
    // que ninguém gosta de gravar e que sustenta a defesa quando o
    // atendimento foi feito de boa-fé com atraso justificável.
    justificativa: (prazo.conhecido && prazo.diasRestantes < 0)
      ? ("ATENDIDO FORA DO PRAZO — " + Math.abs(prazo.diasRestantes) + " dia(s) de atraso")
      : String(dados.resposta || "").slice(0, 150)
  });

  return { ok: true, mensagem: "Pedido movido para " + (TIT_ROTULO_ESTADO[para] || para) + "." };
}

/* ==========================================================================
 * LEITURA
 * ========================================================================== */

function titPainel(tokenSessao) {
  exigirModulo_(tokenSessao, TIT_MODULO, false);

  var aba = tit_aba_();
  var pedidos = [];
  if (aba.getLastRow() >= 2) {
    pedidos = aba.getRange(2, 1, aba.getLastRow() - 1, TIT_COLUNAS.length).getValues().map(function (l) {
      var estado = String(l[8]).toUpperCase();
      return {
        id: l[0], recebidoEm: l[1], registradoPor: l[2],
        titularNome: l[3], titularContato: l[4], referencia: l[5],
        tipo: l[6], tipoRotulo: TIT_TIPOS[String(l[6]).toUpperCase()] || l[6],
        descricao: l[7], estado: estado,
        estadoRotulo: TIT_ROTULO_ESTADO[estado] || estado,
        resposta: l[9], respondidoEm: l[10], respondidoPor: l[11], canal: l[12],
        prazo: tit_prazo_(l[1], estado),
        proximos: TIT_TRANSICOES[estado] || []
      };
    });
    pedidos.reverse();
  }

  return {
    ok: true,
    inventario: tit_inventario_(),
    pedidos: pedidos,
    total: pedidos.length,
    prazoDias: tit_prazoDias_(),
    resumo: pedidos.reduce(function (m, x) { m[x.estado] = (m[x.estado] || 0) + 1; return m; }, {}),
    vencendo: pedidos.filter(function (x) {
      return x.prazo.conhecido && (x.prazo.vencido || x.prazo.vencendo);
    }),
    tipos: TIT_TIPOS
  };
}
