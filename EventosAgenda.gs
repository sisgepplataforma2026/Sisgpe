// ================================
// ARQUIVO: EventosAgenda.gs
// MÓDULO: Agenda Operacional de Eventos
// ================================

var ABA_EVENTOS_AGENDA = "EVENTOS_AGENDA";

function agendaEventos_garantirEstrutura_() {
  // Regra canônica do SISGEP: nunca abrir planilha diretamente neste módulo.
  // planilhaSisgep_() respeita Produção/Homologação e evita divergência entre telas.
  var ss = planilhaSisgep_();
  var sh = ss.getSheetByName(ABA_EVENTOS_AGENDA);
  if (!sh) sh = ss.insertSheet(ABA_EVENTOS_AGENDA);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "NOME", "DATA", "TIPO", "STATUS", "CRIADO_POR", "CRIADO_EM", "ATUALIZADO_POR", "ATUALIZADO_EM"]);
    sh.getRange(1, 1, 1, 9).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function agendaEventos_gerarId_() { return "EVT-" + Utilities.getUuid().substring(0, 8).toUpperCase(); }
function agendaEventos_formatarData_(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v);
}

function eventos_obterWebAppUrl(tokenSessao) {
  exigirModulo_(tokenSessao, "eventos", false);
  var url = ScriptApp.getService().getUrl();
  if (!url) throw new Error("URL do Web App não disponível. Verifique a implantação de homologação.");
  return url;
}

// Diagnóstico operacional: permite confirmar em qual base a agenda está lendo.
function eventos_diagnosticoAgenda(tokenSessao) {
  exigirModulo_(tokenSessao, "eventos", false);
  var ss = planilhaSisgep_();
  var sh = ss.getSheetByName(ABA_EVENTOS_AGENDA);
  return {
    ambiente: (typeof getAmbienteAtual === "function" ? getAmbienteAtual() : "indefinido"),
    planilhaId: ss.getId(),
    planilhaNome: ss.getName(),
    abaExiste: !!sh,
    linhas: sh ? Math.max(0, sh.getLastRow() - 1) : 0
  };
}

function listarEventosAgenda(tokenSessao) {
  exigirModulo_(tokenSessao, "eventos", false);
  var sh = agendaEventos_garantirEstrutura_();
  if (sh.getLastRow() < 2) return [];
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return dados.map(function(linha) {
    var obj = {}; cab.forEach(function(col, i) { obj[col] = linha[i]; });
    return {id:String(obj.ID||""),nome:String(obj.NOME||""),data:agendaEventos_formatarData_(obj.DATA),tipo:String(obj.TIPO||"Outro"),status:String(obj.STATUS||"Planejado")};
  }).filter(function(x){return !!x.id;}).sort(function(a,b){return (a.data||"").localeCompare(b.data||"");});
}

function salvarEventoAgenda(dados, tokenSessao) {
  var sessao = exigirModulo_(tokenSessao, "eventos", false);
  try {
    dados=dados||{}; var nome=String(dados.nome||"").trim();
    if(!nome)return {ok:false,mensagem:"Informe o evento."};
    var sh=agendaEventos_garantirEstrutura_(),quem=sessao.nome||sessao.usuario||"SISGEP",agora=new Date(),idAlvo=String(dados.id||"").trim();
    if(idAlvo){var idsCol=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues():[];for(var i=0;i<idsCol.length;i++){if(String(idsCol[i][0])===idAlvo){var linha=i+2;sh.getRange(linha,2).setValue(nome);sh.getRange(linha,3).setValue(dados.data||"");sh.getRange(linha,4).setValue(dados.tipo||"Outro");sh.getRange(linha,5).setValue(dados.status||"Planejado");sh.getRange(linha,8).setValue(quem);sh.getRange(linha,9).setValue(agora);return {ok:true,id:idAlvo,mensagem:"Evento atualizado com sucesso."};}}}
    var novoId=agendaEventos_gerarId_();sh.appendRow([novoId,nome,dados.data||"",dados.tipo||"Outro",dados.status||"Planejado",quem,agora,quem,agora]);return {ok:true,id:novoId,mensagem:"Evento cadastrado com sucesso."};
  } catch(e){return {ok:false,mensagem:"Erro ao salvar evento: "+e.message};}
}

function excluirEventoAgenda(id, tokenSessao) {
  exigirModulo_(tokenSessao,"eventos",false);
  try {id=String(id||"").trim();if(!id)return {ok:false,mensagem:"Informe o evento a excluir."};var sh=agendaEventos_garantirEstrutura_();if(sh.getLastRow()<2)return {ok:false,mensagem:"Evento não encontrado."};var idsCol=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();for(var i=idsCol.length-1;i>=0;i--){if(String(idsCol[i][0])===id){sh.deleteRow(i+2);return {ok:true,mensagem:"Evento excluído com sucesso."};}}return {ok:false,mensagem:"Evento não encontrado."};} catch(e){return {ok:false,mensagem:"Erro ao excluir evento: "+e.message};}
}
