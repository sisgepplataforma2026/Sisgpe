# Notas de campo sobre o Prompt Mestre

Complemento de `docs/PROMPT-MESTRE.md`, que é o **texto normativo do usuário e
não deve ser alterado**. Aqui ficam, separadas, as divergências verificadas em
código entre o que o prompt descreve e o que o sistema é hoje — para quem for
seguir o prompt não trabalhar em cima de premissa errada.

Verificado em 2026-08-06 sobre o repositório, na branch
`claude/sisgep-project-analysis-h9wcy3`.

---

## Item 19 — Firebase: descreve o alvo, não o presente

O prompt manda "assumir que o SISGEP já possui Firebase configurado" e avaliar
Authentication, Firestore, Storage, Cloud Functions, Hosting, App Check, regras
de segurança, índices, backups.

**Nada disso existe para auditar.** O Firestore aparece em um único lugar:
`EventosFirestore.gs`, uma ponte REST autenticada por conta de serviço, usada
só por Eventos para o check-in com vários leitores de QR ao mesmo tempo.

Todo o resto do sistema — associados, despesas, pagamentos, folha, processos
jurídicos, escolas, benefícios — vive em **~60 abas de uma única planilha
Google** (`SistemaConfig.gs:61`).

Consequências práticas para quem for seguir os itens 19 e 20:

| O prompt pede | Situação real |
|---|---|
| Regras de segurança do Firestore | não existem — a proteção é a checagem de sessão em cada função |
| Índices | não existem — toda consulta lê a aba inteira e filtra em memória |
| Transação | não existe — o substituto é `LockService`, e lock aninhado já causou bug na folha |
| Ambientes | existem: planilha de produção e de homologação, com chave de ambiente. O padrão, porém, é `producao` |
| Backups | dependem do histórico de versões do Google Sheets |

Recomendação registrada: não migrar tudo. Migrar o que a planilha não aguenta,
na ordem em que doer — Associados (tabela mais lida), log de auditoria (só
cresce) e movimentação financeira. E, antes de qualquer migração, isolar o
acesso a dados: hoje cada módulo chama `getSheetByName` direto, então trocar de
banco significaria reescrever 100 arquivos.

---

## Item 26 — como a exigência de evidência é cumprida

O item 26 proíbe declarar função concluída sem teste, e manda dizer com todas
as letras quando o teste não foi possível.

A infraestrutura que produz essa evidência está em `tests/e2e/`: emulador do
Apps Script em Node que carrega os 100 arquivos `.gs` reais contra uma planilha
em memória, sem tocar produção.

| Serve para | Não serve para |
|---|---|
| status e transição | conteúdo de PDF gerado pelo Docs |
| integração entre módulos | entrega real de e-mail e pixel de rastreio |
| permissão por módulo e por sessão | comportamento da tela no navegador |
| idempotência e duplo clique | disparo efetivo de gatilho de horário |
| cálculo e regra de negócio | |
| prazo, aceite de termo, auditoria | |
| integridade de nomes de arquivo | |

Onde o emulador não alcança, o veredito é **"não testado"**, escrito com essas
palavras, com o roteiro de teste manual junto — como o próprio item 26 manda.

**Cuidado ao interpretar falha:** boa parte das falhas na primeira rodada de um
módulo é erro do teste, não do sistema — nome de campo trocado, ordem de
argumento errada. Conferir a assinatura da função no `.gs` antes de reportar
bug. Já aconteceu duas vezes de um stub do emulador (HMAC fixo, `formatDate`
ignorando literal entre aspas) fazer um teste passar ou falhar por motivo
errado.

---

## Itens 1 e 2 — escopo e separação de portais

O prompt trata o Portal Administrativo como escopo exclusivo e descreve quatro
portais. Na prática:

- **Portal Administrativo** e **Portal do Associado** convivem no mesmo projeto
  Apps Script (`SISGEP-OFICIOS`), separados por rota em `Code.gs`.
- Existe um **segundo projeto Apps Script**, "SISGEP - Portal Público do
  Associado", com URL publicada própria. Guriri Beach e Assefaz são atendidos
  lá. Qualquer mudança que precise valer nos dois exige colar nos dois.
- **Portal das Escolas** não existe como portal. O que existe é a cobrança de
  relação nominal por e-mail, dentro do módulo Escolas.

---

## Sobre o acesso de quem escreve estas notas

Só o repositório GitHub. Sem o projeto Apps Script, sem a planilha de produção,
sem o Drive de trabalho. O conector do Google Drive lê metadado — dá para
listar o projeto — mas **não lê código-fonte de projeto Apps Script**, porque o
MIME `application/vnd.google-apps.script` não é suportado.

Portanto, e isto vale para toda auditoria feita aqui: **o que se descreve é o
repositório, não necessariamente o que está no ar.** O projeto em produção já
divergiu do repositório antes — o pull de 2026-08-05 veio parcial e cinco
arquivos ficaram de fora sem aviso.
