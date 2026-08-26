# EVENTOS — arquitetura oficial do módulo

> Definida em 26/08/2026, com o usuário, aplicando o §4 do `PROMPT-MESTRE.md`
> (**as telas são os ESTADOS do processo; as ações são as transições**) e a
> regra de propriedade que o mesmo documento estabelece: cada responsabilidade
> tem um dono, e os demais módulos referenciam por id em vez de duplicar.
>
> Este documento é o alvo. **Não descreve o que está no ar** — descreve o que
> se aprovou construir. Ver `docs/PENDENTE-VERIFICACAO.md` para o que já foi
> entregue e ainda não foi testado no sistema.

## A decisão que originou este arquivo

O `PROMPT-MESTRE.md`, item 13, lista quinze coisas sob EVENTOS: Dashboard,
Calendário, Planejamento, Inscrições, Participantes, Fornecedores, Orçamento,
Convites, Credenciamento, QR Code, Sorteios, Prestação de Contas, Avaliação,
Histórico, Relatórios.

Aquilo é o **escopo do negócio** — tudo que um sindicato precisa administrar
num evento. Não é a lista de submódulos. O usuário apontou isso: *"tem
submódulos aí que não é daí"*, citando Planejamento, Fornecedores e Orçamento,
e concluiu: **"só deve ficar em Eventos o que é realmente dele"**.

Passando os quinze pela pergunta *"esse processo tem dono em outro módulo?"*,
sobram quatro.

## O que saiu, e para onde foi

| Estava em Eventos | Por quê não é de lá | Dono de verdade |
|---|---|---|
| **Fornecedores** | Buffet, som e espaço são prestadores como qualquer outro, e já existe cadastro de Prestadores. Dois cadastros da mesma entidade é o erro que o prompt mestre proíbe ao exigir entidade única. | Financeiro › Prestadores (`prestadorId`) |
| **Orçamento** | O motor de despesa já existe inteiro: solicitação → aprovação → banco → conciliação → contabilidade. Um "orçamento do evento" seria um segundo motor. | Financeiro › Despesas, com `eventoId` na despesa |
| **Prestação de Contas** | Está no item 7 do prompt mestre, dentro de Financeiro. | Financeiro › Prestação de Contas, filtrada por evento |
| **Convites** | *"Todos os módulos devem usar serviço comum para e-mail, WhatsApp, notificações, modelos, assinaturas, anexos, rastreamento, histórico e auditoria."* | Central de Comunicação. Em Eventos é **ação**, não área |
| **Planejamento** | Planejar um evento é preencher o cadastro dele. Não é área, é a ficha. | A ficha do evento |
| **Dashboard** | É o nível 2 dos três níveis de dashboard do prompt mestre. | O Painel do evento |
| **QR Code** | Mecanismo, não área. | Dentro de Credenciamento |
| **Participantes** | Mesma lista de Inscrições em outro estado. | Filtro dentro de Inscrições |
| **Agenda / Calendário** | Mesma lista de Eventos projetada no tempo — o mesmo caso de Participantes. | Modo de visualização de Eventos |
| **Histórico · Relatórios** | Transversais: todo submódulo tem o seu. | Não são submódulo em lugar nenhum |

## A árvore

### EVENTOS

#### 1 · Eventos — o cadastro

O que hoje não existe: **a entidade `evento`**. A Festa Compasso 2026 está
cravada como constante no código (`EMISSAO_CFG` em `EventosEmissao.gs`), com
data, local e 2.000 vagas fixos. Sem este submódulo o sistema não comporta um
segundo evento — nem a assembleia do ano que vem, nem nada de outro sindicato.

| | |
|---|---|
| **Telas (estados)** | Planejados · Inscrições abertas · Em andamento · Realizados · Cancelados |
| **Modos de ver** | lista · calendário (a mesma lista, outra projeção) |
| **Ações** | Criar · Editar ficha · Abrir inscrições · Encerrar inscrições · Marcar em andamento · Encerrar · Cancelar · Duplicar do ano anterior |

Abrir um evento leva ao **Painel do evento** — o dashboard do nível 2: lotação,
ritmo de chegada, filas que pedem ação e a trilha de preparo.

#### 2 · Inscrições — as pessoas do evento

Uma tela só, do começo ao fim. O estado é **coluna**, e a coluna é **botão**:
clicar abre o que dá para fazer com aquela pessoa. Decisão do usuário em
25/08: *"não poderia ser uma só? Aí vai ter um botão de status; no status você
reemite, envia, edita"*.

| | |
|---|---|
| **Telas (estados)** | A analisar · Pendentes · Validadas sem ingresso · Ingresso a enviar · Confirmados · Reprovadas · Canceladas · Lista de espera |
| **Ações** | Validar · Marcar pendência · Reprovar com motivo · Emitir ingresso · Enviar por WhatsApp · Enviar por e-mail · Reemitir · Editar dados · Cancelar · Excluir · Importar planilha · Confirmar pagamento de acompanhante |

Os estados são **fichas de filtro** sobre a mesma lista, não abas que trocam de
tela. A barra de lote é contextual: só oferece o que vale para todas as
selecionadas.

#### 3 · Credenciamento — a entrada

| | |
|---|---|
| **Telas (estados)** | Aguardando · Presentes · Ausentes · Recusados |
| **Ações** | Ler QR · Check-in manual com motivo · Reverter check-in |

O leitor roda no celular da portaria, não no computador da secretaria. O mesmo
QR lido duas vezes é recusado, dizendo quando e por quem a pessoa entrou.

#### 4 · Sorteios — o bingo

| | |
|---|---|
| **Telas (estados)** | Rodada em preparo · Cartelas emitidas · Em sorteio · Encerrada |
| **Ações** | Configurar rodada · Gerar cartelas · Sortear · Conferir quem bateu · Encerrar |

### Dentro de cada evento, abas que LEEM dos donos

Não são submódulos e não guardam dado próprio — mostram o que outro módulo
registrou, filtrado por `eventoId`:

| Aba | Lê de | O ganho |
|---|---|---|
| Fornecedores | Financeiro › Prestadores | O prestador é cadastrado uma vez e serve a todos os eventos |
| Custos | Financeiro › Despesas | O tesoureiro lança a despesa do buffet e ela aparece sozinha aqui |
| Convites | Central de Comunicação | Um só rastreamento de envio no sistema inteiro |
| Prestação de contas | Financeiro | O número do evento bate com o número do sindicato |
| Avaliação | (do próprio evento) | Pesquisa pós-evento, aberta ao participante |

## O padrão de emissão do ingresso segue o do ofício

O ofício é o único fluxo maduro do sistema e está em uso diário. O ingresso
copia a ordem dele (`Oficios.gs`, `FilaOficios.gs`, `OficiosScripts.html`):

1. número + código de verificação antes de tudo, com trava;
2. **duplicidade avisa e deixa confirmar** — não bloqueia, e avisa **na hora
   de emitir**, não como filtro para alguém lembrar de olhar depois;
3. monta o documento e converte em PDF;
4. salva na pasta do evento, com nome que se explica sozinho e sem acento;
5. **não envia: entra numa fila com status próprio** (`PENDENTE / ENVIADO /
   FALHA`). Gerar e enviar são dois atos;
6. devolve `{numero, codigo, url, filaId, status}` para a tela;
7. painel pós-emissão com Abrir · Baixar · Imprimir · Enviar · WhatsApp, e uma
   linha de status que muda quando o envio confirma ou falha;
8. modal conferindo o que vai antes de enviar;
9. rota pública de verificação para quem recebe.

O item 5 é o que hoje falta no ingresso, e é ele que permite a coluna
"Situação" dizer *"e-mail voltou: caixa inexistente"* — sem fila com status
gravado, essa informação não existe em lugar nenhum.

## Os desenhos

`design/` — as telas medidas nos valores reais do design system, aprovadas
pelo usuário em 25/08/2026.
