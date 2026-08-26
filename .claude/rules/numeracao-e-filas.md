# Numeração sequencial e filas

Leia antes de mexer em número de ofício, recibo, guia, comprovante, despesa ou
protocolo — e em qualquer fila de envio.

## Numeração sob lock

Numeração sequencial lida da planilha tem condição de corrida: dois usuários
emitindo ao mesmo tempo leem o mesmo "último número" e gravam o mesmo valor.
`LockService.getScriptLock()` + `waitLock()` em volta da leitura **e** da
gravação é obrigatório.

O padrão de referência é `gerarProximoNumeroSeguro()` em `Oficios.gs:179`
(lock com espera de 15 s). Sete das oito funções de numeração seguem esse
padrão:

| Função | Arquivo | Lock |
|---|---|---|
| `gerarProximoNumeroSeguro` | `Oficios.gs` | sim |
| `gerarNumeroReciboSeguro` | `Recibo.gs` | sim |
| `gerarNumeroReciboDiverso_` | `ReciboDiversos.gs` | sim |
| `gerarNumeroGuiaPagamento_` | `GuiasPagamento.gs` | sim |
| `gerarNumeroComprovante_` | `Comprovantes.gs` | sim |
| `gerarNumeroDespesa_` | `Despesas.gs` | sim |
| `gerarProximoNumeroOficioFiscal_` | `Despesas_Oficio_Fiscal.gs` | sim |
| `gerarNumeroProtocolo_` | `Voucher.gs` | **não** — ver `docs/DEBITO-TECNICO.md` |

Criou numeração nova? Siga o padrão dos sete, não o do oitavo.

## Prever não é reservar

`preverProximoNumeroOficio()` (`Oficios.gs:153`) mostra qual número sairá, sem
lock e sem reservar nada — é para a tela exibir. Entre a previsão e a emissão o
número pode mudar. Nunca grave o valor previsto: grave o que
`gerarProximoNumeroSeguro()` devolver.

## Identificador não é número sequencial

Duas coisas diferentes, não confunda:

- **Número sequencial** (ofício 0123/2026) — é ordem, é público, precisa de lock.
- **Identificador único** (QR de ingresso, token de link) — não pode ser
  adivinhável nem colidir. Use `Utilities.getUuid()`, como
  `EventosEmissao.gs:107` faz. `Math.random()` não serve: colide e é previsível.

## Filas de envio

`FilaOficios.gs` e `MonitoramentoOficios.gs` movem envio pesado para gatilho de
tempo, fugindo do limite de 6 minutos do Apps Script. Ao mexer numa fila:

- Enfileirar, enviar e confirmar são estados **separados**. Só marque "enviado"
  depois da confirmação — não depois da chamada.
- Reprocessar item com falha não pode gerar segunda cobrança nem segundo
  ofício. Idempotência é pela chave de negócio, não pelo id da linha na fila.
- Item que falhou fica visível com o motivo. Fila que esconde erro é pior que
  fila que trava.
- Gatilho de tempo roda sem sessão de usuário: a autorização é a do dono do
  script. Não use `Session.getActiveUser()` dentro de gatilho esperando o
  usuário que originou a ação — grave o responsável na linha quando enfileirar.
