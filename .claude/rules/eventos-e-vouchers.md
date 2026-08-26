# Eventos, ingressos e vouchers

Leia antes de mexer em emissão de ingresso, QR Code, check-in, voucher ou
bolsa de estudo.

Arquivos: `EventosEmissao.gs`, `EventosFirestore.gs`, `EventosPainel.gs`,
`Voucher.gs`, `VoucherSolicitacao.gs`, `VoucherValidacao.gs`, `VoucherPdf.gs`,
`VoucherAuditoria.gs`, `VoucherAdmin.gs`, `VoucherCadastro.gs`.

## Eventos usam Firestore, não a planilha

Ingresso vive no Firestore (`EventosFirestore.gs`), não em aba de planilha. É a
única parte do SISGEP com esse armazenamento. Consequências:

- A credencial fica em `PropertiesService` na chave `FIRESTORE_SERVICE_ACCOUNT`.
  Nunca no código.
- Falha de rede no Firestore é cenário normal, não excepcional: check-in em
  ginásio com internet ruim é o caso de uso real. Trate timeout e ofereça
  caminho manual.
- Consulta ao Firestore não enxerga o que está na planilha. Relatório que
  cruza os dois precisa buscar nos dois.

## Modo teste é uma trava de produção

`emissao_ativarProducao()` e `emissao_ativarTeste()` (`EventosEmissao.gs`)
alternam a flag `EVENTO_MODO_TESTE` no `PropertiesService`. Em modo teste a
emissão ignora o período do evento — serve para ensaio.

**Confirme o modo antes de qualquer teste de emissão**, e devolva para produção
depois. Ingresso emitido em ensaio que sobra no Firestore vale no check-in.
`emissao_limparTestes()` existe para isso.

## QR e código de validação

- O id do ingresso vem de `Utilities.getUuid()` (`EventosEmissao.gs:107`) —
  correto: não colide e não é adivinhável.
- Cancelamento (`emissao_cancelarIngresso`) tem que invalidar o QR, não só
  marcar a linha. Um QR cancelado que ainda passa no leitor é entrada indevida.
- Check-in precisa ser atômico: vários celulares leem ao mesmo tempo. Segunda
  leitura do mesmo QR é recusa, não é sucesso silencioso.

## Vouchers: o gerador de protocolo é frágil

`gerarNumeroProtocolo_()` (`Voucher.gs:63`) monta `BOLSA-<ano>-<aleatório>` com
`Math.random()` em 900.000 valores, sem lock e sem conferir se o número já
existe. `gerarCodigoValidacaoVoucher_()` (`Voucher.gs:71`) tem só 9.000 valores
depois de um timestamp previsível.

Consequência prática: dois protocolos podem sair iguais, e um código de
validação é adivinhável por quem souber a hora aproximada da emissão. Está
registrado em `docs/DEBITO-TECNICO.md`. **Ao mexer nesse trecho, corrija junto:**
`Utilities.getUuid()` para o que precisa ser único, e a numeração sequencial sob
lock para o que precisa ser ordenado — o padrão está em
`.claude/rules/numeracao-e-filas.md`.

## Voucher tem trilha própria

`VoucherAuditoria.gs` e a aba `Voucher_Auditoria` existem porque bolsa de estudo
é benefício com valor. Emissão, alteração, cancelamento e validação gravam
quem, quando e o quê. Não acrescente caminho que altere voucher sem passar por
essa trilha.
