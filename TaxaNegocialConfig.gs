// ============================================================================
// SISGEP · TaxaNegocialConfig.gs
// Fases 1–2 — Fundação + integração segura com HOMOLOGAÇÃO
// ============================================================================

const TN_CONFIG = Object.freeze({
  MODULO: 'Documentos',
  SUBMODULO: 'Taxa Negocial',
  PLANILHA_HML_ESPERADA_ID: '1OGtjryOUagEgKMHjFaluiEgLnzZ11Ydc-PB-IdrHLMk',
  FUSO_HORARIO: 'America/Sao_Paulo',
  OTP: Object.freeze({ VALIDADE_SEG: 600, MAX_TENTATIVAS: 5, PREFIXO_CACHE: 'TN_OTP_' }),
  ABAS: Object.freeze({
    CAMPANHAS: 'TN_CAMPANHAS',
    OPOSICOES: 'TN_OPOSICOES',
    LOTES: 'TN_LOTES',
    TRABALHADORES: 'Associados',
    ESCOLAS: 'Escolas'
  }),
  STATUS_CAMPANHA: Object.freeze(['RASCUNHO', 'PROGRAMADA', 'ATIVA', 'ENCERRADA', 'ARQUIVADA']),
  STATUS_OPOSICAO: Object.freeze(['EM_PREENCHIMENTO', 'AGUARDANDO_CONFIRMACAO', 'REGISTRADA', 'CANCELADA', 'INVALIDADA']),
  STATUS_COMUNICACAO: Object.freeze(['NAO_AGRUPADA', 'EM_LOTE', 'OFICIO_GERADO', 'ENVIADA', 'CONFIRMADA'])
});

var TN_ALVO_HML_CACHE_ = null;
var TN_SS_CACHE_ = null;

function tnExigirHomologacaoSegura_() {
  if (TN_ALVO_HML_CACHE_) return TN_ALVO_HML_CACHE_;
  if (typeof documentosExigirHomologacaoSegura_ !== 'function') {
    throw new Error('Proteção de homologação de Documentos indisponível. Operação cancelada.');
  }
  var alvo = documentosExigirHomologacaoSegura_();
  if (!alvo || String(alvo.planilhaId || '') !== TN_CONFIG.PLANILHA_HML_ESPERADA_ID) {
    throw new Error('Taxa Negocial recusada: identidade da planilha HML não confere.');
  }
  TN_ALVO_HML_CACHE_ = alvo;
  return alvo;
}

function tnGetSpreadsheet_() {
  if (TN_SS_CACHE_) return TN_SS_CACHE_;
  var alvo = tnExigirHomologacaoSegura_();
  TN_SS_CACHE_ = SpreadsheetApp.openById(alvo.planilhaId);
  return TN_SS_CACHE_;
}

function tnGetSheet_(nome) {
  var sh = tnGetSpreadsheet_().getSheetByName(nome);
  if (!sh) throw new Error('Aba obrigatória não encontrada: ' + nome);
  return sh;
}

function tnAgora_() { return new Date(); }
function tnFormatarDataHora_(data) { return Utilities.formatDate(data || new Date(), TN_CONFIG.FUSO_HORARIO, 'dd/MM/yyyy HH:mm:ss'); }
function tnFormatarIsoLocal_(data) { return Utilities.formatDate(data || new Date(), TN_CONFIG.FUSO_HORARIO, "yyyy-MM-dd'T'HH:mm:ss"); }
function tnNormalizarCpf_(cpf) { return String(cpf || '').replace(/\D/g, ''); }
function tnNormalizarCnpj_(cnpj) { return String(cnpj || '').replace(/\D/g, ''); }
function tnNormalizarTexto_(v) { return String(v == null ? '' : v).trim(); }

function tnHashHex_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto || ''), Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    var n = (b < 0 ? b + 256 : b).toString(16);
    return n.length === 1 ? '0' + n : n;
  }).join('');
}

function tnGerarId_(prefixo) { return String(prefixo || 'TN') + '-' + Utilities.getUuid(); }

function tnValidarCpfBasico_(cpf) {
  var n = tnNormalizarCpf_(cpf);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  function dv(base, fator) {
    var soma = 0;
    for (var i = 0; i < base.length; i++) soma += Number(base[i]) * (fator - i);
    var r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  }
  return dv(n.slice(0, 9), 10) === Number(n[9]) && dv(n.slice(0, 10), 11) === Number(n[10]);
}

function tnSanitizarParaLog_(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  var copia = JSON.parse(JSON.stringify(obj));
  ['cpf', 'CPF', 'CPF_NORMALIZADO', 'otp', 'codigoOtp', 'codigo', 'otpHash'].forEach(function(k) {
    if (Object.prototype.hasOwnProperty.call(copia, k)) copia[k] = '[PROTEGIDO]';
  });
  return copia;
}
