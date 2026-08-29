// ============================================================================
// SISGEP · TaxaNegocialConfig.gs
// Fase 1 — Fundação técnica (HOMOLOGAÇÃO SOMENTE)
// ============================================================================

const TN_CONFIG = Object.freeze({
  MODULO: 'Taxa Negocial',
  SUBMODULO: 'Oposições',
  // HML ATIVA — cópia da produção de 18/08/2026.
  // Guard-rail proposital: nesta fase o módulo NÃO aponta para produção.
  PLANILHA_HML_ID: '1OGtjryOUagEgKMHjFaluiEgLnzZ11Ydc-PB-IdrHLMk',
  FUSO_HORARIO: 'America/Sao_Paulo',
  ABAS: Object.freeze({
    CAMPANHAS: 'TN_CAMPANHAS',
    OPOSICOES: 'TN_OPOSICOES',
    LOTES: 'TN_LOTES',
    TRABALHADORES: 'Associados',
    ESCOLAS: 'Escolas',
    AUDITORIA: 'SISGEP_Auditoria'
  }),
  STATUS_CAMPANHA: Object.freeze([
    'RASCUNHO', 'PROGRAMADA', 'ATIVA', 'ENCERRADA', 'ARQUIVADA'
  ]),
  STATUS_OPOSICAO: Object.freeze([
    'EM_PREENCHIMENTO', 'AGUARDANDO_CONFIRMACAO', 'REGISTRADA',
    'CANCELADA', 'INVALIDADA'
  ]),
  STATUS_COMUNICACAO: Object.freeze([
    'NAO_AGRUPADA', 'EM_LOTE', 'OFICIO_GERADO', 'ENVIADA', 'CONFIRMADA'
  ])
});

function tnGetSpreadsheet_() {
  return SpreadsheetApp.openById(TN_CONFIG.PLANILHA_HML_ID);
}

function tnGetSheet_(nome) {
  const sh = tnGetSpreadsheet_().getSheetByName(nome);
  if (!sh) throw new Error('Aba obrigatória não encontrada: ' + nome);
  return sh;
}

function tnAgora_() {
  return new Date();
}

function tnFormatarDataHora_(data) {
  return Utilities.formatDate(data || new Date(), TN_CONFIG.FUSO_HORARIO, 'dd/MM/yyyy HH:mm:ss');
}

function tnFormatarIsoLocal_(data) {
  return Utilities.formatDate(data || new Date(), TN_CONFIG.FUSO_HORARIO, "yyyy-MM-dd'T'HH:mm:ss");
}

function tnNormalizarCpf_(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

function tnNormalizarCnpj_(cnpj) {
  return String(cnpj || '').replace(/\D/g, '');
}

function tnNormalizarTexto_(v) {
  return String(v == null ? '' : v).trim();
}

function tnHashHex_(texto) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(texto || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    const n = (b < 0 ? b + 256 : b).toString(16);
    return n.length === 1 ? '0' + n : n;
  }).join('');
}

function tnGerarId_(prefixo) {
  return String(prefixo || 'TN') + '-' + Utilities.getUuid();
}

function tnValidarCpfBasico_(cpf) {
  const n = tnNormalizarCpf_(cpf);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  function dv(base, fator) {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (fator - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  }
  return dv(n.slice(0, 9), 10) === Number(n[9]) &&
         dv(n.slice(0, 10), 11) === Number(n[10]);
}

function tnSanitizarParaLog_(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const copia = JSON.parse(JSON.stringify(obj));
  ['cpf', 'CPF', 'CPF_NORMALIZADO', 'otp', 'codigoOtp', 'codigo'].forEach(function(k) {
    if (Object.prototype.hasOwnProperty.call(copia, k)) copia[k] = '[PROTEGIDO]';
  });
  return copia;
}
