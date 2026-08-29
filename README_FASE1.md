# SISGEP — Taxa Negocial — Fase 1

Pacote de fundação do backend para o fluxo de oposição à Taxa Negocial.

## Escopo

Este pacote foi preparado **somente para HOMOLOGAÇÃO** e aponta explicitamente para:

`SISGEP - HML ATIVA (copia prod 2026-08-18)`

Planilha ID:
`1OGtjryOUagEgKMHjFaluiEgLnzZ11Ydc-PB-IdrHLMk`

Não há referência de escrita à planilha de produção.

## Arquivos

1. `TaxaNegocialConfig.gs`
   - configuração HML
   - normalização CPF/CNPJ
   - hash SHA-256
   - IDs e datas

2. `TaxaNegocialRepository.gs`
   - campanhas
   - trabalhadores / não filiados
   - escolas
   - oposições
   - lotes
   - auditoria central

3. `TaxaNegocialService.gs`
   - validação de sessão
   - campanha ativa
   - bloqueio de filiado
   - chave única campanha + CPF + EscolaID
   - geração segura de protocolo
   - `LockService`
   - registro de oposição já confirmada
   - cancelamento lógico/auditável

4. `TaxaNegocialSmokeTest.gs`
   - teste somente leitura da estrutura

## Regras importantes implementadas

- Nenhuma oposição confirmada é apagada fisicamente.
- Trabalhador marcado como `Filiado = S` é bloqueado para verificação.
- CPF inexistente pode ser cadastrado como `Filiado = N`.
- A duplicidade é controlada por campanha + CPF + EscolaID.
- A validação de duplicidade é repetida dentro de `ScriptLock`.
- Protocolo é gerado sob lock no formato `OP-AAAA-000001`.
- Status jurídico da oposição e status da comunicação são separados.
- Auditoria usa a aba central `SISGEP_Auditoria`.
- OTP não é implementado de novo nesta fase; o serviço exige confirmação eletrônica e será conectado ao mecanismo já existente de sindicalização na fase seguinte.

## Antes de instalar no Apps Script

1. Confirmar a assinatura vigente de `getSessaoUsuario`. O pacote possui adaptador temporário para versões com e sem token; antes da produção, o fallback antigo deve ser removido e o token deve ser obrigatório.
2. Adicionar os quatro arquivos ao projeto de HOMOLOGAÇÃO.
3. Rodar `tnSmokeTestSomenteLeitura()`.
4. O resultado deve retornar `ok: true`.
5. Não executar ainda `taxaNegocialRegistrarOposicaoConfirmada` com dados reais.
6. Depois do smoke test, conectar o mecanismo existente de OTP/hash/PDF.

## Observação sobre protocolo

A sequência usa `ScriptProperties` do projeto HML. Isso evita `MAX(linha)+1` e é protegido por `LockService`.
Na promoção para produção, a estratégia de sequência deve ser revisada junto com a implantação definitiva.
