const fs = require('fs');
const src = fs.readFileSync('EmailOficios.gs', 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(src.includes('OFICIOS_HML_EMAIL_PADRAO_TESTE = "financeiro@sindeducacao.com"'), 'allowlist HML da escola Teste ausente');
assert(src.includes('getProperty("SISGEP_HML_OFICIOS_ALLOWLIST")'), 'propriedade de allowlist adicional ausente');
assert(src.includes('if (ambiente === "homologacao")'), 'trava de homologacao ausente');
assert(src.includes('[HML] Envio bloqueado.'), 'mensagem de bloqueio HML ausente');
assert(src.includes('assuntoFinal = "[HML] " + assuntoFinal'), 'prefixo [HML] ausente');
assert(!src.includes('bcc:         "financeiro@sindeducacao.com"'), 'BCC financeiro ainda presente');
assert(src.includes('OFICIOS_EMAIL_INSTITUCIONAL = "secretaria@sindeducacao.com"'), 'remetente institucional incorreto');
assert(src.includes('obterAnexosOriginaisFilaOficio_'), 'reconstrucao de anexos do reenvio ausente');
assert(src.includes('"FILA_ENVIO_OFICIOS"'), 'reenvio nao consulta fila original');
assert(src.includes('JSON.parse(json)'), 'reenvio nao le ANEXOS_JSON');

// Checagem sintatica simples para Apps Script: .gs e JavaScript V8.
new Function(src);
console.log('OK: politica HML de e-mail e sintaxe de EmailOficios.gs validadas.');
