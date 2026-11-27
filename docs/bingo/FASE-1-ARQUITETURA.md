# Bingo Online — SindEducação
## FASE 1 — Arquitetura e Regras

> Documento de arquitetura. **Nenhum código de produção foi escrito nesta fase.**
> Requer aprovação antes da Fase 2 (protótipo UX/UI).

| | |
|---|---|
| **Módulo** | Bingo Online — SindEducação |
| **Sistema** | SISGEP — Sistema Integrado de Gestão Sindical |
| **Fase** | 1 de 8 — Arquitetura e Regras |
| **Data** | 17/08/2026 |
| **Branch** | `claude/bingo-online-sindeducacao-5x5owd` |

---

## 0. Resumo executivo (para quem vai decidir)

**Recomendação:** arquitetura **híbrida**. Manter o Google Apps Script como cérebro
administrativo do módulo (é onde já vivem os associados, a sessão, os relatórios e a
equipe do sindicato) e usar o **Firestore como camada ao vivo** — a mesma ponte que
já existe no projeto em `EventosFirestore.gs`, com a conta de serviço já configurada
no cofre (`FIRESTORE_SERVICE_ACCOUNT`, projeto `sisgep-plataforma`).

**Por quê:** Apps Script + Sheets dá conta com folga de criar eventos, gerar cartelas
e emitir relatórios. **Não dá conta da fase ao vivo.** Com 1.000 associados
acompanhando o sorteio pelo celular, o padrão usual (`google.script.run` a cada poucos
segundos) exigiria cerca de **400 requisições por segundo** contra um serviço que
executa de forma útil algo em torno de **1 a 3 requisições por segundo**. É uma
distância de duas ordens de grandeza — não é ajuste fino, é a tecnologia errada para
esse pedaço específico.

**O que isso custa:** praticamente nada de infraestrutura nova. A ponte Firestore já
existe e já está autenticada. A estimativa de custo do Firestore para um evento com
1.500 celulares conectados e 3 rodadas de 75 números é da ordem de **centavos de
dólar por evento** (detalhe na seção 13).

**Três decisões de projeto que mudam o jogo** e que valem a leitura mesmo de quem não
é técnico:

1. **O sorteio é lacrado antes de começar.** A ordem completa das 75 bolas é embaralhada
   e selada no instante em que a rodada abre, e a "impressão digital" (hash) dessa ordem
   é publicada no telão *antes do primeiro número*. Ao fim, a chave é revelada e qualquer
   pessoa pode conferir que a ordem não mudou no meio do caminho. Isso responde de forma
   demonstrável à pergunta que sempre aparece: *"o sorteio foi honesto?"*
2. **O servidor sabe quem ganhou antes de alguém apertar o botão.** A cada número
   sorteado o servidor recalcula, sozinho, todas as cartelas vencedoras. O botão
   **BINGO!** vira confirmação e festa — não vira a origem do resultado. Isso elimina de
   raiz o problema do "quem clicou primeiro ganha" e também a injustiça do associado com
   internet ruim que completou a cartela mas não conseguiu avisar.
3. **CPF não entra no módulo do Bingo.** O sistema trabalha com um identificador opaco
   (`associadoId`). O CPF fica onde já está — na base de associados — e serve apenas
   para a identificação inicial.

**Risco que precisa de decisão da diretoria, não de tecnologia:** ver seção 14.1
(enquadramento legal de sorteio com prêmios). É o único ponto capaz de travar o
projeto inteiro, e ele é jurídico.

---

## 1. Arquitetura recomendada

### 1.1 O princípio de separação

O módulo tem dois regimes de carga radicalmente diferentes, e a maior parte dos erros de
projeto em sistemas assim vem de tratá-los como se fossem um só:

| Regime | Volume | Quem usa | Latência aceitável |
|---|---|---|---|
| **Administração** (eventos, rodadas, prêmios, cartelas, relatórios) | dezenas a centenas de operações por evento | 2 a 5 pessoas da equipe | segundos |
| **Ao vivo** (sorteio, marcação, telão, acompanhamento) | milhares de leituras por minuto | centenas a milhares de associados | menos de 1 segundo |

A arquitetura recomendada dá a cada regime a tecnologia adequada:

```
┌──────────────────────────────────────────────────────────────────────┐
│  PLANO DE CONTROLE  — Google Apps Script (SISGEP atual)              │
│                                                                      │
│  • Autenticação de operadores (Sessao.gs, já existente)              │
│  • CRUD de eventos, rodadas, prêmios                                 │
│  • Geração e selagem de cartelas                                     │
│  • Execução do sorteio (única origem oficial dos números)            │
│  • Apuração de vencedores                                            │
│  • Relatórios, exportação, integração com Histórico 360°             │
│                                                                      │
│  Baixo volume · alta confiança · onde já mora a base de associados   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ escreve (conta de serviço, REST)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PLANO DE DADOS AO VIVO  — Cloud Firestore (sisgep-plataforma)       │
│                                                                      │
│  • Documento de estado da rodada (fonte da verdade ao vivo)          │
│  • Cartelas seladas                                                  │
│  • Reivindicações de Bingo                                           │
│  • Trilha de auditoria encadeada                                     │
│                                                                      │
│  Escrita EXCLUSIVA da conta de serviço · leitura direta pelo celular │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ onSnapshot (push, WebSocket)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENTES                                                            │
│  Celular do associado · Painel do operador · Telão                   │
│                                                                      │
│  Leem direto do Firestore, em tempo real, sem consumir cota do GAS   │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 A regra de ouro do fluxo

> **Nenhum cliente escreve nada que decida resultado.**

As Security Rules do Firestore negam escrita a todos os clientes em `eventos`,
`rodadas`, `cartelas`, `sorteios`, `vencedores` e `auditoria`. Só a conta de serviço —
que só o Apps Script possui — escreve nessas coleções. A única escrita permitida ao
associado é a criação de uma **reivindicação de Bingo**, e mesmo essa é apenas um
registro de intenção: não altera o resultado (seção 10).

### 1.3 O que se aproveita do que já existe

| Ativo existente | Uso no Bingo |
|---|---|
| `EventosFirestore.gs` — ponte REST + JWT RS256 | Base do `BingoRepository.gs`. Precisa ganhar `commit` transacional e `runQuery` (hoje só tem `set`/`get`). |
| `FIRESTORE_SERVICE_ACCOUNT` no cofre | Mesma credencial. Nada novo a provisionar. |
| `Sessao.gs` — token UUID em CacheService + ScriptProperties | Sessão de administrador e operador do Bingo, sem reescrever autenticação. |
| `LockService` (padrão consolidado em 18 arquivos) | Serialização das ações críticas de sorteio. |
| Aba `Associados` da planilha de produção | Base de elegibilidade. Ganha uma coluna `ASSOCIADO_ID` (seção 7). |
| `EventosEmissao.gs` — contador atômico de ingressos | Referência de padrão para o contador de cartelas. |

### 1.4 O que **não** recomendamos

- **Não** usar Sheets como banco da fase ao vivo. Sheets não tem transação, não tem
  índice e a contenção de escrita concorrente é real.
- **Não** introduzir Node/servidor próprio nesta fase. Traz operação, deploy, monitoramento
  e custo fixo que o sindicato não tem hoje, para resolver um problema que o Firestore
  já resolve.
- **Não** usar WebSocket próprio. `onSnapshot` já é push, já reconecta sozinho e já
  ressincroniza estado — é exatamente o requisito da seção 13 do briefing, de graça.

---

## 2. Avaliação crítica: Apps Script + Sheets é suficiente?

**Resposta curta: suficiente para administrar, insuficiente para transmitir.**

### 2.1 Os números

Cenário de referência: **evento de 1.200 associados**, 3 rodadas, 75 bolas por rodada,
um número sorteado a cada 8 segundos.

**Se tudo fosse Apps Script (arquitetura ingênua, com polling):**

| Grandeza | Necessário | Capacidade real do GAS |
|---|---|---|
| Requisições por segundo na fase ao vivo | ~400 (1.200 clientes ÷ 3 s) | ordem de 1 a 3 |
| Execuções simultâneas do script | centenas | dezenas (limite de plataforma) |
| Latência de uma chamada `google.script.run` | < 1 s | 0,8 a 3 s (pior em partida a frio) |
| Leitura de aba com 1.200 cartelas | por sorteio | 1 a 3 s por leitura completa |
| Escrita transacional de um sorteio | atômica | inexistente em Sheets; só `LockService`, que serializa tudo em ~1 op/s |

O gargalo não é a lógica do bingo — é o **transporte**. Cada `google.script.run` é uma
execução completa de script, não uma consulta barata a um banco.

**Com a arquitetura híbrida:**

| Grandeza | Valor |
|---|---|
| Requisições ao GAS na fase ao vivo | ~1 por sorteio (o operador clicando SORTEAR) — cerca de **225 no evento inteiro** |
| Atualização no celular do associado | push do Firestore, tipicamente < 500 ms |
| Reconexão após queda de sinal | automática, com ressincronização do estado completo |
| Leituras Firestore no evento | ~340 mil (detalhe na seção 13) |

A carga sobre o Apps Script cai de ~400 req/s para **menos de 1 req/s**. Ele passa a
fazer só aquilo em que é bom.

### 2.2 Onde o Apps Script continua sendo a escolha certa

- Criação e edição de eventos, rodadas e prêmios — baixo volume, equipe pequena.
- Validação de elegibilidade contra a aba `Associados` — a base já está lá.
- Geração das cartelas — acontece uma vez, antes da rodada abrir.
- Execução do sorteio — 75 escritas por rodada, com `LockService`. Cabe com sobra.
- Apuração de vencedores — cálculo em memória, milissegundos (seção 9).
- Relatórios e exportação — território natural do Sheets.
- Integração com o Histórico 360° do associado.

### 2.3 Quando reavaliar

Sinais concretos de que a arquitetura precisaria evoluir de novo:

- mais de ~5.000 cartelas ativas numa mesma rodada (a apuração em memória do GAS começa a
  disputar com o limite de 6 minutos de execução);
- necessidade de sorteio automático em cadência fixa sem operador humano;
- múltiplos eventos ao vivo simultâneos em seccionais diferentes.

Nesse ponto, o caminho natural é mover **apenas o motor de sorteio e apuração** para uma
Cloud Function no mesmo projeto GCP, preservando todo o resto. A arquitetura proposta já
deixa essa porta aberta: a fronteira é o `SorteioService`.

---

## 3. Modelo de dados

### 3.1 Onde cada coisa mora

| Entidade | Firestore | Sheets | Motivo |
|---|---|---|---|
| Eventos | ✅ fonte | espelho | leitura pelo cliente ao vivo |
| Rodadas | ✅ fonte | espelho | idem |
| Estado da rodada | ✅ fonte | — | documento quente, atualizado a cada sorteio |
| Prêmios | ✅ fonte | espelho | |
| Participantes (habilitação) | ✅ fonte | — | derivado da aba `Associados` |
| Cartelas | ✅ fonte | — | volume alto, acesso por ID |
| Sorteios | ✅ fonte | espelho pós-rodada | |
| Reivindicações de Bingo | ✅ fonte | — | |
| Vencedores | ✅ fonte | espelho | relatório e prestação de contas |
| Auditoria | ✅ fonte (append-only) | exportação | |
| Usuários/operadores | — | ✅ fonte (`USUARIO`, já existe) | reaproveita `Sessao.gs` |
| **Dados pessoais do associado** | ❌ **nunca** | ✅ fonte | LGPD — minimização |

O espelho em Sheets é **assíncrono e somente para leitura humana/relatório**. Nunca é
consultado para decidir resultado.

### 3.2 Coleções

```
eventos/{eventoId}
  nome, descricao, dataEvento, horaInicio
  inscricaoInicio, inscricaoFim
  bannerUrl, regulamentoUrl
  status            : RASCUNHO | INSCRICOES_ABERTAS | INSCRICOES_ENCERRADAS
                    | EM_ANDAMENTO | ENCERRADO | CANCELADO
  maxParticipantes, cartelasPorAssociado
  modalidadeBolas   : 75 | 90
  regrasParticipacao: { exigeFiliacaoAtiva, exigeAdimplencia, permiteConvidado }
  criadoPor, criadoEm, atualizadoEm

eventos/{eventoId}/rodadas/{rodadaId}
  ordem, nome, descricao
  padraoId          : LINHA | COLUNA | DIAGONAL | QUATRO_CANTOS | X
                    | CARTELA_CHEIA | CUSTOM:{id}
  premioId
  status            : RASCUNHO | ABERTA | EM_ANDAMENTO | PAUSADA
                    | AGUARDANDO_CONFIRMACAO | ENCERRADA | ANULADA
  espacoCentralLivre: boolean
  politicaVencedor  : TODOS_DA_CHAMADA | PRIMEIRO_CLIQUE | SORTEIO_DESEMPATE
  divisaoPremio     : INTEGRAL_A_CADA | RATEIO
  cartelasPorAssociado
  seloOrdem         : { hashOrdem, algoritmo, seladoEm, reveladoEm, seedRevelada }
  iniciadaEm, encerradaEm
  totalCartelas, totalSorteios

eventos/{eventoId}/rodadas/{rodadaId}/estado/atual     ← DOC QUENTE ÚNICO
  versao            : inteiro monotônico (nunca retrocede)
  status
  numerosSorteados  : [12, 47, 3, ...]   (máx. 75 — cabe folgado num doc)
  ultimoNumero, ultimaPosicao, ultimoSorteioEm
  totalCartelas, participantesOnline
  avisoBingo        : { ativo, cartelasCandidatas }
  vencedoresPublicados : [{ apelidoPublico, cartelaCurto }]
  premioResumo, hashOrdem
  atualizadoEm

eventos/{eventoId}/premios/{premioId}
  descricao, valorEstimado, patrocinador, imagemUrl, ordem, entregueEm

eventos/{eventoId}/participantes/{associadoId}
  status            : HABILITADO | BLOQUEADO
  apelidoPublico    : "Maria S."          ← único texto de pessoa que pode ir ao telão
  habilitadoEm, habilitadoPor
  cartelasEmitidas  : { rodadaId: quantidade }
  ⚠️ sem CPF, sem nome completo, sem e-mail, sem telefone

cartelas/{cartelaId}
  eventoId, rodadaId, associadoId
  numeros           : [[b1..b5],[i1..i5],[n1..n5],[g1..g5],[o1..o5]]
  espacoCentralLivre
  status            : ATIVA | CANCELADA | VENCEDORA
  geradaEm
  assinatura        : HMAC-SHA256 do conteúdo (seção 6.4)
  fingerprint       : hash normalizado, para detecção de colisão

eventos/{eventoId}/rodadas/{rodadaId}/sorteios/{posicao}   ← ID = posição, 1..75
  numero, posicao, sorteadoEm
  operadorId, operadorNome
  status            : VALIDO | ANULADO
  hashAuditoria

eventos/{eventoId}/rodadas/{rodadaId}/reivindicacoes/{associadoId}  ← 1 por associado
  cartelaId, solicitadoEm
  posicaoNoMomento  : quantos números já haviam saído quando clicou
  resultado         : PENDENTE | VALIDO | INVALIDO
  motivoInvalidez
  avaliadoEm, avaliadoPor

eventos/{eventoId}/rodadas/{rodadaId}/vencedores/{cartelaId}
  associadoId, apelidoPublico
  numeroQueCompletou, posicaoQueCompletou
  padraoId, posicoesVencedoras
  origem            : APURACAO_AUTOMATICA | REIVINDICACAO
  confirmadoPor, confirmadoEm
  premioId, premioEntregueEm, premioRecebidoPor

auditoria/{logId}                            ← APPEND-ONLY, encadeado
  seq               : inteiro monotônico
  eventoId, rodadaId
  acao              : EVENTO_CRIADO | RODADA_INICIADA | ORDEM_SELADA | NUMERO_SORTEADO
                    | CARTELA_GERADA | BINGO_REIVINDICADO | BINGO_VALIDADO
                    | VENCEDOR_CONFIRMADO | RODADA_ENCERRADA | ORDEM_REVELADA
                    | RODADA_ANULADA | ...
  atorTipo          : OPERADOR | ASSOCIADO | SISTEMA
  atorId, atorNome
  payload           : JSON do que mudou
  registradoEm
  hashAnterior, hash                          ← encadeamento (seção 12)
```

### 3.3 Chaves e unicidade — o detalhe que evita duplicidade

Três decisões de identificação eliminam classes inteiras de bug por construção:

| Documento | ID | O que isso garante |
|---|---|---|
| `sorteios/{posicao}` | a **posição na sequência** (1, 2, 3…) | Sortear duas vezes a posição 12 é impossível: o segundo `create` falha na precondição. Duplo clique morre aqui. |
| `reivindicacoes/{associadoId}` | o **associadoId** | Um associado tem no máximo uma reivindicação por rodada. Spam de botão morre aqui. |
| `vencedores/{cartelaId}` | o **cartelaId** | Uma cartela não pode ser declarada vencedora duas vezes. |

Nenhuma dessas garantias depende de a aplicação "lembrar de verificar". São propriedades
do banco.

---

## 4. Fluxo do associado

```
   1. ACESSA
      Portal do Associado, link direto ou QR Code
                    ↓
   2. IDENTIFICA-SE
      CPF (uso único, só aqui) + confirmação de data de nascimento
      Rate limit por IP e por CPF · nunca revela se o CPF existe na base
                    ↓
   3. HABILITAÇÃO
      Servidor resolve CPF → associadoId · confere filiação e regras do evento
      Emite token de sessão curto (Custom Token do Firebase, ~1 h)
      A partir daqui, o CPF não circula mais em lugar nenhum
                    ↓
   4. MINHA CARTELA
      Servidor devolve SEMPRE a mesma cartela para aquele associadoId + rodadaId
                    ↓
   5. AGUARDA
      Contagem regressiva · regulamento · prêmio da rodada
                    ↓
   6. ACOMPANHA
      onSnapshot no doc de estado · marcação automática · sem recarregar página
      Se cair o sinal: reconecta sozinho e ressincroniza o estado completo
                    ↓
   7. BINGO!
      Botão habilita quando o servidor já publicou a cartela como candidata
                    ↓
   8. VALIDAÇÃO
      Servidor confere contra a cartela selada e os números oficiais
                    ↓
   9. RESULTADO
      "BINGO VÁLIDO" / "BINGO NÃO CONFIRMADO" com o motivo em português claro
```

**Decisão de UX que vale discutir na Fase 2:** a marcação é automática, mas mantemos o
**toque manual como camada visual opcional**. Marcar a cartela é metade da graça do bingo
presencial; tirar isso deixa o associado como espectador passivo. A conferência oficial
continua 100% no servidor — o toque manual é enfeite, nunca prova.

---

## 5. Fluxo administrativo

```
CRIAR EVENTO → CRIAR RODADAS → CADASTRAR PRÊMIOS → DEFINIR REGRAS
     → ABRIR PARTICIPAÇÃO → GERAR/DISTRIBUIR CARTELAS
     → INICIAR RODADA (aqui a ordem das bolas é LACRADA e o hash publicado)
     → SORTEAR (repete) → RECEBER BINGO → VALIDAR → CONFIRMAR VENCEDOR
     → ENCERRAR RODADA (aqui a ordem é REVELADA) → GERAR RELATÓRIO
```

### 5.1 Portões de transição de estado

Cada transição só ocorre se as condições forem verdadeiras. Isso é validado no servidor,
nunca na tela:

| Ação | Só é permitida se | Efeitos colaterais |
|---|---|---|
| Abrir inscrições | evento em `RASCUNHO`, com ≥1 rodada e regulamento anexado | — |
| Iniciar rodada | rodada `ABERTA`, cartelas geradas, **nenhuma outra rodada do evento em andamento** | sela a ordem, publica o hash, congela as cartelas |
| Sortear | rodada `EM_ANDAMENTO`, posição < 75, lock obtido | grava sorteio, apura, atualiza estado |
| Pausar | rodada `EM_ANDAMENTO` | clientes veem "pausado", botão BINGO segue ativo |
| Confirmar vencedor | rodada `AGUARDANDO_CONFIRMACAO`, ≥1 cartela apurada | grava vencedor, dupla confirmação na tela |
| Encerrar rodada | vencedores confirmados **ou** anulação justificada | revela a seed, congela tudo, fecha o bloco de auditoria |
| Anular rodada | justificativa obrigatória de ≥20 caracteres | rodada vira `ANULADA`, nada é apagado |

**"Congelar as cartelas" é literal:** a partir do `INICIAR RODADA`, a coleção `cartelas`
daquela rodada fica fechada para emissão. Nova cartela depois do primeiro número é
impossível, não é "proibida por regra de negócio".

### 5.2 Permissões

| Ação | Administrador | Operador | Associado |
|---|:---:|:---:|:---:|
| Criar/editar evento, rodada, prêmio | ✅ | — | — |
| Definir regras e política de vencedor | ✅ | — | — |
| Abrir/encerrar inscrições | ✅ | — | — |
| Gerar cartelas | ✅ | ✅ | — |
| Iniciar / pausar rodada | ✅ | ✅ | — |
| **Sortear** | ✅ | ✅ | — |
| **Confirmar vencedor** | ✅ | — | — |
| **Anular rodada ou sorteio** | ✅ | — | — |
| Ver participantes e cartelas | ✅ | ✅ (sem dado pessoal) | só a própria |
| Relatórios e exportação | ✅ | ✅ (operacional) | — |
| Ver auditoria completa | ✅ | somente leitura | — |

Duas separações deliberadas: **quem sorteia não confirma vencedor**, e **anular é
exclusivo do administrador**. Segregação de funções básica, e barata de implementar.

---

## 6. Mecanismo de geração das cartelas

### 6.1 O problema real

O briefing pede que a cartela seja única, imutável e que o mesmo associado receba sempre a
mesma cartela. A tentação é gerar aleatoriamente e gravar. O problema aparece na borda:
se a gravação falhar depois de gerar, ou se duas requisições chegarem juntas, o associado
pode acabar com duas cartelas diferentes — e aí escolhe a melhor.

### 6.2 A solução: geração determinística

A cartela **não é sorteada e guardada — ela é derivada**:

```
semente = HMAC-SHA256( segredoDaRodada , eventoId | rodadaId | associadoId | indiceCartela )
```

`segredoDaRodada` é gerado uma vez, na criação da rodada, e guardado em
`ScriptProperties` (nunca no Firestore, nunca no cliente). A semente alimenta um PRNG
determinístico que preenche as colunas:

- **B** 5 números distintos de 1–15 · **I** de 16–30 · **N** de 31–45 (com o centro livre,
  se configurado) · **G** de 46–60 · **O** de 61–75
- seleção por Fisher-Yates truncado sobre o intervalo de cada coluna

Como a função é determinística, **regerar produz exatamente a mesma cartela**. As
consequências são todas boas:

- idempotência de graça — chamar duas vezes não cria duas cartelas;
- o requisito "sempre a mesma cartela" sai sem esforço;
- procurar combinação melhor por reemissão é inútil: só existe uma cartela possível para
  aquele associado naquela rodada;
- reconstrução auditável: com a `segredoDaRodada` guardada, é possível **provar** depois
  qual cartela cada associado tinha, mesmo sem confiar no registro.

### 6.3 Unicidade entre cartelas

O espaço de cartelas 5×5 de 75 bolas é da ordem de 5,5 × 10²⁶. Para 5.000 cartelas, a
probabilidade de colisão é desprezível. Ainda assim, gravamos um `fingerprint` (hash do
conteúdo normalizado) e verificamos na emissão — colisão detectada gera nova cartela com
`indiceCartela + 1` e registro em auditoria. Custa pouco e transforma "estatisticamente
improvável" em "verificado".

### 6.4 Selo de integridade

```
assinatura = HMAC-SHA256( segredoDeIntegridade , cartelaId | rodadaId | associadoId | numeros )
```

Conferida em toda validação de Bingo. Se alguém alterar os números de uma cartela
diretamente no banco, a assinatura quebra e a validação recusa — com registro em auditoria.

### 6.5 Limite por associado

`cartelasPorAssociado` é validado no servidor contra
`participantes/{associadoId}.cartelasEmitidas[rodadaId]`, dentro de transação. O cliente
não informa quantidade — ele pede "minha cartela n" e o servidor decide se aquele índice
é permitido.

---

## 7. Identidade do associado e LGPD

### 7.1 O `associadoId`

Hoje a aba `Associados` identifica pessoas por CPF (coluna C), e `SindicalizacaoAssociados.gs`
já trabalha com `MATRICULA`. Nenhum dos dois serve como identificador do Bingo: CPF é dado
sensível e matrícula é dado de negócio, com histórico de mudança.

**Recomendação:** adicionar uma coluna `ASSOCIADO_ID` (UUID v4) na aba `Associados`,
preenchida uma única vez por migração e nunca alterada.

Por que uma coluna nova e não um hash do CPF: um hash de CPF continua sendo dado pessoal
pseudonimizado sob a LGPD, e amarra o identificador a um documento que pode ser corrigido.
Um UUID é verdadeiramente opaco, não carrega informação, e serve todo o SISGEP daqui para
frente — vale muito além do Bingo.

### 7.2 Minimização de dados

| Dado | Sheets (base) | Firestore (Bingo) | Telão | Relatório |
|---|:---:|:---:|:---:|:---:|
| CPF | ✅ | ❌ | ❌ | mascarado `***.456.789-**` |
| Nome completo | ✅ | ❌ | ❌ | ✅ (uso interno) |
| `associadoId` | ✅ | ✅ | ❌ | ✅ |
| `apelidoPublico` ("Maria S.") | derivado | ✅ | ✅ | ✅ |
| E-mail / telefone | ✅ | ❌ | ❌ | ❌ |

**O CPF aparece exatamente uma vez em todo o ciclo de vida:** no formulário de
identificação. Não vai para a URL, não vai para o Firestore, não vai para log, não vai
para o telão.

### 7.3 Base legal e retenção

- **Base legal:** legítimo interesse da entidade sindical na realização de atividade
  associativa recreativa, com aviso de privacidade específico no regulamento.
- **Retenção:** dados operacionais do Bingo por 5 anos (prestação de contas); trilha de
  auditoria pelo mesmo período; dados pessoais permanecem apenas na base de associados,
  sob a política de retenção já vigente no SISGEP.
- **Direitos do titular:** o `associadoId` permite localizar tudo o que o Bingo guardou
  sobre uma pessoa em uma consulta, o que torna atendimento de solicitação de acesso ou
  eliminação trivial.

---

## 8. Mecanismo de sorteio

### 8.1 A escolha central: lacrar antes, revelar depois

Duas abordagens são defensáveis. Escolhemos a segunda, e o motivo importa:

**(a) Sortear sob demanda.** A cada clique, o servidor sorteia entre os números restantes.
Simples. Problema: é **impossível provar depois** que o servidor não escolheu o número
conveniente. A confiança fica inteiramente na palavra de quem opera o sistema — que é
justamente o que se questiona quando um sorteio dá polêmica.

**(b) Lacre e revelação (*commit-reveal*).** Adotada.

```
NO "INICIAR RODADA":
  1. seed        ← 32 bytes de Utilities.getUuid() + entropia de tempo
  2. ordem       ← Fisher-Yates(1..75) semeado pela seed        ← as 75 bolas, já embaralhadas
  3. hashOrdem   ← SHA-256( ordem )
  4. GRAVA hashOrdem no Firestore e PUBLICA NO TELÃO            ← antes do 1º número
  5. GUARDA seed em ScriptProperties (fora do Firestore)
  6. AUDITA: ORDEM_SELADA

A CADA "SORTEAR":
  7. avança o ponteiro: número = ordem[posicaoAtual + 1]

NO "ENCERRAR RODADA":
  8. REVELA a seed e a ordem completa
  9. AUDITA: ORDEM_REVELADA
```

Qualquer pessoa pode, depois do evento, recalcular a ordem a partir da seed revelada,
conferir o hash contra o que foi exibido no telão *antes do primeiro número*, e verificar
que a sequência sorteada é exatamente o prefixo dessa ordem. **A honestidade do sorteio
deixa de ser uma promessa e vira uma conta que qualquer associado pode fazer.**

### 8.2 O que o lacre resolve — e o que não resolve

**Resolve:**
- número repetido — impossível, é uma permutação;
- duplo clique — vira idempotência (seção 8.3);
- manipulação durante a rodada — a ordem já está lacrada e o hash é público;
- "o sistema esperou para ver quem estava ganhando" — matematicamente descartado.

**Não resolve, e é honesto dizer:** alguém com acesso ao `ScriptProperties` pode
**ler** a ordem futura antes da hora. Não pode alterá-la (o hash é público), mas pode
saber. Mitigações: acesso ao projeto GAS restrito a administradores nominais; leitura da
seed registrada em auditoria; e, para eventos de prêmio alto, a variante de lacre
distribuído descrita em 14.4.

Isso é um deslocamento consciente de risco: trocamos "podem manipular e ninguém descobre"
por "podem espiar, não podem alterar, e a alteração é detectável". É uma troca claramente
favorável.

### 8.3 Idempotência e concorrência do SORTEAR

```
sortear(rodadaId, posicaoEsperada, chaveIdempotencia):
    lock = LockService.getScriptLock()
    se não lock.tryLock(15000): erro "outra operação em andamento"
    try:
        estado = lê estado atual
        se estado.status ≠ EM_ANDAMENTO:            recusa
        se posicaoEsperada ≠ estado.ultimaPosicao+1: devolve o estado atual (no-op)
        numero = ordem[posicaoEsperada]
        Firestore commit ATÔMICO, tudo ou nada:
            create sorteios/{posicaoEsperada}       ← precondição: NÃO EXISTE
            update estado/atual                     ← precondição: versao == estado.versao
            create auditoria/{seq}
        apura vencedores (seção 9) e atualiza estado
    finally:
        lock.releaseLock()
```

Três camadas de defesa, propositalmente redundantes:

1. **`LockService`** — impede dois operadores concorrentes dentro do Apps Script;
2. **`posicaoEsperada`** — duplo clique manda a mesma posição, o servidor devolve o mesmo
   resultado sem sortear de novo (idempotência de verdade, não "ignorar o segundo clique");
3. **precondições no `commit`** — a rede de segurança final; se as duas anteriores
   falharem, o Firestore recusa.

A interface reforça: o botão SORTEAR desabilita no clique e só reabilita com a confirmação
do servidor.

---

## 9. Validação de Bingo e apuração

### 9.1 A inversão de responsabilidade

O briefing descreve: associado clica → servidor busca a cartela → servidor valida.
Isso funciona, mas mantém a apuração **reativa ao clique**, o que reintroduz pela porta dos
fundos a lógica do "quem clicou primeiro".

**Proposta: o servidor apura sozinho, a cada número sorteado.** Ele tem tudo o que precisa
— todas as cartelas e todos os números oficiais. Não há motivo para esperar um clique.

### 9.2 Como isso fica barato: índice invertido + contadores

Apurar 5.000 cartelas do zero a cada número seria caro. Não é preciso:

**No início da rodada** (uma vez), monta-se em `CacheService`:

```
indiceNumero[n]  = [ (cartelaId, slotDoPadrao), ... ]   para n em 1..75
faltam[cartelaId][slotDoPadrao] = quantos números ainda faltam naquele slot
```

Um *slot* é uma instância candidata do padrão. Para `LINHA`, cada cartela tem 5 slots
(as 5 linhas horizontais), cada um começando com `faltam = 5`. Para `QUATRO_CANTOS`, 1
slot com `faltam = 4`. Para `CARTELA_CHEIA`, 1 slot com `faltam = 24` (com centro livre).

**A cada número sorteado:**

```
para cada (cartelaId, slot) em indiceNumero[numero]:
    faltam[cartelaId][slot] -= 1
    se faltam[cartelaId][slot] == 0:
        vencedoras.push(cartelaId)
```

O trabalho por sorteio é proporcional **apenas às cartelas que contêm aquele número** —
tipicamente 1/15 do total por coluna. Para 5.000 cartelas, são algumas centenas de
decrementos: **milissegundos**. Cabe folgadamente no orçamento de tempo do Apps Script.

### 9.3 Padrões como dados, não como código

Cada padrão é declarado como conjunto de conjuntos de posições:

```
LINHA          → [ {0..4}, {5..9}, {10..14}, {15..19}, {20..24} ]
COLUNA         → [ {0,5,10,15,20}, {1,6,11,16,21}, ... ]
DIAGONAL       → [ {0,6,12,18,24}, {4,8,12,16,20} ]
QUATRO_CANTOS  → [ {0,4,20,24} ]
X              → [ {0,6,12,18,24,4,8,16,20} ]
CARTELA_CHEIA  → [ {0..24} ]
CUSTOM:{id}    → definido pelo administrador numa grade 5×5 clicável
```

Acrescentar um padrão novo (moldura, letra, ampulheta) é **cadastrar dados** — nenhuma
linha do motor muda. Isso atende diretamente ao requisito da seção 6 do briefing.

Se `espacoCentralLivre` estiver ativo, a posição 12 entra pré-marcada em todos os slots.

### 9.4 O que a validação confere

Ao validar uma reivindicação (ou ao confirmar uma apuração automática), o servidor sempre
verifica, nesta ordem:

1. a cartela existe, pertence àquele `associadoId` e àquela `rodadaId`;
2. `status == ATIVA`;
3. **a assinatura HMAC bate** — a cartela não foi adulterada;
4. a cartela foi gerada **antes** de `rodada.iniciadaEm`;
5. o padrão da rodada está satisfeito considerando **apenas** `sorteios` com `status = VALIDO`;
6. identifica **qual número e qual posição** completaram o padrão.

O item 6 é o que sustenta a seção 33 do briefing: o sistema consegue dizer não só *que*
houve bingo, mas *em qual bola exata* ele aconteceu.

### 9.5 Resposta ao associado

- **BINGO VÁLIDO** — cartela, padrão, número que completou, posição na sequência.
- **BINGO NÃO CONFIRMADO** — com motivo em português direto: *"Ainda faltam 2 números para
  completar a linha."* / *"O padrão desta rodada é cartela cheia."* Nunca "erro de
  validação".

Toda reivindicação inválida **também é registrada** em auditoria, com a posição do sorteio
no momento do clique. Isso é o que permite distinguir depois um engano honesto de uma
tentativa sistemática.

---

## 10. Bingos simultâneos

### 10.1 Por que "quem clicou primeiro" é injusto

Com apuração no servidor, a pergunta muda de natureza. Se três cartelas completam o padrão
**no mesmo número**, elas ganharam no mesmo instante — a diferença entre elas é a latência
da rede e a velocidade do polegar. Um associado com 4G ruim numa escola do interior não
deve perder um prêmio para alguém no wi-fi da sede.

### 10.2 A regra recomendada (padrão do sistema)

> **`TODOS_DA_CHAMADA`** — vencem todas as cartelas que estavam com o padrão completo
> imediatamente após o número oficial que completou o padrão pela primeira vez na rodada.

Determinado inteiramente pelo servidor, no instante do sorteio, sem nenhuma participação
do cliente. O botão BINGO! continua existindo — pela emoção e pela conferência — mas não
decide nada.

### 10.3 Políticas configuráveis por rodada

| Política | Comportamento | Quando usar |
|---|---|---|
| `TODOS_DA_CHAMADA` *(padrão)* | todos os que completaram naquele número vencem | quase sempre |
| `PRIMEIRO_CLIQUE` | entre os apurados, vence quem reivindicou primeiro | só se o regulamento exigir vencedor único |
| `SORTEIO_DESEMPATE` | rodada relâmpago entre os empatados, com a mesma mecânica lacrada | prêmio indivisível de valor alto |

E, para o prêmio:

| Divisão | Comportamento |
|---|---|
| `INTEGRAL_A_CADA` | cada vencedor recebe o prêmio integral |
| `RATEIO` | o prêmio é dividido entre os vencedores |

A escolha é feita **ao configurar a rodada**, aparece no regulamento e é exibida ao
associado antes do início. Nada de decidir a regra depois que o empate aconteceu — que é
exatamente o momento em que qualquer decisão parecerá parcial.

### 10.4 O caso desconfortável

`PRIMEIRO_CLIQUE` com `RATEIO` é contraditório e o sistema deve **recusar essa combinação**
na configuração, com mensagem explicativa. Validar coerência de regras na hora de cadastrar
evita a discussão no meio da festa.

---

## 11. Segurança e antifraude

### 11.1 Autenticação em duas camadas

**Operadores** — reaproveitam `Sessao.gs` (token UUID em `CacheService` +
`ScriptProperties`, 6 h). Recomendação adicional: exigir reautenticação para
`CONFIRMAR VENCEDOR` e `ANULAR RODADA`.

**Associados** — fluxo novo, e aqui está a peça elegante da arquitetura:

```
1. Associado informa CPF + data de nascimento
2. GAS valida contra a aba Associados → obtém associadoId
3. GAS assina um Firebase Custom Token (RS256, ~1 h) com a MESMA conta de serviço
      claims: { uid: associadoId, eventoId, rodadaId, papel: "associado" }
4. Navegador troca o token no Firebase Auth e passa a ler o Firestore direto
5. As Security Rules usam esses claims para escopar o que ele pode ler
```

O código de assinatura RSA já existe em `fs_getAccessToken_()` — muda o `aud` e as claims.
**Ganho:** milhares de celulares lendo em tempo real sem nunca tocar no Apps Script.

*Pré-requisito operacional:* a conta de serviço precisa do papel
`iam.serviceAccountTokenCreator` sobre si mesma para que o Firebase aceite o custom token.
Ajuste único no IAM.

### 11.2 Security Rules (esboço)

```javascript
// Escrita: NEGADA a todo cliente. Só a conta de serviço escreve.
match /eventos/{e}/rodadas/{r}/estado/atual {
  allow read: if request.auth != null && request.auth.token.eventoId == e;
  allow write: if false;
}

match /cartelas/{cartelaId} {
  // O associado lê APENAS a própria cartela.
  allow read: if request.auth != null
              && resource.data.associadoId == request.auth.uid;
  allow write: if false;
}

match /eventos/{e}/rodadas/{r}/reivindicacoes/{associadoId} {
  // Única escrita de cliente em todo o sistema — e ela não decide nada.
  allow create: if request.auth != null
                && request.auth.uid == associadoId
                && !exists(/databases/$(database)/documents/...)   // uma só
                && request.resource.data.keys().hasOnly(
                     ['cartelaId','solicitadoEm','posicaoNoMomento']);
  allow update, delete: if false;
}

match /auditoria/{logId} { allow read, write: if false; }  // só via GAS
```

Nenhum associado consegue ler a cartela de outro. Ninguém consegue escrever em `sorteios`,
`vencedores` ou `auditoria` — nem com o token válido na mão, nem com o console do navegador
aberto.

### 11.3 Matriz de fraude

| Vetor | Defesa |
|---|---|
| Alterar a cartela no navegador | Servidor lê a cartela **do banco**, jamais do cliente. HMAC confere integridade. |
| Gerar cartelas até achar uma boa | Cartela é determinística — só existe uma possível por associado/rodada. |
| Criar cartela depois do início | Emissão fechada em `INICIAR RODADA`; validação confere `geradaEm < iniciadaEm`. |
| Forjar BINGO por requisição direta | Reivindicação não decide nada. Apuração é do servidor. |
| Sortear número conveniente | Ordem lacrada, hash público antes da primeira bola. |
| Repetir número | Impossível: permutação + ID do documento = posição. |
| Duplo clique / requisição duplicada | Idempotência por `posicaoEsperada` + precondições no commit. |
| Dois operadores sorteando juntos | `LockService` + precondição de versão. |
| Enumerar CPFs na identificação | Rate limit por IP e por CPF; resposta genérica; atraso constante. |
| Sequestro do link individual | Custom Token curto, escopado a evento e associado; sem `associadoId` na URL. |
| Compartilhar login entre pessoas | Detecção de sessão simultânea + registro. Tolerar por padrão (associado abrindo em dois aparelhos é comum e legítimo) e alertar o operador. |
| Adulterar o banco direto | HMAC quebra; cadeia de auditoria quebra; ambos detectáveis. |
| XSS no telão/painel | Sem `innerHTML` com dado de usuário; `textContent` e sanitização; CSP no `HtmlService`. |
| Enxurrada de reivindicações | Uma por associado por rodada, garantida pelo ID do documento. |

### 11.4 Rate limiting

| Endpoint | Limite |
|---|---|
| Identificação por CPF | 5 tentativas / 15 min por IP; 3 / hora por CPF |
| Emissão de cartela | 3 / min por associado (idempotente de qualquer forma) |
| Reivindicação de Bingo | 1 por rodada (estrutural) |
| Sortear | 1 / 2 s por rodada |

Implementado com `CacheService`, seguindo o padrão já usado em
`RECUPERACAO_LIMITE_CONFIG` no `Sessao.gs`.

---

## 12. Auditoria

### 12.1 Trilha encadeada

Log append-only, no qual **cada registro carrega o hash do anterior**:

```
hash(n) = SHA-256( seq | acao | atorId | payload | registradoEm | hash(n-1) )
```

Consequência prática: alterar ou remover qualquer registro do meio quebra a cadeia de todos
os seguintes. Não impede a alteração — **torna a alteração detectável**, que é o que uma
trilha de auditoria precisa entregar. `Utilities.computeDigest` já faz o SHA-256 no GAS.

Ao encerrar a rodada, o hash final é gravado no documento da rodada e pode ser publicado.

### 12.2 O que sempre gera registro

Evento criado/alterado · rodada criada/iniciada/pausada/encerrada/anulada · **ordem selada
(com o hash)** · cartela gerada · rodada congelada · **cada número sorteado** · sorteio
anulado · reivindicação (válida **e inválida**) · apuração automática · vencedor confirmado
· prêmio entregue · **ordem revelada (com a seed)** · exportação de relatório · alteração de
permissão.

### 12.3 O teste de aceitação da Fase 1

A seção 33 do briefing define quando o sistema está pronto. Traduzindo em um teste único:

> **Dado apenas a coleção `auditoria` de um evento encerrado, é possível reconstruir
> integralmente quem participou, qual cartela cada um recebeu, quais números saíram, em
> que ordem e quando, qual número gerou o Bingo, quais cartelas estavam vencedoras naquele
> instante, quem confirmou e quem recebeu o prêmio — e verificar que a ordem das bolas foi
> fixada antes do primeiro sorteio.**

Esse teste vira caso de teste automatizado na Fase 7. Enquanto ele não passar, o módulo não
é considerado pronto — mesmo que todas as telas funcionem.

---

## 13. Riscos de escalabilidade

### 13.1 Análise por limite

| Limite | Cenário de 1.500 participantes | Situação |
|---|---|---|
| Execuções concorrentes do GAS | ~1 (só o operador sorteia) | ✅ folgado |
| Tempo de execução (6 min) | apuração em ~50 ms | ✅ folgado |
| `UrlFetch` GAS (100k/dia) | ~1.000 no evento | ✅ folgado |
| Escrita no mesmo documento Firestore (~1/s sustentado) | 1 escrita a cada 8 s no `estado/atual` | ✅ folgado |
| Conexões simultâneas Firestore (~1 milhão) | 1.500 | ✅ folgado |
| Tamanho do documento (1 MiB) | estado com 75 números ≈ 3 KB | ✅ folgado |
| `CacheService` (100 KB por chave) | índice invertido de 5.000 cartelas ≈ 300 KB | ⚠️ **fatiar em blocos** |
| Leitura da aba `Associados` | 1 por identificação | ⚠️ **cachear a lista de elegíveis** |

Dois pontos de atenção reais, ambos com solução conhecida e barata. O índice invertido deve
ser fatiado em blocos de ~80 KB com chaves `IDX_{rodadaId}_{bloco}`, e a lista de
`associadoId` elegíveis deve ser carregada uma vez na abertura das inscrições, não a cada
identificação.

### 13.2 Custo estimado (Firestore, por evento)

| Item | Cálculo | Volume |
|---|---|---|
| Leituras do estado ao vivo | 1.500 clientes × 3 rodadas × 75 sorteios | 337.500 |
| Leituras de cartela | 1.500 × 3 | 4.500 |
| Escritas | 225 sorteios + 4.500 cartelas + ~5.000 logs | ~10.000 |
| **Custo aproximado** | | **US$ 0,20 – 0,40 por evento** |

Ordem de grandeza: **centavos de dólar**. O custo do módulo não é infraestrutura — é
desenvolvimento e operação.

### 13.3 Modos de falha e contingência

| Falha | Impacto | Plano |
|---|---|---|
| Internet do local cai | ninguém acompanha | **Modo contingência offline** (14.3) |
| Firestore indisponível | leitura ao vivo para | telão em modo local; sorteio continua e ressincroniza |
| Apps Script fora do ar | sorteio para | rodada pausada; estado preservado; retoma sem perda |
| Celular do associado cai | perde o meio da rodada | `onSnapshot` reconecta e ressincroniza o estado completo |
| Operador fecha o painel | nenhum | estado está no servidor; reabrir restaura |
| Rodada precisa ser anulada | | `ANULAR` com justificativa; nada é apagado; nova rodada com nova seed |

---

## 14. Melhorias importantes não previstas no briefing

Estes pontos não estavam no documento original e, na nossa avaliação, precisam entrar antes
da implementação.

### 14.1 ⚖️ Enquadramento legal — o risco mais sério do projeto

**Este é o único item capaz de inviabilizar o módulo, e ele não é técnico.**

No Brasil, sorteio com distribuição de prêmios é matéria regulada. Dois pontos exigem
posição formal do jurídico do sindicato **antes** da Fase 3:

1. **Se houver qualquer cobrança pela cartela**, ainda que simbólica ou como "contribuição",
   a atividade tende a se aproximar de jogo de azar (art. 50 do Decreto-Lei 3.688/41 —
   contravenção penal). **Recomendação firme: participação inteiramente gratuita, sem
   cobrança de espécie alguma, sem vínculo com adimplência de mensalidade e sem venda de
   cartelas extras.**
2. **Distribuição gratuita de prêmios** pode exigir autorização prévia (Lei 5.768/71 e
   regulamentação da Secretaria de Prêmios e Apostas do Ministério da Fazenda), com
   exceções para eventos internos e de caráter recreativo entre associados.

Providências recomendadas: parecer do jurídico registrado no repositório; regulamento
explicitando gratuidade, público restrito a associados e caráter recreativo; aprovação em
ata de diretoria; guarda dos comprovantes de entrega dos prêmios.

**Impacto no sistema, caso a gratuidade seja adotada:** o modelo de dados já não prevê
cobrança, e assim deve permanecer. Nenhum campo de valor pago por cartela deve existir —
tornar isso impossível no banco é a melhor forma de garantir a regra.

### 14.2 ♿ Acessibilidade — não é opcional para um sindicato de educação

O público inclui pessoas com baixa visão, professores aposentados e pessoas com pouca
familiaridade com aplicativos. Requisitos para a Fase 2:

- **Anúncio sonoro do número** no telão e, opcionalmente, no celular ("B — 12");
- `aria-live="polite"` no último número, para leitores de tela;
- contraste mínimo WCAG AA (4.5:1) — atenção especial ao verde institucional sobre branco,
  que costuma reprovar e precisa de um tom mais escuro para texto;
- alvos de toque de no mínimo 44×44 px;
- controle de tamanho de fonte na própria interface;
- **funcionar sem áudio e sem cor como únicos canais** — número marcado precisa de mudança
  de forma, não só de cor (daltonismo).

### 14.3 📴 Modo contingência offline

Cenário provável: o evento acontece num salão com internet instável.

- **Modo bolas físicas:** o sorteio continua com globo e bolas reais; o operador digita o
  número no painel. Toda a apuração, auditoria e validação seguem funcionando. Requer um
  campo `origemSorteio: DIGITAL | FISICO` e o entendimento de que, nesse modo, a garantia do
  lacre não se aplica (a auditoria deve registrar isso explicitamente).
- **Telão degradado:** cache local do estado; funciona sozinho por alguns minutos e
  ressincroniza.
- **Ensaio obrigatório:** um evento de homologação completo, com pelo menos 30 celulares
  reais na rede do local, antes do evento de verdade.

### 14.4 🔐 Lacre distribuído (para prêmios de valor alto)

Variante do commit-reveal em que a seed é composta por contribuições de duas ou três
pessoas (por exemplo, presidente e um associado sorteado da plateia), cada uma com sua
parte lacrada. Nenhuma pessoa sozinha conhece a ordem. Custo de implementação baixo,
ganho de legitimidade alto quando o prêmio é significativo.

### 14.5 🧪 Ambiente de ensaio de primeira classe

Um botão **"Simular rodada"** que executa uma rodada inteira com cartelas fictícias em
segundos, contra o mesmo motor. Serve para treinar a equipe, validar padrões novos e
demonstrar o sistema à diretoria — sem tocar em dados de produção. Isso costuma ser
descartado como "extra" e depois faz falta em toda demonstração.

### 14.6 📄 Relatório público de transparência

Ao encerrar o evento, geração automática de uma página pública com: hash lacrado, seed
revelada, sequência completa dos 75 números, padrões de cada rodada, vencedores por apelido
público e horários. **Sem nenhum dado pessoal.** É o produto natural de tudo o que a
arquitetura já produz, e transforma auditoria em comunicação institucional.

### 14.7 📱 Peso da página e consumo de dados

Muitos associados usam plano de dados limitado. Metas: primeira carga abaixo de 300 KB;
atualização por sorteio abaixo de 2 KB; funcionamento em 3G; nada de bibliotecas pesadas.
O SDK do Firestore deve entrar em build modular, não completo.

### 14.8 🎁 Registro de entrega de prêmio

O briefing termina o ciclo em "confirmar vencedor". Falta o passo final e o mais sensível
em prestação de contas: **quem efetivamente recebeu**. Campos `premioEntregueEm`,
`premioRecebidoPor` e anexo de termo de recebimento assinado, com registro em auditoria.

### 14.9 🔁 Reaproveitamento no SISGEP

Três peças construídas aqui têm valor muito além do Bingo e devem ser projetadas para
reuso desde o início:

1. **`associadoId`** — identificador opaco que todo o SISGEP passa a poder usar;
2. **Autenticação de associado via Custom Token** — habilita qualquer módulo futuro a ter
   leitura em tempo real no celular do associado, com custo próximo de zero;
3. **Trilha de auditoria encadeada** — aplicável a financeiro, benefícios e China Park.

Essa é a justificativa mais forte para a arquitetura híbrida: **o Bingo paga a
infraestrutura de tempo real que o SISGEP inteiro vai querer depois.**

---

## 15. Organização do código proposta

Preservando a convenção do repositório (arquivos na raiz, prefixo por módulo):

**Backend**

| Arquivo | Responsabilidade |
|---|---|
| `BingoController.gs` | rotas `doGet`/`doPost`, sessão, resposta HTTP |
| `BingoRepository.gs` | acesso ao Firestore; estende a ponte com `commit` e `runQuery` |
| `EventoBingoService.gs` | CRUD de eventos, rodadas, prêmios; portões de estado |
| `CartelaService.gs` | geração determinística, assinatura, limites |
| `SorteioService.gs` | lacre, ponteiro, idempotência, concorrência |
| `PadraoBingoService.gs` | padrões como dados; índice invertido |
| `ApuracaoService.gs` | apuração por sorteio; políticas de vencedor |
| `ValidacaoBingoService.gs` | validação de reivindicação |
| `ParticipanteBingoService.gs` | elegibilidade, `associadoId`, custom token |
| `AuditoriaBingoService.gs` | trilha encadeada |
| `SegurancaBingoService.gs` | rate limit, sanitização, idempotência |
| `RelatoriosBingo.gs` | relatórios e exportação |
| `BingoTestes.gs` | suíte da Fase 7 |

**Frontend**

`BingoAssociado.html` · `BingoAdmin.html` · `BingoTelao.html` ·
`BingoStyles.html` · `BingoScripts.html` · `BingoComponentes.html`

Nenhum arquivo deve passar de ~400 linhas. Regra de negócio nunca dentro de HTML.

---

## 16. Critérios de aceite da Fase 1

- [ ] Arquitetura híbrida aprovada pela coordenação técnica
- [ ] Decisão sobre o `associadoId` (coluna nova em `Associados`) aprovada
- [ ] **Parecer jurídico sobre o enquadramento do sorteio (14.1)** — bloqueante
- [ ] Política padrão de vencedor definida (recomendado: `TODOS_DA_CHAMADA`)
- [ ] Gratuidade da participação confirmada em ata
- [ ] Papel `serviceAccountTokenCreator` concedido à conta de serviço
- [ ] Identidade visual do SindEducação (logo, verde institucional, tipografia) fornecida
- [ ] Escopo do evento piloto definido (número esperado de participantes e rodadas)

## 17. Próximos passos

| Fase | Entrega | Depende de |
|---|---|---|
| **2 — Protótipo UX/UI** | 7 telas navegáveis, sem backend | aprovação desta fase + identidade visual |
| 3 — Backend | serviços, repositório, Security Rules | Fase 2 aprovada |
| 4 — Frontend | interfaces responsivas | Fase 3 |
| 5 — Tempo real | `onSnapshot`, reconexão, ressincronização | Fase 4 |
| 6 — Segurança e auditoria | revisão completa, teste de invasão | Fase 5 |
| 7 — Testes | cenários normais, extremos e fraudulentos | Fase 6 |
| 8 — Homologação | ensaio com celulares reais no local | Fase 7 |

---

### Nota final

Todo o mérito desta arquitetura está em uma escolha só: **tirar do navegador do associado
qualquer papel na decisão do resultado.** O celular exibe, comemora e reivindica. Quem
sorteia, apura, decide e registra é o servidor — e ele o faz de um jeito que qualquer
associado pode conferir depois. Justiça do sorteio, aqui, não é uma promessa da equipe:
é uma propriedade verificável do sistema.
