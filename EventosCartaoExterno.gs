/**
 * CARTÃO DO ASSOCIADO A PARTIR DE INGRESSO EMITIDO FORA — 18/09/2026
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O QUE ESTE ARQUIVO FAZ, E O QUE ELE DELIBERADAMENTE NÃO FAZ.
 *
 * Decisão do usuário, dita três vezes em 17 e 18/09/2026:
 *
 *   "Os ingressos serão emitidos pela Blueticket, validados pela Blueticket.
 *    Só que o QR Code da Blueticket, os ingressos emitidos por ela, eu anexo
 *    no SISGEP. O SISGEP vai gerar o mesmo ingresso, bonito, com o mesmo QR
 *    Code, com as informações do associado, e a gente envia pelo zap."
 *
 * E o motivo, que é o que dá a régua para tudo aqui:
 *
 *   "Eu tô com receio de chegar na hora da festa e o aplicativo não funcionar,
 *    o QR Code não ler. O aplicativo da Blueticket já funciona, já foi
 *    testado, já me dá o quantitativo: quantos entraram, quantos faltaram."
 *
 * ┌──────────────────────────────────┬────────────────────────────────────┐
 * │ Emitir o ingresso e dar o número │ Blueticket                         │
 * │ Ler na portaria e contar entrada │ aplicativo da Blueticket           │
 * │ Desenhar o cartão do associado   │ SISGEP (este arquivo)              │
 * │ Enviar ao associado              │ SISGEP, pelo WhatsApp              │
 * │ Validar, marcar usado, contar    │ NINGUÉM AQUI — não é nosso         │
 * └──────────────────────────────────┴────────────────────────────────────┘
 *
 * O SISGEP NÃO É PONTO ÚNICO DE FALHA. Se este módulo inteiro parar na véspera
 * da festa, a secretaria imprime o PDF da Blueticket e a festa acontece igual.
 * Essa é a propriedade mais valiosa do desenho, e nenhuma funcionalidade nova
 * pode custá-la: nada aqui pode virar pré-requisito para alguém entrar.
 *
 * POR QUE O MESMO QR FUNCIONA — medido, não suposto (17/09/2026)
 *
 * Decodifiquei o QR de dois ingressos reais, de anos e fornecedores
 * diferentes:
 *
 *   2023 · VENUE Entretenimento · "Um Brinde à Vida" ....... "83719045"
 *   2025 · Final Touch Eventos  · "No Ritmo da Vida" ....... "76902432"
 *
 * Nos dois, o QR carrega SÓ O NÚMERO do ingresso — o mesmo que vem impresso
 * embaixo dele e no nome do arquivo PDF. Não há URL, assinatura nem dado da
 * pessoa. Dois QR com o mesmo conteúdo são o mesmo QR para qualquer leitor:
 * o aplicativo da portaria não sabe, e não tem como saber, quem desenhou o
 * cartão em volta.
 *
 * O QUE ISSO IMPLICA, E PRECISA FICAR ESCRITO: a segurança do ingresso está
 * inteira na base da Blueticket, não no código. Quem souber um número válido
 * monta um QR idêntico. Isso JÁ ERA ASSIM antes de nós — redesenhar o cartão
 * não piora nem melhora. O que não se pode é alguém ler este arquivo e achar
 * que o QR autentica alguma coisa.
 *
 * O PDF DA BLUETICKET NÃO TEM TEXTO. Conferido com `pdftotext` (saída vazia) e
 * `pdfimages` (uma única imagem): o ingresso é um JPEG colado numa página. Por
 * isso o nome do associado NÃO sai do arquivo por leitura de texto — ele vem
 * da planilha de controle, do cadastro, ou do olho de quem importa. O número,
 * esse sim, sai de dois lugares independentes (nome do arquivo e o próprio
 * QR), e a tela compara os dois: divergiu, não passa.
 */

var CARTAO_EXTERNO_ABA_ = "Eventos_CartoesExternos";
var CARTAO_EXTERNO_ABA_CFG_ = "Eventos_CartoesExternos_Evento";

var CARTAO_EXTERNO_COLUNAS_ = [
  "NUMERO", "NOME", "ESCOLA", "CPF", "TELEFONE", "SETOR", "TIPO",
  "ORIGEM_NUMERO", "STATUS", "LINK_CARTAO", "ARQUIVO_ORIGEM",
  "IMPORTADO_EM", "IMPORTADO_POR", "GERADO_EM", "ENVIADO_EM", "OBSERVACAO"
];

/* Os estados, e o que cada um quer dizer na tela. Não há "VALIDADO" nem
   "UTILIZADO" nesta lista de propósito: quem sabe disso é a Blueticket. */
var CARTAO_EXTERNO_STATUS_ = {
  SEM_NOME: "Importado, falta o nome",
  PRONTO:   "Pronto para gerar",
  GERADO:   "Cartão gerado",
  ENVIADO:  "Enviado ao associado"
};

function cartaoExterno_aba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CARTAO_EXTERNO_ABA_);
  if (!sh) {
    sh = ss.insertSheet(CARTAO_EXTERNO_ABA_);
    sh.getRange(1, 1, 1, CARTAO_EXTERNO_COLUNAS_.length)
      .setValues([CARTAO_EXTERNO_COLUNAS_]);
    sh.setFrozenRows(1);
    return sh;
  }

  /* COLUNA NOVA ENTRA NO FIM, e o que já está gravado não se mexe.
     A ESCOLA foi acrescentada depois que a aba já existia (19/09/2026). Se a
     coluna simplesmente não existir, `mapRowToObject_` devolve undefined e o
     cartão sai sem escola — em silêncio, que é o pior jeito de faltar dado.
     Acrescentar no fim preserva a posição de todas as outras. */
  var atuais = obterHeaders_(sh).map(function (h) { return String(h || "").trim(); });
  var faltando = CARTAO_EXTERNO_COLUNAS_.filter(function (c) { return atuais.indexOf(c) === -1; });
  if (faltando.length) {
    sh.getRange(1, atuais.length + 1, 1, faltando.length).setValues([faltando]);
  }
  return sh;
}

/* ══ OS DADOS DO EVENTO, UMA VEZ PARA O LOTE INTEIRO ══════════════════════
   Data, local e nome do evento são iguais em todos os ingressos — repeti-los
   linha a linha só criaria oportunidade de divergirem entre si. */
function cartaoExterno_cfgAba_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(CARTAO_EXTERNO_ABA_CFG_);
  if (!sh) {
    sh = ss.insertSheet(CARTAO_EXTERNO_ABA_CFG_);
    sh.getRange(1, 1, 1, 2).setValues([["CHAVE", "VALOR"]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* PRIVADA (termina em "_") POR EXIGÊNCIA DE SEGURANÇA, e não por estilo.
   Nasceu pública e o t6 acusou na hora: toda função global sem "_" no fim é
   endpoint de google.script.run alcançável por QUALQUER página, inclusive as
   públicas — e esta devolvia a configuração do evento sem pedir sessão.
   Quem precisa da configuração na tela já a recebe dentro de
   cartaoExterno_listar, que é travada. */
function cartaoExterno_lerCfg_() {
  var sh = cartaoExterno_cfgAba_();
  var cfg = { evento: "", data: "", local: "", cidade: "", rodape: "", arte: "" };
  if (sh.getLastRow() < 2) return cfg;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (l) {
    var k = String(l[0] || "").trim();
    if (k) cfg[k] = String(l[1] == null ? "" : l[1]);
  });
  return cfg;
}

function cartaoExterno_salvarCfg(cfg, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "eventos", "Cartão externo — dados do evento", false);
  cfg = cfg || {};
  var sh = cartaoExterno_cfgAba_();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  var linhas = ["evento", "data", "local", "cidade", "rodape", "arte"].map(function (k) {
    return [k, String(cfg[k] == null ? "" : cfg[k]).trim()];
  });
  sh.getRange(2, 1, linhas.length, 2).setValues(linhas);
  return { ok: true, cfg: cartaoExterno_lerCfg_() };
}

/* ══ IMPORTAÇÃO ═══════════════════════════════════════════════════════════
   Recebe o que a tela leu dos PDFs. O número é obrigatório; o nome, não —
   linha sem nome nasce em SEM_NOME e aparece na fila de quem resolve.

   REIMPORTAR O MESMO NÚMERO ATUALIZA, NÃO DUPLICA. A secretaria vai baixar o
   lote mais de uma vez (alguém pediu segunda via, o lote veio incompleto), e
   dois cartões com o mesmo número circulando é exatamente o tipo de confusão
   que a portaria descobre na fila. */
function cartaoExterno_importar(itens, tokenSessao) {
  var sessao = exigirAdminOuSessao_(tokenSessao, "eventos", "Cartão externo — importar", false);
  itens = Array.isArray(itens) ? itens : [];
  if (!itens.length) return { ok: false, mensagem: "Nenhum ingresso foi lido dos arquivos." };

  var sh = cartaoExterno_aba_();
  var headers = obterHeaders_(sh);
  var existentes = cartaoExterno_indicePorNumero_(sh, headers);
  var agora = new Date();
  var quem = (sessao && (sessao.nome || sessao.usuario)) || "";

  var novos = 0, atualizados = 0, recusados = [];
  var paraAnexar = [];

  itens.forEach(function (it) {
    it = it || {};
    var numero = cartaoExterno_numeroLimpo_(it.numero);
    if (!numero) { recusados.push(String(it.arquivo || "(sem nome de arquivo)")); return; }

    var nome = valorSeguroVoucher_(it.nome);
    var registro = {
      NUMERO: numero,
      NOME: nome,
      ESCOLA: valorSeguroVoucher_(it.escola),
      CPF: String(it.cpf || "").replace(/\D/g, ""),
      TELEFONE: String(it.telefone || "").replace(/\D/g, ""),
      SETOR: String(it.setor || "Cortesia").trim(),
      TIPO: String(it.tipo || "Cortesia").trim(),
      ORIGEM_NUMERO: String(it.origemNumero || "").trim(),
      STATUS: nome ? "PRONTO" : "SEM_NOME",
      LINK_CARTAO: "",
      ARQUIVO_ORIGEM: String(it.arquivo || "").trim(),
      IMPORTADO_EM: agora,
      IMPORTADO_POR: quem,
      GERADO_EM: "",
      ENVIADO_EM: "",
      OBSERVACAO: String(it.observacao || "").trim()
    };

    var linha = existentes[numero];
    if (linha) {
      /* O que já foi gerado e enviado NÃO volta atrás numa reimportação: só
         os dados descritivos são atualizados. Apagar um envio registrado
         faria a secretaria mandar o mesmo cartão duas vezes. */
      var atual = mapRowToObject_(headers, sh.getRange(linha, 1, 1, headers.length).getValues()[0]);
      registro.LINK_CARTAO = atual.LINK_CARTAO || "";
      registro.GERADO_EM   = atual.GERADO_EM || "";
      registro.ENVIADO_EM  = atual.ENVIADO_EM || "";
      registro.IMPORTADO_EM = atual.IMPORTADO_EM || agora;
      if (!registro.NOME && atual.NOME) registro.NOME = atual.NOME;
      if (!registro.ESCOLA && atual.ESCOLA) registro.ESCOLA = atual.ESCOLA;
      if (!registro.CPF && atual.CPF) registro.CPF = atual.CPF;
      if (!registro.TELEFONE && atual.TELEFONE) registro.TELEFONE = atual.TELEFONE;
      registro.STATUS = cartaoExterno_statusDe_(registro);
      sh.getRange(linha, 1, 1, headers.length)
        .setValues([headers.map(function (h) { return registro[h] == null ? "" : registro[h]; })]);
      atualizados++;
    } else {
      paraAnexar.push(headers.map(function (h) { return registro[h] == null ? "" : registro[h]; }));
      existentes[numero] = true;
      novos++;
    }
  });

  if (paraAnexar.length) {
    sh.getRange(sh.getLastRow() + 1, 1, paraAnexar.length, headers.length).setValues(paraAnexar);
  }

  return {
    ok: novos + atualizados > 0,
    novos: novos,
    atualizados: atualizados,
    recusados: recusados,
    mensagem: novos + atualizados === 0
      ? "Nenhum ingresso pôde ser importado — nenhum arquivo trouxe número."
      : (novos + " novo(s), " + atualizados + " atualizado(s)" +
         (recusados.length ? ", " + recusados.length + " sem número" : "") + ".")
  };
}

/** O status sai dos dados, nunca é escolhido à mão em dois lugares. */
function cartaoExterno_statusDe_(reg) {
  if (reg.ENVIADO_EM) return "ENVIADO";
  if (reg.LINK_CARTAO) return "GERADO";
  return reg.NOME ? "PRONTO" : "SEM_NOME";
}

/* SÓ DÍGITOS, E SEM ZERO À ESQUERDA PERDIDO. O número é a chave que casa com
   a Blueticket; "0076902432" e "76902432" são a mesma pessoa para o olho e
   duas linhas diferentes para a planilha. */
function cartaoExterno_numeroLimpo_(valor) {
  var n = String(valor == null ? "" : valor).replace(/\D/g, "");
  if (!n) return "";
  n = n.replace(/^0+/, "");
  return n || "";
}

function cartaoExterno_indicePorNumero_(sh, headers) {
  var idx = {};
  if (sh.getLastRow() < 2) return idx;
  var iNum = headers.indexOf("NUMERO");
  var dados = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  dados.forEach(function (linha, i) {
    var n = cartaoExterno_numeroLimpo_(linha[iNum]);
    if (n) idx[n] = i + 2;
  });
  return idx;
}

/* ══ LISTAGEM ═════════════════════════════════════════════════════════════ */
function cartaoExterno_listar(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "eventos", "Cartão externo — listar", false);
  var sh = cartaoExterno_aba_();
  var headers = obterHeaders_(sh);
  var itens = [];
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues().forEach(function (linha) {
      var o = mapRowToObject_(headers, linha);
      if (!cartaoExterno_numeroLimpo_(o.NUMERO)) return;
      itens.push({
        numero: cartaoExterno_numeroLimpo_(o.NUMERO),
        nome: String(o.NOME || ""),
        escola: String(o.ESCOLA || ""),
        cpf: String(o.CPF || ""),
        telefone: String(o.TELEFONE || ""),
        setor: String(o.SETOR || ""),
        tipo: String(o.TIPO || ""),
        status: String(o.STATUS || ""),
        statusLabel: CARTAO_EXTERNO_STATUS_[String(o.STATUS || "")] || String(o.STATUS || ""),
        linkCartao: String(o.LINK_CARTAO || ""),
        arquivo: String(o.ARQUIVO_ORIGEM || ""),
        observacao: String(o.OBSERVACAO || "")
      });
    });
  }
  var contagem = { SEM_NOME: 0, PRONTO: 0, GERADO: 0, ENVIADO: 0 };
  itens.forEach(function (i) { if (contagem[i.status] != null) contagem[i.status]++; });
  return { ok: true, itens: itens, contagem: contagem, total: itens.length,
           cfg: cartaoExterno_lerCfg_() };
}

/* ══ DAR NOME A QUEM ESTÁ SEM ═════════════════════════════════════════════
   O caminho preferido é o CPF: ele traz nome e telefone do cadastro, e o
   telefone é o que permite mandar pelo zap sem redigitar (REGRA Nº 0.6). */
function cartaoExterno_vincular(numero, dados, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "eventos", "Cartão externo — vincular associado", false);
  dados = dados || {};
  numero = cartaoExterno_numeroLimpo_(numero);
  if (!numero) return { ok: false, mensagem: "Informe o número do ingresso." };

  var sh = cartaoExterno_aba_();
  var headers = obterHeaders_(sh);
  var linha = cartaoExterno_indicePorNumero_(sh, headers)[numero];
  if (!linha) return { ok: false, mensagem: "Ingresso " + numero + " não foi importado." };

  var reg = mapRowToObject_(headers, sh.getRange(linha, 1, 1, headers.length).getValues()[0]);
  var cpf = String(dados.cpf || "").replace(/\D/g, "");

  if (cpf) {
    /* A CONSULTA É A MESMA QUE O VOUCHER USA (VoucherCadastro.gs). Duas
       funções lendo a base de associados divergiriam no primeiro ajuste que
       alguém fizesse numa delas. */
    var achado = null;
    try { achado = consultarAssociadoNaBase_(cpf); } catch (e) { achado = null; }
    if (achado && achado.encontrado && achado.cadastro) {
      reg.CPF = cpf;
      reg.NOME = valorSeguroVoucher_(achado.cadastro.nome) || reg.NOME;
      reg.TELEFONE = String(achado.cadastro.telefone || reg.TELEFONE || "").replace(/\D/g, "");
      /* A ESCOLA SAI DO CADASTRO, não é perguntada. É o dado que o sistema já
         tem e que ninguém deveria redigitar — e no cartão ela é o que faz a
         portaria e o próprio associado reconhecerem de quem é o ingresso,
         quando há dois homônimos na fila. */
      reg.ESCOLA = valorSeguroVoucher_(achado.cadastro.escolaAtual) || reg.ESCOLA;
      reg.OBSERVACAO = "Nome, escola e telefone vieram do cadastro de associados.";
    } else {
      reg.CPF = cpf;
      reg.OBSERVACAO = "CPF informado não foi localizado no cadastro.";
    }
  }

  if (dados.nome) reg.NOME = valorSeguroVoucher_(dados.nome);
  if (dados.escola) reg.ESCOLA = valorSeguroVoucher_(dados.escola);
  if (dados.telefone) reg.TELEFONE = String(dados.telefone).replace(/\D/g, "");
  if (dados.setor) reg.SETOR = String(dados.setor).trim();

  reg.STATUS = cartaoExterno_statusDe_(reg);
  sh.getRange(linha, 1, 1, headers.length)
    .setValues([headers.map(function (h) { return reg[h] == null ? "" : reg[h]; })]);

  return { ok: true, numero: numero, nome: reg.NOME, telefone: reg.TELEFONE,
           status: reg.STATUS, observacao: reg.OBSERVACAO };
}

/* ══ O CARTÃO ═════════════════════════════════════════════════════════════
   O desenho segue o Design System (OficiosStyles.html): navy em gradiente,
   régua dourada, Plus Jakarta Sans, card branco. Não é paleta nova.

   O QR SAI COMO PNG EMBUTIDO, pelo mesmo caminho já provado do ingresso da
   Festa (compasso_qrPngDataUri_): o conversor de PDF do Apps Script não roda
   script de CDN, e o QR sairia EM BRANCO sem ninguém perceber até a portaria.

   NÍVEL DE CORREÇÃO H. Com oito dígitos o QR cabe na menor versão mesmo no
   nível mais alto — ou seja, sai do mesmo tamanho e aguenta dobra, reflexo e
   papel amassado muito melhor. É ganho sem custo, e a portaria é o lugar onde
   isso se paga.

   E O NÚMERO VAI IMPRESSO EMBAIXO DO QR, grande, como a Blueticket faz. É o
   que salva a fila quando a tela do celular está escura: a portaria digita o
   número no aplicativo deles. */
function cartaoExterno_qrDataUri_(numero) {
  var url = "https://quickchart.io/qr?margin=2&ecLevel=H&size=420&text=" +
            encodeURIComponent(String(numero || ""));
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Não foi possível gerar a imagem do QR Code (HTTP " +
                    resp.getResponseCode() + ").");
  }
  var blob = resp.getBlob();
  return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
}

function cartaoExterno_html_(reg, cfg, qrDataUri, arteDataUri) {
  cfg = cfg || {};
  arteDataUri = String(arteDataUri || "");
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function bloco(rotulo, valor, classe) {
    if (!String(valor || "").trim()) return "";
    return '<div class="linha"><div class="rot">' + esc(rotulo) + '</div>' +
           '<div class="val' + (classe ? " " + classe : "") + '">' + valor + '</div></div>';
  }

  var local = esc(cfg.local || "");
  if (cfg.cidade) local += (local ? "<br>" : "") + esc(cfg.cidade);

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Ingresso ' + esc(reg.NUMERO) + '</title><style>' +
    ':root{--navy:#001f4d;--navy2:#002f6c;--gold:#C9A84C;--texto:#111827;' +
    '--suave:#6b7385;--linha:#d8e0ea;--fundo:#eef2f8}' +
    '*{box-sizing:border-box}' +
    "body{margin:0;background:var(--fundo);color:var(--texto);" +
    "font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;" +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:18px}' +
    '.cartao{width:420px;max-width:100%;background:#fff;border-radius:20px;overflow:hidden;' +
    'box-shadow:0 18px 50px rgba(16,24,40,.18)}' +
    '.topo{background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;' +
    'padding:22px 22px 18px;text-align:center}' +
    /* A ARTE É FAIXA NO TOPO, e o texto continua no bloco navy embaixo dela.
       Pôr o nome do evento POR CIMA da arte seria mais bonito e imprevisível:
       arte clara engole texto branco, arte carregada engole qualquer texto, e
       quem descobre é a pessoa que recebeu o cartão. Faixa separada aceita
       qualquer arte sem negociar legibilidade. */
    '.arte{display:block;width:100%;aspect-ratio:16/7;object-fit:cover;' +
    'background:var(--navy)}' +
    '.topo.compacto{padding:16px 22px 14px}' +
    '.selo{display:inline-block;border:1px solid rgba(201,168,76,.6);color:var(--gold);' +
    'border-radius:999px;padding:4px 14px;font-size:11px;font-weight:800;letter-spacing:.14em}' +
    '.marca{margin-top:12px;font-size:12px;font-weight:700;letter-spacing:.18em;opacity:.85}' +
    'h1{margin:6px 0 0;font-size:23px;font-weight:800;line-height:1.2}' +
    '.regua{height:3px;background:linear-gradient(90deg,var(--gold),#f0c843,var(--gold))}' +
    '.corpo{padding:20px 22px 6px}' +
    '.linha{padding:11px 0;border-bottom:1px dashed var(--linha)}' +
    '.linha:last-child{border-bottom:0}' +
    '.rot{font-size:10px;font-weight:800;letter-spacing:.14em;color:var(--suave);' +
    'text-transform:uppercase}' +
    '.val{font-size:16px;font-weight:600;margin-top:3px;line-height:1.35}' +
    '.val.nome{font-size:19px;font-weight:800;color:var(--navy)}' +
    '.qrarea{padding:18px 22px 22px;text-align:center}' +
    '.qrcaixa{display:inline-block;background:#fff;border:1px solid var(--linha);' +
    'border-radius:14px;padding:10px;line-height:0}' +
    '.qrcaixa img{width:212px;height:212px;display:block}' +
    '.numero{margin-top:10px;font-size:27px;font-weight:800;letter-spacing:.16em;color:var(--navy)}' +
    '.dica{margin-top:4px;font-size:12px;color:var(--suave)}' +
    '.rodape{background:#f7f9fc;border-top:1px solid var(--linha);padding:14px 22px;' +
    'font-size:11px;color:var(--suave);text-align:center;line-height:1.5}' +
    '@media print{body{background:#fff;padding:0;display:block}' +
    '.cartao{box-shadow:none;width:100%;border:1px solid var(--linha)}}' +
    '</style></head><body><div class="cartao">' +
    (arteDataUri ? '<img class="arte" src="' + arteDataUri + '" alt="">' : '') +
    '<div class="topo' + (arteDataUri ? ' compacto' : '') + '"><div class="selo">' + esc(reg.TIPO || "CORTESIA").toUpperCase() + '</div>' +
    '<div class="marca">SINDEDUCAÇÃO-ES</div>' +
    '<h1>' + esc(cfg.evento || "Evento") + '</h1></div>' +
    '<div class="regua"></div><div class="corpo">' +
    bloco("Nome", esc(reg.NOME), "nome") +
    bloco("Escola", esc(reg.ESCOLA)) +
    bloco("Data", esc(cfg.data)) +
    bloco("Local", local) +
    bloco("Setor", esc(reg.SETOR)) +
    '</div><div class="qrarea">' +
    '<div class="qrcaixa"><img src="' + qrDataUri + '" alt=""></div>' +
    '<div class="numero">' + esc(reg.NUMERO) + '</div>' +
    '<div class="dica">Apresente este cartão na entrada</div></div>' +
    '<div class="rodape">' +
    esc(cfg.rodape || "Ingresso emitido pela plataforma de bilheteria do evento.") +
    '<br>Cartão gerado pelo SISGEP · SindEducação-ES</div>' +
    '</div></body></html>';
}

/**
 * Gera o cartão de UM ingresso e guarda o PDF no Drive.
 *
 * NÃO GERA PARA QUEM NÃO TEM NOME. Um cartão com o campo do nome vazio é pior
 * do que cartão nenhum: parece pronto, vai para o zap, e a pessoa recebe um
 * ingresso que não diz de quem é.
 */
function cartaoExterno_gerar(numero, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "eventos", "Cartão externo — gerar cartão", false);
  numero = cartaoExterno_numeroLimpo_(numero);
  if (!numero) return { ok: false, mensagem: "Informe o número do ingresso." };

  var sh = cartaoExterno_aba_();
  var headers = obterHeaders_(sh);
  var linha = cartaoExterno_indicePorNumero_(sh, headers)[numero];
  if (!linha) return { ok: false, mensagem: "Ingresso " + numero + " não foi importado." };

  var reg = mapRowToObject_(headers, sh.getRange(linha, 1, 1, headers.length).getValues()[0]);
  reg.NUMERO = numero;
  if (!String(reg.NOME || "").trim()) {
    return { ok: false, mensagem: "O ingresso " + numero + " está sem nome. " +
             "Vincule o associado antes de gerar o cartão." };
  }

  var cfg = cartaoExterno_lerCfg_();
  if (!String(cfg.evento || "").trim()) {
    return { ok: false, mensagem: "Informe o nome, a data e o local do evento antes de gerar." };
  }

  var qr = cartaoExterno_qrDataUri_(numero);
  var arte = cartaoExterno_arteDataUri_(cfg.arte);
  var html = cartaoExterno_html_(reg, cfg, qr, arte);
  var nomeArquivo = "Ingresso - " + cfg.evento + " - " + numero + " - " + reg.NOME + ".pdf";
  var pdf = Utilities.newBlob(html, MimeType.HTML, nomeArquivo).getAs(MimeType.PDF);
  pdf.setName(nomeArquivo);

  var pasta = cartaoExterno_pasta_();
  var arquivo = pasta.createFile(pdf);
  try { arquivoAplicarPolitica_(arquivo); } catch (e) {}

  reg.LINK_CARTAO = arquivo.getUrl();
  reg.GERADO_EM = new Date();
  reg.STATUS = cartaoExterno_statusDe_(reg);
  sh.getRange(linha, 1, 1, headers.length)
    .setValues([headers.map(function (h) { return reg[h] == null ? "" : reg[h]; })]);

  return { ok: true, numero: numero, nome: reg.NOME, link: reg.LINK_CARTAO,
           mensagem: "Cartão de " + reg.NOME + " gerado." };
}

/**
 * A ARTE DO EVENTO, embutida como data: URI.
 *
 * MESMO MOTIVO DO QR: o conversor de PDF do Apps Script não busca host
 * externo de forma confiável, e uma arte que "às vezes carrega" produz cartão
 * que às vezes sai sem imagem — sem erro, sem aviso, e só quem recebeu vê.
 *
 * ACEITA ID DO DRIVE OU ENDEREÇO. É o que a secretaria tem na mão: ora o
 * arquivo está no Drive do sindicato, ora é um link que o pessoal da arte
 * mandou. Exigir um formato só seria exigir que ela convertesse.
 *
 * E NÃO ESTOURA POR CAUSA DE IMAGEM. Arte que não carrega devolve vazio e o
 * cartão sai com o bloco navy de sempre — o ingresso continua válido, porque
 * o que a portaria lê é o QR. Derrubar a geração inteira por causa de uma
 * figura seria trocar um cartão feio por nenhum cartão.
 */
function cartaoExterno_arteDataUri_(origem) {
  origem = String(origem || "").trim();
  if (!origem) return "";
  try {
    var idDrive = origem;
    var achado = origem.match(/[-\w]{25,}/);
    if (/drive\.google\.com|docs\.google\.com/.test(origem) && achado) idDrive = achado[0];

    var blob = null;
    if (/^[-\w]{25,}$/.test(idDrive)) {
      blob = DriveApp.getFileById(idDrive).getBlob();
    } else if (/^https?:\/\//.test(origem)) {
      var resp = UrlFetchApp.fetch(origem, { muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) return "";
      blob = resp.getBlob();
    }
    if (!blob) return "";

    var tipo = String(blob.getContentType() || "");
    if (tipo.indexOf("image/") !== 0) return "";
    return "data:" + tipo + ";base64," + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    Logger.log("cartaoExterno_arteDataUri_ falhou: " + e.message);
    return "";
  }
}

/* A PASTA SAI DE getRecursoId_, como a do Voucher: homologação e produção não
   podem escrever na mesma pasta. Sem recurso configurado, cai na raiz do
   Drive do projeto — e diz isso na observação, em vez de estourar. */
function cartaoExterno_pasta_() {
  var pastaId = "";
  try { pastaId = String(getRecursoId_("EVENTOS_CARTOES") || "").trim(); } catch (e) { pastaId = ""; }
  if (pastaId) return DriveApp.getFolderById(pastaId);
  var nome = "SISGEP - Cartoes de Ingresso";
  var existentes = DriveApp.getFoldersByName(nome);
  return existentes.hasNext() ? existentes.next() : DriveApp.createFolder(nome);
}

/**
 * Gera em lote todos os que estão PRONTO.
 *
 * O LIMITE EXISTE PORQUE O APPS SCRIPT TEM SEIS MINUTOS. Cada cartão faz uma
 * chamada de rede (o QR) e uma conversão para PDF; num lote de duzentos, a
 * execução morre no meio e ninguém sabe onde parou. Gerar em blocos e voltar
 * dizendo quantos faltam é o que permite retomar sem repetir.
 */
function cartaoExterno_gerarLote(limite, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "eventos", "Cartão externo — gerar em lote", false);
  limite = Math.max(1, Math.min(40, Number(limite) || 20));

  var lista = cartaoExterno_listar(tokenSessao);
  var pendentes = lista.itens.filter(function (i) { return i.status === "PRONTO"; });
  var alvo = pendentes.slice(0, limite);

  var gerados = [], falhas = [];
  alvo.forEach(function (i) {
    var r;
    try { r = cartaoExterno_gerar(i.numero, tokenSessao); }
    catch (e) { r = { ok: false, mensagem: e.message }; }
    if (r && r.ok) gerados.push(r.numero);
    else falhas.push({ numero: i.numero, mensagem: (r && r.mensagem) || "erro" });
  });

  var restam = Math.max(0, pendentes.length - alvo.length);
  return {
    ok: gerados.length > 0,
    gerados: gerados.length,
    falhas: falhas,
    restam: restam,
    mensagem: gerados.length + " cartão(ões) gerado(s)" +
      (restam ? ", faltam " + restam + " — clique de novo para continuar" : "") +
      (falhas.length ? ", " + falhas.length + " com erro" : "") + "."
  };
}

/** Marca como enviado. Quem envia é a secretaria, pelo zap; aqui fica o registro. */
function cartaoExterno_marcarEnviado(numero, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "eventos", "Cartão externo — marcar enviado", false);
  numero = cartaoExterno_numeroLimpo_(numero);
  var sh = cartaoExterno_aba_();
  var headers = obterHeaders_(sh);
  var linha = cartaoExterno_indicePorNumero_(sh, headers)[numero];
  if (!linha) return { ok: false, mensagem: "Ingresso " + numero + " não foi importado." };

  var reg = mapRowToObject_(headers, sh.getRange(linha, 1, 1, headers.length).getValues()[0]);
  if (!reg.LINK_CARTAO) {
    return { ok: false, mensagem: "Gere o cartão antes de marcar como enviado." };
  }
  reg.ENVIADO_EM = new Date();
  reg.STATUS = cartaoExterno_statusDe_(reg);
  sh.getRange(linha, 1, 1, headers.length)
    .setValues([headers.map(function (h) { return reg[h] == null ? "" : reg[h]; })]);
  return { ok: true, numero: numero, status: reg.STATUS };
}
