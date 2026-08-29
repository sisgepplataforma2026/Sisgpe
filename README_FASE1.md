# SISGEP — Taxa Negocial — Fases 1 e 2

Fundação do backend para o fluxo eletrônico de oposição à Taxa Negocial.

## Ambiente

Implementação em desenvolvimento exclusivamente na branch `integracao/sisgep-homologacao` e na planilha HML do SISGEP.

## Fase 2

A confirmação eletrônica passa a ser validada no servidor por OTP. O canal inicial reutiliza o e-mail institucional do SISGEP. O código OTP bruto não deve ser persistido em cache ou logs; somente hash, salt, expiração, tentativas e contexto congelado.

Integrações alvo: autorização do módulo Documentos, guard-rail oficial de homologação, trava reentrante `travarSisgep_`, auditoria central `auditar_` e envio `enviarEmailSISGEP_`.

A Fase 2 ainda não está implantada no Apps Script. Commits nesta branch não equivalem a deploy.
