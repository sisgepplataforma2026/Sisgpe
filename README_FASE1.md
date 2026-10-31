# SISGEP — Taxa Negocial — Fases 1, 2 e 3

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

## Fase 3 — comprovante eletrônico

Após o OTP ser validado, a oposição é registrada primeiro e o comprovante é gerado como consequência documental. Falha no Drive/PDF nunca desfaz a manifestação já confirmada.

Implementado:

- PDF A4 com protocolo, trabalhador, CPF, escola/CNPJ, campanha, texto aceito e confirmação eletrônica;
- snapshot do texto e da versão da manifestação para impedir regeneração futura com conteúdo diferente;
- código de autenticidade determinístico do registro;
- SHA-256 calculado sobre os bytes reais do PDF final e persistido em `HASH_PDF`;
- gravação por `arquivoSalvarPrivado_`, seguindo a política central `PRIVATE`;
- pasta resolvida por ambiente via `getRecursoId_('COMPROVANTES')`, com subpastas `Taxa Negocial/<exercício>`;
- nenhuma URL privada do Drive é devolvida ao frontend;
- geração idempotente e recuperação do mesmo arquivo quando a URL foi persistida antes do hash;
- falha de geração vira `COMPROVANTE_PENDENTE` e pode ser reprocessada sem novo OTP;
- auditoria `COMPROVANTE_PDF_GERADO` e `COMPROVANTE_PDF_FALHOU`;
- histórico do trabalhador derivado de `TN_OPOSICOES`, sem criar campo de observação paralelo na aba `Associados`;
- consulta do histórico auditada e CPF mascarado no retorno.

As colunas adicionais da Fase 3 são criadas de forma idempotente quando necessárias:

- `TEXTO_MANIFESTACAO_SNAPSHOT`
- `VERSAO_MANIFESTACAO_SNAPSHOT`
- `CODIGO_AUTENTICIDADE`
- `ID_ARQUIVO_PDF`
- `PDF_GERADO_EM`

## Estruturas

- `TN_CAMPANHAS`
- `TN_OPOSICOES`
- `TN_LOTES`

## Arquivos do módulo

- `TaxaNegocialConfig.gs`
- `TaxaNegocialRepository.gs`
- `TaxaNegocialService.gs`
- `TaxaNegocialConfirmacao.gs`
- `TaxaNegocialComprovante.gs`
- `TaxaNegocialHistorico.gs`
- `TaxaNegocialApi.gs`
- `TaxaNegocialSmokeTest.gs`
- `tests/e2e/t100-taxa-negocial.js`
- `tests/e2e/t101-taxa-negocial-comprovante.js`
- `tests/e2e/t102-taxa-negocial-historico.js`

## Próxima etapa da Fase 3

Depois de a suíte da branch passar novamente em modo `conferir`:

1. publicar a versão aprovada somente na HML;
2. executar um fluxo controlado com dados de teste;
3. validar a criação física do PDF na pasta de homologação e conferir o hash;
4. construir o modal final do atendimento;
5. adicionar entrega segura do comprovante por download autenticado e e-mail;
6. deixar WhatsApp e impressão como opções de conveniência, sem transformar papel no original.
