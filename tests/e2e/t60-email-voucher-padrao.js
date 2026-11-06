/**
 * TESTE — O E-MAIL DO CERTIFICADO ESTÁ NO PADRÃO SISGEP
 *
 * O QUE ORIGINOU
 *
 * O usuário, em 18/08/2026, depois de confirmar que o envio voltou a
 * funcionar: "só precisa ajustar o texto para ficar no padrão Sisgep" —
 * e mandou o print de como estava saindo.
 *
 * O e-mail do voucher era de outra família visual: Arial, faixa lisa com
 * só "SindEducação-ES" (saindo CORTADA no topo, no print dele), dados
 * soltos no meio do texto e rodapé de duas linhas cinza. Quem recebe um
 * ofício e depois um certificado via dois remetentes diferentes.
 *
 * QUEM ASSINA O QUÊ — definido por ele na mesma conversa, e é a parte que
 * mais fácil se perde numa edição futura:
 *
 *     CERTIFICADO (o PDF anexo) .... Leonil Dias da Silva, presidente
 *     E-MAIL (a mensagem) .......... Marcelha, do administrativo
 *
 * Não é detalhe de estilo: quem responde o e-mail tem que cair em quem
 * atende, não na presidência.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: como o
 * e-mail aparece no Gmail, no Outlook e no celular. Cliente de e-mail
 * ignora e reescreve CSS a seu critério — isso se confere abrindo a
 * mensagem recebida.
 */
const b = require("./base");
const r = b.subir({});
const g = r.g;

b.fluxo("E-MAIL DO CERTIFICADO · Padrão SISGEP e assinatura certa");

const dados = {
  nome: "WANDERSON NASCIMENTO CASTELO",
  protocolo: "BOLSA-2026-920837",
  codigo: "VAL-20260818202726-3635",
  curso: "MARKETING",
  periodo: "2027/2",
  percentual: "70",
  linkPdf: "https://drive.google.com/file/d/1AbCd/view"
};
const html = g.voucherCorpoEmail_(dados);

/* ═══════════════════════════════════════════════════════════
   1. Quem assina o e-mail é a Marcelha
   ═══════════════════════════════════════════════════════════ */
b.passo("1");
b.ok(html.indexOf("MARCELHA ALINE PINTO GOMES") > -1,
  "o rodapé do e-mail traz a Marcelha, do administrativo",
  "quem responder o e-mail tem que cair em quem atende");
b.ok(/Administrativo/.test(html), "com o cargo dela");
b.ok(html.indexOf("secretaria@sindeducacao.com") > -1,
  "e o e-mail de contato da secretaria");

b.passo("2");
/* Contraprova: o presidente NÃO assina a mensagem. Ele assina o PDF —
   e trocar um pelo outro foi exatamente o engano que o usuário corrigiu. */
b.ok(html.indexOf("Leonil") === -1 && html.indexOf("LEONIL") === -1,
  "o presidente NÃO assina o e-mail — ele assina o certificado em anexo",
  "os dois papéis são diferentes e não podem se misturar");
b.ok(!/Presidente/.test(html),
  "e o cargo de presidente também não aparece no rodapé da mensagem");

/* ═══════════════════════════════════════════════════════════
   2. O desenho é o mesmo do e-mail de ofício
   ═══════════════════════════════════════════════════════════ */
b.passo("3");
b.ok(html.indexOf("Segoe UI") > -1,
  "usa a mesma família tipográfica do e-mail de ofício");
b.ok(html.indexOf("SINDEDUCAÇÃO-ES") > -1,
  "o cabeçalho traz o nome do sindicato por extenso, não só a sigla curta",
  "no e-mail antigo era uma faixa lisa, e saía cortada no topo");
b.ok(html.indexOf("31.815.780/0001-51") > -1, "com o CNPJ");
b.ok(html.indexOf("#C9A84C") > -1, "e o dourado institucional do padrão");
b.ok(html.indexOf("Documento gerado pelo SISGEP") > -1,
  "e a linha de origem do rodapé padrão");

b.passo("4");
b.ok(html.indexOf("linear-gradient(135deg,#001228") > -1,
  "cabeçalho e rodapé no gradiente navy do padrão");

/* ═══════════════════════════════════════════════════════════
   3. Os dados do benefício chegam rotulados
   ═══════════════════════════════════════════════════════════

   O associado leva este e-mail para a secretaria da faculdade. Lá se
   procura campo, não frase.
   ═══════════════════════════════════════════════════════════ */
b.passo("5");
["Curso", "Período", "Desconto", "Código de validação"].forEach(function (rot) {
  b.ok(html.indexOf(rot) > -1, "o bloco de dados tem o rótulo " + rot);
});
b.ok(html.indexOf("MARKETING") > -1, "e o curso preenchido");
b.ok(html.indexOf("2027/2") > -1, "o período");
b.ok(html.indexOf("70%") > -1, "o percentual com o símbolo");
b.ok(html.indexOf("VAL-20260818202726-3635") > -1, "e o código de validação");

b.passo("6");
b.ok(html.indexOf("BOLSA-2026-920837") > -1,
  "o protocolo aparece no cabeçalho, como o número do ofício aparece");
b.ok(html.indexOf(dados.linkPdf) > -1, "e o botão leva ao documento");

/* ═══════════════════════════════════════════════════════════
   4. Campo que não existe não deixa rótulo órfão
   ═══════════════════════════════════════════════════════════

   Sem isto, um certificado sem curso sairia com "CURSO —" no meio do
   bloco, que é pior do que não ter a linha.
   ═══════════════════════════════════════════════════════════ */
b.passo("7");
const magro = g.voucherCorpoEmail_({ nome: "MARIA", protocolo: "BOLSA-1" });
b.ok(magro.indexOf("Curso") === -1,
  "sem curso, o rótulo Curso não aparece");
b.ok(magro.indexOf("Desconto") === -1,
  "sem percentual, o rótulo Desconto não aparece");
b.ok(magro.indexOf("Abrir o certificado") === -1,
  "e sem link não se mostra um botão que não leva a lugar nenhum");
b.ok(magro.indexOf("BOLSA-1") > -1,
  "mas o protocolo continua lá — é o que identifica a mensagem");
b.ok(magro.indexOf("MARCELHA ALINE PINTO GOMES") > -1,
  "e a assinatura não depende de campo nenhum");

/* ═══════════════════════════════════════════════════════════
   5. Higiene de e-mail: nada que o cliente vá bloquear ou ignorar
   ═══════════════════════════════════════════════════════════ */
b.passo("8");
b.ok(html.indexOf("<style") === -1,
  "nenhum bloco <style> — cliente de e-mail ignora CSS no head");
b.ok(!/<img[^>]+src=['\"]https?:/.test(html),
  "nenhuma imagem remota — cliente de e-mail bloqueia por padrão");

b.passo("9");
/* O escape tem que valer para todo dado que vem da planilha.
 *
 * A PRIMEIRA VERSÃO DESTA ASSERÇÃO PASSOU NA MUTAÇÃO. Eu testava o NOME,
 * e o nome completo não aparece mais no corpo — a saudação usa só o
 * primeiro nome. Media um campo que o template não imprime. E o "&amp;"
 * que eu procurava vinha do "Administrativo &amp; Secretaria" fixo do
 * rodapé, não do dado. Duas asserções olhando para o lugar errado.
 *
 * Agora mede os campos que REALMENTE entram: curso, protocolo e código. */
const comSinal = g.voucherCorpoEmail_({
  nome: "ANA", protocolo: "P<script>x</script>", curso: "Direito & Gestão",
  codigo: "VAL-<b>1</b>"
});
b.ok(comSinal.indexOf("<script>") === -1,
  "tag vinda do dado é escapada, não interpretada",
  "um <script> no protocolo não pode virar script no e-mail de ninguém");
b.ok(comSinal.indexOf("<b>1</b>") === -1,
  "nem tag de formatação no código de validação");
b.ok(comSinal.indexOf("Direito &amp; Gestão") > -1,
  "e o & do curso vira entidade — medido no dado, não no texto fixo do rodapé",
  (comSinal.match(/Direito[^<]*/) || ["(não achou)"])[0]);
b.ok(comSinal.indexOf("&lt;script&gt;") > -1,
  "a tag aparece escrita, escapada, em vez de sumir",
  "escapar não é apagar: quem lê tem que ver o que estava gravado");

b.naoTestavel("Como a mensagem aparece no Gmail, no Outlook e no celular",
  "cliente de e-mail reescreve CSS a seu critério — isso se confere abrindo a mensagem recebida");

b.resumo();
