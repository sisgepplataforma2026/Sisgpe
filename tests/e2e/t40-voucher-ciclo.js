/**
 * O CICLO INTEIRO DO VOUCHER, DA SOLICITAÇÃO AO ENVIO — num arquivo só.
 *
 * Pedido do usuário em 13/08/2026: *"vc precisa testar todo o processo desde
 * a solicitação e prevê os erros e já ajustar"*.
 *
 * Os testes t30 a t37 cobrem os pedaços — período, colunas, envio, tela,
 * memória. O que faltava é o que ninguém tinha executado: a MESMA
 * solicitação atravessando todas as etapas, na ordem, como acontece na vida.
 * Defeito de integração não aparece testando etapa por etapa: aparece quando
 * o que uma etapa grava é lido pela seguinte.
 *
 * O QUE ESTE ARQUIVO NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 * o PDF de verdade (o emulador não converte HTML em PDF), a entrega do
 * e-mail (registra a chamada, não entrega) e o `wa.me` num celular.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");

const CPF = "11144477735";           // CPF válido de teste, não é de ninguém
const NOME = "MARIA DE TESTE SILVA";

function novaSolicitacao(extra) {
  const dados = {
    cpf: CPF, nome: NOME, email: "maria@example.com", telefone: "27999990000",
    escola: "COLEGIO DE TESTE LTDA", modalidade: "GRADUACAO", curso: "Pedagogia",
    regime: "SEMESTRAL", periodo: "2026/1",
    tipoBeneficiario: "TITULAR", nomeBeneficiario: NOME
  };
  Object.keys(extra || {}).forEach(k => { dados[k] = extra[k]; });
  return g.voucherCriarSolicitacao(dados, token);
}

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 1. A solicitação nasce");

g.setupVoucherModuleFase1 && g.setupVoucherModuleFase1();

b.passo("1. Uma solicitação nova grava e devolve protocolo");
const r1 = novaSolicitacao();
b.igual(r1.ok, true, "gravou", r1.mensagem || "");
b.ok(/^BOLSA-/.test(String(r1.protocolo || "")), "com protocolo no formato do módulo", r1.protocolo);
const PROT = r1.protocolo;

b.passo("2. Ela aparece na lista, com os campos que a tela mostra");
const lista = g.listarSolicitacoesCertBolsa(token) || [];
const s = lista.filter(x => x.protocolo === PROT)[0];
b.ok(s, "está na listagem");
/* NASCE PENDENTE — as duas portas de entrada alinhadas.
 *
 * A tela administrativa gravava "ANALISE" fixo, que é o card rotulado
 * "Complementação solicitada": toda solicitação nova nascia afirmando que
 * já tinha sido analisada e que faltava documento, e o card "Aguardando
 * análise" nunca saía de zero. Achado pelo ciclo em 13/08/2026, corrigido
 * no mesmo dia por decisão do usuário. Quem coloca em ANALISE é quem pede
 * complementação — que é o único momento em que a palavra é verdade. */
b.igual(s && s.status, "PENDENTE", "nasce PENDENTE, como pelo portal público");
b.igual(s && s.periodoReferencia, "2026/1", "e o PERÍODO chega como texto legível");
/* O período era o defeito medido na planilha real em 13/08: o Sheets
 * converte "2026/1" em 1º de janeiro de 2026, e a coluna mostrava
 * "Thu Jan 01 2026 05:00:00 GMT-0300". Aqui se prova a normalização. */
b.igual(g.voucherPeriodoTexto_(new Date(2026, 0, 1)), "2026/1",
  "e uma célula já convertida em data volta a ser período");

b.passo("3. A primeira vez é marcada como PRIMEIRA_VEZ");
b.igual(s && s.tipoSolicitacao, "PRIMEIRA_VEZ", "sem renovação onde não houve anterior");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 2. A trava do período");

b.passo("4. A mesma pessoa, mesmo curso, mesmo semestre: recusado");
const r2 = novaSolicitacao();
b.igual(r2.ok, false, "a segunda não grava");
b.igual(r2.duplicado, true, "e é recusada como duplicata");
b.ok(String(r2.mensagem || "").indexOf(PROT) > -1,
  "a recusa diz QUAL protocolo já existe", r2.mensagem);

b.passo("5. A lista continua com uma só");
const qtd = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.nome === NOME).length;
b.igual(qtd, 1, "nada foi gravado pela tentativa recusada");

b.passo("6. Semestre seguinte é renovação, não duplicata");
const r3 = novaSolicitacao({ periodo: "2026/2" });
b.igual(r3.ok, true, "grava", r3.mensagem || "");
const s3 = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.protocolo === r3.protocolo)[0];
b.igual(s3 && s3.tipoSolicitacao, "RENOVACAO", "e vem marcada como renovação");

b.passo("7. Curso diferente no mesmo semestre TAMBÉM é duplicata");
/* INVERTIDO EM 13/08/2026, e o passo estava verde antes disso.
 *
 * A trava chaveava por pessoa + curso + janela: duas bolsas no mesmo
 * semestre em cursos diferentes eram janelas separadas. Medido: o mesmo
 * titular criou TRÊS vouchers para 2026/2.
 *
 * Regra fechada pelo usuário: "para ele mesmo é somente um por semestre ou
 * ano". O benefício é por pessoa e por período, não por matrícula. */
const r4 = novaSolicitacao({ curso: "Direito" });
b.igual(r4.ok, false, "outro curso não abre janela nova", r4.mensagem || "");
b.ok(/somente um por semestre/i.test(r4.mensagem || ""),
  "e a recusa diz a regra", r4.mensagem);
/* Um protocolo que EXISTE, para os passos adiante que precisam de um. */
const r5 = novaSolicitacao({ curso: "Direito", periodo: "2028/1" });
b.ok(r5.ok, "e em janela livre o mesmo pedido passa", r5.mensagem || "");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 3. Análise e aprovação");

b.passo("8. Aprovar muda o status");
/* ACHADO DO CRUZAMENTO, 13/08/2026: a TELA de Vouchers não tem ação de
 * aprovar. Ela lista, emite e envia — as 14 chamadas que ela faz existem
 * todas no backend, e nenhuma delas muda status. Quem aprova é
 * `aprovarSolicitacaoCertBolsa` (VoucherAdmin.gs), chamada de outro lugar.
 * O teste entra por ela, que é o caminho real. */
const ap = g.aprovarSolicitacaoCertBolsa(PROT, "aprovado no teste do ciclo", token);
b.ok(ap && ap.ok !== false, "a aprovação foi aceita", (ap && ap.mensagem) || "");
const sAp = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.protocolo === PROT)[0];
b.igual(sAp && sAp.status, "APROVADO", "e a lista já mostra APROVADO");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 4. O documento");

b.passo("9. A prévia monta o documento sem emitir nada");
const prev = g.gerarDocumentoVoucher(PROT, "PREVIA", { percentual: 70 });
b.igual(prev && prev.ok, true, "a prévia foi gerada", (prev && prev.mensagem) || "");
const html = String((prev && prev.html) || "");

b.passo("10. E o documento sai em A4, em milímetros");
/* Milímetro e não pixel: a conversão do Apps Script não garante 96dpi, e
 * altura em px joga o rodapé para uma segunda página em branco. */
b.ok(/@page\{size:A4 portrait/.test(html), "declara A4 retrato");
b.ok(/width:210mm;min-height:297mm/.test(html), "com a folha em 210×297mm");
b.ok(/@media screen\{/.test(html),
  "e a prévia na tela ganha fundo e sombra — para se ver onde a folha acaba");

b.passo("11. O período aparece no documento como período, não como data");
/* SÓ O TEXTO, sem as imagens. A asserção varria o HTML inteiro e passou a
 * falhar em 13/08/2026 quando o rodapé foi regravado: a sequência "GMT"
 * apareceu por acaso DENTRO do base64 da imagem nova. O teste acusava um
 * defeito que não existe, e um teste que acusa o que não existe é tão ruim
 * quanto um que deixa passar o que existe — nos dois casos ele deixa de ser
 * confiável. Fora os data: URIs, a varredura volta a falar do documento. */
const textoDoc = String(html).replace(/data:[^'"]+/g, "");
b.igual(/Thu |Mon |GMT/.test(textoDoc), false,
  "nenhum resto de Date no texto do certificado");
b.ok(/2026/.test(html), "e o ano está lá");

b.passo("12. O documento traz o que identifica a pessoa");
b.ok(html.indexOf(NOME) > -1, "o nome do beneficiário");
b.ok(/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(html), "o CPF formatado");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 5. A emissão de verdade");

/* Até aqui o teste parava na prévia — que retorna antes de tudo o que
 * importa: PDF, Drive, planilha de emitidos, status, histórico. O emulador
 * tem DriveApp, então o caminho inteiro roda. */

b.passo("13. Solicitação NÃO aprovada não emite certificado");
/* A trava mais importante do módulo: certificado de bolsa é benefício de
 * associado, e emitir para quem não passou pela aprovação é conceder
 * benefício sem conferência — com o documento saindo com cara de legítimo.
 *
 * MINHA PRIMEIRA VERSÃO DESTE PASSO ESTAVA ERRADA, e vale registrar: usei o
 * protocolo que JÁ TINHA SIDO APROVADO no passo 8 e esperei recusa. O
 * sistema emitiu, e por um instante pareceu defeito grave. Não era: APROVAR
 * É VALIDAR — decisão documentada em VoucherAdmin.gs, porque o único lugar
 * que gravava VALIDADO era a confirmação de associação, e quem aprova está
 * declarando que conferiu. O teste é que apontava para o protocolo errado. */
const naoAprovado = g.gerarDocumentoVoucher(r5.protocolo, "CERTIFICADO", { percentual: 70 });
b.igual(naoAprovado.ok, false, "recusa quem não passou pela aprovação");
b.ok(/associa|status/i.test(String(naoAprovado.mensagem || "")),
  "dizendo por quê", naoAprovado.mensagem);

b.passo("14. O protocolo aprovado emite");
const emitido = g.gerarDocumentoVoucher(PROT, "CERTIFICADO", { percentual: 70, rg: "1234567" });
b.igual(emitido.ok, true, "emitiu", emitido.mensagem || "");
b.ok(emitido.codigoValidacao, "com código de validação", emitido.codigoValidacao);
b.ok(emitido.linkPdf, "e com o PDF salvo no Drive", emitido.linkPdf);

b.passo("15. O status vira EMITIDO e o RG fica guardado");
const sEmit = (g.listarSolicitacoesCertBolsa(token) || [])
  .filter(x => x.protocolo === PROT)[0];
b.igual(sEmit && sEmit.status, "EMITIDO", "a lista mostra EMITIDO");
b.igual(sEmit && sEmit.rg, "1234567", "e o RG digitado ficou na linha");

b.passo("16. Emitir de novo NÃO gera segundo documento");
/* Idempotência: dois cliques no botão, ou duas abas abertas, não podem
 * produzir dois certificados com códigos diferentes para o mesmo protocolo —
 * cada um validaria, e a escola receberia dois papéis igualmente legítimos. */
const denovo = g.gerarDocumentoVoucher(PROT, "CERTIFICADO", { percentual: 70 });
b.igual(denovo.ok, true, "responde ok");
b.igual(denovo.reemitido, true, "mas marcado como já emitido");
b.igual(denovo.codigoValidacao, emitido.codigoValidacao,
  "e com o MESMO código — não nasceu um segundo certificado");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 6. Quando quebra, o erro diz ONDE");

b.passo("13. A falha traz a etapa, não só a mensagem do Google");
/* NASCEU DE UM ERRO REAL, 13/08/2026: "Erro ao gerar voucher: This
 * operation is not supported for this document: 1QPpsx...". Esse id é o da
 * PLANILHA, e a mensagem não dizia em que passo o Google recusou. Os três
 * lugares que tocam o Drive já tratam a própria falha, então o erro vinha de
 * fora deles — e sem a etapa não havia por onde começar. */
const quebrado = g.gerarDocumentoVoucher("BOLSA-NAO-EXISTE-999", "PREVIA", {});
b.igual(quebrado.ok, false, "protocolo inexistente é recusado");

/* Força uma quebra de verdade no meio do processo, para ver a etapa sair.
 * Num protocolo AINDA NÃO EMITIDO: a checagem de "já emitido" acontece
 * antes do retorno da prévia, então um protocolo já emitido devolveria
 * "Voucher já emitido" sem chegar na montagem do HTML. */
const originalHtml = g.gerarHtmlDocumentoVoucher_;
g.gerarHtmlDocumentoVoucher_ = function () {
  throw new Error("This operation is not supported for this document: TESTE");
};
const comFalha = g.gerarDocumentoVoucher(r3.protocolo, "PREVIA", { percentual: 70 });
g.gerarHtmlDocumentoVoucher_ = originalHtml;
b.igual(comFalha.ok, false, "a emissão falha");
b.ok(/etapa/i.test(String(comFalha.mensagem || "")),
  "e a mensagem diz a etapa", comFalha.mensagem);
b.ok(/HTML do certificado/.test(String(comFalha.etapa || "")),
  "apontando o passo certo", comFalha.etapa);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 7. O modal do documento");

/* Pedido do usuário em 13/08/2026: "tem que abrir um modal igual ao
 * ofício", "prévia e gerar", "após gerado abre para enviar e-mail e zap,
 * imprimir, baixar". jsdom não desenha, então o que se prova aqui é a
 * LÓGICA: o que abre, o que aparece quando, e o que o botão pede ao
 * servidor. */
const d = require("./dom");
if (!d.jsdomDisponivel()) {
  b.naoTestavel("O modal do documento", "jsdom não instalado neste ambiente");
} else {
  const tela = d.montar(g, ["Scripts_Certificado.html"], { token: token });
  const el = id => tela.doc.getElementById(id);
  const visivel = id => { const e = el(id); return !!e && e.style.display !== "none"; };

  b.passo("17. O modal existe, com os quatro destinos do documento");
  b.ok(el("certDocOverlay"), "o modal está na tela");
  b.ok(el("certDocFrame"), "com moldura para a folha");
  ["certDocImprimir", "certDocBaixar", "certDocEnviar", "certDocGerar"]
    .forEach(id => b.ok(el(id), "botão " + id));

  b.passo("18. Antes de gerar, só imprimir — não há o que enviar nem baixar");
  /* É a regra que dá sentido aos dois estados: antes de gerar é rascunho.
   * Não existe PDF no Drive nem código de validação, então oferecer baixar
   * ou enviar seria oferecer o que não existe. */
  tela.win.certDocAbrir({ protocolo: PROT, nome: NOME, curso: "Pedagogia",
                          status: "APROVADO", periodoReferencia: "2026/1" });
  b.ok(visivel("certDocOverlay"), "o modal abre");
  b.igual(visivel("certDocBaixar"), false, "baixar escondido");
  b.igual(visivel("certDocEnviar"), false, "enviar escondido");
  b.ok(visivel("certDocGerar"), "e gerar disponível");

  b.passo("19. Abrir a prévia NÃO emite");
  const pedidos = tela.chamadas.map(c => c.fn + ":" + JSON.stringify(c.args[1] || ""));
  b.ok(pedidos.some(p => /PREVIA/.test(p)),
    "o modal pede PREVIA ao abrir", pedidos.join(" | "));
  b.igual(pedidos.some(p => /CERTIFICADO/.test(p)), false,
    "e não pede CERTIFICADO — abrir não emite");

  b.passo("20. Depois de emitido, aparecem baixar e enviar, e gerar some");
  tela.win.certDocAbrir({ protocolo: PROT, nome: NOME, curso: "Pedagogia",
                          status: "EMITIDO", periodoReferencia: "2026/1" });
  b.ok(visivel("certDocBaixar"), "baixar aparece");
  b.ok(visivel("certDocEnviar"), "enviar aparece");
  b.igual(visivel("certDocGerar"), false,
    "e gerar some — a segunda emissão devolve o mesmo código, não um novo");
}

/* ══════════════════════════════════════════════════════════════════════
   SEM PERÍODO, A TRAVA DE DUPLICIDADE NÃO TRAVA

   Achado em 13/08/2026 na tela do usuário: duas solicitações com a coluna
   PERÍODO vazia. Parecia campo em branco a mais; era a trava desligada.

   O motivo é simples quando se olha: a trava compara a JANELA de uma
   solicitação com a janela das anteriores. Se a janela é vazia, não há o que
   comparar — e a mesma pessoa, no mesmo curso, passa duas vezes. "Não pode
   gerar duas vezes para a mesma pessoa" (decisão do usuário em 13/08)
   deixava de valer sem ninguém ver, porque o sistema não reclamava de nada.

   A porta pública já exigia o período; a administrativa, não. Este bloco
   existe porque a correção passou por uma bateria de mutação e SOBREVIVEU —
   nenhum teste acusava a remoção da regra. Um teste que não morre quando a
   regra some não protege a regra. */
b.fluxo("VOUCHER · 7b. O período é obrigatório — é ele que sustenta a trava");

b.passo("1. Sem período, a solicitação é recusada na porta administrativa");
const semPeriodo = novaSolicitacao({ cpf: "52998224725", nome: "SEM PERIODO",
  periodo: "" });
b.igual(semPeriodo.ok, false, "não grava");
b.ok(/período de referência/i.test(semPeriodo.mensagem || ""),
  "e diz qual campo falta, com o nome que está na tela", semPeriodo.mensagem);

b.passo("2. E a recusa não é genérica — CPF e nome continuam sendo cobrados");
const semNada = g.voucherCriarSolicitacao({ modalidade: "GRADUACAO" }, token);
b.ok(/CPF válido/.test(semNada.mensagem || "") &&
     /nome do associado/.test(semNada.mensagem || "") &&
     /período de referência/.test(semNada.mensagem || ""),
  "os três faltando saem juntos, numa lista só", semNada.mensagem);

b.passo("3. A linha antiga, sem período, NÃO EMITE");
/* As duas solicitações que o usuário tem na base foram gravadas antes de o
 * período virar obrigatório. Elas continuam lá, e emitir por cima delas seria
 * dar validade ao furo em vez de fechá-lo: o certificado sairia sem dizer a
 * que semestre se refere, e a janela da trava continuaria vazia. */
const shSol = g.SpreadsheetApp.openById(g.PLANILHA_ID)
  .getSheetByName(g.VOUCHER_ABA_SOLICITACOES || "Voucher_Solicitacoes");
const cabSol = shSol.getRange(1,1,1,shSol.getLastColumn()).getValues()[0]
  .map(x => String(x||"").trim());
const colPer = cabSol.indexOf("PERIODO_REFERENCIA");
/* apaga o período de uma linha JÁ criada — é a linha antiga, reproduzida */
for (let i = 2; i <= shSol.getLastRow(); i++) {
  if (String(shSol.getRange(i, cabSol.indexOf("NUMERO_PROTOCOLO")+1).getValue()) === PROT) {
    shSol.getRange(i, colPer+1).setValue("");
  }
}
const semPer = g.gerarDocumentoVoucher(PROT, "CERTIFICADO", {});
b.igual(semPer.ok, false, "a emissão é recusada");
b.ok(/PERÍODO DE REFERÊNCIA/.test(semPer.mensagem || ""),
  "e a mensagem diz o que fazer", semPer.mensagem);
b.igual(semPer.semPeriodo, true, "com a marca que a tela usa para destacar o campo");

b.passo("4. Mas a PRÉVIA continua abrindo — é onde se vê que falta");
/* Travar a prévia esconderia o problema em vez de mostrá-lo. */
const previaSemPer = g.gerarDocumentoVoucher(PROT, "PREVIA", {});
b.ok(previaSemPer.ok !== false || !previaSemPer.semPeriodo,
  "a prévia não é barrada pela falta de período",
  JSON.stringify(previaSemPer.mensagem || "abriu"));

b.passo("5. Com período, a mesma pessoa no mesmo curso é barrada de verdade");
/* É a prova de que a exigência serve para alguma coisa: o par CPF+curso só
 * é bloqueado porque existe uma janela para comparar. */
const p1 = novaSolicitacao({ cpf: "52998224725", nome: "COM PERIODO",
  periodo: "2027/1" });
b.ok(p1.ok, "a primeira entra", p1.protocolo || p1.mensagem);
const p2 = novaSolicitacao({ cpf: "52998224725", nome: "COM PERIODO",
  periodo: "2027/1" });
b.igual(p2.ok, false, "a segunda é barrada");
b.ok(/2027\/1/.test(p2.mensagem || ""),
  "e a mensagem nomeia a janela ocupada", p2.mensagem);

/* ══════════════════════════════════════════════════════════════════════
   ATÉ TRÊS DEPENDENTES — E A EXCEÇÃO DO ENSINO SUPERIOR

   A regra já existia no cálculo do percentual, mas NÃO na criação: testado
   em 13/08/2026, o 4º filho era gravado com protocolo, igual aos outros
   três. Pela tela não acontecia — o seletor só oferece três —, e é
   exatamente por isso que passava despercebido: "a tela não deixa" é
   aparência, não trava. Portal público e chamada direta entram por aqui.

   A exceção é do usuário, no mesmo dia: "máximo são três dependentes ao
   mesmo tempo (menos graduação e pós-graduação)". O teto é do ensino
   básico, onde a convenção escalona 100/100/60 por ordem de filho.
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 7c. Até três dependentes, fora o ensino superior");

function filho(ordem, nome, mod) {
  return g.voucherCriarSolicitacao({
    cpf: "52998224725", nome: "PAI DE FAMILIA",
    modalidade: mod || "ENSINO_FUNDAMENTAL", curso: "Ensino Fundamental",
    regime: "ANUAL", periodo: "2030", tipoBeneficiario: "FILHO",
    beneficiario: nome, ordemFilho: String(ordem)
  }, token);
}

b.passo("1. Os três primeiros entram, um de cada vez");
b.ok(filho(1, "ANA").ok, "1º dependente");
b.ok(filho(2, "BRUNO").ok, "2º dependente");
b.ok(filho(3, "CARLA").ok, "3º dependente");

b.passo("2. O quarto é recusado — e era ele que passava antes");
const quarto = filho(4, "DANIEL");
b.igual(quarto.ok, false, "não grava");
b.ok(/3º dependente/.test(quarto.mensagem || ""),
  "e a mensagem diz o teto, não uma recusa genérica", quarto.mensagem);

b.passo("3. No superior o teto de ORDEM não se aplica — mas o de CONTAGEM sim");
/* DUAS REGRAS DIFERENTES, e eu tinha misturado as duas de manhã:
 *
 *   - o escalonamento 1º/2º/3º (100/100/60) é do ensino básico, e é dele que
 *     vem a recusa "a convenção prevê até o 3º dependente";
 *   - o teto de TRÊS DEPENDENTES por período vale para todo mundo, e foi
 *     confirmado pelo usuário sem exceção: "dependente é no máximo 3".
 *
 * Então o 4º em graduação não é recusado pela ordem — é recusado pela
 * contagem, e a mensagem tem que ser a da contagem, com os nomes de quem já
 * ocupa as três vagas. Mensagem errada manda quem atende procurar no lugar
 * errado. */
const quartoSuperior = filho(4, "ELISA", "GRADUACAO");
b.igual(quartoSuperior.ok, false, "o 4º dependente é barrado também no superior");
b.ok(/já tem 3 dependentes/.test(quartoSuperior.mensagem || ""),
  "pela CONTAGEM, e a mensagem nomeia quem ocupa as vagas",
  quartoSuperior.mensagem);
b.ok(!/convenção prevê/.test(quartoSuperior.mensagem || ""),
  "e não pela ordem, que é regra do ensino básico");

b.passo("4. A vaga é POR JANELA — o semestre seguinte começa do zero");
/* Sem isto o teto viraria "três dependentes para sempre": a família que usou
 * as três vagas em 2030 nunca mais poria ninguém. Mutação que sobreviveu na
 * primeira bateria — ignorar a janela na contagem não quebrava nada. */
const outraJanela = filho(1, "DANIEL", "ENSINO_FUNDAMENTAL");
b.ok(false === outraJanela.ok, "em 2030 o quarto continua barrado");
const proxJanela = g.voucherCriarSolicitacao({
  cpf: "52998224725", nome: "PAI DE FAMILIA", modalidade: "ENSINO_FUNDAMENTAL",
  curso: "Ensino Fundamental", regime: "ANUAL", periodo: "2031",
  tipoBeneficiario: "FILHO", beneficiario: "DANIEL", ordemFilho: "1"
}, token);
b.igual(proxJanela.ok, true,
  "mas em 2031 ele entra — as vagas de 2030 não valem para 2031",
  proxJanela.mensagem || "");

b.passo("5. O TITULAR não ocupa vaga de dependente");
/* Três filhos e o pai estudando são QUATRO bolsas, e é isso mesmo: o teto de
 * três é dos dependentes, e o titular é barrado por outro caminho (uma por
 * período, qualquer curso). Outra mutação que sobreviveu: fazer o titular
 * contar não quebrava teste nenhum. */
const paiTambem = g.voucherCriarSolicitacao({
  cpf: "52998224725", nome: "PAI DE FAMILIA", modalidade: "GRADUACAO",
  curso: "Administracao", regime: "ANUAL", periodo: "2030",
  tipoBeneficiario: "TITULAR", beneficiario: "PAI DE FAMILIA"
}, token);
b.igual(paiTambem.ok, true,
  "o pai entra mesmo com as três vagas de dependente ocupadas",
  paiTambem.mensagem || "");
/* E a dele, sim, é uma só. */
const paiDeNovo = g.voucherCriarSolicitacao({
  cpf: "52998224725", nome: "PAI DE FAMILIA", modalidade: "POS_GRADUACAO",
  curso: "MBA", regime: "ANUAL", periodo: "2030",
  tipoBeneficiario: "TITULAR", beneficiario: "PAI DE FAMILIA"
}, token);
b.igual(paiDeNovo.ok, false, "e a segunda dele, em outro curso, é barrada");

b.passo("6. O titular PRIMEIRO, e os três filhos depois — todos entram");
/* ESTA É A ORDEM QUE EXPÕE A REGRA, e a outra não expunha.
 *
 * No passo 5 os filhos entram antes do pai, então a contagem nunca chega a
 * ver um titular na janela — e fazer o titular contar não quebrava nada. A
 * mutação sobreviveu por isso. Invertendo a ordem, o pai já está lá quando o
 * terceiro filho é contado: se ele ocupasse vaga, o terceiro seria recusado.
 *
 * CPF próprio, para não depender do que os passos anteriores deixaram. */
const CPF_FAM = "40157625080";
function daFamilia(extra) {
  return g.voucherCriarSolicitacao(Object.assign({
    cpf: CPF_FAM, nome: "MAE DE FAMILIA", modalidade: "ENSINO_FUNDAMENTAL",
    curso: "Ensino Fundamental", regime: "ANUAL", periodo: "2033"
  }, extra), token);
}
const mae = daFamilia({ tipoBeneficiario: "TITULAR", beneficiario: "MAE DE FAMILIA",
  modalidade: "GRADUACAO", curso: "Pedagogia" });
b.ok(mae.ok, "a titular entra primeiro", mae.mensagem || "");
["GABRIEL", "HELENA", "IGOR"].forEach(function (nome, i) {
  const r = daFamilia({ tipoBeneficiario: "FILHO", beneficiario: nome,
    ordemFilho: String(i + 1) });
  b.ok(r.ok, "e o " + (i + 1) + "º filho (" + nome + ") entra depois dela",
    r.mensagem || "");
});
/* Quatro bolsas na mesma janela: uma da titular e três dos filhos. */
const quartoFilho = daFamilia({ tipoBeneficiario: "FILHO", beneficiario: "JULIA",
  ordemFilho: "3" });
b.igual(quartoFilho.ok, false, "e só o QUARTO filho é barrado");
b.ok(/já tem 3 dependentes/.test(quartoFilho.mensagem || ""),
  "pela contagem de dependentes, sem contar a mãe", quartoFilho.mensagem);

b.passo("7. Cada dependente é uma solicitação — a trava é por beneficiário");
/* Confirmado no emulador em 13/08/2026: dois filhos diferentes do mesmo
 * associado, no mesmo curso e período, passam os dois; o MESMO filho
 * repetido é barrado. É o comportamento certo — o benefício é de quem
 * estuda, não do titular. */
const anaDeNovo = filho(1, "ANA");
b.igual(anaDeNovo.ok, false, "a mesma ANA de novo é barrada");
b.ok(/já existe/i.test(anaDeNovo.mensagem || ""),
  "pela trava de duplicidade, não pelo teto", anaDeNovo.mensagem);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VOUCHER · 8. O que ainda não dá para provar aqui");

b.naoTestavel("O PDF de verdade",
  "getAs(MimeType.PDF) não existe no emulador; A4 se confere abrindo o arquivo");
b.naoTestavel("A entrega do e-mail e o anexo",
  "o emulador registra a chamada, não entrega — item 16 de PENDENTE-VERIFICACAO");
b.naoTestavel("O período gravado como texto na planilha real",
  "o apóstrofo protetor só se confere no Sheets; o emulador não converte nada");

b.resumo();
process.exit(0);
