# SISGEP — Taxa Negocial — Fases 1 e 2

Fundação do backend para o fluxo eletrônico de oposição à Taxa Negocial.

## Ambiente

Implementação em desenvolvimento exclusivamente na branch `integracao/sisgep-homologacao` e na planilha HML do SISGEP.

Commits nesta branch **não equivalem a deploy** do Apps Script.

## Fase 2 — confirmação eletrônica

A confirmação é validada no servidor por OTP. O canal inicial reutiliza o e-mail institucional do SISGEP.

Proteções implementadas:

- sessão real e permissão do módulo `documentos`;
- guard-rail central de homologação + conferência explícita da planilha HML;
- um único endpoint público: `taxaNegocialApi(token, acao, payload)`;
- ações do gateway em allowlist, sem invocação dinâmica;
- demais funções da Taxa Negocial internas, com sufixo `_`;
- código OTP bruto não é persistido em cache ou logs;
- desafio guarda hash + salt + expiração + tentativas + contexto congelado;
- e-mail bruto não é guardado no desafio OTP;
- validade de 10 minutos;
- máximo de 5 tentativas por código;
- intervalo mínimo de 60 segundos entre solicitações;
- máximo de 3 envios em uma janela de 15 minutos por campanha + CPF + escola;
- envio exclusivamente por `enviarEmailSISGEP_`;
- confirmação definitiva somente após validação no servidor;
- trava reentrante `travarSisgep_` para concorrência;
- auditoria pela infraestrutura central `auditar_`.

## Estruturas

- `TN_CAMPANHAS`
- `TN_OPOSICOES`
- `TN_LOTES`

## Arquivos do módulo

- `TaxaNegocialConfig.gs`
- `TaxaNegocialRepository.gs`
- `TaxaNegocialService.gs`
- `TaxaNegocialConfirmacao.gs`
- `TaxaNegocialApi.gs`
- `TaxaNegocialSmokeTest.gs`
- `tests/e2e/t100-taxa-negocial.js`

## Próxima fase

Após validação da fundação no Apps Script de homologação:

1. gerar comprovante PDF privado da oposição;
2. calcular e registrar `HASH_PDF`;
3. gravar `LINK_PDF`/referência segura;
4. atualizar histórico do trabalhador sem usar observação como fonte oficial;
5. preparar modal de conclusão com download, e-mail, WhatsApp e impressão opcional;
6. iniciar agrupamento automático em lotes por escola/CNPJ.
