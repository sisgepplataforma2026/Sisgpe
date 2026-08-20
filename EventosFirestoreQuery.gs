/** COMPASSO 2026 — consultas auxiliares Firestore. */
function fs_list_(collection, pageSize) {
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
  return out;
}

function fs_findByField_(collection, field, value, limit) {
  var docs = fs_list_(collection, 1000), out=[];
  for (var i=0;i<docs.length && out.length<(limit||50);i++) {
    if (String(docs[i][field] == null ? '' : docs[i][field]) === String(value == null ? '' : value)) out.push(docs[i]);
  }
  return out;
}
