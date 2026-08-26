// ============================================================================
// 📨 ARQUIVO: EventosEntrega.gs
// 🏷️  COMPASSO DA VIDA 2026 — O ingresso chega até a pessoa
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026. A verificação de completude do módulo achou o buraco central:
// a cadeia V2 ia até `compasso_emitirIngressoV2` e PARAVA. O ingresso passava
// a existir no Firestore, o QR era gerado, e o associado nunca ficava sabendo.
// Não havia e-mail, não havia link, não havia nada.
//
// O usuário descreveu o fluxo que quer, e ele é o do ano passado, feito à mão:
// inscrição por formulário → a equipe valida → manda por e-mail e por
// WhatsApp. Palavras dele: "nada vai disparar sozinho... por enquanto ele vai
// ser semiautomatizado". E: "que seja simples porque nem todo associado tem
// tanta habilidade com informática. Agora que seja simples, mas que seja
// confiável."
//
// COMO O INGRESSO CHEGA NO CELULAR — E POR QUE NÃO É ANEXO NO WHATSAPP
//
// O projeto não tem API de WhatsApp, e não vai ter agora. O padrão que já
// existe em três módulos (Parque do China, RH, Visitas) é o `wa.me`: o sistema
// monta o texto, abre o WhatsApp, e QUEM APERTA ENVIAR É GENTE. O `wa.me` não
// anexa arquivo. Então o WhatsApp leva um LINK.
//
// O link é `?page=ingresso&t=<qrToken>`, e o token HMAC É A CREDENCIAL:
//
//   - quem tem o link vê aquele ingresso, e só aquele;
//   - quem não tem não vê nada — o token é HMAC-SHA256, não se adivinha;
//   - não precisa de login, que é o ponto (o associado não tem conta no SISGEP);
//   - não precisa de arquivo no Drive, então não fura a política PRIVATE que
//     o ArquivoDrive.gs estabeleceu em 20/08.
//
// A rota pública MOSTRA o ingresso. Ela NÃO faz check-in. Ver não é entrar —
// se abrir o link consumisse o ingresso, quem conferisse o próprio ingresso
// em casa chegaria na portaria com ele já utilizado.
//
// O E-MAIL LEVA OS DOIS: LINK NO CORPO E PDF ANEXO
//
// Decisão do usuário em 21/08. O link serve para abrir no celular na hora; o
// PDF serve para imprimir, que é o que muita gente vai querer — era assim no
// Blueticket do ano passado.
//
// A ARMADILHA DO PDF, que custou uma descoberta
//
// O EventosIngressoTemplate.html gera o QR com um script de CDN
// (qrcodejs, cdnjs.cloudflare.com). Num PDF gerado por `getAs(MimeType.PDF)`
// esse script NÃO RODA — o conversor renderiza HTML estático, sem JavaScript.
// O QR sairia em branco, e ninguém perceberia até alguém chegar na portaria
// com um papel sem código.
//
// Por isso o PDF usa um caminho próprio: o QR é buscado como PNG no servidor
// (UrlFetchApp) e embutido como data: URI. Mesma lição que o VoucherPdf.gs já
// tinha registrado sobre host externo em conversão de PDF.
//
// O REGISTRO DA ENTREGA
//
// Cada inscrição guarda por onde e quando o ingresso saiu. Sem isso, "já
// mandei para essa pessoa?" só se responde procurando na caixa de e-mail — e
// numa festa de 2.000 pessoas isso não escala. O filtro "A ENVIAR" da tela de
// gestão sai daqui.
//
// O WhatsApp tem um registro em DOIS tempos, de propósito: o sistema não tem
// como saber se a pessoa realmente apertou enviar no aplicativo. Então ele
// prepara, a tela abre o wa.me, e só marca como entregue quando quem enviou
// confirma. Marcar antes seria registrar uma entrega que pode não ter
// acontecido — pior que não registrar.
// ============================================================================

/** Canais de entrega. Um ingresso pode sair pelos dois. */
var COMPASSO_ENTREGA_CANAIS = { EMAIL: 'EMAIL', WHATSAPP: 'WHATSAPP' };

/**
 * URL pública do ingresso. O token é a credencial — ver o cabeçalho.
 * Usa a mesma base do resto do sistema (eventos_obterWebAppUrl usa esta).
 */
function compasso_ingressoUrlPublica_(qrToken) {
  var base = '';
  try {
    base = (typeof getSistemaUrlBase === 'function' && getSistemaUrlBase())
      || ScriptApp.getService().getUrl();
  } catch (e) {
    base = ScriptApp.getService().getUrl();
  }
  return String(base || '') + '?page=ingresso&t=' + encodeURIComponent(String(qrToken || ''));
}

/**
 * Confere um token vindo da URL pública e devolve o ingresso, ou null.
 *
 * Duas checagens, e a ordem importa:
 *   1. o HMAC bate?  → é aritmética local, não custa nada, e descarta lixo
 *      antes de gastar uma leitura do Firestore;
 *   2. o hash existe em qrTokens? → é o que prova que o token foi EMITIDO e
 *      não apenas bem formado.
 *
 * Devolve null para qualquer falha, sem distinguir os casos: dizer "token
 * válido mas ingresso cancelado" para quem tentou adivinhar entrega
 * informação. Quem tem o token de verdade vê o ingresso; o resto vê o mesmo
 * nada.
 */
function compasso_validarQrTokenPublico_(token) {
  token = String(token || '').trim();
  if (!token) return null;

  /* Formato: C26.<ingressoId>.<assinatura> */
  var partes = token.split('.');
  if (partes.length !== 3 || partes[0] !== 'C26') return null;
  var ingressoId = partes[1];
  if (!ingressoId) return null;

  /* 1. o token se auto-verifica: reconstruir a assinatura tem de dar o mesmo. */
  var esperado;
  try { esperado = compasso_gerarQrToken_(ingressoId); } catch (e) { return null; }
  if (esperado !== token) return null;

  /* 2. e ele tem de constar como emitido. */
  var indice;
  try { indice = fs_get_('qrTokens', compasso_hash_(token)); } catch (e) { return null; }
  if (!indice || indice.eventoId !== EMISSAO_CFG.EVENTO_ID) return null;
  if (String(indice.status || '') === 'CANCELADO') return null;

  var ing;
  try { ing = fs_get_('ingressos', indice.ingressoId); } catch (e) { return null; }
  if (!ing || ing.eventoId !== EMISSAO_CFG.EVENTO_ID) return null;
  if (String(ing.status || '') === 'CANCELADO') return null;

  return ing;
}

/**
 * A página pública do ingresso. Chamada pelo doGet — ver Code.gs.
 * MOSTRA o ingresso; NÃO faz check-in. Ver não é entrar.
 */
function compasso_paginaIngressoPublica_(token) {
  var ing = compasso_validarQrTokenPublico_(token);
  if (!ing) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:60px auto;' +
      'padding:28px;border-radius:14px;background:#fff5f5;border:1px solid #fecaca;color:#7f1d1d">' +
      '<h2 style="margin:0 0 10px">Ingresso não encontrado</h2>' +
      '<p style="margin:0;line-height:1.5">Este link não é válido, expirou, ou o ingresso foi ' +
      'cancelado. Fale com a secretaria do SindEducação-ES.</p></div>')
      .setTitle('Ingresso — Compasso da Vida 2026')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  var t = HtmlService.createTemplateFromFile('EventosIngressoTemplate');
  t.dados = {
    ingressoId: ing.ingressoId,
    numero: ing.numero || '',
    nome: ing.nome || '',
    escola: ing.escola || '',
    categoria: compasso_categoriaLabel_(ing.categoria),
    status: ing.status || '',
    email: '', whatsapp: '',   /* a página pública não repete contato */
    qrToken: token,
    arteDataUri: compasso_ingressoArteDataUri_(),
    modoTeste: emissao_modoTeste_()
  };
  return t.evaluate()
    .setTitle('Ingresso ' + (ing.numero || '') + ' — Compasso da Vida 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * QR como PNG embutido, para o PDF.
 *
 * O template usa qrcodejs por CDN, que não roda na conversão para PDF. Aqui o
 * PNG é buscado no servidor e vira data: URI — o conversor não precisa buscar
 * host externo, que é justamente o que ele não faz de forma confiável.
 */
function compasso_qrPngDataUri_(texto) {
  var url = 'https://quickchart.io/qr?margin=1&size=420&text=' +
            encodeURIComponent(String(texto || ''));
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200)
    throw new Error('Não foi possível gerar a imagem do QR Code (HTTP ' +
                    resp.getResponseCode() + ').');
  var blob = resp.getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/**
 * O ingresso em PDF, para anexar no e-mail.
 *
 * Layout próprio, simples de propósito: o template da tela é posicionado em
 * porcentagem sobre a arte e depende de viewport, o que não sobrevive à
 * conversão. Aqui o que importa é ser legível na portaria e no papel.
 */
function compasso_ingressoPdf_(ing, qrToken) {
  var qr = compasso_qrPngDataUri_(qrToken);
  var arte = compasso_ingressoArteDataUri_();
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* AS MEDIDAS SÃO AS MESMAS DO TEMPLATE, EM PIXEL.
     `EventosIngressoTemplate.html` posiciona os campos em % sobre a arte e
     dimensiona a fonte em `vw` — o `vw` é que não sobrevive à conversão,
     porque o conversor não tem viewport. As porcentagens sobrevivem, desde
     que o bilhete tenha tamanho FIXO. Então aqui o bilhete é 1634x962 (a
     proporção da arte) e cada `Xvw` do template vira X% de 1634. */
  var L = 1634, A = 962;
  var px = function (vw) { return (L * vw / 100).toFixed(1) + 'px'; };

  var campo = function (classe, estilo, texto) {
    return '<div class="f ' + classe + '" style="' + estilo + '">' + esc(texto) + '</div>';
  };

  var html =
    '<html><head><meta charset="utf-8"><style>' +
    '@page{size:' + L + 'px ' + A + 'px;margin:0}' +
    'html,body{margin:0;padding:0;background:#fff}' +
    '.t{position:relative;width:' + L + 'px;height:' + A + 'px;overflow:hidden;background:#071a38}' +
    '.art{position:absolute;left:0;top:0;width:' + L + 'px;height:' + A + 'px}' +
    '.f{position:absolute;font-family:Arial,Helvetica,sans-serif;font-weight:bold;' +
      'text-transform:uppercase;line-height:1.12;overflow:hidden;color:#fff}' +
    '.qrBox{position:absolute;left:65.4%;top:57.7%;width:12.4%;height:' +
      (L * 0.124).toFixed(1) + 'px;background:#fff;padding:0.6%}' +
    '.qrBox img{width:100%;height:100%;display:block}' +
    '.teste{position:absolute;left:35%;top:4%;padding:7px 14px;background:#dc2626;color:#fff;' +
      'border-radius:8px;font:bold 15px Arial;letter-spacing:.12em}' +
    '</style></head><body><div class="t">' +
    (arte ? '<img class="art" src="' + arte + '">' : '') +
    (emissao_modoTeste_() ? '<div class="teste">HOMOLOGAÇÃO</div>' : '') +

    /* Frente do bilhete */
    campo('', 'left:67.35%;top:25.7%;width:10.2%;font-size:' + px(1.05), ing.nome) +
    campo('', 'left:67.35%;top:34.4%;width:10.4%;font-size:' + px(1),    ing.escola || '-') +
    campo('', 'left:67.35%;top:43.4%;width:10.3%;font-size:' + px(1.05),
          compasso_categoriaLabel_(ing.categoria)) +
    campo('', 'left:65.3%;top:49.7%;width:12.8%;height:4.6%;color:#111827;font-size:' + px(1.2) +
              ';letter-spacing:.02em;display:flex;align-items:center;justify-content:center',
          ing.numero) +
    '<div class="qrBox"><img src="' + qr + '"></div>' +

    /* Canhoto */
    campo('', 'left:83.3%;top:30.5%;width:14.4%;height:4.8%;color:#b90f3d;font-size:' + px(1.1) +
              ';display:flex;align-items:center;justify-content:center', ing.numero) +
    campo('', 'left:84.7%;top:46.7%;width:13.1%;color:#172033;font-size:' + px(1), ing.nome) +
    campo('', 'left:84.7%;top:58.2%;width:13.1%;color:#172033;font-size:' + px(0.95),
          ing.escola || '-') +
    campo('', 'left:84.7%;top:69.1%;width:13.1%;color:#172033;font-size:' + px(1),
          compasso_categoriaLabel_(ing.categoria)) +

    '</div></body></html>';

  return Utilities.newBlob(html, 'text/html', 'ingresso.html')
    .getAs(MimeType.PDF)
    .setName('Ingresso ' + String(ing.numero || '').replace(/[^\w.-]+/g, '_') + '.pdf');
}

/**
 * O INGRESSO PRONTO PARA A TELA — baixar, imprimir, abrir.
 *
 * O usuário pediu a mesma lógica do ofício: gerar e abrir um lugar com
 * emissão, envio, download, impressão, WhatsApp, e-mail e editar. No ofício o
 * PDF já existe no Drive e tem URL; aqui não — `compasso_ingressoPdf_` monta o
 * PDF na hora, e ele só era usado como anexo do e-mail. Sem isto, "baixar" e
 * "imprimir" não teriam de onde tirar o arquivo.
 *
 * Devolve o PDF em base64 (a tela monta um link `data:` e baixa ou imprime,
 * sem viagem extra ao servidor) e a URL pública do ingresso, que é a mesma que
 * vai no WhatsApp.
 *
 * NÃO registra entrega. Baixar não é entregar — quem entrega é o e-mail ou o
 * WhatsApp, e é lá que o registro acontece. Marcar aqui encheria o filtro
 * "enviadas" de gente que não recebeu nada.
 */
function compasso_ingressoArquivo(inscricaoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — arquivo do ingresso', false);
  var ctx = compasso_contextoEntrega_(inscricaoId);
  if (!ctx.ok) return ctx;

  var pdf = compasso_ingressoPdf_(ctx.ing, ctx.qrToken);
  return {
    ok: true,
    numero: String(ctx.ing.numero || ''),
    nome: String(ctx.ing.nome || ''),
    arquivo: pdf.getName(),
    base64: Utilities.base64Encode(pdf.getBytes()),
    url: compasso_ingressoUrlPublica_(ctx.qrToken)
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   O COMPROVANTE PELO WHATSAPP — 25/08/2026
   ══════════════════════════════════════════════════════════════════════════

   O usuário corrigiu a premissa: "os associados fazem inscrição pelo ZAP".
   Confirmado o desenho — o LINK vai pela lista de transmissão e a pessoa
   preenche a tela —, mas o contato que a maioria deixa é o WhatsApp, não o
   e-mail. A confirmação automática que existe só alcança quem digitou e-mail;
   para o resto, o comprovante não sai.

   POR QUE ISTO NÃO É AUTOMÁTICO. O Apps Script não manda WhatsApp sozinho;
   fazer isso exige uma API externa, com custo e cadastro de modelo de
   mensagem. É trabalho novo, não ajuste — e o usuário escolheu, sabendo
   disso, o caminho de um clique.

   E ISSO CABE, porque o uso real não é disparo em massa: é resposta. Alguém
   pergunta no ZAP "minha inscrição foi?" e a secretaria abre a gaveta e
   responde na hora, com o mesmo texto que o e-mail levaria. Um clique por
   pessoa não escala para 2.000 no pico de inscrições — e não precisa.

   DUAS ETAPAS, como no ingresso: PREPARAR não é ENTREGAR. O sistema não tem
   como saber se a pessoa apertou enviar no aplicativo. Marcar no preparar
   encheria o painel de comprovante que talvez não tenha saído. */
function compasso_prepararConfirmacaoWhatsApp(inscricaoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — comprovante por WhatsApp', false);

  var ins = fs_get_('inscricoesEventos', String(inscricaoId || '').trim());
  if (!ins || ins.eventoId !== EMISSAO_CFG.EVENTO_ID)
    return { ok: false, erro: 'Inscrição não encontrada para este evento.' };

  var fone = String(ins.whatsapp || '').replace(/\D/g, '');
  if (fone.length === 10 || fone.length === 11) fone = '55' + fone;
  if (fone.length < 12)
    return { ok: false, erro: 'Esta inscrição não tem um WhatsApp válido (' +
             (ins.whatsapp || 'vazio') + ').' };

  /* O protocolo é gravado na inscrição pela confirmação por e-mail. Quem só
     deixou WhatsApp nunca passou por lá, então ele nasce aqui — e fica
     gravado, para a secretaria e a pessoa citarem o mesmo número depois. */
  var protocolo = String(ins.protocolo || '') ||
                  compasso_protocoloInscricao_(ins.inscricaoId || inscricaoId);
  if (!ins.protocolo) {
    ins.protocolo = protocolo;
    fs_set_('inscricoesEventos', inscricaoId, ins);
  }

  /* MESMO TEXTO do e-mail, da mesma função. Duas redações para a mesma coisa
     divergem no primeiro ajuste, e aí a pessoa que recebe por um canal lê
     uma promessa diferente da do outro. */
  return {
    ok: true,
    telefone: fone,
    protocolo: protocolo,
    nome: String(ins.nome || ''),
    texto: compasso_textoConfirmacao_(ins, protocolo),
    jaEnviado: !!ins.confirmacaoEnviadaEm,
    enviadoEm: ins.confirmacaoEnviadaEm || null,
    enviadoVia: String(ins.confirmacaoVia || '')
  };
}

/** A segunda etapa: quem confirma que enviou é quem enviou. */
function compasso_confirmarEnvioConfirmacao(inscricaoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — confirmar comprovante enviado', false);

  var ins = fs_get_('inscricoesEventos', String(inscricaoId || '').trim());
  if (!ins || ins.eventoId !== EMISSAO_CFG.EVENTO_ID)
    return { ok: false, erro: 'Inscrição não encontrada para este evento.' };

  ins.confirmacaoEnviadaEm = new Date();
  ins.confirmacaoVia = 'WHATSAPP';
  ins.confirmacaoPor = compasso_emailUsuario_();
  ins.confirmacaoErro = '';
  fs_set_('inscricoesEventos', inscricaoId, ins);

  compasso_auditar_('COMPROVANTE_WHATSAPP', 'inscricao', inscricaoId,
                    { protocolo: ins.protocolo || '' });
  return { ok: true, enviadoEm: ins.confirmacaoEnviadaEm };
}

/** Texto do e-mail e do WhatsApp num lugar só — mudar a redação é um lugar só. */
function compasso_textoEntrega_(ing, url) {
  return 'Olá, ' + String(ing.nome || '').split(' ')[0] + '!\n\n' +
    'Sua inscrição para a FESTA COMPASSO DA VIDA 2026 foi validada e o seu ingresso ' +
    'está pronto.\n\n' +
    'Ingresso: ' + String(ing.numero || '') + '\n' +
    'Abra aqui: ' + url + '\n\n' +
    'Guarde este link. Na entrada, basta apresentar o QR Code — pode ser na tela do ' +
    'celular ou impresso.\n\n' +
    'O ingresso é pessoal e vale para UMA entrada. Não compartilhe o link.\n\n' +
    'SindEducação-ES';
}

/**
 * Manda o ingresso por e-mail: link no corpo e PDF anexo.
 * Decisão do usuário em 21/08 — o link resolve na hora, o PDF serve para imprimir.
 */
/**
 * O E-MAIL DO INGRESSO, no padrão do sistema — 26/08/2026.
 *
 * O usuário, olhando o e-mail de teste: *"e-mail está fora do padrão que foi
 * desenhado"*. Estava mesmo: o corpo era o texto puro quebrado em parágrafos,
 * com o endereço cru do link no meio — endereço de Apps Script tem 180
 * caracteres e o cliente de e-mail o quebra em três linhas, o que faz o
 * ingresso parecer defeito.
 *
 * O que muda: cabeçalho institucional, os dados da festa que o associado
 * precisa (data por extenso, hora e local), o número do ingresso em destaque,
 * e o link como BOTÃO — o endereço não aparece escrito.
 *
 * Os dados do evento vêm de `compasso_dadosDaFesta_()`, que lê o registro do
 * evento e só cai na constante se não houver registro. Assim, corrigir a data
 * no cadastro corrige o e-mail.
 */
function compasso_emailIngressoHtml_(ing, url, temPdf) {
  var f = compasso_dadosDaFesta_();
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var primeiro = String(ing.nome || '').trim().split(' ')[0] || '';
  var quando = compasso_dataPorExtenso_(f.data);
  var hora = f.horaInicio ? ('às ' + f.horaInicio) : '';
  var abertura = f.horaAbertura ? ('Entrada a partir das ' + f.horaAbertura + '.') : '';

  var linha = function (rot, val) {
    if (!val) return '';
    return '<tr><td style="padding:6px 0;font:600 12px Arial;color:#6b7385;' +
           'text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;' +
           'vertical-align:top">' + esc(rot) + '</td>' +
           '<td style="padding:6px 0 6px 16px;font:15px Arial;color:#111827">' +
           esc(val) + '</td></tr>';
  };

  return '' +
  '<div style="background:#f0f4f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
  '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;' +
       'box-shadow:0 2px 8px rgba(0,20,60,.08)">' +

    '<div style="background:#001f4d;padding:22px 26px">' +
      '<div style="font:800 11px Arial;letter-spacing:.14em;color:#C9A84C;' +
           'text-transform:uppercase">SindEducação-ES</div>' +
      '<div style="font:800 20px Arial;color:#fff;margin-top:5px">' +
        'Festa Compasso da Vida 2026</div>' +
    '</div>' +

    '<div style="padding:24px 26px">' +
      '<p style="margin:0 0 14px;font:15px Arial;color:#111827;line-height:1.6">' +
        'Olá, ' + esc(primeiro) + '! Sua inscrição foi validada e o seu ingresso está pronto.</p>' +

      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;' +
           'padding:16px 18px;margin:0 0 18px">' +
        '<div style="font:600 11px Arial;color:#6b7385;text-transform:uppercase;' +
             'letter-spacing:.07em">Ingresso</div>' +
        '<div style="font:800 22px Arial;color:#001f4d;letter-spacing:.03em;margin-top:3px">' +
          esc(ing.numero || '') + '</div>' +
        '<table style="border-collapse:collapse;margin-top:10px">' +
          linha('Quando', quando + (hora ? ' ' + hora : '')) +
          linha('Onde', f.local) +
          linha('Endereço', f.endereco) +
          linha('Referência', f.referencia) +
          linha('Nome', ing.nome) +
        '</table>' +
      '</div>' +

      '<p style="margin:0 0 18px;text-align:center">' +
        '<a href="' + esc(url) + '" style="display:inline-block;background:#001f4d;color:#fff;' +
        'padding:14px 30px;border-radius:10px;text-decoration:none;font:bold 15px Arial">' +
        'Abrir meu ingresso</a></p>' +

      '<p style="margin:0 0 10px;font:14px Arial;color:#475569;line-height:1.6">' +
        'Na entrada, basta apresentar o QR Code — pode ser na tela do celular ou impresso.' +
        (abertura ? ' ' + esc(abertura) : '') + '</p>' +
      (temPdf ? '<p style="margin:0 0 10px;font:14px Arial;color:#475569;line-height:1.6">' +
        'O ingresso também vai anexado em PDF, para imprimir.</p>' : '') +
      '<p style="margin:0;font:13px Arial;color:#6b7385;line-height:1.6">' +
        'O ingresso é pessoal e vale para <b>uma entrada</b>. Não compartilhe o link.</p>' +
    '</div>' +

    '<div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 26px;' +
         'font:12px Arial;color:#94a3b8">SindEducação-ES · ingresso pessoal e intransferível</div>' +
  '</div></div>';
}

function compasso_enviarIngressoEmail(inscricaoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — enviar ingresso por e-mail', false);

  var ctx = compasso_contextoEntrega_(inscricaoId);
  if (!ctx.ok) return ctx;
  if (!ctx.ins.email) return { ok: false, erro: 'Esta inscrição não tem e-mail cadastrado.' };

  var url = compasso_ingressoUrlPublica_(ctx.qrToken);
  var texto = compasso_textoEntrega_(ctx.ing, url);

  var anexos = [];
  var avisoPdf = '';
  try {
    anexos.push(compasso_ingressoPdf_(ctx.ing, ctx.qrToken));
  } catch (ePdf) {
    /* O PDF é o extra; o link é o essencial. Se a conversão falhar, o e-mail
       sai mesmo assim — mas a pessoa fica sabendo que foi sem anexo. */
    avisoPdf = 'O PDF não pôde ser gerado (' + ePdf.message + '). O e-mail foi enviado só com o link.';
  }

  var html = compasso_emailIngressoHtml_(ctx.ing, url, anexos.length > 0);

  var r = enviarEmailSISGEP_(
    ctx.ins.email,
    'Seu ingresso — Festa Compasso da Vida 2026 (' + String(ctx.ing.numero || '') + ')',
    texto,
    { origem: 'Eventos — Compasso 2026', htmlBody: html, attachments: anexos }
  );

  if (!r || !r.ok)
    return { ok: false, erro: 'Falha ao enviar o e-mail: ' + ((r && r.mensagem) || 'motivo desconhecido') };

  var entrega = compasso_registrarEntrega_(ctx.ins, COMPASSO_ENTREGA_CANAIS.EMAIL,
                                           { destino: ctx.ins.email, comPdf: anexos.length > 0 });
  return { ok: true, entrega: entrega, url: url, aviso: avisoPdf,
           mensagem: 'Ingresso enviado para ' + ctx.ins.email + '.' };
}

/**
 * Prepara o WhatsApp. NÃO envia — devolve o telefone e o texto para a tela
 * abrir o wa.me. Quem aperta enviar é gente; ver o cabeçalho.
 */
function compasso_prepararIngressoWhatsApp(inscricaoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — preparar WhatsApp', false);

  var ctx = compasso_contextoEntrega_(inscricaoId);
  if (!ctx.ok) return ctx;

  var fone = String(ctx.ins.whatsapp || '').replace(/\D/g, '');
  if (fone.length === 10 || fone.length === 11) fone = '55' + fone;
  if (fone.length < 12)
    return { ok: false, erro: 'Esta inscrição não tem um WhatsApp válido (' +
             (ctx.ins.whatsapp || 'vazio') + ').' };

  var url = compasso_ingressoUrlPublica_(ctx.qrToken);
  return { ok: true, telefone: fone, texto: compasso_textoEntrega_(ctx.ing, url), url: url,
           nome: ctx.ins.nome || '', numero: ctx.ing.numero || '' };
}

/**
 * Marca que o WhatsApp foi enviado. Passo separado porque o sistema não tem
 * como saber se a pessoa apertou enviar no aplicativo — quem confirma é ela.
 * Marcar junto do preparar registraria entrega que talvez não aconteceu.
 */
function compasso_confirmarEnvioWhatsApp(inscricaoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — confirmar envio por WhatsApp', false);
  var ctx = compasso_contextoEntrega_(inscricaoId);
  if (!ctx.ok) return ctx;
  var entrega = compasso_registrarEntrega_(ctx.ins, COMPASSO_ENTREGA_CANAIS.WHATSAPP,
                                           { destino: ctx.ins.whatsapp || '' });
  return { ok: true, entrega: entrega, mensagem: 'Entrega registrada.' };
}

/**
 * Reúne inscrição + ingresso + token. Todo caminho de entrega começa aqui, e
 * as recusas ficam num lugar só em vez de repetidas em cada função.
 */
function compasso_contextoEntrega_(inscricaoId) {
  var ins = fs_get_('inscricoesEventos', String(inscricaoId || '').trim());
  if (!ins || ins.eventoId !== EMISSAO_CFG.EVENTO_ID)
    return { ok: false, erro: 'Inscrição não encontrada para este evento.' };
  if (!ins.ingressoId)
    return { ok: false, erro: 'Esta inscrição ainda não tem ingresso emitido.' };

  var ing = fs_get_('ingressos', ins.ingressoId);
  if (!ing) return { ok: false, erro: 'Ingresso não encontrado.' };
  if (String(ing.status || '') === 'CANCELADO')
    return { ok: false, erro: 'Ingresso cancelado não pode ser entregue.' };

  /* O token é REGERADO, nunca guardado em texto claro: o que fica gravado é o
     hash. Regerar dá o mesmo valor porque o HMAC é determinístico sobre
     eventoId|ingressoId. */
  return { ok: true, ins: ins, ing: ing, qrToken: compasso_gerarQrToken_(ins.ingressoId) };
}

/** Grava por onde e quando o ingresso saiu. É daqui que sai o filtro A ENVIAR. */
function compasso_registrarEntrega_(ins, canal, detalhes) {
  var agora = new Date();
  var quem = compasso_emailUsuario_();

  ins.entregaCanais = String(ins.entregaCanais || '');
  if (ins.entregaCanais.split(',').indexOf(canal) < 0)
    ins.entregaCanais = ins.entregaCanais ? ins.entregaCanais + ',' + canal : canal;

  ins.entregaEm = agora;
  ins.entregaPor = quem;
  if (canal === COMPASSO_ENTREGA_CANAIS.EMAIL) {
    ins.entregaEmailEm = agora; ins.entregaEmailPor = quem;
  } else {
    ins.entregaWhatsEm = agora; ins.entregaWhatsPor = quem;
  }

  fs_set_('inscricoesEventos', ins.inscricaoId, ins);
  compasso_auditar_('ENTREGA_INGRESSO', 'inscricao', ins.inscricaoId,
                    { canal: canal, detalhes: detalhes || {} });
  return compasso_entregaDaInscricao_(ins);
}

/** Recorte da entrega, para a tela e a auditoria falarem a mesma língua. */
function compasso_entregaDaInscricao_(ins) {
  ins = ins || {};
  var canais = String(ins.entregaCanais || '').split(',').filter(function (c) { return !!c; });
  return {
    canais: canais,
    enviado: canais.length > 0,
    email:    { em: ins.entregaEmailEm || '', por: String(ins.entregaEmailPor || '') },
    whatsapp: { em: ins.entregaWhatsEm || '', por: String(ins.entregaWhatsPor || '') }
  };
}

/* ===========================================================================
 * ENVIO EM LOTE
 *
 * Pedido do usuário em 21/08: "podendo ser enviado por lote ou individual".
 *
 * DUAS TRAVAS REAIS, e o lote respeita as duas ANTES de começar:
 *
 * 1. COTA DO GMAIL. A conta tem um teto diário de envios. Numa festa de 2.000
 *    pessoas isso estoura fácil. `MailApp.getRemainingDailyQuota()` diz quanto
 *    resta — o lote lê isso e AVISA antes, em vez de mandar 87 e falhar no 88
 *    sem ninguém entender por quê.
 *
 * 2. OS 6 MINUTOS do Apps Script. Cada e-mail gera um PDF, e gerar PDF é
 *    lento. Um lote de 380 não cabe numa execução. Então o lote tem orçamento
 *    de tempo e devolve o que FALTA — a tela chama de novo e continua de onde
 *    parou. Mesma disciplina do AuditoriaDrive.gs.
 *
 * O QUE O LOTE NÃO FAZ: WhatsApp. Não dá — cada envio abre uma janela do
 * aplicativo e depende de alguém apertar enviar. Lote é e-mail; o WhatsApp
 * continua um a um, e isso é honesto sobre o que a ferramenta permite.
 * =========================================================================== */

/** Orçamento de tempo. Cabe folgado nos 6 minutos, com margem para o último PDF. */
var COMPASSO_LOTE_SEGUNDOS = 240;

/**
 * Quanto dá para enviar agora. A tela mostra ANTES de a pessoa marcar 300
 * inscrições e descobrir no meio que só cabiam 40.
 */
function compasso_capacidadeEnvio(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — capacidade de envio', false);
  var restantes = -1;
  try { restantes = MailApp.getRemainingDailyQuota(); } catch (e) {}
  return {
    cotaRestante: restantes,
    /* Por execução, não por dia: é o que o tempo permite. O resto continua
       numa próxima chamada. */
    porExecucao: 40,
    aviso: restantes >= 0
      ? 'Restam ' + restantes + ' envios de e-mail hoje nesta conta.'
      : 'Não foi possível ler a cota de e-mail desta conta.'
  };
}

/**
 * Envia o ingresso por e-mail para várias inscrições.
 *
 * @param {Array<string>} inscricaoIds
 * @param {string=} tokenSessao
 * @return {Object} { ok, enviados, falhas, resultados[], restantes[], parcial }
 */
function compasso_enviarLoteEmail(inscricaoIds, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — enviar lote por e-mail', false);

  var fila = (inscricaoIds || []).map(function (x) { return String(x || '').trim(); })
                                 .filter(function (x) { return !!x; });
  if (!fila.length) return { ok: false, erro: 'Nenhuma inscrição selecionada.' };

  var cota = -1;
  try { cota = MailApp.getRemainingDailyQuota(); } catch (e) {}
  if (cota === 0)
    return { ok: false, erro: 'A cota diária de e-mail desta conta acabou. ' +
             'Tente de novo amanhã, ou envie pelo WhatsApp.' };

  var inicio = Date.now();
  var resultados = [], enviados = 0, falhas = 0, i = 0;

  for (i = 0; i < fila.length; i++) {
    if (Date.now() - inicio > COMPASSO_LOTE_SEGUNDOS * 1000) break;
    if (cota >= 0 && enviados >= cota) break;

    var id = fila[i], r;
    /* Uma falha não pode derrubar o lote inteiro: quem não tem e-mail, quem
       ainda não tem ingresso, quem já foi cancelado — cada um vira uma linha
       no relatório e o lote segue. */
    try { r = compasso_enviarIngressoEmail(id, tokenSessao); }
    catch (e) { r = { ok: false, erro: e.message }; }

    if (r && r.ok) { enviados++; resultados.push({ inscricaoId: id, ok: true, mensagem: r.mensagem || '' }); }
    else           { falhas++;  resultados.push({ inscricaoId: id, ok: false, erro: (r && r.erro) || 'falha desconhecida' }); }
  }

  var restantes = fila.slice(i);
  return {
    ok: true,
    enviados: enviados,
    falhas: falhas,
    resultados: resultados,
    restantes: restantes,
    parcial: restantes.length > 0,
    mensagem: restantes.length
      ? enviados + ' enviado(s), ' + falhas + ' com erro. Faltam ' + restantes.length +
        ' — clique em continuar para seguir de onde parou.'
      : enviados + ' enviado(s), ' + falhas + ' com erro. Lote concluído.'
  };
}

/** Diagnóstico pelo editor: mostra a URL pública e prova que o token fecha. */
function diagnosticoEntregaCompasso_() {
  var L = [];
  L.push('═══════════════════════════════════════════════════');
  L.push('  ENTREGA DO INGRESSO — COMPASSO 2026');
  L.push('═══════════════════════════════════════════════════');
  L.push('  Base do web app : ' + compasso_ingressoUrlPublica_('EXEMPLO').split('?')[0]);
  L.push('  Rota do ingresso: ?page=ingresso&t=<qrToken>');
  L.push('');
  L.push('  Token inventado é recusado? ' +
         (compasso_validarQrTokenPublico_('C26.naoexiste.xxxx') === null ? 'SIM ✅' : 'NÃO ⚠️'));
  L.push('  Token vazio é recusado?     ' +
         (compasso_validarQrTokenPublico_('') === null ? 'SIM ✅' : 'NÃO ⚠️'));
  L.push('  Formato errado é recusado?  ' +
         (compasso_validarQrTokenPublico_('qualquer-coisa') === null ? 'SIM ✅' : 'NÃO ⚠️'));
  L.push('');
  L.push('  A rota MOSTRA o ingresso e NÃO faz check-in.');
  L.push('  Ver não é entrar — conferir em casa não pode consumir a entrada.');
  L.push('═══════════════════════════════════════════════════');
  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}
