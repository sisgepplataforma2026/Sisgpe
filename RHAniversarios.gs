// ================================
// ARQUIVO: RHAniversarios.gs
// MÓDULO: RH — E-mail automático de aniversário (Fase 4 da auditoria)
//
// Roda diariamente (gatilho de horário, sem sessão de usuário — mesmo
// padrão de instalarTriggerAlertasD5 em Despesas.gs): verifica quem faz
// aniversário hoje entre os colaboradores ativos/em férias/afastados
// (não desligados) e, se tiver e-mail cadastrado, envia parabéns pela
// Central de E-mails.
//
// INSTALAÇÃO: pelo botão "🎂 Ativar/Desativar parabéns automático" nas
// Ferramentas administrativas do RH (RHAdmin.html). Não é mais preciso
// abrir o editor do Apps Script.
//
// SEGURANÇA (achado da auditoria do módulo RH): no Apps Script QUALQUER
// função global é chamável por google.script.run — inclusive quem só
// tem sessão de leitura. Os instaladores de trigger ficavam expostos sem
// nenhuma checagem, ou seja, qualquer usuário logado podia ligar ou
// DESLIGAR o envio automático sem deixar rastro. Agora o par público é
// rh_instalarTriggerAniversarios_publico / rh_removerTriggerAniversarios_publico
// (exigem administrador), e as versões com "_" no fim são internas —
// o Apps Script não as expõe ao cliente. Mesmo padrão já usado em
// RHTempoServico.gs (rh_instalarTriggerQuinquenioDecenio_publico).
// ================================

function verificarAniversariantesRH() {
  try {
    var hoje = new Date();
    var mesDia = Utilities.formatDate(hoje, Session.getScriptTimeZone(), "MM-dd");

    var colaboradores = listarColaboradoresRH_interno_().filter(function (c) {
      return c.status !== "Desligado" && c.aniversario && c.aniversario.slice(5, 10) === mesDia;
    });

    if (!colaboradores.length) {
      Logger.log("[RH] Nenhum aniversariante hoje (" + mesDia + ").");
      return { ok: true, enviados: 0 };
    }

    var enviados = 0;
    colaboradores.forEach(function (c) {
      if (!c.email) {
        Logger.log("[RH] " + c.nome + " faz aniversário hoje, mas não tem e-mail cadastrado — sem envio.");
        return;
      }
      try {
        if (rh_enviarEmailAniversario_(c)) enviados++;
      } catch (e) {
        Logger.log("[RH] falha ao enviar e-mail de aniversário para " + c.nome + ": " + e.message);
      }
    });

    Logger.log("[RH] Aniversariantes hoje: " + colaboradores.length + " · e-mails enviados: " + enviados);
    return { ok: true, enviados: enviados, aniversariantes: colaboradores.length };
  } catch (e) {
    Logger.log("[RH] verificarAniversariantesRH erro: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

function rh_enviarEmailAniversario_(colaborador) {
  var corpo = "<p>Olá, " + colaborador.nome + "!</p>" +
    "<p>Toda a equipe do SindEducação-ES deseja um feliz aniversário! 🎉</p>" +
    "<p>Que seu novo ano seja repleto de saúde, conquistas e realizações — obrigado por fazer parte do nosso time.</p>";

  var htmlBody = sind_emailHtml_("🎂 Feliz Aniversário!", corpo, "");
  var corpoTexto = "Feliz aniversário, " + colaborador.nome + "! Toda a equipe do SindEducação-ES deseja um ótimo dia.";

  var resultado = enviarEmailSISGEP_(colaborador.email, "🎂 Feliz Aniversário, " + colaborador.nome + "!", corpoTexto, {
    htmlBody: htmlBody,
    origem: "RH"
  });

  return !!(resultado && resultado.ok);
}

/* ================= TRIGGER: INSTALAR / REMOVER ================= */

// Núcleos internos ("_" no fim = o Apps Script não expõe a
// google.script.run). Continuam chamáveis pelo editor do Apps Script,
// que é o caminho de emergência quando a tela não está acessível.
function rh_instalarTriggerAniversarios_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "verificarAniversariantesRH") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("verificarAniversariantesRH").timeBased().everyDays(1).atHour(8).create();
  Logger.log("✅ Trigger de aniversariantes do RH instalado — executa diariamente às 8h.");
  return { ok: true, mensagem: "Parabéns automático ativado — o sistema verifica todo dia por volta das 8h e envia o e-mail para quem faz aniversário." };
}

function rh_removerTriggerAniversarios_() {
  var removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "verificarAniversariantesRH") {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });
  return { ok: true, mensagem: removidos ? "Parabéns automático desativado." : "Não estava ativo." };
}

// Ligar/desligar o envio automático muda o que o sindicato manda em nome
// dele para os colaboradores — é ação de administrador.
function rh_instalarTriggerAniversarios_publico(tokenSessao) {
  exigirModulo_(tokenSessao, "rh", true);
  try {
    return rh_instalarTriggerAniversarios_();
  } catch (e) {
    return { ok: false, mensagem: "Erro ao ativar o parabéns automático: " + e.message };
  }
}

function rh_removerTriggerAniversarios_publico(tokenSessao) {
  exigirModulo_(tokenSessao, "rh", true);
  try {
    return rh_removerTriggerAniversarios_();
  } catch (e) {
    return { ok: false, mensagem: "Erro ao desativar: " + e.message };
  }
}

function rh_statusTriggerAniversarios_publico(tokenSessao) {
  exigirModulo_(tokenSessao, "rh", false);
  var instalado = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === "verificarAniversariantesRH";
  });
  return { ok: true, instalado: instalado };
}
