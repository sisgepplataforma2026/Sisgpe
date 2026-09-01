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
// INSTALAÇÃO (uma vez, pelo editor do Apps Script):
//   instalarTriggerAniversariosRH()
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

function instalarTriggerAniversariosRH() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "verificarAniversariantesRH") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("verificarAniversariantesRH").timeBased().everyDays(1).atHour(8).create();
  Logger.log("✅ Trigger de aniversariantes do RH instalado — executa diariamente às 8h.");
  return { ok: true, mensagem: "Trigger de aniversariantes instalado com sucesso — executa diariamente às 8h." };
}

function removerTriggerAniversariosRH() {
  var removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "verificarAniversariantesRH") {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });
  return { ok: true, mensagem: removidos + " trigger(s) removido(s)." };
}
