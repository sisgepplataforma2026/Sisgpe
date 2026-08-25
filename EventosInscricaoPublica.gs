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
 * Indicadores administrativos de capacidade permanecem apenas no servidor.
 */
function compasso_inscricaoEstado() {
  var cfg = compasso_inscricaoConfig_();
  return {
    aberta: cfg.aberta,
    motivoFechada: cfg.motivoFechada,
    titulo: cfg.titulo,
    convite: cfg.convite,
    termo: cfg.termo,
    termoVersao: cfg.termoVersao
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

/* As constantes de máscara e teto NÃO ficam mais aqui, nem como apelido.
   Apelido apontando para o PrivacidadeCore quebrou a suíte inteira em
   21/08/2026: no Apps Script os arquivos são avaliados em ordem, "E" vem
   antes de "P", e `PRIV_TETO_CONSULTAS` ainda não existia quando este
   arquivo carregava. É a mesma armadilha que tirou o PLANILHA_ID de dentro
   do EMISSAO_CFG — e eu escrevi o comentário sobre ela aqui mesmo, e caí
   nela na linha seguinte.

   Nenhum código deste arquivo precisava delas depois que as funções
   passaram a delegar. Quem precisa do valor, chama a função. */

/* ── A MÁSCARA MUDOU DE CASA EM 21/08/2026 ─────────────────────────────────
 *
 * A regra inteira (máscara de e-mail e telefone, resolução do valor real e
 * teto de consultas) foi para `PrivacidadeCore.gs`. O motivo não foi estética:
 * o `bingo_inscricaoPreencher` tinha o MESMO buraco que este arquivo fechou
 * pela manhã, e corrigir duas vezes a mesma regra é como ela volta a divergir.
 *
 * Os nomes `compasso_*` continuam existindo como ponte, porque são o que a
 * tela e os testes deste módulo chamam. Eles não reimplementam nada —
 * delegam. Quem for mexer na regra, mexe no PrivacidadeCore.
 */
function compasso_mascararEmail_(email)  { return priv_mascararEmail_(email); }
function compasso_mascararTelefone_(tel) { return priv_mascararTelefone_(tel); }

/**
 * Decide o que gravar: o que a pessoa digitou, ou o valor real do cadastro.
 * Se o texto ainda contém a marca da máscara, ela não mexeu — vale o cadastro.
 */
function compasso_valorMascarado_(digitado, doCadastro) {
  return priv_valorMascarado_(digitado, doCadastro);
}

/** Teto de consultas por navegador, na janela. Devolve false quando estourou. */
function compasso_podeConsultar_() {
  return priv_podeConsultar_('compasso');
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

  /* O COMPROVANTE. Até 25/08 a pessoa se inscrevia, via a mensagem na tela e
     fechava o navegador sem nada na mão — e ligava para a secretaria no dia
     seguinte para perguntar se tinha dado certo. É trabalho que o sistema já
     sabe evitar (REGRA Nº 0.6).

     NUNCA derruba a inscrição: ela já está gravada acima, e uma falha de
     e-mail não pode virar "não deu certo" para quem fez tudo certo. */
  compasso_confirmarInscricaoPorEmail_(r.inscricaoId, {
    nome: nome, cpf: cpf, escola: String(dados.escola || '').trim(),
    cidade: String(dados.cidade || '').trim(), email: email, whatsapp: whats
  });

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
/**
 * Só em homologação declarada é que o mesmo CPF pode se inscrever de novo.
 *
 * Duas propriedades precisam estar certas ao mesmo tempo — é a mesma dupla
 * que o simulador exige. Qualquer erro de leitura devolve `false`: na dúvida,
 * a trava fica de pé.
 */
function compasso_repeticaoLiberada_() {
  try {
    if (!emissao_modoTeste_()) return false;
    var amb = String(PropertiesService.getScriptProperties()
                     .getProperty('SISGEP_AMBIENTE') || '').toUpperCase();
    return amb === 'HOMOLOGACAO';
  } catch (e) { return false; }
}

function compasso_criarInscricaoAssociado_publica_(payload) {
  var lock = LockService.getScriptLock();

  /* A FILA DA LISTA DE TRANSMISSÃO — 25/08/2026.
   *
   * O usuário confirmou como o link chega: "link vai para a lista de
   * transmissão". Isso não é detalhe de divulgação, é o perfil de carga: todo
   * mundo recebe no mesmo instante e clica na mesma hora. Não há chegada
   * distribuída ao longo do dia.
   *
   * Cada inscrição segura a trava do script durante duas ou três chamadas ao
   * Firestore. Para uma pessoa é instantâneo; para 500 no mesmo minuto vira
   * fila — e `waitLock` LANÇA EXCEÇÃO quando não consegue a trava no prazo.
   *
   * Até aqui essa exceção subia crua: a pessoa via um erro do Apps Script, sem
   * mensagem e sem instrução. E a reação natural é preencher tudo de novo — o
   * que, se a primeira tentativa tiver passado, gera a duplicidade que a trava
   * de CPF existe para impedir.
   *
   * Agora ela vira recusa explicada, e a mensagem diz a única coisa que
   * importa: NÃO foi registrada. Sem essa frase a pessoa fica sem saber se
   * pode tentar de novo. */
  try {
    lock.waitLock(20000);
  } catch (eLock) {
    return { ok: false, ocupado: true,
             erro: 'Muita gente se inscrevendo agora e não conseguimos ' +
                   'registrar a sua inscrição. Ela NÃO foi registrada — ' +
                   'espere um minuto e envie de novo.' };
  }

  try {
    /* UMA INSCRIÇÃO POR CPF — exceto em homologação.
     *
     * Pedido do usuário em 24/08/2026: "tira a trava de somente um pode fazer
     * a inscrição, pois eu preciso testar e vou fazer várias vezes". Ele está
     * certo: testar o fluxo exige repetir o fluxo, e com a trava valendo o
     * segundo teste com o mesmo CPF morre na porta.
     *
     * Mas a trava não pode simplesmente sair. Em dezembro, ela é o que impede
     * a mesma pessoa consumir duas das 2.000 vagas — por engano, por clique
     * duplo, ou de propósito. Some em homologação, fica inteira em produção.
     *
     * A condição é a MESMA do simulador (EVENTO_MODO_TESTE=true e
     * SISGEP_AMBIENTE=HOMOLOGACAO): se um dia alguém apontar a homologação
     * para a base real, é essa dupla que precisa estar errada para o buraco
     * abrir — não uma linha comentada que ninguém lembra de descomentar. */
    var chave = compasso_inscricaoChave_('', payload.cpf);
    if (!compasso_repeticaoLiberada_()) {
      var indice = fs_get_('inscricaoUnicaEventos', chave);
      if (indice && indice.status !== 'CANCELADA' && indice.status !== 'REPROVADA')
        return { ok: false, campo: 'cpf',
                 erro: 'Já existe uma inscrição com este CPF. Se você não fez, ' +
                       'fale com a secretaria do sindicato.' };
    }

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

/* ══════════════════════════════════════════════════════════════════════════
   A CONFIRMAÇÃO DA INSCRIÇÃO — 25/08/2026
   ══════════════════════════════════════════════════════════════════════════

   O que ela resolve: até aqui, quem se inscrevia recebia uma frase na tela e
   mais nada. Fechou o navegador, acabou a prova. A auditoria do módulo listou
   isso como lacuna G1, e é da classe que a REGRA Nº 0.6 chama de trabalho que
   o sistema já sabe evitar — cada pessoa sem comprovante é um telefonema para
   a secretaria.

   AS QUATRO DECISÕES QUE IMPORTAM AQUI:

   1. NUNCA DERRUBA A INSCRIÇÃO. A inscrição já está gravada quando esta função
      é chamada. Falha de e-mail vira registro, nunca erro na tela de quem se
      inscreveu — o contrário faria a pessoa se inscrever de novo e duplicar.

   2. DIZ, COM DESTAQUE, QUE NÃO É O INGRESSO. Sem essa linha alguém aparece na
      portaria em 19/12 com a confirmação impressa na mão. É o risco de UX mais
      concreto desta mudança, e ele se resolve com uma frase.

   3. O CONTATO VOLTA MASCARADO NO CORPO. O e-mail atravessa a internet e fica
      guardado em caixa que não é nossa. Conferir "termina em @gmail.com" é o
      suficiente para a pessoa reconhecer o próprio dado; o valor cheio não
      precisa viajar. Mesma regra da tela pública (PrivacidadeCore.gs).

   4. PASSA PELA CAMADA CENTRAL (`enviarEmailSISGEP_`), e não por MailApp
      direto. É o que dá remetente institucional, status estruturado e registro
      em Log_Emails_Enviados. A entrega do ingresso ainda usa MailApp direto —
      é a lacuna I4 da auditoria —, e este caminho novo já nasce do lado certo.

   O PROTOCOLO é os 6 últimos caracteres do inscricaoId, em maiúsculo. O ID
   inteiro é um UUID: ninguém dita isso ao telefone. Seis caracteres bastam
   para a secretaria achar a linha, e continuam apontando para o ID real. */
function compasso_protocoloInscricao_(inscricaoId) {
  var id = String(inscricaoId || '').replace(/[^a-zA-Z0-9]/g, '');
  return id.slice(-6).toUpperCase();
}

/** CPF só com o começo e o fim: o bastante para reconhecer, longe do suficiente
    para usar. O CPF cheio não precisa viajar num e-mail. */
function compasso_cpfParcial_(cpf) {
  var d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return '';
  return d.slice(0, 3) + '.***.***-' + d.slice(9);
}

/**
 * QUANDO E ONDE É A FESTA — e por que buscar isto é mais difícil do que parece.
 *
 * O e-mail confirma inscrição para uma festa; não dizer a data seria estranho.
 * Os dados existem na tela "Festa 2026 › Informações" — local, endereço e
 * horários. Só que aquela tela grava pela camada V2, e
 * `eventosV2Repo_exigirHomologacao_()` (EventosRepositoryV2.gs:55) ESTOURA
 * EXCEÇÃO fora de homologação. Em dezembro, com o sistema em produção, ler
 * dali quebraria — e quebraria dentro do caminho público da inscrição.
 *
 * Daí a cascata, nesta ordem:
 *
 *   1. a tela de Informações, quando alcançável (é onde a pessoa preencheu,
 *      e a REGRA Nº 0.6 manda usar o que o sistema já sabe);
 *   2. as Propriedades do script, que funcionam nos DOIS ambientes e são onde
 *      o Compasso já guarda título, convite e termo;
 *   3. a data, de EMISSAO_CFG.DATA_EVENTO, que existe sempre.
 *
 * E a regra que fecha: LINHA VAZIA NÃO APARECE. Melhor faltar o local do que
 * mandar "Local: (não informado)" para 2.000 pessoas.
 */
/* O LOCAL REAL, como padrão — ditado pelo usuário em 25/08/2026.
   Fica no código porque a festa já tem local fechado, e depender de uma
   propriedade configurada faria o e-mail sair sem endereço até alguém lembrar
   de preencher. Propriedade declarada continua ganhando: se o local mudar,
   muda sem deploy. */
var COMPASSO_FESTA_PADRAO = {
  local: 'Espaço Patrick Ribeiro',
  endereco: 'Av. Roza Helena Schorling Albuquerque, s/n — Goiabeiras, ' +
            'Vitória/ES — CEP 29109-350',
  referencia: 'Ao lado do Aeroporto de Vitória.',
  horaAbertura: '19h',
  horaInicio: '20h'
};

function compasso_dadosDaFesta_() {
  var out = { data: null, horaAbertura: '', horaInicio: '', local: '',
              endereco: '', referencia: '' };

  try { out.data = EMISSAO_CFG.DATA_EVENTO; } catch (e) {}

  /* 1. A tela de Informações. Envolvida em try porque a camada V2 recusa
        trabalhar fora de homologação — e recusar não pode virar erro aqui. */
  try {
    var lista = eventosV2Repo_listar_() || [];
    for (var i = 0; i < lista.length; i++) {
      var ev = lista[i] || {};
      if (String(ev.tipo || '').toUpperCase() !== 'FESTA') continue;
      if (Number(ev.ano) !== 2026) continue;
      out.horaAbertura = String(ev.horaAbertura || '');
      out.horaInicio   = String(ev.horaInicio || '');
      out.local        = String(ev.localNome || '');
      out.endereco     = String(ev.endereco || '');
      break;
    }
  } catch (e) { /* produção, ou aba ainda inexistente. Segue para as props. */ }

  /* 2. As Propriedades, que valem nos dois ambientes. Preenchem o que faltou;
        não sobrescrevem o que a tela já respondeu. */
  try {
    var p = PropertiesService.getScriptProperties();
    out.horaAbertura = out.horaAbertura || String(p.getProperty('COMPASSO_HORA_ABERTURA') || '');
    out.horaInicio   = out.horaInicio   || String(p.getProperty('COMPASSO_HORA_INICIO') || '');
    out.local        = out.local        || String(p.getProperty('COMPASSO_LOCAL') || '');
    out.endereco     = out.endereco     || String(p.getProperty('COMPASSO_ENDERECO') || '');
    out.referencia   = out.referencia   || String(p.getProperty('COMPASSO_REFERENCIA') || '');
  } catch (e) {}

  /* 3. O que ainda faltar cai no padrão do próprio evento. */
  out.horaAbertura = out.horaAbertura || COMPASSO_FESTA_PADRAO.horaAbertura;
  out.horaInicio   = out.horaInicio   || COMPASSO_FESTA_PADRAO.horaInicio;
  out.local        = out.local        || COMPASSO_FESTA_PADRAO.local;
  out.endereco     = out.endereco     || COMPASSO_FESTA_PADRAO.endereco;
  out.referencia   = out.referencia   || COMPASSO_FESTA_PADRAO.referencia;

  return out;
}

/**
 * "sábado, 19 de dezembro de 2026".
 *
 * O dia da semana entra a pedido do usuário, e ele carrega informação que a
 * data sozinha não dá: saber que cai num sábado é o que decide se a pessoa
 * consegue ir. Quem lê "19/12" precisa abrir o calendário para descobrir isso.
 */
function compasso_dataPorExtenso_(d) {
  if (!d || Object.prototype.toString.call(d) !== '[object Date]' || isNaN(d.getTime())) return '';
  var dias = ['domingo','segunda-feira','terça-feira','quarta-feira',
              'quinta-feira','sexta-feira','sábado'];
  var meses = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];
  return dias[d.getDay()] + ', ' + d.getDate() + ' de ' + meses[d.getMonth()] +
         ' de ' + d.getFullYear();
}

/** Monta "  Rótulo ..... valor", pulando o que não tem valor. */
function compasso_linhaConfirmacao_(rotulo, valor) {
  if (!String(valor || '').trim()) return null;
  var pad = (rotulo + ' ').length < 14
    ? new Array(14 - rotulo.length).join('.') : '..';
  return '  ' + rotulo + ' ' + pad + ' ' + valor;
}

/**
 * O TEXTO — escrito pelo usuário em 25/08/2026, e reproduzido aqui à risca.
 *
 * ELE MUDOU DE IDEIA SOBRE O TOM, E ESTÁ CERTO. Poucas horas antes ele tinha
 * pedido "tom mais institucional", e eu escrevi um ofício: "Prezado(a)",
 * "procederá à conferência", "Atenciosamente". Depois ele mandou o texto que
 * queria de verdade — festivo, com emoji, terminando em "Nos vemos no Compasso
 * da Vida 2026!".
 *
 * A correção faz sentido e vale registrar por quê: institucional é o tom de
 * uma cobrança ou de uma notificação. Isto é o convite para a festa de fim de
 * ano do sindicato, e quem recebe é a associada — não um órgão. Um ofício aqui
 * seria formalmente correto e afetivamente errado, e ele conhece a operação e
 * as pessoas que vão ler.
 *
 * O QUE NÃO MUDA, e é a razão de este texto ter sido testado antes de sair:
 *
 *   - o aviso de que NÃO É O INGRESSO continua em destaque. Sem ele alguém
 *     aparece na portaria em 19/12 com este e-mail impresso na mão;
 *   - CPF e contato continuam mascarados;
 *   - o protocolo continua sendo o número que se dita à secretaria.
 *
 * Mudar a redação é mexer só aqui. A estrutura — o que é obrigatório e o que
 * some quando falta — está nas funções acima.
 */
function compasso_textoConfirmacao_(dados, protocolo) {
  var festa = compasso_dadosDaFesta_();
  var primeiro = String(dados.nome || '').trim().split(' ')[0] || '';
  var contato = [];
  if (dados.email) contato.push(compasso_mascararEmail_(dados.email));
  if (dados.whatsapp) contato.push(compasso_mascararTelefone_(dados.whatsapp));

  var L = [];
  L.push('Olá, ' + primeiro + '! 👋');
  L.push('');
  L.push('Sua inscrição para a Festa Compasso da Vida 2026 foi recebida com sucesso! 🎉');
  L.push('');
  L.push('Protocolo da inscrição: ' + protocolo);
  L.push('');
  L.push('🎶 COMPASSO DA VIDA 2026');
  L.push('');

  /* Cada linha só entra se tiver conteúdo — melhor faltar do que mandar
     "Local: (não informado)" para 2.000 pessoas. */
  var dataTexto = compasso_dataPorExtenso_(festa.data);
  if (dataTexto) L.push('📅 Data: ' + dataTexto);

  var horas = [];
  if (festa.horaAbertura) horas.push('Abertura: ' + festa.horaAbertura);
  if (festa.horaInicio)   horas.push('Início: ' + festa.horaInicio);
  if (horas.length) L.push('🕖 ' + horas.join(' | '));

  if (festa.local)      L.push('📍 Local: ' + festa.local);
  if (festa.endereco)   L.push('Endereço: ' + festa.endereco);
  if (festa.referencia) L.push(festa.referencia);

  L.push('');
  L.push('✅ CONFIRA SEUS DADOS');
  L.push('');
  L.push('Nome: ' + String(dados.nome || ''));
  L.push('CPF: ' + compasso_cpfParcial_(dados.cpf));
  L.push('Escola: ' + String(dados.escola || ''));
  L.push('Cidade: ' + String(dados.cidade || ''));
  L.push('Contato: ' + contato.join(' · '));
  L.push('');
  L.push('⏳ E AGORA?');
  L.push('');
  L.push('Sua inscrição seguirá para validação pela equipe do SindEducação-ES.');
  L.push('');
  L.push('Após a aprovação, você receberá o seu ingresso oficial com QR Code, ' +
          'que deverá ser apresentado para acesso ao evento.');
  L.push('');
  L.push('⚠️ IMPORTANTE');
  L.push('');
  L.push('Este e-mail não é o seu ingresso.');
  L.push('');
  L.push('Ele confirma apenas que recebemos sua inscrição. Aguarde a validação ' +
          'e o envio do ingresso oficial com QR Code.');
  L.push('');
  L.push('Encontrou algum dado incorreto? Entre em contato com a Secretaria do ' +
          'SindEducação-ES antes da emissão do ingresso.');
  L.push('');
  L.push('🎉 Inscrição recebida. Agora é só aguardar a validação!');
  L.push('');
  L.push('Nos vemos no Compasso da Vida 2026! 🎶');
  L.push('');
  L.push('SindEducação-ES');

  return L.join('\n');
}

/**
 * Manda a confirmação e carimba o resultado na própria inscrição.
 *
 * O carimbo não é enfeite: sem ele ninguém sabe se a confirmação saiu, e a
 * primeira notícia de que os e-mails pararam viria da fila de telefonemas.
 */
function compasso_confirmarInscricaoPorEmail_(inscricaoId, dados) {
  try {
    if (!dados || !dados.email) return { ok: false, motivo: 'SEM_EMAIL' };
    if (typeof enviarEmailSISGEP_ !== 'function')
      return { ok: false, motivo: 'CAMADA_DE_EMAIL_INDISPONIVEL' };

    var protocolo = compasso_protocoloInscricao_(inscricaoId);
    var r = enviarEmailSISGEP_(
      dados.email,
      'Inscrição recebida — Festa Compasso da Vida 2026 🎶',
      compasso_textoConfirmacao_(dados, protocolo),
      { origem: 'Eventos — Compasso 2026' });

    compasso_carimbarConfirmacao_(inscricaoId, r && r.ok, r && r.mensagem, protocolo);
    return { ok: !!(r && r.ok), protocolo: protocolo };
  } catch (e) {
    /* Chega aqui e a inscrição continua de pé — é o ponto inteiro deste
       try/catch. O que não pode acontecer é a falha sumir: ela vai para o
       documento e para o Logger. */
    try { compasso_carimbarConfirmacao_(inscricaoId, false, e.message, ''); } catch (ignore) {}
    Logger.log('[COMPASSO] confirmação de inscrição falhou: ' + e.message);
    return { ok: false, motivo: e.message };
  }
}

function compasso_carimbarConfirmacao_(inscricaoId, enviou, mensagem, protocolo) {
  var ins = fs_get_('inscricoesEventos', inscricaoId);
  if (!ins) return;
  ins.protocolo = protocolo || ins.protocolo || '';
  if (enviou) {
    ins.confirmacaoEnviadaEm = new Date();
    ins.confirmacaoVia = 'EMAIL';
    ins.confirmacaoErro = '';
  } else {
    ins.confirmacaoErro = String(mensagem || 'falha desconhecida').slice(0, 300);
  }
  fs_set_('inscricoesEventos', inscricaoId, ins);
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