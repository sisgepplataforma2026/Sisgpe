function testarMelhorarTexto() {

  var resultado =
    iaMelhorarTexto(
      "Solicito por gentileza regularizar o envio da relação nominal."
    );

  Logger.log(resultado);
}
function testarResponderEmail() {

  var email =
    "Prezados, informamos que não possuímos funcionários ativos.";

  var resultado =
    iaResponderEmail(email);

  Logger.log(resultado);
}
function testarGerarOficio() {

  var resultado =
    iaGerarOficio(
      "Solicitação de Relação Nominal",
      {
        escola: "FAESA",
        cnpj: "32.478.380/0001-60",
        assunto: "Envio da Relação Nominal"
      }
    );

  Logger.log(resultado);
}