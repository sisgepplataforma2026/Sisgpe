# SISGEP — Sistema Integrado de Gestão Sindical

Projeto Google Apps Script (single global scope — arquivos `.gs`/`.html` sem import, tudo em `google.script.run`/`include()`). Branch de trabalho padrão: `claude/sisgep-project-analysis-h9wcy3`.

## 🚨 REGRA Nº 1 — NUNCA APAGAR ARQUIVO QUE O SISTEMA AINDA USA

**Isto nunca pode acontecer. Nem uma vez.** O SISGEP roda em produção num sindicato real, com dado real de associado e de dinheiro. Apagar um arquivo ainda usado derruba função em produção e pode corromper dado.

Antes de declarar QUALQUER arquivo ou função como "órfão", "morto", "não usado" ou "candidato a remoção" — seja num relatório, seja numa recomendação, seja antes de deletar — é **obrigatório** completar os 5 passos abaixo. **Grep só nos `.html` NÃO é suficiente.**

1. **Ler o cabeçalho do próprio arquivo.** Este projeto documenta decisões arquiteturais em comentário de topo. A resposta muitas vezes já está escrita lá.
2. **Checar `Code.gs` e todas as rotas `doGet`/`doPost`.** Funções chamadas por URL pública (pixel de rastreio, confirmação por token, upload externo) não aparecem em nenhum `.html` — e são as mais críticas, porque quem as usa é gente de fora do sindicato.
3. **Checar triggers** (`ScriptApp.newTrigger`, `instalar*Trigger*`, `onOpen`/`onInstall`/`onStartup`). Rotina agendada não tem chamador visível.
4. **Rodar `git log --follow -- <arquivo>`** e ler as mensagens de commit. Se já existe decisão anterior, ela se respeita — não se reabre como achado novo.
5. **Grep no projeto inteiro** (`*.gs` E `*.html`), não só na pasta do módulo em análise.

Se qualquer passo não puder ser concluído com certeza, o veredito é **"não confirmado"** — nunca "morto". **Na dúvida, o arquivo fica.**

**O momento mais crítico é quando o usuário pergunta "posso apagar esse arquivo?".** O usuário sempre pergunta antes de excluir — ou seja, a resposta do Claude é a única trava de segurança do processo. Nunca responder essa pergunta de memória, por impressão ou com base em análise anterior da conversa: rodar os 5 passos na hora, e só então responder. Se a checagem não for feita, a resposta obrigatória é "ainda não verifiquei — deixa eu checar antes de você apagar", nunca um "pode apagar".

Quando houver dúvida entre remover e manter, a recomendação padrão é **manter e documentar como legado** no cabeçalho do arquivo (foi o que se fez com `GuiasPagamento.gs` no commit `3394040`, e foi a decisão certa). Remoção só acontece com pedido explícito do usuário, em commit separado, nunca junto de outra mudança.

**Caso real que originou esta regra (2026-08-04):** `GuiasPagamento.gs` foi reportado como "3.262 linhas 100% mortas" com base só em grep de `.html`. Era falso — `Code.gs:163` ainda chama `guiasPagamento_registrarLeituraEmail()` na rota pública `?page=pub-pixel-nf`, e o cabeçalho do arquivo já documentava exatamente isso.

## Padrão visual obrigatório (Design System)

A partir de 2026-08-03, **toda implementação nova ou alterada de tela deve seguir o Design System abaixo**, definido na Auditoria de Padronização Visual (skill `sisgep-auditoria-ui-design-system`, artifact publicado: https://claude.ai/code/artifact/c1262106-7f88-492c-87b8-ed974779ce5b). Não crie paleta, header, card, botão ou modal novo "do zero" para uma tela — reaproveite os tokens e componentes já existentes em `OficiosStyles.html`, que é o CSS mestre canônico do sistema.

**Cor** (tokens já declarados em `OficiosStyles.html:8-42`, usar via `var(--nome)`, não hex direto):
- `--navy` `#001f4d` — primária
- `--navy2` `#002f6c` — gradiente/secundária
- `--blue` `#1565C0` — interativo/links
- `--gold` `#C9A84C` — institucional (identidade, não usar como cor de status)
- `--gold2` `#f0c843` — destaque quente
- Semânticas: sucesso `#0f8a5f`/`#059669`, alerta `#d97706`, erro `#dc2626`/dc2626 — sempre separadas do dourado.
- Não introduzir novas famílias de cor (a auditoria encontrou 5–6 variações divergentes de navy/gold espalhadas pelo sistema — não crie mais uma).

**Tipografia:** Plus Jakarta Sans (variável, pesos 200–800) para tudo — display, corpo, labels. Não importar uma segunda família sem decisão explícita do usuário (algumas telas públicas usam Cormorant Garamond como exceção deliberada de "premium"; não replicar sem pedir).

**Componentes a reaproveitar (não recriar):**
- Cabeçalho de módulo: `.of-modulo-header` (`OficiosStyles.html:1690-1702`)
- Card: `.of-card` — radius 14px, sombra `--sh-sm`/`--sh-md`/`--sh-xl` (já definidas)
- Botão por finalidade: `.btn-navy`/`.btn-outline`/`.btn-teal`/`.btn-red` etc.
- Modal: `.of-modal-overlay`/`.of-modal`
- Feedback: `toast(msg, tipo, dur)` — **um único** `toast()` deve existir no sistema (havia colisão entre `Helpers.html` e `OficiosStyles.html`, em correção). Nunca usar `alert()`/`confirm()` nativo para feedback não-bloqueante.
- Máscaras (CPF/CNPJ/telefone/CEP/moeda): usar `Utils.*` de `Helpers.html` (tem dígito verificador correto), não reimplementar por arquivo.

**Antes de editar uma tela existente:** ler o arquivo completo, identificar toda função/ID/seletor consumido pelo `.gs` correspondente, e nunca misturar refino visual com mudança de regra de negócio no mesmo commit (ver "Proteção do que já funciona" na skill de auditoria).

**Relatório completo** (inventário das 59 telas, ranking, inconsistências, plano faseado): artifact linkado acima. Releia antes de padronizar um módulo que ainda não foi tratado.
