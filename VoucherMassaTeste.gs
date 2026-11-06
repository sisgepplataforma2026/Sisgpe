// ============================================================================
// ARQUIVO: VoucherMassaTeste.gs
// MASSA DE TESTE FICTÍCIA DE VOUCHERS — SÓ EM HOMOLOGAÇÃO
// ============================================================================
//
// Pedido do usuário em 29/10/2026: "preciso que faça testes reais com dados
// fictícios". O emulador (t210, t211) roda o código real com gente
// inventada; isto aqui põe a MESMA gente inventada na planilha de
// HOMOLOGAÇÃO, para testar nas telas de verdade — emitir em lote, enviar em
// lote, imprimir — com e-mail chegando de verdade numa caixa de teste.
//
// DUAS TRAVAS, as mesmas do teste de numeração de Documentos:
//   - documentosExigirHomologacaoSegura_: recusa se o ambiente não for
//     homologação ou se a planilha ativa coincidir com a de produção;
//   - exigirAdminOuSessao_: administrador, ou a conta dona rodando do editor.
//
// COMO USAR: no editor do projeto de HOMOLOGAÇÃO, escolher
// `voucherHomologacaoCriarMassaTeste` e Executar. Os e-mails fictícios vão
// para a própria conta que executou, com "+teste1", "+teste2"... no nome
// (o Gmail entrega tudo na mesma caixa). Para apagar depois: selecionar as
// linhas "TESTE FICTÍCIO" na tela de vouchers e Excluir (vão para a lixeira).
// ============================================================================

function voucherHomologacaoCriarMassaTeste(emailTeste, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "beneficios", "Massa de teste fictícia de vouchers", true);
  var alvo = documentosExigirHomologacaoSegura_();
  setupVoucherModuleFase1();

  var base = String(emailTeste || "").trim();
  if (!base) { try { base = String(Session.getEffectiveUser().getEmail() || "").trim(); } catch (e) {} }
  if (!base || base.indexOf("@") < 1) throw new Error("Informe o e-mail da caixa de teste.");
  var partes = base.split("@");
  var mais = function (sufixo) { return partes[0] + "+" + sufixo + "@" + partes[1]; };

  var lote = Utilities.formatDate(new Date(), "America/Sao_Paulo", "MMddHHmm");
  var casos = [
    { nome: "TESTE FICTÍCIO — ANA (titular)", obs: "pronto para emitir e enviar" },
    { nome: "TESTE FICTÍCIO — JOANA (mãe)", benef: "TESTE FICTÍCIO — BERNARDO (dependente)", tipo: "FILHO",
      obs: "dependente" },
    { nome: "TESTE FICTÍCIO — CARLOS (não associado)", situacao: "NAO_ASSOCIADO",
      obs: "retirada presencial: não envia, imprime com a data do dia" },
    { nome: "TESTE FICTÍCIO — MÁRCIA (sem e-mail)", semEmail: true, obs: "deve ficar de fora do envio" },
    { nome: "TESTE FICTÍCIO — PEDRO (sem período)", semPeriodo: true, obs: "a emissão deve recusar" },
    { nome: "TESTE FICTÍCIO — LUCAS (sem e-mail da instituição)", semInst: true,
      obs: "com a cópia marcada, deve ficar de fora" }
  ];

  var sh = SpreadsheetApp.openById(alvo.planilhaId).getSheetByName("Voucher_Solicitacoes");
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (c) { return String(c || "").trim(); });
  var criados = [];
  casos.forEach(function (c, i) {
    var n = i + 1;
    var prot = "TESTE-" + lote + "-" + n;
    var campos = {
      ID_SOLICITACAO: "SOL-TESTE-" + lote + "-" + n,
      NUMERO_PROTOCOLO: prot,
      DATA_SOLICITACAO: new Date(),
      CPF_SOLICITANTE: String(99900000000 + n),
      NOME_SOLICITANTE: c.nome,
      EMAIL: c.semEmail ? "" : mais("teste" + n),
      TELEFONE: "",
      INSTITUICAO_ENSINO: "FACULDADE FICTÍCIA DE TESTE",
      EMAIL_INSTITUICAO: c.semInst ? "" : mais("instituicao" + n),
      CURSO: "Pedagogia", MODALIDADE: "GRADUACAO", AREA_CURSO: "HUMANAS",
      PERIODO_REFERENCIA: c.semPeriodo ? "" : "'2027/1",
      PERCENTUAL_APLICADO: "70",
      STATUS_SOLICITACAO: "APROVADO",
      STATUS_VALIDACAO_SINDICAL: "VALIDADO",
      SITUACAO_SINDICAL: c.situacao || "ASSOCIADO",
      TIPO_BENEFICIARIO: c.tipo || "TITULAR",
      NOME_BENEFICIARIO: c.benef || c.nome,
      OBSERVACOES: "MASSA DE TESTE FICTÍCIA (" + lote + ") — " + c.obs
    };
    sh.appendRow(cab.map(function (h) { return campos[h] !== undefined ? campos[h] : ""; }));
    criados.push({ protocolo: prot, nome: c.nome, email: campos.EMAIL, caso: c.obs });
  });

  Logger.log("Massa de teste criada em " + alvo.planilhaNome + ":\n" + criados.map(function (c) {
    return c.protocolo + " · " + c.nome + " · " + (c.email || "(sem e-mail)") + " · " + c.caso;
  }).join("\n"));
  return { ok: true, planilha: alvo.planilhaNome, lote: lote, criados: criados };
}
