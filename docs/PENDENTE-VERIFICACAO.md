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

| O que conferir | Como |
|---|---|
| ✅ **Status inicial** | rodado em 12/08/2026 — 939 / ausente / 6 / ausente / 8019 |
| 🔴 **Mapear as abas** | `escolaVinculosMapearAbas()` — achar Contatos e Ofícios |
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
