/** COMPASSO 2026 — consultas auxiliares Firestore. */
function fs_list_(collection, pageSize) {
  if (typeof FS_METRICAS === 'object' && FS_METRICAS.ligado) FS_METRICAS.listagens++;
  pageSize = Math.min(Math.max(Number(pageSize || 500), 1), 1000);
  var out = [], token = '';
  do {
    var url = fs_baseUrl_() + '/' + encodeURIComponent(collection) + '?pageSize=' + pageSize;
    if (token) url += '&pageToken=' + encodeURIComponent(token);
    var resp = UrlFetchApp.fetch(url, {
      method:'get', headers:{Authorization:'Bearer '+fs_getAccessToken_()}, muteHttpExceptions:true
    });
    if (resp.getResponseCode() === 404) return [];
    if (resp.getResponseCode() >= 300) throw new Error('Erro ao listar '+collection+': '+resp.getContentText());
    var data = JSON.parse(resp.getContentText() || '{}');
    (data.documents || []).forEach(function(d){
      var obj = fs_fromFields_(d.fields || {});
      obj._docId = String(d.name || '').split('/').pop();
      out.push(obj);
    });
    token = data.nextPageToken || '';
  } while (token);
  /* O QUE CONTA PARA A COBRANÇA É DOCUMENTO, NÃO CHAMADA. Um fs_list_ de
     2.000 ingressos custa 2.000 leituras. Contar só a chamada esconderia
     justo a operação mais cara do sistema. */
  if (typeof FS_METRICAS === 'object' && FS_METRICAS.ligado) FS_METRICAS.docsLidos += out.length;
  return out;
}

function fs_findByField_(collection, field, value, limit) {
  if (typeof FS_METRICAS === 'object' && FS_METRICAS.ligado) FS_METRICAS.consultas++;
  var docs = fs_list_(collection, 1000), out=[];
  for (var i=0;i<docs.length && out.length<(limit||50);i++) {
    if (String(docs[i][field] == null ? '' : docs[i][field]) === String(value == null ? '' : value)) out.push(docs[i]);
  }
  return out;
}
