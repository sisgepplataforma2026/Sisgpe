/**
 * COMPASSO 2026 — O REGISTRO DE QUEM ENTROU
 * ============================================================================
 *
 * O QUE ORIGINOU, 15/09/2026. Ele: *"preciso ver como vai ficar o registro do
 * ingresso lido"*.
 *
 * Fui olhar, e a resposta era: não fica. O check-in gravava um documento
 * completo em `checkinsEventos` — hora, quem leu, qual aparelho, se foi
 * manual e por quê — e NENHUM lugar do sistema lia aquilo. A coleção aparecia
 * duas vezes no projeto inteiro, as duas gravando.
 *
 * Na portaria, o que a pessoa vê é uma faixa verde por 2,5 segundos. Depois
 * some. Na noite da festa, ninguém conseguiria responder "quantos já
 * entraram?" — nem abrindo a planilha.
 *
 * E FALTAVA A OUTRA METADE: recusa não deixava rastro nenhum. QR já
 * utilizado, ingresso cancelado, ingresso de outro evento — a portaria
 * mostrava o ❌ e o sistema esquecia. Quem fosse barrado na porta e
 * reclamasse depois não teria o que consultar.
 *
 * ── POR QUE UM DOCUMENTO-RESUMO, E NÃO UMA LISTAGEM ──────────────────────
 *
 * A tela atualiza sozinha a cada 15 segundos, a noite inteira. Se ela
 * listasse `checkinsEventos`, cada atualização custaria uma leitura POR
 * DOCUMENTO — `fs_list_` pagina a coleção toda, sem parar antes. Com 2.000
 * entradas seriam 2.000 leituras a cada 15 segundos: perto de meio milhão por
 * hora, contra uma faixa gratuita de 50 mil por dia.
 *
 * Estourar a cota no dia 19/12 significa portaria parada com fila na porta —
 * é o risco número 1 do painel executivo desde agosto.
 *
 * Então o resumo é um documento só, atualizado dentro do MESMO lock do
 * check-in, com os contadores e uma janela rolante dos últimos eventos. A
 * tela inteira custa UMA leitura por atualização: 240 por hora.
 *
 * `checkinsEventos` continua sendo gravado e continua sendo o registro
 * permanente — completo, um documento por entrada. O resumo é a VISTA, não a
 * verdade. Quem precisar do histórico inteiro depois do evento tem tudo lá.
 */

/** Quantos eventos a janela rolante guarda. 60 cabe numa tela sem rolar muito
    e mantém o documento pequeno — cerca de 10 KB, contra o teto de 1 MB. */
var COMPASSO_REGISTRO_JANELA = 60;

function compasso_registroVazio_() {
  return {
    eventoId: EMISSAO_CFG.EVENTO_ID,
    entraram: 0, recusas: 0, manuais: 0,
    ultimos: [],          /* janela rolante, mais recente primeiro */
    atualizadoEm: null
  };
}

/**
 * Anota uma leitura — a que entrou e a que foi barrada.
 *
 * Roda DENTRO do lock de quem chamou. Nunca deixa a exceção subir: falhar ao
 * anotar o registro não pode impedir alguém de entrar na festa. O
 * check-in é a operação; isto aqui é a vista dele.
 */
function compasso_registroAnotar_(evento) {
  try {
    var reg = fs_get_('checkinResumo', EMISSAO_CFG.EVENTO_ID) || compasso_registroVazio_();
    if (!Array.isArray(reg.ultimos)) reg.ultimos = [];

    if (evento.tipo === 'ENTROU') {
      reg.entraram = Number(reg.entraram || 0) + 1;
      if (evento.manual) reg.manuais = Number(reg.manuais || 0) + 1;
    } else {
      reg.recusas = Number(reg.recusas || 0) + 1;
    }

    /* Data em TEXTO, nunca objeto: o retorno atravessa o google.script.run, e
       Date no pacote faz o navegador receber NULL sem erro e sem log. Foi o
       que derrubou o painel em 14/09 — ver EventosExecutivo.gs. */
    reg.ultimos.unshift({
      tipo:      String(evento.tipo || ''),
      em:        new Date().toISOString(),
      nome:      String(evento.nome || ''),
      numero:    String(evento.numero || ''),
      escola:    String(evento.escola || ''),
      categoria: String(evento.categoria || ''),
      por:       String(evento.por || ''),
      dispositivo: String(evento.dispositivo || ''),
      manual:    !!evento.manual,
      motivo:    String(evento.motivo || ''),
      /* Na recusa é isto que explica o ❌ para quem está na porta. */
      codigo:    String(evento.codigo || ''),
      detalhe:   String(evento.detalhe || '')
    });
    if (reg.ultimos.length > COMPASSO_REGISTRO_JANELA)
      reg.ultimos = reg.ultimos.slice(0, COMPASSO_REGISTRO_JANELA);

    reg.atualizadoEm = new Date().toISOString();
    fs_set_('checkinResumo', EMISSAO_CFG.EVENTO_ID, reg);
  } catch (e) {
    Logger.log('Registro de check-in não anotado: ' + e.message);
  }
}

/**
 * O QUE A TELA LÊ. Uma leitura de documento, e nada mais.
 *
 * `faltam` sai do contador de emissão, que já é mantido em `contadores` —
 * uma segunda leitura de DOCUMENTO. Listar os ingressos para contar custaria
 * uma leitura por ingresso, que é exatamente o que este arquivo evita.
 */
function compasso_checkinRegistro(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — registro de entrada', false);

  var reg = fs_get_('checkinResumo', EMISSAO_CFG.EVENTO_ID) || compasso_registroVazio_();
  var ultimos = Array.isArray(reg.ultimos) ? reg.ultimos : [];

  /* RITMO DOS ÚLTIMOS 10 MINUTOS. Sai da janela rolante, sem ir ao servidor
     de novo. Se a janela inteira couber dentro dos 10 minutos, o número é um
     piso — e a tela diz isso, em vez de fingir precisão que não tem. */
  var corte = Date.now() - 10 * 60000;
  var recentes = 0, janelaCheia = ultimos.length >= COMPASSO_REGISTRO_JANELA;
  var maisAntigoNaJanela = null;
  for (var i = 0; i < ultimos.length; i++) {
    if (ultimos[i].tipo !== 'ENTROU') continue;
    var t = new Date(ultimos[i].em).getTime();
    if (isNaN(t)) continue;
    maisAntigoNaJanela = t;
    if (t >= corte) recentes++;
  }
  var pisoApenas = janelaCheia && maisAntigoNaJanela !== null && maisAntigoNaJanela >= corte;

  /* QUANTOS INGRESSOS EXISTEM. Uma segunda leitura de documento — o contador
     de emissão, que já é mantido. Listar os ingressos para contar custaria
     uma leitura por ingresso, que é exatamente o que este arquivo existe para
     evitar. */
  var emitidos = 0;
  try { emitidos = Number((fs_get_('contadores', EMISSAO_CFG.EVENTO_ID) || {}).vagasUsadas || 0); }
  catch (e) { emitidos = 0; }

  return {
    ok: true,
    /* VIAJA AQUI, e não numa função própria: a tela só precisa disto para
       decidir se desenha o botão de zerar, e abrir mais uma global sem `_`
       custaria uma linha no teto de exposição (204, e ele só desce) sem
       entregar nada em troca. Mesma decisão do `admin` em
       compasso_validacaoOpcoes. */
    homologacao: emissao_modoTeste_(),
    emitidos: emitidos,
    faltam: Math.max(0, emitidos - Number(reg.entraram || 0)),
    entraram: Number(reg.entraram || 0),
    recusas: Number(reg.recusas || 0),
    manuais: Number(reg.manuais || 0),
    ultimos10min: recentes,
    ritmoEhPiso: pisoApenas,
    janela: COMPASSO_REGISTRO_JANELA,
    ultimos: ultimos,
    atualizadoEm: reg.atualizadoEm || null
  };
}

/**
 * ADMIN: zera o registro.
 *
 * Existe por causa do ensaio. Ele vai ler QR de teste muitas vezes em
 * homologação, e sem isto os contadores da noite real começariam sujos. Em
 * produção é recusado — zerar o registro de entrada durante a festa apagaria
 * a única resposta para "quantos entraram".
 */
function compasso_checkinRegistroZerar(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — zerar registro de entrada', true);
  compasso_assertHomologacao_();
  fs_set_('checkinResumo', EMISSAO_CFG.EVENTO_ID, compasso_registroVazio_());
  compasso_auditar_('ZERAR_REGISTRO_CHECKIN', 'evento', EMISSAO_CFG.EVENTO_ID, {});
  return { ok: true, mensagem: 'Registro de entrada zerado.' };
}
