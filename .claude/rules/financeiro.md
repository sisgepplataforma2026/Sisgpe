# Regras do financeiro

Leia antes de mexer em cobrança, boleto, PIX, mensalidade, taxa assistencial,
relação nominal, baixa ou conciliação.

Arquivos: `MensalidadeCore.gs`, `GuiasPagamento.gs`, `TaxaAssistencial.gs`,
`Recibo.gs`, `ReciboDiversos.gs`, `Despesas.gs`, `Comprovantes.gs`, `CCTCore.gs`.

## Não duplicar cobrança

- A chave é escola + competência + tipo de contribuição. Antes de emitir,
  verifique se já existe. Emissão em lote precisa ser idempotente: rodar duas
  vezes não pode gerar duas cobranças.
- Emissão, reemissão, cancelamento, baixa e estorno são operações **distintas**,
  cada uma com registro próprio. Reemissão preserva o histórico da anterior.

## Concorrência

Numeração de guia, recibo e protocolo é sequencial e precisa de
`LockService.getScriptLock()`. Sem lock, dois usuários emitindo ao mesmo tempo
recebem o mesmo número.

## Valores

- Nunca compare dinheiro com número de ponto flutuante vindo de texto sem
  normalizar antes (`parseValorTexto_`, em `Utils.gs`).
- Mudança de valor registra responsável, motivo, valor anterior e data.
- Competência não é a data do lançamento: uma guia emitida em março pode ser da
  competência de fevereiro. Não troque um pelo outro.

## Conciliação

- Divergência entre o previsto e o pago fica visível — não silencie nem arredonde.
- Falha de integração bancária tem que ser reprocessável sem gerar cobrança nova.
- Pagamento parcial é estado próprio, não é "pago" nem "em aberto".

## Antes de considerar pronto

Teste: duplicidade, baixa indevida, boleto vencido, reemissão, pagamento parcial,
falha bancária, conciliação divergente, escola sem empregados, importação inválida.
