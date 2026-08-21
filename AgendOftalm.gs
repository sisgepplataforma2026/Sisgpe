/* =========================================================
   AgendaOftalmo.gs — Agendamento de Oftalmologia SISGEP
   Versão Premium Inteligente
   ========================================================= */

var SHEET_OFTALMO = 'Agend_Oftalmo';
var SHEET_LOG_OFTALMO = 'Log_Agend_Oftalmo';

var HORA_INICIO_OFTALMO = 8 * 60;
var HORA_FIM_OFTALMO    = 17 * 60;
var INTERVALO_OFTALMO   = 15;

var STATUS_OFTALMO = {
  LIVRE: 'LIVRE',
  ATIVO: 'ATIVO',
  CANCELADO: 'CANCELADO',
  COMPARECEU: 'COMPARECEU',
  FALTOU: 'FALTOU',
  REAGENDADO: 'REAGENDADO'
};

/* =========================================================
   PLANILHA
========================================================= */

function getPlanilhaOftalmoId_() {

  if (
    typeof PLANILHAS !== 'undefined' &&
    PLANILHAS.PRODUCAO
  ) {

    return (
      typeof getAmbienteAtual === 'function' &&
      getAmbienteAtual() === 'homologacao'
    )
      ? PLANILHAS.HOMOLOGACAO
      : PLANILHAS.PRODUCAO;
  }

  if (
    typeof PLANILHA_ID !== 'undefined' &&
    PLANILHA_ID
  ) {
    return PLANILHA_ID;
  }

  return PropertiesService
    .getScriptProperties()
    .getProperty('PLANILHA_ID');
}

/* =========================================================
   SLOTS
========================================================= */

function gerarSlotsOftalmo_() {

  var slots = [];

  for (
    var m = HORA_INICIO_OFTALMO;
    m < HORA_FIM_OFTALMO;
    m += INTERVALO_OFTALMO
  ) {

    var h = Math.floor(m / 60);
    var min = m % 60;

    slots.push(
      String(h).padStart(2, '0') +
      ':' +
      String(min).padStart(2, '0')
    );
  }

  return slots;
}

/* =========================================================
   ABAS
========================================================= */

function obterAbaOftalmo_() {

  var ss = SpreadsheetApp.openById(
    getPlanilhaOftalmoId_()
  );

  var aba = ss.getSheetByName(
    SHEET_OFTALMO
  );

  if (!aba) {

    aba = ss.insertSheet(
      SHEET_OFTALMO
    );

    aba.appendRow([
      'ID',
      'Data',
      'Hora',
      'Tipo',
      'CPF_Titular',
      'Nome_Titular',
      'CPF_Beneficiario',
      'Nome_Beneficiario',
      'DataNasc_Beneficiario',
      'Parentesco',
      'Telefone',
      'Email',
      'Escola',
      'Reservado',
      'Compareceu',
      'Status',
      'DataCriacao',
      'UsuarioCriacao',
      'Observacao'
    ]);
  }

  return aba;
}

/* =========================================================
   LOG
========================================================= */

function obterAbaLogOftalmo_() {

  var ss = SpreadsheetApp.openById(
    getPlanilhaOftalmoId_()
  );

  var aba = ss.getSheetByName(
    SHEET_LOG_OFTALMO
  );

  if (!aba) {

    aba = ss.insertSheet(
      SHEET_LOG_OFTALMO
    );

    aba.appendRow([
      'DataHora',
      'Usuario',
      'Acao',
      'ID_Agendamento',
      'Detalhes'
    ]);
  }

  return aba;
}

function registrarLogOftalmo_(
  acao,
  id,
  detalhes
) {

  try {

    var aba = obterAbaLogOftalmo_();

    aba.appendRow([
      new Date(),
      Session.getActiveUser().getEmail(),
      acao,
      id,
      JSON.stringify(detalhes || {})
    ]);

  } catch(e) {

    Logger.log(e);

  }
}

/* =========================================================
   HELPERS
========================================================= */

function obterIdxOftalmo_(headers) {

  var idx = {};

  headers.forEach(function(h, i) {
    idx[h] = i;
  });

  return idx;
}

function formatarDataOftalmo_(valor) {

  if (valor instanceof Date) {

    return Utilities.formatDate(
      valor,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy'
    );
  }

  return String(valor || '').trim();
}

function normalizarCPF(cpf) {

  return String(cpf || '')
    .replace(/\D/g, '');
}

function validarCPF(cpf) {

  cpf = normalizarCPF(cpf);

  if (
    cpf.length !== 11 ||
    /^(\d)\1+$/.test(cpf)
  ) {
    return false;
  }

  var soma = 0;
  var resto;

  for (var i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }

  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) {
    resto = 0;
  }

  if (resto !== parseInt(cpf.substring(9, 10))) {
    return false;
  }

  soma = 0;

  for (var j = 1; j <= 10; j++) {
    soma += parseInt(cpf.substring(j - 1, j)) * (12 - j);
  }

  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) {
    resto = 0;
  }

  return resto === parseInt(cpf.substring(10, 11));
}

/* =========================================================
   CADASTRO INTELIGENTE
========================================================= */

function validarAssociadoOftalmo(cpf, tokenSessao) {

  exigirModulo_(tokenSessao, "beneficios", false);

  try {

    cpf = normalizarCPF(cpf);

    if (!validarCPF(cpf)) {

      return {
        ok: false,
        valido: false,
        erro: 'CPF inválido.'
      };
    }

    var ss = SpreadsheetApp.openById(
      getPlanilhaOftalmoId_()
    );

    var aba = ss.getSheetByName(
      'Associados'
    );

    /* =========================================
       MODO FUTURO (com cadastro)
    ========================================= */

    if (aba) {

      var dados = aba.getDataRange().getValues();

      var headers = dados[0];

      var idx = {};

      headers.forEach(function(h, i) {
        idx[h] = i;
      });

      for (var i = 1; i < dados.length; i++) {

        var row = dados[i];

        var cpfRow = normalizarCPF(
          row[idx['CPF']]
        );

        if (cpfRow === cpf) {

          return {
            ok: true,
            valido: true,
            encontrado: true,
            modoManual: false,

            nome:
              row[idx['Nome']] || '',

            telefone:
              row[idx['Telefone']] || '',

            email:
              row[idx['Email']] || '',

            escola:
              row[idx['Escola']] || '',

            situacao:
              row[idx['Situacao']] || 'ATIVO'
          };
        }
      }
    }

    /* =========================================
       MODO MANUAL
    ========================================= */

    return {
      ok: true,
      valido: true,
      encontrado: false,
      modoManual: true,
      aviso:
        'CPF válido. Cadastro manual liberado.'
    };

  } catch(e) {

    return {
      ok: false,
      erro: e.message || String(e)
    };
  }
}

/* =========================================================
   LISTAR HORÁRIOS
========================================================= */

function listarHorariosOftalmo(dataStr, tokenSessao) {

  exigirModulo_(tokenSessao, "beneficios", false);

  try {

    var aba = obterAbaOftalmo_();

    var slots = gerarSlotsOftalmo_();

    var dados = aba.getDataRange().getValues();

    var idx = obterIdxOftalmo_(dados[0]);

    var reservas = {};

    for (var i = 1; i < dados.length; i++) {

      var row = dados[i];

      var status = String(
        row[idx['Status']] || ''
      ).trim();

      if (status === STATUS_OFTALMO.CANCELADO) {
        continue;
      }

      var dataRow = formatarDataOftalmo_(
        row[idx['Data']]
      );

      if (dataRow !== dataStr) {
        continue;
      }

    var hora = formatarHoraOftalmo_(row[idx['Hora']]);

      reservas[hora] = {

        id:
          String(row[idx['ID']] || ''),

        hora: hora,

        tipo:
          String(row[idx['Tipo']] || ''),

        cpfTitular:
          String(row[idx['CPF_Titular']] || ''),

        nomeTitular:
          String(row[idx['Nome_Titular']] || ''),

        cpfBeneficiario:
          String(row[idx['CPF_Beneficiario']] || ''),

        nomeBeneficiario:
          String(row[idx['Nome_Beneficiario']] || ''),

        dataNasc:
          String(row[idx['DataNasc_Beneficiario']] || ''),

        parentesco:
          String(row[idx['Parentesco']] || ''),

        telefone:
          String(row[idx['Telefone']] || ''),

        email:
          String(row[idx['Email']] || ''),

        escola:
          String(row[idx['Escola']] || ''),

        reservado:
          row[idx['Reservado']] === true,

        compareceu:
          row[idx['Compareceu']] === true,

        status:
          status || STATUS_OFTALMO.ATIVO,

        livre: false
      };
    }

    var resultado = slots.map(function(hora) {

      if (reservas[hora]) {
        return reservas[hora];
      }

      return {

        id:
          'LIVRE-' +
          dataStr.replace(/\D/g, '') +
          '-' +
          hora.replace(':', ''),

        hora: hora,

        livre: true,

        reservado: false,

        compareceu: false,

        status: STATUS_OFTALMO.LIVRE
      };
    });

    resultado.sort(function(a, b) {
      return String(a.hora).localeCompare(
        String(b.hora)
      );
    });

    return {
      ok: true,
      slots: resultado,

      total: resultado.length,

      reservados:
        resultado.filter(function(s) {
          return !s.livre;
        }).length,

      livres:
        resultado.filter(function(s) {
          return s.livre;
        }).length,

      compareceram:
        resultado.filter(function(s) {
          return s.compareceu;
        }).length
    };

  } catch(e) {

    return {
      ok: false,
      erro: e.message || String(e)
    };
  }
}

/* =========================================================
   RESERVAR
========================================================= */

function reservarHorarioOftalmo(dados, tokenSessao) {

  exigirModulo_(tokenSessao, "beneficios", false);

  var lock = LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    var aba = obterAbaOftalmo_();
    var all = aba.getDataRange().getValues();
    var idx = obterIdxOftalmo_(all[0]);

    /* =========================================
       DUPLICIDADE
    ========================================= */

    for (var i = 1; i < all.length; i++) {

      var row = all[i];

      var status = String(row[idx['Status']] || '').trim();

      if (status === STATUS_OFTALMO.CANCELADO) continue;

      var dataRow = formatarDataOftalmo_(row[idx['Data']]);
      var horaRow = formatarHoraOftalmo_(row[idx['Hora']]);
      var cpfRow  = normalizarCPF(row[idx['CPF_Titular']]);

      if (dataRow === dados.data && horaRow === dados.hora) {
        return { ok: false, erro: 'Este horário já está reservado.' };
      }

      if (
        cpfRow &&
        cpfRow === normalizarCPF(dados.cpfTitular) &&
        status !== STATUS_OFTALMO.CANCELADO
      ) {
        return { ok: false, erro: 'Este CPF já possui agendamento.' };
      }
    }

    var id = Utilities.getUuid();

    aba.appendRow([
      id,
      dados.data        || '',
      dados.hora        || '',
      dados.tipo        || '',
      dados.cpfTitular  || '',
      dados.nomeTitular || '',
      dados.cpfBeneficiario  || '',
      dados.nomeBeneficiario || '',
      dados.dataNasc    || '',
      dados.parentesco  || '',
      dados.telefone    || '',
      dados.email       || '',
      dados.escola      || '',
      true,
      false,
      STATUS_OFTALMO.ATIVO,
      new Date(),
      Session.getActiveUser().getEmail(),
      ''
    ]);

    // ✅ Força coluna Hora como texto puro — evita conversão para Date pelo Sheets
    var ultimaLinha = aba.getLastRow();
    var colunaHora  = idx['Hora'] + 1;
    aba.getRange(ultimaLinha, colunaHora)
       .setNumberFormat('@STRING@')
       .setValue(dados.hora || '');

    registrarLogOftalmo_('RESERVA', id, dados);

    return {
      ok: true,
      id: id,
      mensagem: 'Agendamento realizado com sucesso.'
    };

  } catch(e) {

    return { ok: false, erro: e.message || String(e) };

  } finally {

    try { lock.releaseLock(); } catch(err) {}
  }
}

/* =========================================================
   AUTOATENDIMENTO PÚBLICO (Portal do Associado)
   Sem sessão do SISGEP — a trava de acesso é a "data liberada":
   só existe um dia aberto por vez (normalmente 1 por mês),
   definido pela equipe em AgendOftalmo.html. Mesma aba, mesmo
   LockService e mesmas regras de duplicidade que
   reservarHorarioOftalmo já usa — o mesmo lock cobre os dois
   caminhos (equipe pelo admin e associado pelo Portal), então
   não existe brecha de concorrência entre eles.
========================================================= */

function obterDataLiberadaOftalmo() {
  var data = String(
    PropertiesService.getScriptProperties().getProperty('OFTALMO_DATA_LIBERADA') || ''
  ).trim();
  return { ok: true, data: data };
}

function definirDataLiberadaOftalmo(dataStr, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  dataStr = String(dataStr || '').trim();
  if (dataStr && !/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
    return { ok: false, erro: 'Data inválida. Use o formato dd/mm/aaaa.' };
  }
  PropertiesService.getScriptProperties().setProperty('OFTALMO_DATA_LIBERADA', dataStr);
  registrarLogOftalmo_('DATA_LIBERADA_DEFINIDA', '', { data: dataStr });
  return { ok: true, data: dataStr };
}

// Mesmo formato de retorno de listarHorariosOftalmo, mas nunca expõe nome,
// CPF, telefone ou e-mail de quem já reservou outros horários — só
// hora + livre/ocupado, o suficiente para o associado escolher um horário.
function listarHorariosOftalmoPublico(dataStr) {
  try {
    dataStr = String(dataStr || '').trim();
    var liberada = String(
      PropertiesService.getScriptProperties().getProperty('OFTALMO_DATA_LIBERADA') || ''
    ).trim();
    if (!liberada || !dataStr || dataStr !== liberada) {
      return { ok: false, erro: 'Não há atendimento liberado nesta data.' };
    }

    var aba = obterAbaOftalmo_();
    var slots = gerarSlotsOftalmo_();
    var dados = aba.getDataRange().getValues();
    var idx = obterIdxOftalmo_(dados[0]);
    var ocupados = {};

    for (var i = 1; i < dados.length; i++) {
      var row = dados[i];
      var status = String(row[idx['Status']] || '').trim();
      if (status === STATUS_OFTALMO.CANCELADO) continue;
      var dataRow = formatarDataOftalmo_(row[idx['Data']]);
      if (dataRow !== dataStr) continue;
      ocupados[formatarHoraOftalmo_(row[idx['Hora']])] = true;
    }

    var resultado = slots.map(function(hora) {
      return { hora: hora, livre: !ocupados[hora] };
    });

    return {
      ok: true,
      data: dataStr,
      slots: resultado,
      livres: resultado.filter(function(s) { return s.livre; }).length
    };
  } catch (e) {
    return { ok: false, erro: e.message || String(e) };
  }
}

function reservarHorarioOftalmoPublico(dados) {
  dados = dados || {};
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    var liberada = String(
      PropertiesService.getScriptProperties().getProperty('OFTALMO_DATA_LIBERADA') || ''
    ).trim();
    if (!liberada || dados.data !== liberada) {
      return { ok: false, erro: 'Não há atendimento liberado nesta data.' };
    }
    if (gerarSlotsOftalmo_().indexOf(dados.hora) === -1) {
      return { ok: false, erro: 'Horário inválido.' };
    }
    if (!validarCPF(dados.cpfTitular)) {
      return { ok: false, erro: 'Informe um CPF válido do titular.' };
    }
    if (!String(dados.nomeTitular || '').trim()) {
      return { ok: false, erro: 'Informe o nome do titular.' };
    }
    if (!String(dados.telefone || '').trim()) {
      return { ok: false, erro: 'Informe um telefone de contato.' };
    }
    var tipo = dados.tipo === 'DEPENDENTE' ? 'DEPENDENTE' : 'TRABALHADOR';
    if (tipo === 'DEPENDENTE') {
      if (!String(dados.nomeBeneficiario || '').trim()) {
        return { ok: false, erro: 'Informe o nome do dependente.' };
      }
      if (!String(dados.dataNasc || '').trim()) {
        return { ok: false, erro: 'Informe a data de nascimento do dependente.' };
      }
    }

    var aba = obterAbaOftalmo_();
    var all = aba.getDataRange().getValues();
    var idx = obterIdxOftalmo_(all[0]);

    for (var i = 1; i < all.length; i++) {
      var row = all[i];
      var status = String(row[idx['Status']] || '').trim();
      if (status === STATUS_OFTALMO.CANCELADO) continue;

      var dataRow = formatarDataOftalmo_(row[idx['Data']]);
      var horaRow = formatarHoraOftalmo_(row[idx['Hora']]);
      var cpfRow  = normalizarCPF(row[idx['CPF_Titular']]);

      if (dataRow === dados.data && horaRow === dados.hora) {
        return { ok: false, erro: 'Este horário acabou de ser reservado por outra pessoa. Atualize a página e escolha outro.' };
      }
      if (cpfRow && cpfRow === normalizarCPF(dados.cpfTitular)) {
        return { ok: false, erro: 'Este CPF já possui agendamento.' };
      }
    }

    var id = Utilities.getUuid();
    var cpfBeneficiario = tipo === 'DEPENDENTE' ? normalizarCPF(dados.cpfBeneficiario) : normalizarCPF(dados.cpfTitular);
    var nomeBeneficiario = tipo === 'DEPENDENTE' ? String(dados.nomeBeneficiario || '').trim() : String(dados.nomeTitular || '').trim();

    aba.appendRow([
      id,
      dados.data,
      dados.hora,
      tipo,
      normalizarCPF(dados.cpfTitular),
      String(dados.nomeTitular || '').trim(),
      cpfBeneficiario,
      nomeBeneficiario,
      dados.dataNasc || '',
      dados.parentesco || '',
      dados.telefone || '',
      dados.email || '',
      dados.escola || '',
      true,
      false,
      STATUS_OFTALMO.ATIVO,
      new Date(),
      'portal-associado',
      ''
    ]);

    var ultimaLinha = aba.getLastRow();
    var colunaHora  = idx['Hora'] + 1;
    aba.getRange(ultimaLinha, colunaHora)
       .setNumberFormat('@STRING@')
       .setValue(dados.hora || '');

    registrarLogOftalmo_('RESERVA_PORTAL', id, { data: dados.data, hora: dados.hora, tipo: tipo });

    return {
      ok: true,
      id: id,
      mensagem: 'Agendamento realizado com sucesso.'
    };

  } catch(e) {

    return { ok: false, erro: e.message || String(e) };

  } finally {

    try { lock.releaseLock(); } catch(err) {}
  }
}

/* =========================================================
   CANCELAR
========================================================= */
function cancelarHorarioOftalmo(id, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var aba   = obterAbaOftalmo_();
    var dados = aba.getDataRange().getValues();
    var idx   = obterIdxOftalmo_(dados[0]);

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][idx['ID']]) === String(id)) {
        aba.getRange(i + 1, idx['Status'] + 1).setValue(STATUS_OFTALMO.CANCELADO);
        registrarLogOftalmo_('CANCELAMENTO', id, {});
        return { ok: true };
      }
    }

    return { ok: false, erro: 'Agendamento não encontrado.' };
  } catch(e) {
    return { ok: false, erro: e.message || String(e) };
  }
}

/* =========================================================
   MARCAR COMPARECEU
========================================================= */
function marcarCompareceuOftalmo(id, compareceu, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var aba   = obterAbaOftalmo_();
    var dados = aba.getDataRange().getValues();
    var idx   = obterIdxOftalmo_(dados[0]);

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][idx['ID']]) === String(id)) {
        aba.getRange(i + 1, idx['Compareceu'] + 1).setValue(compareceu === true);
        if (compareceu) {
          aba.getRange(i + 1, idx['Status'] + 1).setValue(STATUS_OFTALMO.COMPARECEU);
        } else {
          aba.getRange(i + 1, idx['Status'] + 1).setValue(STATUS_OFTALMO.ATIVO);
        }
        registrarLogOftalmo_(
          compareceu ? 'COMPARECEU' : 'DESFEZ_COMPARECIMENTO',
          id, {}
        );
        return { ok: true };
      }
    }

    return { ok: false, erro: 'Agendamento não encontrado.' };
  } catch(e) {
    return { ok: false, erro: e.message || String(e) };
  }
}

/* =========================================================
   ENVIAR E-MAIL DE CONFIRMAÇÃO
========================================================= */
function enviarEmailConfirmacaoOftalmo(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var email = String(dados.email || '').trim();
    if (!email) return { ok: false, erro: 'E-mail não informado.' };

    var nome = dados.tipo === 'DEPENDENTE'
      ? (dados.nomeBeneficiario || dados.nomeTitular)
      : dados.nomeTitular;

    var assunto = 'Confirmação de Agendamento — Oftalmologia | SindEducação-ES';

    var saudacao = (typeof saudacaoHoraBR_ === 'function')
      ? saudacaoHoraBR_()
      : (function(){
          var h = new Date().getHours();
          return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
        })();

    var corpo =
      '<div style="font-family:Segoe UI,Arial,sans-serif;padding:30px;line-height:1.6;max-width:700px;color:#0f172a;">' +

        '<h2 style="color:#003366;margin:0 0 6px 0;">Agendamento de Oftalmologia</h2>' +
        '<p style="margin:0 0 16px 0;"><strong>Data:</strong> ' + (dados.data || '') + ' · <strong>Horário:</strong> ' + (dados.hora || '') + '</p>' +

        '<p style="margin:0 0 14px 0;">' + saudacao + '! Tudo bem?</p>' +

        '<p style="margin:0 0 14px 0;text-align:justify;">' +
          'Confirmamos o seu agendamento de oftalmologia realizado pelo <strong>SindEducação-ES</strong>.' +
        '</p>' +

        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:20px 0;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">' +
            '<tr><td style="padding:7px 0;font-weight:700;width:140px;">📅 Data:</td><td>' + (dados.data || '') + '</td></tr>' +
            '<tr><td style="padding:7px 0;font-weight:700;">🕐 Horário:</td><td>' + (dados.hora || '') + '</td></tr>' +
            '<tr><td style="padding:7px 0;font-weight:700;">👤 Paciente:</td><td>' + (nome || '') + '</td></tr>' +
            '<tr><td style="padding:7px 0;font-weight:700;">🔖 Tipo:</td><td>' + (dados.tipo || 'TRABALHADOR') + '</td></tr>' +
            '<tr><td style="padding:7px 0;font-weight:700;">📞 Telefone:</td><td>' + (dados.telefone || '') + '</td></tr>' +
            '<tr><td style="padding:7px 0;font-weight:700;">🏫 Escola:</td><td>' + (dados.escola || '') + '</td></tr>' +
          '</table>' +
        '</div>' +

        '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px 20px;margin:0 0 20px 0;">' +
          '<p style="margin:0 0 10px 0;font-weight:800;color:#1d4ed8;font-size:14px;">🏥 Local de Atendimento</p>' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">' +
            '<tr><td style="padding:5px 0;font-weight:700;width:140px;">Clínica:</td><td><strong>Vila Medic — Medicina &amp; Odontologia</strong></td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Endereço:</td><td>Av. Champagnat, 1033 — Centro<br>Vila Velha/ES · CEP 29100-011</td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Telefone:</td><td>(27) 99973-3077 | (27) 3063-9090</td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">WhatsApp:</td><td>(27) 99854-0712</td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">E-mail:</td><td>contato@vilamedic.com.br</td></tr>' +
          '</table>' +
        '</div>' +

        '<p style="margin:14px 0 0 0;"><strong>📌 Orientações para o dia do atendimento:</strong></p>' +
        '<ol style="padding-left:18px;margin:10px 0 16px 0;color:#334155;">' +
          '<li>Compareça com antecedência ao local de atendimento;</li>' +
          '<li>Leve documento de identificação com foto e CPF;</li>' +
          '<li>Em caso de impossibilidade de comparecer, avise-nos com antecedência.</li>' +
        '</ol>' +

        '<p style="margin:14px 0 0 0;">Qualquer dúvida, permanecemos à disposição.</p>' +

        '<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">' +

        '<p style="line-height:1.8;margin:0;">' +
          '<strong>Financeiro &amp; Cobrança</strong><br>' +
          'SindEducação-ES<br>' +
          '(27) 99813-5965 | (27) 3222-2706<br>' +
          'financeiro@sindeducacao.com<br>' +
          'secretaria@sindeducacao.com' +
        '</p>' +

      '</div>';

    MailApp.sendEmail({
      to:       email,
      subject:  assunto,
      htmlBody: corpo,
      name:     'SindEducação-ES',
      replyTo:  'secretaria@sindeducacao.com',
      bcc:      'financeiro@sindeducacao.com'
    });

    try {
      registrarLogOftalmo_('EMAIL_CONFIRMACAO_ENVIADO', dados.id || '', { email: email });
    } catch(logErr) {
      Logger.log('⚠ Falha ao registrar log: ' + logErr.message);
    }

    return { ok: true };
  } catch(e) {
    return { ok: false, erro: e.message || String(e) };
  }
}
/* =========================================================
   BUSCAR HISTÓRICO
========================================================= */
function buscarAgendamentosOftalmo(filtros, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var aba       = obterAbaOftalmo_();
    var dados     = aba.getDataRange().getValues();
    var idx       = obterIdxOftalmo_(dados[0]);
    var resultado = [];

    for (var i = 1; i < dados.length; i++) {
      var row = dados[i];
      if (!row[idx['ID']]) continue;

      var status   = String(row[idx['Status']] || '');
      var dataFmt  = formatarDataOftalmo_(row[idx['Data']]);

      if (filtros && filtros.status && filtros.status !== 'TODOS' && status !== filtros.status) continue;
      if (filtros && filtros.dataInicio && filtros.dataInicio && dataFmt < filtros.dataInicio) continue;
      if (filtros && filtros.dataFim    && filtros.dataFim    && dataFmt > filtros.dataFim)    continue;

      resultado.push({
        id:               String(row[idx['ID']]                    || ''),
        data:             dataFmt,
       hora: formatarHoraOftalmo_(row[idx['Hora']]),
        tipo:             String(row[idx['Tipo']]                  || ''),
        cpfTitular:       String(row[idx['CPF_Titular']]           || ''),
        nomeTitular:      String(row[idx['Nome_Titular']]          || ''),
        cpfBeneficiario:  String(row[idx['CPF_Beneficiario']]      || ''),
        nomeBeneficiario: String(row[idx['Nome_Beneficiario']]     || ''),
        dataNasc:         String(row[idx['DataNasc_Beneficiario']] || ''),
        parentesco:       String(row[idx['Parentesco']]            || ''),
        telefone:         String(row[idx['Telefone']]              || ''),
        email:            String(row[idx['Email']]                 || ''),
        escola:           String(row[idx['Escola']]                || ''),
        compareceu:       row[idx['Compareceu']] === true || row[idx['Compareceu']] === 'TRUE',
        status:           status,
        dataCriacao:      String(row[idx['DataCriacao']]           || '')
      });
    }

    return { ok: true, agendamentos: resultado };
  } catch(e) {
    return { ok: false, erro: e.message || String(e) };
  }
}
/* =========================================================
   ENVIAR RELATÓRIO DA AGENDA DO DIA
========================================================= */
function enviarRelatorioAgendaOftalmo(dados, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  try {
    var emailClinica = PropertiesService.getScriptProperties()
      .getProperty('EMAIL_CLINICA_OFTALMO') || '';

    if (!emailClinica) return { ok: false, erro: 'E-mail da clínica não configurado.' };

    var data         = dados.data || '';
    var agendamentos = dados.agendamentos || [];
    var total        = agendamentos.length;

    function fmtCPF(cpf) {
      var v = String(cpf || '').replace(/\D/g, '').padStart(11, '0');
      return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }

    var linhas = agendamentos.map(function(a, i) {
      var nome = a.tipo === 'DEPENDENTE'
        ? (a.nomeBeneficiario || a.nomeTitular)
        : a.nomeTitular;
      var cpf = a.tipo === 'DEPENDENTE'
        ? (a.cpfBeneficiario || a.cpfTitular)
        : a.cpfTitular;
      var tipoBadge = a.tipo === 'DEPENDENTE'
        ? '<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">Dependente</span>'
        : '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">Trabalhador</span>';
      var nomeCell = nome || '—';
      if (a.tipo === 'DEPENDENTE' && a.nomeTitular) {
        nomeCell += '<br><span style="font-size:11px;color:#64748b;">Dep. de: ' + a.nomeTitular + (a.parentesco ? ' (' + a.parentesco + ')' : '') + '</span>';
      }
      var bg = i % 2 === 0 ? '#fff' : '#f8fafc';
      return '<tr style="background:' + bg + ';">' +
        '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:700;">' + (a.hora || '—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + nomeCell + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + fmtCPF(cpf) + '</td>' +
     '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + (a.telefone || '—') + '</td>' +
'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + (a.escola || '—') + '</td>' +
'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + tipoBadge + '</td>' +
      '</tr>';
    }).join('');

    var saudacao = (typeof saudacaoHoraBR_ === 'function')
      ? saudacaoHoraBR_()
      : (function(){ var h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; })();

    var assunto = 'Relação de Agendamentos — Oftalmologia · ' + data + ' | SindEducação-ES';

    var corpo =
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">' +

        '<div style="background:#001f4d;padding:20px 28px 16px;border-radius:12px 12px 0 0;border-bottom:4px solid #C9A84C;display:flex;justify-content:space-between;align-items:flex-start;">' +
          '<div style="border-left:4px solid #C9A84C;padding-left:16px;">' +
            '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
            '<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:5px;line-height:1.5;">Sindicato dos Educadores Técnico-Administrativos em<br>Estabelecimentos de Ensino Particular no Estado do ES</div>' +
            '<div style="font-size:11px;font-weight:900;color:#C9A84C;margin-top:6px;">CNPJ: 31.815.780/0001-51</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Referência</div>' +
            '<div style="font-size:13px;font-weight:700;color:#C9A84C;line-height:1.3;">Agendamento de<br>Oftalmologia</div>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:16px 28px 0;">' +
          '<div style="display:inline-flex;align-items:center;gap:6px;background:#1d4ed8;color:#fff;font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;text-transform:uppercase;letter-spacing:.06em;">👁️ Oftalmologia</div>' +
        '</div>' +

        '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:14px 28px;">' +
          '<div style="border:1px solid #cfd8e3;border-left:4px solid #001f4d;border-radius:12px;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;">' +
            '<div style="padding:14px 16px;border-right:1px solid #d8e0ec;">' +
              '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Data</div>' +
              '<div style="font-size:16px;font-weight:900;color:#001f4d;">' + data + '</div>' +
            '</div>' +
            '<div style="padding:14px 16px;background:#f8fafc;">' +
              '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Total de pacientes</div>' +
              '<div style="font-size:16px;font-weight:900;color:#001f4d;">' + total + ' paciente(s)</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:14px 28px;">' +
          '<p style="margin:0 0 16px;text-align:justify;line-height:1.7;color:#334155;">' + saudacao + '! Tudo bem?<br><br>' +
            'Encaminhamos a relação de pacientes agendados para atendimento oftalmológico no dia <strong>' + data + '</strong> na Clínica Vila Médica.' +
          '</p>' +

          '<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px;">' +
            '<div style="background:#001f4d;padding:10px 14px;display:flex;align-items:center;gap:8px;">' +
              '<span style="font-size:11px;font-weight:900;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.08em;">👤 Relação de Pacientes</span>' +
              '<span style="margin-left:auto;background:#C9A84C;color:#001f4d;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">' + total + '</span>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
              '<thead>' +
                '<tr style="background:#f8fafc;">' +
            '<th style="padding:9px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e2e8f0;">Hora</th>' +
'<th style="padding:9px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e2e8f0;">Nome</th>' +
'<th style="padding:9px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e2e8f0;">CPF</th>' +
'<th style="padding:9px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e2e8f0;">Telefone</th>' +
'<th style="padding:9px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e2e8f0;">Escola</th>' +
'<th style="padding:9px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e2e8f0;">Tipo</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' + linhas + '</tbody>' +
            '</table>' +
          '</div>' +

          '<p style="margin:0 0 14px;line-height:1.7;color:#334155;">Permanecemos à disposição para quaisquer esclarecimentos.</p>' +
        '</div>' +

        '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:16px 28px 20px;">' +
          '<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;">' +
          '<p style="line-height:1.9;margin:0;font-size:12px;color:#334155;">' +
            '<strong>Marcelha Aline Pinto Gomes</strong><br>' +
            'Secretaria — SindEducação-ES<br>' +
            'Av. Nossa Senhora dos Navegantes, 755 — Salas 707/708<br>' +
            'Enseada do Suá · Vitória/ES · CEP 29.050-355<br>' +
            '(27) 99735-8900 | (27) 3222-2706<br>' +
            'secretaria@sindeducacao.com' +
          '</p>' +
        '</div>' +

        '<div style="background:#001f4d;padding:16px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
          '<div style="font-size:13px;font-weight:900;color:#fff;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.1);">SINDEDUCAÇÃO-ES</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,.6);line-height:1.6;">' +
            'Av. Nossa Senhora dos Navegantes, 755, Salas 707/708 — Enseada do Suá · Vitória/ES · CEP 29.050-355<br>' +
            '(27) 99735-8900 · secretaria@sindeducacao.com · sindeducacao.com.br' +
          '</div>' +
          '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);">' +
            '<span style="font-size:10px;color:rgba(255,255,255,.3);">Gerado automaticamente pelo SISGEP · SindEducação-ES</span>' +
          '</div>' +
        '</div>' +

      '</div>';

    MailApp.sendEmail({
      to:       emailClinica,
      subject:  assunto,
      htmlBody: corpo,
      name:     'SindEducação-ES',
      replyTo:  'secretaria@sindeducacao.com',
      bcc:      'financeiro@sindeducacao.com'
    });

    try {
      registrarLogOftalmo_('RELATORIO_ENVIADO', data, {
        email: emailClinica, total: total
      });
    } catch(logErr) {
      Logger.log('⚠ Falha ao registrar log: ' + logErr.message);
    }

    return { ok: true };
  } catch(e) {
    return { ok: false, erro: e.message || String(e) };
  }
}
function formatarHoraOftalmo_(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(
      valor,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }
  return String(valor || '').trim();
}
/* =========================================================
   AUTOCOMPLETE DE ASSOCIADOS — AGENDA OFTALMO
========================================================= */
function buscarAssociadosOftalmo(termo) {
  try {
    termo = String(termo || '').trim();

    if (termo.length < 2) {
      return {
        ok: true,
        associados: []
      };
    }

    var ss = SpreadsheetApp.openById(
      getPlanilhaOftalmoId_()
    );

    var aba = ss.getSheetByName('Associados');

    if (!aba) {
      return {
        ok: false,
        erro: 'A aba Associados não foi encontrada.'
      };
    }

    var dados = aba.getDataRange().getDisplayValues();

    if (!dados || dados.length < 2) {
      return {
        ok: true,
        associados: []
      };
    }

    var cabecalhos = dados[0].map(function (valor) {
      return normalizarCabecalhoOftalmo_(valor);
    });

    function encontrarColuna(nomes) {
      for (var i = 0; i < nomes.length; i++) {
        var procurado = normalizarCabecalhoOftalmo_(nomes[i]);
        var indice = cabecalhos.indexOf(procurado);

        if (indice !== -1) {
          return indice;
        }
      }

      return -1;
    }

    var colNome = encontrarColuna([
      'Nome',
      'Nome Completo',
      'Associado',
      'Nome do Associado',
      'Trabalhador'
    ]);

    var colCpf = encontrarColuna([
      'CPF',
      'CPF do Associado',
      'CPF Titular'
    ]);

    var colTelefone = encontrarColuna([
      'Telefone',
      'Celular',
      'WhatsApp',
      'Fone'
    ]);

    var colEmail = encontrarColuna([
      'Email',
      'E-mail',
      'E-mail pessoal',
      'E-mail do associado'
    ]);

    var colEscola = encontrarColuna([
      'Escola',
      'Instituição',
      'Instituicao',
      'IES',
      'Local de Trabalho'
    ]);

    var colSituacao = encontrarColuna([
      'Situação',
      'Situacao',
      'Status'
    ]);

    if (colNome === -1) {
      return {
        ok: false,
        erro: 'A coluna de nome não foi encontrada na aba Associados.'
      };
    }

    var termoNormalizado = normalizarBuscaOftalmo_(termo);
    var resultado = [];

    for (var linha = 1; linha < dados.length; linha++) {
      var registro = dados[linha];
      var nome = String(registro[colNome] || '').trim();

      if (!nome) {
        continue;
      }

      var nomeNormalizado = normalizarBuscaOftalmo_(nome);
      var cpf = colCpf >= 0
        ? String(registro[colCpf] || '').replace(/\D/g, '')
        : '';

      var encontrou =
        nomeNormalizado.indexOf(termoNormalizado) !== -1 ||
        cpf.indexOf(termo.replace(/\D/g, '')) !== -1;

      if (!encontrou) {
        continue;
      }

      resultado.push({
        nome: nome,
        cpf: cpf,
        telefone: colTelefone >= 0
          ? String(registro[colTelefone] || '').trim()
          : '',
        email: colEmail >= 0
          ? String(registro[colEmail] || '').trim().toLowerCase()
          : '',
        escola: colEscola >= 0
          ? String(registro[colEscola] || '').trim()
          : '',
        situacao: colSituacao >= 0
          ? String(registro[colSituacao] || '').trim()
          : ''
      });

      if (resultado.length >= 12) {
        break;
      }
    }

    return {
      ok: true,
      associados: resultado
    };

  } catch (e) {
    return {
      ok: false,
      erro: e.message || String(e)
    };
  }
}

function normalizarCabecalhoOftalmo_(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .trim();
}

function normalizarBuscaOftalmo_(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}
/* =========================================================
   EXCLUIR AGENDAMENTO DEFINITIVAMENTE
========================================================= */
function excluirAgendamentoOftalmo(id, tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", true);
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    id = String(id || '').trim();

    if (!id) {
      return {
        ok: false,
        erro: 'ID do agendamento não informado.'
      };
    }

    var aba = obterAbaOftalmo_();
    var dados = aba.getDataRange().getValues();
    var idx = obterIdxOftalmo_(dados[0]);

    for (var i = 1; i < dados.length; i++) {
      var idLinha = String(
        dados[i][idx['ID']] || ''
      ).trim();

      if (idLinha === id) {
        var dadosExcluidos = {
          id: idLinha,
          data: formatarDataOftalmo_(
            dados[i][idx['Data']]
          ),
          hora: formatarHoraOftalmo_(
            dados[i][idx['Hora']]
          ),
          nomeTitular: String(
            dados[i][idx['Nome_Titular']] || ''
          ),
          nomeBeneficiario: String(
            dados[i][idx['Nome_Beneficiario']] || ''
          ),
          escola: String(
            dados[i][idx['Escola']] || ''
          )
        };

        registrarLogOftalmo_(
          'EXCLUSAO_DEFINITIVA',
          id,
          dadosExcluidos
        );

        lixeiraMover_(aba, i + 1, { origem: "excluirAgendamentoOftalmo" });

        return {
          ok: true,
          mensagem: 'Agendamento excluído definitivamente.'
        };
      }
    }

    return {
      ok: false,
      erro: 'Agendamento não encontrado.'
    };

  } catch (e) {
    return {
      ok: false,
      erro: e.message || String(e)
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (erroLock) {}
  }
}