// ============================================================================
// ARQUIVO: CotaEmail.gs
// O GOVERNADOR DA COTA DE E-MAIL DO SISGEP
// ============================================================================
//
// DE ONDE VEIO, 11/09/2026. O usuário, pedindo a comunicação da Taxa Negocial
// para a base inteira de escolas:
//
//   "tem que ver a questão da cota de emails por dia, se chegar próximo da
//    cota ele trava, joga para o dia seguinte"
//
// Está certo, e o sistema não sabia fazer isso. O que existia era teto escrito
// no código, cego: o `TaxaAssistencial.gs` manda 100 por hora e reagenda,
// SEM CONSULTAR A COTA UMA ÚNICA VEZ (zero ocorrências de
// getRemainingDailyQuota no arquivo). Com 679 escolas isso termina em sete
// horas — e disparo desse tamanho foi o que estourou o limite em 09/09 e de
// novo em 10/09, matando quatro ofícios que ninguém soube que morreram.
//
// O ORÇAMENTO É UM SÓ E NINGUÉM ERA DONO DELE. Ofícios, Taxa Assistencial,
// Recibos, Despesas, Guias, Eventos — cada um com seu próprio laço, todos
// gastando da mesma conta do Gmail, nenhum sabendo dos outros. O primeiro a
// rodar levava tudo; o resto descobria batendo a cara.
//
// A REGRA DESTE ARQUIVO, e ela é curta:
//
//     QUEM ENVIA EM LAÇO PERGUNTA ANTES.
//     QUEM ENVIA UM SÓ, NÃO PERGUNTA.
//
// A reserva É o orçamento dos avulsos. É por isso que este conserto não exige
// migrar os ~21 arquivos que chamam sendEmail direto: eles continuam gastando
// da reserva, e as campanhas nunca encostam nela. Migrar todos é outra tarefa,
// e não é pré-requisito desta.
//
// ⚠ O QUE ESTE ARQUIVO MEDE, E O QUE ELE NÃO ALCANÇA — ler antes de confiar.
//
// `MailApp.getRemainingDailyQuota()` conta DESTINATÁRIOS. O que estourou em
// 09/09 foi o limite de CHAMADAS ao serviço Gmail: às 11h53 o medidor dizia
// "96 restantes" e às 11h56 o envio morreu. São contadores diferentes, e o
// Google não expõe o segundo.
//
// Então este governador é a PRIMEIRA linha, não a única. A segunda continua
// sendo `oficio_ehLimiteDoGmail_` (EmailOficios.gs), que reconhece a recusa
// quando ela chega e devolve veredito "COTA" — ausência de notícia sobre o
// ofício, e não erro dele. Uma não substitui a outra:
//
//     o governador   evita chegar perto      (antes de enviar)
//     o reconhecedor evita condenar o ofício (quando o Google recusa)
//
// Prometer aqui uma proteção que o dado não sustenta seria pior do que não
// ter: alguém confiaria nela.
// ============================================================================

/* TODAS AS FUNCOES DAQUI TERMINAM EM `_`, E ISSO NAO E ESTILO.
   No Apps Script, funcao global SEM underline vira endpoint para QUALQUER
   pagina do projeto, inclusive as anonimas que o Code.gs serve. A primeira
   versao deste arquivo expunha tres delas e o t6 reprovou na hora: 206 contra
   teto de 204. A pior era a que MUDA a reserva — zera-la drena a cota do
   sindicato, infla-la trava todo envio, e nenhuma das duas pede senha.
   Quando houver tela, o acesso vem por uma funcao da campanha com
   exigirModulo_, e nao abrindo estas. */

/** Quanto fica reservado para o resto do SISGEP. O número é do usuário. */
var COTA_EMAIL_RESERVA_PADRAO = 40;

var COTA_EMAIL_PROP_RESERVA = "COTA_EMAIL_RESERVA";
var COTA_EMAIL_PROP_PREFIXO = "COTA_EMAIL_DIA_";

/** A chave do contador carrega o DIA. Virou o dia, o contador nasce zerado —
 *  sem rotina de limpeza, que é coisa que se esquece de instalar. */
function cotaEmail_chaveDoDia_(campanha) {
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  return COTA_EMAIL_PROP_PREFIXO + String(campanha || "GERAL") + "_" + hoje;
}

function cotaEmail_reserva_() {
  var v = parseInt(PropertiesService.getScriptProperties()
            .getProperty(COTA_EMAIL_PROP_RESERVA), 10);
  return (isNaN(v) || v < 0) ? COTA_EMAIL_RESERVA_PADRAO : v;
}

function cotaEmail_definirReserva_(n) {
  var v = parseInt(n, 10);
  if (isNaN(v) || v < 0) throw new Error("Reserva inválida: " + n);
  PropertiesService.getScriptProperties().setProperty(COTA_EMAIL_PROP_RESERVA, String(v));
  return cotaEmail_reserva_();
}

function cotaEmail_jaEnviadoHoje_(campanha) {
  var v = parseInt(PropertiesService.getScriptProperties()
            .getProperty(cotaEmail_chaveDoDia_(campanha)), 10);
  return isNaN(v) ? 0 : v;
}

/**
 * Conta o que saiu. Chamar DEPOIS do envio dar certo — contar antes faz o
 * orçamento encolher por tentativa que falhou, e a fila para sem motivo.
 */
function cotaEmail_registrarEnvio_(campanha, quantos) {
  var n = parseInt(quantos, 10);
  if (isNaN(n) || n <= 0) return cotaEmail_jaEnviadoHoje_(campanha);
  var props = PropertiesService.getScriptProperties();
  var chave = cotaEmail_chaveDoDia_(campanha);
  var novo  = cotaEmail_jaEnviadoHoje_(campanha) + n;
  props.setProperty(chave, String(novo));
  return novo;
}

/**
 * O ORÇAMENTO DE HOJE, para esta campanha.
 *
 * `disponivel` é o MENOR entre o que a cota do Google permite depois da
 * reserva e o que o teto da campanha ainda deixa. Os dois limites existem por
 * motivos diferentes e nenhum pode ser ignorado: a reserva protege o resto do
 * SISGEP, o teto protege a própria campanha de fazer num dia o que deveria
 * fazer em vinte.
 *
 * `motivo` diz QUAL dos dois está mandando, porque a ação é diferente: em
 * RESERVA a pessoa espera a cota renovar; em TETO ela pode aumentar o teto se
 * o prazo apertar. Devolver só um número esconderia essa escolha dela.
 */
function cotaEmail_orcamentoDoDia_(campanha, tetoDia) {
  var cotaGoogle = 0;
  try { cotaGoogle = Number(MailApp.getRemainingDailyQuota()) || 0; }
  catch (e) { cotaGoogle = 0; }

  var reserva       = cotaEmail_reserva_();
  var jaEnviadoHoje = cotaEmail_jaEnviadoHoje_(campanha);

  var folgaCota = Math.max(0, cotaGoogle - reserva);

  var teto = parseInt(tetoDia, 10);
  var folgaTeto = (isNaN(teto) || teto <= 0) ? null : Math.max(0, teto - jaEnviadoHoje);

  var disponivel = (folgaTeto === null) ? folgaCota : Math.min(folgaCota, folgaTeto);

  var motivo = "OK";
  if (disponivel <= 0) motivo = (folgaTeto !== null && folgaTeto <= 0) ? "TETO" : "RESERVA";

  return {
    campanha:      String(campanha || "GERAL"),
    cotaGoogle:    cotaGoogle,
    reserva:       reserva,
    tetoDia:       (folgaTeto === null) ? null : teto,
    jaEnviadoHoje: jaEnviadoHoje,
    disponivel:    disponivel,
    motivo:        motivo,
    mensagem:      cotaEmail_mensagem_(motivo, disponivel, cotaGoogle, reserva)
  };
}

/**
 * Quem lê isto é a secretaria, não um programador. A mensagem diz o que
 * aconteceu, por que, e o que acontece a seguir — porque "cota esgotada"
 * sozinho faz a pessoa tentar de novo agora, que é o que mais gasta.
 */
function cotaEmail_mensagem_(motivo, disponivel, cotaGoogle, reserva) {
  if (motivo === "OK") {
    return "Cabem " + disponivel + " envio(s) hoje.";
  }
  if (motivo === "TETO") {
    return "O teto de hoje desta campanha já foi alcançado. Ela continua " +
           "amanhã, sozinha. Se o prazo estiver apertado, o teto pode ser aumentado.";
  }
  return "O limite diário de e-mail do Google está no fim (restam " + cotaGoogle +
         ", e " + reserva + " ficam reservados para o resto do sistema). " +
         "A campanha continua amanhã, sozinha. Não é preciso refazer nada.";
}

/**
 * "Posso mandar mais um agora?" — a pergunta que todo laço de envio faz.
 *
 * Devolve quantos cabem, nunca mais do que o pedido. Zero significa PARE: o
 * laço deve sair e reagendar, sem gastar tentativa de ninguém. Ver a nota da
 * FilaOficios sobre por que cota não é veredito sobre o ofício.
 */
function cotaEmail_quantosCabem_(campanha, quantosQueria, tetoDia) {
  var orc = cotaEmail_orcamentoDoDia_(campanha, tetoDia);
  var querido = parseInt(quantosQueria, 10);
  if (isNaN(querido) || querido < 0) querido = 0;
  orc.cabem = Math.min(orc.disponivel, querido);
  return orc;
}
