# PENDENTE DE VERIFICAÇÃO EM AMBIENTE REAL

> Lista do que está **"não testado"** pela REGRA Nº -1 e depende de alguém
> executar no sistema no ar. Não é lista de bug nem de tarefa: é o que foi
> entregue e ainda **não pode ser chamado de pronto**.
>
> Regra de uso: o Claude relê este arquivo no começo de cada sessão e cobra
> o que estiver aberto. Item só sai daqui com o usuário dizendo que rodou —
> nunca por dedução, nunca por "deve estar funcionando".

---

## 🔴 ABERTO

### 26. Voucher — o registro diz em face de quem, e o relatório de duplicidade
**Aberto em:** 14/08/2026 · `VoucherPdf.gs`, `VoucherAdmin.gs`

Duas coisas pequenas e independentes, das suas duas últimas decisões.

**1. "Voucher emitido em face de FULANO em 14/08/2026 12:18 por SISTEMA."**
O registro de emissão dizia só "Voucher emitido." — e num módulo em que o
titular pede para três filhos, essa frase não diz nada. Quem lê o histórico
seis meses depois precisa saber **de quem** era a bolsa, não de quem era o
CPF. O nome que entra é o do **beneficiário** (`NOME_BENEFICIARIO`), caindo
para o solicitante só quando o beneficiário é o próprio titular. O carimbo é
montado uma vez e usado nos três lugares — status da solicitação, status do
protocolo e histórico — para os três dizerem a mesma coisa.

**2. `voucherRelatorioDuplicidades` — leitura, não migração.** Roda pelo
editor de scripts e não escreve uma célula. Devolve duas listas: quem tem
mais de uma bolsa na mesma janela, e quem passou dos 3 dependentes na mesma
janela. Cada grupo traz protocolo, nome e **a linha da planilha**, para
conferir sem procurar. Linhas sem período não entram (é o problema do item
25, não duplicidade) e status que não ocupa janela — INDEFERIDO, CANCELADO —
também não. Esses dois filtros sobreviveram à primeira rodada de mutação:
sem eles o relatório inventava duplicidade, e o teste não percebia.

| | |
|---|---|
| 🔴 Emitir um voucher de filho e ler o histórico | tem que sair o nome do **filho**, com data e hora |
| 🔴 Rodar `voucherRelatorioDuplicidades` na base real | pelo editor, olhando o Logger |
| 🔴 Conferir cada grupo que ele apontar | abrindo as linhas que ele nomeia |
| 🔴 Nada mudou na aba depois de rodar | é leitura; se mudou, é bug |

### 25. Voucher — corrigir o período que faltou
**Aberto em:** 13/08/2026 · `VoucherAdmin.gs`, `Scripts_Certificado.html`

As duas linhas antigas da base não emitiam — a trava está certa — e também
não tinham conserto pelo sistema: o lápis da lista é "Ver / Ações", aprova e
emite, não edita campo. Ficavam travadas dos dois lados.

Agora, ao abrir uma solicitação **sem período**, aparece uma faixa âmbar
dentro do modal com ano, semestre e "Gravar período". Some sozinha depois de
corrigida. Permissão: o mesmo perfil que aprova e emite, decidido por você.

**A porta é estreita de propósito, e as duas recusas são o que importa:**

1. **Não troca período que já existe** — trocar move a bolsa de janela e é
   outra decisão.
2. **Não vira atalho para a duplicata** — sem isso bastaria criar sem período
   e preencher depois para furar "um por pessoa por janela". A mesma checagem
   da criação roda antes de gravar, e a mensagem diz qual protocolo já ocupa
   o lugar.

**Um defeito meu, achado pelo próprio teste:** o rastro ia para OBSERVACOES,
e `atualizarStatusSolicitacao_` **sobrescreve** essa coluna — a emissão
seguinte trocava o texto por "Voucher emitido." e o registro de quem corrigiu
sumia. Passou para `Voucher_Auditoria`, que é append-only. O teste só pegou
porque lia depois da emissão; lendo antes, teria passado e a promessa de
rastro seria falsa.

| | |
|---|---|
| 🔴 A faixa aparece nas duas linhas antigas | e só nelas |
| 🔴 Gravar o período faz o ⚠ sumir da lista | e a solicitação passa a emitir |
| 🔴 A célula no Sheets mostra `2026/2`, não uma data | é o apóstrofo protetor funcionando |
| 🔴 A linha aparece em Voucher_Auditoria | com quem corrigiu e quando |

### 24. Voucher — vários beneficiários num pedido só
**Aberto em:** 13/08/2026 · `VoucherInstituicoes.gs`, `VoucherNovaSolicitacao.gs`, `Scripts_Certificado.html`

O bloco repetível de beneficiários, no padrão do "Adicionar trabalhador" do
Ofício: card numerado, ✕ para remover, `+ Adicionar` no cabeçalho, teto de 3.

O beneficiário que já existia continua sendo o **nº 1** e não mudou de lugar
— quem cadastra um só não vê diferença nenhuma, e o caminho antigo continua
chamando a criação única. Isso é testado.

**Dois defeitos de desenho que só a tela revelou**, os dois meus e os dois
corrigidos no mesmo dia:

1. A trava de duplicidade da tela abortava **o pedido inteiro** porque UM
   beneficiário estava duplicado — o contrário do desenho aprovado. Ela olha
   só o beneficiário de cima, que é o único que dá para conferir enquanto se
   digita; com cards extras, quem decide é o servidor, um a um.
2. E ela agarrava em **dois lugares**: o `return` em `nvSalvar` e o botão
   Salvar desabilitado. Corrigi o primeiro, o teste continuou vermelho, e o
   segundo só apareceu porque o teste clica no botão de verdade em vez de
   chamar a função.

| | |
|---|---|
| 🔴 Cadastrar dois filhos num pedido só | e ver dois protocolos |
| 🔴 O ✕ remove e renumera | sem deixar buraco na numeração |
| 🔴 O + Adicionar trava no 3º dependente | contando o de cima quando ele é dependente |
| 🔴 Lote parcial: um card verde, outro vermelho | e o modal NÃO fecha |
| 🔴 Cadastrar UM beneficiário continua igual | é o caminho que já funcionava |

**Falta a faixa "Renovar os 3"** — a memória já devolve os dependentes
conhecidos (backend pronto e testado no `t41`), mas a tela ainda não a
consome. Registrado como não testável dentro do `t41` e do `t42`.

### 23. Voucher — as regras de quantidade, corrigidas
**Aberto em:** 13/08/2026 · `VoucherPeriodo.gs`, `VoucherNovaSolicitacao.gs`

Regra fechada pelo usuário: **"dependente é no máximo 3, para ele mesmo é
somente um por semestre ou ano"**. O sistema fazia diferente das duas
maneiras, e as duas foram medidas antes de mexer.

**1. O titular tirava mais de uma bolsa no mesmo semestre.** A trava chaveava
por pessoa + CURSO + janela, então cada curso abria uma janela nova. Medido no
emulador: o mesmo titular criou TRÊS vouchers para 2026/2 — Pedagogia, Direito
e um MBA. **O curso saiu da chave**: o benefício é por pessoa e por período,
não por matrícula.

**2. O teto de dependentes era por ORDEM, não por contagem** — defeito do que
eu mesmo escrevi de manhã. Conferia se `ORDEM_FILHO` era ≤ 3, o que deixa
passar um quarto dependente cadastrado como "3º filho" com outro nome. Agora
é **contagem de nomes distintos na janela**, e o titular não ocupa vaga de
dependente: três filhos e o pai estudando são quatro bolsas.

| | |
|---|---|
| 🔴 Pedir a segunda bolsa do titular no mesmo semestre é recusado | mesmo em outro curso, outra faculdade |
| 🔴 O 4º dependente é recusado com os nomes de quem ocupa as vagas | inclusive no ensino superior |
| 🔴 O semestre seguinte libera as vagas de novo | o teto é por janela, não vitalício |
| 🔴 Titular + 3 dependentes na mesma janela passam | quatro bolsas, e é o certo |

**Consequência que precisa da sua palavra:** o que já está gravado não muda.
Se houver titular com mais de uma bolsa no mesmo período na base real, ele
continua como está. Posso levantar quem são — é relatório, não migração.

**Três testes mudaram de lado** e estão registrados com a história dentro:
`t37` passo 10 e `t40` passo 7 afirmavam que curso diferente abria janela
nova; `t40` afirmava que o 4º dependente em graduação passava. Não eram
testes errados na época — é a regra que mudou, e ficou escrito para ninguém
"consertar" a trava daqui a seis meses.

### 22. Voucher — o papel timbrado, a redação e o período obrigatório
**Aberto em:** 13/08/2026 · `VoucherPdf.gs`, `VoucherNovaSolicitacao.gs`, `Scripts_Certificado.html`

**Primeiro, um erro meu, corrigido no mesmo dia.** Eu tinha medido UM PDF
emitido no ar, visto que faltavam cabeçalho e rodapé, e concluído que o
`getAs(MimeType.PDF)` largava as imagens grandes. Reescrevi as duas peças em
CSS por causa disso. Estava errado: um segundo PDF, emitido 46 minutos
depois, traz as duas imagens inteiras — 1000×177 com 12.010 bytes e 1000×226
com 21.865. O conversor nunca largou nada; o que faltava na primeira emissão
era o próprio arquivo, que ainda não estava no projeto. Uma amostra, duas
explicações possíveis, e eu escolhi a que exigia menos verificação.

A arte voltou a ser imagem, porque a arte é melhor: a faixa rosa é um
paralelogramo, os contatos têm ícones e a tarja do Salmos é manuscrita — nada
disso se reproduz com retângulo de CSS. **O desenho ficou como reserva**, para
o documento não sair careca se a constante faltar, e o `t33` exercita as duas
pontas.

**O rodapé ganhou imagem nova** (13/08/2026). Em vez de pedir a arte
refeita, editei a própria imagem: as duas linhas de texto foram apagadas e
redesenhadas com `secretaria@sindeducacao.com` e `www.sindeducacao.com`,
preservando ícones, tarja do Salmos e tudo o mais. O tamanho e a cor da fonte
saíram medidos da imagem original — Liberation Sans (métrica do Arial), corpo
calibrado pela largura da linha antiga, cor escolhida por comparação
estatística com os pixels do texto que já estava lá. Antes e depois lado a
lado ficaram indistinguíveis.

**O período virou obrigatório**, e não é campo cosmético. Sua tela mostrou
duas solicitações com PERÍODO vazio; reproduzido no emulador, sem período a
mesma pessoa passa DUAS VEZES no mesmo curso — a trava compara a janela, e
janela vazia não delimita nada. A porta pública já exigia; a administrativa,
não. Agora as duas exigem, e a tela avisa antes de ir ao servidor.

| | |
|---|---|
| 🔴 O PDF emitido sai com cabeçalho e rodapé | com a arte de volta |
| 🔴 A assinatura e o QR aparecem | vêm do Drive, simulado no emulador |
| 🔴 Cabe em UMA página | o rodapé é absoluto; conteúdo longo pode empurrar |
| 🔴 Salvar sem escolher o ano é barrado na tela | com o campo marcado em vermelho |
| 🔴 As duas solicitações antigas, sem período | ficaram gravadas assim e continuam sem trava — decidir se corrige na mão |
| 🔴 O banner "Não consegui preparar o envio" | agora diz o motivo; ver se ainda aparece |
| 🔴 O rodapé sai com secretaria@ e www. | a imagem foi regravada; conferir no PDF real |
| 🔴 Linha sem período mostra "⚠ sem período" na lista | as duas antigas devem aparecer assim |
| 🔴 Emitir uma delas é recusado com o motivo | e a prévia continua abrindo |
| 🔴 O 4º dependente é recusado no ensino básico | e aceito em graduação/pós |

**Decisão fechada em 13/08/2026 — o QR e o código de validação FICAM.**
Apontei que o certificado de referência não os tem; você reafirmou que quer os
dois. Travado por teste no `t33`.

**A redação passou a ser a do papel**, extraída do `GLAUCIA_SOUZA_NRAMOS.pdf`
com PyMuPDF. Duas divergências deliberadas: o dois-pontos de "inscrita no
CNPJ: sob nº" é erro de digitação do original e saiu; e o ano da CCT vem de
`NEGCOL_VIGENCIA` em vez de fixo — o papel de referência, emitido em agosto de
2026, cita a CCT 2025/2026, que venceu em 28/02/2026.

### 19. SOFIA — a procedência embaixo da resposta
**Aberto em:** 13/08/2026 · `ChatIACore.gs`, `ChatSISGEP.html`

Depois de responder, a SOFIA passa a dizer **de que documento a resposta
saiu**: um chip discreto embaixo do balão — `📜 Estatuto · ESTATUTO
SINDEDUCACAO-ES (vigente, aprovado em 17/11/2025)`. Sem documento consultado,
nada é desenhado.

E há um segundo caso, que é o motivo real disto existir: quando a resposta
**cita cláusula ou artigo sem o documento ter entrado no prompt**, aparece um
aviso âmbar dizendo que o número não foi conferido contra fonte nenhuma. É o
defeito que ninguém percebe sozinho — a resposta sai com a mesma cara de
sempre e o artigo pode ser invenção.

**O que já está travado por teste** (`t38-sofia-fontes.js`, 46 asserções,
7 mutações mortas em 7): a lista de fontes é **lida do prompt montado**, nunca
recalculada — a única forma de a tela dizer "consultei o Estatuto" é o bloco
do Estatuto estar lá dentro; a identificação vem da primeira linha do próprio
documento, sem a moldura de `===`; documento fora do mapa de rótulos também é
anunciado; e o alerta não dispara em `art. 477 da CLT` nem em `art. 8º da
Constituição`, que são referência de lei e não citação nossa.

**O que só se confere no ar** — é isto que fica pendente:

| | |
|---|---|
| ✅ A linha aparece embaixo de uma resposta real | **verificado 13/08, print** — `CONSULTEI 📘 CCT · CCT 2026/2027` |
| ✅ O aviso âmbar aparece quando deve | **verificado 13/08, print** — e pegou três citações erradas na primeira vez |
| 🔴 Com CCT e Estatuto na mesma pergunta, os dois chips aparecem | ex.: piso da telefonista + quórum da assembleia |
| 🔴 Pergunta de cadastro não desenha nada | "quantos associados temos" |

**O que o aviso pegou em 13/08, e vale registrar:** perguntado "quem pode
participar da votação?" no domínio Geral, sem documento anexado, a SOFIA
respondeu citando **arts. 74, 85 e 96**. Conferido contra o estatuto vigente:
o art. 74 é da eleição decenal dos órgãos diretivos, o art. 85 é da
publicação das chapas registradas — nenhum dos dois fala de quem vota. O
conteúdo citado existe, mas no **art. 88**, e quem pode votar é o **art. 4º,
II**. Três citações, três endereços errados, nada na resposta denunciando.
Isso gerou os itens 21 e a correção da redação do aviso.

### 21. SOFIA — a segunda leitura
**Aberto em:** 13/08/2026 · `ChatIACore.gs`

Pedido do usuário depois de ver o aviso funcionando: *"mas ele deveria ser
consultado"*. Avisar que não consultou trata o sintoma. Agora, quando a
resposta cita artigo ou cláusula que não entrou no prompt, o sistema **anexa
o documento que faltou e pergunta de novo** — e entrega a segunda resposta.

Junto foi o vocabulário: "votação", "voto", "eleitor", "eleitoral", "chapa",
"urna", "escrutínio", "delegado", "estatutário", "desfiliação".

**Travado por teste** (`t38`, 75 asserções, 7 mutações mortas em 7): a
segunda chamada acontece e leva o documento; a resposta entregue é a
segunda; pergunta sem citação não gasta chamada extra; se a segunda falhar —
por erro 500 **ou** por resposta vazia com código 200 — fica a primeira
**com** o aviso; e o caminho da CCT vale igual.

**O que só se confere no ar:**

| | |
|---|---|
| 🔴 "quem pode participar da votação?" no Geral | agora deve vir com o chip do Estatuto e **sem** faixa âmbar |
| 🔴 A citação passa a estar certa | conferir se cita art. 88 e art. 4º, II — e não 74/85/96 |
| 🔴 A demora da segunda leitura é tolerável | ela só acontece quando a primeira citou sem fonte |

**Cuidado ao ler o resultado:** se a resposta continuar citando artigo
errado **com** o chip do Estatuto presente, o problema deixou de ser "não
consultou" e passa a ser o seletor de trechos — ele escolhe parágrafos pelas
palavras da pergunta e pode não ter trazido o artigo certo. Aí a correção é
outra: conferência de citação (comparar os artigos citados com os que
entraram) ou um índice do documento sempre anexado.

### 20. Layout — painel sob demanda, chips e menu recolhível
**Aberto em:** 13/08/2026 · `ChatSISGEP.html`, `index.html`

Três mudanças aprovadas em 13/08:

1. **A coluna de especialidades virou uma linha de chips** dentro da SOFIA.
   Os 11 modos continuam lá, com rolagem horizontal; a coluna de ~176px
   sumiu. Junto foi a barrinha decorativa "Contexto | Ações" e o bloco
   "Atividade da SOFIA", que listava três promessas que nunca chegavam.
2. **O painel da direita só aparece quando tem conteúdo** — quando a
   conversa identifica uma escola. Sem isso, a conversa ocupa a largura
   inteira.
3. **O menu do Portal recolhe para ícones** (☰), com a escolha gravada por
   pessoa no navegador. Quem não clicar não vê diferença.

**Travado por teste** (`t39-sofia-tela.js`, 23 asserções, 7 mutações mortas
em 7): os 11 chips existem, um só fica ativo por vez, o painel nasce
recolhido, abre com escola identificada, fecha ao trocar de modo e fecha
quando a resposta seguinte não traz contexto.

**O que só se confere no ar** — jsdom não aplica CSS, então nada disto foi
visto de fato:

| | |
|---|---|
| 🔴 Os chips cabem na barra e rolam | com o menu do Portal aberto e recolhido |
| 🔴 A coluna da direita some mesmo | e volta quando a escola é identificada |
| ✅ O ☰ recolhe | **verificado 13/08** — falta só confirmar que sobrevive ao F5 |
| 🔴 A escolha sobrevive ao F5 | é `localStorage`; pode estar bloqueado no navegador |
| 🔴 Clicar num módulo com submenu estando recolhido | deve abrir o menu e o acordeão junto |
| ✅ **Ofícios continua igual** | **verificado 13/08** — "ofício apareceu"; emissão inteira conferida |

O último item é o que mais importa: mexi no `index.html`, que é a moldura de
tudo. Se a emissão de ofício estiver diferente em qualquer coisa, é aqui que
se volta.

**Uma perda deliberada:** a frase "A SOFIA usará memórias autorizadas e o
histórico desta conversa" ficava no pé da coluna que saiu. Não a realoquei —
se fizer falta, ela volta como uma linha discreta no rodapé do campo de
digitação.

### 17. Voucher — o reparo do cabeçalho de `Voucher_Solicitacoes`
**Aberto em:** 12/08/2026 · `Voucher.gs`, `VoucherReparoColunas.gs` · **BLOQUEIA EMISSÃO**

**O que aconteceu, e a instrução foi minha.** Mandei rodar
`inicializarModuloCertBolsa()` dizendo que era idempotente e que podia rodar
sem medo. O `ensureHeaders_` escrevia o nome de uma coluna faltante **na
posição que ela ocupa na lista canônica**, por cima do nome que já estava ali.
O dado embaixo não se move — e `mapRowToObject_` resolve por nome, então o
valor de uma coluna passa a ser lido sob o nome de outra.

Medido na planilha real pelo `voucherDiagnosticoColunas`: **13 das 38 colunas
com rótulo trocado**, e três nomes sumiram (`CURSO`, `ORDEM_FILHO`,
`LINK_CONTRACHEQUE`). Piorava a cada execução, e
`setupVoucherModuleFase1()` é chamada de nove lugares — vários em caminho de
leitura. Abrir a prévia já rodava mais uma volta.

**O que já está fechado (código, verificado no emulador):**

| | |
|---|---|
| `ensureHeaders_` não renomeia mais | coluna nova entra no fim; `t31`, 15 asserções |
| o reparo existe, com prévia e backup | `t32`, 46 asserções, 11 mutações mortas |
| a trava de mapa vencido morde | recusa se uma célula do cabeçalho divergir |

**O REPARO FOI EXECUTADO E CONFERIDO — 12/08/2026, 19h20.**

| Item | Situação |
|---|---|
| **Prévia conferida pelo usuário** | ✅ as 13 linhas, idênticas ao mapa testado |
| **Reparo aplicado** | ✅ backup `BACKUP_VOUCHER_SOLIC_20260812_191949` (2 linhas × 38 colunas) |
| **Diagnóstico de conferência** | ✅ **41 colunas · ausentes: nenhum · repetidos: nenhum** |
| **Cada rótulo bate com o valor** | ✅ conferido linha a linha no log |

O par que mais importava saiu certo: `MODALIDADE` = `EDUCACAO_INFANTIL`
(código do catálogo) e `CURSO` = `Educação Infantil` (texto digitado). Era a
distinção mais fina da reconstrução — enum de um lado, texto livre do outro —
e ela se confirmou sozinha.

A coluna 3, minha única dúvida no mapa, não estava entre as 13 e não foi
tocada.

**O que ainda falta:**

| Item | O que precisa acontecer |
|---|---|
| 🔴 **Prévia do certificado depois do reparo** | "Instituição de ensino" deve sair **vazia** — o campo nunca foi coletado — e não com uma data de nascimento no lugar |
| 🔴 **Guardar o backup** | `BACKUP_VOUCHER_SOLIC_20260812_191949` só pode ser apagado depois de a emissão sair correta pelo menos uma vez |

**Duas coisas menores que o mesmo log revelou, e que ficam para depois do
reparo:**

- **CPF perdeu o zero à esquerda** — saiu com 10 dígitos, então
  `formatarCpfVoucher_` (`Voucher.gs:35`) desistiu de formatar e imprimiu cru.
  A planilha guardou o CPF como número.
- **A logo do cabeçalho é URL externa** (`lh3.googleusercontent.com`). A
  assinatura virou base64 justamente porque URL externa não carrega de forma
  confiável no `getAs(MimeType.PDF)`; a logo tem o mesmo risco e ficou de fora.

---

### 18. Voucher — um por pessoa, por curso, por período (+ data do envio nas observações)
**Aberto em:** 13/08/2026 · `VoucherPeriodo.gs` (novo), `VoucherNovaSolicitacao.gs`,
`VoucherSolicitacao.gs`, `VoucherEnvio.gs`, `Voucher.gs`, `Scripts_Certificado.html`

Regra dada pelo usuário: *"somente um voucher por semestre ou por ano (no caso
do integral)"*, *"renovação é por curso — somente um por vez"*, *"não pode
gerar duas vezes para a mesma pessoa"*. Coberto por
`tests/e2e/t37-voucher-periodo.js` — 82 asserções, 15 mutações, todas mortas.

**O que o emulador provou:** a chave é PESSOA × CURSO × JANELA; a segunda
solicitação na mesma janela não grava linha; a recusa traz o protocolo
anterior; dois filhos do mesmo associado não se bloqueiam; RECUSADO e
CANCELADO liberam a janela; ANÁLISE já ocupa; `TIPO_SOLICITACAO` grava
PRIMEIRA_VEZ/RENOVACAO; o carimbo de envio acrescenta linha às observações sem
apagar o que a secretaria escreveu.

**O que uma mutação achou e eu não teria visto:** minha asserção da regra do
ANUAL estava medindo outra coisa — apagando a regra inteira o teste continuava
verde, porque os casos escolhidos caíam na regra do semestre desconhecido.
Corrigido com dois casos que só a regra do ANUAL faz passar.

| O que falta rodar no ar | Como se vê que está certo |
|---|---|
| 🔴 **Rodar `inicializarModuloCertBolsa()`** | a coluna `TIPO_SOLICITACAO` tem que aparecer **no fim** da aba, sem mexer em nenhuma existente |
| 🔴 **Cadastrar a mesma pessoa/curso duas vezes no mesmo semestre** | a caixa vermelha aparece com o protocolo anterior e os dois botões de salvar ficam apagados |
| 🔴 **Clicar em "Abrir a anterior"** | deve fechar este modal e abrir o detalhe do protocolo citado |
| 🔴 **Clicar em "Reenviar por e-mail"** (só aparece em EMITIDO) | deve abrir o modal de envio já com aquele protocolo |
| 🔴 **Trocar o período para o semestre seguinte** | a caixa vermelha vira a etiqueta azul de renovação e os botões voltam |
| 🔴 **Cadastrar dois filhos no mesmo ano** | os dois têm que entrar — este é o caso que a trava antiga bloqueava |
| 🔴 **Enviar um certificado e abrir a linha na planilha** | `OBSERVACOES` tem que terminar com `Enviado por e-mail em dd/mm/aaaa hh:mm para ... por ...` |
| 🔴 **Reenviar o mesmo** | segunda linha de carimbo, sem apagar a primeira |
| 🔴 **A etiqueta "renovação" na lista e no detalhe** | só nas linhas gravadas a partir de agora; as antigas ficam sem etiqueta de propósito |

**Ponto que merece olho na primeira semana:** período escrito sem o semestre
(`2026` num regime semestral) faz o sistema **travar** por precaução, com a
mensagem pedindo o formato `2026/1`. Se isso atrapalhar o atendimento, a
decisão é sua — o outro lado da moeda é emitir dois vouchers no mesmo semestre.

---

### 16. Voucher — o envio do certificado (e-mail, WhatsApp e trilha)
**Aberto em:** 12/08/2026 · `VoucherEnvio.gs`, `Voucher.gs`, `AuditoriaCore.gs`

#### ROTEIRO, NA ORDEM — 13/08/2026

A ordem importa: cada passo só faz sentido se o anterior passou, e os dois
primeiros não mandam e-mail para ninguém.

**1. `voucherDiagnosticoImagens()`** — botão Run do editor, sem argumento.
Só lê; não emite, não envia, não grava. Responde a única pergunta que a
prévia **não** responde:

```
✅ Logo do sindicato — data · 34 KB
✅ Assinatura do presidente — data · 12 KB
✅ QR code de validação — data · 3 KB
✅ As três imagens viram base64 — o PDF sai completo.
```

Qualquer linha `http` ou `VAZIO` é defeito **antes** de o documento existir.
`http` é o pior dos dois: aparece na prévia e some no PDF, porque quem baixa
a imagem na prévia é o navegador. Se o QR falhar, pare aqui — sem ele a
escola aponta a câmera no certificado e não acontece nada.

**2. `voucherPreviaSegura()`** — Run, sem argumento. Duas coisas ao mesmo
tempo: prova que a porta dupla funciona (é o padrão de `escolaVinculosStatus`,
mas nesta função nunca foi executado) e mostra o documento montado. **Não
conclua nada sobre imagem por esta tela** — ver o passo 1.

**3. Emitir um certificado de verdade**, pela tela, num protocolo APROVADO.
Abrir o PDF gerado e conferir as três imagens **no PDF**, não na prévia.

**4. Enviar para um endereço seu** — não para o associado. Conferir na caixa
de entrada: assunto com o protocolo, corpo, botão "Abrir o certificado", e o
**PDF anexado**. Se o anexo não vier, o link no corpo salva o envio.

**5. Reabrir o modal de envio do mesmo protocolo.** O histórico tem que
mostrar o envio do passo 4, com data, destino e quem enviou — é o que prova
que a trilha gravou. E a linha na planilha tem que ter o carimbo em
`OBSERVACOES`.

**6. `voucherPrepararEnvio("BOLSA-...")`** de um protocolo cuja instituição
esteja nas 679 escolas. Procurar `origemEmailInstituicao: "CADASTRO"` com o
endereço certo — é o defeito nº 2 da tabela abaixo, anterior a este trabalho.

**7. O `wa.me` no celular.** Abrir pelo botão e ver a mensagem já escrita. O
sistema **não envia zap** — quem aperta enviar é você.

O backend do envio está escrito e coberto por `tests/e2e/t30-voucher-envio.js`
(66 asserções, 10 mutações — todas mortas). O que o emulador prova é lógica:
quem entra pela porta, de onde vem cada e-mail, o que é destinatário e o que
é cópia, o que é recusado antes de sair, e o que fica no rastro.

**Três defeitos foram achados por rodar isto, e os três eram silenciosos:**

| # | Defeito | De quem | Como se manifestava |
|---|---|---|---|
| 1 | `voucherPrepararEnvio` lia `EMAIL_INSTITUICAO`, coluna que não existia | meu, deste trabalho | campo sempre vazio |
| 2 | `buscarEmailRhEscolaVoucher_` não procurava em `"E-mail (principal)"` | **anterior** a este trabalho | nunca achava e-mail de escola nenhuma, nas 679 |
| 3 | `voucherRegistrarEnvio_` chamava `auditoriaRegistrar`, que não existe | meu | e-mail saía, rastro não era gravado |

O 3 valia junto com um quarto: `voucherEnviosAnteriores_` lia por
`auditoriaConsultar`, que exige o módulo **Auditoria** — que quem emite
certificado normalmente não tem. A lista voltava vazia sem erro, e o modal
diria "nunca enviado" sobre um protocolo já enviado três vezes.

**E uma exposição, que eu mesmo introduzi:** `voucherPreviaSegura` foi escrita
sem trava nenhuma, para rodar pelo botão Run do editor. Prévia não grava nada
e por isso pareceu inofensiva — mas devolve o documento inteiro de um
associado real, e era alcançável sem login. O `t6-exposicao` acusou na hora
(216 · teto 215). Com a trava removida na mutação M1, um anônimo recebia
`{ok:true, linkPdf:"https://drive.google.com/file/d/..."}`. Corrigido com
porta dupla; o teto voltou a 215.

**Continua "não testado" — depende de execução no sistema no ar:**

| Item | O que precisa acontecer |
|---|---|
| 🔴 **O e-mail chega** | o emulador registra a chamada, não entrega. Enviar um para um endereço seu e conferir caixa de entrada, assunto, corpo e o botão "Abrir o certificado" |
| 🔴 **O PDF vai anexado** | `DriveApp.getFileById().getBlob()` é falso no emulador. Conferir se o anexo abre — e se não abrir, o link no corpo tem que salvar o envio |
| 🔴 **O defeito nº 2 sumiu na base real** | rodar `voucherPrepararEnvio` de um protocolo cuja instituição esteja nas 679 e ver `origemEmailInstituicao: "CADASTRO"` com o endereço certo |
| 🔴 **`voucherPreviaSegura()` roda pelo botão Run** | a porta dupla depende de `Session.getActiveUser()` devolver e-mail no editor. O padrão já funcionou em `escolaVinculosStatus`, mas nesta função ainda não foi executado |
| 🔴 **A trilha grava em produção** | no emulador cai na planilha de reserva. Com Firestore configurado o caminho é outro — conferir que `ENVIAR_EMAIL` aparece com protocolo, destino e usuário |
| 🔴 **O link `wa.me` abre no celular** | com a mensagem já escrita. O sistema **não envia zap** — quem aperta enviar é a pessoa |
| 🔴 **O modal de envio** | ~~não existe~~ — construído em 12/08/2026 e coberto por `t34` (49 asserções). Falta abrir no navegador: destinatário, cópia, aviso de reenvio e o botão do WhatsApp |

**Três colunas novas em `Voucher_Solicitacoes`** — `INSTITUICAO_ENSINO`,
`CNPJ_INSTITUICAO`, `EMAIL_INSTITUICAO` — entram por `ensureHeaders_`, que é
idempotente. Rodar `inicializarModuloCertBolsa()` (`Voucher.gs:1307`) uma vez
para criá-las. **Nenhuma tela preenche esses campos ainda**: a solicitação
hoje não pergunta onde a pessoa estuda, só onde ela trabalha.

---

### 15. Escolas Fase 4 — os vínculos passam a guardar escolaId
**Aberto em:** 12/08/2026 · **Fase 4 do item 8 do PROMPT-MESTRE**

A identidade existe desde 11/08 e **nenhum módulo a adotava**: `escolaId`
aparecia em 3 arquivos, os três do próprio módulo Escolas. `escolaPorId()` e
`escolaResolverIdentidade()` não tinham um único chamador externo.

`EscolasVinculos.gs` acrescenta uma coluna `EscolaID` em cada aba que aponta
para escola. **A coluna de nome não é tocada** — nome vira rótulo, id vira
vínculo, e desfazer é apagar uma coluna.

**Ordem obrigatória, de risco crescente. Associados é a ÚLTIMA:**

| # | Alvo | Aba | Casa por |
|---|---|---|---|
| 1 | Cobrança | `COBRANCA_RELACAO_NOMINAL` | CNPJ |
| 2 | Contatos | `Contatos` | nome |
| 3 | Visitas | `SISGEP_Visitas` | CNPJ + nome |
| 4 | Ofícios | `Controle_Oficios` | CNPJ + nome |
| 5 | **Associados** | `Associados` (col. `Nome fantasia`) | nome — **~8.000 linhas** |

**Roteiro, uma aba por vez:**

```
escolaVinculosStatus()              → o que já foi migrado
escolaVinculosPrevia("COBRANCA")    → mede, NÃO grava, vale 15 min
escolaVinculosAplicar("COBRANCA")   → grava, com backup
```

**Medido em 12/08/2026 por `escolaVinculosStatus()`:**

| # | Alvo | Situação real |
|---|---|---|
| 1 | Cobrança | **939 linhas** — não são dezenas, como eu estimei |
| 2 | Contatos | ❌ **aba não existe com esse nome** |
| 3 | Visitas | 6 linhas |
| 4 | Ofícios | ❌ **aba não existe com esse nome** |
| 5 | Associados | **8.019 linhas** |

Os nomes de aba em `ESC_VINC_ALVOS` foram deduzidos do código-fonte, não da
planilha. Duas erraram. **`escolaVinculosMapearAbas()`** varre a planilha e
aponta as candidatas por evidência — nome da coluna e conteúdo com cara de
CNPJ — para a correção vir do que existe, não de um segundo palpite.

**Mapeamento da planilha real, 12/08/2026:** 102 abas, 24 tocam escola,
**14 escolhidas como alvo**. Dois achados que mudaram o desenho:

- A aba de ofícios chama-se **`Controle`**, não `Controle_Oficios`.
- **`Contatos` não existe** — `contatos.gs:37` cria a aba na primeira
  gravação. O submódulo nunca rodou. Não é erro de nome.

**Fora de propósito:** `IMPORTACAO_ESCOLAS` (retrato, não vínculo),
`LOG_SISTEMA` (reescrever log é adulterar registro), `Prestadores_Serviços`
e `SISGEP_Sindicalizacao` (falsos positivos — o segundo casou por
"ESCOLARIDADE", já corrigido no mapeador).

| O que conferir | Como |
|---|---|
| ✅ **Status inicial** | rodado em 12/08/2026 |
| ✅ **Mapear as abas** | rodado — 24 candidatas, 14 viraram alvo |
| 🔴 **Status com os nomes certos** | `escolaVinculosStatus()` — as 14 devem existir |
| 🔴 **Começar por Visitas (6 linhas)** | `escolaVinculosPrevia("VISITAS")` |
| 🔴 **Prévia da Cobrança** | quantos casam por CNPJ, quantos ficam ambíguos |
| 🔴 **Aplicar na Cobrança** | coluna `EscolaID` nasce; `ESCOLA_NOME` intacta |
| 🔴 **As outras três** | uma por vez, conferindo entre elas |
| 🔴 **Associados por último** | e só depois de as quatro anteriores terem passado |
| 🔴 **Ofícios continua emitindo** | a coluna nova não pode afetar a emissão |

**AMBÍGUO NÃO É ADIVINHADO.** Nome que casa com duas escolas fica sem id e
vai para a fila. Coberto pelos passos 12, 13 e 42 do `t29`, com 120 linhas
de "CEI Girassol" que ficam vazias mesmo sendo 120.

**Se algo der errado:** apagar a coluna `EscolaID` da aba devolve tudo. O
backup de cada aba é criado antes de escrever, com nome `BKP_VINC_...`.

---

### 11. Escolas — a migração de identidade sobre a base real
**Aberto em:** 11/08/2026 · **Fase 1 do item 8 do PROMPT-MESTRE**
**Parcialmente verificado em:** 11/08/2026, pelo log de execução do usuário

A migração **rodou na base real**: `criados: 679`, `jaTinham: 0`, `total: 679`,
backup em `BACKUP_ESCOLAS_ID_20260811_205201`. Executada pelo dono do projeto
(`financeirosindecucacao@gmail.com`), registrada no log.

Isso corrigiu um número que este projeto vinha repetindo: são **679** escolas,
não 681. O `CLAUDE.md` foi ajustado.

| O quê | Situação |
|---|---|
| Rodar a migração | ✅ **verificado** — 679 escolas, zero erro |
| Ninguém ficou de fora | ✅ **verificado** — `criados` + `jaTinham` = `total` = 679 |
| Rodar de novo não estraga | ✅ **verificado** — segunda execução devolveu `criados: 0`, `jaTinham: 679`, **sem backup novo** |
| O backup existe | ✅ **verificado** — `BACKUP_ESCOLAS_ID_20260811_205201` |
| A coluna nasceu no lugar certo | ✅ **verificado** — `EscolaID` é a 37ª e última, 679/679 preenchidas, nenhuma outra coluna deslocada |
| **Ofícios continua emitindo** | 🟡 **parcial.** O seletor de escola do ofício foi aberto e trouxe CNPJ, cidade e e-mail corretos. **Emissão completa, com PDF e envio, continua não testada.** |

---

### 12. Escolas — o saneamento da base
**Aberto em:** 11/08/2026 · **Executado e conferido em:** 11/08/2026

A aba tinha um segundo conjunto de dados, vindo da consulta à Receita,
gravado em colunas com o rótulo errado. Medido, corrigido e conferido pelo
validador antes e depois:

| | Antes | Depois |
|---|---|---|
| Linhas 100% coerentes | 37 | **657** |
| Linhas com dado fora do lugar | 642 | **22** |
| `SITUACAO_CADASTRAL` | 634 datas | **0 trocadas** |
| `CNAE_PRINCIPAL` | 634 situações | **0** |
| `NOME_FANTASIA` | 638 e-mails | **0** |
| `ULTIMA_VERIFICACAO` | 268 telefones | **0** |

Backup em `BACKUP_ESCOLAS_SANEAMENTO_...`. Colunas novas no fim da aba:
`TELEFONE_RECEITA`, `EMAILS_RECEITA`, `SITUACAO_RECEITA`,
`DATA_CONSULTA_RECEITA`, `CEP_RECEITA`.

**Continua aberto — 19 linhas, em 4 padrões:**

| Padrão | Linhas | O quê |
|---|---|---|
| `E-mails (todos)` com número + `Telefone 1` com cidade | 9 | outra gravação antiga, outra ordem |
| `E-mails (todos)` com número | 6 | idem |
| `Telefone 2` com texto | 2 | inclui `(028) 73521-8042`, telefone malformado |
| `Telefone 1` com texto | 2 | nome de cidade |

São poucas e sem padrão limpo o bastante para migração automática. **Vão
para a fila de Pendências na Fase 2** — que é exatamente para isso que ela
existe.

---

### 13. Escolas — a padronização de formato (Etapa C)
**Aberto e executado em:** 11/08/2026

Rodou na base real. A prévia previu **1760 células** e a aplicação alterou
**1760** — linha por linha idêntica. Backup em
`BACKUP_ESCOLAS_PADRAO_20260811_231031`.

| O quê | Quantas |
|---|---|
| **UF preenchida a partir da cidade** | **648** — de 30 preenchidas para 678 |
| E-mails normalizados (`E-mails (todos)`) | 287 |
| Telefones (`Telefone 2`) | 79 |
| CEPs | 29 |
| Telefones (`Telefone 1`) | 20 |
| E-mail principal | 19 |

Decisão do usuário (opção A): `Alegre - ES` virou `Cidade="Alegre"` +
`UF="ES"`. Cada dado no seu campo.

**Intocados de propósito — 28 ocorrências, e é assim que tem que ser:**

| O quê | Quantas | Por quê |
|---|---|---|
| `E-mails (todos)` com número (`310`, `289`) | 15 | não é e-mail; adivinhar estragaria |
| `Telefone 1` com nome de cidade | 11 | idem |
| `Telefone 2` — inclui `(028) 73521-8042` | 2 | 12 dígitos, não existe telefone assim |
| Cidade sem sufixo de UF | 1 | extrair daria UF inventada |
| **UF da coluna diverge da cidade** (linhas 271, 364) | 2 | duas fontes discordam — decisão humana |

**Falha do meu relatório, para corrigir se voltar a aparecer:** a linha de
divergência diz *"cidade diz outra coisa"* e **não mostra o que a cidade
diz**. São só 2 linhas; dá para olhar direto na planilha.

| O que falta conferir | Como |
|---|---|
| ✅ **`UF` preenchida** | previsto ~678 de 679; medido **678** (`Sem UF` = 1) em 12/08/2026 |
| 🔴 **`escolaValidarColunas` depois da padronização** | linhas coerentes devem passar de 660 |
| 🔴 **Formulário de ofício** | `CIDADE/UF` deve mostrar cidade e UF separados, telefone no formato novo |

---

**Não confundir com problema:** as 3 linhas com CPF na coluna CNPJ (583,
620, 636) são escolas de pessoa física, e estão certas. O validador as
acusava por falha minha, corrigida — depois dela, `CNPJ` fechou em 679 ok,
0 trocadas, e a base subiu para **660 linhas coerentes**.

✅ **CONFIRMADO NA TELA em 11/08/2026, por print do usuário:** o card da
escola no formulário de ofício mostra `STATUS: ATIVA`. Era ali que o
problema aparecia — `02/04/2026 00:40` no lugar da situação — e foi o que
disparou toda esta investigação. A tela sempre esteve certa; o dado é que
estava trocado de coluna.

**Se algo der errado:** a migração só escreve numa coluna nova. Apagar a
coluna `EscolaID` devolve a base ao estado anterior, e o backup está lá.

**Ainda não migrado, de propósito:** os vínculos de Ofícios, Cobrança e dos
~8.000 associados continuam por nome/CNPJ. Isso é Fase 4 e 5 — a identidade
precisa estar de pé e conferida antes.

---

### 1. Trilha de Auditoria com dado real — Ofícios
**Aberto em:** 11/08/2026 · **Combinado com o usuário:** ele testa mais adiante

A ponte de auditoria foi ligada no `registrarLogSistema()` do `Oficios.gs`.
Todo ofício emitido passa a gravar em dois lugares: o `LOG_SISTEMA` de
sempre e a trilha nova.

**O que só o ambiente real prova:**

| O quê | Como verificar |
|---|---|
| A ponte funciona em produção | Emitir um ofício. Abrir **Auditoria e Compliance › Trilha de Alterações**. O ofício tem que aparecer como `Documentos › Ofícios`. |
| **A lista com registros** | Nunca foi vista com dado. Hoje só foi verificada vazia. |
| **O modal dos 14 campos** | Clicar numa linha. Nunca foi aberto em navegador. |
| A emissão não regrediu | O ofício sai normal, com o mesmo número e o mesmo PDF. |

**Pré-requisito:** `Oficios.gs` colado no projeto + nova versão da implantação.

**Se algo der errado:** desfazer é apagar o bloco marcado
`PONTE PARA A TRILHA ÚNICA` no `registrarLogSistema()`. Nada mais depende
dele.

---

### 4. Dashboard de Auditoria — o clique nos cards
**Aberto em:** 11/08/2026

Os cards e as linhas de "movimento por módulo" abrem a trilha já filtrada.
O teste prova que **o filtro de cada card devolve a contagem que o card
exibe** — o que não dá para provar sem navegador é o clique em si.

| O quê | Como verificar |
|---|---|
| Card "Hoje" | Clicar. A trilha abre e o número de linhas tem que bater com o card. |
| Card "Ações críticas" | Idem. |
| Card "Falhas" | Idem. |
| Linha de módulo | Clicar numa linha. Só ações daquele módulo. |
| **Virada do dia** | Abrir o painel perto da meia-noite. O `formatDate` do emulador ignora fuso, então só o Apps Script real decide isto. |

---

### 5. Retenção e Descarte — o gatilho de verdade
**Aberto em:** 11/08/2026

O emulador não instala trigger do Apps Script. O que a tela faz com o
gatilho é **não testado** ponta a ponta.

| O quê | Como verificar |
|---|---|
| Estado do gatilho | Abrir a tela. Se disser DESLIGADO, conferir em **Extensões › Acionadores** que de fato não existe. |
| Instalar | Clicar em "Instalar o expurgo automático". Voltar aos Acionadores e ver `verificarEExpurgarDadosLGPD` diário às 3h. |
| Desligar | Deve pedir confirmação e registrar na trilha como ação crítica. |
| **Expurgo real** | Executar manualmente (digitando EXPURGAR). Conferir na planilha que só saiu dado com mais de 5 anos. **Não tem como desfazer.** |

**Provável achado no primeiro acesso:** o gatilho nunca foi instalado. Se
for isso, nenhum dado vencido foi apagado até hoje.

---

### 6. Exportações — o arquivo gerado
**Aberto em:** 11/08/2026

O emulador não cria arquivo no Drive. O conteúdo do que sai continua
**não testado**.

| O quê | Como verificar |
|---|---|
| Relatório de ofícios | Exportar por Relatórios. Conferir que a linha aparece em Auditoria › Exportações, **sem** marca vermelha. |
| Base de associados | Exportar uma fila. A linha tem que aparecer **com** marca vermelha de dado pessoal, e o CPF no arquivo sair mascarado. |
| Exportar a auditoria | Também tem que se registrar. |

**O que a lista não alcança, e é bom saber:** abrir a planilha do Google
direto, copiar e colar de uma tela, tirar print ou baixar anexo de e-mail
não passa pelo SISGEP. A tela responde "o que saiu pelo sistema", não "o
que saiu do sindicato".

---

### 7. Compartilhamentos — revogar no navegador
**Aberto em:** 11/08/2026

A revogação foi provada por execução: revogar faz `buscarTokenFornecedorDespesa_`
devolver `null`, que é o mesmo caminho que o fornecedor percorre. O que falta
é o teste de ponta a ponta com navegador.

| O quê | Como verificar |
|---|---|
| Link nasce na lista | Gerar um envio de NF. O link tem que aparecer em Auditoria › Compartilhamentos como ATIVO. |
| Abrir marca como usado | Abrir o link. Voltar à tela: estado USADO. |
| **Revogar bloqueia** | Revogar pela tela (com motivo). Recarregar o link — tem que deixar de abrir. |
| Pixel sem botão | O pixel de leitura não pode oferecer "Revogar". |

**Links criados ANTES desta tela existir** continuam funcionando e **não
aparecem na lista** — não há registro deles em lugar nenhum para recuperar.
Se algum precisar ser desligado, é por outro caminho.

---

### 8. Incidentes — confirmar o prazo com o jurídico
**Aberto em:** 11/08/2026

O contador funciona e foi provado por execução (dias úteis, alerta de
vencido, relógio que para na comunicação). **O que NÃO foi verificado é o
número em si.**

| O quê | Situação |
|---|---|
| **3 dias úteis** | Meu entendimento da resolução da ANPD. Não tenho como conferir a fonte daqui, e o prazo mudou nos últimos anos. **Confirmar com o jurídico.** |
| Como mudar | Aba CONFIG, linha `LGPD_PRAZO_ANPD_DIAS_UTEIS` com o número. Sem tocar em código. |
| Feriados | O contador pula só sábado e domingo. Com feriado no meio, aponta um dia a mais do que a ANPD consideraria — **aperta** o prazo, não afrouxa. |
| A tela | Registrar um incidente de teste e percorrer o fluxo até encerrar. |

**Decisão registrada:** tudo exige administrador ("Administrador por
enquanto", 11/08). A contrapartida: quem não é administrador e descobre um
incidente precisa avisar alguém para o registro existir — e o prazo conta da
ciência do sindicato, não da hora do registro.

---

### 9. LGPD — inventário e prazo do titular
**Aberto em:** 11/08/2026

| O quê | Situação |
|---|---|
| **O inventário está completo?** | Ele lista 6 origens de dado pessoal, montadas do código. Se existir dado pessoal em algum lugar que eu não mapeei, **o inventário fica incompleto** — e é documento que se apresenta. Ler a tela e conferir se falta alguma origem. |
| **Base legal de cada origem** | Escrevi o que me pareceu correto (contrato, legítimo interesse, obrigação legal). **Confirmar com o jurídico** — errar a base legal invalida o tratamento inteiro. |
| **Prazo de 15 dias** | Art. 19, II, dias corridos. Configurável em `LGPD_PRAZO_TITULAR_DIAS`. |
| A tela | Registrar um pedido de teste e percorrer até responder. |

**O botão "ver trilha"** só encontra o que os módulos gravaram com aquele
identificador — hoje, ofícios. A trilha **não busca por CPF**; ela indexa
por `registroId`. Eu havia prometido busca por CPF no desenho e corrigi
antes de implementar.

---

### 10. Relatórios — o CSV e a leitura em produção
**Aberto em:** 11/08/2026

| O quê | Como verificar |
|---|---|
| **Conformidade LGPD** | É o relatório que se leva para reunião. Gerar e ler linha por linha. No emulador ele acusa pendências que **podem já estar resolvidas no projeto real** — só o ambiente real dá o retrato certo. |
| Download do CSV | O arquivo é montado no navegador. Abrir no Excel e conferir **os acentos** (usa BOM e ponto e vírgula). |
| A geração se registra | Gerar um relatório e conferir que a linha aparece em Auditoria › Exportações. |

---

### 2. Firestore — gravação real
**Aberto em:** 06/08/2026

A trilha grava na planilha de reserva (aba `SISGEP_Auditoria`), que
**qualquer pessoa com acesso à planilha consegue editar**. Enquanto for
assim, o registro não vale como prova numa fiscalização.

**O que falta, do lado do usuário:**

1. Apps Script → Configurações do projeto → Propriedades do script:
   - `FIREBASE_PROJETO` → `sisgep-plataforma`
   - `FIREBASE_CLIENT_EMAIL` → e-mail da conta de serviço
   - `FIREBASE_PRIVATE_KEY` → chave privada
2. Rodar `firebaseTestarConexao()` no editor.

**A chave nunca passa pelo chat.** Vai do JSON do Firebase direto para a
propriedade do script.

**Continua não testável mesmo depois:** as regras de segurança do Firestore.
Conta de serviço passa por cima delas, por desenho do Firebase — está
documentado no cabeçalho do `FirebaseCore.gs`.

---

### 3. Telas que podem estar em branco no menu
**Aberto em:** 10/08/2026

Descoberto porque o `include()` do `Code.gs:282` engole arquivo faltando e
devolve um comentário HTML — **tela em branco, sem erro nenhum**.

Confirmado pelo usuário: `GovernancaAdmin` e `AssembleiasAdmin` não existiam
no projeto. Os botões estavam no menu abrindo nada.

| Tela | Situação |
|---|---|
| `GovernancaAdmin` | enviada como arquivo novo — confirmar se foi criada |
| `AssembleiasAdmin` | idem |
| `NegociacaoAdmin` | confirmar se existe no projeto |
| `ConfigAdmin` | idem |

**Como verificar:** abrir cada uma pelo menu. Tela em branco = arquivo
faltando.

---

## ✅ VERIFICADO

### SOFIA — especialidade Estatuto e o botão CCT carregando a fonte certa
**Verificado em:** 13/08/2026, pelo usuário ("testei e funcionou")

O que passa a valer como testado no ar:

- a especialidade **📜 Estatuto** aparece na barra e carrega o Estatuto 2026;
- o botão **📘 CCT** carrega a convenção sem depender da palavra "CCT" na
  pergunta — era o defeito relatado, e a correção está confirmada;
- a resposta chega com a citação, o que só é possível se o documento tiver
  entrado no prompt.

**O que este item NÃO cobre**, e continua valendo dizer: a qualidade das
respostas ao longo do uso. Um assistente que erra a FONTE não é descoberto na
primeira leitura — a resposta sai com a mesma cara de sempre. Se em algum
momento a SOFIA citar um artigo que não bate com o documento, é aqui que se
volta.


### Trilha de Alterações — tela abre e consulta
**Verificado em:** 10/08/2026, por print do usuário

Tela renderiza, chama o servidor, mostra a origem dos dados (faixa âmbar de
"planilha de reserva") e o estado vazio ("Nenhuma ação registrada").

Fecha três coisas que estavam abertas. **Não fecha** a lista com registros
nem o modal — ver item 1.

### Token de sessão nas 5 telas novas
**Verificado em:** 10/08/2026, mesmo print

O erro `Failed due to illegal value in property` sumiu. A causa era o helper
ler `window.tokenSessao`, que é uma **função** global declarada por nove
outras telas, em vez de `SISGEP_TOKEN_SESSAO`.

Travado por teste: `t9-menu.js`, passos 13 e 14, varre os 71 `.html`.

---

## Histórico de itens fechados

| Data | Item | Como foi verificado |
|---|---|---|
| 10/08/2026 | Trilha abre e consulta | print do usuário |
| 10/08/2026 | Token nas 5 telas | print do usuário |

---

### 14. Escolas — a fila de Pendências (Fase 2)
**Aberto em:** 12/08/2026

**Backend medido na base real.** `escolasPendenciasResumo` rodada pelo dono
do projeto no editor, log confirmado pelo usuário em 12/08/2026:

```
65 de 679 escolas têm alguma pendência

     19  Dado fora do lugar...... (gravidade 1)
      0  Sem CNPJ nem CPF........ (gravidade 1)
      1  Sem e-mail.............. (gravidade 1)
      0  Sem razão social........ (gravidade 1)
     39  Sem telefone............ (gravidade 2)
     13  Sem situação............ (gravidade 2)
      1  Sem UF.................. (gravidade 3)
```

**O que isto FECHA:**

- O `19` bate exatamente com o que sobrou do saneamento de 11/08. Emulador e
  base real concordam — a medição é a mesma dos dois lados.
- `Sem UF = 1` confirma a Etapa C: 678 de 679 preenchidas, como previsto.
- `Sem documento = 0` e `Sem razão social = 0`: nenhuma escola está sem o que
  a trava para ofício, cobrança e listagem.
- **614 das 679 (90,4%) com cadastro completo.**

**O que isto NÃO fecha — continua "não testado" pela REGRA Nº -1:**

| Item | Situação |
|---|---|
| **A tela `PendenciasAdmin` abre** | ✅ **verificado** em 12/08/2026, por print do usuário |
| **`escolasPendenciasListar` responde** | ✅ **verificado** — a lista traz as 65, com nome, id, documento mascarado, cidade/UF e linha |
| **Os cards batem com o backend** | ✅ **verificado** — 19 / 0 / 1 / 0 / 39 / 13 / 1 e "614 de 679 (90,4%)", idênticos ao log do resumo |
| **O detalhe de "dado fora do lugar"** | ✅ **verificado** — mostra campo, conteúdo e o que aparenta ser |
| **Layout em duas faixas** | ✅ **verificado** em 12/08/2026 — 4 cards em "Trava a operação", 3 em "Reduz o alcance" |
| **Busca e paginação na tela** | ✅ **verificado** — campo presente, "página 1 de 2" com 65 em páginas de 50 |
| **O e-mail aparece na linha** | ✅ **verificado** — `ceibrilhodesol@gmail.com`, `decio@controllerone.com.br` |
| 🔴 **Digitar na busca filtra** | por nome, CNPJ, e-mail e ID — e os cards não podem mudar de número |
| 🔴 **Os botões de página funcionam** | « ‹ › » e o contador virando para "página 2 de 2" |
| 🔴 **Clicar num card filtra** | e os outros seis cards têm que ficar com o mesmo número |
| 🔴 **"Abrir no Cadastro"** | deve navegar e deixar o nome já digitado na busca |
| 🔴 **Corrigir uma escola e ver o número cair** | de 19 para 18 é o ciclo completo |

**Segundo achado da fila, 12/08/2026 — a UF que falta está dentro do
telefone.** A única escola sem UF é o `Colegio Alternativo LTDA`
(`ESC-000194`, linha 195, cidade Jacaraípe), e o `Telefone 1` dela guarda
`Serra - ES`. Jacaraípe fica em Serra/ES, então o `ES` existe — só está na
coluna errada. A Etapa C não pegou porque procurava a UF no fim do nome da
cidade, e aqui o par cidade-estado tinha ido parar noutra coluna.
**Correção sugerida:** `UF = ES` e limpar o `Telefone 1`. Uma linha, decisão
humana — que é para isso que a fila existe.

**Achado da primeira tela com dado real:** a única escola sem e-mail é a
**Pre-escola Anjo Azul** (`ESC-000123`, linha 124). Ela acumula as três
pendências ao mesmo tempo — sem e-mail, sem telefone e com `307` gravado em
`E-mails (todos)`. É a única escola das 679 com quem o sindicato não tem
como falar por nenhum caminho. Prioridade de contato, não de sistema.

**Sinal de que a tela quebrou:** cards em branco e lista vazia sem mensagem
de erro. Pela REGRA Nº 0, isso é JavaScript morto na página — procurar HTML
corrompido antes de procurar erro no `.gs`. O marcador
`window.ESC_PENDENCIAS_MARCADOR` existe para isso: se ele não estiver
definido no console, o bloco de script não executou.

**Detalhe operacional que vale registrar:** com 1 escola sem e-mail, o
sindicato alcança 678 das 679 por ofício e cobrança. A base está utilizável
hoje — as pendências restantes são de qualidade, não de bloqueio.

**As 39 sem telefone** são a maior fila, e são gravidade 2 justamente porque
o e-mail cobre o contato. Não travam nada; tiram o segundo caminho.

---

## VOUCHER — envio e data de emissão (publicado em 18/08/2026)

Dois defeitos corrigidos e **publicados pelo usuário em 18/08/2026**.
Publicar não é testar: até ele rodar no ar, tudo aqui é "não testado" pela
REGRA Nº -1.

Provas por execução que já existem, no emulador:
`t57-voucher-envio-erro.js` (36 asserções, 2 mutações mortas) e
`t58-voucher-data-emissao.js` (33 asserções, 4 mutações mortas). Suíte
completa verde: 2.423 asserções, 58 arquivos.

### O que foi corrigido

| Arquivo | Defeito |
|---|---|
| `VoucherEnvio.gs` | o preparo devolvia `Date` crua; quando a célula estava corrompida o `google.script.run` devolvia **null** e a tela mostrava "O servidor não respondeu nada" e fechava o modal |
| `VoucherEnvio.gs` | `exigirModulo_` estava FORA do `try` — recusa de sessão virava "erro de servidor" sem motivo |
| `Voucher.gs` | as 4 funções de data faziam `new Date(texto)`, que lê barra no formato **americano** |

O defeito de data tinha duas caras, e a pior é a silenciosa:

- **dia até 12** — a data saía **ERRADA** (`12/08` virava 8 de dezembro).
  O certificado ia para a instituição de ensino com outra data e ninguém
  percebia, porque `08/12/2026` é plausível.
- **dia de 13 em diante** — a data **não saía**: branco na lista e
  `Vitória/ES, NaN de undefined de NaN.` no documento. Foi o que o usuário
  relatou.
- **a ordenação da lista** afundava toda linha com dia acima de 12, porque
  ela reprocessa o texto já formatado e o timestamp virava 0.

Achado ao rodar o teste: o `Date` nativo lia `"período 2026/2"` como 1º de
fevereiro — e `PERIODO_REFERENCIA` deste módulo é literalmente `"2026/2"`.

### 🔴 A cobrar do usuário

| Item | Como verificar |
|---|---|
| 🔴 **O envio do voucher completa** | abrir o `BOLSA-2026-916155` (o protocolo do relato) e mandar. Se repetir, o painel **Execuções** do Apps Script mostra a exceção real |
| 🔴 **O e-mail chega com o PDF anexado** | conferir na caixa do associado, não só no "enviado" |
| 🔴 **A data aparece na lista de emitidos** | e com o dia e o mês no lugar certo — conferir uma linha com **dia acima de 12** e outra com **dia até 12** |
| 🔴 **A data sai no PDF do certificado** | a linha `Vitória/ES, ... de ... de ...` — o emulador não gera PDF, isto só se vê abrindo o documento |
| 🔴 **A lista está em ordem de data** | com o leitor antigo, linhas de dia acima de 12 iam para o fim |

### ⚠ Decisão registrada, à espera da operação

Quando a data é ilegível, o documento cai para **hoje** — mesmo
comportamento que já existia para célula vazia. Numa **reemissão** de
certificado antigo isso data o documento com o dia de hoje. Fica assim até
aparecer reemissão na operação; se aparecer, trocar.

---

## VOUCHER — e-mail padrão SISGEP e as duas redações do certificado

Entregue em 18/08/2026 e **salvo pelo usuário em 19/08/2026**. Salvar no
editor do Apps Script não muda nada no ar: só passa a valer depois de
**publicar nova versão**. Até ele publicar E emitir, tudo aqui é "não
testado" pela REGRA Nº -1.

Provas por execução que já existem: `t60-email-voucher-padrao.js` (32
asserções, 3 mutações mortas) e `t61-certificado-titular-dependente.js`
(36 asserções, 3 mutações mortas). Suíte completa: 2.506 asserções.

### O que mudou

| Arquivo | Mudança |
|---|---|
| `VoucherEnvio.gs` | e-mail no padrão SISGEP (mesmo desenho do e-mail de ofício), assinado pela **Marcelha** — o certificado em anexo é do **Leonil** |
| `VoucherPdf.gs` | **duas redações**: titular e dependente, cada uma com seu fundamento, verbo e fecho |
| `VoucherPdf.gs` | data no fim do texto, acima da assinatura, nos dois modelos |
| `Voucher.gs` | mês por extenso em minúscula e sem ponto final |

O papel do dependente não é o do titular com uma oração a mais. Muda o
fundamento (convênio × cláusula da CCT), o verbo ("encontra-se
regularmente habilitado" × "atende aos requisitos estabelecidos") e o
fecho (restritivo × simples).

### 🔴 A cobrar do usuário

| Item | Como verificar |
|---|---|
| 🔴 **Publicou nova versão?** | salvar não basta — sem publicar, o Apps Script continua rodando o código anterior |
| 🔴 **Certificado de TITULAR** | tem que dizer "atende aos requisitos estabelecidos" e "semestralidade/anuidade escolar" |
| 🔴 **Certificado de DEPENDENTE** | tem que dizer "encontra-se regularmente habilitado", nomear de quem é dependente e fechar com "pessoal, individual e intransferível" |
| 🔴 **Nenhuma redação vaza na outra** | é o erro que a instituição de ensino percebe primeiro |
| 🔴 **A data no fim, acima da assinatura**, nos dois | "Vitória/ES, 19 de agosto de 2026" — minúscula, sem ponto |
| 🔴 **O período legível, sem GMT** | conferir um do 1º e um do 2º semestre |
| 🔴 **O e-mail no padrão** | cabeçalho navy com CNPJ, badge "Bolsa de Estudo", rodapé com a Marcelha |
| 🔴 **`VoucherPeriodo.gs` existe no projeto** | o `VoucherPdf.gs` novo depende dele; se faltar, a emissão quebra |

### ⚠ Contexto que não pode se perder

O `VoucherPdf.gs` que estava no ar em 18/08 era de **13/08, nove commits
atrás** — provado por três sinais no PDF do BOLSA-2026-920837 (redação
antiga, período como Date crua, sem bloco de data). Divergência entre o
projeto Apps Script e o repositório, não defeito de código. Se sintoma
antigo reaparecer, conferir a versão do arquivo ANTES de procurar bug.
