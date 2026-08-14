# SISGEP — Sistema Integrado de Gestão Sindical

Projeto Google Apps Script (single global scope — arquivos `.gs`/`.html` sem import, tudo em `google.script.run`/`include()`). Branch de trabalho padrão: `claude/sisgep-project-analysis-h9wcy3`.

**Prompt mestre de arquitetura, auditoria e testes: `docs/PROMPT-MESTRE.md`.** É documento normativo, definido pelo usuário e mandado seguir à risca — ler antes de auditar, analisar ou reorganizar qualquer módulo. Em conflito, as regras de segurança abaixo prevalecem sobre ele — ver a nota de estado de operação logo abaixo.

**Acesso que eu tenho:** só o repositório GitHub. Não tenho o projeto Apps Script, a planilha de produção nem o Drive de trabalho. O conector do Google Drive lê metadado (dá para listar o projeto `SISGEP-OFICIOS`), mas **não lê o código-fonte** de projeto Apps Script — esse MIME type não é suportado. Portanto: toda afirmação sobre o que está no ar depende de o usuário confirmar.

## ⚠️ ESTADO REAL DE OPERAÇÃO (confirmado pelo usuário em 2026-08-06)

**O sistema ainda NÃO está em operação. Só a emissão de ofícios está em uso.**

Isto corrige uma premissa que este arquivo carregava e que vinha calibrando
mal as minhas recomendações. A distinção que importa:

| | Situação |
|---|---|
| **Ofícios** | em uso diário — é a única operação viva |
| **Base de Associados** | ~8.000 pessoas de dado real, mas ninguém opera por ela |
| **Escolas** | 679 cadastros reais, idem (contagem medida em 11/08/2026, na migração de identidade) |
| **Todo o resto** | construído, não operado |

**O que isso muda na prática:**

- **Dado real existe; operação não.** São coisas diferentes. Perder os 8.000
  associados continua sendo catastrófico e irrecuperável — a REGRA Nº 1 vale
  inteira. Mas quebrar uma tela que ninguém usa ainda custa uma correção, não
  um dia de sindicato parado.
- **A janela para mudança estrutural é agora.** Reorganizar módulos, dividir
  arquivos, trocar arquitetura de dados — tudo isso fica muito mais barato
  antes de a equipe depender do sistema. Recomendações minhas que foram
  conservadoras "porque está em produção" precisam ser relidas com este fato.
- **Ofícios é a exceção.** Ali vale a cautela integral: é o que a Marcela usa
  todo dia, e parar a emissão de ofício é parar trabalho real.

Não usar isto como licença para pular teste. A REGRA Nº -1 continua valendo
por inteiro — a diferença é no custo de errar, não no rigor de verificar.

## 🚨 REGRA Nº -1 — LER CÓDIGO NÃO É TESTAR. NADA É "PRONTO" SEM EXECUÇÃO

Vale para toda resposta, todo relatório, toda auditoria e todo commit. Vem antes de qualquer outra regra porque é a que decide se as outras respostas são confiáveis.

**Proibido dizer que uma função está pronta, funcionando, coberta, implementada ou integrada com base em:**
- a tela abrir;
- o botão existir;
- o formulário salvar;
- o registro aparecer numa lista;
- a função existir no arquivo `.gs`;
- o código "estar correto" na leitura.

Uma função só é dada como concluída quando o processo inteiro roda do gatilho inicial até o encerramento: registro, encaminhamento, análise, aprovação, execução, comprovação, integração com os outros módulos, atualização de status, histórico, auditoria. Se qualquer etapa não foi executada, o veredito é **"não testado"** — escrito com essas palavras, sem eufemismo.

**Estar no repositório não é estar no ar.** O projeto Apps Script em produção e o repositório divergem: o pull do dia 2026-08-05 veio parcial e 5 arquivos ficaram de fora sem aviso. Toda auditoria feita sobre o repositório precisa dizer, na primeira linha, que descreve o repositório — não necessariamente o que a equipe está usando. Antes de auditar comportamento, confirmar com o usuário quais arquivos existem no projeto.

**Como testar sem tocar em produção:** existe emulador do Apps Script em Node (`scratchpad/e2e/gas.js`) que carrega os `.gs` reais contra uma planilha em memória — SpreadsheetApp, LockService, PropertiesService, CacheService, Utilities e datas com fidelidade; e-mail, Drive e UrlFetch apenas registrados. Serve para status, integração entre módulos, permissão, idempotência e cálculo. **Não** serve para PDF, entrega de e-mail, UI e agendamento de trigger — nesses casos o veredito continua "não testado" e o roteiro de teste manual vai junto.

**Ordem correta de trabalho:** teste primeiro, diagnóstico depois. Quando o usuário pedir auditoria, análise ou diagnóstico de qualquer módulo, montar o teste executável ANTES de escrever conclusão — e oferecer isso por conta própria, sem esperar ele pedir.

**Caso real que originou esta regra (2026-08-05):** entreguei uma auditoria de arquitetura do Portal Administrativo inteiro classificando módulos como "Coberto" a partir de leitura de código, sem executar uma linha. O usuário respondeu: *"tem que testar todos os fluxos"*, *"não tem nada real"*, *"pq não testou?"*, *"pq não sugeriu?"*. Estava certo nas quatro.

## 📋 COBRAR O QUE ESTÁ PENDENTE DE VERIFICAÇÃO

**Ler `docs/PENDENTE-VERIFICACAO.md` no começo de cada sessão e cobrar o que
estiver aberto**, antes de propor trabalho novo. Pedido do usuário em
2026-08-11: *"eu testo mais adiante.. Salve para me cobrar"*.

Ali fica o que foi entregue e está **"não testado"** pela REGRA Nº -1 —
depende de alguém executar no sistema no ar. Não é lista de bug nem de
tarefa.

Duas regras de uso:

- **Item só sai de lá com o usuário dizendo que rodou.** Nunca por dedução,
  nunca por "já faz dias, deve estar funcionando".
- **Cobrar é lembrar, não insistir.** Uma linha no começo da resposta basta.
  Se ele disser que testa depois, a resposta é registrar a data e seguir com
  o trabalho — não repetir a cada mensagem.

## 🚨 REGRA Nº 0.6 — AUTOMATIZAR É O PADRÃO, NÃO O EXTRA

Definida pelo usuário em 2026-08-13: *"devemos pensar sempre em automatizar e
facilitar o trabalho das pessoas que estarão trabalhando com o sistema"*.

Vale para todo desenho, toda tela e toda proposta. Não é sobre inventar
funcionalidade: é sobre **não deixar a pessoa fazer o que o sistema já sabe
fazer sozinho**.

**O teste prático, antes de mostrar qualquer desenho:** olhar cada campo da
tela e perguntar *"o sistema já tem esse dado em algum lugar?"*. Se tem, o
campo nasce preenchido — com a origem à vista, para não passar impressão de
conferido (ver o padrão de `origemEmailInstituicao` em `VoucherEnvio.gs`).
Campo que a pessoa redigita todo semestre é defeito de desenho, não trabalho.

**Perguntas boas de fazer a cada tela:**

- Esse dado já está na base? Então preencha e deixe editar.
- Essa é a segunda vez que a pessoa faz isso? Então ofereça repetir.
- Esse cálculo é regra escrita (CCT, estatuto)? Então calcule e explique.
- Esse erro é previsível? Então avise ANTES de a pessoa terminar de digitar.
- Essa conferência é mecânica? Então faça, e reserve a pessoa para o que
  exige julgamento.

**O limite:** automatizar não é decidir pela pessoa. Percentual sugerido pela
CCT continua editável; e-mail achado no cadastro aparece dizendo que veio do
cadastro. **Sugerir com origem à vista, nunca impor em silêncio** — o dado
que o sistema preencheu sozinho e não avisou é o que vira erro que ninguém
percebe.

## 🚨 REGRA Nº 0.5 — ARQUITETURA E LAYOUT ANTES DE IMPLEMENTAR

Definida pelo usuário em 2026-08-06. Antes de escrever backend, tela ou
qualquer módulo/submódulo novo, **mostrar primeiro**:

1. **Arquitetura** — Módulo → Submódulo → Telas (por ESTADO, não por assunto,
   conforme o item 4 do PROMPT-MESTRE) → Ações de cada tela.
2. **Layout** — como a tela vai ficar: onde ficam os cards de contagem, a
   lista, os filtros, os botões. Wireframe em texto serve; o que não serve é
   descrever em prosa e implementar direto.

Só depois de o usuário ver e concordar é que se escreve código.

**Por que:** desenho errado descoberto depois do código pronto custa duas
vezes — e o usuário é quem conhece a operação do sindicato. Ele consegue
apontar em dez segundos que uma fila não faz sentido ou que falta uma tela
que a secretaria usa todo dia. Ler isso num wireframe é barato; descobrir
depois de 300 linhas de backend e uma tela pronta, não.

Vale inclusive quando o pedido parece pequeno: "cria a tela X" também tem
arquitetura, e é aí que a divergência aparece.

## 🚨 REGRA Nº 0 — SCRIPTLET DO APPS SCRIPT NUNCA VAI DENTRO DE COMENTÁRIO

O template engine do Apps Script (`createTemplateFromFile().evaluate()`, usado por `include()` em `Code.gs:267`) avalia scriptlet em **qualquer posição do arquivo**, inclusive dentro de `<!-- comentário HTML -->`, porque ele roda ANTES do navegador ver o HTML. Comentar um scriptlet não o desliga.

**Caso real (2026-08-05):** o cabeçalho de `RHEventosAdmin.html` documentava, dentro de um comentário HTML, a própria chamada de include que o traz para a tela. O arquivo passou a se incluir em recursão infinita: o HTML do RH saiu corrompido, o bloco de script quebrou no meio e derrubou o JavaScript da tela inteira — abas paradas, contadores em 0 e **nenhuma mensagem de erro**, porque `listarColaboradoresRH_interno_` engole exceção e devolve `[]`.

Regras práticas:
- Em comentário, cite a chamada em palavras ("include de RHEventosAdmin"), nunca com a sintaxe real.
- Não escreva tag literal de `script`/`style` dentro de comentário — quebra as ferramentas de extração e validação.
- **Antes de todo commit que toque `.html`**, rodar a varredura: procurar scriptlet dentro de `<!-- -->` em todos os `.html` do projeto. Achou, é bug — não é estilo.

**Sintoma que sempre aponta para cá:** tela renderiza, mas nenhum botão responde e todos os indicadores ficam no valor estático do HTML. Isso é JavaScript morto na página, não erro de backend — procure HTML corrompido antes de procurar erro no `.gs`.

## 🚨 REGRA Nº 1 — NUNCA APAGAR ARQUIVO QUE O SISTEMA AINDA USA

**Isto nunca pode acontecer. Nem uma vez.** A base tem dado real — ~8.000 associados e 679 escolas — e o módulo de Ofícios está em uso diário. Apagar um arquivo ainda usado derruba a emissão de ofício ou corrompe cadastro que ninguém tem de onde recuperar.

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
