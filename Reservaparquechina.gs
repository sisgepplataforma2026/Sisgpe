/**
 * MÓDULO: PARQUE DO CHINA — agenda manual e controle financeiro.
 * Sorteio não integra esta versão. O SISGEP é a fonte oficial das reservas.
 */

// ----------------------------------------------------------------------------
// CONFIGURAÇÃO FIXA (estrutural, não é regra de negócio)
// ----------------------------------------------------------------------------
var PARQUE_CHINA_CONFIG = {
  ABA_RESERVAS: "ReservasParqueChina",
  ABA_CONFIG: "ConfiguracoesParqueChina",
  // O Parque China opera no horário de Brasília. Manter fixo evita que uma
  // configuração diferente no projeto desloque datas de entrada e saída.
  TIMEZONE: "America/Sao_Paulo",

  SUITES: ["501", "502", "503", "504", "505", "506", "507", "508"],
  CAPACIDADE_MAXIMA_PESSOAS: 4,

  // AJUSTE AQUI: valores de referência. Confirme os valores reais vigentes.
  VALOR_COLCHAO_EXTRA: 80,
  PRECO_DIARIA_SEMANAL: 250,
  PRECO_DIARIA_FIM_DE_SEMANA: 300,

  ANTECEDENCIA_MAXIMA_DIAS: 30,

  // AJUSTE AQUI: e-mails que recebem notificação de nova inscrição.
  EMAILS_ADMIN: ["financeiro@sindeducacao.com"]
};

// Regras de negócio (sorteio/gratuidade) — PADRÃO INICIAL, editável em
// ConfiguracoesParqueChina pelo painel administrativo.
var PARQUE_CHINA_CONFIG_PADRAO = {
  MODO_AGENDAMENTO: "MANUAL",
  PRECO_DIARIA_SEMANAL: 250,
  PRECO_DIARIA_FIM_DE_SEMANA: 300,
  VALOR_COLCHAO_EXTRA: 80,
  ANTECEDENCIA_MAXIMA_DIAS: 30,
  CAPACIDADE_MAXIMA_PESSOAS: 4,
  PERFIS_ADMIN: "ADMINISTRADOR,PRESIDENTE,FINANCEIRO",
  EMAILS_ADMIN: "financeiro@sindeducacao.com",
  EMAIL_CHINA_PARK: "",
  EMAILS_DESTINATARIOS_CHINA_PARK: "secretaria@sindeducacao.com;financeiro@sindeducacao.com;contato@chinapark.com.br",
  EMAIL_CC_CHINA_PARK: "",
  EMAIL_CCO_CHINA_PARK: "",
  PASTA_AUTORIZACOES_ID: "",
  HORARIO_CHECKIN: "14:00",
  HORARIO_CHECKOUT: "12:00",
  ENDERECO_CHINA_PARK: "",
  LINK_MAPA_CHINA_PARK: "",
  EMAIL_RESPOSTA_BENEFICIOS: "financeiro@sindeducacao.com"
};

// Colunas da aba de reservas (1-indexado)
var PC_COL = {
  ID_RESERVA: 1,
  DATA_SOLICITACAO: 2,
  STATUS: 3,
  TIPO_RESERVA: 4,
  DATA_ENTRADA: 5,
  DATA_SAIDA: 6,
  SUITE_SOLICITADA: 7,      // preferência do associado (número ou QUALQUER_DISPONIVEL)
  NOME_SOLICITANTE: 8,
  CPF: 9,
  TELEFONE: 10,
  EMAIL: 11,
  ESCOLA: 12,
  QTD_PESSOAS: 13,
  DEPENDENTE_1: 14,
  DEPENDENTE_2: 15,
  DEPENDENTE_3: 16,
  DEPENDENTE_4: 17,
  COLCHAO_EXTRA: 18,
  VALOR_COLCHAO_EXTRA: 19,
  VALOR_DIARIA: 20,
  VALOR_TOTAL: 21,
  FORMA_PAGAMENTO: 22,
  GRATUITO_PAGO: 23,        // GRATUITO | PAGO — decidido no sorteio/aprovação
  OBSERVACAO_SOLICITANTE: 24,
  OBSERVACAO_ADMIN: 25,
  RESPONSAVEL_APROVACAO: 26,
  DATA_APROVACAO: 27,
  MOTIVO_RECUSA: 28,
  SUITE_DEFINIDA: 29,       // suíte final, preenchida no sorteio/aprovação
  SORTEIO_ID: 30,           // referência ao log do sorteio que decidiu esta linha
  QTD_DIARIAS: 31,
  VALOR_BRUTO: 32,
  DESCONTO: 33,
  ACRESCIMO: 34,
  STATUS_PAGAMENTO: 35,
  VENCIMENTO_PAGAMENTO: 36,
  DATA_PAGAMENTO: 37,
  VALOR_RECEBIDO: 38,
  JUSTIFICATIVA_AJUSTE: 39,
  ATUALIZADO_EM: 40,
  ATUALIZADO_POR: 41,
  ORIGEM: 42,
  CHAVE_IDEMPOTENCIA: 43
};

var PC_STATUS = {
  PENDENTE:"PENDENTE", AGUARDANDO_PAGAMENTO:"AGUARDANDO_PAGAMENTO",
  APROVADA:"APROVADA", RECUSADA:"RECUSADA", CANCELADA:"CANCELADA",
  FINALIZADA:"FINALIZADA", BLOQUEIO_ADMINISTRATIVO:"BLOQUEIO_ADMINISTRATIVO",
  INSCRITO_SORTEIO:"INSCRITO_SORTEIO"
};

// Uma única regra para toda a aplicação. Qualquer consulta de disponibilidade,
// aprovação ou distribuição deve usar esta lista para não produzir resultados
// diferentes entre o painel mensal e a consulta por período.
var PC_STATUS_QUE_BLOQUEIAM_SUITE = [
  PC_STATUS.APROVADA,
  PC_STATUS.AGUARDANDO_PAGAMENTO,
  PC_STATUS.BLOQUEIO_ADMINISTRATIVO,
  PC_STATUS.FINALIZADA
];

var PC_STATUS_PAGAMENTO = {
  PENDENTE: "PENDENTE",
  PARCIAL: "PARCIAL",
  PAGO: "PAGO",
  ISENTO: "ISENTO"
};

var PC_TIPO_RESERVA = {
  SEMANAL: "SEMANAL",
  FIM_DE_SEMANA: "FIM_DE_SEMANA"
};

var PC_CABECALHO = [
  "ID Reserva","Data Solicitação","Status","Tipo Reserva","Data Entrada","Data Saída",
  "Suíte Solicitada","Nome Solicitante","CPF","Telefone","Email","Escola/Vínculo",
  "Qtd Pessoas","Dependente 1","Dependente 2","Dependente 3","Dependente 4",
  "Colchão Extra","Valor Colchão Extra","Valor Diária","Valor Total","Forma de Pagamento",
  "Gratuito/Pago","Observação Solicitante","Observação Admin","Responsável Aprovação",
  "Data Aprovação/Recusa","Motivo Recusa","Suíte Definida","ID Sorteio (legado)",
  "Qtd Diárias","Valor Bruto","Desconto","Acréscimo","Status Pagamento",
  "Vencimento Pagamento","Data Pagamento","Valor Recebido","Justificativa Ajuste",
  "Atualizado Em","Atualizado Por","Origem","Chave Idempotência"
];

function pcNormalizarPerfil_(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function pcExigirAdmin_(tokenSessao) {
  var sessao = getSessaoUsuario(tokenSessao);
  // A sessão central válida é o próprio objeto retornado; ela não possui o campo logado.
  if (!sessao) throw new Error("SESSAO_EXPIRADA");
  var config = obterConfigParqueChina_();
  var permitidos = String(config.PERFIS_ADMIN || "ADMINISTRADOR,PRESIDENTE,FINANCEIRO").split(",").map(pcNormalizarPerfil_);
  if (permitidos.indexOf(pcNormalizarPerfil_(sessao.perfil)) === -1) throw new Error("ACESSO_NEGADO");
  return sessao;
}

function pcExigirPerfis_(sessao, perfis) {
  var perfil = pcNormalizarPerfil_(sessao && sessao.perfil);
  var autorizados = (perfis || []).map(pcNormalizarPerfil_);
  if (autorizados.indexOf(perfil) === -1) throw new Error("ACESSO_NEGADO");
  return sessao;
}

function pcInvalidarCache_() {
  var agora = new Date();
  var cache = CacheService.getScriptCache();
  var chaves = [];
  for (var delta = -1; delta <= 1; delta++) {
    var d = new Date(agora.getFullYear(), agora.getMonth() + delta, 1);
    chaves.push("CENTRAL_BENEFICIOS_ADMIN_" + d.getFullYear() + "_" + (d.getMonth() + 1));
  }
  try { cache.removeAll(chaves); } catch (e) { Logger.log("Cache China Park: " + e); }
}

function pcMensagemErro_(erro) {
  var codigo = String(erro && erro.message || erro || "");
  if (codigo === "SESSAO_EXPIRADA") return "Sessão expirada. Faça login novamente.";
  if (codigo === "ACESSO_NEGADO") return "Seu perfil não possui permissão para administrar reservas.";
  if (codigo === "CONCORRENCIA") return "O módulo está processando outra reserva. Tente novamente.";
  return "Não foi possível concluir a operação.";
}

function pcComLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("CONCORRENCIA");
  try { return callback(); } finally { lock.releaseLock(); }
}

function pcObterAbaHistorico_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var nome = "HistoricoParqueChina";
  var sh = ss.getSheetByName(nome);
  var cab = ["Data","ID Reserva","Ação","Status Anterior","Status Novo","Responsável","Justificativa","Detalhes"];
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,cab.length).setValues([cab]);
  return sh;
}

function pcAuditar_(idReserva, acao, anterior, novo, responsavel, justificativa, detalhes) {
  pcObterAbaHistorico_().appendRow([new Date(),idReserva || "",acao || "",anterior || "",novo || "",responsavel || "Sistema",justificativa || "",detalhes ? JSON.stringify(detalhes) : ""]);
}

function pcNumero_(valor) {
  var n = Number(String(valor == null ? "" : valor).replace(",", "."));
  return isFinite(n) ? n : 0;
}

function pcChaveIdempotencia_(dados) {
  var base = [normalizarCpfParqueChina_(dados.cpf),dados.dataEntrada,dados.dataSaida,dados.suite || dados.suiteSolicitada || dados.chaleSolicitado,dados.origem || "SISGEP"].join("|");
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, base)).replace(/=+$/g, "").slice(0, 40);
}

function pcBuscarPorIdempotenciaAtiva_(chave) {
  if (!chave) return null;
  var sh = obterAbaReservaParqueChina_(), last = sh.getLastRow();
  if (last < 2) return null;
  var dados = sh.getRange(2,1,last-1,PC_CABECALHO.length).getValues();
  for (var i=0;i<dados.length;i++) {
    var status = String(dados[i][PC_COL.STATUS-1]);
    if (String(dados[i][PC_COL.CHAVE_IDEMPOTENCIA-1]) === String(chave) && status !== PC_STATUS.CANCELADA && status !== PC_STATUS.RECUSADA) return mapearLinhaParaObjetoParqueChina_(dados[i]);
  }
  return null;
}

// ----------------------------------------------------------------------------
// ACESSO À PLANILHA — RESERVAS
// ----------------------------------------------------------------------------

function obterAbaReservaParqueChina_() {
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = planilha.getSheetByName(PARQUE_CHINA_CONFIG.ABA_RESERVAS);
  var precisaConfigurar = false;

  if (!aba) {
    aba = planilha.insertSheet(PARQUE_CHINA_CONFIG.ABA_RESERVAS);
    precisaConfigurar = true;
  }

  if (aba.getMaxColumns() < PC_CABECALHO.length) {
    aba.insertColumnsAfter(aba.getMaxColumns(), PC_CABECALHO.length - aba.getMaxColumns());
    precisaConfigurar = true;
  }

  // Verifica se o cabeçalho já está correto, sem precisar reler a linha toda
  // — evita reaplicar formatação pesada (setNumberFormat em milhares de
  // células) em toda leitura de reservas, o que ficou lento demais com o
  // volume histórico importado (637+ registros) e causava timeout/travamento
  // na Agenda mensal e no Relatório.
  if (!precisaConfigurar) {
    var primeiraCelula = String(aba.getRange(1, 1).getValue() || "").trim();
    if (primeiraCelula !== PC_CABECALHO[0]) precisaConfigurar = true;
  }

  if (precisaConfigurar) {
    aba.getRange(1,1,1,PC_CABECALHO.length).setValues([PC_CABECALHO]);
    aba.getRange(1,1,1,PC_CABECALHO.length).setFontWeight("bold").setBackground("#0b3b75").setFontColor("#ffffff");
    aba.setFrozenRows(1);
    aba.getRange(2,PC_COL.VALOR_COLCHAO_EXTRA,Math.max(aba.getMaxRows()-1,1),3).setNumberFormat('R$ #,##0.00');
    aba.getRange(2,PC_COL.VALOR_BRUTO,Math.max(aba.getMaxRows()-1,1),3).setNumberFormat('R$ #,##0.00');
    aba.getRange(2,PC_COL.VALOR_RECEBIDO,Math.max(aba.getMaxRows()-1,1),1).setNumberFormat('R$ #,##0.00');
  }

  return aba;
}

function buscarReservaParqueChinaPorId_(idReserva) {
  var aba = obterAbaReservaParqueChina_();
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;

  var dados = aba.getRange(2, 1, ultimaLinha - 1, PC_CABECALHO.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][PC_COL.ID_RESERVA - 1]) === String(idReserva)) {
      return { linha: i + 2, valores: dados[i] };
    }
  }
  return null;
}

function gerarIdReservaParqueChina_() {
  var hoje = new Date();
  var prefixo = "PC-" + Utilities.formatDate(hoje, PARQUE_CHINA_CONFIG.TIMEZONE, "yyMMdd");
  var aba = obterAbaReservaParqueChina_();
  var ultimaLinha = aba.getLastRow();
  var sequencia = 1;

  if (ultimaLinha >= 2) {
    var ids = aba.getRange(2, PC_COL.ID_RESERVA, ultimaLinha - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).indexOf(prefixo) === 0) sequencia++;
    }
  }
  return prefixo + "-" + ("00" + sequencia).slice(-3);
}

// ----------------------------------------------------------------------------
// ACESSO À PLANILHA — CONFIGURAÇÕES (editável pelo Presidente)
// ----------------------------------------------------------------------------

function obterAbaConfigParqueChina_() {
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = planilha.getSheetByName(PARQUE_CHINA_CONFIG.ABA_CONFIG);
  if (!aba) aba = planilha.insertSheet(PARQUE_CHINA_CONFIG.ABA_CONFIG);
  var cab = ["Parâmetro","Valor","Descrição"];
  if (aba.getLastRow() === 0) aba.getRange(1,1,1,3).setValues([cab]);
  aba.getRange(1,1,1,3).setValues([cab]).setFontWeight("bold").setBackground("#0b3b75").setFontColor("#ffffff");
  var descricoes = {
    MODO_AGENDAMENTO:"MANUAL nesta primeira versão",
    PRECO_DIARIA_SEMANAL:"Valor padrão da diária em dias úteis",
    PRECO_DIARIA_FIM_DE_SEMANA:"Valor padrão da diária de fim de semana",
    VALOR_COLCHAO_EXTRA:"Adicional por colchão extra",
    ANTECEDENCIA_MAXIMA_DIAS:"Antecedência máxima permitida",
    CAPACIDADE_MAXIMA_PESSOAS:"Capacidade máxima por suíte",
    PERFIS_ADMIN:"Perfis autorizados, separados por vírgula",
    EMAILS_ADMIN:"E-mails de notificação, separados por vírgula",
    EMAIL_CHINA_PARK:"Destinatários principais padrão dos ofícios do China Park",
    EMAILS_DESTINATARIOS_CHINA_PARK:"Opções exibidas no seletor de destinatários",
    EMAIL_CC_CHINA_PARK:"Destinatários padrão em cópia (CC)",
    EMAIL_CCO_CHINA_PARK:"Destinatários padrão em cópia oculta (CCO)",
    PASTA_AUTORIZACOES_ID:"ID da pasta do Drive para os ofícios do China Park",
    HORARIO_CHECKIN:"Horário padrão de entrada informado aos hóspedes",
    HORARIO_CHECKOUT:"Horário padrão de saída informado aos hóspedes",
    ENDERECO_CHINA_PARK:"Endereço exibido na confirmação da reserva",
    LINK_MAPA_CHINA_PARK:"Link de localização enviado aos hóspedes",
    EMAIL_RESPOSTA_BENEFICIOS:"E-mail do SindEducação para respostas dos hóspedes"
  };
  var existentes = {};
  if (aba.getLastRow() >= 2) aba.getRange(2,1,aba.getLastRow()-1,1).getValues().forEach(function(l,i){existentes[String(l[0]).trim()] = i+2;});
  Object.keys(PARQUE_CHINA_CONFIG_PADRAO).forEach(function(chave){
    if (!existentes[chave]) aba.appendRow([chave,PARQUE_CHINA_CONFIG_PADRAO[chave],descricoes[chave] || ""]);
  });
  aba.setFrozenRows(1);
  return aba;
}

/**
 * Lê a configuração atual, mesclando com os padrões (caso algum parâmetro
 * novo ainda não exista na planilha).
 */
function obterConfigParqueChina_() {
  var aba = obterAbaConfigParqueChina_(), config = {};
  Object.keys(PARQUE_CHINA_CONFIG_PADRAO).forEach(function(k){config[k]=PARQUE_CHINA_CONFIG_PADRAO[k];});
  if (aba.getLastRow() >= 2) aba.getRange(2,1,aba.getLastRow()-1,2).getValues().forEach(function(l){var k=String(l[0]||"").trim();if(k)config[k]=l[1];});
["PRECO_DIARIA_SEMANAL","PRECO_DIARIA_FIM_DE_SEMANA","VALOR_COLCHAO_EXTRA","ANTECEDENCIA_MAXIMA_DIAS","CAPACIDADE_MAXIMA_PESSOAS"].forEach(function(k){config[k]=pcNumero_(config[k]);});
  // Blinda horários: a planilha pode ter gravado como valor de hora (Date 1899).
  config.HORARIO_CHECKIN = pcNormalizarHora_(config.HORARIO_CHECKIN, "14:00");
  config.HORARIO_CHECKOUT = pcNormalizarHora_(config.HORARIO_CHECKOUT, "12:00");
  return config;
}

/**
 * Wrapper público — obterConfigParqueChina_() é privada (sufixo _),
 * o painel administrativo chama esta função pra ler a configuração atual.
 */
function obterConfiguracoesParqueChinaParaPainel(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try { pcExigirAdmin_(tokenSessao); return {ok:true,config:obterConfigParqueChina_()}; }
  catch (erro) { return {ok:false,mensagem:pcMensagemErro_(erro)}; }
}

/**
 * Atualiza configurações. Requer sessão logada. Restrinja por perfil no
 * chamador (painel) se quiser travar só pra Presidente/Administrador.
 */
function salvarConfiguracoesParqueChina(novaConfig, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var sessao = pcExigirAdmin_(tokenSessao);
    pcExigirPerfis_(sessao, ["ADMINISTRADOR", "PRESIDENTE"]);
    var permitidas = Object.keys(PARQUE_CHINA_CONFIG_PADRAO), entrada = novaConfig || {};
    return pcComLock_(function(){
      var aba = obterAbaConfigParqueChina_(), last=aba.getLastRow();
      var chaves = last>=2 ? aba.getRange(2,1,last-1,1).getValues() : [];
Object.keys(entrada).forEach(function(chave){
        if (permitidas.indexOf(chave)===-1) return;
        var valor=entrada[chave], linhas=[];
// Horário sempre gravado como texto "HH:mm" (evita reconversão do Sheets).
        var ehHorario = (chave === "HORARIO_CHECKIN" || chave === "HORARIO_CHECKOUT");
        if (chave === "HORARIO_CHECKIN") valor = pcNormalizarHora_(valor, "14:00");
        if (chave === "HORARIO_CHECKOUT") valor = pcNormalizarHora_(valor, "12:00");
        for(var i=0;i<chaves.length;i++)if(String(chaves[i][0]).trim()===chave)linhas.push(i+2);
        // Instalações antigas podem conter a mesma chave mais de uma vez.
        // Atualizar todas preserva os dados e garante que a última ocorrência,
        // usada na leitura, receba o mesmo valor salvo no painel.
        if(linhas.length)linhas.forEach(function(linha){
          var cel=aba.getRange(linha,2);
          // Para horário, força o formato TEXTO da célula ANTES de gravar. Sem
          // isso, uma célula formatada como "hora" reconverte "14:00" num valor
          // de hora do Sheets e o loop 1899 reaparece na próxima leitura.
          if(ehHorario)cel.setNumberFormat("@");
          cel.setValue(valor);
        });
        else {
          if(ehHorario){
            aba.appendRow([chave,valor,""]);
            aba.getRange(aba.getLastRow(),2).setNumberFormat("@").setValue(valor);
          } else {
            aba.appendRow([chave,valor,""]);
          }
        }
      });
      pcAuditar_("","CONFIGURACAO_ALTERADA","","",sessao.nome||sessao.usuario,"",entrada);
      pcInvalidarCache_();
      return {ok:true,config:obterConfigParqueChina_()};
    });
  } catch (erro) { Logger.log(erro); return {ok:false,mensagem:pcMensagemErro_(erro)}; }
}

/**
 * Endpoints exclusivos da tela v4.2. Retornam somente valores simples para
 * evitar falha silenciosa de serialização no google.script.run e não colidem
 * com versões antigas que possam existir no projeto.
 */
function pcConfigParaClienteV4_(config) {
  config=config||{};
  return {
    MODO_AGENDAMENTO:String(config.MODO_AGENDAMENTO||"MANUAL"),
    PRECO_DIARIA_SEMANAL:pcNumero_(config.PRECO_DIARIA_SEMANAL),
    PRECO_DIARIA_FIM_DE_SEMANA:pcNumero_(config.PRECO_DIARIA_FIM_DE_SEMANA),
    VALOR_COLCHAO_EXTRA:pcNumero_(config.VALOR_COLCHAO_EXTRA),
    ANTECEDENCIA_MAXIMA_DIAS:pcNumero_(config.ANTECEDENCIA_MAXIMA_DIAS),
    CAPACIDADE_MAXIMA_PESSOAS:pcNumero_(config.CAPACIDADE_MAXIMA_PESSOAS),
    EMAIL_CHINA_PARK:String(config.EMAIL_CHINA_PARK||""),
    EMAILS_DESTINATARIOS_CHINA_PARK:String(config.EMAILS_DESTINATARIOS_CHINA_PARK||"secretaria@sindeducacao.com;financeiro@sindeducacao.com;contato@chinapark.com.br"),
    EMAIL_CC_CHINA_PARK:String(config.EMAIL_CC_CHINA_PARK||""),
    EMAIL_CCO_CHINA_PARK:String(config.EMAIL_CCO_CHINA_PARK||""),
    PASTA_AUTORIZACOES_ID:String(config.PASTA_AUTORIZACOES_ID||""),
    HORARIO_CHECKIN:String(config.HORARIO_CHECKIN||"14:00"),
    HORARIO_CHECKOUT:String(config.HORARIO_CHECKOUT||"12:00"),
    ENDERECO_CHINA_PARK:String(config.ENDERECO_CHINA_PARK||""),
    LINK_MAPA_CHINA_PARK:String(config.LINK_MAPA_CHINA_PARK||""),
    EMAIL_RESPOSTA_BENEFICIOS:String(config.EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")
  };
}

function carregarConfiguracoesChinaParkV4(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    pcExigirAdmin_(tokenSessao);
    return {ok:true,config:pcConfigParaClienteV4_(obterConfigParqueChina_())};
  } catch(erro) {
    Logger.log("carregarConfiguracoesChinaParkV4: "+erro);
    return {ok:false,mensagem:pcMensagemErro_(erro),codigo:String(erro&&erro.message||erro||"ERRO_DESCONHECIDO")};
  }
}

function salvarConfiguracoesChinaParkV4(novaConfig, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var retorno=salvarConfiguracoesParqueChina(novaConfig,tokenSessao);
    if(!retorno||!retorno.ok)return retorno||{ok:false,mensagem:"O servidor não retornou o resultado da gravação."};
    return {ok:true,config:pcConfigParaClienteV4_(retorno.config),mensagem:"Configurações salvas com sucesso."};
  } catch(erro) {
    Logger.log("salvarConfiguracoesChinaParkV4: "+erro);
    return {ok:false,mensagem:pcMensagemErro_(erro),codigo:String(erro&&erro.message||erro||"ERRO_DESCONHECIDO")};
  }
}

// ----------------------------------------------------------------------------
// VALIDAÇÃO E CÁLCULO
// ----------------------------------------------------------------------------

function pcCpfValido_(cpf) {
  var v = normalizarCpfParqueChina_(cpf);
  if (!/^\d{11}$/.test(v) || /^(\d)\1{10}$/.test(v)) return false;
  function digito(tamanho) {
    var soma = 0;
    for (var i = 0; i < tamanho; i++) soma += Number(v.charAt(i)) * (tamanho + 1 - i);
    var resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }
  return digito(9) === Number(v.charAt(9)) && digito(10) === Number(v.charAt(10));
}

function pcSanitizarSolicitacaoPublica_(entrada) {
  entrada = entrada || {};
  return {
    nomeSolicitante: String(entrada.nomeSolicitante || "").trim(),
    cpf: normalizarCpfParqueChina_(entrada.cpf),
    telefone: String(entrada.telefone || "").trim(),
    email: String(entrada.email || "").trim(),
    escola: String(entrada.escola || "").trim(),
    dataEntrada: String(entrada.dataEntrada || ""),
    dataSaida: String(entrada.dataSaida || ""),
    suiteSolicitada: entrada.suiteSolicitada || entrada.chaleSolicitado || "QUALQUER_DISPONIVEL",
    quantidadePessoas: Number(entrada.quantidadePessoas || 0),
    dependente1: String(entrada.dependente1 || "").trim(),
    dependente2: String(entrada.dependente2 || "").trim(),
    dependente3: String(entrada.dependente3 || "").trim(),
    dependente4: String(entrada.dependente4 || "").trim(),
    solicitouColchaoExtra: String(entrada.solicitouColchaoExtra || "NAO").toUpperCase() === "SIM" ? "SIM" : "NAO",
    observacaoSolicitante: String(entrada.observacaoSolicitante || "").trim(),
    tipoReserva: entrada.tipoReserva === PC_TIPO_RESERVA.FIM_DE_SEMANA ? PC_TIPO_RESERVA.FIM_DE_SEMANA : PC_TIPO_RESERVA.SEMANAL,
    // Campos financeiros e administrativos nunca são aceitos do navegador público.
    desconto: 0,
    acrescimo: 0,
    gratuitoPago: "PAGO",
    statusPagamento: PC_STATUS_PAGAMENTO.PENDENTE,
    valorRecebido: 0,
    origem: "PORTAL_ASSOCIADO"
  };
}

function validarDadosReservaParqueChina_(dados, opcoes) {
  dados = dados || {}; opcoes = opcoes || {}; var erros = [], config=obterConfigParqueChina_();
  if (!String(dados.nomeSolicitante||"").trim()) erros.push("Nome do solicitante é obrigatório.");
  if (!String(dados.telefone||"").trim()) erros.push("Telefone é obrigatório.");
  if (opcoes.publica && !pcCpfValido_(dados.cpf)) erros.push("Informe um CPF válido.");
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(dados.email))) erros.push("E-mail inválido.");
  if (dados.telefone && normalizarCpfParqueChina_(dados.telefone).length < 10) erros.push("Telefone inválido.");
  if (!dados.dataEntrada || !dados.dataSaida) erros.push("Data de entrada e saída são obrigatórias.");
  if (!dados.quantidadePessoas || Number(dados.quantidadePessoas)<1) erros.push("Quantidade de pessoas é obrigatória.");
  var capacidade = Number(config.CAPACIDADE_MAXIMA_PESSOAS || 4);
  var limite = capacidade + (String(dados.solicitouColchaoExtra || "NAO").toUpperCase() === "SIM" ? 1 : 0);
  if (Number(dados.quantidadePessoas) > limite) erros.push("Quantidade de pessoas acima da capacidade permitida para a suíte.");
  if (dados.dataEntrada && dados.dataSaida) {
    var entrada=new Date(dados.dataEntrada+"T00:00:00"),saida=new Date(dados.dataSaida+"T00:00:00"),hoje=new Date();hoje.setHours(0,0,0,0);
    if(isNaN(entrada.getTime())||isNaN(saida.getTime()))erros.push("Datas inválidas.");
    else {if(saida<=entrada)erros.push("Data de saída deve ser posterior à data de entrada.");if(entrada<hoje)erros.push("Data de entrada não pode ser no passado.");if(Math.floor((entrada-hoje)/86400000)>Number(config.ANTECEDENCIA_MAXIMA_DIAS||30))erros.push("Reserva fora da antecedência máxima configurada.");}
  }
  var suite=dados.suite||dados.suiteSolicitada||dados.chaleSolicitado;
  if(suite&&suite!=="QUALQUER_DISPONIVEL"&&PARQUE_CHINA_CONFIG.SUITES.indexOf(String(suite))===-1)erros.push("Suíte inválida.");
  return erros;
}

function pcDataDia_(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]") return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  var texto = String(valor || "").slice(0, 10);
  var partes = texto.split("-");
  if (partes.length !== 3) return new Date("invalid");
  return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
}

function pcPeriodoMes_(mes, ano) {
  return {inicio:new Date(Number(ano), Number(mes) - 1, 1), fim:new Date(Number(ano), Number(mes), 1)};
}

function pcPeriodosConflitam_(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && fimA > inicioB;
}

function pcDiariasSobrepostas_(entrada, saida, inicioPeriodo, fimPeriodo) {
  var inicio = entrada > inicioPeriodo ? entrada : inicioPeriodo;
  var fim = saida < fimPeriodo ? saida : fimPeriodo;
  return fim > inicio ? Math.round((fim - inicio) / 86400000) : 0;
}

function pcStatusBloqueiaSuite_(status) {
  return PC_STATUS_QUE_BLOQUEIAM_SUITE.indexOf(String(status || "")) !== -1;
}

function pcStatusPodeReceberSuite_(status) {
  return [PC_STATUS.APROVADA, PC_STATUS.AGUARDANDO_PAGAMENTO].indexOf(String(status || "")) !== -1;
}

function calcularNumeroDiariasParqueChina_(dataEntrada, dataSaida) {
  var entrada = new Date(dataEntrada + "T00:00:00");
  var saida = new Date(dataSaida + "T00:00:00");
  return Math.max(1, Math.round((saida - entrada) / 86400000));
}

function calcularValorReservaParqueChina_(tipoReserva, numeroDiarias, quantidadePessoas, colchaoExtra) {
  var c=obterConfigParqueChina_();
  var diaria=tipoReserva===PC_TIPO_RESERVA.FIM_DE_SEMANA?c.PRECO_DIARIA_FIM_DE_SEMANA:c.PRECO_DIARIA_SEMANAL;
  var colchao=String(colchaoExtra).toUpperCase()==="SIM"?c.VALOR_COLCHAO_EXTRA:0;
  return {valorDiaria:diaria,valorColchao:colchao,valorBruto:diaria*Number(numeroDiarias||0)+colchao,valorTotal:diaria*Number(numeroDiarias||0)+colchao};
}

function calcularPeriodoParqueChina_(dataEntrada,dataSaida,quantidadePessoas,colchaoExtra,desconto,acrescimo) {
  var c=obterConfigParqueChina_(), inicio=new Date(dataEntrada+"T00:00:00"), fim=new Date(dataSaida+"T00:00:00");
  var cursor=new Date(inicio),diarias=0,soma=0;
  while(cursor<fim){var dia=cursor.getDay();soma+=(dia===0||dia===6)?c.PRECO_DIARIA_FIM_DE_SEMANA:c.PRECO_DIARIA_SEMANAL;diarias++;cursor.setDate(cursor.getDate()+1);}
  var adicional=String(colchaoExtra).toUpperCase()==="SIM"?c.VALOR_COLCHAO_EXTRA:0;
  var desc=Math.max(0,pcNumero_(desconto)),acre=Math.max(0,pcNumero_(acrescimo));
  return {quantidadeDiarias:diarias,valorDiaria:diarias?soma/diarias:0,valorColchao:adicional,valorBruto:soma+adicional,desconto:desc,acrescimo:acre,valorTotal:Math.max(0,soma+adicional-desc+acre)};
}

function normalizarCpfParqueChina_(cpf) {
  return String(cpf || "").replace(/\D/g, "");
}

function normalizarNomeParqueChina_(nome) {
  return String(nome || "").trim().toLowerCase();
}
/**
 * Neutraliza injeção de fórmula em células de texto vindas de origem pública.
 * Se o valor começa com um caractere que o Sheets interpreta como fórmula
 * (= + - @ e alguns whitespace de controle), prefixa um apóstrofo — o Sheets
 * passa a tratar como texto literal e o apóstrofo não é exibido ao usuário.
 * Só deve ser aplicado a campos de texto livre de origem pública (nome,
 * observação, dependentes). Não aplicar a telefone/CPF, que já passam por
 * normalização própria e podem legitimamente começar com outros símbolos.
 */
function pcSanitizarCelula_(valor) {
  var texto = String(valor == null ? "" : valor);
  if (texto && /^[=+\-@\t\r]/.test(texto)) return "'" + texto;
  return texto;
}

/**
 * Normaliza horário para texto "HH:mm". O Sheets pode ter gravado o horário
 * como valor de hora (Date ancorado em 30/12/1899); nesse caso extraímos
 * hora/minuto no fuso do parque. Garante que config, e-mail, WhatsApp e ofício
 * nunca exibam "Sat Dec 30 1899 ..." no lugar de "14:00".
 */
function pcNormalizarHora_(valor, padrao) {
  padrao = padrao || "00:00";
  if (valor == null || valor === "") return padrao;
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    if (isNaN(valor.getTime())) return padrao;
    // Date com ano < 1970 é a época 30/12/1899 do Sheets: um valor de "hora
    // pura" que já sofreu deslocamento de fuso histórico (GMT-0306) e NÃO
    // representa mais o horário original. É lixo irrecuperável — devolve o
    // padrão em vez de extrair um HH:mm deslocado (14:00 virava 18:53).
    if (valor.getFullYear() < 1970) return padrao;
    return Utilities.formatDate(valor, PARQUE_CHINA_CONFIG.TIMEZONE, "HH:mm");
  }
  var texto = String(valor).trim();
  // String contendo HH:mm em algum ponto (inclui strings de Date serializado).
  // Se contiver "1899" ou "1970", trata como o mesmo lixo e usa o padrão.
  if (/18\d{2}|1899|1970/.test(texto) && /\d{1,2}:\d{2}/.test(texto)) return padrao;
  var m = texto.match(/^\s*(\d{1,2}):(\d{2})/);
  if (m) return ("0" + m[1]).slice(-2) + ":" + m[2];
  return padrao;
}
// ----------------------------------------------------------------------------
// DISPONIBILIDADE (considera apenas reservas já APROVADA, suíte definida)
// ----------------------------------------------------------------------------

function verificarDisponibilidadeSuiteParqueChina_(suite, dataEntrada, dataSaida, ignorarIdReserva) {
  var aba=obterAbaReservaParqueChina_(),last=aba.getLastRow();if(last<2)return true;
  var dados=aba.getRange(2,1,last-1,PC_CABECALHO.length).getValues(),novaEntrada=pcDataDia_(dataEntrada),novaSaida=pcDataDia_(dataSaida);
  for(var i=0;i<dados.length;i++){var l=dados[i];if(ignorarIdReserva&&String(l[PC_COL.ID_RESERVA-1])===String(ignorarIdReserva))continue;if(String(l[PC_COL.SUITE_DEFINIDA-1])!==String(suite))continue;if(!pcStatusBloqueiaSuite_(l[PC_COL.STATUS-1]))continue;var e=pcDataDia_(l[PC_COL.DATA_ENTRADA-1]),s=pcDataDia_(l[PC_COL.DATA_SAIDA-1]);if(pcPeriodosConflitam_(novaEntrada,novaSaida,e,s))return false;}return true;
}

function listarSuitesLivresParqueChina_(dataEntrada, dataSaida) {
  return PARQUE_CHINA_CONFIG.SUITES.filter(function (suite) {
    return verificarDisponibilidadeSuiteParqueChina_(suite, dataEntrada, dataSaida, null);
  });
}

// ----------------------------------------------------------------------------
// SOLICITAÇÃO — entra na fila de sorteio (chamado pelo formulário do associado)
// ----------------------------------------------------------------------------

function solicitarReservaParqueChina(dados) {
  try {
    dados=pcSanitizarSolicitacaoPublica_(dados);var erros=validarDadosReservaParqueChina_(dados,{publica:true});if(erros.length)return {ok:false,mensagem:"Corrija os campos informados.",erros:erros};
    var resultado=pcComLock_(function(){
      var chave=pcChaveIdempotencia_(dados),existente=pcBuscarPorIdempotenciaAtiva_(chave);
      if(existente)return {ok:true,idReserva:existente.idReserva,status:existente.status,reutilizada:true};
      var valores=calcularPeriodoParqueChina_(dados.dataEntrada,dados.dataSaida,dados.quantidadePessoas,dados.solicitouColchaoExtra,dados.desconto,dados.acrescimo);
      var id=gerarIdReservaParqueChina_(),aba=obterAbaReservaParqueChina_(),l=new Array(PC_CABECALHO.length).fill("");
      l[PC_COL.ID_RESERVA-1]=id;l[PC_COL.DATA_SOLICITACAO-1]=new Date();l[PC_COL.STATUS-1]=PC_STATUS.PENDENTE;l[PC_COL.TIPO_RESERVA-1]=dados.tipoReserva||PC_TIPO_RESERVA.SEMANAL;
      l[PC_COL.DATA_ENTRADA-1]=new Date(dados.dataEntrada+"T00:00:00");l[PC_COL.DATA_SAIDA-1]=new Date(dados.dataSaida+"T00:00:00");l[PC_COL.SUITE_SOLICITADA-1]=dados.suiteSolicitada||dados.chaleSolicitado||"QUALQUER_DISPONIVEL";
l[PC_COL.NOME_SOLICITANTE-1]=pcSanitizarCelula_(String(dados.nomeSolicitante||"").trim());l[PC_COL.CPF-1]=normalizarCpfParqueChina_(dados.cpf);l[PC_COL.TELEFONE-1]=dados.telefone;l[PC_COL.EMAIL-1]=dados.email||"";l[PC_COL.ESCOLA-1]=pcSanitizarCelula_(dados.escola||"");l[PC_COL.QTD_PESSOAS-1]=Number(dados.quantidadePessoas);
      [dados.dependente1,dados.dependente2,dados.dependente3,dados.dependente4].forEach(function(v,i){l[PC_COL.DEPENDENTE_1-1+i]=pcSanitizarCelula_(v||"");});
      l[PC_COL.COLCHAO_EXTRA-1]=dados.solicitouColchaoExtra||"NAO";l[PC_COL.VALOR_COLCHAO_EXTRA-1]=valores.valorColchao;l[PC_COL.VALOR_DIARIA-1]=valores.valorDiaria;l[PC_COL.VALOR_TOTAL-1]=valores.valorTotal;l[PC_COL.GRATUITO_PAGO-1]=dados.gratuitoPago||"PAGO";
      l[PC_COL.OBSERVACAO_SOLICITANTE-1]=pcSanitizarCelula_(dados.observacaoSolicitante||"");l[PC_COL.QTD_DIARIAS-1]=valores.quantidadeDiarias;l[PC_COL.VALOR_BRUTO-1]=valores.valorBruto;l[PC_COL.DESCONTO-1]=valores.desconto;l[PC_COL.ACRESCIMO-1]=valores.acrescimo;l[PC_COL.STATUS_PAGAMENTO-1]=dados.statusPagamento||"PENDENTE";
      l[PC_COL.VENCIMENTO_PAGAMENTO-1]=dados.vencimentoPagamento?new Date(dados.vencimentoPagamento+"T00:00:00"):"";l[PC_COL.VALOR_RECEBIDO-1]=0;l[PC_COL.ATUALIZADO_EM-1]=new Date();l[PC_COL.ATUALIZADO_POR-1]="Solicitante";l[PC_COL.ORIGEM-1]=dados.origem||"SISGEP";l[PC_COL.CHAVE_IDEMPOTENCIA-1]=chave;
      aba.appendRow(l);pcAuditar_(id,"SOLICITACAO_CRIADA","",PC_STATUS.PENDENTE,"Solicitante","",{origem:l[PC_COL.ORIGEM-1],valorTotal:valores.valorTotal});
      return {ok:true,idReserva:id,status:PC_STATUS.PENDENTE,valorTotal:valores.valorTotal,quantidadeDiarias:valores.quantidadeDiarias};
    });
    if(resultado&&resultado.ok&&!resultado.reutilizada){pcInvalidarCache_();try{notificarAdminNovaSolicitacaoParqueChina_(dados,resultado.idReserva,resultado.valorTotal);if(dados.email)enviarEmailConfirmacaoSolicitacaoParqueChina_(dados,resultado.idReserva,resultado.valorTotal);}catch(e){Logger.log(e);}}
    return resultado;
  } catch(erro){Logger.log(erro);return {ok:false,mensagem:pcMensagemErro_(erro),erros:[]};}
}

// ----------------------------------------------------------------------------
// DASHBOARD (chamado pelo formulário do associado)
// ----------------------------------------------------------------------------

function dashboardReservaParqueChina() {
  var aba=obterAbaReservaParqueChina_(),last=aba.getLastRow(),r={totalReservas:0,pendentes:0,aprovadas:0,chalesDisponiveisHoje:0};
  if(last>=2)aba.getRange(2,1,last-1,PC_CABECALHO.length).getValues().forEach(function(l){var s=String(l[PC_COL.STATUS-1]);if(s===PC_STATUS.CANCELADA||s===PC_STATUS.RECUSADA)return;r.totalReservas++;if(s===PC_STATUS.PENDENTE||s===PC_STATUS.INSCRITO_SORTEIO)r.pendentes++;if(s===PC_STATUS.APROVADA||s===PC_STATUS.BLOQUEIO_ADMINISTRATIVO)r.aprovadas++;});
  var hoje=Utilities.formatDate(new Date(),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd"),amanha=Utilities.formatDate(new Date(Date.now()+86400000),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd"),disp=obterDisponibilidadeParqueChina_(hoje,amanha);r.chalesDisponiveisHoje=disp&&disp.ok?disp.totalDisponiveis:0;return r;
}

// ----------------------------------------------------------------------------
// LISTAGEM / AGENDA MENSAL
// ----------------------------------------------------------------------------

function listarReservasParqueChina(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  filtros=filtros||{}; pcExigirAdmin_(tokenSessao);
  var aba=obterAbaReservaParqueChina_(),last=aba.getLastRow();if(last<2)return [];
  return aba.getRange(2,1,last-1,PC_CABECALHO.length).getValues().map(mapearLinhaParaObjetoParqueChina_).filter(function(r){
    var entrada=pcDataDia_(r.dataEntrada),saida=pcDataDia_(r.dataSaida);
    if(filtros.status&&r.status!==filtros.status)return false;
    if(filtros.mes&&filtros.ano){var periodo=pcPeriodoMes_(filtros.mes,filtros.ano);if(!pcPeriodosConflitam_(entrada,saida,periodo.inicio,periodo.fim))return false;}
    else if(filtros.ano&&entrada.getFullYear()!==Number(filtros.ano))return false;
    else if(filtros.mes&&(entrada.getMonth()+1)!==Number(filtros.mes))return false;
    return true;
  });
}

function pcDataParaCliente_(valor) {
  if (!valor) return "";
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    if (isNaN(valor.getTime())) return "";
    return Utilities.formatDate(valor, PARQUE_CHINA_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(valor);
}

function mapearLinhaParaObjetoParqueChina_(l) {
  return {idReserva:l[PC_COL.ID_RESERVA-1],dataSolicitacao:pcDataParaCliente_(l[PC_COL.DATA_SOLICITACAO-1]),status:l[PC_COL.STATUS-1],tipoReserva:l[PC_COL.TIPO_RESERVA-1],dataEntrada:pcDataParaCliente_(l[PC_COL.DATA_ENTRADA-1]),dataSaida:pcDataParaCliente_(l[PC_COL.DATA_SAIDA-1]),suiteSolicitada:l[PC_COL.SUITE_SOLICITADA-1],suiteDefinida:l[PC_COL.SUITE_DEFINIDA-1],suite:l[PC_COL.SUITE_DEFINIDA-1]||l[PC_COL.SUITE_SOLICITADA-1],nomeSolicitante:l[PC_COL.NOME_SOLICITANTE-1],cpf:l[PC_COL.CPF-1],telefone:l[PC_COL.TELEFONE-1],email:l[PC_COL.EMAIL-1],escola:l[PC_COL.ESCOLA-1],quantidadePessoas:l[PC_COL.QTD_PESSOAS-1],dependente1:l[PC_COL.DEPENDENTE_1-1],dependente2:l[PC_COL.DEPENDENTE_2-1],dependente3:l[PC_COL.DEPENDENTE_3-1],dependente4:l[PC_COL.DEPENDENTE_4-1],colchaoExtra:l[PC_COL.COLCHAO_EXTRA-1],valorColchaoExtra:pcNumero_(l[PC_COL.VALOR_COLCHAO_EXTRA-1]),valorDiaria:pcNumero_(l[PC_COL.VALOR_DIARIA-1]),valorTotal:pcNumero_(l[PC_COL.VALOR_TOTAL-1]),formaPagamento:l[PC_COL.FORMA_PAGAMENTO-1],gratuitoPago:l[PC_COL.GRATUITO_PAGO-1],observacaoSolicitante:l[PC_COL.OBSERVACAO_SOLICITANTE-1],observacaoAdmin:l[PC_COL.OBSERVACAO_ADMIN-1],responsavelAprovacao:l[PC_COL.RESPONSAVEL_APROVACAO-1],dataAprovacao:pcDataParaCliente_(l[PC_COL.DATA_APROVACAO-1]),motivoRecusa:l[PC_COL.MOTIVO_RECUSA-1],quantidadeDiarias:pcNumero_(l[PC_COL.QTD_DIARIAS-1]),valorBruto:pcNumero_(l[PC_COL.VALOR_BRUTO-1]),desconto:pcNumero_(l[PC_COL.DESCONTO-1]),acrescimo:pcNumero_(l[PC_COL.ACRESCIMO-1]),statusPagamento:l[PC_COL.STATUS_PAGAMENTO-1],vencimentoPagamento:pcDataParaCliente_(l[PC_COL.VENCIMENTO_PAGAMENTO-1]),dataPagamento:pcDataParaCliente_(l[PC_COL.DATA_PAGAMENTO-1]),valorRecebido:pcNumero_(l[PC_COL.VALOR_RECEBIDO-1]),justificativaAjuste:l[PC_COL.JUSTIFICATIVA_AJUSTE-1],atualizadoEm:pcDataParaCliente_(l[PC_COL.ATUALIZADO_EM-1]),atualizadoPor:l[PC_COL.ATUALIZADO_POR-1],origem:l[PC_COL.ORIGEM-1]};
}

function obterAgendaMensalParqueChina(mes, ano, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    pcExigirAdmin_(tokenSessao);var aba=obterAbaReservaParqueChina_(),last=aba.getLastRow(),lista=[],periodo=pcPeriodoMes_(mes,ano);
    if(last>=2)lista=aba.getRange(2,1,last-1,PC_CABECALHO.length).getValues().map(mapearLinhaParaObjetoParqueChina_).filter(function(r){return pcPeriodosConflitam_(pcDataDia_(r.dataEntrada),pcDataDia_(r.dataSaida),periodo.inicio,periodo.fim);});
    var suites={};PARQUE_CHINA_CONFIG.SUITES.forEach(function(s){suites[s]=[];});
    var hoje=pcDataDia_(new Date());
    var out={mes:Number(mes),ano:Number(ano),suites:suites,semSuite:[],totalReservasAprovadas:0,totalPendentes:0,totalCanceladas:0,totalGratuitas:0,totalPagas:0,totalComRecebimento:0,totalDiarias:0,valorPrevisto:0,valorRecebido:0,valorPendente:0,valorGratuidade:0,ticketMedio:0,diariaMedia:0,taxaOcupacao:0,totalHospedes:0,receitaPorSuite:{}};
    lista.forEach(function(r){
      if(r.status===PC_STATUS.PENDENTE||r.status===PC_STATUS.INSCRITO_SORTEIO){out.totalPendentes++;return;}
      if(r.status===PC_STATUS.CANCELADA||r.status===PC_STATUS.RECUSADA){out.totalCanceladas++;return;}
      if(!pcStatusBloqueiaSuite_(r.status))return;
      var suiteAgenda=String(r.suiteDefinida||"");
      r.diariasNoMes=pcDiariasSobrepostas_(pcDataDia_(r.dataEntrada),pcDataDia_(r.dataSaida),periodo.inicio,periodo.fim);
      if(suites[suiteAgenda])suites[suiteAgenda].push(r);
      // Pendência operacional é somente hospedagem ainda ativa ou futura.
      // Reservas históricas sem suíte continuam intactas na planilha e nos
      // relatórios, mas não entram na fila de distribuição automática.
      else if(pcStatusPodeReceberSuite_(r.status)&&pcDataDia_(r.dataSaida)>hoje)out.semSuite.push(r);
      out.totalReservasAprovadas++;out.totalDiarias+=r.diariasNoMes;out.totalHospedes+=Number(r.quantidadePessoas)||0;
      if(r.gratuitoPago==="GRATUITO"||r.statusPagamento===PC_STATUS_PAGAMENTO.ISENTO){out.totalGratuitas++;out.valorGratuidade+=pcNumero_(r.valorTotal);}
      else{
        var recebido=Math.max(0,pcNumero_(r.valorRecebido));
        if(r.statusPagamento===PC_STATUS_PAGAMENTO.PAGO)out.totalPagas++;
        if(recebido>0)out.totalComRecebimento++;
        out.valorPrevisto+=pcNumero_(r.valorTotal);out.valorRecebido+=recebido;
        var chaveSuite=suiteAgenda||"SEM_SUITE";out.receitaPorSuite[chaveSuite]=(out.receitaPorSuite[chaveSuite]||0)+recebido;
      }
    });
    out.valorPendente=Math.max(0,out.valorPrevisto-out.valorRecebido);out.ticketMedio=out.totalComRecebimento?out.valorRecebido/out.totalComRecebimento:0;out.diariaMedia=out.totalDiarias?out.valorRecebido/out.totalDiarias:0;var diasMes=new Date(Number(ano),Number(mes),0).getDate();out.taxaOcupacao=diasMes?Math.min(100,out.totalDiarias/(PARQUE_CHINA_CONFIG.SUITES.length*diasMes)*100):0;out.saldoMes=out.valorRecebido;out.aguardandoSorteio=0;
    out.ok=true;
    return out;
  } catch (erro) {
    Logger.log("obterAgendaMensalParqueChina: " + erro);
    return { ok:false, mensagem: pcMensagemErro_(erro), mes:Number(mes), ano:Number(ano), suites:{}, semSuite:[], totalReservasAprovadas:0, totalPendentes:0, totalDiarias:0, valorPrevisto:0, valorRecebido:0, valorPendente:0, ticketMedio:0, diariaMedia:0, taxaOcupacao:0 };
  }
}
/**
 * Entrega toda a tela administrativa em uma única resposta serializável.
 * Evita duas chamadas concorrentes, estados parciais e datas inválidas no
 * transporte do google.script.run.
 */
function getDashboardChinaPark(parametros, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    parametros=parametros||{};
    pcExigirAdmin_(tokenSessao);
    var mes=Number(parametros.mes)||new Date().getMonth()+1;
    var ano=Number(parametros.ano)||new Date().getFullYear();
    var agenda=obterAgendaMensalParqueChina(mes,ano,tokenSessao);
    if (!agenda || agenda.ok===false) return {ok:false,mensagem:(agenda&&agenda.mensagem)||"Falha ao montar a agenda."};
    var reservas=listarReservasParqueChina({mes:mes,ano:ano},tokenSessao),config=obterConfigParqueChina_();
    return {ok:true,mes:mes,ano:ano,agenda:agenda,reservas:reservas,operacaoHotel:{horarioCheckin:String(config.HORARIO_CHECKIN||"14:00"),horarioCheckout:String(config.HORARIO_CHECKOUT||"12:00")},alertas:[],atualizadoEm:Utilities.formatDate(new Date(),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss")};
  } catch (erro) {
    Logger.log("getDashboardChinaPark: "+erro);
    return {ok:false,mensagem:pcMensagemErro_(erro)};
  }
}

function calcularSaldoMensalParqueChina(mes, ano, tokenSessao) { return obterAgendaMensalParqueChina(mes, ano, tokenSessao); }

function obterRelatorioParqueChina(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    filtros=filtros||{};
    pcExigirAdmin_(tokenSessao);
    var ano=Number(filtros.ano)||new Date().getFullYear();
    var mes=filtros.mes?Number(filtros.mes):0;
    var descartadas=0,lista=listarReservasParqueChina({ano:ano},tokenSessao).filter(function(r){var d=pcDataDia_(r.dataEntrada);if(isNaN(d.getTime())){descartadas++;return false;}return !mes||(d.getMonth()+1===mes);});
    var meses=[];
    for(var i=1;i<=12;i++)meses.push({mes:i,total:0,aprovadas:0,pagas:0,gratuitas:0,diarias:0,valorPrevisto:0,valorRecebido:0,valorPendente:0,semSuite:0});
    var resumo={total:0,aprovadas:0,pendentes:0,canceladas:0,pagas:0,gratuitas:0,diarias:0,valorPrevisto:0,valorRecebido:0,valorPendente:0,semSuite:0};
    lista.forEach(function(r){
      var d=pcDataDia_(r.dataEntrada),m=meses[d.getMonth()],status=String(r.status||"");if(!m)return;
      var ativa=[PC_STATUS.APROVADA,PC_STATUS.AGUARDANDO_PAGAMENTO,PC_STATUS.BLOQUEIO_ADMINISTRATIVO,PC_STATUS.FINALIZADA].indexOf(status)!==-1;
      var entrada=pcDataDia_(r.dataEntrada),saida=pcDataDia_(r.dataSaida),diarias=pcNumero_(r.quantidadeDiarias);if(!diarias&&!isNaN(saida.getTime())&&saida>entrada)diarias=Math.max(1,Math.round((saida-entrada)/86400000));
      var suite=String(r.suiteDefinida||"");
      resumo.total++;m.total++;
      if(ativa){resumo.aprovadas++;m.aprovadas++;resumo.diarias+=diarias;m.diarias+=diarias;}
      if(status===PC_STATUS.PENDENTE||status===PC_STATUS.INSCRITO_SORTEIO)resumo.pendentes++;
      if(status===PC_STATUS.CANCELADA||status===PC_STATUS.RECUSADA)resumo.canceladas++;
      if(pcStatusPodeReceberSuite_(status)&&!suite){resumo.semSuite++;m.semSuite++;}
      if(ativa&&(r.gratuitoPago==="GRATUITO"||r.statusPagamento===PC_STATUS_PAGAMENTO.ISENTO)){resumo.gratuitas++;m.gratuitas++;}
      else if(ativa){var recebido=Math.max(0,pcNumero_(r.valorRecebido));if(r.statusPagamento===PC_STATUS_PAGAMENTO.PAGO){resumo.pagas++;m.pagas++;}resumo.valorPrevisto+=pcNumero_(r.valorTotal);m.valorPrevisto+=pcNumero_(r.valorTotal);resumo.valorRecebido+=recebido;m.valorRecebido+=recebido;}
    });
    resumo.valorPendente=Math.max(0,resumo.valorPrevisto-resumo.valorRecebido);
    meses.forEach(function(m){m.valorPendente=Math.max(0,m.valorPrevisto-m.valorRecebido);});
    return {ok:true,ano:ano,mes:mes,resumo:resumo,meses:meses,reservas:lista,registrosDescartados:descartadas,geradoEm:Utilities.formatDate(new Date(),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss")};
  } catch (erro) {
    Logger.log("obterRelatorioParqueChina: " + erro);
    return { ok:false, mensagem: pcMensagemErro_(erro) };
  }
}

// ----------------------------------------------------------------------------
// APROVAÇÃO MANUAL / RECUSA / CANCELAMENTO
// (uso administrativo direto — bloqueios institucionais, correções, etc.
//  não passa pelo sorteio)
// ----------------------------------------------------------------------------

function aprovarReservaParqueChina(idReserva, dadosAprovacao, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try { var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email;dadosAprovacao=dadosAprovacao||{};
    return pcComLock_(function(){var encontrada=buscarReservaParqueChinaPorId_(idReserva);if(!encontrada)return {ok:false,mensagem:"Reserva não encontrada."};var anterior=String(encontrada.valores[PC_COL.STATUS-1]);if([PC_STATUS.CANCELADA,PC_STATUS.RECUSADA,PC_STATUS.FINALIZADA].indexOf(anterior)!==-1)return {ok:false,mensagem:"O status atual não permite aprovação."};
      var suite=String(dadosAprovacao.suiteDefinida||encontrada.valores[PC_COL.SUITE_SOLICITADA-1]||"");if(!suite||suite==="QUALQUER_DISPONIVEL")return {ok:false,mensagem:"Escolha uma suíte específica."};if(PARQUE_CHINA_CONFIG.SUITES.indexOf(suite)===-1)return {ok:false,mensagem:"Suíte inválida."};var entrada=Utilities.formatDate(new Date(encontrada.valores[PC_COL.DATA_ENTRADA-1]),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd"),saida=Utilities.formatDate(new Date(encontrada.valores[PC_COL.DATA_SAIDA-1]),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd");if(!verificarDisponibilidadeSuiteParqueChina_(suite,entrada,saida,idReserva))return {ok:false,mensagem:"A suíte "+suite+" já está ocupada nesse período."};
      var aba=obterAbaReservaParqueChina_(),linha=encontrada.linha,atual=pcNumero_(encontrada.valores[PC_COL.VALOR_TOTAL-1]),novo=dadosAprovacao.valorTotalFinal!==undefined&&dadosAprovacao.valorTotalFinal!==""?pcNumero_(dadosAprovacao.valorTotalFinal):atual;var justificativa=String(dadosAprovacao.justificativaAjuste||dadosAprovacao.observacaoAdmin||"").trim();if(Math.abs(novo-atual)>0.009&&!justificativa)return {ok:false,mensagem:"Informe a justificativa para alterar o valor."};
      aba.getRange(linha,PC_COL.STATUS).setValue(PC_STATUS.APROVADA);aba.getRange(linha,PC_COL.SUITE_DEFINIDA).setValue(suite);aba.getRange(linha,PC_COL.VALOR_TOTAL).setValue(novo);if(dadosAprovacao.formaPagamento)aba.getRange(linha,PC_COL.FORMA_PAGAMENTO).setValue(dadosAprovacao.formaPagamento);if(dadosAprovacao.gratuitoPago)aba.getRange(linha,PC_COL.GRATUITO_PAGO).setValue(dadosAprovacao.gratuitoPago);if(dadosAprovacao.statusPagamento)aba.getRange(linha,PC_COL.STATUS_PAGAMENTO).setValue(dadosAprovacao.statusPagamento);aba.getRange(linha,PC_COL.OBSERVACAO_ADMIN).setValue(dadosAprovacao.observacaoAdmin||"");aba.getRange(linha,PC_COL.JUSTIFICATIVA_AJUSTE).setValue(justificativa);aba.getRange(linha,PC_COL.RESPONSAVEL_APROVACAO).setValue(responsavel);aba.getRange(linha,PC_COL.DATA_APROVACAO).setValue(new Date());aba.getRange(linha,PC_COL.ATUALIZADO_EM).setValue(new Date());aba.getRange(linha,PC_COL.ATUALIZADO_POR).setValue(responsavel);
      pcAuditar_(idReserva,"RESERVA_APROVADA",anterior,PC_STATUS.APROVADA,responsavel,justificativa,{suite:suite,valorAnterior:atual,valorFinal:novo});pcInvalidarCache_();return {ok:true,idReserva:idReserva,status:PC_STATUS.APROVADA,suite:suite,valorTotal:novo,comunicacaoPendente:true};});
  } catch(erro){Logger.log(erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function recusarReservaParqueChina(idReserva, motivo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email;if(!String(motivo||"").trim())return {ok:false,mensagem:"Informe o motivo da recusa."};return pcComLock_(function(){var r=buscarReservaParqueChinaPorId_(idReserva);if(!r)return {ok:false,mensagem:"Reserva não encontrada."};var anterior=String(r.valores[PC_COL.STATUS-1]);if([PC_STATUS.PENDENTE,PC_STATUS.INSCRITO_SORTEIO].indexOf(anterior)===-1)return {ok:false,mensagem:"Somente solicitações aguardando análise podem ser recusadas."};var aba=obterAbaReservaParqueChina_();aba.getRange(r.linha,PC_COL.STATUS).setValue(PC_STATUS.RECUSADA);aba.getRange(r.linha,PC_COL.MOTIVO_RECUSA).setValue(motivo);aba.getRange(r.linha,PC_COL.RESPONSAVEL_APROVACAO).setValue(responsavel);aba.getRange(r.linha,PC_COL.DATA_APROVACAO).setValue(new Date());aba.getRange(r.linha,PC_COL.ATUALIZADO_EM).setValue(new Date());aba.getRange(r.linha,PC_COL.ATUALIZADO_POR).setValue(responsavel);pcAuditar_(idReserva,"RESERVA_RECUSADA",anterior,PC_STATUS.RECUSADA,responsavel,motivo,{});pcInvalidarCache_();try{var obj=mapearLinhaParaObjetoParqueChina_(aba.getRange(r.linha,1,1,PC_CABECALHO.length).getValues()[0]);if(obj.email)enviarEmailRecusaParqueChina_(obj,motivo);}catch(e){Logger.log(e);}return {ok:true,idReserva:idReserva,status:PC_STATUS.RECUSADA};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function cancelarReservaParqueChina(idReserva, motivo, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email;if(!String(motivo||"").trim())return {ok:false,mensagem:"Informe o motivo do cancelamento."};return pcComLock_(function(){var r=buscarReservaParqueChinaPorId_(idReserva);if(!r)return {ok:false,mensagem:"Reserva não encontrada."};var aut=pcMapaAutorizacoesAtivas_()[String(idReserva)];if(aut)return {ok:false,mensagem:"A reserva está vinculada ao Ofício "+aut.numeroOficio+". Faça o cancelamento por Retificação para comunicar formalmente o parque."};var anterior=String(r.valores[PC_COL.STATUS-1]);if([PC_STATUS.CANCELADA,PC_STATUS.RECUSADA,PC_STATUS.FINALIZADA].indexOf(anterior)!==-1)return {ok:false,mensagem:"O status atual não permite cancelamento."};var aba=obterAbaReservaParqueChina_();aba.getRange(r.linha,PC_COL.STATUS).setValue(PC_STATUS.CANCELADA);aba.getRange(r.linha,PC_COL.OBSERVACAO_ADMIN).setValue((r.valores[PC_COL.OBSERVACAO_ADMIN-1]||"")+" | Cancelada: "+motivo);aba.getRange(r.linha,PC_COL.ATUALIZADO_EM).setValue(new Date());aba.getRange(r.linha,PC_COL.ATUALIZADO_POR).setValue(responsavel);pcAuditar_(idReserva,"RESERVA_CANCELADA",anterior,PC_STATUS.CANCELADA,responsavel,motivo,{});pcInvalidarCache_();return {ok:true,idReserva:idReserva,status:PC_STATUS.CANCELADA};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function editarReservaParqueChina(idReserva, dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP";dados=dados||{};
    return pcComLock_(function(){
      var achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};
      var atual=mapearLinhaParaObjetoParqueChina_(achada.valores),status=String(atual.status||"");
      if([PC_STATUS.CANCELADA,PC_STATUS.RECUSADA,PC_STATUS.FINALIZADA,PC_STATUS.BLOQUEIO_ADMINISTRATIVO].indexOf(status)!==-1)return {ok:false,mensagem:"O status atual não permite edição."};
      var autorizacao=pcMapaAutorizacoesAtivas_()[String(idReserva)];
      if(autorizacao)return {ok:false,mensagem:"A reserva já está vinculada ao Ofício "+autorizacao.numeroOficio+". Faça a alteração por uma Retificação para manter o documento do parque consistente."};
      var motivo=String(dados.motivoEdicao||"").trim();if(!motivo)return {ok:false,mensagem:"Informe o motivo da edição."};
      var nome=String(dados.nomeSolicitante||"").trim().replace(/\s+/g," "),telefone=String(dados.telefone||"").trim(),cpf=normalizarCpfParqueChina_(dados.cpf),email=String(dados.email||"").trim();
      if(!nome)return {ok:false,mensagem:"Informe o hóspede responsável."};
      if(normalizarCpfParqueChina_(telefone).length<10)return {ok:false,mensagem:"Informe um telefone válido."};
      if(cpf&&!pcCpfValido_(cpf))return {ok:false,mensagem:"Informe um CPF válido."};
      if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {ok:false,mensagem:"Informe um e-mail válido."};
      var entrada=pcDataDia_(dados.dataEntrada),saida=pcDataDia_(dados.dataSaida);if(isNaN(entrada.getTime())||isNaN(saida.getTime())||saida<=entrada)return {ok:false,mensagem:"Informe um período válido; a saída deve ser posterior à entrada."};
      var suite=String(dados.suite||atual.suiteDefinida||atual.suiteSolicitada||"");if(PARQUE_CHINA_CONFIG.SUITES.indexOf(suite)===-1)return {ok:false,mensagem:"Selecione uma suíte válida."};
      var temp={nomeSolicitante:nome,dependente1:dados.dependente1,dependente2:dados.dependente2,dependente3:dados.dependente3,dependente4:dados.dependente4},dependentes=pcDependentesReserva_(temp),quantidade=Math.max(Number(dados.quantidadePessoas||0),1+dependentes.length),colchao=String(dados.solicitouColchaoExtra||atual.colchaoExtra||"NAO").toUpperCase()==="SIM"?"SIM":"NAO",config=obterConfigParqueChina_(),limite=Number(config.CAPACIDADE_MAXIMA_PESSOAS||4)+(colchao==="SIM"?1:0);
      if(quantidade>limite)return {ok:false,mensagem:"A quantidade de hóspedes excede a capacidade permitida para a suíte."};
      if(pcStatusBloqueiaSuite_(status)&&!verificarDisponibilidadeSuiteParqueChina_(suite,dados.dataEntrada,dados.dataSaida,idReserva))return {ok:false,mensagem:"A suíte "+suite+" não está disponível no período informado."};
      var valores=calcularPeriodoParqueChina_(dados.dataEntrada,dados.dataSaida,quantidade,colchao,atual.desconto,atual.acrescimo);if(Number(atual.valorRecebido||0)>valores.valorTotal+0.009)return {ok:false,mensagem:"O novo total ficaria menor que o valor já recebido. Ajuste primeiro o pagamento."};
      var aba=obterAbaReservaParqueChina_(),linha=achada.linha,antes={nome:atual.nomeSolicitante,entrada:atual.dataEntrada,saida:atual.dataSaida,suite:atual.suiteDefinida||atual.suiteSolicitada,telefone:atual.telefone,email:atual.email,dependentes:pcDependentesReserva_(atual)};
      aba.getRange(linha,PC_COL.NOME_SOLICITANTE).setValue(nome);aba.getRange(linha,PC_COL.CPF).setValue(cpf);aba.getRange(linha,PC_COL.TELEFONE).setValue(telefone);aba.getRange(linha,PC_COL.EMAIL).setValue(email);aba.getRange(linha,PC_COL.DATA_ENTRADA).setValue(entrada);aba.getRange(linha,PC_COL.DATA_SAIDA).setValue(saida);aba.getRange(linha,PC_COL.SUITE_SOLICITADA).setValue(suite);if(pcStatusPodeReceberSuite_(status))aba.getRange(linha,PC_COL.SUITE_DEFINIDA).setValue(suite);
      [PC_COL.DEPENDENTE_1,PC_COL.DEPENDENTE_2,PC_COL.DEPENDENTE_3,PC_COL.DEPENDENTE_4].forEach(function(col,i){aba.getRange(linha,col).setValue(dependentes[i]||"");});
      aba.getRange(linha,PC_COL.QTD_PESSOAS).setValue(quantidade);aba.getRange(linha,PC_COL.COLCHAO_EXTRA).setValue(colchao);aba.getRange(linha,PC_COL.QTD_DIARIAS).setValue(valores.quantidadeDiarias);aba.getRange(linha,PC_COL.VALOR_DIARIA).setValue(valores.valorDiaria);aba.getRange(linha,PC_COL.VALOR_COLCHAO_EXTRA).setValue(valores.valorColchao);aba.getRange(linha,PC_COL.VALOR_BRUTO).setValue(valores.valorBruto);aba.getRange(linha,PC_COL.VALOR_TOTAL).setValue(valores.valorTotal);aba.getRange(linha,PC_COL.OBSERVACAO_ADMIN).setValue(String(atual.observacaoAdmin||"")+" | Editada: "+motivo);aba.getRange(linha,PC_COL.ATUALIZADO_EM).setValue(new Date());aba.getRange(linha,PC_COL.ATUALIZADO_POR).setValue(responsavel);
      pcAuditar_(idReserva,"RESERVA_EDITADA",status,status,responsavel,motivo,{antes:antes,depois:{nome:nome,entrada:dados.dataEntrada,saida:dados.dataSaida,suite:suite,telefone:telefone,email:email,dependentes:dependentes,quantidadePessoas:quantidade,valorTotal:valores.valorTotal}});pcInvalidarCache_();
      return {ok:true,idReserva:idReserva,valorTotal:valores.valorTotal,quantidadePessoas:quantidade};
    });
  } catch(erro){Logger.log("editarReservaParqueChina: "+erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

/**
 * Bloqueio administrativo direto (uso institucional: Sindicato, SINPRO,
 * Presidente, etc.) — não gera solicitação pendente, entra direto como
 * APROVADA. Requer sessão logada.
 */
function criarAgendamentoManualParqueChina(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email;dados=dados||{};
    var erros=validarDadosReservaParqueChina_(dados,{admin:true});if(erros.length)return {ok:false,mensagem:"Corrija os campos informados.",erros:erros};
    var suite=String(dados.suite||dados.suiteSolicitada||dados.chaleSolicitado||"");if(PARQUE_CHINA_CONFIG.SUITES.indexOf(suite)===-1)return {ok:false,mensagem:"Selecione uma suíte válida."};
    return pcComLock_(function(){
      if(!verificarDisponibilidadeSuiteParqueChina_(suite,dados.dataEntrada,dados.dataSaida,null))return {ok:false,mensagem:"A suíte "+suite+" já está ocupada nesse período."};
      var valores=calcularPeriodoParqueChina_(dados.dataEntrada,dados.dataSaida,dados.quantidadePessoas,dados.solicitouColchaoExtra,dados.desconto,dados.acrescimo);
      var valorFinal=dados.valorTotalFinal!==undefined&&dados.valorTotalFinal!==""?pcNumero_(dados.valorTotalFinal):valores.valorTotal;
      var justificativa=String(dados.justificativaAjuste||"").trim();
      if(Math.abs(valorFinal-valores.valorTotal)>0.009&&!justificativa)return {ok:false,mensagem:"Informe a justificativa para alterar o valor final."};
      var tipoValor=String(dados.gratuitoPago||"PAGO")==="GRATUITO"?"GRATUITO":"PAGO";
      var recebido=tipoValor==="GRATUITO"?0:Math.max(0,pcNumero_(dados.valorRecebido));
      if(recebido>valorFinal+0.009)return {ok:false,mensagem:"O valor recebido não pode ser maior que o valor total."};
      var statusPagamento=tipoValor==="GRATUITO"?PC_STATUS_PAGAMENTO.ISENTO:(recebido>=valorFinal&&valorFinal>0?PC_STATUS_PAGAMENTO.PAGO:recebido>0?PC_STATUS_PAGAMENTO.PARCIAL:PC_STATUS_PAGAMENTO.PENDENTE);
      var id=gerarIdReservaParqueChina_(),aba=obterAbaReservaParqueChina_(),l=new Array(PC_CABECALHO.length).fill("");
      l[PC_COL.ID_RESERVA-1]=id;l[PC_COL.DATA_SOLICITACAO-1]=new Date();l[PC_COL.STATUS-1]=dados.bloqueioInstitucional?PC_STATUS.BLOQUEIO_ADMINISTRATIVO:PC_STATUS.APROVADA;l[PC_COL.TIPO_RESERVA-1]=dados.tipoReserva||PC_TIPO_RESERVA.SEMANAL;l[PC_COL.DATA_ENTRADA-1]=pcDataDia_(dados.dataEntrada);l[PC_COL.DATA_SAIDA-1]=pcDataDia_(dados.dataSaida);l[PC_COL.SUITE_SOLICITADA-1]=suite;l[PC_COL.SUITE_DEFINIDA-1]=suite;l[PC_COL.NOME_SOLICITANTE-1]=dados.nomeSolicitante;l[PC_COL.CPF-1]=normalizarCpfParqueChina_(dados.cpf);l[PC_COL.TELEFONE-1]=dados.telefone;l[PC_COL.EMAIL-1]=dados.email||"";l[PC_COL.ESCOLA-1]=dados.escola||"";l[PC_COL.QTD_PESSOAS-1]=Number(dados.quantidadePessoas);[dados.dependente1,dados.dependente2,dados.dependente3,dados.dependente4].forEach(function(v,i){l[PC_COL.DEPENDENTE_1-1+i]=pcSanitizarCelula_(String(v||"").trim());});l[PC_COL.COLCHAO_EXTRA-1]=dados.solicitouColchaoExtra||"NAO";l[PC_COL.VALOR_COLCHAO_EXTRA-1]=valores.valorColchao;l[PC_COL.VALOR_DIARIA-1]=valores.valorDiaria;l[PC_COL.VALOR_TOTAL-1]=valorFinal;l[PC_COL.VALOR_BRUTO-1]=valores.valorBruto;l[PC_COL.QTD_DIARIAS-1]=valores.quantidadeDiarias;l[PC_COL.DESCONTO-1]=valores.desconto;l[PC_COL.ACRESCIMO-1]=valores.acrescimo;l[PC_COL.FORMA_PAGAMENTO-1]=dados.formaPagamento||"";l[PC_COL.GRATUITO_PAGO-1]=tipoValor;l[PC_COL.STATUS_PAGAMENTO-1]=statusPagamento;l[PC_COL.VALOR_RECEBIDO-1]=recebido;l[PC_COL.OBSERVACAO_ADMIN-1]=dados.observacaoAdmin||"Agendamento manual";l[PC_COL.JUSTIFICATIVA_AJUSTE-1]=justificativa;l[PC_COL.RESPONSAVEL_APROVACAO-1]=responsavel;l[PC_COL.DATA_APROVACAO-1]=new Date();l[PC_COL.ATUALIZADO_EM-1]=new Date();l[PC_COL.ATUALIZADO_POR-1]=responsavel;l[PC_COL.ORIGEM-1]="ADMIN_MANUAL";l[PC_COL.CHAVE_IDEMPOTENCIA-1]=Utilities.getUuid();
      aba.appendRow(l);pcAuditar_(id,"AGENDAMENTO_MANUAL","",l[PC_COL.STATUS-1],responsavel,justificativa,{suite:suite,valorTotal:valorFinal});pcInvalidarCache_();
      return {ok:true,idReserva:id,status:l[PC_COL.STATUS-1],suite:suite,valorTotal:valorFinal,quantidadeDiarias:valores.quantidadeDiarias};
    });
  }catch(erro){Logger.log(erro);return {ok:false,mensagem:pcMensagemErro_(erro),erros:[]};}
}

function bloquearSuiteAdministrativoParqueChina(dados, tokenSessao) { dados=dados||{};dados.bloqueioInstitucional=true;dados.gratuitoPago="GRATUITO";dados.statusPagamento="ISENTO";return criarAgendamentoManualParqueChina(dados,tokenSessao); }

function calcularPreviaAgendamentoParqueChina(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try { pcExigirAdmin_(tokenSessao); var erros=validarDadosReservaParqueChina_(dados||{}); if(erros.length)return {ok:false,erros:erros,mensagem:"Corrija os campos informados."}; return {ok:true,valores:calcularPeriodoParqueChina_(dados.dataEntrada,dados.dataSaida,dados.quantidadePessoas,dados.solicitouColchaoExtra,dados.desconto,dados.acrescimo)}; }
  catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

// ----------------------------------------------------------------------------
// PONTE COM O FINANCEIRO — receita da hospedagem
// ----------------------------------------------------------------------------
// A reserva continua sendo Benefícios (suíte, hóspede, ocupação). O dinheiro
// da hospedagem, porém, é receita do sindicato e precisa aparecer na Central
// Financeira — mesmo padrão já usado em EventosEmissao.gs para o ingresso de
// acompanhante. Sem isto, o valor fica preso no módulo de Benefícios e o
// Financeiro enxerga só 1 das 5 fontes de receita do sindicato.
//
// Lança sempre a DIFERENÇA, nunca o valor cheio: registrarPagamentoParqueChina
// grava VALOR_RECEBIDO como valor absoluto (não incremento), então registrar
// 300 e depois corrigir para 500 dispararia dois lançamentos. Só o delta
// positivo vira receita; correção para baixo é registrada na auditoria da
// reserva, não gera receita negativa silenciosa.
//
// Nunca lança erro: falha ao espelhar no Financeiro não pode travar o
// registro do pagamento em si (mesmo princípio de finAudRegistrarAlteracaoValor_).
function pcRegistrarReceitaPagamento_(reserva, delta, dadosPagamento, tokenSessao) {
  try {
    if (!(delta > 0.009)) return;
    if (String(reserva.gratuitoPago || "") === "GRATUITO") return;

    var noite = reserva.quantidadeDiarias ? (reserva.quantidadeDiarias + " diária(s)") : "";
    var suite = reserva.suiteDefinida || reserva.suiteSolicitada || "";

    cadastrarReceita({
      tipo: "Parque do China",
      categoria: "Hospedagem",
      descricao: "Hospedagem Parque do China — " + (reserva.nomeSolicitante || "") +
                 (suite ? " — Suíte " + suite : "") + (noite ? " — " + noite : ""),
      empresa: reserva.escola || "",
      cnpj: reserva.cpf || "",
      valor: delta,
      formaRecebimento: (dadosPagamento && dadosPagamento.formaPagamento) || reserva.formaPagamento || "",
      dataRecebimento: (dadosPagamento && dadosPagamento.dataPagamento) || "",
      status: "RECEBIDO",
      observacoes: "Reserva " + (reserva.idReserva || "") + ". Lançado automaticamente ao registrar o " +
                   "pagamento no Parque do China (valor total da reserva: R$ " +
                   Number(reserva.valorTotal || 0).toFixed(2) + ")."
    }, tokenSessao);
  } catch (e) {
    Logger.log("pcRegistrarReceitaPagamento_ (não bloqueia o pagamento): " + e);
  }
}

function registrarPagamentoParqueChina(idReserva, dadosPagamento, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email;dadosPagamento=dadosPagamento||{};return pcComLock_(function(){var r=buscarReservaParqueChinaPorId_(idReserva);if(!r)return {ok:false,mensagem:"Reserva não encontrada."};var statusReserva=String(r.valores[PC_COL.STATUS-1]);if([PC_STATUS.APROVADA,PC_STATUS.AGUARDANDO_PAGAMENTO].indexOf(statusReserva)===-1)return {ok:false,mensagem:"O status da reserva não permite registrar pagamento."};if(String(r.valores[PC_COL.GRATUITO_PAGO-1])==="GRATUITO")return {ok:false,mensagem:"Reserva gratuita não recebe pagamento."};var aba=obterAbaReservaParqueChina_(),valor=pcNumero_(dadosPagamento.valorRecebido),total=pcNumero_(r.valores[PC_COL.VALOR_TOTAL-1]);if(valor<0)return {ok:false,mensagem:"O valor recebido não pode ser negativo."};if(valor>total+0.009)return {ok:false,mensagem:"O valor recebido não pode ser maior que o valor total."};var status=valor>=total&&total>0?PC_STATUS_PAGAMENTO.PAGO:valor>0?PC_STATUS_PAGAMENTO.PARCIAL:PC_STATUS_PAGAMENTO.PENDENTE;aba.getRange(r.linha,PC_COL.VALOR_RECEBIDO).setValue(valor);aba.getRange(r.linha,PC_COL.STATUS_PAGAMENTO).setValue(status);aba.getRange(r.linha,PC_COL.FORMA_PAGAMENTO).setValue(dadosPagamento.formaPagamento||r.valores[PC_COL.FORMA_PAGAMENTO-1]||"");aba.getRange(r.linha,PC_COL.DATA_PAGAMENTO).setValue(dadosPagamento.dataPagamento?pcDataDia_(dadosPagamento.dataPagamento):(valor>0?new Date():""));aba.getRange(r.linha,PC_COL.ATUALIZADO_EM).setValue(new Date());aba.getRange(r.linha,PC_COL.ATUALIZADO_POR).setValue(responsavel);pcAuditar_(idReserva,"PAGAMENTO_ATUALIZADO",String(r.valores[PC_COL.STATUS_PAGAMENTO-1]||""),status,responsavel,dadosPagamento.observacao||"",{valorAnterior:pcNumero_(r.valores[PC_COL.VALOR_RECEBIDO-1]),valorRecebido:valor,valorTotal:total});pcRegistrarReceitaPagamento_(mapearLinhaParaObjetoParqueChina_(r.valores),valor-pcNumero_(r.valores[PC_COL.VALOR_RECEBIDO-1]),dadosPagamento,tokenSessao);pcInvalidarCache_();return {ok:true,idReserva:idReserva,statusPagamento:status,valorRecebido:valor,valorPendente:Math.max(0,total-valor)};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function migrarModuloParqueChinaParaManual(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email;return pcComLock_(function(){var aba=obterAbaReservaParqueChina_(),last=aba.getLastRow(),alteradas=0;if(last>=2){var status=aba.getRange(2,PC_COL.STATUS,last-1,1).getValues();for(var i=0;i<status.length;i++)if(String(status[i][0])===PC_STATUS.INSCRITO_SORTEIO){status[i][0]=PC_STATUS.PENDENTE;alteradas++;}if(alteradas)aba.getRange(2,PC_COL.STATUS,last-1,1).setValues(status);}obterAbaConfigParqueChina_();pcAuditar_("","MIGRACAO_PARA_MANUAL",PC_STATUS.INSCRITO_SORTEIO,PC_STATUS.PENDENTE,responsavel,"Sorteio desativado",{linhasAlteradas:alteradas});return {ok:true,linhasAlteradas:alteradas};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

// ----------------------------------------------------------------------------
// DISTRIBUIÇÃO ASSISTIDA DE RESERVAS SEM SUÍTE
// ----------------------------------------------------------------------------

function pcLerLinhasReservas_() {
  var aba=obterAbaReservaParqueChina_(),last=aba.getLastRow();
  if(last<2)return {aba:aba,linhas:[]};
  return {aba:aba,linhas:aba.getRange(2,1,last-1,PC_CABECALHO.length).getValues().map(function(l,i){return {linha:i+2,valores:l,reserva:mapearLinhaParaObjetoParqueChina_(l)};})};
}

function pcMontarOcupacao_(linhas) {
  var ocupacao={};PARQUE_CHINA_CONFIG.SUITES.forEach(function(s){ocupacao[s]=[];});
  (linhas||[]).forEach(function(item){var r=item.reserva,suite=String(r.suiteDefinida||"");if(!ocupacao[suite]||!pcStatusBloqueiaSuite_(r.status))return;ocupacao[suite].push({idReserva:String(r.idReserva),entrada:pcDataDia_(r.dataEntrada),saida:pcDataDia_(r.dataSaida)});});
  return ocupacao;
}

function pcSuiteLivreNaOcupacao_(suite, entrada, saida, ocupacao, ignorarId) {
  return !(ocupacao[suite]||[]).some(function(x){return (!ignorarId||String(x.idReserva)!==String(ignorarId))&&pcPeriodosConflitam_(entrada,saida,x.entrada,x.saida);});
}

function sugerirDistribuicaoAutomaticaParqueChina(parametros, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try{
    pcExigirAdmin_(tokenSessao);parametros=parametros||{};
    var mes=Number(parametros.mes)||new Date().getMonth()+1,ano=Number(parametros.ano)||new Date().getFullYear(),periodo=pcPeriodoMes_(mes,ano),hoje=pcDataDia_(new Date());
    var leitura=pcLerLinhasReservas_(),ocupacao=pcMontarOcupacao_(leitura.linhas),uso={};PARQUE_CHINA_CONFIG.SUITES.forEach(function(s){uso[s]=(ocupacao[s]||[]).length;});
    var candidatas=leitura.linhas.filter(function(item){var r=item.reserva;return pcStatusPodeReceberSuite_(r.status)&&!String(r.suiteDefinida||"").trim()&&pcDataDia_(r.dataSaida)>hoje&&pcPeriodosConflitam_(pcDataDia_(r.dataEntrada),pcDataDia_(r.dataSaida),periodo.inicio,periodo.fim);});
    candidatas.sort(function(a,b){return pcDataDia_(a.reserva.dataEntrada)-pcDataDia_(b.reserva.dataEntrada)||pcDataDia_(a.reserva.dataSolicitacao)-pcDataDia_(b.reserva.dataSolicitacao)||String(a.reserva.idReserva).localeCompare(String(b.reserva.idReserva));});
    var sugestoes=[],semDisponibilidade=[];
    candidatas.forEach(function(item){
      var r=item.reserva,entrada=pcDataDia_(r.dataEntrada),saida=pcDataDia_(r.dataSaida),preferida=String(r.suiteSolicitada||"");
      var livres=PARQUE_CHINA_CONFIG.SUITES.filter(function(s){return pcSuiteLivreNaOcupacao_(s,entrada,saida,ocupacao,null);});
      livres.sort(function(a,b){if(a===preferida)return -1;if(b===preferida)return 1;return uso[a]-uso[b]||Number(a)-Number(b);});
      if(!livres.length){semDisponibilidade.push({idReserva:r.idReserva,nomeSolicitante:r.nomeSolicitante,dataEntrada:r.dataEntrada,dataSaida:r.dataSaida,motivo:"Nenhuma suíte livre no período."});return;}
      var suite=livres[0];
      sugestoes.push({idReserva:r.idReserva,nomeSolicitante:r.nomeSolicitante,dataEntrada:r.dataEntrada,dataSaida:r.dataSaida,quantidadePessoas:r.quantidadePessoas,suiteSugerida:suite,alternativas:livres.slice(1),justificativa:suite===preferida?"Preferência do solicitante disponível.":"Suíte livre com menor carga operacional."});
      ocupacao[suite].push({idReserva:String(r.idReserva),entrada:entrada,saida:saida});uso[suite]++;
    });
    return {ok:true,mes:mes,ano:ano,totalCandidatas:candidatas.length,sugestoes:sugestoes,semDisponibilidade:semDisponibilidade,geradoEm:Utilities.formatDate(new Date(),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss")};
  }catch(erro){Logger.log("sugerirDistribuicaoAutomaticaParqueChina: "+erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function confirmarDistribuicaoAutomaticaParqueChina(sugestoes, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try{
    var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email;sugestoes=Array.isArray(sugestoes)?sugestoes:[];
    if(!sugestoes.length)return {ok:false,mensagem:"Nenhuma sugestão foi enviada para confirmação."};
    return pcComLock_(function(){
      var leitura=pcLerLinhasReservas_(),porId={},ocupacao=pcMontarOcupacao_(leitura.linhas);leitura.linhas.forEach(function(item){porId[String(item.reserva.idReserva)]=item;});
      var aplicadas=[],falhas=[];
      sugestoes.forEach(function(s){
        var id=String(s.idReserva||""),suite=String(s.suiteSugerida||""),item=porId[id];
        if(!item){falhas.push({idReserva:id,motivo:"Reserva não encontrada."});return;}
        if(PARQUE_CHINA_CONFIG.SUITES.indexOf(suite)===-1){falhas.push({idReserva:id,motivo:"Suíte inválida."});return;}
        if(!pcStatusPodeReceberSuite_(item.reserva.status)){falhas.push({idReserva:id,motivo:"Status não permite distribuição."});return;}
        if(String(item.reserva.suiteDefinida||"").trim()){falhas.push({idReserva:id,motivo:"A reserva já possui suíte definida."});return;}
        var entrada=pcDataDia_(item.reserva.dataEntrada),saida=pcDataDia_(item.reserva.dataSaida);
        if(!pcSuiteLivreNaOcupacao_(suite,entrada,saida,ocupacao,id)){falhas.push({idReserva:id,motivo:"A suíte ficou indisponível antes da confirmação."});return;}
        leitura.aba.getRange(item.linha,PC_COL.SUITE_DEFINIDA).setValue(suite);leitura.aba.getRange(item.linha,PC_COL.ATUALIZADO_EM).setValue(new Date());leitura.aba.getRange(item.linha,PC_COL.ATUALIZADO_POR).setValue(responsavel);
        pcAuditar_(id,"SUITE_DISTRIBUIDA_AUTOMATICAMENTE","SEM_SUITE",suite,responsavel,"Distribuição confirmada pelo administrador",{suite:suite,entrada:item.reserva.dataEntrada,saida:item.reserva.dataSaida});
        ocupacao[suite].push({idReserva:id,entrada:entrada,saida:saida});aplicadas.push({idReserva:id,suite:suite});
      });
      pcInvalidarCache_();
      return {ok:true,totalAplicadas:aplicadas.length,totalFalhas:falhas.length,aplicadas:aplicadas,falhas:falhas};
    });
  }catch(erro){Logger.log("confirmarDistribuicaoAutomaticaParqueChina: "+erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function diagnosticarModuloParqueChina(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try{
    pcExigirAdmin_(tokenSessao);var leitura=pcLerLinhasReservas_(),problemas=[];
    leitura.linhas.forEach(function(item){var r=item.reserva,total=pcNumero_(r.valorTotal),recebido=pcNumero_(r.valorRecebido),ativa=pcStatusBloqueiaSuite_(r.status);
      if(pcStatusPodeReceberSuite_(r.status)&&!String(r.suiteDefinida||"").trim())problemas.push({tipo:"SEM_SUITE",idReserva:r.idReserva,linha:item.linha});
      if(recebido>total+0.009)problemas.push({tipo:"RECEBIDO_MAIOR_QUE_TOTAL",idReserva:r.idReserva,linha:item.linha});
      if(r.statusPagamento===PC_STATUS_PAGAMENTO.PAGO&&recebido+0.009<total)problemas.push({tipo:"STATUS_PAGO_DIVERGENTE",idReserva:r.idReserva,linha:item.linha});
      if(r.statusPagamento===PC_STATUS_PAGAMENTO.PENDENTE&&total>0&&recebido>=total)problemas.push({tipo:"STATUS_PENDENTE_DIVERGENTE",idReserva:r.idReserva,linha:item.linha});
      if(r.gratuitoPago==="GRATUITO"&&r.statusPagamento!==PC_STATUS_PAGAMENTO.ISENTO)problemas.push({tipo:"GRATUIDADE_DIVERGENTE",idReserva:r.idReserva,linha:item.linha});
    });
    var resumo={};problemas.forEach(function(p){resumo[p.tipo]=(resumo[p.tipo]||0)+1;});return {ok:true,totalRegistros:leitura.linhas.length,totalProblemas:problemas.length,resumo:resumo,problemas:problemas};
  }catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

// ----------------------------------------------------------------------------
// NOTIFICAÇÕES POR E-MAIL
// ----------------------------------------------------------------------------

function notificarAdminNovaSolicitacaoParqueChina_(dados, idReserva, valorTotal) {
  var destinatarios = String(obterConfigParqueChina_().EMAILS_ADMIN || "").trim();
  if (!destinatarios) return;

  var assunto = "Nova solicitação de reserva - Parque do China (" + idReserva + ")";
  var corpo = "Nova solicitação de reserva recebida.\n\n" +
    "ID: " + idReserva + "\n" +
    "Solicitante: " + dados.nomeSolicitante + "\n" +
    "Telefone: " + dados.telefone + "\n" +
    "Escola/Vínculo: " + (dados.escola || "-") + "\n" +
    "Suíte pedida: " + (dados.chaleSolicitado || dados.suiteSolicitada || "Qualquer disponível") + "\n" +
    "Período: " + dados.dataEntrada + " a " + dados.dataSaida + "\n" +
    "Tipo: " + dados.tipoReserva + "\n" +
    "Valor estimado: R$ " + valorTotal + "\n\n" +
    "Analise a solicitação no painel administrativo do SISGEP.";

  MailApp.sendEmail(destinatarios, assunto, corpo);
}

function enviarEmailConfirmacaoSolicitacaoParqueChina_(dados, idReserva, valorTotal) {
  var assunto = "Solicitação recebida - Parque do China (" + idReserva + ")";
  var corpo = "Olá, " + dados.nomeSolicitante + "!\n\n" +
    "Sua solicitação de reserva foi recebida e aguarda análise administrativa.\n\n" +
    "Protocolo: " + idReserva + "\n" +
    "Período: " + dados.dataEntrada + " a " + dados.dataSaida + "\n" +
    "Valor estimado: R$ " + valorTotal + "\n\n" +
    "Você receberá um novo e-mail assim que a solicitação for analisada.\n\n" +
    "SindEducação-ES";

  MailApp.sendEmail(dados.email, assunto, corpo);
}

function enviarEmailAprovacaoParqueChina_(reserva) {
  var assunto = "Reserva aprovada - Parque do China (" + reserva.idReserva + ")";
  var corpo = "Olá, " + reserva.nomeSolicitante + "!\n\n" +
    "Sua reserva foi APROVADA.\n\n" +
    "Suíte: " + reserva.suiteDefinida + "\n" +
    "Período: " + reserva.dataEntrada + " a " + reserva.dataSaida + "\n" +
    "Valor: R$ " + reserva.valorTotal + "\n" +
    "Forma de pagamento: " + (reserva.formaPagamento || "a combinar") + "\n\n" +
    "SindEducação-ES";

  MailApp.sendEmail(reserva.email, assunto, corpo);
}

function enviarEmailRecusaParqueChina_(reserva, motivo) {
  var assunto = "Resultado da sua solicitação - Parque do China (" + reserva.idReserva + ")";
  var corpo = "Olá, " + reserva.nomeSolicitante + "!\n\n" +
    "Sua solicitação não pôde ser aprovada.\n\n" +
    "Motivo: " + (motivo || "não informado") + "\n\n" +
    "Você pode realizar uma nova solicitação para outra data disponível.\n\n" +
    "SindEducação-ES";

  MailApp.sendEmail(reserva.email, assunto, corpo);
}
/**
 * Valida que PC_COL e PC_CABECALHO estão sincronizados — mesma quantidade
 * de colunas e nenhuma chave de PC_COL apontando para índice fora do range.
 * Rode manualmente após qualquer alteração de colunas, ou deixe habilitado
 * em homologação para pegar esse tipo de erro antes de virar exceção em produção.
 */
function pcValidarMapaColunas_() {
  var chaves = Object.keys(PC_COL);
  var erros = [];

  if (chaves.length !== PC_CABECALHO.length) {
    erros.push("PC_COL tem " + chaves.length + " chaves, mas PC_CABECALHO tem " + PC_CABECALHO.length + " colunas.");
  }

  chaves.forEach(function (chave) {
    var indice = PC_COL[chave];
    if (typeof indice !== "number" || indice < 1 || indice > PC_CABECALHO.length) {
      erros.push("PC_COL." + chave + " = " + indice + " está fora do range válido (1-" + PC_CABECALHO.length + ").");
    }
  });

  // Garante que não há dois nomes de coluna apontando para o mesmo índice
  var indicesUsados = {};
  chaves.forEach(function (chave) {
    var indice = PC_COL[chave];
    if (indicesUsados[indice]) {
      erros.push("Colisão: PC_COL." + chave + " e PC_COL." + indicesUsados[indice] + " apontam para a mesma coluna (" + indice + ").");
    }
    indicesUsados[indice] = chave;
  });

  if (erros.length) {
    Logger.log("❌ pcValidarMapaColunas_ encontrou " + erros.length + " problema(s):\n" + erros.join("\n"));
    throw new Error("Mapa de colunas do Parque do China inconsistente:\n" + erros.join("\n"));
  }

  Logger.log("✅ pcValidarMapaColunas_: PC_COL e PC_CABECALHO estão sincronizados (" + chaves.length + " colunas).");
  return { ok: true, totalColunas: chaves.length };
}
/**
 * Versão pública (sem exigir sessão/admin) do cálculo de prévia, usada pelo
 * formulário de solicitação do associado. Não expõe config sensível
 * (PERFIS_ADMIN, EMAILS_ADMIN) — devolve só o necessário pro resumo de valores.
 */
function calcularPreviaPublicaParqueChina(dados) {
  try {
    dados = dados || {};
    if (!dados.dataEntrada || !dados.dataSaida) {
      return { ok: true, valores: { quantidadeDiarias: 0, valorDiaria: 0, valorColchao: 0, valorBruto: 0, valorTotal: 0 } };
    }
    var entrada = new Date(dados.dataEntrada + "T00:00:00");
    var saida = new Date(dados.dataSaida + "T00:00:00");
    if (isNaN(entrada.getTime()) || isNaN(saida.getTime()) || saida <= entrada) {
      return { ok: true, valores: { quantidadeDiarias: 0, valorDiaria: 0, valorColchao: 0, valorBruto: 0, valorTotal: 0 } };
    }
    var valores = calcularPeriodoParqueChina_(dados.dataEntrada, dados.dataSaida, dados.quantidadePessoas, dados.solicitouColchaoExtra, 0, 0);
    return { ok: true, valores: valores };
  } catch (erro) {
    Logger.log(erro);
    return { ok: false, mensagem: "Não foi possível calcular a prévia.", valores: { quantidadeDiarias: 0, valorDiaria: 0, valorColchao: 0, valorBruto: 0, valorTotal: 0 } };
  }
}

/**
 * Central administrativa de Benefícios. Uma leitura do China Park, leitura
 * mínima da fila cadastral e cache curto para abertura imediata do painel.
 */
function getCentralBeneficiosAdmin(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    pcExigirAdmin_(tokenSessao);
    var agora=new Date(),mes=agora.getMonth()+1,ano=agora.getFullYear();
    var cache=CacheService.getScriptCache(),chave="CENTRAL_BENEFICIOS_ADMIN_"+ano+"_"+mes;
    var armazenado=cache.get(chave);
    if(armazenado){
      var respostaCache=JSON.parse(armazenado);
      respostaCache.cache=true;
      return respostaCache;
    }

    var reservas=listarReservasParqueChina({mes:mes,ano:ano},tokenSessao)||[];
    var statusAtivos=["APROVADA","AGUARDANDO_PAGAMENTO","BLOQUEIO_ADMINISTRATIVO","FINALIZADA"];
    var statusAnalise=["PENDENTE","INSCRITO_SORTEIO"];
    var pagamentosPendentes=[],divergencias=[],semSuite=[],proximas=[];
    var confirmadas=0,aguardandoAnalise=0,totalDiarias=0,valorRecebido=0,valorPrevisto=0;
    var inicioHoje=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()).getTime();
    var limiteProximas=inicioHoje+(7*86400000);

    reservas.forEach(function(r){
      var status=String(r.status||""),ativa=statusAtivos.indexOf(status)!==-1;
      if(statusAnalise.indexOf(status)!==-1)aguardandoAnalise++;
      var total=Number(r.valorTotal)||0,recebido=Number(r.valorRecebido)||0;
      var pagamento=String(r.statusPagamento||(r.gratuitoPago==="GRATUITO"?"ISENTO":"PENDENTE"));
      if(ativa){
        confirmadas++;
        var diarias=Number(r.quantidadeDiarias)||Math.max(1,Math.round((new Date(r.dataSaida)-new Date(r.dataEntrada))/86400000));
        totalDiarias+=isNaN(diarias)?0:diarias;
        if(r.gratuitoPago!=="GRATUITO"){valorPrevisto+=total;valorRecebido+=recebido;}
      }
      if(ativa&&r.gratuitoPago!=="GRATUITO"&&total>recebido+0.009)pagamentosPendentes.push(r);
      if((recebido>total+0.009)||(pagamento==="PAGO"&&recebido+0.009<total)||(pagamento==="PENDENTE"&&total>0&&recebido>=total))divergencias.push(r);
      if(pcStatusPodeReceberSuite_(status)&&!String(r.suiteDefinida||"").trim()&&pcDataDia_(r.dataSaida)>pcDataDia_(agora))semSuite.push(r);
      var entrada=new Date(r.dataEntrada).getTime();
      if(ativa&&!isNaN(entrada)&&entrada>=inicioHoje&&entrada<=limiteProximas)proximas.push(r);
    });

    var cadastrosPendentes=0;
    try{
      var ss=SpreadsheetApp.openById(PLANILHA_ID),abaCadastros=ss.getSheetByName("Solicitacoes_Atualizacao");
      if(abaCadastros&&abaCadastros.getLastRow()>1){
        abaCadastros.getRange(2,15,abaCadastros.getLastRow()-1,1).getDisplayValues().forEach(function(l){
          if(["PENDENTE","EM_ANALISE","CORRECAO_SOLICITADA"].indexOf(String(l[0]||"").trim())!==-1)cadastrosPendentes++;
        });
      }
    }catch(e){Logger.log("Central Benefícios - cadastros: "+e);}

    var atencao=[];
    function incluir(prioridade,titulo,descricao,sub,filtro){atencao.push({prioridade:prioridade,titulo:titulo,descricao:descricao,sub:sub,filtro:filtro||""});}
    if(divergencias.length)incluir("CRITICA",divergencias.length+" divergência(s) financeira(s)","Valor recebido e situação do pagamento não correspondem.","parqueChina","DIVERGENCIAS");
    if(semSuite.length)incluir("ALTA",semSuite.length+" reserva(s) sem suíte","Defina a acomodação para evitar conflito na agenda.","parqueChina","SEM_SUITE");
    if(pagamentosPendentes.length)incluir("ALTA",pagamentosPendentes.length+" pagamento(s) pendente(s)","Existem reservas confirmadas com saldo em aberto.","parqueChina","PAGAMENTOS");
    if(cadastrosPendentes)incluir("MEDIA",cadastrosPendentes+" atualização(ões) cadastral(is)","Solicitações do portal aguardam análise administrativa.","aprovacoesPortal","");
    if(proximas.length)incluir("INFO",proximas.length+" hospedagem(ns) nos próximos 7 dias","Confira suíte, pagamento e orientações antes do check-in.","parqueChina","PROXIMAS");

    var diasMes=new Date(ano,mes,0).getDate();
    var resposta={
      ok:true,cache:false,atualizadoEm:Utilities.formatDate(agora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss"),
      indicadores:{aguardandoAnalise:aguardandoAnalise,pagamentosPendentes:pagamentosPendentes.length,problemas:divergencias.length+semSuite.length,proximasHospedagens:proximas.length,cadastrosPendentes:cadastrosPendentes},
      chinaPark:{reservasConfirmadas:confirmadas,aguardandoAnalise:aguardandoAnalise,pagamentosPendentes:pagamentosPendentes.length,ocupacao:diasMes?totalDiarias/(PARQUE_CHINA_CONFIG.SUITES.length*diasMes)*100:0,recebido:valorRecebido,pendente:Math.max(0,valorPrevisto-valorRecebido)},
      carteirinhas:{aguardandoAnalise:cadastrosPendentes},atencao:atencao,
      busca:reservas.map(function(r){return {protocolo:String(r.idReserva||""),nome:String(r.nomeSolicitante||""),cpf:String(r.cpf||""),status:String(r.status||""),pagamento:String(r.statusPagamento||""),sub:"parqueChina"};})
    };
    cache.put(chave,JSON.stringify(resposta),180);
    Logger.log("[CENTRAL BENEFICIOS] "+JSON.stringify({mes:mes,ano:ano,reservas:reservas.length,atencao:atencao.length}));
    return resposta;
  }catch(erro){Logger.log("getCentralBeneficiosAdmin: "+erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

// ----------------------------------------------------------------------------
// DISPONIBILIDADE POR PERÍODO LIVRE (aba "Disponibilidade" do painel)
// ----------------------------------------------------------------------------

function obterDisponibilidadeParqueChina_(dataInicio, dataFim) {
  // Usa exatamente as mesmas primitivas de verificarDisponibilidadeSuiteParqueChina_
  // (pcDataDia_ + pcPeriodosConflitam_ + pcStatusBloqueiaSuite_) para que a
  // resposta da consulta por período NÃO possa divergir da checagem feita sob
  // lock na aprovação/agendamento/edição. Antes esta função reimplementava o
  // teste de sobreposição inline; qualquer ajuste futuro na regra teria que ser
  // lembrado nos dois lugares. Agora a regra é uma só.
  var entrada = pcDataDia_(dataInicio);
  var saida = pcDataDia_(dataFim);
  if (isNaN(entrada.getTime()) || isNaN(saida.getTime()) || saida <= entrada) {
    return { ok: false, mensagem: "Informe um período válido." };
  }

  var aba = obterAbaReservaParqueChina_();
  var last = aba.getLastRow();
  var dados = last >= 2 ? aba.getRange(2, 1, last - 1, PC_CABECALHO.length).getValues() : [];
  var ocupacaoPorSuite = {};
  PARQUE_CHINA_CONFIG.SUITES.forEach(function (s) { ocupacaoPorSuite[s] = null; });

  for (var i = 0; i < dados.length; i++) {
    var l = dados[i];
    var status = String(l[PC_COL.STATUS - 1]);
    if (!pcStatusBloqueiaSuite_(status)) continue;

    var suite = String(l[PC_COL.SUITE_DEFINIDA - 1] || "");
    if (!suite || PARQUE_CHINA_CONFIG.SUITES.indexOf(suite) === -1) continue;
    if (ocupacaoPorSuite[suite]) continue; // um ocupante representativo por suíte já basta para "ocupada/livre"

    var e = pcDataDia_(l[PC_COL.DATA_ENTRADA - 1]);
    var s = pcDataDia_(l[PC_COL.DATA_SAIDA - 1]);
    if (pcPeriodosConflitam_(entrada, saida, e, s)) {
      ocupacaoPorSuite[suite] = mapearLinhaParaObjetoParqueChina_(l);
    }
  }

  var ocupadas = [], disponiveis = [];
  PARQUE_CHINA_CONFIG.SUITES.forEach(function (s) {
    var r = ocupacaoPorSuite[s];
    if (r) {
      ocupadas.push({
        suite: s,
        nome: r.status === PC_STATUS.BLOQUEIO_ADMINISTRATIVO ? (r.observacaoAdmin || "Bloqueio administrativo") : r.nomeSolicitante,
        status: r.status,
        statusPagamento: r.statusPagamento,
        dataEntrada: r.dataEntrada,
        dataSaida: r.dataSaida,
        idReserva: r.idReserva,
        bloqueioAdministrativo: r.status === PC_STATUS.BLOQUEIO_ADMINISTRATIVO
      });
    } else {
      disponiveis.push(s);
    }
  });

  return {
    ok: true,
    dataInicio: dataInicio,
    dataFim: dataFim,
    totalSuites: PARQUE_CHINA_CONFIG.SUITES.length,
    totalOcupadas: ocupadas.length,
    totalDisponiveis: disponiveis.length,
    ocupadas: ocupadas,
    disponiveis: disponiveis
  };
}
/**
 * Wrapper público exigido pelo painel administrativo — obterDisponibilidadeParqueChina_
 * é privada (sufixo _). Segue o mesmo padrão de autenticação das demais
 * funções administrativas do módulo.
 */
function consultarDisponibilidadeParqueChina(dataInicio, dataFim, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    pcExigirAdmin_(tokenSessao);
    return obterDisponibilidadeParqueChina_(dataInicio, dataFim);
  } catch (erro) {
    Logger.log("consultarDisponibilidadeParqueChina: " + erro);
    return { ok: false, mensagem: pcMensagemErro_(erro) };
  }
}
// ----------------------------------------------------------------------------
// AUTORIZAÇÕES DE ENTRADA — OFÍCIO SEMANAL OU SOB DEMANDA
// Integra com o numerador e a fila oficiais do módulo de Ofícios.
// ----------------------------------------------------------------------------

var PC_AUT_CABECALHO = [
  "ID Autorização","Data Criação","Número Ofício","Tipo Emissão","Período Inicial",
  "Período Final","Reservas JSON","Status","E-mail Parque","PDF ID","PDF URL",
  "Responsável","Data Envio Parque","Ofício Original","Motivo Retificação","Atualizado Em"
];

var PC_COM_CABECALHO = [
  "Data","ID Reserva","Número Ofício","Canal","Destinatário","Status",
  "Responsável","Detalhes"
];

var PC_DEST_CABECALHO = [
  "Número Ofício","Para","CC","CCO","Status","Responsável",
  "Criado Em","Atualizado Em","Observação"
];

function pcNormalizarDestinatariosOficio_(dados,config) {
  dados=dados||{};config=config||obterConfigParqueChina_();var usados={};
  function grupo(valor){return pcEmailsValidos_(valor).filter(function(email){if(usados[email])return false;usados[email]=true;return true;});}
  var para=grupo(dados.emailParque||dados.para||config.EMAIL_CHINA_PARK||"");
  var cc=grupo(dados.emailCc||dados.cc||config.EMAIL_CC_CHINA_PARK||"");
  var cco=grupo(dados.emailCco||dados.cco||config.EMAIL_CCO_CHINA_PARK||"");
  return {para:para,cc:cc,cco:cco,todos:para.concat(cc,cco)};
}

function pcObterAbaDestinatariosAutorizacao_() {
  var ss=SpreadsheetApp.openById(PLANILHA_ID),sh=ss.getSheetByName("DestinatariosAutorizacoesParqueChina");
  if(!sh)sh=ss.insertSheet("DestinatariosAutorizacoesParqueChina");
  if(sh.getMaxColumns()<PC_DEST_CABECALHO.length)sh.insertColumnsAfter(sh.getMaxColumns(),PC_DEST_CABECALHO.length-sh.getMaxColumns());
  sh.getRange(1,1,1,PC_DEST_CABECALHO.length).setValues([PC_DEST_CABECALHO]).setFontWeight("bold").setBackground("#0b3b75").setFontColor("#ffffff");sh.setFrozenRows(1);return sh;
}

function pcSalvarDestinatariosAutorizacao_(numero,destinos,responsavel,status,observacao) {
  pcObterAbaDestinatariosAutorizacao_().appendRow([String(numero||""),(destinos.para||[]).join(","),(destinos.cc||[]).join(","),(destinos.cco||[]).join(","),status||"PENDENTE",responsavel||"SISGEP",new Date(),new Date(),observacao||""]);
}

function pcBuscarDestinatariosAutorizacao_(numero) {
  var sh=pcObterAbaDestinatariosAutorizacao_(),last=sh.getLastRow();if(last<2)return null;
  var dados=sh.getRange(2,1,last-1,PC_DEST_CABECALHO.length).getValues();
  for(var i=dados.length-1;i>=0;i--)if(String(dados[i][0]||"").trim()===String(numero||"").trim())return {linha:i+2,para:pcEmailsValidos_(dados[i][1]),cc:pcEmailsValidos_(dados[i][2]),cco:pcEmailsValidos_(dados[i][3]),status:String(dados[i][4]||""),responsavel:String(dados[i][5]||"")};
  return null;
}

function pcAtualizarDestinatariosAutorizacao_(numero,status,observacao) {
  var x=pcBuscarDestinatariosAutorizacao_(numero);if(!x)return;var sh=pcObterAbaDestinatariosAutorizacao_();sh.getRange(x.linha,5).setValue(status||"");sh.getRange(x.linha,8).setValue(new Date());if(observacao)sh.getRange(x.linha,9).setValue(observacao);
}

function pcEscHtmlEmail_(valor) {
  return String(valor == null ? "" : valor).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;");
}

function pcFormatarDataBr_(valor) {
  if (!valor) return "—";
  var d = pcDataDia_(valor);
  return Utilities.formatDate(d, PARQUE_CHINA_CONFIG.TIMEZONE, "dd/MM/yyyy");
}

function pcEmailsValidos_(valor) {
  var vistos = {};
  return String(valor || "").split(/[;,\s]+/).map(function(e){return e.trim().toLowerCase();})
    .filter(function(e){
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || vistos[e]) return false;
      vistos[e] = true; return true;
    });
}

function pcObterAbaAutorizacoes_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("AutorizacoesParqueChina");
  if (!sh) sh = ss.insertSheet("AutorizacoesParqueChina");
  if (sh.getMaxColumns() < PC_AUT_CABECALHO.length) sh.insertColumnsAfter(sh.getMaxColumns(), PC_AUT_CABECALHO.length - sh.getMaxColumns());
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,PC_AUT_CABECALHO.length).setValues([PC_AUT_CABECALHO]);
  sh.getRange(1,1,1,PC_AUT_CABECALHO.length).setValues([PC_AUT_CABECALHO]).setFontWeight("bold").setBackground("#0b3b75").setFontColor("#ffffff");
  sh.setFrozenRows(1);
  return sh;
}

function pcObterAbaComunicacoes_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("ComunicacoesParqueChina");
  if (!sh) sh = ss.insertSheet("ComunicacoesParqueChina");
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,PC_COM_CABECALHO.length).setValues([PC_COM_CABECALHO]);
  sh.getRange(1,1,1,PC_COM_CABECALHO.length).setValues([PC_COM_CABECALHO]).setFontWeight("bold").setBackground("#0b3b75").setFontColor("#ffffff");
  sh.setFrozenRows(1);
  return sh;
}

function pcRegistrarComunicacao_(idReserva, numero, canal, destinatario, status, responsavel, detalhes) {
  pcObterAbaComunicacoes_().appendRow([new Date(),idReserva||"",numero||"",canal||"",destinatario||"",status||"",responsavel||"Sistema",detalhes||""]);
}

function pcMapaAutorizacoesAtivas_() {
  var sh = pcObterAbaAutorizacoes_(), mapa = {};
  if (sh.getLastRow() < 2) return mapa;
  sh.getRange(2,1,sh.getLastRow()-1,PC_AUT_CABECALHO.length).getValues().forEach(function(l){
    var status=String(l[7]||"").toUpperCase();
    if (["PROCESSANDO","PENDENTE","ENVIADO"].indexOf(status)===-1) return;
    var ids=[];try{ids=JSON.parse(String(l[6]||"[]"));}catch(e){}
    (ids||[]).forEach(function(id){mapa[String(id)]={numeroOficio:String(l[2]||""),status:status,idAutorizacao:String(l[0]||"")};});
  });
  return mapa;
}

function pcEhBloqueioInstitucional_(r) {
  return String(r.status||"")===PC_STATUS.BLOQUEIO_ADMINISTRATIVO || /bloqueio\s*(institucional|administrativo)?/i.test(String(r.nomeSolicitante||""));
}

function pcReservaAutorizavel_(r) {
  return !!r && [PC_STATUS.APROVADA,PC_STATUS.AGUARDANDO_PAGAMENTO].indexOf(String(r.status||""))!==-1 &&
    !!String(r.suiteDefinida||"").trim() && !pcEhBloqueioInstitucional_(r);
}

function pcChaveNomeHospede_(nome) {
  return String(nome||"").trim().replace(/\s+/g," ").toUpperCase();
}

function pcDependentesReserva_(r) {
  var vistos={};
  vistos[pcChaveNomeHospede_(r.nomeSolicitante)]=true;
  return [r.dependente1,r.dependente2,r.dependente3,r.dependente4]
    .map(function(n){return String(n||"").trim().replace(/\s+/g," ");})
    .filter(function(n){
      var chave=pcChaveNomeHospede_(n);
      if(!chave||vistos[chave])return false;
      vistos[chave]=true;
      return true;
    });
}

function pcHospedesReserva_(r) {
  var titular=String(r.nomeSolicitante||"").trim().replace(/\s+/g," ");
  return (titular?[titular]:[]).concat(pcDependentesReserva_(r));
}

function listarReservasParaAutorizacaoParqueChina(parametros, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    pcExigirAdmin_(tokenSessao); parametros=parametros||{};
    var inicio=pcDataDia_(parametros.dataInicio||new Date()), fim=pcDataDia_(parametros.dataFim||new Date(Date.now()+7*86400000));
    fim=new Date(fim.getFullYear(),fim.getMonth(),fim.getDate()+1);
    var selecionada=String(parametros.idReserva||""), mapa=pcMapaAutorizacoesAtivas_();
    var lista=pcLerLinhasReservas_().linhas.map(function(x){return x.reserva;}).filter(function(r){
      if (!pcReservaAutorizavel_(r)) return false;
      if (selecionada && String(r.idReserva)===selecionada) return true;
      var entrada=pcDataDia_(r.dataEntrada); return entrada>=inicio && entrada<fim;
    }).map(function(r){
      var aut=mapa[String(r.idReserva)]||null;
      return {idReserva:r.idReserva,nomeSolicitante:r.nomeSolicitante,email:r.email||"",telefone:r.telefone||"",dataEntrada:r.dataEntrada,dataSaida:r.dataSaida,suiteDefinida:r.suiteDefinida,hospedes:pcHospedesReserva_(r),quantidadePessoas:r.quantidadePessoas,jaAutorizada:!!aut,numeroOficio:aut?aut.numeroOficio:"",statusAutorizacao:aut?aut.status:""};
    });
    lista.sort(function(a,b){return pcDataDia_(a.dataEntrada)-pcDataDia_(b.dataEntrada)||String(a.nomeSolicitante).localeCompare(String(b.nomeSolicitante));});
    var config=obterConfigParqueChina_();
    return {ok:true,reservas:lista,emailParque:String(config.EMAIL_CHINA_PARK||""),emailsDisponiveis:pcEmailsValidos_(config.EMAILS_DESTINATARIOS_CHINA_PARK||"secretaria@sindeducacao.com;financeiro@sindeducacao.com;contato@chinapark.com.br"),emailCc:String(config.EMAIL_CC_CHINA_PARK||""),emailCco:String(config.EMAIL_CCO_CHINA_PARK||""),comunicacao:{horarioCheckin:String(config.HORARIO_CHECKIN||"14:00"),horarioCheckout:String(config.HORARIO_CHECKOUT||"12:00"),endereco:String(config.ENDERECO_CHINA_PARK||""),linkMapa:String(config.LINK_MAPA_CHINA_PARK||""),emailResposta:String(config.EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")},dataInicio:Utilities.formatDate(inicio,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd"),dataFim:Utilities.formatDate(new Date(fim.getTime()-86400000),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd"),proximoNumero:typeof preverProximoNumeroOficio_==="function"?preverProximoNumeroOficio_():""};
  } catch(erro){Logger.log(erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function pcSelecionarReservasAutorizacao_(ids, permitirJaAutorizadas) {
  ids=(ids||[]).map(String);var mapaAut=pcMapaAutorizacoesAtivas_(),porId={};
  pcLerLinhasReservas_().linhas.forEach(function(x){porId[String(x.reserva.idReserva)]=x.reserva;});
  var lista=[];
  ids.forEach(function(id){
    var r=porId[id];
    if(!r)throw new Error("Reserva não encontrada: "+id);
    if(!pcReservaAutorizavel_(r))throw new Error("A reserva "+id+" não está apta para autorização.");
    if(mapaAut[id]&&!permitirJaAutorizadas)throw new Error("A reserva "+id+" já está vinculada ao Ofício "+mapaAut[id].numeroOficio+".");
    lista.push(r);
  });
  return lista;
}

function pcMontarTextoOficioAutorizacao_(reservas, dados, numero) {
  var tipo=String(dados.tipoEmissao||"SEMANAL").toUpperCase();
  var abertura=tipo==="RETIFICACAO"
    ? "Em retificação ao Ofício nº "+String(dados.oficioOriginal||"")+", encaminhamos a relação atualizada de hóspedes autorizados para ingresso e hospedagem no China Park Eco Resort."
    : "Encaminhamos, para fins de autorização de entrada e hospedagem, a relação de associados e acompanhantes abaixo identificados.";
  var blocos=reservas.map(function(r,i){return "[[PC_RESERVA_"+i+"]]";});
  return abertura+"\n\n"+blocos.join("\n\n")+"\n\nSolicitamos que a recepção autorize o ingresso exclusivamente das pessoas relacionadas, mediante apresentação de documento oficial com foto. Eventuais alterações serão comunicadas formalmente pelo SindEducação-ES.\n\nAtenciosamente,";
}

function pcMontarCardReservaOficio_(r, indice) {
  var dependentes=pcDependentesReserva_(r);
  var itensDependentes=dependentes.map(function(nome,i){
    return '<tr><td style="width:28px;padding:3px 8px 3px 0;vertical-align:top;"><div style="width:20px;height:20px;border-radius:6px;background:#e8eef7;color:#001f4d;text-align:center;line-height:20px;font-size:9px;font-weight:900;">'+String.fromCharCode(65+i)+'</div></td><td style="padding:3px 0;font-size:11.5px;font-weight:600;color:#172033;line-height:1.4;">'+pcEscHtmlEmail_(nome)+'</td></tr>';
  }).join('');
  var linhaDependentes=dependentes.length
    ? '<tr><td colspan="3" style="padding:9px 12px;border-top:1px solid #e2e8f0;background:#fff;"><div style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px;">Dependentes / acompanhantes vinculados ao hóspede</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">'+itensDependentes+'</table></td></tr>'
    : '';
  return '<div style="margin:0 0 14px;border:1px solid #d8e0ec;border-left:4px solid #001f4d;border-radius:11px;overflow:hidden;page-break-inside:avoid;background:#fff;">'+
    '<div style="display:flex;align-items:center;gap:11px;padding:10px 13px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">'+
      '<div style="width:27px;height:27px;border-radius:8px;background:linear-gradient(135deg,#001f4d,#1565C0);color:#C9A84C;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0;">'+(indice+1)+'</div>'+
      '<div><div style="font-size:8.5px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;">Hóspede responsável</div><div style="font-size:13px;font-weight:900;color:#001f4d;line-height:1.25;">'+pcEscHtmlEmail_(String(r.nomeSolicitante||"").toUpperCase())+'</div></div>'+
    '</div>'+
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;">'+
      '<tr>'+
        '<td style="width:34%;padding:9px 12px;border-right:1px solid #e2e8f0;vertical-align:top;"><div style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Protocolo</div><div style="font-size:11.5px;font-weight:700;color:#172033;word-break:break-word;">'+pcEscHtmlEmail_(r.idReserva)+'</div></td>'+
        '<td style="width:14%;padding:9px 12px;border-right:1px solid #e2e8f0;vertical-align:top;"><div style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Suíte</div><div style="font-size:11.5px;font-weight:800;color:#172033;">'+pcEscHtmlEmail_(r.suiteDefinida)+'</div></td>'+
        '<td style="width:52%;padding:9px 12px;vertical-align:top;"><div style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Período</div><div style="font-size:11.5px;font-weight:700;color:#172033;">'+pcFormatarDataBr_(r.dataEntrada)+' a '+pcFormatarDataBr_(r.dataSaida)+'</div></td>'+
      '</tr>'+
      linhaDependentes+
    '</table></div>';
}

function pcAplicarCardsReservasNoOficio_(html, reservas) {
  (reservas||[]).forEach(function(r,i){
    var marcador="\\[\\[PC_RESERVA_"+i+"\\]\\]";
    var re=new RegExp('<p style="[^"]*">'+marcador+'<\\/p>');
    html=html.replace(re,pcMontarCardReservaOficio_(r,i));
  });
  return html;
}

function pcMontarHtmlOficioAutorizacao_(reservas,dados,numero,isPreview) {
  if(typeof gerarHtmlOficioCompleto_!=="function")throw new Error("O núcleo visual de Ofícios não está disponível.");
  var imgs={assBase64:"",assMime:"image/png"};
  if(typeof carregarImagensOficio_==="function")try{imgs=carregarImagensOficio_()||imgs;}catch(e){}
  var dataHoje=Utilities.formatDate(new Date(),PARQUE_CHINA_CONFIG.TIMEZONE,"dd/MM/yyyy");
  if(typeof dataPorExtenso==="function")try{dataHoje=dataPorExtenso();}catch(e){}
  var html=gerarHtmlOficioCompleto_({numero:numero,tipoNorm:"OFICIO_LIVRE",assuntoTipo:String(dados.tipoEmissao||"").toUpperCase()==="RETIFICACAO"?"Retificação — China Park":"Autorização — China Park",assunto:"Autorização de entrada e hospedagem",para:"China Park Eco Resort",instituicao:"China Park Eco Resort",corpoTexto:pcMontarTextoOficioAutorizacao_(reservas,dados,numero),dataHoje:dataHoje,assBase64:imgs.assBase64,assMime:imgs.assMime},!!isPreview);
  return pcAplicarCardsReservasNoOficio_(html,reservas);
}

function previewOficioAutorizacaoParqueChina(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try{pcExigirAdmin_(tokenSessao);dados=dados||{};var reservas=pcSelecionarReservasAutorizacao_(dados.idsReservas||[],String(dados.tipoEmissao||"").toUpperCase()==="RETIFICACAO");if(!reservas.length)return {ok:false,mensagem:"Selecione pelo menos uma reserva."};var numero=typeof preverProximoNumeroOficio_==="function"?preverProximoNumeroOficio_():"PRÉVIA";return {ok:true,html:pcMontarHtmlOficioAutorizacao_(reservas,dados,"PRÉVIA · "+numero,true),proximoNumero:numero};}catch(erro){return {ok:false,mensagem:String(erro.message||erro)};}
}

function pcRegistrarOficioProcessando_(numero,codigo,reservas,dados,responsavel) {
  var sheet=SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(PLANILHA_REGISTRO);
  if(!sheet)throw new Error("Aba oficial de registro de ofícios não encontrada.");
  var todos=pcEmailsValidos_([dados.emailParque||"",dados.emailCc||"",dados.emailCco||""].join(","));
  appendRowByHeader_(sheet,{"Status":"PROCESSANDO","Número do Ofício":numero,"CONFIG":codigo,"Log_Sistema":responsavel,"Sistema_Versão":typeof SISTEMA_VERSAO!=="undefined"?SISTEMA_VERSAO:"SISGEP","Data envio ofício":new Date(),"TIPO":"AUTORIZAÇÃO CHINA PARK","Escola (Razão Social)":"CHINA PARK ECO RESORT","E-mail (principal)":String(dados.emailParque||""),"E-mails (todos)":todos.join(","),"Colaborador(es)":reservas.map(function(r){return r.nomeSolicitante;}).join("; "),"Observações":String(dados.tipoEmissao||"SEMANAL")+(dados.emailCc?" · CC: "+dados.emailCc:"")+(dados.emailCco?" · CCO registrado":""),"Link PDF (Drive)":""});
}

function pcAtualizarRegistroOficioAutorizacao_(numero,status,urlPdf,observacao) {
  var sh=SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(PLANILHA_REGISTRO);if(!sh||sh.getLastRow()<2)return;
  var hm=getHeaderMap_(sh),cNum=hm["Número do Ofício"],cSt=hm["Status"],cUrl=hm["Link PDF (Drive)"],cObs=hm["Observações"];
  var nums=sh.getRange(2,cNum,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<nums.length;i++)if(String(nums[i][0]||"").trim()===String(numero).trim()){if(cSt)sh.getRange(i+2,cSt).setValue(status);if(cUrl&&urlPdf)sh.getRange(i+2,cUrl).setValue(urlPdf);if(cObs&&observacao)sh.getRange(i+2,cObs).setValue(observacao);break;}
}

function pcAtualizarAutorizacao_(idAut,status,pdfId,pdfUrl,dataEnvio) {
  var sh=pcObterAbaAutorizacoes_();if(sh.getLastRow()<2)return;
  var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for(var i=0;i<ids.length;i++)if(String(ids[i][0])===String(idAut)){sh.getRange(i+2,8).setValue(status);if(pdfId)sh.getRange(i+2,10).setValue(pdfId);if(pdfUrl)sh.getRange(i+2,11).setValue(pdfUrl);if(dataEnvio)sh.getRange(i+2,13).setValue(dataEnvio);sh.getRange(i+2,16).setValue(new Date());break;}
}

function pcNumeroOficioJaRegistrado_(numero) {
  var sh=SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(PLANILHA_REGISTRO);
  if(!sh||sh.getLastRow()<2)return false;
  var hm=getHeaderMap_(sh),col=hm["Número do Ofício"];
  if(!col)throw new Error("Coluna 'Número do Ofício' não encontrada.");
  return sh.getRange(2,col,sh.getLastRow()-1,1).getValues().some(function(l){return String(l[0]||"").trim()===String(numero||"").trim();});
}

function emitirOficioAutorizacaoParqueChina(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  var numero="",idAut="";
  try{
    var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP";dados=dados||{};
    var destinos=pcNormalizarDestinatariosOficio_(dados,obterConfigParqueChina_()),emailsParque=destinos.para;if(!emailsParque.length)return {ok:false,mensagem:"Selecione pelo menos um destinatário principal (Para)."};dados.emailParque=emailsParque.join(",");dados.emailCc=destinos.cc.join(",");dados.emailCco=destinos.cco.join(",");
    var tipo=String(dados.tipoEmissao||"SEMANAL").toUpperCase(),permitir=tipo==="RETIFICACAO";
    if(typeof gerarProximoNumeroSeguro_!=="function")throw new Error("A função oficial gerarProximoNumeroSeguro_ não foi encontrada.");
    var reservas=pcSelecionarReservasAutorizacao_(dados.idsReservas||[],permitir);if(!reservas.length)throw new Error("Selecione pelo menos uma reserva.");
    var codigo="",registroReservado=false;
    for(var tentativa=0;tentativa<3&&!registroReservado;tentativa++){
      numero=gerarProximoNumeroSeguro_();
      var lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error("CONCORRENCIA");
      try{
        if(pcNumeroOficioJaRegistrado_(numero))continue;
        reservas=pcSelecionarReservasAutorizacao_(dados.idsReservas||[],permitir);if(!reservas.length)throw new Error("Selecione pelo menos uma reserva.");
        codigo=numero.replace("/","-");if(typeof gerarCodigoVerificacao==="function")try{codigo=gerarCodigoVerificacao(numero);}catch(e){}
        idAut="PCA-"+Utilities.formatDate(new Date(),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyyMMddHHmmss")+"-"+Math.floor(Math.random()*1000);
        pcRegistrarOficioProcessando_(numero,codigo,reservas,dados,responsavel);
        registroReservado=true;
        pcObterAbaAutorizacoes_().appendRow([idAut,new Date(),numero,tipo,dados.dataInicio?pcDataDia_(dados.dataInicio):"",dados.dataFim?pcDataDia_(dados.dataFim):"",JSON.stringify(reservas.map(function(r){return String(r.idReserva);})),"PROCESSANDO",dados.emailParque,"","",responsavel,"",dados.oficioOriginal||"",dados.motivoRetificacao||"",new Date()]);
        pcSalvarDestinatariosAutorizacao_(numero,destinos,responsavel,"PROCESSANDO",tipo);
      }finally{lock.releaseLock();}
    }
    if(!registroReservado)throw new Error("Não foi possível reservar um número de ofício sem conflito. Tente novamente.");

    var html=pcMontarHtmlOficioAutorizacao_(reservas,dados,numero,false),config=obterConfigParqueChina_(),pasta;
    if(String(config.PASTA_AUTORIZACOES_ID||"").trim())pasta=DriveApp.getFolderById(String(config.PASTA_AUTORIZACOES_ID).trim());
    else if(typeof obterPastaPorTipo_==="function")pasta=obterPastaPorTipo_("OFICIO_LIVRE");
    else throw new Error("Pasta de autorizações não configurada.");
    var nome="Oficio_"+numero.replace("/","_")+"_Autorizacao_China_Park";
    var pdf=oficios_converterHtmlParaPdf_(html,nome,pasta),url="https://drive.google.com/file/d/"+pdf.getId()+"/view";
    var fila=criarFilaEnvioOficio_({numeroOficio:numero,tipo:"AUTORIZAÇÃO CHINA PARK",escola:"China Park Eco Resort",cnpj:"",emailPrincipal:emailsParque[0],emailsTodos:destinos.todos.join(","),assunto:"Autorização de entrada — China Park — Ofício Nº "+numero,htmlBody:pcMontarEmailParque_(numero,reservas),anexos:[{nome:pdf.getName(),mimeType:MimeType.PDF,fileId:pdf.getId()}],usuario:responsavel,codigoVerificacao:codigo});
    pcAtualizarRegistroOficioAutorizacao_(numero,"PENDENTE",url,tipo+(dados.oficioOriginal?" · Ref. "+dados.oficioOriginal:""));pcAtualizarAutorizacao_(idAut,"PENDENTE",pdf.getId(),url,null);
    pcAtualizarDestinatariosAutorizacao_(numero,"PENDENTE","");pcAuditar_("","OFICIO_AUTORIZACAO_GERADO","","PENDENTE",responsavel,"",{numeroOficio:numero,reservas:reservas.map(function(r){return r.idReserva;}),filaId:fila&&fila.id||"",para:destinos.para,cc:destinos.cc,cco:destinos.cco});
    return {ok:true,numeroOficio:numero,idAutorizacao:idAut,pdfUrl:url,filaId:fila&&fila.id||"",destinatarios:destinos,reservas:reservas.map(function(r){return {idReserva:r.idReserva,nomeSolicitante:r.nomeSolicitante,email:r.email||""};})};
  }catch(erro){Logger.log("emitirOficioAutorizacaoParqueChina: "+erro);if(numero&&registroReservado){pcAtualizarRegistroOficioAutorizacao_(numero,"ERRO","",String(erro.message||erro));pcAtualizarDestinatariosAutorizacao_(numero,"ERRO",String(erro.message||erro));}if(idAut)pcAtualizarAutorizacao_(idAut,"ERRO","","",null);return {ok:false,mensagem:String(erro.message||erro),numeroOficio:registroReservado?numero:""};}
}

function pcMontarEmailParque_(numero,reservas) {
  return '<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><div style="background:#001f4d;border-bottom:4px solid #C9A84C;padding:22px;color:#fff"><strong style="font-size:20px">SINDEDUCAÇÃO-ES</strong><div style="color:#C9A84C;font-weight:bold;margin-top:5px">Ofício Nº '+pcEscHtmlEmail_(numero)+'</div></div><div style="padding:24px"><p>Prezados(as),</p><p>Segue em anexo o ofício com a relação de associados e hóspedes autorizados para entrada no China Park Eco Resort.</p><p><strong>Total de reservas:</strong> '+reservas.length+'</p><p>Solicitamos a confirmação do recebimento.</p></div><div style="background:#001f4d;color:#fff;padding:14px 22px;font-size:12px">Documento gerado pelo SISGEP · SindEducação-ES</div></div>';
}

function pcMontarEmailConfirmacaoHospede_(r,numero,config) {
  var hospedes=pcHospedesReserva_(r).map(function(n){return '<li style="margin:5px 0">'+pcEscHtmlEmail_(n)+'</li>';}).join("");
  var mapa=config.LINK_MAPA_CHINA_PARK?'<a href="'+pcEscHtmlEmail_(config.LINK_MAPA_CHINA_PARK)+'" style="color:#0b3b75;font-weight:bold">Ver localização</a>':'';
  return '<!doctype html><html><body style="margin:0;background:#eef2f7;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #dbe3ef"><tr><td style="background:#001f4d;border-bottom:4px solid #C9A84C;padding:24px;color:#fff"><div style="font-size:21px;font-weight:900">SINDEDUCAÇÃO-ES</div><div style="font-size:12px;color:#C9A84C;font-weight:bold;margin-top:6px">SISGEP · Gestão de Benefícios</div></td></tr><tr><td style="padding:26px"><h1 style="font-size:22px;color:#001f4d;margin:0 0 12px">Reserva confirmada</h1><p>Olá, <strong>'+pcEscHtmlEmail_(r.nomeSolicitante)+'</strong>!</p><p>Sua hospedagem no China Park Eco Resort está autorizada pelo SindEducação-ES.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-left:4px solid #001f4d;border-radius:10px;margin:20px 0"><tr><td style="padding:14px"><strong>Protocolo</strong><br>'+pcEscHtmlEmail_(r.idReserva)+'</td><td style="padding:14px"><strong>Ofício</strong><br>Nº '+pcEscHtmlEmail_(numero)+'</td></tr><tr><td style="padding:14px"><strong>Suíte</strong><br>'+pcEscHtmlEmail_(r.suiteDefinida)+'</td><td style="padding:14px"><strong>Período</strong><br>'+pcFormatarDataBr_(r.dataEntrada)+' a '+pcFormatarDataBr_(r.dataSaida)+'</td></tr><tr><td style="padding:14px"><strong>Check-in</strong><br>'+pcEscHtmlEmail_(config.HORARIO_CHECKIN||"14:00")+'</td><td style="padding:14px"><strong>Check-out</strong><br>'+pcEscHtmlEmail_(config.HORARIO_CHECKOUT||"12:00")+'</td></tr></table><h2 style="font-size:15px;color:#001f4d">Hóspedes autorizados</h2><ul style="padding-left:20px">'+hospedes+'</ul><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-top:18px;font-size:13px"><strong>Importante:</strong> todos os hóspedes deverão apresentar documento oficial com foto na entrada.</div>'+(config.ENDERECO_CHINA_PARK?'<p style="margin-top:20px"><strong>Localização:</strong><br>'+pcEscHtmlEmail_(config.ENDERECO_CHINA_PARK)+'<br>'+mapa+'</p>':'')+'<p style="margin-top:24px">Desejamos uma excelente hospedagem!</p></td></tr><tr><td style="background:#001f4d;color:#fff;padding:18px 24px;font-size:12px;line-height:1.6"><strong>SindEducação-ES</strong><br>Mensagem enviada pelo SISGEP. Em caso de alteração, responda para '+pcEscHtmlEmail_(config.EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")+'.</td></tr></table></td></tr></table></body></html>';
}

function pcPrepararComunicacaoManual_(r) {
  var config=obterConfigParqueChina_(),aut=pcMapaAutorizacoesAtivas_()[String(r.idReserva)]||null,numero=aut?String(aut.numeroOficio||""):"",dependentes=pcDependentesReserva_(r);
  var listaDependentes=dependentes.length?"\n*Dependentes/acompanhantes vinculados:*\n"+dependentes.map(function(n,i){return String.fromCharCode(65+i)+". "+n;}).join("\n"):"\n*Dependentes/acompanhantes:* nenhum informado";
  var situacao=numero?"Confirmamos sua autorização de entrada e hospedagem no *China Park Eco Resort*.":"Confirmamos sua reserva no *China Park Eco Resort*. A autorização de entrada será formalizada ao parque pelo SindEducação-ES.";
  var oficio=numero?"\n• Ofício: Nº "+numero:"\n• Ofício: aguardando emissão";
  var local=config.ENDERECO_CHINA_PARK?"\n\n*Local:* "+config.ENDERECO_CHINA_PARK+(config.LINK_MAPA_CHINA_PARK?"\nMapa: "+config.LINK_MAPA_CHINA_PARK:""):"";
  var texto="*SINDEDUCAÇÃO-ES*\n*SISGEP · Confirmação de reserva*\n\nOlá, *"+r.nomeSolicitante+"*.\n\n"+situacao+"\n\n*Dados da reserva*\n• Hóspede responsável: "+r.nomeSolicitante+listaDependentes+"\n• Protocolo: "+r.idReserva+oficio+"\n• Suíte: "+r.suiteDefinida+"\n• Período: "+pcFormatarDataBr_(r.dataEntrada)+" a "+pcFormatarDataBr_(r.dataSaida)+"\n• Check-in: "+String(config.HORARIO_CHECKIN||"14:00")+"\n• Check-out: "+String(config.HORARIO_CHECKOUT||"12:00")+local+"\n\n*Orientação para entrada*\nO hóspede responsável e todos os dependentes/acompanhantes deverão apresentar documento oficial com foto. A autorização é válida exclusivamente para as pessoas relacionadas.\n\nEm caso de alteração, entre em contato pelo e-mail "+String(config.EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")+".\n\nAtenciosamente,\n*SindEducação-ES*";
  var dependentesHtml=dependentes.length?'<div style="margin-top:12px"><strong>Dependentes/acompanhantes vinculados</strong><ol type="A" style="margin:7px 0 0;padding-left:22px">'+dependentes.map(function(n){return '<li style="margin:4px 0">'+pcEscHtmlEmail_(n)+'</li>';}).join("")+'</ol></div>':'<div style="margin-top:12px;color:#64748b">Sem dependentes ou acompanhantes informados.</div>';
  var oficioHtml=numero?'<strong>Ofício</strong><br>Nº '+pcEscHtmlEmail_(numero):'<strong>Ofício</strong><br>Aguardando emissão';
  var aviso=numero?'Sua entrada e hospedagem estão autorizadas pelo SindEducação-ES.':'Sua reserva está confirmada. A autorização de entrada será formalizada ao parque pelo SindEducação-ES.';
  var html='<!doctype html><html><body style="margin:0;background:#eef2f7;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden"><tr><td style="background:#001f4d;border-bottom:4px solid #C9A84C;padding:24px;color:#fff"><div style="font-size:21px;font-weight:900">SINDEDUCAÇÃO-ES</div><div style="font-size:12px;color:#C9A84C;font-weight:bold;margin-top:6px">SISGEP · Confirmação de reserva</div></td></tr><tr><td style="padding:26px"><p>Olá, <strong>'+pcEscHtmlEmail_(r.nomeSolicitante)+'</strong>!</p><p>'+pcEscHtmlEmail_(aviso)+'</p><div style="background:#f8fafc;border-left:4px solid #001f4d;border-radius:10px;padding:15px;margin:18px 0"><strong>Hóspede responsável</strong><br>'+pcEscHtmlEmail_(r.nomeSolicitante)+dependentesHtml+'</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:10px"><tr><td style="padding:12px"><strong>Protocolo</strong><br>'+pcEscHtmlEmail_(r.idReserva)+'</td><td style="padding:12px">'+oficioHtml+'</td></tr><tr><td style="padding:12px"><strong>Suíte</strong><br>'+pcEscHtmlEmail_(r.suiteDefinida)+'</td><td style="padding:12px"><strong>Período</strong><br>'+pcFormatarDataBr_(r.dataEntrada)+' a '+pcFormatarDataBr_(r.dataSaida)+'</td></tr><tr><td style="padding:12px"><strong>Check-in</strong><br>'+pcEscHtmlEmail_(config.HORARIO_CHECKIN||"14:00")+'</td><td style="padding:12px"><strong>Check-out</strong><br>'+pcEscHtmlEmail_(config.HORARIO_CHECKOUT||"12:00")+'</td></tr></table><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-top:18px;font-size:13px"><strong>Importante:</strong> todas as pessoas relacionadas deverão apresentar documento oficial com foto.</div><p style="margin-top:22px">Atenciosamente,<br><strong>SindEducação-ES</strong></p></td></tr><tr><td style="background:#001f4d;color:#fff;padding:16px 24px;font-size:12px">Mensagem enviada pelo SISGEP · '+pcEscHtmlEmail_(config.EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")+'</td></tr></table></td></tr></table></body></html>';
  return {numeroOficio:numero,telefone:String(r.telefone||""),email:String(r.email||""),textoWhatsApp:texto,htmlEmail:html,assunto:"Confirmação de reserva — China Park — "+r.idReserva+(numero?" — Ofício Nº "+numero:"")};
}

function prepararComunicacaoManualReservaParqueChina(idReserva, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {pcExigirAdmin_(tokenSessao);var achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};var r=mapearLinhaParaObjetoParqueChina_(achada.valores);if(!pcReservaAutorizavel_(r))return {ok:false,mensagem:"A reserva precisa estar aprovada e com suíte definida para comunicação."};var c=pcPrepararComunicacaoManual_(r);return {ok:true,idReserva:r.idReserva,nomeSolicitante:r.nomeSolicitante,telefone:c.telefone,email:c.email,numeroOficio:c.numeroOficio,textoWhatsApp:c.textoWhatsApp};}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function enviarEmailManualReservaParqueChina(idReserva, emailAdicional, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP",achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};var r=mapearLinhaParaObjetoParqueChina_(achada.valores);if(!pcReservaAutorizavel_(r))return {ok:false,mensagem:"A reserva precisa estar aprovada e com suíte definida para envio."};var c=pcPrepararComunicacaoManual_(r),destinos=pcEmailsValidos_([r.email||"",emailAdicional||""].join(","));if(!destinos.length)return {ok:false,mensagem:"A reserva não possui e-mail válido. Informe um destinatário adicional."};var enviados=[],falhas=[];destinos.forEach(function(email){try{GmailApp.sendEmail(email,c.assunto,"Confirmação da reserva "+r.idReserva+" no China Park.",{htmlBody:c.htmlEmail,name:"SindEducação-ES | SISGEP",replyTo:String(obterConfigParqueChina_().EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")});pcRegistrarComunicacao_(r.idReserva,c.numeroOficio,"EMAIL_MANUAL_HOSPEDE",email,"ENVIADO",responsavel,"Envio manual pelas ações");enviados.push(email);}catch(e){pcRegistrarComunicacao_(r.idReserva,c.numeroOficio,"EMAIL_MANUAL_HOSPEDE",email,"ERRO",responsavel,String(e.message||e));falhas.push({email:email,motivo:String(e.message||e)});}});pcAuditar_(r.idReserva,"EMAIL_MANUAL_HOSPEDE","","",responsavel,"",{enviados:enviados,falhas:falhas,numeroOficio:c.numeroOficio});return {ok:falhas.length===0,totalEnviados:enviados.length,totalFalhas:falhas.length,mensagem:falhas.length?"Envio concluído com pendências.":"E-mail enviado com sucesso.",enviados:enviados,falhas:falhas};}catch(erro){Logger.log("enviarEmailManualReservaParqueChina: "+erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function pcLocalizarFilaOficioChina_(numero) {
  var sh=obterOuCriarAbaFilaOficios_(),hm=getHeaderMap_(sh);if(sh.getLastRow()<2)return null;var col=hm["NUMERO_OFICIO"],dados=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
  for(var i=dados.length-1;i>=0;i--)if(String(dados[i][col-1]||"").trim()===String(numero||"").trim())return {sh:sh,hm:hm,linha:i+2,valores:dados[i]};return null;
}

function pcAtualizarFilaOficioChina_(fila,status,erro,enviado) {
  var hm=fila.hm,sh=fila.sh,linha=fila.linha;function set(nome,valor){if(hm[nome])sh.getRange(linha,hm[nome]).setValue(valor);}
  set("STATUS",status);set("ULTIMO_ERRO",erro||"");set("DATA_ULTIMA_TENTATIVA",new Date());if(status==="PROCESSANDO"&&hm["TENTATIVAS"]){var n=Number(sh.getRange(linha,hm["TENTATIVAS"]).getValue()||0);sh.getRange(linha,hm["TENTATIVAS"]).setValue(n+1);}if(enviado){set("DATA_ENVIO",new Date());set("MENSAGEM_ID","GMAILAPP_SEM_ID");set("STATUS_RECEBIMENTO","ENVIADO");}SpreadsheetApp.flush();
}

function pcMarcarAutorizacaoEnviada_(numero) {
  var sh=pcObterAbaAutorizacoes_();if(sh.getLastRow()>=2){var nums=sh.getRange(2,3,sh.getLastRow()-1,1).getValues();for(var i=0;i<nums.length;i++)if(String(nums[i][0])===String(numero)){sh.getRange(i+2,8).setValue("ENVIADO");sh.getRange(i+2,13).setValue(new Date());sh.getRange(i+2,16).setValue(new Date());break;}}
  pcAtualizarRegistroOficioAutorizacao_(numero,"ENVIADO","","");pcAtualizarDestinatariosAutorizacao_(numero,"ENVIADO","");
}

function enviarOficioAutorizacaoParqueChinaAgora(numero, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try{
    var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP",dest=pcBuscarDestinatariosAutorizacao_(numero);
    var lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {ok:false,mensagem:"Existe outro envio em processamento. Aguarde e tente novamente."};var fila;
    try{fila=pcLocalizarFilaOficioChina_(numero);if(!fila)return {ok:false,mensagem:"Ofício não encontrado na fila oficial."};if(!dest||!dest.para.length){var principal=pcEmailsValidos_(fila.valores[fila.hm["EMAIL_PRINCIPAL"]-1]),todos=pcEmailsValidos_(fila.valores[fila.hm["EMAILS_TODOS"]-1]);if(!principal.length&&todos.length)principal=[todos[0]];dest={para:principal,cc:[],cco:todos.filter(function(e){return principal.indexOf(e)===-1;})};}if(!dest.para.length)return {ok:false,mensagem:"Os destinatários deste ofício não foram encontrados."};var status=String(fila.valores[fila.hm["STATUS"]-1]||"").toUpperCase();if(status==="ENVIADO")return {ok:true,mensagem:"Este ofício já foi enviado anteriormente."};if(status==="PROCESSANDO"){var ultima=fila.hm["DATA_ULTIMA_TENTATIVA"]?fila.valores[fila.hm["DATA_ULTIMA_TENTATIVA"]-1]:null;if(ultima instanceof Date&&new Date()-ultima<300000)return {ok:false,mensagem:"O envio já está em processamento."};}pcAtualizarFilaOficioChina_(fila,"PROCESSANDO","",false);pcAtualizarDestinatariosAutorizacao_(numero,"PROCESSANDO","");}finally{lock.releaseLock();}
    try{var h=fila.hm,v=fila.valores,html=String(v[h["HTML_BODY"]-1]||""),assunto=String(v[h["ASSUNTO"]-1]||"Autorização China Park"),anexosInfo=[];try{anexosInfo=JSON.parse(String(v[h["ANEXOS_JSON"]-1]||"[]"));}catch(e){throw new Error("Lista de anexos inválida.");}var anexos=(anexosInfo||[]).filter(function(a){return a&&a.fileId;}).map(function(a){var b=DriveApp.getFileById(String(a.fileId)).getBlob();if(a.nome)b.setName(String(a.nome));return b;}),opcoes={htmlBody:html,attachments:anexos,name:"SindEducação-ES | SISGEP",replyTo:String(obterConfigParqueChina_().EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")};if(dest.cc.length)opcoes.cc=dest.cc.join(",");if(dest.cco.length)opcoes.bcc=dest.cco.join(",");GmailApp.sendEmail(dest.para.join(","),assunto,"Segue ofício em anexo.",opcoes);pcAtualizarFilaOficioChina_(fila,"ENVIADO","",true);pcMarcarAutorizacaoEnviada_(numero);pcRegistrarComunicacao_("",numero,"EMAIL_PARQUE",dest.para.join(","),"ENVIADO",responsavel,"CC: "+dest.cc.join(",")+" · CCO: "+dest.cco.join(","));pcAuditar_("","OFICIO_AUTORIZACAO_ENVIADO","PENDENTE","ENVIADO",responsavel,"",{numeroOficio:numero,para:dest.para,cc:dest.cc,cco:dest.cco});return {ok:true,mensagem:"Ofício enviado com sucesso.",para:dest.para,cc:dest.cc,cco:dest.cco};}catch(eEnvio){pcAtualizarFilaOficioChina_(fila,"ERRO",String(eEnvio.message||eEnvio),false);pcAtualizarDestinatariosAutorizacao_(numero,"ERRO",String(eEnvio.message||eEnvio));return {ok:false,mensagem:"Falha no envio: "+String(eEnvio.message||eEnvio)};}
  }catch(erro){return {ok:false,mensagem:String(erro.message||erro)};}
}

function pcMontarEmailTesteParque_(reservas,proximoNumero) {
  var cards=(reservas||[]).map(function(r){var deps=pcDependentesReserva_(r),lista=deps.length?'<ol type="A" style="margin:6px 0 0;padding-left:22px">'+deps.map(function(n){return '<li>'+pcEscHtmlEmail_(n)+'</li>';}).join("")+'</ol>':'<span style="color:#64748b">Nenhum dependente informado</span>';return '<div style="border:1px solid #dbe3ef;border-left:4px solid #0b3b75;border-radius:10px;padding:14px;margin:10px 0"><strong>'+pcEscHtmlEmail_(r.nomeSolicitante)+'</strong><div style="font-size:13px;margin-top:7px">Protocolo: '+pcEscHtmlEmail_(r.idReserva)+' · Suíte: '+pcEscHtmlEmail_(r.suiteDefinida)+'<br>Período: '+pcFormatarDataBr_(r.dataEntrada)+' a '+pcFormatarDataBr_(r.dataSaida)+'</div><div style="font-size:13px;margin-top:8px"><strong>Dependentes/acompanhantes</strong>'+lista+'</div></div>';}).join("");
  return '<!doctype html><html><body style="margin:0;background:#eef2f7;font-family:Arial,sans-serif;color:#172033"><table width="100%"><tr><td align="center" style="padding:24px"><table width="680" style="max-width:100%;background:#fff;border-collapse:collapse"><tr><td style="background:#001f4d;color:#fff;border-bottom:4px solid #C9A84C;padding:22px"><strong style="font-size:20px">SINDEDUCAÇÃO-ES</strong><div style="color:#C9A84C;margin-top:5px">SISGEP · Teste de autorização</div></td></tr><tr><td style="padding:24px"><div style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:12px;font-weight:bold">TESTE — NÃO É OFÍCIO E NÃO AUTORIZA ENTRADA</div><p>Esta mensagem permite validar destinatários e formatação antes da emissão oficial.</p><p><strong>Próximo número previsto:</strong> '+pcEscHtmlEmail_(proximoNumero||"—")+' (não reservado)</p>'+cards+'</td></tr></table></td></tr></table></body></html>';
}

function enviarTesteEmailAutorizacaoParqueChina(dados,tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try{var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP";dados=dados||{};var destinos=pcNormalizarDestinatariosOficio_(dados,obterConfigParqueChina_());if(!destinos.para.length)return {ok:false,mensagem:"Selecione pelo menos um destinatário principal (Para)."};var reservas=pcSelecionarReservasAutorizacao_(dados.idsReservas||[],true);if(!reservas.length)return {ok:false,mensagem:"Selecione pelo menos uma reserva para compor o teste."};var proximo=typeof preverProximoNumeroOficio_==="function"?preverProximoNumeroOficio_():"—",assunto="[TESTE — NÃO É OFÍCIO] Autorização China Park — prévia "+proximo,opcoes={htmlBody:pcMontarEmailTesteParque_(reservas,proximo),name:"SindEducação-ES | SISGEP",replyTo:String(obterConfigParqueChina_().EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")};if(destinos.cc.length)opcoes.cc=destinos.cc.join(",");if(destinos.cco.length)opcoes.bcc=destinos.cco.join(",");GmailApp.sendEmail(destinos.para.join(","),assunto,"TESTE SISGEP — esta mensagem não é um ofício e não autoriza entrada.",opcoes);pcRegistrarComunicacao_("","PRÉVIA "+proximo,"EMAIL_TESTE_PARQUE",destinos.para.join(","),"ENVIADO",responsavel,"CC: "+destinos.cc.join(",")+" · CCO: "+destinos.cco.join(","));pcAuditar_("","EMAIL_TESTE_AUTORIZACAO_CHINA_PARK","","ENVIADO",responsavel,"",{proximoNumeroNaoReservado:proximo,para:destinos.para,cc:destinos.cc,cco:destinos.cco,reservas:reservas.map(function(r){return r.idReserva;})});return {ok:true,mensagem:"E-mail de teste enviado. Nenhum número de ofício foi consumido.",proximoNumero:proximo,para:destinos.para,cc:destinos.cc,cco:destinos.cco};}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function enviarConfirmacoesHospedesParqueChina(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try{
    var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP";dados=dados||{};var numero=String(dados.numeroOficio||"").trim();if(!numero)return {ok:false,mensagem:"Número do ofício não informado."};
    var reservas=pcSelecionarReservasAutorizacao_(dados.idsReservas||[],true),extras=dados.emailsAdicionais||{},config=obterConfigParqueChina_(),enviados=[],falhas=[];
    reservas.forEach(function(r){var destinos=pcEmailsValidos_([r.email||"",extras[String(r.idReserva)]||""].join(","));if(!destinos.length){falhas.push({idReserva:r.idReserva,motivo:"Nenhum e-mail válido."});return;}var html=pcMontarEmailConfirmacaoHospede_(r,numero,config),assunto="Reserva confirmada — China Park — "+r.idReserva+" — Ofício Nº "+numero;destinos.forEach(function(email){try{GmailApp.sendEmail(email,assunto,"Sua reserva no China Park foi confirmada. Protocolo: "+r.idReserva+". Ofício Nº "+numero+".",{htmlBody:html,name:"SindEducação-ES | SISGEP",replyTo:String(config.EMAIL_RESPOSTA_BENEFICIOS||"financeiro@sindeducacao.com")});pcRegistrarComunicacao_(r.idReserva,numero,"EMAIL_HOSPEDE",email,"ENVIADO",responsavel,"Confirmação HTML");enviados.push({idReserva:r.idReserva,email:email});}catch(e){pcRegistrarComunicacao_(r.idReserva,numero,"EMAIL_HOSPEDE",email,"ERRO",responsavel,String(e.message||e));falhas.push({idReserva:r.idReserva,email:email,motivo:String(e.message||e)});}});});
    pcAuditar_("","CONFIRMACOES_HOSPEDES_ENVIADAS","","",responsavel,"",{numeroOficio:numero,enviados:enviados.length,falhas:falhas.length});return {ok:falhas.length===0,totalEnviados:enviados.length,totalFalhas:falhas.length,enviados:enviados,falhas:falhas,mensagem:falhas.length?"Envio concluído com pendências.":"Confirmações enviadas com sucesso."};
  }catch(erro){Logger.log(erro);return {ok:false,mensagem:String(erro.message||erro)};}
}

// ----------------------------------------------------------------------------
// OPERAÇÃO HOTELEIRA — CHECK-IN, CHECK-OUT, LIMPEZA E OCORRÊNCIAS
// Mantida em aba própria para preservar as 43 colunas da reserva.
// ----------------------------------------------------------------------------

var PC_OP_CABECALHO = [
  "ID Movimento","Data/Hora","Data Operação","ID Reserva","Suíte",
  "Tipo","Status","Responsável","Observação","Dados JSON"
];

function pcObterAbaOperacao_() {
  var ss=SpreadsheetApp.openById(PLANILHA_ID),sh=ss.getSheetByName("OperacaoParqueChina");
  if(!sh)sh=ss.insertSheet("OperacaoParqueChina");
  if(sh.getMaxColumns()<PC_OP_CABECALHO.length)sh.insertColumnsAfter(sh.getMaxColumns(),PC_OP_CABECALHO.length-sh.getMaxColumns());
  if(sh.getLastRow()===0)sh.getRange(1,1,1,PC_OP_CABECALHO.length).setValues([PC_OP_CABECALHO]);
  sh.getRange(1,1,1,PC_OP_CABECALHO.length).setValues([PC_OP_CABECALHO]).setFontWeight("bold").setBackground("#0b3b75").setFontColor("#ffffff");sh.setFrozenRows(1);return sh;
}

function pcDataHoraOperacao_(dataIso,hora) {
  var p=String(dataIso||"").slice(0,10).split("-"),h=String(hora||"00:00").split(":");
  if(p.length!==3)return new Date("invalid");
  return new Date(Number(p[0]),Number(p[1])-1,Number(p[2]),Number(h[0]||0),Number(h[1]||0),0,0);
}

function pcLerMovimentosOperacao_(ate) {
  var sh=pcObterAbaOperacao_(),last=sh.getLastRow();if(last<2)return [];
  return sh.getRange(2,1,last-1,PC_OP_CABECALHO.length).getValues().map(function(l){var dados={};try{dados=JSON.parse(String(l[9]||"{}"));}catch(e){}return {idMovimento:String(l[0]||""),dataHora:l[1] instanceof Date?l[1]:new Date(l[1]),dataOperacao:String(l[2]||""),idReserva:String(l[3]||""),suite:String(l[4]||""),tipo:String(l[5]||""),status:String(l[6]||""),responsavel:String(l[7]||""),observacao:String(l[8]||""),dados:dados};}).filter(function(m){return !isNaN(m.dataHora.getTime())&&(!ate||m.dataHora<=ate);}).sort(function(a,b){return a.dataHora-b.dataHora;});
}

function pcEstadoOperacaoReservas_(movimentos) {
  var mapa={};(movimentos||[]).forEach(function(m){if(!m.idReserva)return;var x=mapa[m.idReserva]||{estado:"SEM_MOVIMENTO",ultimo:null,checkin:null,checkout:null,limpeza:null,liberacao:null,noShow:null,ocorrencias:[]};if(m.tipo==="CHECKIN"){x.estado="HOSPEDADO";x.checkin=m;}else if(m.tipo==="CHECKOUT"){x.estado="AGUARDANDO_LIMPEZA";x.checkout=m;}else if(m.tipo==="LIMPEZA_INICIADA"){x.estado="EM_LIMPEZA";x.limpeza=m;}else if(m.tipo==="SUITE_LIBERADA"){x.estado="LIBERADA";x.liberacao=m;}else if(m.tipo==="NO_SHOW"){x.estado="NO_SHOW";x.noShow=m;}else if(m.tipo==="OCORRENCIA"){x.ocorrencias.push(m);}x.ultimo=m;mapa[m.idReserva]=x;});return mapa;
}

function pcRegistrarMovimentoOperacao_(tipo,r,responsavel,observacao,dados) {
  var agora=new Date(),id="PCO-"+Utilities.formatDate(agora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyyMMddHHmmss")+"-"+Math.floor(Math.random()*1000),dataOp=Utilities.formatDate(agora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd");
  pcObterAbaOperacao_().appendRow([id,agora,dataOp,String(r.idReserva||""),String(r.suiteDefinida||r.suite||""),tipo,"REGISTRADO",responsavel||"SISGEP",observacao||"",JSON.stringify(dados||{})]);return {idMovimento:id,dataHora:agora};
}

function pcItemOperacao_(r,suite,estado,oficios) {
  var aut=oficios[String(r.idReserva)]||null;
  return {idReserva:r.idReserva,nomeSolicitante:r.nomeSolicitante,cpf:r.cpf||"",telefone:r.telefone||"",email:r.email||"",suite:String(suite||r.suiteDefinida||""),dataEntrada:r.dataEntrada,dataSaida:r.dataSaida,quantidadePessoas:Number(r.quantidadePessoas||0),dependentes:pcDependentesReserva_(r),status:r.status,statusPagamento:r.statusPagamento||"",gratuitoPago:r.gratuitoPago||"",valorTotal:Number(r.valorTotal||0),valorRecebido:Number(r.valorRecebido||0),numeroOficio:aut?String(aut.numeroOficio||""):"",statusAutorizacao:aut?String(aut.status||""):"",estadoOperacional:estado?estado.estado:"SEM_MOVIMENTO",checkinRealizado:estado&&estado.checkin?Utilities.formatDate(estado.checkin.dataHora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss"):"",checkoutRealizado:estado&&estado.checkout?Utilities.formatDate(estado.checkout.dataHora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss"):"",limpezaIniciada:estado&&estado.limpeza?Utilities.formatDate(estado.limpeza.dataHora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss"):"",suiteLiberada:estado&&estado.liberacao?Utilities.formatDate(estado.liberacao.dataHora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss"):""};
}

function obterOperacaoHojeParqueChina(parametros,tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    pcExigirAdmin_(tokenSessao);parametros=parametros||{};var agora=new Date(),data=String(parametros.data||Utilities.formatDate(agora,PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd")),hora=String(parametros.hora||Utilities.formatDate(agora,PARQUE_CHINA_CONFIG.TIMEZONE,"HH:mm")),instante=pcDataHoraOperacao_(data,hora);if(isNaN(instante.getTime()))return {ok:false,mensagem:"Informe data e horário válidos."};
    var config=obterConfigParqueChina_(),checkin=String(config.HORARIO_CHECKIN||"14:00"),checkout=String(config.HORARIO_CHECKOUT||"12:00"),movimentos=pcLerMovimentosOperacao_(instante),estados=pcEstadoOperacaoReservas_(movimentos),oficios=pcMapaAutorizacoesAtivas_(),reservas=pcLerLinhasReservas_().linhas.map(function(x){return x.reserva;}).filter(function(r){return pcStatusBloqueiaSuite_(r.status)&&String(r.suiteDefinida||"").trim();}),porSuite={},entradas=[],saidas=[],hospedados=[],limpeza=[],alertas=[],timeline=[];
    PARQUE_CHINA_CONFIG.SUITES.forEach(function(s){porSuite[s]=[];});reservas.forEach(function(r){var s=String(r.suiteDefinida||"");if(porSuite[s])porSuite[s].push(r);});
    function chave(v){return String(v||"").slice(0,10);}function ehBloqueio(r){return pcEhBloqueioInstitucional_(r);}function intervalo(r){var b=ehBloqueio(r);return {inicio:pcDataHoraOperacao_(chave(r.dataEntrada),b?"00:00":checkin),fim:pcDataHoraOperacao_(chave(r.dataSaida),b?"00:00":checkout)};}function ativo(r){var x=intervalo(r);return instante>=x.inicio&&instante<x.fim;}
    var suites=[],totalOcupadas=0,totalLivres=0,totalBloqueadas=0,totalLimpeza=0,totalConflitos=0;
    PARQUE_CHINA_CONFIG.SUITES.forEach(function(suite){var lista=porSuite[suite]||[],bloqueios=lista.filter(function(r){return ehBloqueio(r)&&ativo(r);}),reais=lista.filter(function(r){var e=estados[String(r.idReserva)];return !ehBloqueio(r)&&e&&e.estado==="HOSPEDADO";}),programadas=lista.filter(function(r){var e=estados[String(r.idReserva)];return !ehBloqueio(r)&&ativo(r)&&(!e||["SEM_MOVIMENTO","HOSPEDADO"].indexOf(e.estado)!==-1);}),emLimpeza=lista.filter(function(r){var e=estados[String(r.idReserva)];return e&&["AGUARDANDO_LIMPEZA","EM_LIMPEZA"].indexOf(e.estado)!==-1;}),ativas={};reais.concat(programadas).forEach(function(r){ativas[String(r.idReserva)]=r;});var ocupantes=Object.keys(ativas).map(function(k){return ativas[k];}),status="LIVRE",principal=null;if(ocupantes.length>1||(bloqueios.length&&ocupantes.length)||(emLimpeza.length&&(ocupantes.length||bloqueios.length))){status="CONFLITO";principal=ocupantes[0]||bloqueios[0]||emLimpeza[0];totalConflitos++;totalOcupadas++;}else if(bloqueios.length){status="BLOQUEADA";principal=bloqueios[0];totalBloqueadas++;}else if(emLimpeza.length){var eLim=estados[String(emLimpeza[0].idReserva)];status=eLim&&eLim.estado==="EM_LIMPEZA"?"EM_LIMPEZA":"AGUARDANDO_LIMPEZA";principal=emLimpeza[0];totalLimpeza++;}else if(ocupantes.length){principal=ocupantes[0];var eO=estados[String(principal.idReserva)];status=eO&&eO.estado==="HOSPEDADO"?(chave(principal.dataSaida)===data?"CHECKOUT_HOJE":"HOSPEDADA"):"OCUPACAO_PREVISTA";totalOcupadas++;}else{var chegada=lista.filter(function(r){var e=estados[String(r.idReserva)];return !ehBloqueio(r)&&chave(r.dataEntrada)===data&&(!e||e.estado!=="NO_SHOW");})[0];if(chegada){status="CHECKIN_HOJE";principal=chegada;}totalLivres++;}
      var itemPrincipal=principal?pcItemOperacao_(principal,suite,estados[String(principal.idReserva)],oficios):null;suites.push({suite:suite,status:status,reserva:itemPrincipal});
    });
    reservas.filter(function(r){return !ehBloqueio(r);}).forEach(function(r){var e=estados[String(r.idReserva)],item=pcItemOperacao_(r,r.suiteDefinida,e,oficios),entradaHoje=chave(r.dataEntrada)===data,saidaHoje=chave(r.dataSaida)===data;if(entradaHoje){entradas.push(item);timeline.push({hora:checkin,tipo:"CHECKIN",suite:r.suiteDefinida,nome:r.nomeSolicitante,idReserva:r.idReserva});if(!item.numeroOficio)alertas.push({prioridade:"ALTA",titulo:"Autorização pendente · Suíte "+r.suiteDefinida,descricao:r.nomeSolicitante+" ainda não possui ofício ativo.",idReserva:r.idReserva,acao:"AUTORIZAR"});var saldo=Math.max(0,Number(r.valorTotal||0)-Number(r.valorRecebido||0));if(r.gratuitoPago!=="GRATUITO"&&saldo>0.009)alertas.push({prioridade:"MEDIA",titulo:"Pagamento pendente · Suíte "+r.suiteDefinida,descricao:r.nomeSolicitante+" possui saldo de R$ "+saldo.toFixed(2).replace(".",",")+".",idReserva:r.idReserva,acao:"PAGAMENTO"});if(instante>pcDataHoraOperacao_(data,checkin)&&(!e||e.estado==="SEM_MOVIMENTO"))alertas.push({prioridade:"ALTA",titulo:"Check-in não registrado · Suíte "+r.suiteDefinida,descricao:"O horário previsto de "+checkin+" já passou.",idReserva:r.idReserva,acao:"CHECKIN"});}
      if(saidaHoje){saidas.push(item);timeline.push({hora:checkout,tipo:"CHECKOUT",suite:r.suiteDefinida,nome:r.nomeSolicitante,idReserva:r.idReserva});if(instante>pcDataHoraOperacao_(data,checkout)&&e&&e.estado==="HOSPEDADO")alertas.push({prioridade:"ALTA",titulo:"Check-out atrasado · Suíte "+r.suiteDefinida,descricao:r.nomeSolicitante+" permanece com check-out aberto.",idReserva:r.idReserva,acao:"CHECKOUT"});}
      if(e&&e.estado==="HOSPEDADO")hospedados.push(item);else if(ativo(r)&&(!e||e.estado==="SEM_MOVIMENTO"))hospedados.push(item);if(e&&["AGUARDANDO_LIMPEZA","EM_LIMPEZA"].indexOf(e.estado)!==-1){limpeza.push(item);if(e.checkout)timeline.push({hora:Utilities.formatDate(e.checkout.dataHora,PARQUE_CHINA_CONFIG.TIMEZONE,"HH:mm"),tipo:"LIMPEZA",suite:r.suiteDefinida,nome:"Limpeza após "+r.nomeSolicitante,idReserva:r.idReserva});}
    });
    timeline.sort(function(a,b){return String(a.hora).localeCompare(String(b.hora));});entradas.sort(function(a,b){return String(a.suite).localeCompare(String(b.suite));});saidas.sort(function(a,b){return String(a.suite).localeCompare(String(b.suite));});hospedados.sort(function(a,b){return String(a.suite).localeCompare(String(b.suite));});
    return {ok:true,data:data,hora:hora,horarioCheckin:checkin,horarioCheckout:checkout,kpis:{totalSuites:PARQUE_CHINA_CONFIG.SUITES.length,checkins:entradas.length,hospedadas:totalOcupadas,checkouts:saidas.length,livres:totalLivres,limpeza:totalLimpeza,bloqueadas:totalBloqueadas,conflitos:totalConflitos},entradas:entradas,hospedados:hospedados,saidas:saidas,limpeza:limpeza,alertas:alertas,suites:suites,timeline:timeline,atualizadoEm:Utilities.formatDate(new Date(),PARQUE_CHINA_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss")};
  } catch(erro){Logger.log("obterOperacaoHojeParqueChina: "+erro);return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function registrarCheckinParqueChina(idReserva,dados,tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP";dados=dados||{};return pcComLock_(function(){var achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};var r=mapearLinhaParaObjetoParqueChina_(achada.valores);if(!pcReservaAutorizavel_(r))return {ok:false,mensagem:"A reserva precisa estar aprovada e com suíte definida."};var aut=pcMapaAutorizacoesAtivas_()[String(idReserva)];if(!aut)return {ok:false,codigo:"OFICIO_PENDENTE",mensagem:"Emita o ofício de autorização antes de realizar o check-in."};var estados=pcEstadoOperacaoReservas_(pcLerMovimentosOperacao_()),estado=estados[String(idReserva)];if(estado&&estado.estado==="HOSPEDADO")return {ok:false,mensagem:"O check-in já foi registrado."};if(estado&&estado.estado==="NO_SHOW")return {ok:false,mensagem:"A reserva foi marcada como no-show. Registre uma ocorrência administrativa antes de qualquer correção."};if(estado&&["AGUARDANDO_LIMPEZA","EM_LIMPEZA","LIBERADA"].indexOf(estado.estado)!==-1)return {ok:false,mensagem:"A reserva já possui check-out registrado."};var pendencias=[],saldo=Math.max(0,Number(r.valorTotal||0)-Number(r.valorRecebido||0));if(r.gratuitoPago!=="GRATUITO"&&saldo>0.009)pendencias.push("Pagamento pendente de R$ "+saldo.toFixed(2).replace(".",","));if(!pcCpfValido_(r.cpf))pendencias.push("CPF do responsável não validado");if(pendencias.length&&!dados.confirmarPendencias)return {ok:false,codigo:"PENDENCIAS_CHECKIN",mensagem:"Existem pendências antes do check-in.",pendencias:pendencias};var mov=pcRegistrarMovimentoOperacao_("CHECKIN",r,responsavel,String(dados.observacao||""),{numeroOficio:aut.numeroOficio,pendenciasConfirmadas:pendencias});pcAuditar_(idReserva,"CHECKIN_REALIZADO","","HOSPEDADO",responsavel,String(dados.observacao||""),{suite:r.suiteDefinida,numeroOficio:aut.numeroOficio,movimento:mov.idMovimento});return {ok:true,idReserva:idReserva,suite:r.suiteDefinida,mensagem:"Check-in registrado com sucesso."};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function registrarCheckoutParqueChina(idReserva,dados,tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP";dados=dados||{};return pcComLock_(function(){var achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};var r=mapearLinhaParaObjetoParqueChina_(achada.valores),estados=pcEstadoOperacaoReservas_(pcLerMovimentosOperacao_()),estado=estados[String(idReserva)];if((!estado||estado.estado!=="HOSPEDADO")&&!dados.confirmarSemCheckin)return {ok:false,codigo:"CHECKIN_NAO_REGISTRADO",mensagem:"O check-in não foi registrado. Confirme se deseja registrar o check-out mesmo assim."};if(estado&&["AGUARDANDO_LIMPEZA","EM_LIMPEZA","LIBERADA"].indexOf(estado.estado)!==-1)return {ok:false,mensagem:"O check-out já foi registrado."};var mov=pcRegistrarMovimentoOperacao_("CHECKOUT",r,responsavel,String(dados.observacao||""),{ocorrencia:String(dados.ocorrencia||""),checkinNaoRegistrado:!estado||estado.estado!=="HOSPEDADO"});pcAuditar_(idReserva,"CHECKOUT_REALIZADO","HOSPEDADO","AGUARDANDO_LIMPEZA",responsavel,String(dados.observacao||""),{suite:r.suiteDefinida,movimento:mov.idMovimento});return {ok:true,idReserva:idReserva,suite:r.suiteDefinida,mensagem:"Check-out registrado. A suíte está aguardando limpeza."};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function registrarLimpezaParqueChina(idReserva,acao,observacao,tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP",tipo=String(acao||"").toUpperCase()==="LIBERAR"?"SUITE_LIBERADA":"LIMPEZA_INICIADA";return pcComLock_(function(){var achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};var r=mapearLinhaParaObjetoParqueChina_(achada.valores),estado=pcEstadoOperacaoReservas_(pcLerMovimentosOperacao_())[String(idReserva)];if(!estado||["AGUARDANDO_LIMPEZA","EM_LIMPEZA"].indexOf(estado.estado)===-1)return {ok:false,mensagem:"A suíte não está aguardando limpeza."};if(tipo==="SUITE_LIBERADA"&&estado.estado!=="EM_LIMPEZA")return {ok:false,mensagem:"Inicie a limpeza antes de liberar a suíte."};var mov=pcRegistrarMovimentoOperacao_(tipo,r,responsavel,String(observacao||""),{}),novo=tipo==="SUITE_LIBERADA"?"LIBERADA":"EM_LIMPEZA";pcAuditar_(idReserva,tipo,estado.estado,novo,responsavel,String(observacao||""),{suite:r.suiteDefinida,movimento:mov.idMovimento});return {ok:true,idReserva:idReserva,suite:r.suiteDefinida,mensagem:tipo==="SUITE_LIBERADA"?"Suíte liberada para nova hospedagem.":"Limpeza iniciada."};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function registrarOcorrenciaOperacaoParqueChina(idReserva,observacao,tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP",texto=String(observacao||"").trim();if(!texto)return {ok:false,mensagem:"Descreva a ocorrência."};var achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};var r=mapearLinhaParaObjetoParqueChina_(achada.valores),mov=pcRegistrarMovimentoOperacao_("OCORRENCIA",r,responsavel,texto,{});pcAuditar_(idReserva,"OCORRENCIA_OPERACIONAL","","",responsavel,texto,{suite:r.suiteDefinida,movimento:mov.idMovimento});return {ok:true,mensagem:"Ocorrência registrada."};}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function registrarNoShowParqueChina(idReserva,motivo,tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {var sessao=pcExigirAdmin_(tokenSessao),responsavel=sessao.nome||sessao.usuario||sessao.email||"SISGEP",texto=String(motivo||"").trim();if(!texto)return {ok:false,mensagem:"Informe o motivo do no-show."};return pcComLock_(function(){var achada=buscarReservaParqueChinaPorId_(idReserva);if(!achada)return {ok:false,mensagem:"Reserva não encontrada."};var r=mapearLinhaParaObjetoParqueChina_(achada.valores),estado=pcEstadoOperacaoReservas_(pcLerMovimentosOperacao_())[String(idReserva)];if(estado&&estado.estado==="HOSPEDADO")return {ok:false,mensagem:"Não é possível marcar no-show após o check-in."};if(estado&&estado.estado==="NO_SHOW")return {ok:false,mensagem:"O no-show já foi registrado."};var mov=pcRegistrarMovimentoOperacao_("NO_SHOW",r,responsavel,texto,{});pcAuditar_(idReserva,"NO_SHOW","","NO_SHOW",responsavel,texto,{suite:r.suiteDefinida,movimento:mov.idMovimento});return {ok:true,mensagem:"No-show registrado."};});}catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function validarOperacaoParqueChina(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var estruturaReservas=pcValidarMapaColunas_(),ss=SpreadsheetApp.openById(PLANILHA_ID),sh=ss.getSheetByName("OperacaoParqueChina"),estruturaOperacao={ok:true,criada:!!sh,totalColunas:PC_OP_CABECALHO.length,mensagem:sh?"Aba operacional encontrada.":"A aba OperacaoParqueChina será criada automaticamente no primeiro acesso."};
    if(sh&&sh.getLastRow()>0){var atual=sh.getRange(1,1,1,PC_OP_CABECALHO.length).getDisplayValues()[0],divergencias=[];PC_OP_CABECALHO.forEach(function(h,i){if(String(atual[i]||"").trim()!==h)divergencias.push({coluna:i+1,esperado:h,encontrado:atual[i]||""});});estruturaOperacao.ok=!divergencias.length;estruturaOperacao.divergencias=divergencias;estruturaOperacao.mensagem=divergencias.length?"O cabeçalho da operação possui divergências.":"OperacaoParqueChina sincronizada (10 colunas).";}
    var resultado={ok:estruturaReservas.ok&&estruturaOperacao.ok,estruturaReservas:estruturaReservas,estruturaOperacao:estruturaOperacao,mensagem:estruturaReservas.ok&&estruturaOperacao.ok?"Operação hoteleira pronta para homologação.":"Revise as divergências informadas."};Logger.log(JSON.stringify(resultado));return resultado;
  } catch(erro){return {ok:false,mensagem:pcMensagemErro_(erro)};}
}

function validarIntegracaoAutorizacoesParqueChina(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var faltando=[];
    ["gerarProximoNumeroSeguro_","preverProximoNumeroOficio_","gerarHtmlOficioCompleto_","oficios_converterHtmlParaPdf_","criarFilaEnvioOficio_","enviarOficioDaFilaAgora","appendRowByHeader_","getHeaderMap_"].forEach(function(nome){
      try { if (typeof globalThis[nome] !== "function") faltando.push(nome); }
      catch(e) { if (eval("typeof "+nome) !== "function") faltando.push(nome); }
    });
    var config=obterConfigParqueChina_();
    var resultado={ok:faltando.length===0,estruturaReservas:pcValidarMapaColunas_(),dependenciasFaltando:faltando,emailParqueConfigurado:pcEmailsValidos_(config.EMAIL_CHINA_PARK).length>0,seletorDestinatariosConfigurado:pcEmailsValidos_(config.EMAILS_DESTINATARIOS_CHINA_PARK).length>0,opcoesDestinatarios:pcEmailsValidos_(config.EMAILS_DESTINATARIOS_CHINA_PARK),proximoNumero:faltando.indexOf("preverProximoNumeroOficio_")===-1?preverProximoNumeroOficio_():"",mensagem:faltando.length?"Existem dependências pendentes.":"Integração de autorizações pronta para homologação."};
    Logger.log(JSON.stringify(resultado));
    return resultado;
  } catch(erro){return {ok:false,mensagem:String(erro.message||erro)};}
}

function validarMapaColunasParqueChina(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  return pcValidarMapaColunas_();
}
/**
 * Localiza o indice (0-based) de uma coluna testando varios nomes possiveis.
 */
function pcIdxCol_(cabecalho, candidatos){
  var norm = function(s){
    return String(s==null?"":s).trim().toUpperCase()
      .replace(/[ÁÀÂÃÄ]/g,"A").replace(/[ÉÈÊË]/g,"E").replace(/[ÍÌÎÏ]/g,"I")
      .replace(/[ÓÒÔÕÖ]/g,"O").replace(/[ÚÙÛÜ]/g,"U").replace(/Ç/g,"C")
      .replace(/[^A-Z0-9]/g,"");
  };
  var mapa = {};
  for (var i=0;i<cabecalho.length;i++) mapa[norm(cabecalho[i])] = i;
  for (var j=0;j<candidatos.length;j++){
    var k = norm(candidatos[j]);
    if (mapa[k] !== undefined) return mapa[k];
  }
  return -1;
}

/** Converte celula (Date, ISO ou dd/mm/aaaa) para Date na meia-noite local. */
function pcParaData_(v){
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === "[object Date]"){
    if (isNaN(v.getTime())) return null;
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  var s = String(v).trim();
  if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Numero de diarias entre duas datas. */
function pcCalcDiarias_(entrada, saida){
  if (!entrada || !saida) return 0;
  var ms = saida.getTime() - entrada.getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / 86400000);
}

/**
 * Recalcula QTD_DIARIAS e VALOR_TOTAL das reservas com campos zerados.
 *
 * opcoes = {
 *   simular:        true  -> NAO grava nada, apenas devolve o relatorio (padrao)
 *   valorDiaria:    0     -> valor unitario da diaria a aplicar
 *   somenteZerados: true  -> so mexe em linhas com diarias OU valor zerado
 *   prefixo:        ""    -> se informado, so processa protocolos com esse prefixo
 *   recalcularValor:true  -> se false, corrige apenas as diarias
 * }
 */
function backfillDiariasValoresParqueChina(opcoes, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  opcoes = opcoes || {};
  var simular         = opcoes.simular !== false;
  var valorDiaria     = Number(opcoes.valorDiaria || 0);
  var somenteZerados  = opcoes.somenteZerados !== false;
  var prefixo         = String(opcoes.prefixo || "").toUpperCase();
  var recalcularValor = opcoes.recalcularValor !== false;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Sistema ocupado. Tente novamente em instantes.");

  try{
var alvo = pcResolverAbaReservas_();
    var aba  = alvo.aba;
    if (!aba) throw new Error("Aba de reservas nao encontrada. Abas disponiveis: "+
                              (alvo.abasDisponiveis||[]).join(", "));

    var dados = aba.getDataRange().getValues();
    if (dados.length < 2) return { ok:true, simulado:simular, total:0, alterados:0, linhas:[] };

    var cab = dados[0];
    var iProt    = pcIdxCol_(cab, ["ID_RESERVA","PROTOCOLO","ID","IDRESERVA"]);
    var iEntrada = pcIdxCol_(cab, ["DATA_ENTRADA","ENTRADA","CHECKIN","DATAENTRADA"]);
    var iSaida   = pcIdxCol_(cab, ["DATA_SAIDA","SAIDA","CHECKOUT","DATASAIDA"]);
    var iDiarias = pcIdxCol_(cab, ["QTD_DIARIAS","QUANTIDADE_DIARIAS","DIARIAS","NUM_DIARIAS"]);
    var iValor   = pcIdxCol_(cab, ["VALOR_TOTAL","VALORTOTAL","TOTAL","VALOR"]);

    var faltando = [];
    if (iEntrada < 0) faltando.push("DATA_ENTRADA");
    if (iSaida   < 0) faltando.push("DATA_SAIDA");
    if (iDiarias < 0) faltando.push("QTD_DIARIAS");
    if (recalcularValor && iValor < 0) faltando.push("VALOR_TOTAL");
    if (faltando.length){
      return { ok:false, mensagem:"Colunas nao localizadas: "+faltando.join(", ")+
               ". Cabecalho lido: "+cab.join(" | ") };
    }

    var relatorio = [], alterados = 0, ignorados = 0, semData = 0;

    for (var l=1; l<dados.length; l++){
      var linha = dados[l];
      var prot  = iProt >= 0 ? String(linha[iProt]||"") : ("linha "+(l+1));

      if (prefixo && prot.toUpperCase().indexOf(prefixo) !== 0){ ignorados++; continue; }

      var diariasAtual = Number(linha[iDiarias] || 0);
      var valorAtual   = recalcularValor ? Number(linha[iValor] || 0) : 0;

      if (somenteZerados && diariasAtual > 0 && (!recalcularValor || valorAtual > 0)){
        ignorados++; continue;
      }

      var dEnt = pcParaData_(linha[iEntrada]);
      var dSai = pcParaData_(linha[iSaida]);
      var novasDiarias = pcCalcDiarias_(dEnt, dSai);

      if (!novasDiarias){
        semData++;
        relatorio.push({ protocolo:prot, linha:l+1, situacao:"SEM_DATA_VALIDA",
                         entrada:String(linha[iEntrada]), saida:String(linha[iSaida]) });
        continue;
      }

      var novoValor = recalcularValor ? (novasDiarias * valorDiaria) : valorAtual;

      relatorio.push({
        protocolo:prot, linha:l+1, situacao:"AJUSTAR",
        diariasDe:diariasAtual, diariasPara:novasDiarias,
        valorDe:valorAtual, valorPara:novoValor
      });
      alterados++;

      if (!simular){
        aba.getRange(l+1, iDiarias+1).setValue(novasDiarias);
        if (recalcularValor) aba.getRange(l+1, iValor+1).setValue(novoValor);
      }
    }

    if (!simular) SpreadsheetApp.flush();

    return {
      ok:true, simulado:simular, valorDiaria:valorDiaria,
      total:dados.length-1, alterados:alterados,
      ignorados:ignorados, semDataValida:semData, linhas:relatorio
    };

  } finally {
    lock.releaseLock();
  }
}

/** Atalho: roda em modo simulacao e imprime o resumo no log. */
function simularBackfillParqueChina(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  var r = backfillDiariasValoresParqueChina({ simular:true, valorDiaria:0, prefixo:"PC-HIST-" });
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}
/** ID da planilha de producao do SISGEP. Ajuste aqui se mudar. */
var PC_PLANILHA_ID_BACKFILL = "1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E";

/**
 * Abre a planilha de forma tolerante: tenta a ativa (quando o script e bound)
 * e depois o ID fixo. Nao referencia constantes externas, entao nunca lanca
 * ReferenceError.
 */
function pcAbrirPlanilha_(){
  try{
    var ativa = SpreadsheetApp.getActiveSpreadsheet();
    if (ativa) return ativa;
  }catch(e){}
  return SpreadsheetApp.openById(PC_PLANILHA_ID_BACKFILL);
}

/**
 * Localiza a aba de reservas testando nomes conhecidos e, se falhar,
 * qualquer aba que contenha "reserva" e "china" no nome.
 */
function pcResolverAbaReservas_(){
  var ss = pcAbrirPlanilha_();
  var alvos = ["reservasparquechina","reservas_parque_china","reservasparque china",
               "parquechina","reservas parque china"];
  var norm = function(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,""); };

  var abas = ss.getSheets(), disponiveis = [];
  for (var i=0;i<abas.length;i++) disponiveis.push(abas[i].getName());

  for (var a=0;a<abas.length;a++){
    var n = norm(abas[a].getName());
    for (var t=0;t<alvos.length;t++){
      if (n === norm(alvos[t])) return { aba:abas[a], nome:abas[a].getName() };
    }
  }
  for (var b=0;b<abas.length;b++){
    var nb = norm(abas[b].getName());
    if (nb.indexOf("reserva") >= 0 && nb.indexOf("china") >= 0){
      return { aba:abas[b], nome:abas[b].getName() };
    }
  }
  return { aba:null, abasDisponiveis:disponiveis };
}

/** Diagnostico rapido: mostra a aba encontrada e o cabecalho lido. */
function inspecionarAbaReservasParqueChina(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  var r = pcResolverAbaReservas_();
  if (!r.aba){
    Logger.log("Aba nao encontrada. Abas disponiveis:\n" + r.abasDisponiveis.join("\n"));
    return r;
  }
  var cab = r.aba.getRange(1,1,1,r.aba.getLastColumn()).getValues()[0];
  var saida = { aba:r.nome, linhas:r.aba.getLastRow()-1, colunas:cab.length, cabecalho:cab };
  Logger.log(JSON.stringify(saida, null, 2));
  return saida;
}