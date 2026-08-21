// ============================================================================
// 📝 ARQUIVO: EventosInscricaoPublica.gs
// 🏷️  COMPASSO DA VIDA 2026 — A porta de entrada do associado
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026. O usuário descreveu como era feito no ano passado: "a gente
// abriu o formulário pra inscrição, usava uma plataforma Bluetick para emissão
// desses ingressos, e enviava pelo e-mail". E o que quer agora:
//
//   "a gente encaminha um link pra ele, o link de inscrição. A gente vai
//    encaminhar na nossa lista de transmissão, vai colocar no site, e nesse
//    link ele vai fazer a inscrição onde coloca o nome dele, escola, CPF,
//    identidade, qual é a cidade, tem um termo de ciência."
//
// E o requisito que governa tudo: "que seja simples porque nem todo associado
// tem tanta habilidade com informática. Agora que seja simples, mas que seja
// confiável."
//
// POR QUE O CPF VEM PRIMEIRO NA TELA
//
// A base tem ~8.000 associados. A pessoa digita o CPF e nome, escola, cidade,
// e-mail e WhatsApp NASCEM PREENCHIDOS — ela só confere. É o que torna a tela
// viável para quem tem pouca prática, e é a REGRA Nº 0.6 aplicada onde ela
// mais rende: sete campos viram um.
//
// Quem não está na base preenche à mão, e NÃO é recusado. Decisão do usuário:
// "não recuse num primeiro momento, que é até uma oportunidade de quem não é
// associado". O selo fica na inscrição para a equipe decidir na validação.
//
// POR QUE UMA BUSCA PRÓPRIA, E NÃO buscarAssociadoPorCPF_
//
// Aquela função usa `SpreadsheetApp.getActiveSpreadsheet()`. Num web app isso
// não garante a planilha DO AMBIENTE — é a mesma classe de falha do
// EMISSAO_CFG.PLANILHA_ID fixo, corrigido hoje de manhã: homologação lendo a
// base real de produção. Aqui a leitura passa por `getPlanilhaId()`, que
// respeita SISGEP_AMBIENTE.
//
// A busca também devolve a coluna FILIADO, que a outra não usava para nada e
// que aqui é o dado central: é ela que gera o selo ✅ / ⚠️ / ❌ da tela de
// gestão.
//
// O TERMO
//
// Fica em configuração, não no código — o texto muda a cada edição, e mudar
// texto não pode exigir deploy. O que fica gravado na inscrição é a VERSÃO
// aceita e o HASH do texto: assim, se alguém contestar depois, dá para provar
// exatamente qual redação a pessoa leu. Mesmo padrão do termo do Bingo.
// ============================================================================

var COMPASSO_TERMO_VERSAO_PADRAO = '2026.1';

/**
 * Texto padrão do termo. Vale enquanto a configuração não trouxer outro.
 * A cláusula 3 é a que tem consequência real, e o tom é o que o usuário pediu
 * em 21/08: BRANDO — pede em vez de ameaçar, mas deixa a consequência escrita.
 */
var COMPASSO_TERMO_PADRAO = [
  'TERMO DE CIÊNCIA E COMPROMISSO',
  '',
  '1. Declaro que as informações que preenchi são verdadeiras.',
  '',
  '2. Estou ciente de que o ingresso é pessoal e intransferível, vale para ' +
  'UMA única entrada, e que a apresentação do QR Code é obrigatória na portaria.',
  '',
  '3. Estou ciente de que minha vaga é uma entre um número limitado, e que a ' +
  'ausência sem aviso deixa a vaga sem uso. Caso eu não possa comparecer, me ' +
  'comprometo a avisar a secretaria com antecedência. A ausência sem aviso ' +
  'fica registrada e poderá ser considerada nas próximas edições.',
  '',
  '4. Autorizo o uso do meu e-mail e WhatsApp para o envio do ingresso e de ' +
  'comunicados sobre este evento.'
].join('\n');

/**
 * Busca o associado pelo CPF, na planilha DO AMBIENTE.
 * Colunas conforme a aba Associados: A nome fantasia (escola), B nome,
 * C CPF, D filiado, H cidade, J celular, L e-mail.
 */
function compasso_buscarAssociado_(cpfLimpo) {
  cpfLimpo = String(cpfLimpo || '').replace(/\D/g, '');
  if (cpfLimpo.length !== 11) return { encontrado: false };
  try {
    var ss = SpreadsheetApp.openById(getPlanilhaId());
    var sh = ss.getSheetByName(EMISSAO_CFG.ABA_ASSOCIADOS);
    if (!sh || sh.getLastRow() < 2) return { encontrado: false };

    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][2] || '').replace(/\D/g, '') !== cpfLimpo) continue;
      return {
        encontrado: true,
        nome:     String(dados[i][1] || '').trim(),
        escola:   String(dados[i][0] || '').trim(),
        cidade:   String(dados[i][7] || '').trim(),
        whatsapp: String(dados[i][9] || '').trim(),
        email:    String(dados[i][11] || '').trim(),
        /* S/N na coluna D. É o que decide o selo da tela de gestão. */
        filiado:  String(dados[i][3] || 'N').trim().toUpperCase().charAt(0) === 'S'
      };
    }
    return { encontrado: false };
  } catch (e) {
    /* Falha de leitura NÃO pode virar "não encontrado" silencioso: a pessoa
       preencheria tudo à mão sem saber que o sistema quebrou, e a equipe veria
       um ❌ que não é verdade. O erro sobe. */
    return { encontrado: false, erro: e.message };
  }
}

/**
 * Situação do selo, calculada num lugar só para tela e relatório concordarem.
 *   ASSOCIADO      achou e está filiado
 *   NAO_FILIADO    achou na base, mas Filiado = N
 *   NAO_ENCONTRADO CPF não está na base
 */
function compasso_situacaoAssociado_(busca) {
  if (!busca || !busca.encontrado) return 'NAO_ENCONTRADO';
  return busca.filiado ? 'ASSOCIADO' : 'NAO_FILIADO';
}

/* ══════════════════════════════════════════════════════════════════════════
   O QUE A TELA PÚBLICA CHAMA — sem sessão, é o ponto público do fluxo
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Estado da inscrição: se está aberta, o texto do convite, o termo.
 * SEM TRAVA DE SESSÃO, de propósito — quem abre é o associado, que não tem
 * conta no SISGEP. Toda decisão é do servidor; a tela não decide nada.
 */
function compasso_inscricaoEstado() {
  var cfg = compasso_inscricaoConfig_();
  return {
    aberta: cfg.aberta,
    motivoFechada: cfg.motivoFechada,
    titulo: cfg.titulo,
    convite: cfg.convite,
    termo: cfg.termo,
    termoVersao: cfg.termoVersao,
    vagas: cfg.vagas
  };
}

/** Config do evento, com padrões. O texto muda por edição, não por deploy. */
function compasso_inscricaoConfig_() {
  var props = PropertiesService.getScriptProperties();
  var termo = props.getProperty('COMPASSO_TERMO') || COMPASSO_TERMO_PADRAO;

  var reserva = { reservadas: 0, limite: EMISSAO_CFG.LIMITE_VAGAS };
  try { reserva = compasso_lerReservaVagas_(); } catch (e) {}
  var restantes = Number(reserva.limite || 0) - Number(reserva.reservadas || 0);

  var aberta = true, motivo = '';
  if (restantes <= 0) { aberta = false; motivo = 'As vagas para esta edição se esgotaram.'; }
  if (aberta && !emissao_modoTeste_()) {
    var agora = new Date();
    if (agora < EMISSAO_CFG.PERIODO_INICIO) {
      aberta = false; motivo = 'As inscrições ainda não abriram.';
    } else if (agora > EMISSAO_CFG.PERIODO_FIM) {
      aberta = false; motivo = 'O período de inscrições foi encerrado.';
    }
  }

  return {
    aberta: aberta,
    motivoFechada: motivo,
    titulo: props.getProperty('COMPASSO_TITULO') || 'Festa Compasso da Vida 2026',
    convite: props.getProperty('COMPASSO_CONVITE') || '',
    termo: termo,
    termoVersao: props.getProperty('COMPASSO_TERMO_VERSAO') || COMPASSO_TERMO_VERSAO_PADRAO,
    vagas: { limite: reserva.limite, restantes: Math.max(0, restantes) }
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   O PREENCHIMENTO AUTOMÁTICO É ÚTIL E É PERIGOSO — as duas coisas
   ══════════════════════════════════════════════════════════════════════════

   `compasso_inscricaoPreencher` é um endpoint PÚBLICO que recebe um CPF e
   responde com dados de uma pessoa. Sem cuidado, isso é uma porta para varrer
   CPFs e colher a base inteira: 8.000 nomes com e-mail e telefone. O link da
   inscrição vai para lista de transmissão e para o site — ou seja, vai estar
   em muitas mãos.

   Duas travas, e elas atacam coisas diferentes:

   1. TETO DE CONSULTAS por navegador (CacheService). Uma pessoa se inscrevendo
      consulta UM CPF, no máximo dois se errar de digitação. Quem consulta 20
      não está se inscrevendo. Não impede um ataque decidido — não há IP no
      Apps Script — mas transforma "colher 8.000 num script" em algo caro.

   2. E-MAIL E TELEFONE VOLTAM MASCARADOS. É a trava que realmente importa,
      porque tira o VALOR do que se colheria. A pessoa vê `m****a@gmail.com`,
      reconhece como seu e segue; quem varre não leva contato nenhum.

      Se ela não reconhecer, digita o certo por cima. Se deixar como está, o
      servidor usa o valor REAL do cadastro — a máscara nunca vira dado
      gravado. É a função `compasso_valorMascarado_` que decide isso, num
      lugar só.

   Nome, escola e cidade voltam inteiros: sem eles a tela não cumpre o que
   promete, e são os dados menos sensíveis do conjunto.
   ══════════════════════════════════════════════════════════════════════════ */

var COMPASSO_TETO_CONSULTAS = 12;
var COMPASSO_JANELA_CONSULTAS_SEG = 600;   /* 10 minutos */

/** Marca de que o campo veio mascarado e não foi tocado pela pessoa. */
var COMPASSO_MARCA_MASCARA = '\u2022';     /* • */

function compasso_mascararEmail_(email) {
  email = String(email || '').trim();
  var at = email.indexOf('@');
  if (at < 1) return '';
  var user = email.slice(0, at), dom = email.slice(at);
  var visivel = user.length <= 2 ? user.charAt(0)
              : user.charAt(0) + COMPASSO_MARCA_MASCARA.repeat(Math.min(4, user.length - 2)) +
                user.charAt(user.length - 1);
  return visivel + dom;
}

function compasso_mascararTelefone_(tel) {
  var d = String(tel || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  return '(' + d.slice(0, 2) + ') ' + COMPASSO_MARCA_MASCARA.repeat(5) + '-' + d.slice(-4);
}

/**
 * Decide o que gravar: o que a pessoa digitou, ou o valor real do cadastro.
 * Se o texto ainda contém a marca da máscara, ela não mexeu — vale o cadastro.
 */
function compasso_valorMascarado_(digitado, doCadastro) {
  var v = String(digitado || '');
  if (v.indexOf(COMPASSO_MARCA_MASCARA) >= 0) return String(doCadastro || '');
  return v.trim();
}

/** Teto de consultas por navegador, na janela. Devolve false quando estourou. */
function compasso_podeConsultar_() {
  try {
    var cache = CacheService.getScriptCache();
    var chave = 'compasso_consulta_' + (Session.getTemporaryActiveUserKey() || 'anon');
    var n = Number(cache.get(chave) || 0) + 1;
    cache.put(chave, String(n), COMPASSO_JANELA_CONSULTAS_SEG);
    return n <= COMPASSO_TETO_CONSULTAS;
  } catch (e) {
    /* Cache indisponível não pode impedir alguém de se inscrever. A máscara,
       que é a trava principal, continua valendo. */
    return true;
  }
}

/**
 * Preenche o formulário a partir do CPF. É a peça que torna a tela simples.
 * Devolve o mínimo: nada de endereço, nada de matrícula. E-mail e telefone
 * voltam MASCARADOS — ver o bloco acima.
 */
function compasso_inscricaoPreencher(cpf) {
  if (!compasso_podeConsultar_())
    return { ok: false, erro: 'Muitas consultas seguidas. Aguarde alguns minutos ' +
                              'ou preencha os dados manualmente.' };

  var busca = compasso_buscarAssociado_(cpf);
  if (busca.erro) return { ok: false, erro: 'Não foi possível consultar o cadastro agora. ' +
                                            'Preencha os dados manualmente.' };
  if (!busca.encontrado) return { ok: false };
  return {
    ok: true,
    nome: busca.nome, escola: busca.escola, cidade: busca.cidade,
    email: compasso_mascararEmail_(busca.email),
    whatsapp: compasso_mascararTelefone_(busca.whatsapp),
    mascarado: true,
    origem: 'cadastro do sindicato'
  };
}

/**
 * Registra a inscrição.
 *
 * SEM TRAVA DE SESSÃO — é o ponto público. Toda validação está aqui:
 * CPF com dígito verificador, termo aceito, campos obrigatórios, duplicidade,
 * vaga disponível e período. A tela não decide nada.
 */
function compasso_inscrever(dados) {
  dados = dados || {};

  var cfg = compasso_inscricaoConfig_();
  if (!cfg.aberta) return { ok: false, erro: cfg.motivoFechada || 'As inscrições estão fechadas.' };

  var nome = String(dados.nome || '').trim();
  if (nome.length < 5 || nome.indexOf(' ') < 0)
    return { ok: false, campo: 'nome', erro: 'Informe seu nome completo.' };

  var cpf = String(dados.cpf || '').replace(/\D/g, '');
  if (!compasso_cpfValido_(cpf))
    return { ok: false, campo: 'cpf', erro: 'CPF inválido. Confira os números.' };

  if (!String(dados.escola || '').trim())
    return { ok: false, campo: 'escola', erro: 'Informe a escola onde você trabalha.' };
  if (!String(dados.cidade || '').trim())
    return { ok: false, campo: 'cidade', erro: 'Informe a cidade.' };

  /* E-mail e WhatsApp não são burocracia: são POR ONDE o ingresso chega.
     Sem pelo menos um, a inscrição vira um registro que não tem como ser
     entregue — e a pessoa só descobriria no dia da festa. */
  /* Resolve a máscara ANTES de validar: `m••••a@gmail.com` não passaria na
     checagem de e-mail, e a pessoa levaria um erro por não ter mexido num
     campo que estava certo. */
  var doCadastro = compasso_buscarAssociado_(cpf);
  var email = compasso_valorMascarado_(dados.email, doCadastro.email);
  var whats = String(compasso_valorMascarado_(dados.whatsapp, doCadastro.whatsapp))
                .replace(/\D/g, '');
  if (!email && !whats)
    return { ok: false, campo: 'email',
             erro: 'Informe pelo menos um e-mail ou WhatsApp — é por onde o ingresso chega.' };
  if (email && email.indexOf('@') < 1)
    return { ok: false, campo: 'email', erro: 'E-mail inválido.' };
  if (whats && (whats.length < 10 || whats.length > 11))
    return { ok: false, campo: 'whatsapp', erro: 'WhatsApp inválido. Informe com DDD.' };

  if (!dados.termoAceito)
    return { ok: false, campo: 'termo', erro: 'É preciso ler e concordar com o termo.' };

  var situacao = compasso_situacaoAssociado_(doCadastro);

  var r = compasso_criarInscricaoAssociado_publica_({
    nome: nome,
    cpf: cpf,
    rg: String(dados.rg || '').trim(),
    escola: String(dados.escola || '').trim(),
    cidade: String(dados.cidade || '').trim(),
    email: email,
    whatsapp: whats,
    origem: 'INSCRICAO_PUBLICA',
    situacaoAssociado: situacao,
    termoVersao: cfg.termoVersao,
    termoHash: compasso_hash_(cfg.termo),
    termoAceitoEm: new Date()
  });

  if (!r.ok) return r;

  return {
    ok: true,
    inscricaoId: r.inscricaoId,
    mensagem: 'Inscrição registrada! A equipe do sindicato vai conferir seus dados ' +
              'e o ingresso será enviado ' +
              (email && whats ? 'para o seu e-mail e WhatsApp.'
                              : (email ? 'para o seu e-mail.' : 'pelo seu WhatsApp.'))
  };
}

/**
 * Cria a inscrição pelo caminho público.
 *
 * Chama a mesma reserva de vaga e o mesmo índice de duplicidade que a
 * `compasso_criarInscricaoAssociado` administrativa usa — mas sem exigir
 * sessão, porque quem chama é o associado. Duplicar a lógica seria pior:
 * duas regras de vaga divergindo é como se perde o controle das 2.000.
 */
function compasso_criarInscricaoAssociado_publica_(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var chave = compasso_inscricaoChave_('', payload.cpf);
    var indice = fs_get_('inscricaoUnicaEventos', chave);
    if (indice && indice.status !== 'CANCELADA' && indice.status !== 'REPROVADA')
      return { ok: false, campo: 'cpf',
               erro: 'Já existe uma inscrição com este CPF. Se você não fez, ' +
                     'fale com a secretaria do sindicato.' };

    var vaga = compasso_reservarVagaInscricao_();
    if (!vaga.ok) return { ok: false, erro: vaga.erro || 'Vagas esgotadas.' };

    var id = 'INS-' + Utilities.getUuid();
    var agora = new Date();
    var ins = {
      inscricaoId: id, eventoId: EMISSAO_CFG.EVENTO_ID, pessoaId: '',
      nome: payload.nome, cpf: payload.cpf, rg: payload.rg || '',
      escola: payload.escola, cidade: payload.cidade, regiao: '',
      email: payload.email, whatsapp: payload.whatsapp, matricula: '',
      categoria: 'associado', origem: payload.origem,
      status: COMPASSO_STATUS.RECEBIDA, vagaReservada: true,
      situacaoAssociado: payload.situacaoAssociado,
      termoVersao: payload.termoVersao, termoHash: payload.termoHash,
      termoAceitoEm: payload.termoAceitoEm,
      criadoEm: agora, criadoPor: 'INSCRICAO_PUBLICA'
    };

    try {
      fs_set_('inscricoesEventos', id, ins);
      fs_set_('inscricaoUnicaEventos', chave, {
        eventoId: EMISSAO_CFG.EVENTO_ID, inscricaoId: id, pessoaId: '',
        cpfHash: compasso_hash_(payload.cpf), status: 'ATIVA', criadoEm: agora
      });
    } catch (e) {
      /* Devolve a vaga: sem isto, uma falha de escrita consumiria uma das
         2.000 para sempre, e ninguém saberia por quê. */
      try {
        var rr = compasso_lerReservaVagas_();
        rr.reservadas = Math.max(0, Number(rr.reservadas || 0) - 1);
        fs_set_('reservasEventos', EMISSAO_CFG.EVENTO_ID, rr);
      } catch (ignore) {}
      return { ok: false, erro: 'Não foi possível registrar sua inscrição agora. Tente novamente.' };
    }

    compasso_auditar_('INSCRICAO_PUBLICA', 'inscricao', id,
                      { origem: payload.origem, situacaoAssociado: payload.situacaoAssociado,
                        termoVersao: payload.termoVersao });
    return { ok: true, inscricaoId: id };
  } finally { lock.releaseLock(); }
}

/**
 * CPF com dígito verificador de verdade.
 * Numa tela pública, validar só o tamanho deixa entrar erro de digitação que
 * só aparece na portaria — quando já não dá para corrigir.
 */
function compasso_cpfValido_(cpf) {
  cpf = String(cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  var soma = 0, i;
  for (i = 0; i < 9; i++) soma += Number(cpf.charAt(i)) * (10 - i);
  var d1 = (soma * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf.charAt(9))) return false;
  soma = 0;
  for (i = 0; i < 10; i++) soma += Number(cpf.charAt(i)) * (11 - i);
  var d2 = (soma * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === Number(cpf.charAt(10));
}

/** Diagnóstico pelo editor: mostra o link para divulgar e o estado da inscrição. */
function diagnosticoInscricaoCompasso_() {
  var cfg = compasso_inscricaoConfig_();
  var base = '';
  try { base = getSistemaUrlBase() || ScriptApp.getService().getUrl(); }
  catch (e) { base = ScriptApp.getService().getUrl(); }

  var L = [];
  L.push('═══════════════════════════════════════════════════');
  L.push('  INSCRIÇÃO PÚBLICA — COMPASSO 2026');
  L.push('═══════════════════════════════════════════════════');
  L.push('  LINK PARA DIVULGAR:');
  L.push('  ' + base + '?page=compasso-inscricao');
  L.push('');
  L.push('  Aberta       : ' + (cfg.aberta ? 'SIM' : 'NÃO — ' + cfg.motivoFechada));
  L.push('  Vagas        : ' + cfg.vagas.restantes + ' de ' + cfg.vagas.limite);
  L.push('  Termo versão : ' + cfg.termoVersao);
  L.push('  Convite      : ' + (cfg.convite ? 'configurado' : '(usando o padrão vazio)'));
  L.push('');
  L.push('  Para trocar textos, nas Propriedades do script:');
  L.push('    COMPASSO_TITULO, COMPASSO_CONVITE, COMPASSO_TERMO,');
  L.push('    COMPASSO_TERMO_VERSAO');
  L.push('═══════════════════════════════════════════════════');
  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}
