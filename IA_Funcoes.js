function iaMelhorarTexto(texto) {

  var prompt =
    getPromptMelhoriaTexto() +
    "\n\nTexto:\n" +
    texto;

  return chamarIA_SISGEP(prompt);
}
function iaResponderEmail(emailRecebido) {

  var prompt =
    getPromptEmail() +
    "\n\nE-mail recebido:\n" +
    emailRecebido;

  return chamarIA_SISGEP(prompt);
}
function iaGerarOficio(tipo, dados) {

  var prompt =
    getPromptOficio() +
    "\n\nTipo do Ofício:\n" +
    tipo +
    "\n\nDados:\n" +
    JSON.stringify(dados, null, 2);

  return chamarIA_SISGEP(prompt);
}
function iaAssistenteLegacy_(pergunta) {
  return chamarIA_SISGEP(pergunta);
}