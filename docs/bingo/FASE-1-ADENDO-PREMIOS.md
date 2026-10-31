# Bingo Online — SindEducação
## ADENDO À FASE 1 — Prêmios reais (PIX, hospedagem no Parque China e outros)

> Complementa e **corrige em pontos específicos** o documento `FASE-1-ARQUITETURA.md`.
> Motivo: a definição de que os prêmios incluem **valor em dinheiro via PIX** e
> **hospedagem no Parque China** altera o modelo de dados, o fluxo de entrega, o modelo
> de ameaça e o enquadramento fiscal do módulo.
>
> **Nenhum código de produção foi escrito.** Fase 1 segue aguardando aprovação.

---

## 0. Por que este adendo existe

Na Fase 1, "prêmio" era um campo de texto com valor estimado. A entrega aparecia como
melhoria de rodapé (§14.8). Com PIX e hospedagem, isso não se sustenta por três motivos:

1. **Prêmio com dinheiro real muda o modelo de ameaça.** Ataques que eu classifiquei como
   improváveis passam a ter retorno financeiro direto. Um deles, descrito na seção 4, é
   grave o bastante para alterar a ordem das operações do sorteio.
2. **A entrega deixa de ser um registro e vira um processo.** Pagar via PIX e hospedar no
   Parque China são operações com custódia, alçada, prazo, comprovação e retenção de
   imposto. Isso é um subsistema, não um campo.
3. **A hospedagem não é um prêmio novo — é um módulo que já existe.** `Reservaparquechina.gs`
   tem 1.933 linhas, com controle de suítes, disponibilidade, dependentes, auditoria e
   bloqueio institucional. O Bingo deve **usar** esse módulo, jamais duplicá-lo.

---

## 1. ⚖️ Escalada do risco jurídico e fiscal

Na Fase 1 eu classifiquei o enquadramento legal como bloqueante. **Com prêmio em dinheiro,
o risco muda de natureza, não apenas de grau** — e um dos pontos abaixo pode exigir
redesenho do catálogo de prêmios, não só um parecer.

Registro os pontos com a precisão possível. Não substituem parecer jurídico; servem para
que o jurídico do sindicato saiba exatamente o que precisa responder.

### 1.1 Prêmio em dinheiro — o ponto mais delicado

No regime brasileiro de distribuição gratuita de prêmios mediante sorteio (Lei 5.768/71 e
Decreto 70.951/72), **a regra geral veda a distribuição de prêmios em dinheiro**. É
justamente por isso que promoções comerciais no país entregam carro, casa ou "vale" — e
não transferência bancária.

**Pergunta a ser respondida pelo jurídico, com esta redação:**

> A distribuição de prêmio em dinheiro (PIX) por entidade sindical, mediante sorteio
> gratuito restrito a associados, em evento recreativo interno e sem qualquer finalidade
> de propaganda comercial, está fora do alcance da vedação do regime da Lei 5.768/71? Em
> caso negativo, qual o instrumento adequado?

**Alternativas técnicas prontas, caso a resposta seja negativa** — todas já suportadas
pelo desenho proposto neste adendo, sem custo adicional de arquitetura:

| Alternativa | Como fica no sistema |
|---|---|
| Cartão-presente / vale-compras de valor equivalente | tipo `VOUCHER`, com o módulo `Voucher.gs` já existente |
| Crédito em benefícios do sindicato (hospedagem, ótica, cursos) | tipo `CREDITO_INTERNO` |
| Bem de valor equivalente (eletrodoméstico, celular) | tipo `PRODUTO` |
| Manutenção do PIX, se o jurídico entender cabível | tipo `PIX` |

**Recomendação de engenharia:** o catálogo de prêmios já nasce tipado e extensível
(seção 2). Trocar `PIX` por `VOUCHER` depois do parecer é mudança de cadastro, não de
código. Não vamos travar o desenvolvimento esperando o parecer — vamos construir de modo
que qualquer resposta seja acomodada.

### 1.2 A armadilha da adimplência

Este ponto é sutil e perigoso. Na Fase 1 recomendei participação gratuita. Com prêmio em
dinheiro, é preciso ir além:

> **Não restringir a participação a associados adimplentes.**

Se apenas quem está em dia com a mensalidade pode concorrer a um prêmio em dinheiro,
abre-se o argumento de que a mensalidade é a contraprestação para participar do sorteio —
exatamente a caracterização que se quer evitar. O vínculo pode ser com a **condição de
associado**, não com o pagamento.

**Impacto no sistema:** o campo `regrasParticipacao.exigeAdimplencia`, previsto na Fase 1,
deve nascer com valor padrão `false` e um aviso explícito na tela de configuração da
rodada quando o prêmio for do tipo `PIX`. A tela deve explicar *por que* — não apenas
impedir.

### 1.3 Imposto de renda retido na fonte

**Prêmio distribuído por sorteio tem tributação específica, e o ônus recai sobre quem
distribui.** Valores a confirmar com a contabilidade, mas a estrutura é esta:

| Tipo de prêmio | Alíquota | Quem suporta o ônus |
|---|---|---|
| **Dinheiro** (PIX) — Lei 4.506/64, art. 14 | 30%, exclusivo na fonte | descontado do prêmio do ganhador |
| **Bens e serviços** (hospedagem, produtos) — Lei 8.981/95, art. 63 | 20% | **a cargo do sindicato**, além do custo do prêmio |

Duas consequências concretas de orçamento e de interface:

- **A hospedagem custa mais do que a diária.** Um prêmio de hospedagem avaliado em
  R$ 1.000 gera aproximadamente R$ 200 de imposto a cargo do sindicato. O orçamento do
  evento precisa prever isso, e o sistema precisa exibir esse número na hora de cadastrar
  o prêmio — não descobrir depois.
- **O PIX que cai na conta é menor que o anunciado.** Se o telão exibe "PRÊMIO: R$ 1.000"
  e o associado recebe R$ 700, haverá reclamação legítima. O sistema deve tratar isso na
  origem: o cadastro do prêmio registra **valor bruto** e **valor líquido estimado**, e a
  interface do associado e o telão exibem os dois, sempre. Alternativamente, a diretoria
  decide fazer o *gross-up* (anunciar o líquido e arcar com o imposto por cima) — decisão
  de negócio que o sistema apenas precisa suportar, através de um campo
  `politicaImposto: DESCONTA_DO_PREMIO | GROSS_UP`.

### 1.4 Providências recomendadas antes da Fase 3

- [ ] Parecer jurídico respondendo especificamente à pergunta da seção 1.1 — **bloqueante**
- [ ] Definição contábil das alíquotas e do responsável pelo recolhimento
- [ ] Decisão de diretoria sobre `politicaImposto` (desconto ou *gross-up*)
- [ ] Regulamento explicitando gratuidade, ausência de vínculo com adimplência, tributação e prazos
- [ ] Aprovação em ata, com o orçamento do evento incluindo o imposto sobre prêmios em bens
- [ ] Definição sobre participação de dirigentes, empregados e operadores (seção 4.4)

---

## 2. Catálogo aberto: a presidência escolhe o que sortear

### 2.0 O princípio — e uma correção de rumo

> **O prêmio é livre. A presidência cadastra o que quiser sortear, e o sistema aceita.**

Este é o requisito que manda em toda a seção. Uma primeira versão deste adendo desenhou o
prêmio como uma lista fechada de tipos — o que teria transformado o sistema em um obstáculo
à decisão da presidência. Corrigido: **o catálogo é aberto por padrão.**

A distinção que sustenta isso é entre *o que é o prêmio* e *como ele chega ao vencedor*:

- **O que é o prêmio** — texto livre, valor livre, imagem, patrocinador. Sem restrição,
  sem lista suspensa obrigatória, sem campo que impeça salvar. Uma cesta de Natal, um
  celular, uma diária, um jantar, um cheque, um curso, uma bicicleta — tudo entra.
- **Como ele chega ao vencedor** — aqui o sistema *oferece ajuda*, não impõe. Se o prêmio
  for PIX ou hospedagem no Parque China, existem fluxos automatizados prontos que poupam
  trabalho da equipe. Para todo o resto, existe o fluxo de **entrega manual**, que serve
  a qualquer prêmio imaginável.

**A regra de ouro da implementação:** o campo de tipo **nunca bloqueia o cadastro**. Ele
começa em `LIVRE` e só muda se a presidência quiser aproveitar uma automação. Nenhum prêmio
pode ser recusado pelo sistema por não se encaixar em uma categoria.

```
tipoEntrega : LIVRE                        ← PADRÃO. Entrega manual registrada.
                                              Aceita qualquer prêmio, sem exceção.
              PIX                          ← opcional: gera ordem de pagamento
              HOSPEDAGEM_PARQUE_CHINA      ← opcional: integra com o módulo do Parque
              VOUCHER                      ← opcional: emite PDF com QR Code
```

Ampliar essa lista no futuro é **cadastro, não programação** — do mesmo jeito que os
padrões de bingo da §9.3 da Fase 1. Se a presidência decidir sortear uma viagem com
agência parceira, cria-se a categoria pelo painel; o motor não muda.

### 2.1 Estrutura

```
eventos/{eventoId}/premios/{premioId}
  ordem, descricao, imagemUrl, patrocinador     ← TEXTO LIVRE, sem restrição
  definidoPor       : quem cadastrou (normalmente a presidência)
  tipoEntrega       : LIVRE (padrão) | PIX | HOSPEDAGEM_PARQUE_CHINA | VOUCHER | ...
  valorBruto        : valor de referência do prêmio — opcional
  valorLiquidoEstimado
  politicaImposto   : DESCONTA_DO_PREMIO | GROSS_UP
  custoTotalEvento  : valorBruto + imposto a cargo do sindicato   ← exibido no cadastro

  lastro            : { status, referencia, lastreadoPor, lastreadoEm }
                       status: PENDENTE | LASTREADO | LIBERADO | CONSUMIDO

  config            : payload específico do tipo (2.2)
  prazoResgateDias  : validade para o vencedor reivindicar/usar
  transferivel      : boolean
```

### 2.2 Configuração por tipo de entrega

O bloco `LIVRE` é o que atende à maioria dos prêmios. Os demais são atalhos opcionais.

```
LIVRE  (padrão — serve para qualquer prêmio)
  formaEntrega           : texto livre ("retirar na sede", "entrega em domicílio", ...)
  prazoRetiradaDias      : opcional
  responsavelEntrega     : opcional
  → entrega registrada manualmente, com anexo de comprovante ou termo assinado

PIX
  valorBruto, politicaImposto
  exigeChaveDoProprioCPF : true        ← ver 3.2
  alcadaAprovacao        : valor acima do qual exige aprovação da diretoria

HOSPEDAGEM_PARQUE_CHINA
  quantidadeDiarias      : ex. 7 (semanal) — usa PC_TIPO_RESERVA existente
  quantidadePessoas      : capacidade contemplada
  colchaoExtraIncluso    : boolean
  periodoValidadeInicio / periodoValidadeFim
  temporadaExcluida      : [ períodos de alta temporada, se houver ]
  suiteReservadaNoLastro : identificador da suíte bloqueada (3.3)

VOUCHER / PRODUTO / CREDITO_INTERNO
  parceiro, prazoRetiradaDias, localRetirada
```

### 2.3 A regra nova mais importante: **sem lastro, não inicia**

> **Uma rodada não pode ser iniciada enquanto o prêmio não estiver lastreado.**

Sortear um prêmio que não está garantido é o pior desfecho possível para o sindicato — pior
do que não fazer o evento. Um associado ganha diante de todo mundo e depois descobre que
não havia caixa, ou que a suíte estava ocupada. A regra elimina isso estruturalmente, no
mesmo portão de estado que já valida "cartelas geradas" (§5.1 da Fase 1).

| Tipo | O que significa "lastreado" | Verificação |
|---|---|---|
| `PIX` | Valor empenhado no financeiro, com autorização prévia registrada | registro no módulo de Despesas, status `AUTORIZADO_PREVIAMENTE` |
| `HOSPEDAGEM_PARQUE_CHINA` | Suíte/período **já bloqueado** no módulo do Parque | `bloquearSuiteAdministrativoParqueChina()` executado, `idReserva` guardado |
| `VOUCHER` | Item em estoque ou termo do parceiro anexado | anexo obrigatório |
| `LIVRE` | Confirmação de que o prêmio está em mãos ou garantido | marcação simples com responsável |

Para o tipo `LIVRE`, "lastrear" é apenas alguém marcar **"prêmio garantido"** e assinar por
isso. Não há burocracia: é uma caixa de seleção com nome e horário, para que ninguém sorteie
o que não tem.

O painel administrativo exibe o lastro de cada rodada com semáforo, e o botão
**INICIAR RODADA** avisa quando houver prêmio pendente — dizendo qual prêmio e o que falta,
nunca um "não é possível iniciar".

**A presidência pode dispensar o lastro.** Se o presidente decidir iniciar a rodada com um
prêmio ainda não formalizado — porque ele mesmo está garantindo —, o sistema permite, com
justificativa e registro em auditoria (`LASTRO_DISPENSADO_PELA_PRESIDENCIA`). O sistema
protege a decisão dele com um lembrete; não a substitui.

---

## 3. Entrega do prêmio: de campo a máquina de estados

### 3.1 O ciclo comum a todos os tipos

```
APURADO                  servidor identificou a cartela vencedora
   ↓
CONFIRMADO               administrador confirmou (dupla confirmação na tela)
   ↓
ACEITE_PENDENTE          vencedor notificado; precisa aceitar e informar dados
   ↓                     ⏱ expira em prazoResgateDias
HABILITADO               dados conferidos; ciente da tributação registrado
   ↓
AUTORIZADO               alçada aprovada (dupla alçada acima do limite)
   ↓
EXECUTADO                PIX pago / voucher emitido / reserva criada
   ↓
COMPROVADO               comprovante anexado
   ↓
ENCERRADO

Ramos: RECUSADO_PELO_VENCEDOR · EXPIRADO · DEVOLVIDO_AO_ACERVO · CANCELADO
```

Cada transição gera registro na trilha encadeada da Fase 1 (§12), com ator, horário e
justificativa quando aplicável. `DEVOLVIDO_AO_ACERVO` libera o lastro — a suíte volta a
ficar disponível, o valor empenhado é liberado.

### 3.2 PIX — o desenho honesto

**Não vamos automatizar o pagamento.** O SISGEP não tem hoje nenhuma integração de PIX de
saída — o termo aparece no código apenas como forma de *recebimento* (`Receita.gs`,
`Recibo.gs`). Construir integração bancária de pagamento para este módulo seria assumir
risco de segurança e de compliance desproporcional ao problema.

**O sistema gera a ordem de pagamento autorizada; o financeiro executa no banco; o
comprovante volta para o sistema.** Isso mantém o controle humano sobre saída de dinheiro,
que é onde ele deve estar, e reaproveita o módulo de Despesas que já existe.

```
1. Vencedor confirmado é notificado
2. Vencedor informa a chave PIX e registra ciência da tributação
3. Sistema confere a titularidade da chave (regra abaixo)
4. Sistema gera ORDEM DE PAGAMENTO no módulo de Despesas
       beneficiário, valor bruto, imposto, valor líquido, referência da rodada
5. Alçada aprova (dois aprovadores acima do limite configurado)
6. Financeiro executa o PIX no banco, manualmente
7. Comprovante anexado → entrega passa a COMPROVADO
8. Chave PIX ELIMINADA após o prazo fiscal
```

**A regra de titularidade — simples e forte:**

> Aceitar exclusivamente **chave PIX do tipo CPF, igual ao CPF do associado vencedor**.

Isso elimina de uma vez conta de terceiro, laranja, chave digitada errada e a discussão
sobre "meu marido recebe por mim". O sistema não precisa consultar o banco: compara a chave
informada com o CPF já cadastrado na base de associados. Se não bater, recusa com mensagem
clara. Exceções (inventário, procuração) passam por autorização manual do administrador,
com justificativa e anexo — e ficam na auditoria.

**LGPD — resolvendo a tensão com a Fase 1.** Eu prometi que CPF não entraria no módulo do
Bingo. A chave PIX do tipo CPF *é* um CPF. A resolução:

> A chave PIX **nunca é gravada no Firestore**. Ela é coletada, validada e enviada
> diretamente ao módulo financeiro, no Sheets — onde o CPF do associado já vive
> legitimamente. O Bingo guarda apenas `entregaId` e `status`.

A promessa da Fase 1 se mantém intacta: a camada ao vivo, que milhares de celulares
acessam, continua sem um único CPF.

### 3.3 Hospedagem no Parque China — crédito, não data

**Decisão de produto:** o prêmio **não** é uma estadia em data fixa. É um **crédito de
hospedagem com prazo de validade**, resgatável pelo vencedor no fluxo normal do Parque.

O motivo é prático. Sortear uma semana específica transforma um bom prêmio em um problema:
professor em período letivo, quem já tem viagem marcada, quem tem filho em prova. O prêmio
vira frustração e o sindicato vira responsável pela frustração. Crédito com validade
resolve, e ainda distribui melhor a ocupação do parque ao longo do ano.

**Como se integra ao que já existe — sem uma linha de código novo de reserva:**

| Etapa | Função já existente em `Reservaparquechina.gs` |
|---|---|
| Lastro antes da rodada | `bloquearSuiteAdministrativoParqueChina()` — cria `BLOQUEIO_ADMINISTRATIVO`, `GRATUITO`, `ISENTO` |
| Conferir disponibilidade no resgate | `verificarDisponibilidadeSuiteParqueChina_()` / `listarSuitesLivresParqueChina_()` |
| Criar a reserva do vencedor | `criarAgendamentoManualParqueChina()` com `origem: "PREMIO_BINGO"` |
| Cálculo e isenção | `calcularPeriodoParqueChina_()`, `gratuitoPago: "GRATUITO"`, `statusPagamento: "ISENTO"` |
| Dependentes e acompanhantes | colunas `DEPENDENTE_1..4` já existentes |
| Auditoria | `pcAuditar_()` |
| Concorrência | `pcComLock_()`, `pcChaveIdempotencia_()` |

O Bingo entra no módulo do Parque por **duas chamadas**: uma para bloquear no lastro, outra
para converter em reserva no resgate. Todo o resto — disponibilidade, suítes, dependentes,
agenda mensal, relatórios — é o módulo existente fazendo o que já faz bem.

**Emissão do comprovante:** reaproveitar `Voucher.gs` + `VoucherPdf.gs` +
`VoucherValidacao.gs`, já em produção. O vencedor recebe um voucher em PDF com QR Code,
validável, com prazo. Nenhum artefato novo.

**Regras que precisam de decisão da diretoria** (o sistema suporta qualquer resposta, mas
precisa saber qual é):

- prazo de validade do crédito — sugerido: 12 meses;
- alta temporada e feriados entram ou ficam de fora;
- quantas pessoas o prêmio contempla e se dependentes podem ser incluídos;
- o crédito é transferível para outro associado;
- o que acontece no *no-show* — perde ou remarca uma vez;
- se colchão extra e consumo no local estão inclusos.

### 3.4 Prazo, expiração e devolução ao acervo

Todo prêmio tem `prazoResgateDias`. Vencido o prazo sem aceite ou sem resgate, a entrega
vai para `EXPIRADO`, o lastro é liberado e o fato é registrado. A diretoria decide se o
prêmio expirado é resorteado, doado ou devolvido ao caixa — o sistema apenas registra e não
decide sozinho.

Notificação obrigatória em três momentos: na confirmação, na metade do prazo e a três dias
do vencimento. Um prêmio perdido por falta de aviso é falha do sistema, não do associado.

---

## 4. O modelo de ameaça mudou — e isso altera a arquitetura

Esta é a parte tecnicamente mais importante do adendo.

### 4.1 O ataque que dinheiro real viabiliza

Na Fase 1 eu avaliei o risco do lacre assim: quem tem acesso ao cofre pode **ler** a ordem
futura, mas não **alterá-la**, e classifiquei a troca como favorável. **Com prêmio em
dinheiro, essa avaliação estava incompleta.**

O problema: as cartelas são geradas deterministicamente a partir do `associadoId`. Alguém
que conheça a ordem das bolas **antes** do sorteio pode calcular, fora do sistema, qual
cartela venceria mais cedo — e então **habilitar um participante cujo `associadoId` produza
justamente essa cartela**, testando candidatos offline até encontrar um bom.

Ler a ordem não permite alterar o sorteio. Mas permite **escolher o vencedor**, que é pior.
E o determinismo da cartela — que na Fase 1 era uma virtude pura — é o que torna o ataque
viável.

### 4.2 A correção: dois lacres, em ordem obrigatória

A defesa não é abandonar o determinismo. É **fechar a lista de participantes antes de a
ordem existir**:

```
1. HABILITAR PARTICIPANTES        lista de associadoId elegíveis
2. GERAR CARTELAS                 determinísticas, como na Fase 1
3. LACRAR AS CARTELAS             hash da lista completa de cartelas → PUBLICADO
   ⛔ a partir daqui, nenhum participante novo pode ser habilitado nesta rodada
4. LACRAR A ORDEM DAS BOLAS       hash da permutação → PUBLICADO
5. INICIAR A RODADA
```

Publicados os dois hashes, o sistema fica preso pelos dois lados:

- quem conhecer a **ordem** não consegue fabricar cartela — a lista já está lacrada e
  qualquer inclusão quebra o hash publicado;
- quem conhecer as **cartelas** não consegue escolher a ordem — ela ainda não existia
  quando as cartelas foram fechadas.

Custo de implementação: praticamente nenhum. É um hash a mais e a ordem correta das
operações. **É a mudança mais valiosa deste adendo.**

### 4.3 Custódia separada e lacre distribuído obrigatório

- O `segredoDaRodada` (que gera as cartelas) e a `seed` (que gera a ordem) passam a ser
  **independentes e sob custódia separada**. Na Fase 1 isso era conveniência; agora é
  requisito.
- O **lacre distribuído**, que na Fase 1 eu descrevi como opcional para prêmios altos
  (§14.4), passa a ser **obrigatório para rodadas com prêmio em dinheiro ou acima de um
  valor definido em regulamento**. A seed é composta por contribuições de duas ou três
  pessoas — por exemplo, um diretor e um associado sorteado da plateia. Ninguém sozinho
  conhece a ordem, e o ataque de 4.1 deixa de depender de confiança individual.

### 4.4 Segregação de funções e participação de quem opera

Com dinheiro em jogo, a segregação da Fase 1 (§5.2) precisa de mais um degrau:

| Papel | Define prêmios | Sorteia | Confirma vencedor | Autoriza pagamento | Executa pagamento |
|---|:---:|:---:|:---:|:---:|:---:|
| **Presidência** | ✅ **livre** | — | — | ✅ acima do limite | — |
| Administrador do Bingo | ✅ (por delegação) | ✅ | ✅ | — | — |
| Operador | — | ✅ | — | — | — |
| Financeiro | — | — | — | ✅ | ✅ |

**Novo papel: `PRESIDENCIA`.** É quem define livremente o que será sorteado (seção 2), pode
dispensar o lastro com justificativa e compõe a alçada de autorização de pagamento. Pode
delegar o cadastro de prêmios ao administrador do Bingo — a delegação fica registrada.

**Nenhum papel acumula "confirmar vencedor" e "autorizar pagamento".** Vale inclusive para a
presidência: ela autoriza o pagamento, mas não confirma o vencedor — quem confirma é o
administrador do Bingo, sobre uma apuração que a máquina já fez sozinha.

E uma decisão de política que o sistema precisa receber pronta: **operadores, dirigentes e
empregados do sindicato podem concorrer?** Recomendo vedar durante o evento que operam. Se
a diretoria preferir permitir, o sistema deve no mínimo **marcar essas cartelas** e destacá-las
no relatório — a transparência aqui protege as próprias pessoas envolvidas de suspeita
infundada.

### 4.5 Identificação mais forte para receber

CPF mais data de nascimento é razoável para entrar num bingo recreativo. É fraco para
liberar transferência bancária.

**Recomendação:** manter a identificação atual para *participar*, e exigir um degrau a mais
para *receber* — código de uso único enviado ao e-mail ou celular **já cadastrados** na base
de associados, antes de habilitar a entrega. Quem não tem contato atualizado no cadastro
retira presencialmente, com documento. Isso também tem um efeito colateral bom: incentiva a
atualização cadastral.

### 4.6 Limite de premiação por associado

Com prêmios de valor real, recomendo o padrão **uma premiação por associado por evento**
(configurável). Um mesmo associado ganhando três rodadas seguidas é estatisticamente
possível e politicamente desastroso — a suspeita aparece independentemente de o sorteio ter
sido honesto. Espalhar a premiação protege a legitimidade do evento e contempla mais gente,
que é o objetivo de um bingo de confraternização.

### 4.7 Matriz de fraude — entradas novas

| Vetor (novo, viabilizado por prêmio real) | Defesa |
|---|---|
| Insider lê a ordem e habilita participante com cartela vencedora | Lacre das cartelas **antes** do lacre da ordem (4.2) + lacre distribuído (4.3) |
| Desvio do PIX para conta de terceiro | Chave obrigatoriamente do tipo CPF e igual à do associado (3.2) |
| Operador cria associado fantasma | Habilitação encerrada antes do lacre; lista de participantes auditada e hasheada |
| Vencedor contesta valor recebido | Valor bruto, imposto e líquido exibidos antes do aceite e registrados no aceite |
| Sorteio de prêmio sem lastro | Portão de estado: rodada não inicia sem lastro (2.3) |
| Reserva do Parque em data já ocupada | Bloqueio institucional no lastro + verificação de disponibilidade no resgate |
| Duplo resgate do mesmo voucher | `VoucherValidacao.gs`, já em produção |
| Pagamento executado duas vezes | Chave de idempotência na ordem de pagamento + conciliação do comprovante |

---

## 5. Impacto no que já foi aprovado na Fase 1

| Seção da Fase 1 | Situação | O que muda |
|---|---|---|
| §1 Arquitetura híbrida | ✅ mantida | nenhuma mudança |
| §6 Cartela determinística | ✅ mantida | ganha o lacre da lista de cartelas (4.2) |
| §8 Sorteio lacrado | ⚠️ **corrigida** | ordem obrigatória dos dois lacres; lacre distribuído passa a obrigatório |
| §9 Apuração no servidor | ✅ mantida | nenhuma mudança |
| §10 Bingos simultâneos | ⚠️ **atenção** | com prêmio indivisível, `RATEIO` pode ser inviável — ver 5.1 |
| §11 Antifraude | ⚠️ **ampliada** | novos vetores (4.7), segregação e identificação reforçadas |
| §12 Auditoria | ⚠️ **ampliada** | passa a cobrir lastro, alçada, execução e comprovação |
| §14.1 Risco jurídico | 🔴 **escalado** | prêmio em dinheiro pode exigir mudança de catálogo (1.1) |
| §14.4 Lacre distribuído | ⚠️ **promovido** | de opcional para obrigatório em rodadas com dinheiro |
| §14.8 Entrega do prêmio | 🔴 **reescrito** | de campo para máquina de estados (seção 3) |
| §5.2 Permissões | ➕ **ampliada** | novo papel `PRESIDENCIA`, que define os prêmios (4.4) |
| Novo | ➕ | catálogo **aberto**, lastro com dispensa pela presidência, integração com Parque China e Financeiro |

### 5.1 O empate ficou mais difícil

Com prêmio abstrato, `RATEIO` resolvia empate. Com prêmios reais, nem sempre:

| Prêmio | Rateio é possível? |
|---|---|
| PIX | ✅ divide o valor |
| Hospedagem | ⚠️ só se houver suítes/diárias suficientes no lastro |
| Produto único (uma bicicleta, uma cesta) | ❌ impossível |

**Aviso de coerência no cadastro, não bloqueio.** Como o prêmio é livre, o sistema não tem
como saber se "cesta de Natal" é divisível. Então ele **pergunta** ao cadastrar: *"Este
prêmio pode ser dividido entre vários vencedores?"* — e, conforme a resposta, sugere a
política de empate adequada (`SORTEIO_DESEMPATE` ou lastro múltiplo).

Quem responde é quem cadastrou o prêmio. O sistema só garante que a pergunta seja feita
**antes** da rodada, e não no meio da festa — que é o único momento em que qualquer resposta
parecerá parcial.

---

## 6. Critérios de aceite atualizados

Substituem os da §16 da Fase 1 no que se refere a prêmios.

**Bloqueantes:**
- [ ] Parecer jurídico sobre prêmio em dinheiro (1.1)
- [ ] Definição contábil das alíquotas e do responsável pelo recolhimento (1.3)
- [ ] Decisão sobre `politicaImposto`: desconto do prêmio ou *gross-up* (1.3)
- [ ] Confirmação de que a participação **não** exige adimplência (1.2)

**Necessários antes da Fase 3:**
- [ ] Confirmação de que a presidência define os prêmios livremente, e quem recebe delegação
- [ ] Lista dos prêmios do evento piloto — definida pela presidência, em texto livre
- [ ] Regras do crédito de hospedagem: validade, temporada, pessoas, transferência, *no-show* (3.3)
- [ ] Limites de alçada para autorização de pagamento
- [ ] Política sobre participação de dirigentes, empregados e operadores (4.4)
- [ ] Confirmação do lacre distribuído e de quem serão os custodiantes (4.3)
- [ ] Limite de premiação por associado por evento (4.6)

---

## 7. Arquivos afetados no plano de código

Acréscimos ao mapa da §15 da Fase 1:

| Arquivo | Responsabilidade |
|---|---|
| `PremioBingoService.gs` | catálogo **aberto**, cálculo de imposto, avisos de coerência |
| `LastroPremioService.gs` | empenho, liberação e dispensa pela presidência |
| `EntregaPremioService.gs` | máquina de estados da entrega, prazos, notificações; inclui o fluxo `LIVRE` |
| `BingoParqueChinaAdapter.gs` | **só duas chamadas** ao módulo existente — bloquear e converter |
| `BingoFinanceiroAdapter.gs` | ordem de pagamento no módulo de Despesas, alçada, comprovante |

**Nenhuma alteração é necessária em `Reservaparquechina.gs`, `Despesas.gs` ou `Voucher.gs`.**
O Bingo entra por adaptadores finos, na fronteira. Se algum desses módulos precisar mudar
para acomodar o Bingo, é sinal de que o adaptador está errado.

---

### Nota final

O princípio da Fase 1 — tirar do navegador do associado qualquer papel na decisão do
resultado — continua valendo integralmente. Este adendo acrescenta um segundo princípio,
que só faz sentido quando há valor real em jogo:

> **Nenhuma pessoa sozinha, dentro ou fora do sindicato, pode determinar quem ganha nem
> mover o prêmio.** A ordem é lacrada por várias mãos, o vencedor é apurado pela máquina,
> quem confirma não autoriza o pagamento, e cada passo deixa rastro verificável.

Um bingo de confraternização não precisa de tudo isso para funcionar. Precisa de tudo isso
para que ninguém, no dia seguinte, tenha motivo para duvidar.

E isso convive sem atrito com a liberdade da presidência para escolher os prêmios. As duas
coisas atuam em planos diferentes: **o que se sorteia é decisão da presidência; como se
sorteia é responsabilidade do sistema.** O sistema não opina sobre o prêmio — opina apenas
sobre garantir que o sorteio seja limpo e que o prêmio escolhido chegue a quem ganhou.
