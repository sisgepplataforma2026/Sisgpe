# SISGEP — Sistema Integrado de Gestão Sindical

Projeto Google Apps Script (single global scope — arquivos `.gs`/`.html` sem import, tudo em `google.script.run`/`include()`). Branch de trabalho padrão: `claude/sisgep-project-analysis-h9wcy3`.

**Prompt mestre de arquitetura, auditoria e testes: `docs/PROMPT-MESTRE.md`.** É documento normativo, definido pelo usuário e mandado seguir à risca — ler antes de auditar, analisar ou reorganizar qualquer módulo. Em conflito, as regras de segurança abaixo prevalecem sobre ele — ver a nota de estado de operação logo abaixo.

**Acesso que eu tenho:** o repositório GitHub **e o deploy por GitHub Actions**
(`deploy-homologacao.yml` e `deploy-producao.yml`). Publicar é comigo — não
mandar arquivo para o usuário colar à mão. Não tenho o editor do Apps Script
nem o Drive de trabalho.

O conector do Google Drive lê metadado (dá para listar o projeto
`SISGEP-OFICIOS`), mas **não lê o código-fonte** de projeto Apps Script — esse
MIME type não é suportado.

**E NÃO SERVE PARA LER A PLANILHA DE PRODUÇÃO — testado em 11/09/2026.** A
`SISGEP - ATIVA` (id `1QPpsx19...040E`) tem 2,6 MB. O `read_file_content`
devolve ~1,76 milhão de caracteres e **corta em silêncio, sem dizer onde**: no
teste vieram as abas de Associados e Escolas, e **não vieram** nem
`FILA_ENVIO_OFICIOS` nem `LOG_SISTEMA` — os nomes das abas sequer aparecem no
texto. Eu quase concluí "cinco ofícios nunca foram reenviados" a partir de
meia planilha. **Para esta planilha, pedir ao usuário um Ctrl+F na aba certa é
mais rápido e infinitamente mais confiável do que baixar.**

Portanto: toda afirmação sobre o que está no ar depende de o usuário confirmar.

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

## 🚨 REGRA Nº -2 — ARQUIVO NÃO SAI DAQUI SEM VALIDAÇÃO RODADA

Definida pelo usuário em 2026-08-17: *"você não pode me passar um arquivo com
erro, você tem que testar isso antes"* — e, no mesmo dia, o lembrete de que
não era a primeira vez: *"não é só de hoje, você vem me mandando o arquivo,
que eu sempre pergunto"*.

**Antes de entregar qualquer `.gs` ou `.html` para ele colar no Apps Script,
rodar `node tests/e2e/t46-arquivos-integros.js`.** Se reprovar, não manda —
conserta primeiro. Na mensagem que acompanha os arquivos, dizer que a
validação rodou e o que ela cobre.

Por que isso é crítico neste projeto: os `.html` são colados uns dentro dos
outros pelo `include()` e todos os `<script>` viram um escopo global só. Um
único arquivo com `<script>` desbalanceado, um `</script>` literal dentro de
string ou um erro de sintaxe **derruba o JavaScript da página inteira** — e o
sintoma não aponta para o culpado: todos os módulos param de responder ao
mesmo tempo, sem erro visível. Ver a REGRA Nº 0.

O que o t46 cobre: sintaxe de todo `.gs`, sintaxe de todo bloco `<script>`,
balanço das tags, `</script>` dentro de string, e scriptlet em comentário.
**É o piso, não o teto** — sintaxe válida não é comportamento correto. A
REGRA Nº -1 continua valendo inteira por cima desta.

## 📦 O PROJETO ESTÁ NO LIMITE DE TAMANHO DO APPS SCRIPT (13/11/2026)

O push de homologação falhou com *"The project is too large to save"* ao
acrescentar 6 KB. O limite é ~10 MB de carga e o projeto (todos os .gs, .html e
o appsscript.json) tinha 9,87 MB: entrou com 9.874.654 bytes, não entrou com
~9.880.800. Recuperado sem perda (as duas imagens JPEG embutidas em
CompassoCanhotosArte.html recomprimidas sem mudar nenhum pixel: −8,8 KB), mas a
folga é de ~4 KB. **Antes de acrescentar código, ver a folga no t45 (passo 6),
que barra o push.** Espaço de verdade só sai com decisão do usuário: o banner
de 321 KB embutido em CompassoCanhotosArte.html (poderia morar no Drive), os
.gs de teste/legado (EventosImportacaoTeste.gs 32 KB, RHSeedColaboradores.gs
17 KB…) ou arquivos de módulos não usados. REGRA 1: nada é apagado sem ele pedir.

## 🚨 REGRA Nº -1.5 — TODA FUNÇÃO CHAMADA TEM QUE EXISTIR (10/11/2026)

O usuário, ao saber que formatarDataExtensoBR nunca existiu (Recibo e Recibo
Diverso quebravam): *"eu sempre peço que você faça auditoria de todas as
funções, o que é chamado, do que é proposto ... isso não pode acontecer."*
**tests/e2e/t250-funcoes-chamadas-existem.js** lê TODO .gs e TODO script
dos .html e reprova se uma função chamada não existe, ou se a tela chama
função privada do servidor (terminada em "_" — o Apps Script bloqueia).
Roda na suíte, então barra a publicação. Exceção nova só com o motivo
escrito na lista ACEITAS do teste, conferida no código. Na primeira rodada
achou e corrigiu: formatarCPF/formatarPix (Recibo.gs), o 📎 da Sofia na
Home (chamava analisarAnexoSofiaHome_, privada) e três funções da tela do
Oftalmo. Ficaram registradas, para o usuário decidir: o aviso de limite da
Taxa Assistencial (enviarAlerteLimiteDiario nunca existiu) e o pixel antigo
de GuiasPagamento.gs (legado).

## 👁 OFTALMOLOGIA — SERVIÇO ENCERRADO E CÓDIGO APAGADO (13/11/2026)

10/11/2026: *"não terá mais esse serviço ser oferecido"* (saiu só da tela).
13/11/2026, com o projeto no limite de tamanho do Apps Script: *"pode apagar e só
tenha cuidado para não cair outro módulo"*. Apagados: AgendOftalm.gs,
AgendOftalmo.html, Scripts_AgendOftalmo.html, AgendaOftalmoPublica.html e o
teste t251. `?portal=oftalmo` responde um aviso de serviço encerrado. As ABAS de
dados (Agend_Oftalmo, Log_Agend_Oftalmo) NÃO foram tocadas. tests/e2e/t252 trava
que nada mais inclui os arquivos apagados. Não recriar sem ele pedir.

## 🎟️ INGRESSOS DA FESTA — TICKONE (14/11/2026)

Os ingressos são emitidos no **TickOne** (ingressos.sindeducacao.com.br, plataforma paga;
evento "No Compasso da Vida", 494 ingressos lidos). O SISGEP NÃO emite: **lê** a base e
ajuda a **enviar, um a um, pelo WhatsApp** (Eventos › Festa › Ingressos, no computador e no
celular — CompassoIngressos.html + CompassoIngressosDados.gs, t259). Decisões do usuário:
- *"Quando for solicitar, sempre pesquisar antes"*: toda conferência compara a lista com a
  base lida pelo robô (CPF, e na falta o nome); quem já tem ingresso aparece com o código e
  nunca é pedido de novo. A base precisa ter menos de 15 min para pedir.
- Lista por planilha (CSV) ou pessoa a pessoa. **Sem limite de vagas.**
- Cinco categorias, as do TickOne: Associado, Acompanhante Associado (solta, sem ligação com
  um associado), Convite, Cortesia, Pago. **Associado: todos os campos obrigatórios** (nome,
  CPF, telefone, e-mail, escola, cidade); **os demais: só nome e CPF**, o resto em branco libera.
- Envio individual; WhatsApp só por link (wa.me), o PDF o operador anexa; só vira "enviado"
  depois do "Confirmar envio". Fora de questão enviar em massa ou pela API da Meta.
- Os PDFs ("TickOne - Nome.pdf") ficam na pasta do Drive INGRESSOS FESTA COMPASSO 2026
  (Financeiro); o usuário já tinha essa pasta — não criar outra.
- O robô (tools/ingressos-robo/, GitHub Actions + Playwright) usa o login nos Secrets
  INGRESSOS_USUARIO/INGRESSOS_SENHA (+ CLASPRC_JSON); **nunca** pedir nem guardar a senha fora
  dos Secrets; nada pessoal no log. ler-base.js só lê e grava ingressos-base.json numa pasta
  privada do Drive. **ERRO MEU de 14/11:** no reconhecimento o robô clicou no botão do WhatsApp
  da 1ª linha (casou com "pdf/ingresso") e subiu o contador de envios do TickOne (1x→2x);
  corrigido — só clica em "Reemitir (PDF)". O robô nunca deve clicar em WhatsApp/e-mail/excluir.
- **EXCLUIR INGRESSO (usuário, 14/11/2026):** *"o cara não vai, quero excluir ... pesquiso no SISGEP
  o nome dele, vou em exclusão e você faz toda a operação por trás"*; antes: *"você não pode mexer nos
  ingressos emitidos"*. Botão 🗑 Excluir na linha → confirmação "não tem volta" → fila
  (Ingressos_Exclusoes + exclusoes-fila.json) → robô excluir.js exclui no TickOne SÓ o que está na
  fila (máx. 5), confere código E CPF, não exclui quem já fez check-in, relê e confere que sumiu;
  PDF do Drive não é apagado. O robô é acionado por MIM (push em tools/ingressos-robo/PEDIDO-EXCLUSAO
  ou reexecução), não pelo botão — o botão direto exigiria o workflow na branch principal + chave do
  GitHub no SISGEP (decisão do usuário, não feita). Testado só contra um TickOne FALSO (t260); a
  exclusão REAL nunca rodou: o primeiro uso é com um ingresso de TESTE. Nunca excluir sem pedido
  confirmado na tela.
- **EMISSÃO PELO ROBÔ (usuário, 14/11/2026: "faz um ingresso de teste"):** depois da conferência, "Pedir
  emissão" (confirmação "cria ingresso de verdade") → fila (Ingressos_Emissoes + emissoes-fila.json) →
  emitir.js abre UM lugar livre da grade (2.500 lugares; sem limite de vagas), preenche o pop-up
  (tipo, nome, e-mail, CPF, telefone, cidade, escola na observação) e clica só em "Emitir Ingresso";
  recarrega e confere UMA linha nova com o CPF e lê o código. Trava: CPF que já tem ingresso não é emitido
  (pesquisar antes, base lida há <15 min); qualquer falha PARA a execução e não tenta de novo (evita
  emitir em dobro); máx. 5. Acionado por MIM (push em PEDIDO-EMISSAO ou reexecução). Testado só contra um
  TickOne FALSO (t261); a emissão REAL nunca rodou — o 1º uso é UM ingresso de TESTE (do próprio usuário,
  dados digitados por ele na tela; nunca no código nem no git). TickOne não tem campo de data de nascimento.

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

## 🤖 O ROBÔ É UM FUNCIONÁRIO QUE APRENDE — DIRETRIZ DO PROJETO (30/10/2026)

O usuário: *"esse projeto é um projeto de automação ... esse robô, nada mais
do que ele é como se fosse um trabalhador, um funcionário meu. Então, eu
preciso que ele aprenda, tenha memória evolutiva, vai aprendendo os
processos, para mais adiante ele fazer todo o processo."*

Vale para todo módulo, não só e-mail. Todo fluxo novo nasce com as quatro
partes abaixo — fluxo sem elas está incompleto:

1. **Registrar** — toda decisão de pessoa vira exemplo guardado (o que o
   robô sugeriu, o que a pessoa fez, quem, quando). Categoria trocada,
   campo corrigido, texto editado, pendência derrubada, aprovação.
2. **Usar o que aprendeu** — os exemplos voltam para o robô (na IA, como
   exemplos do próprio sindicato; nas regras, como ajuste). Guardar e não
   usar não é aprender.
3. **Medir** — taxa de acerto por tarefa ("categoria", "documento que
   falta", "texto da resposta"…), visível para o usuário.
4. **Subir de nível só com o usuário** — quando uma tarefa acerta de forma
   consistente, o sistema PROPÕE fazê-la sozinho; quem liga é o usuário,
   por tarefa, e dá para desligar. Até ele ligar, vale "nada sai sozinho".

## 🤖 O ROBÔ SOBE DE NÍVEL — DECISÕES DE 09/11/2026

O usuário: *"preciso que comece a entender e a fazer as tarefas"*; *"que
ele aprende e vai fazendo sozinho quando tiver alta [taxa] de aprovação"*;
*"o robô não envia nada sem a minha permissão, a não ser quando eu vejo que
está com um percentual de acerto muito grande"*; *"eu avalio antes tudo
neste momento"*. CaixaRoboNiveis.gs:
- A categoria JÁ é automática (o e-mail cai no card). O que faltava era
  MEDIR o acerto: tratar o e-mail sem mudar o card agora conta acerto.
- Primeira tarefa que sobe de nível: "e-mail que não pede nada"
  (agradecimento, "recebido", resposta automática). Regra: 50 decisões, 95%
  de acerto, 20 seguidas → o robô PROPÕE; só administrador liga, por caixa;
  ligado, só RESOLVE por dentro (com Desfazer); abaixo de 90% nas últimas
  20, desliga sozinho e avisa. Comprovantes de pagamento ficam fora.
- Nada que SAI (responder, encaminhar, emitir) sobe de nível sem o usuário
  pedir, olhando a taxa de acerto. Hoje ele avalia tudo antes.
- **ATUALIZADO NO MESMO DIA (09/11/2026), depois de publicado:** *"Não quero
  mais esse serviço. Quero que resolva."* O "não pede nada" foi DESLIGADO
  (CRN_NADA_ATIVO = false): não aponta, não resolve, não aparece na tela.
  Não propor de novo sem ele pedir. Fica só a MEDIÇÃO da categoria
  (invisível) e a correção da Nota interna.

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

## 🔐 E-MAILS DA SECRETARIA NO SISGEP — REGRA MUDADA EM 29/10/2026

Até 29/10/2026 valia *"os e-mails da secretaria não devem ser acessados pelo
financeiro"* (21/10), e só os pedidos de voucher entravam no SISGEP. Em
29/10/2026 o usuário autorizou trazer **todos** os e-mails da Secretaria
para o SISGEP ("Caixa da Secretaria"), com esta condição:

- (29/10) Abria só Secretaria e administrador — ver a atualização de 30/10
  abaixo. A trava é sempre no servidor, não só na tela.
- O conteúdo passa a ficar numa planilha da conta do Financeiro (é onde o
  SISGEP roda) — o usuário sabe e aceitou.
- Propaganda e notificação automática continuam de fora.
- **A Secretaria vê todos os e-mails da caixa dela**, de todos os tipos,
  inclusive guia/boleto (usuário, 29/10/2026).
- **ATUALIZADO EM 30/10/2026:** *"tanto secretaria quanto financeiro podem
  olhar tudo. Se tiver categorizado, não tem problema."* A Caixa abre para
  administrador, o usuário secretaria@ e quem tem o módulo Comunicação,
  Financeiro ou Caixa da Secretaria. Quem só tem outros módulos não abre.
  A condição dele é estar CATEGORIZADO — não tirar a categorização.
- **ATUALIZADO EM 31/10/2026 — CADA UM COM A SUA CAIXA:** *"Quem acessar
  pelo seu usuário vai ver somente uma caixa — a Marcelha vê a secretaria e
  o Wanderson vê o financeiro."* A divisão é por CAIXA de e-mail, não por
  assunto: a Marcelha vê tudo o que chega à secretaria@ (inclusive o que é
  do Financeiro, em cópia), categorizado; o Wanderson, tudo o que chega à
  financeiro@. Trava no servidor (cxsMeuPapel_/cxsExigirCaixaDe_). Quem não
  é nenhum dos dois (outro administrador) vê as duas.

## 📬 CAIXA DE E-MAILS ÚNICA — DECISÕES DE 30/10/2026

- Uma tela só para e-mail (Comunicação › Caixa de E-mails): aba Secretaria
  (secretaria@, KingHost) e aba Financeiro (financeiro@, Gmail do projeto),
  com os vouchers dentro. ~~Painel do Dia fica só como resumo.~~ **03/11/2026:
  o Painel do Dia SAIU do menu** — *"está conflitando com o dashboard
  executivo da página inicial, que deveria fazer o contexto de tudo ... só
  deixar a comunicação e e-mails."* Comunicação abre a Caixa de E-mails; o
  contador de e-mails da Home usa o "a tratar" da Caixa. PainelDoDia.gs,
  PainelDoDiaUI.html, CockpitInteligente.html e CentralEmailIA.gs ficam no
  projeto (REGRA 1). A medição do robô (taxa de acerto) foi para o rodapé
  da Caixa (caixaRoboMedicao), 03/11/2026.
- ~~*"Tem que aparecer tudo"*: TODAS as pastas~~ — **REVISTO EM 31/10/2026:**
  *"o robô vai ler somente caixa de entrada e o certificado 2027-1. Somente.
  Itens enviados, rascunho, spam, lixeira, não tem necessidade."* A Caixa
  NÃO ganha essas pastas. Não propor de novo sem ele pedir. (A leitura só
  dos CABEÇALHOS de Enviados, que o robô já faz para saber quem já recebeu
  o voucher, não é pasta da tela — continua até ele dizer o contrário.)
- **ESCLARECIDO EM 03/11/2026 — AS DUAS CONTAS SÃO DIFERENTES.** A regra
  acima (só Entrada + CERTIFICADO 2027-1) é do ROBÔ DA SECRETARIA. Na conta
  do FINANCEIRO (financeiro@, Gmail do projeto): *"Eu quero trabalhar dentro
  do SISGEP com o meu e-mail. Então o e-mail tem que aparecer todas as
  pastas de e-mail. Caixa de entrada, itens enviados, lixeira, etc."* — a
  tela da financeiro@ mostra TODAS as pastas. O robô (categorização) na
  conta do Financeiro lê Caixa de entrada e, quando precisar, Itens
  enviados. Não confundir as duas contas de novo.
- **EM ESPERA (03/11/2026) — RECEBIMENTO DE TAXA NÃO É NO SISGEP, POR
  ENQUANTO.** *"Hoje quem faz toda a conciliação bancária é o Condomob."*
  Não ligar a Caixa ao "registrar recebimento" de TaxasSindicais.gs (nem o
  botão "Lançar no Financeiro", nem a situação da guia na caixa da escola)
  até ele pedir. O código de TaxasSindicais.gs fica como está.
  O que ele descreveu para o futuro é o ROBÔ DA CONDOMOB: *"ele tinha que
  entrar dentro do Condomob, verificar quais escolas estão devendo, quais
  escolas ainda não pagaram, fazer essa rotina, para cobrar o pagamento."*
- **CARDS (03/11/2026):** dá para criar, renomear e excluir qualquer card
  (do sistema também) na financeiro@. *"Se for excluir deve ter uma
  mensagem antes e sempre tem que estar vazio."* Excluir: só vazio, sempre
  com confirmação; Outros e Voucher nunca se excluem; card do sistema
  excluído volta por ⚙ Cards. Nome trocado vale só na financeiro@.
- **RESPONDEU, SAI DO CARD (03/11/2026):** "a tratar" e os cards contam só
  o que espera a equipe (NOVO). Respondido vai para "Respondidos" e volta
  sozinho como "mensagem nova" se a pessoa escrever de novo.
- **ATUALIZADO EM 06/11/2026 — A SECRETARIA@ TAMBÉM TEM AS PASTAS NA TELA.**
  *"Ler é uma coisa e aparecer é outra"*; *"ela vai trabalhar dentro do SISGEP
  junto ao e-mail"*; "De acordo". O robô continua LENDO só Entrada +
  CERTIFICADO 2027-1; as outras pastas (Enviados, Lixeira, as criadas)
  APARECEM e carregam no clique. Caminho: o Leitor da Secretaria publicado
  como App da Web (executa como a Secretaria, segredo na aba API da ponte) +
  CaixaSecretariaGmail.gs (ids "S:"). Combinado: lixeira no SISGEP = lixeira
  do Gmail da Secretaria (a cópia na KingHost fica); a Marcela deixa o webmail
  da KingHost. Novo e-mail e rascunhos da secretaria@: próxima etapa.
- **Itens enviados da financeiro@:** o robô lê só quando precisa (ex.: ao
  abrir uma conversa), nunca varrendo à toa (03/11/2026).
- Categorizar: o que é voucher vai para voucher; "Ver" num voucher abre a
  tela de conferência. Recategorizar à mão como Voucher também.
- *"A caixa de e-mail do SISGEP vai ser o e-mail onde a gente vai
  trabalhar. Se apaga nele, apaga em todo. Vai para a lixeira em todo."*
  Mandar para a Lixeira no SISGEP = mover para a lixeira do Gmail/KingHost
  também (não é apagar de vez). Sempre com clique e confirmação, nunca em
  lote sem mostrar o que vai.
- Robô da KingHost e leitor leem SÓ a caixa de entrada e a CERTIFICADO
  2027-1 (30/10/2026: "até para economizar ... se precisar de mais alguma
  pasta, eu aviso"). 2026-1 e 2026-2 já passaram. Não acrescentar pasta
  sem ele pedir.

## 📨 TODA A KINGHOST NO GMAIL DA SECRETARIA (12/11/2026)

O usuário: *"tem que copiar todos os e-mails"*, *"e todas as pastas também"*,
*"tudo no King deve aparecer no SISGEP — é o mesmo e-mail"*. As pastas da
secretaria@ (ABRIR, FICHAS DE SINDICALIZAÇÃO, OFÍCIOS…) só existiam na
KingHost; o SISGEP lê o Gmail da Secretaria. Cópia única, em duas peças:
tools/kinghost-migrar/migrar.py (GitHub, IMAP SÓ LEITURA, lotes no Drive) e
leitorMigracaoKingHost_ (leitor: Gmail.Users.Messages.import na pasta de
mesmo nome, NUNCA na caixa de entrada; Enviados → Itens enviados; mesmo
Message-ID não duplica, só ganha a pasta). Caixa de entrada antiga → pasta
"CAIXA DE ENTRADA ANTIGA (KINGHOST)". Lixeira, Spam e Rascunhos ficam de fora.
Modo em tools/kinghost-migrar/MODO (conferir|migrar); workflow
migrar-kinghost.yml; retoma de onde parou. Testes: teste_migrar.py e t255.
NÃO usar a importação do próprio Gmail (duplicaria a caixa de entrada e
gastaria IA).
**Medido em 12/11/2026: 45.763 e-mails, 38 GB — não cabem nos 15 GB do Gmail
gratuito.** O usuário escolheu a **opção 3**: ficam SÓ na KingHost os
Enviados (14 GB) e os certificados de 2022 a 2025; vem o resto (~21 mil
e-mails, ~10 GB), pastas pequenas primeiro. O leitor para sozinho se a conta
chegar a 2 GB do limite (MIG_SEM_ESPACO). Se um dia ele comprar espaço, é só
tirar SO_NA_KINGHOST/Enviados de migrar.py e rodar de novo (retoma).

## 📄 ROBÔ DAS FICHAS DO DRIVE → OFÍCIO (03/11/2026, em desenho)

O usuário: a maioria dos ofícios nasce de FICHA EM PAPEL, digitalizada e
salva no Drive (*"a pessoa preenche, a gente digitaliza e encaminha para a
escola ... vou lá no SISGEP, documentos, ofício, e faço todo o
procedimento"*). Pode haver várias fichas da mesma escola num PDF só (*"a
gente junta numa só"*). A ficha de sindicalização NÃO tem CNPJ — a escola
sai do cadastro (CPF na base, ou nome escrito mais parecido), com origem à
vista; sem certeza, a pessoa escolhe. Pastas que o robô olha (Drive da conta
do Financeiro, pasta-mãe 1JQOe8WTguf0vMxb83xVfezIySNSWnvu3):
- FILIAÇÕES › FILIAÇÕES 2026 › **Ficha de Filiação** → ofício de filiação
- DESFILIAÇÕES › **DESFILIAÇÃO 2026** → ofício de desfiliação
- DESFILIAÇÕES › **TAXA NEGOCIAL 2026** → oposição à taxa negocial
- **"Oficio de Filiação" NÃO** (lá ficam os ofícios já gerados).
Depois do envio, no mês seguinte: conferir se a pessoa entrou (filiação)
ou saiu (desfiliação/oposição) da lista de contribuição da escola, e
propor o e-mail de cobrança. Nada sai sem o clique. Ofícios é a operação
viva — a emissão continua no módulo de Ofícios, como hoje.

## 🧾 ROBÔ DOS COMPROVANTES (03/11/2026)

Rotina que lê sozinha os comprovantes (o mesmo "Ler comprovante" da Caixa),
decidida pelo usuário: **só a secretaria@, às 20h, no máximo 10 por vez**.
Só lê e anota (CaixaRoboComprovantes.gs, aba Caixa_Comprovantes_Lidos) — não
responde, não move, não marca nada. Começa desligado; quem liga é
administrador, no rodapé da Caixa. A financeiro@ não entra até ele pedir.
**09/11/2026 — FORA DO "SUBIR DE NÍVEL" DO ROBÔ:** *"Não precisa de comprovantes
de pagamento, ainda não é gerado pagamentos e recebimentos de boletos pelo
SISGEP."* A leitura de comprovante não entra entre as tarefas que o robô faz
sozinho. O código fica (REGRA 1) e continua desligado até ele pedir.
Existe uma rotina antiga, `processarEmailsMensalidade` (MensalidadeCore.gs),
que põe etiqueta no Gmail; não foi tocada (REGRA 1).

## 📄 CARDS DE OFÍCIOS NA CAIXA DA SECRETARIA (03/11/2026)

Desenho aprovado (docs/mock-caixa-secretaria-oficios.png). Quatro cards só da
secretaria@ (as duas taxas num card só — "deixa em uma somente", 03/11/2026) (OFICIO_* em CaixaSecretaria.gs). Quem decide o card é uma REGRA
no SISGEP (cxsOficioPorRegra_) — o leitor da Secretaria não mudou e continua
dizendo Filiação/Contribuições; o exemplo que vai para a IA dele volta ao
tipo que ele conhece. Taxa negocial/assistencial: *"geralmente pede junto com
a mensalidade sindical"*, no mesmo e-mail da escola — o e-mail fica em
Contribuições com o aviso "também pede ofício" e o botão para preparar. "Ver ofício"
(CaixaOficioEmail.gs) prepara; a EMISSÃO continua no módulo de Ofícios.

**ATUALIZADO EM 06/11/2026 — EMITIR DO PRÓPRIO E-MAIL.** O usuário: "pode
sim" usar a MESMA emissão do módulo de Ofícios. No e-mail aberto: "Emitir e
enviar à escola" chama gerarOficioWeb (mesmo número, PDF, fila e registro;
duplicata pergunta antes), com o "Conferi a escola e as pessoas" obrigatório
e só os anexos marcados (o robô pré-marca a ficha; contracheque/identidade
não vão). caixaOficioEmitir em CaixaOficioEmail.gs. Desenho:
docs/mock-acoes-no-email.png. NOTA FISCAL (06/11/2026, "2 - b": o prestador
manda a nota; "vamos enviar por e-mail à contabilidade"): o e-mail do card
Notas fiscais acha a despesa em aberto pelo e-mail do prestador (sem certeza,
a pessoa escolhe) e "Anexar e enviar à contabilidade" usa o caminho do
módulo de Despesas (uploadDocumentoManual + enviarLoteDespesasParaContabilidade,
o e-mail com o link de confirmação). CaixaNotaFiscal.gs. Próximo: voucher.

## ⚡ ATALHOS NO E-MAIL (10/11/2026)

O usuário: *"tudo que a gente oferece no sindicato, seja ofício, filiação,
desfiliação, taxa negocial, taxa assistencial, voucher, a gente deveria ter
esses atalhos direto"*; opção **B** (o robô sugere 1–2 com o motivo + "Mais
ações"); *"começa pela fase 1"*. CaixaAtalhos.gs + caixaOficioComTipo.
- Fase 1 (feita): os 4 ofícios + taxa assistencial, voucher, NF →
  contabilidade e encaminhar, em QUALQUER e-mail, pelos fluxos que já
  existem. A memória guarda o atalho usado (tarefa "atalho-email").
- **Não tem recibo de mensalidade** (usuário, 10/11/2026) — não propor.
- Fase 2 (feita, 10/11/2026): Recibo diverso pelo e-mail — *"pode ser de
  processo, compras avulsas e etc."*; o recibo é de *"quem recebeu do
  sindicato"* (o beneficiário assina); dois botões, "só gerar" / "gerar e
  enviar ao beneficiário" (*"2 - sim"*); secretaria@ e financeiro@.
  CaixaReciboDiverso.gs, pelo módulo de Recibos Diversos. O recibo
  assinado que volta é anexado e vai à contabilidade (a mesma das Despesas).
- Fase 3 (só se ele quiser): cadastro do associado pela ficha.

## 🪪 PEDIDO DE SINDICALIZAÇÃO POR E-MAIL (12/11/2026)

A sindicalização é **presencial**, na visita de um diretor ao local de
trabalho — não se listam documentos por e-mail. O usuário deu o modelo de
resposta (CXF_SINDICALIZACAO_MODELO em CaixaFerramentas.gs) e: *"se for
email, sim o padrão de resposta é esse... podendo ser alterado também"*. O
robô propõe nesse modelo (cxfRegraSindicalizacao_); o campo continua
editável. Não vale para ficha anexa (essa vira ofício de filiação). Pedido
aberto → FEITO em 12/11/2026: atalho "📱 Avisar o diretor da visita"
(CaixaDiretorVisita.gs) — Jocimar Vila Real e Lindolpho Gadelha; WhatsApp de
cada um cadastrado na tela (⚙ Diretores da visita, só administrador, nas
Propriedades — nunca no código); o robô monta a mensagem do e-mail com a
origem; o SISGEP abre o wa.me e o envio é o toque da pessoa; fica na nota
interna e na memória ("diretor-visita"). t254, t257.

**Caixa — FORMATO OUTLOOK, OPÇÃO A (13/11/2026).** O usuário não gostou das
versões de 12/11 ("duas faixas", "e-mail muito curto", "filtros uma bagunça";
"mockup sempre antes de implementar"; "quero desse formato", o do Outlook) e
escolheu a opção A de docs/mock-caixa-v3-*.png: uma faixa só, categorias na
coluna da ESQUERDA junto das pastas, lista por dia com as abas A tratar /
Respondidos / Resolvidos / Todos, e-mail à DIREITA com a altura toda e a barra
Responder · Encaminhar · Resolver · Lixeira · Ações do sindicato. "📐" (dentro
de ⚙ Filtros) ainda troca para embaixo/janela. No mesmo dia ("tem que ter
responder a todos, mover para a pasta arrastando o e-mail e os não lidos"):
**Responder a todos** (põe em Cc o Para+Cc da última mensagem de fora, sem os
nossos — cxsTodosDaConversa_), **arrastar o e-mail para a pasta** (o mesmo
MOVER) e aba **Não lidos** (aba Caixa_Lidos: abrir no SISGEP = leu; não mexe
na ULTIMA_VISTA). t258. **Desenho de
tela: SEMPRE mostrar o mockup e esperar a escolha antes de implementar.**

## 📤 REENVIO DE OFÍCIO COM MOTIVO (04/11/2026)

Desenho aprovado. No reenvio: motivo (só reenviar = como antes / alguns não
descontados / nenhum / outro), quem (vão só as fichas dos marcados; lote vai
inteiro), observação editável no e-mail com a cláusula pelo MTE. O PDF do
ofício é o mesmo e o número também — nada é reemitido. OficiosReenvioMotivo.gs;
o reenvio em si continua em reenviarOficio (EmailOficios.gs).

## 🧾 RECIBOS EM BRANCO DA FESTA (04/11/2026)

Eventos › Festa › Recibos em branco (CompassoRecibos.html + CompassoRecibosDados.gs).
Modelo A aprovado, no timbrado do certificado de voucher. Impresso: número,
festa, dia e data ("Data será impressa, numeração é necessário"); em branco:
nome, CPF, valor, extenso, serviço. A numeração é reservada no servidor (sem
repetir); reimprimir usa os mesmos números.

## 🏠 DASHBOARD EXECUTIVO (página inicial) — DECISÕES DE 06/11/2026

A Home é o painel do sindicato inteiro (InicioExecutivo.gs + index.html;
proposta em docs/PRODUTO-DASHBOARD-EXECUTIVO.md). Fatos que o usuário deixou
claros e que valem para qualquer tela nova:
- **Só 2 usuários, Wanderson e Marcela, os dois administradores.** Mudam só
  a caixa de e-mail de cada um (regra de 31/10).
- **O SISGEP NÃO gera boleto nem faz compensação.** Hoje ele só é o caminho
  para a plataforma (Condomob) onde se geram as guias sindicais. Gerar e
  compensar boleto é FUTURO — não mostrar "boleto vencendo" nem "pago".
- **Pagamento do China Park não passa pelo SISGEP** (só relatório).
- **A Festa Compasso da Vida não é controlada pelo SISGEP este ano**
  (Firebase talvez no ano que vem). Fora do painel.
- **Sem sino** ("não tem necessidade"). A lista "Precisa de você agora" faz
  esse papel.
- Número sem fonte não aparece; fonte que falha mostra "—", nunca 0.

## 🚨 VOUCHER POR E-MAIL — NADA SAI SOZINHO

Definida pelo usuário em 29/10/2026: *"o e-mail não sai sozinho em momento
algum"*, e o sistema *"tem que aprender vendo a gente fazer"*.

- Nenhuma mensagem (pedido de documento, resposta-padrão, voucher) sai sem
  o clique de uma pessoa. Não propor envio automático até o usuário pedir.
- Toda correção humana antes de enviar (campo editado, pendência derrubada,
  texto mudado) fica registrada como exemplo — é com isso que o sistema
  aprende e é com esses números que um dia se discute automatizar.
- Nunca voucher para quem não tem direito: filiação conferida sempre.

## 📜 CCT — CITAR SEMPRE A NUMERAÇÃO DO REGISTRO NO MTE

Definida pelo usuário em 2026-10-29: *"Sempre o MTE."*

A CCT 2026/2027 tem duas numerações: a do texto aprovado nas negociações
(a que o `CCTCore.gs` usa: 56 mensalidade, 57 taxa negocial, 58 assistência
médica) e a do texto registrado no MTE (registro **ES000256/2026**, sistema
Mediador: 38ª mensalidade, 40ª taxa negocial). **Todo texto que sai para fora
— ofício, e-mail, certificado, guia — cita a numeração do MTE**, de
preferência com o número do registro ao lado. É o documento público que o
contador e o advogado da escola conferem.

Exceção: o módulo de Negociação Coletiva trabalha sobre o texto negociado e
pode usar a numeração dele.

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
