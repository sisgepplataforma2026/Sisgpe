# PENDENTE DE VERIFICAÇÃO EM AMBIENTE REAL

> Lista do que está **"não testado"** pela REGRA Nº -1 e depende de alguém
> executar no sistema no ar. Não é lista de bug nem de tarefa: é o que foi
> entregue e ainda **não pode ser chamado de pronto**.
>
> Regra de uso: o Claude relê este arquivo no começo de cada sessão e cobra
> o que estiver aberto. Item só sai daqui com o usuário dizendo que rodou —
> nunca por dedução, nunca por "deve estar funcionando".

---

## ✅ VERIFICADO NO AR

### Isolamento de ambiente — RODOU em 21/08/2026, 22:10

`diagnosticoAmbienteRecursos_()` e `diagnosticoPoliticaArquivo_()` executados
pelo usuário no editor do Apps Script da HOMOLOGAÇÃO. Saída:

```
Script Property SISGEP_AMBIENTE : "homologacao"
Planilha em uso                 : 1OGtjry...  (homologação, não produção)
COMPROVANTES        1COhM0dIacpViZPajSrTuPA9Mfwq6Xkta   ✅ ok
RECIBOS             1tc21Wyl4ulIxEqlXpH6LtCKnjOwssnjr   ✅ ok
RELATORIOS          1dIl0eav3fXD_eh_u9y-jnYquQ4UgGbQS   ✅ ok
VOUCHER_DOCUMENTOS  1sNj2mcvuS8Cl7nojHMmdlIFyVZProPDu   ✅ ok
Política            PRIVATE / NONE
```

**O que isto prova:** a resolução por ambiente funciona contra o
PropertiesService real, e as quatro pastas apontam para homologação. A
contaminação do Drive de produção está fechada na origem.

**A trava não disparou** — e esse é o resultado certo. Se alguma pasta ainda
resolvesse para produção, viria `❌ APONTA PARA PRODUÇÃO` e a gravação estaria
bloqueada.

**O que isto NÃO prova**, e segue pendente:

| | |
|---|---|
| 🟡 gravar um arquivo e ele cair na pasta de homologação | emitir um Comprovante ou Recibo |
| 🟡 `setSharing` aplicar PRIVATE num arquivo real | conferir o arquivo gerado no Drive |
| 🟡 `lixeiraMover_` mover uma linha de fato | excluir um cadastro de teste |
| 🟡 o teto recusar lote acima de 50 | tentar excluir 51 escolas |

`diagnosticoLixeira_()` respondeu "nenhuma aba de lixeira criada ainda" — o
esperado: a aba só nasce na primeira exclusão. Limite por lote confirmado: 50.

## 📌 O QUE ESTÁ ABERTO — índice

> Gerado em 31/08/2026. São **39 itens**  (o 21 e o 46 fecharam em 01/09). A lista completa, com o detalhe de
> cada um, está na seção ABERTO logo abaixo — este índice existe só para não
> ser preciso ler 2.000 linhas para saber o que cobrar.

| Nº | Item |
|---|---|
| 49 | Ofícios — "Outlook" confirmava recebimento; 144/236/242 a reprocessar |
| 48 | Gmail — homologação lê a caixa de e-mail da PRODUÇÃO |
| 47 | Módulo 03 (Ofícios) — NÃO auditado; um fio puxado, o resto aberto |
| 45 | Firebase — homologação e produção compartilham o MESMO Firestore |
| 44 | Firebase — a chave privada está malformada nos DOIS ambientes |
| 43 | Sessões — o gatilho diário de limpeza (instalado em 31/08, 20:47) |
| 42 | Tela genérica da Lixeira  ·  *(era 29 — o número estava repetido três vezes)* |
| 41 | Bingo Online — nunca rodou em lugar nenhum  ·  *(era 29 — o número estava repetido três vezes)* |
| 40 | Eventos — o painel executivo diz "sem dados do evento" (é o item 33) |
| 36 | Início — correção do Módulo 01 (parcialmente VERIFICADA em 31/08) |
| 35 | Taxa assistencial e Documentos — três dias de trabalho sem registro aqui |
| 34 | Compasso — importação de planilha e o diálogo do sistema |
| 33 | Eventos — a entidade passou a mandar (Fase 1) |
| 32 | Compasso — a inscrição pública e a entrega do ingresso |
| 31 | Compasso — pagamento do acompanhante (botão novo) |
| 30 | Compasso da Vida 2026 — a trava de sessão mudou 35 assinaturas |
| 27 | Isolamento das pastas do Drive entre produção e homologação |
| 26 | Voucher — o registro diz em face de quem, e o relatório de duplicidade |
| 25 | Voucher — corrigir o período que faltou |
| 24 | Voucher — vários beneficiários num pedido só |
| 23 | Voucher — as regras de quantidade, corrigidas |
| 22 | Voucher — o papel timbrado, a redação e o período obrigatório |
| 20 | Layout — painel sob demanda, chips e menu recolhível |
| 18 | Voucher — um por pessoa, por curso, por período (+ data do envio nas observações) |
| 17 | Voucher — o reparo do cabeçalho de `Voucher_Solicitacoes` |
| 16 | Voucher — o envio do certificado (e-mail, WhatsApp e trilha) |
| 15 | Escolas Fase 4 — os vínculos passam a guardar escolaId |
| 13 | Escolas — a padronização de formato (Etapa C) |
| 12 | Escolas — o saneamento da base |
| 11 | Escolas — a migração de identidade sobre a base real |
| 10 | Relatórios — o CSV e a leitura em produção |
| 9 | LGPD — inventário e prazo do titular |
| 8 | Incidentes — confirmar o prazo com o jurídico |
| 7 | Compartilhamentos — revogar no navegador |
| 6 | Exportações — o arquivo gerado |
| 5 | Retenção e Descarte — o gatilho de verdade |
| 4 | Dashboard de Auditoria — o clique nos cards |
| 3 | Telas que podem estar em branco no menu |
| 2 | Firestore — gravação real |

**Numeração:** o nº 29 estava usado três vezes. Os dois abertos viraram 41 e
42; o 29 ficou com o de RECIBOS, que é o alvo da única referência cruzada do
arquivo. Nenhum texto foi alterado — só o número no título.

## 🔴 ABERTO

### 56. ✅ FRENTE A DO MÓDULO 03 — COMPLETA (01/09/2026)

**As 45 funções públicas do Módulo 03 têm teste. Nenhuma ficou de fora.**

Medido, não estimado: varredura de todas as `function nome(` sem `_` final nos
12 arquivos do módulo, cruzada com todos os `tests/e2e/*.js`.

| | |
|---|---|
| Funções públicas do módulo | **45** |
| Sem teste nenhum | **0** |
| Teto de exposição | 224 → **204** |
| Suíte | 135 arquivos, 4.696 asserções, verde |
| Homologação | **versão 90**, publicada 01/09 às 18:53 |

**AS NOVE RODADAS, e o que cada uma achou:**

| # | O que fechou |
|---|---|
| 1 | 5 gatilhos de monitoramento criavam e apagavam acionador sem porta |
| 2 | 9 funções devolviam dado de escola sem checagem — a pior, `buscarEscolasParaOficio`, entregava razão social, CNPJ e e-mails de até 60 escolas por chamada, sem token |
| 3 | 8 eram endpoint por acidente — `getTemplateConteudo` lia **qualquer** Google Doc por ID |
| 4 | 2 **escreviam** sem porta: uma queimava número da numeração oficial, a outra forjava entrada no log de auditoria |
| 5 | painel de status e conserto do e-mail da escola (item 52) |
| 6 | a ponte ficha→ofício (item 54) |
| 7 | **a regressão que eu causei no mesmo dia** (item 53) e mais 8 chamadas sem token, anteriores |
| 8 | ofício fiscal de despesas (item 55) |
| 9 | a trava que impede um teste de rodar em produção |

**O QUE FICA ABERTO, e é tudo decisão sua** — itens 52, 54 e 55: qual módulo
guarda o conserto do e-mail da escola; a tela que falta para
`reemitirOficioFicha`; a coluna `OBSERVACOES_OFICIO`; e se o ofício fiscal
deve ir anexado, citado, ou consumir numeração própria.

**O QUE FICA ABERTO E NÃO É DECISÃO — precisa de mão na produção:** os itens
49 (reprocessar 144/236/242), 50, 51, 53 e 55 listam cada um o que conferir
no ar. Nada disso se prova aqui.

**E O QUE ESTE FECHAMENTO NÃO SIGNIFICA.** Cobertura não é correção. "Todas
as funções têm teste" quer dizer que cada uma foi executada ao menos uma vez
e que a porta dela foi provada — não que o módulo esteja certo. O que se
prova rodando de verdade, com PDF, e-mail entregue e gatilho agendado,
continua "não testado" e está listado nos itens acima.

### 55. Ofício fiscal — existe para o sindicato e não existe para a contabilidade

Oitava rodada da frente A, 01/09/2026, ao cobrir com teste (`t131`, 26
asserções) as duas últimas funções do Módulo 03 que estavam sem teste nenhum.
**Não corrigi — é desenho, e a decisão é sua.**

**O QUE ACONTECE HOJE.** `enviarLoteDespesasComOficio` faz tudo isto, e está
certo em cada passo isolado:

1. consome um número da numeração **oficial** de ofícios — a mesma dos ofícios
   de filiação, **não existe sequência paralela**;
2. gera o documento do ofício e salva no Drive;
3. registra o ofício na aba Controle do sindicato;
4. manda o e-mail à contabilidade com a tabela de despesas e as notas fiscais
   anexadas.

**O QUE FALTA.** O e-mail que chega à contabilidade **não cita o número do
ofício em lugar nenhum** e **não leva o documento do ofício anexado**.

Do lado do sindicato o ofício 0NN/AAAA existe, está no Controle e gastou um
número. Do lado de quem recebeu, ele nunca existiu.

**Provado no código, não só na execução:**

- `montarHtmlEnvioContabilidadeDesp_` (`Despesas.gs:2965`) recebe
  `(despesas, totalValor, emailRemetente)` — o número do ofício **não está
  entre os argumentos**, então não há como aparecer no corpo;
- o blob do ofício é criado logo acima do envio e **nunca entra em
  `blobsAnexo`**, que é o que vai anexado.

**É a mesma forma do defeito do reenvio** que você relatou hoje: levava o
ofício e deixava a carta.

**AS TRÊS DECISÕES**, e são suas:

| | Pergunta |
|---|---|
| 1 | O documento do ofício **deve ir anexado** ao e-mail da contabilidade? |
| 2 | O **número** deve constar no corpo, para a contabilidade poder referenciar? |
| 3 | Essa operação deveria mesmo **consumir a numeração oficial** de ofícios, ou merece sequência própria? |

A terceira é a que mais pesa: hoje, cada lote de despesa enviado avança o
mesmo contador dos ofícios de filiação e desfiliação.

**O que o t131 provou de bom, e que estava sem teste:**

- **o rename de hoje não quebrou nada** — `gerarProximoNumeroOficioFiscal_` só
  chama `gerarProximoNumeroSeguro_`, que ficou privada na quinta rodada; roda,
  devolve `NNN/AAAA`, e o envio completo funciona. **Esta era a verificação
  nº 2 do item 51**, e passou;
- a **prévia não gasta número** — duas prévias seguidas não escrevem linha
  nenhuma no Controle. Número gasto não volta, então isso importa;
- id inexistente é recusado, em vez de gerar um ofício fiscal com lote vazio;
- o total soma certo e os dois documentos fiscais vão anexados.

### 54. Ficha → Ofício — dois achados de desenho, os dois para o usuário decidir

Sétima rodada da frente A, 01/09/2026, ao cobrir com teste (`t129`, 35
asserções) a ponte entre a Sindicalização e os Ofícios. **Nenhum dos dois é
bug que eu deva corrigir sozinho** — os dois são política de desenho.

#### 54.1 · O sistema manda apertar um botão que não existe

Quando o ofício falha depois da matrícula já emitida, a mensagem diz:
*"Use 'Reemitir ofício' depois de verificar o arquivo."*

`reemitirOficioFicha` **existe, tem porta e funciona** — o t129 gera uma
reemissão de verdade, com número próprio (não reaproveita o do primeiro). Mas
**nenhuma tela a chama**. Os cinco passos da REGRA Nº 1 foram rodados:
cabeçalho, `Code.gs` e rotas, gatilhos, `git log`, grep no projeto inteiro.
Todos deram "sem chamador".

Ou seja: no momento exato em que o sistema instrui a pessoa a apertar um
botão, o botão não existe. A ficha fica MATRICULADA sem ofício, e não há
caminho pela interface.

Não é código morto — é o contrário: **código vivo sem porta de entrada**.
Por isso fica, está coberto por teste, e o que falta é a tela. Tela se desenha
antes de implementar (REGRA Nº 0.5), então: **quer que eu desenhe?**

#### 54.2 · Aprovar uma ficha exige DOIS módulos

Quem aprova ficha está fazendo trabalho de **Sindicalização**; o ofício é
efeito colateral que o sistema gera por ela. Mas `gerarOficioWeb` pede
**Documentos**. Sem os dois módulos, a pessoa **emite a matrícula e não
comunica a escola** — e o retorno avisa que ficou parcial.

É o mesmo formato do item 52 (o e-mail da escola atrás de outro módulo). Duas
decisões da mesma família, e as duas são suas.

Antes de hoje isso vinha ainda pior: sem o token descendo (item 53), a recusa
aparecia como **"Sessão inválida ou expirada"** — erro que manda a pessoa
fazer login de novo para um problema que login nenhum resolve. Agora a
mensagem nomeia o módulo que falta.

#### 54.3 · O vínculo entre a ficha e o ofício se perde sem erro nenhum

`aprovarEEncaminharFicha` grava `OBSERVACOES_OFICIO` na ficha, com o número do
ofício. Só que **a coluna não existe** no esquema que o
`configurarAbaSindicalizacao` cria — e o `sindAdm_gravar_` **não lança erro**
quando o campo não tem coluna: descarta em silêncio. O `catch` marcado como
"campo opcional" nunca dispara, porque não há o que capturar.

Resultado: depois de aprovada, **não há como saber qual ofício comunicou qual
filiação**.

**Não corrigi, e o motivo é a REGRA Nº 1:** acrescentar coluna é mudança de
esquema numa aba com dado real, e o `configurarAbaSindicalizacao`
**reescreve a linha 1 inteira** — se a planilha de produção tiver colunas
além da lista, rodá-lo sobrescreveria o cabeçalho delas.

**O que preciso de você:** a aba de fichas da produção tem a coluna
`OBSERVACOES_OFICIO`? Se tiver, o defeito é só do esquema que o código cria e
a correção é trivial. Se não tiver, é preciso decidir como acrescentá-la sem
passar pelo `configurarAbaSindicalizacao`.

### 53. 🚨 REGRESSÃO MINHA, DO MESMO DIA — ofício com ficha anexada parou de funcionar

**Corrigida no repositório em 01/09/2026, no mesmo dia em que a causei.
Nunca chegou a produção. Falta confirmar em homologação.**

Registro aqui porque errar sem registrar é o que faz o erro voltar.

**O QUE EU FIZ DE ERRADO.** Ao fechar as funções abertas do Módulo 03, pus
porta de módulo no `processarFichasParaOficio`. Atualizei os chamadores das
**telas** e não vi um chamador interno, em `.gs`: o `gerarOficioWebComFichas`
(`OficioService.gs`) chamava `processarFichasParaOficio(dados.fichas)` sem
passar token.

**O ESTRAGO.** Todo ofício com ficha anexada passaria a morrer lá dentro, com
"Sessão inválida" engolido pelo `catch` e devolvido como `{erro: true}`. É o
caminho do **ofício de filiação com a ficha assinada** — a operação viva.
A porta que pus para proteger o dado quebrava o uso legítimo.

**POR QUE PASSOU DESPERCEBIDO.** A suíte ficou **verde**. Nenhum teste
exercitava esse caminho, e o `catch` virava a exceção em `{erro: true}`, que
ninguém checava. É a assinatura do defeito que este projeto mais encontra: o
sistema para de funcionar sem que nada dê erro à vista.

**A TRAVA QUE FICOU** (`t130`, 10 asserções), e ela é o que importa daqui:

1. uma **varredura** de todo `.gs` procurando chamada de função com porta,
   feita de outro `.gs`, sem passar token — pega a classe inteira do erro,
   não só este caso;
2. um **teste de comportamento** que gera um ofício com ficha e confere que a
   fila recebe **dois** anexos (o ofício e a ficha). Um só significaria a
   ficha descartada no caminho — a mesma forma do defeito do reenvio, que
   levava o ofício e deixava a carta.

Verifiquei que a trava pega: reintroduzi a regressão e os dois passos ficaram
vermelhos; desfeita, verdes.

**E MAIS OITO CHAMADAS SEM TOKEN, ESSAS ANTERIORES A HOJE.** A varredura achou
o resto da família, e nenhuma tinha teste:

| Onde | O que estava quebrado |
|---|---|
| `SindicalizacaoOficio.gs` (3) | `previewOficioFiliacao`, `aprovarEEncaminharFicha` e `reemitirOficioFicha` **nunca** geraram ofício — o token não descia para `gerarOficioWeb`/`previewOficioWeb` |
| `IA_DocumentosSindicalizacao.gs` (4) | desfiliação e oposição à taxa negocial, mesma coisa |
| `IACore.gs`, `IA_Oficios.gs` (2) | a IA analisava a escola **sem** o histórico de ofícios dela, e sem avisar que faltou |

Todas corrigidas. Uma exceção fica **declarada com motivo** no t130:
`CentralEmailIA.gs` chama de dentro de um helper privado cujos chamadores são
legados sem token; ali a chamada degrada com aviso visível, e dar token às
legadas é mudança maior que esta rodada carrega.

**O QUE FALTA VERIFICAR NO AR:**

1. **emitir um ofício de filiação com a ficha anexada** — é o caminho que eu
   quebrei e consertei; se algo escapou, é aqui que aparece;
2. a **desfiliação por carta analisada pela IA** e a **oposição à taxa
   negocial** — os outros quatro chamadores corrigidos;
3. a **análise de escola pela IA** — deve passar a trazer o histórico de
   ofícios, que antes vinha vazio em silêncio.

### 52. Ofícios — quem trabalha DOCUMENTOS não consegue consertar o e-mail da escola

Achado da sexta rodada da frente A, 01/09/2026, ao cobrir com teste
(`t128`, 25 asserções) as três funções do caminho que a Marcela percorre
quando uma escola reclama que não recebeu o ofício.

**NÃO É BUG — é decisão de desenho, e é do usuário.** Está aqui porque só ele
decide, e porque encosta direto no problema que o sindicato está vivendo.

**O QUE ACONTECE.** O caminho de quem vai atrás de um ofício que não chegou é:

1. abre o painel de status (`listarStatusOficios`) — pede módulo **Documentos**;
2. vê que o ofício voltou por e-mail errado;
3. corrige o e-mail no cadastro (`atualizarEmailEscola`) — pede módulo
   **Sindicalização**;
4. marca o ofício para reprocessar (`atualizarStatusOficio`) — **Documentos**.

O passo 3 está atrás de outra permissão. Quem só tem Documentos vê o
problema, sabe o conserto, e não consegue aplicar: depende de outra pessoa.

**AS TRÊS OPÇÕES**, e a escolha é do usuário:

| | O que muda |
|---|---|
| **Deixar como está** | quem trabalha ofícios pede a correção a quem tem Sindicalização |
| Dar Sindicalização a quem trabalha ofícios | resolve, mas abre o resto do módulo junto |
| Aceitar os dois módulos na função | `atualizarEmailEscola` passaria a aceitar Documentos **ou** Sindicalização; é mudança de uma linha, e não abre nada além do e-mail da escola |

**O que o t128 provou de passagem** (e que estava sem teste nenhum até hoje):

- o painel funde Controle e Fila **sem duplicar** o ofício que está nos dois,
  e o status que prevalece é o da **Fila** — que é quem envia de verdade;
- `atualizarStatusOficio` grava nas **duas** abas, recusa status inventado,
  recusa número inexistente sem criar linha, e registra no log de auditoria;
- `atualizarEmailEscola` grava nas **duas** colunas (principal e todos),
  aceita CNPJ com máscara, e o e-mail errado não sobra em coluna nenhuma.

**Continua não testado:** se o ofício reenviado depois da correção **chega**
na caixa da escola. É a pergunta que originou tudo isto e só a produção
responde — o emulador registra o e-mail, não entrega.

### 51. Ofícios — duas funções ESCREVIAM sem porta nenhuma (fechadas em 01/09)

Quinta rodada da frente A do Módulo 03, 01/09/2026. Fechado no repositório
(`t127`, 43 asserções); **falta confirmar no ar que nada quebrou**.

A rodada anterior (item 50) fechou as que **liam**. Esta fecha as que
**escrevem** — e a diferença importa: dado lido indevidamente é vazamento, mas
dado escrito indevidamente é registro oficial corrompido, que ninguém tem de
onde recuperar.

**AS DUAS QUE ESCREVIAM.**

| Função | O que um anônimo conseguia |
|---|---|
| `gerarProximoNumeroSeguro` | **queimava um número da sequência oficial de ofícios a cada chamada.** Em laço, abriria buracos na numeração — e numeração de ofício com buraco é problema de auditoria do sindicato. Número gasto não volta. |
| `registrarLogSistema` | **forjava entrada no LOG_SISTEMA**: usuário, número, tipo, escola, CNPJ, e-mail, tudo do jeito que o chamador mandasse. O log que registra quem fez o quê aceitava qualquer versão da história. |

Mais três que só liam e não tinham chamador em tela viraram privadas:
`preverProximoNumeroOficio`, `verificarCodigoPublico` e `montarEmailHTML`. A do
meio era a mais notável — uma **segunda porta** para o mesmo dado que a rota
pública `validarPublico` já serve com propósito.

**O QUE A RENOMEAÇÃO QUASE QUEBROU EM SILÊNCIO.** São 14 chamadas em 6
arquivos, e dois deles guardam os nomes como **string** para conferir se a
função existe (`OficiosDiagnostico.gs` e `Reservaparquechina.gs`). String não é
alcançada por renomeação de identificador — o sintoma seria um diagnóstico
dizendo "função não encontrada" sobre função que está lá, apontando para o
lugar errado. O t127 confere as strings explicitamente.

**TRÊS QUE FICAM ABERTAS, DE PROPÓSITO E COM A DECISÃO ESCRITA.**
`processarFilaEnvioOficios`, `verificarConfirmacoesRecebimento` e
`verificarFalhasEntregaOficios` continuam públicas e sem porta. São handlers de
gatilho: o Apps Script chama **pelo nome**, então privadas não podem ser. E a
porta dupla é o remédio errado aqui — o `exigirAdminOuSessao_` identifica quem
executa por `Session.getActiveUser().getEmail()`, que num gatilho por tempo
**pode voltar vazio**; quando volta, a porta recusa e **o gatilho para**. Parar
esse gatilho para a emissão de ofício, que é a única operação viva.

O que se ganharia fechando é pouco: as três devolvem contadores, nenhuma
devolve nome de escola ou e-mail. A decisão está escrita nos dois arquivos e
anotada no teto de exposição — **não é aprovação, é registro**, e reabre se
aparecer jeito confiável de identificar contexto de gatilho.

**O QUE FALTA VERIFICAR NO AR** (depois de publicar em homologação):

1. **emitir um ofício de ponta a ponta** — é o caminho que usa
   `gerarProximoNumeroSeguro_` e `registrarLogSistema_`, os dois renomeados;
   se um chamador tivesse escapado, é aqui que apareceria;
2. **a taxa assistencial** e o **ofício de despesa fiscal** — os outros dois
   caminhos que consomem número de ofício;
3. **a autorização do Parque do China** — usa os dois nomes renomeados,
   inclusive na conferência de dependências, que passaria a dizer "faltando"
   se uma string tivesse ficado para trás;
4. a **validação pública pelo código** (a escola confere o ofício) — a rota
   continua aberta de propósito, e tem que continuar respondendo.

**Teto de exposição: 208 → 204.**

### 50. Ofícios — oito funções eram endpoint por acidente (fechadas em 01/09)

Quarta rodada da frente A do Módulo 03, 01/09/2026. Fechado no repositório
(`t126`, 24 asserções); **falta confirmar no ar que nada quebrou**.

**O QUE ERA.** No Apps Script, toda função global é endpoint de
`google.script.run` para qualquer página do projeto — inclusive as 14 páginas
anônimas que o `Code.gs` serve. Sobraram oito funções públicas que nenhuma
tela chama: são helpers internos, públicas por descuido e não por desenho.

**A PIOR.** `getTemplateConteudo(templateId)` abria QUALQUER Google Doc por ID
e devolvia o texto inteiro. A conta que roda o script tem acesso ao Drive do
sindicato — então era leitura de documento arbitrário para quem soubesse um
ID. Pior que o cadastro de escolas da rodada anterior, porque não se limita a
um cadastro: alcança qualquer documento. Agora exige o módulo Documentos.

**TRÊS TRATAMENTOS, e a diferença é o ponto:**

| Tratamento | Funções | Por quê |
|---|---|---|
| Porta de módulo | `getTemplateConteudo` | lê dado; quem lê precisa ter o módulo |
| Porta dupla | `sincronizarStatusOficiosEnviados`, `invalidarCacheTemplatesOficios` | rodam do EDITOR, onde não existe token; fechar só com token tiraria o único jeito de usá-las |
| Privadas | `gerarPDFOficio_`, `gerarPDFOficioLivre_`, `gerarPDFUniversal_`, `dashboardResumo_`, `dashboardGraficos_` | sem chamador; virar privada fecha a porta SEM remover código |

**O QUE NÃO PODIA QUEBRAR.** `gerarPDFUniversal` NÃO é legado — o
`TaxaAssistencial.gs` a chama em dois pontos. Renomear sem atualizar os
chamadores deixaria a taxa assistencial sem gerar PDF: trocaria um risco de
segurança por uma função quebrada. Os dois chamadores foram atualizados e o
t126 confere isso explicitamente.

**NÃO FORAM REMOVIDAS.** Os cinco passos da REGRA Nº 1 rodaram nas oito —
cabeçalho, `Code.gs` e rotas, gatilhos, `git log`, grep no projeto inteiro.
Todos deram "sem chamador". Mesmo assim ficam: a regra manda, na dúvida entre
remover e manter, manter e documentar como legado. Remoção só com pedido
explícito, em commit separado.

**O QUE FALTA VERIFICAR NO AR** (depois de publicar em homologação):

1. o painel de ofícios continua carregando os números — ele usa
   `getDashboardOficiosData`, não as duplicatas que viraram privadas;
2. a **taxa assistencial ainda gera PDF** — é o único uso vivo do
   `gerarPDFUniversal_`, e é o que quebraria se o rename tivesse escapado
   um chamador;
3. a tela de templates de ofício ainda mostra o conteúdo do modelo —
   `getTemplateConteudo` agora pede o módulo Documentos.

**Teto de exposição: 212 → 208.** Só desce; se subir, é regressão.

### 49. Ofícios — "Outlook" confirmava recebimento; 144/236/242 a reprocessar

**O achado mais grave do Módulo 03**, 01/09/2026. Corrigido no repositório
(`MonitoramentoOficios.gs`, `t122` com 28 asserções); **falta levar à produção
e reprocessar os três ofícios**.

**COMO APARECEU.** O gatilho de falhas de entrega, recém-instalado na
homologação, achou três bounces — ofícios **144, 236 e 242**, todos para o
mesmo endereço, `thalia.ferreira@faesa.br`. O mesmo verificador na PRODUÇÃO
achou **zero**. A planilha explicou: na produção o 144 estava **CONFIRMADO**.

**A CAUSA — `indexOf("ok")` casa pedaço de palavra.** Medido contra texto real:

| Texto que chegava | Confirmava? |
|---|---|
| "Enviado do meu **Outl·ok**" | ✅ por `ok` |
| "Sent from **Outl·ok** for iOS" | ✅ por `ok` |
| "Não pode ser entregue. **T·ok·en** inválido." | ✅ por `ok` |
| "Estou de férias. **Obrigado** pelo contato." | ✅ por `obrigado` |

E a busca no Gmail já era larga: procura pelo número do ofício **ou pelo nome
da escola**. Somando, qualquer conversa com a FAESA em que aparecesse a
assinatura "Outlook" confirmava o ofício.

**A CADEIA, e nenhum passo dela reclama:** o ofício sai → quica → alguma
mensagem da thread menciona a escola e traz "Outlook" → CONFIRMADO → o
verificador de bounce só olha ENVIADO e PENDENTE, e pula para sempre → a Home
mostra tudo verde.

**O ofício que mais claramente NÃO chegou era o que ficava marcado como
recebido.**

**AS TRÊS CORREÇÕES:** `ok` só como palavra inteira; remetente automático
(mailer-daemon, postmaster, no-reply) não confirma; e o verificador de bounce
volta a olhar o que foi confirmado **automaticamente** — nunca o que uma
pessoa confirmou, distinção que o próprio sistema já permite porque grava
"Confirmação localizada automaticamente no Gmail" na observação.

**"obrigado" ficou na lista de propósito** — muita gente responde "obrigado,
recebido", e tirá-lo faria o sistema deixar de reconhecer confirmação
legítima. É decisão de operação; fica registrada como escolha.

**O QUE FALTA**

1. **Levar a correção para a produção** (`MonitoramentoOficios.gs`). Só lá os
   três ofícios voltam a ser verificados.
2. **Conferir o status de 144, 236 e 242 depois disso** — devem virar
   `FALHA_ENTREGA`.
3. **Corrigir o e-mail da FAESA no cadastro** antes de reenviar, senão vira o
   quarto bounce. Três ofícios para a mesma pessoa indica contato que saiu da
   instituição.
4. **Quantos outros estão errados?** Ninguém mediu quantos ofícios foram
   confirmados por "Outlook" ao longo do tempo. A correção impede novos; os
   antigos só se descobrem reprocessando.

**CORREÇÃO DE UMA AFIRMAÇÃO MINHA:** no item 47 e no commit do `t118` eu
escrevi que "ninguém é avisado quando um ofício falha". Vale para a FILA
(`FilaOficios.gs`, ERRO_PERMANENTE — continua sem aviso), mas é **falso para
falha de entrega**: `notificarFalhasEntregaOficios_` manda e-mail para
`financeiro@sindeducacao.com` sempre que detecta bounce. Eu não tinha visto.


### 48. Gmail — homologação lê a caixa de e-mail da PRODUÇÃO

**Descoberto em 01/09/2026, 09:57**, ao instalar e rodar o gatilho de falhas de
entrega na HOMOLOGAÇÃO. A execução encontrou três bounces:

```
❌ Bounce — Ofício 144/2026 · thalia.ferreira@faesa.br
❌ Bounce — Ofício 236/2026 · thalia.ferreira@faesa.br
❌ Bounce — Ofício 242/2026 · thalia.ferreira@faesa.br
```

**São bounces REAIS.** `verificarFalhasEntregaOficios` procura por
`GmailApp.search(...)` (`MonitoramentoOficios.gs:351`) e a busca **não tem
filtro de ambiente nenhum** — ela lê a caixa da conta que executa o script, que
é a MESMA nos dois projetos. O mesmo vale para
`verificarConfirmacoesRecebimento` (`MonitoramentoOficios.gs:207`), que roda em
produção a cada 2 horas.

O isolamento validado em 21/08 cobriu planilha e pastas do Drive. O Firebase
ficou de fora (item 45) e o **Gmail também**.

**O QUE NÃO ACONTECEU — conferido, não suposto:** nenhuma das duas funções
escreve no Gmail. Sem `markRead`, sem marcador, sem mover, sem apagar. A
homologação LÊ a caixa da produção; não a estraga.

**O QUE ACONTECEU, e é o que precisa de ação:** o status `FALHA_ENTREGA` foi
gravado na planilha da HOMOLOGAÇÃO. **Na produção, os ofícios 144, 236 e 242
seguem marcados como ENVIADO** — três documentos que não chegaram à FAESA e
que o sistema de lá não sabe que falharam.

**O PADRÃO IMPORTA MAIS QUE OS TRÊS:** os três foram para o MESMO endereço,
`thalia.ferreira@faesa.br`. Não é falha aleatória — é uma caixa que não aceita
mais e-mail, provavelmente porque a pessoa saiu da instituição. Reenviar sem
corrigir o cadastro bate na mesma porta.

**O QUE FALTA**

1. **Na produção:** conferir se o gatilho `verificarFalhasEntregaOficios`
   existe em Acionadores; se não, rodar `instalarTriggerFalhasEntrega` (lá a
   função ainda não tem porta, então roda direto). Depois rodar
   `verificarFalhasEntregaOficios` à mão uma vez, para não esperar 3 h — a
   produção pode ter MAIS bounces que a homologação, porque cada ambiente
   cruza a mesma caixa com a SUA planilha.

2. **Corrigir o e-mail da FAESA** no cadastro de escolas, e só então reenviar
   pela tela (`enviarOficioDaFilaAgora`, `OficiosScripts.html:1968` — exige
   token de sessão, não roda pelo editor).

3. **Decidir sobre a fronteira**, junto do item 45: hoje a homologação lê
   e-mail real. Não corrompe nada, mas significa que testar monitoramento na
   homologação consulta a correspondência do sindicato.


### 47. Módulo 03 (Ofícios) — NÃO auditado; um fio puxado, o resto aberto

**Estado em 01/09/2026, dito sem eufemismo pela REGRA Nº -1:** o módulo foi
MAPEADO e teve UM defeito corrigido. Não foi auditado.

**O QUE FICOU PRONTO**

| | |
|---|---|
| Mapa | 22 arquivos (~460 KB), 51 funções públicas, 4 telas |
| Cobertura pré-existente | 23 arquivos de teste, **609 asserções**, todos verdes |
| Achado 1 | o ofício em ERRO_PERMANENTE sumia da Home — corrigido (`t118`, commit `dd52022`, Versão 83) |
| Ferramenta | `oficiosQueNaoChegaram` (`t119`, commit `1c9b34d`, Versão 84) |

Este módulo é o oposto dos 01 e 02: lá a cobertura era rala e por isso os
defeitos apareceram rápido. Aqui é o mais testado do sistema — o que faz
sentido, é o único em uso diário. Procurar defeito onde 609 asserções já olham
é o caminho de menor retorno.

**O QUE FALTA — três frentes, nenhuma começada**

**A · o que os 609 testes NÃO cobrem — MEDIDA em 01/09, e parcialmente
fechada.** O módulo tem **59** funções públicas (não 51 — a contagem anterior
não incluía `SindicalizacaoOficio.gs` nem as duas acrescentadas hoje).
Cruzando com todos os testes: **47 das 59 nunca são citadas pelo nome em teste
nenhum**. Os 609 asserções exercitam o módulo por dentro; os pontos de ENTRADA,
que é por onde o `google.script.run` chega, ficaram de fora.

Citar não é o mesmo que exercitar, e nem toda função precisa de teste. O `t120`
cobriu as de maior risco, e **nenhum defeito apareceu** — as travas já estavam
certas, o que faltava era o teste que impede alguém de afrouxá-las:

| Coberto agora | O que se provou |
|---|---|
| `excluirRegistroOficio`, `excluirRegistrosOficio` | exigem admin de Documentos; sem o módulo, sem token e em lote, todas recusam. E o admin continua conseguindo, sem levar o ofício vizinho junto |
| `verificarCodigoPublico` (rota sem sessão) | código errado não vaza escola, número nem link do Drive. Normaliza espaço e caixa, porque quem valida copia de um PDF impresso |
| `preverProximoNumeroOficio` | respeita a sequência RESERVADA, não só o maior da planilha — ignorar isso ofereceria um número já tomado, e ofício com número repetido sai em papel timbrado |

Força bruta na rota pública foi **descartada por medição**: o código é MD5
truncado em 12 hex (48 bits), inviável de enumerar por HTTP.

**SEGUNDA RODADA DA FRENTE A — e aqui apareceu defeito.** Cruzando as 59
públicas com as que ESCREVEM estado: treze escreviam sem porta de permissão. A
maioria com razão (gatilho roda sem usuário). **Cinco não tinham desculpa:**

`instalarTriggerConfirmacoes`, `removerTriggerConfirmacoes`,
`instalarTriggerFalhasEntrega`, `removerTriggerFalhasEntrega` e
`instalarTriggerConfirmacoesOficios` criavam e **apagavam gatilho sem pedir
nada** — sem sequer receber um token.

No Apps Script toda função global é endpoint para qualquer página do projeto,
inclusive as anônimas do `Code.gs`. Um visitante chamava
`removerTriggerConfirmacoes()` e desligava, **em silêncio**, a verificação de
confirmação de recebimento e a de falha de entrega. Desligar não dá erro: as
confirmações só param de ser registradas.

**E isso piorou com a correção da própria noite:** o `FALHA_ENTREGA` passou a
aparecer na Home (t118), e quem marca esse status é o
`verificarFalhasEntregaOficios`. Sem o gatilho, o indicador novo fica em zero
afirmando que está tudo bem.

**Não foi padrão novo:** o `instalarTriggerFilaEnvioOficios`
(`FilaOficios.gs:802`), no mesmo módulo, já usava `exigirAdminOuSessao_` com o
mesmo rótulo e o mesmo `true`. Copiou-se o vizinho. A porta é dupla porque
essas funções são rodadas do editor, onde não há token — o `t121` cobra os dois
lados, e também que nenhum `.html` as chamava (o parâmetro novo não quebra
tela).

**Superfície exposta caiu de 224 para 216**, e o teto do `t6` foi apertado para
216 — senão uma regressão até 224 passaria batida.

**Ficam sem teste 39 funções** — dashboards, relatórios e diagnósticos. Risco
menor, mas a frente A não terminou.

**B · o sintoma da produção, sem o dado.** O defeito de visibilidade foi
corrigido e o relatório existe, mas ninguém rodou `oficiosQueNaoChegaram` na
produção. **Enquanto isso não acontecer, não se sabe quantos ofícios estão
parados hoje** — e é para isso que a ferramenta foi feita. Falta também a
decisão sobre AVISO ATIVO: hoje ninguém é notificado quando um ofício morre na
fila (`FilaOficios.gs` só chama `MailApp` para consultar cota). Tornar visível
não é tornar avisado.

**C · seis das dez áreas do módulo não existem.** O PROMPT-MESTRE (módulo 5,
Documentos) lista Dashboard, Ofícios, Recibos, **Certidões**, **Modelos**,
**Assinaturas e Aprovações**, **Protocolo**, Histórico, Relatórios e
**Configurações**. Existem quatro. Não é defeito — é escopo não construído — mas
é decisão do usuário se vira trabalho.

**TRÊS COISAS VISTAS NA TELA DE ACIONADORES DA PRODUÇÃO E NÃO INVESTIGADAS**

| Gatilho | Taxa | Por que importa |
|---|---|---|
| `memoriaEvolutivaGmail` | **4,17%** | a maior taxa de erro da produção |
| `processarFilaEnvioOficios` | **0,26%** | é a rotina que manda o ofício; originou o achado 1 |
| `cob_rotinaDiariaTrigger_` | — | preso à **Versão 687**, enquanto os outros rodam o código atual. Se não for proposital, é bug consertado três vezes sem entender por que volta |

**A CONFERÊNCIA QUE FECHA O ACHADO 1:** abrir a Home da homologação (Versão 83+)
e ver o card, agora rotulado **"Ofícios não enviados"**. Se o número subir em
relação ao que se via antes, a diferença são ofícios que estavam invisíveis.


### 45. Firebase — homologação e produção compartilham o MESMO Firestore

**Confirmado em 01/09/2026, 21:10**, lendo as propriedades dos dois projetos
Apps Script. São idênticas:

| | homologação | produção |
|---|---|---|
| `FIREBASE_PROJETO` | `sisgep-plataforma` | `sisgep-plataforma` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@…` | o mesmo |

E o caminho dos documentos é `/databases/(default)/documents/`
(`FirebaseCore.gs:183`), sem prefixo de ambiente — as coleções vão pelo nome
puro (`firebaseCriar_`, `firebaseConsultar_`). **Não há separação nenhuma.**

O isolamento validado em 21/08/2026 (ver a seção VERIFICADO) cobriu a planilha
e as pastas do Drive. O Firebase ficou de fora e ninguém tinha olhado.

**O QUE SEGURA O DANO HOJE É O ITEM 44.** A chave está malformada nos dois
ambientes, então nada escreve em lugar nenhum. Um defeito está contendo o
outro. No momento em que a chave da HOMOLOGAÇÃO for corrigida, ela passa a
gravar no Firestore de PRODUÇÃO — e o `EventosFirestore.gs` registra um acesso
real marcado para 19 de dezembro.

**Por isso a ordem do conserto do item 44 é: produção primeiro, homologação
só depois desta decisão.** Consertar a produção não faz nada escrever onde não
devia; consertar a homologação, sim.

**DECISÃO PENDENTE DO USUÁRIO** — não é achado técnico a resolver sozinho:

1. Criar um projeto Firebase separado para homologação (isolamento de
   verdade; envolve custo e nova conta de serviço), ou
2. Aceitar a base compartilhada e testar Eventos sabendo disso, ou
3. Prefixar as coleções por ambiente (`hml_…`), que é o meio-termo barato e
   mexe em `FirebaseCore.gs`.

Nenhuma foi desenhada ainda — pela REGRA Nº 0.5, o desenho vem antes do
código, e o usuário ainda não escolheu o caminho.


### 44. Firebase — a chave privada está malformada NOS DOIS AMBIENTES

**Achado em 31/08/2026, 20:51**, pelo `diagnosticoPropriedades_()` — na
primeira vez que a função rodou. Não foi procurado: apareceu.

```
FIREBASE_PRIVATE_KEY = -----BE…\n",  (1734 caracteres)
```

A máscara mostra os 7 primeiros caracteres e os **4 últimos**
(`SistemaConfig.gs:806`). Os quatro últimos são `\n",` — barra, n, aspas,
vírgula.

Uma chave correta, guardada como o JSON a escreve, termina em
`-----END PRIVATE KEY-----\n`, ou seja, os quatro últimos seriam `--\n`.
Terminar em `",` significa que a cópia veio do arquivo JSON **incluindo a
aspa de fechamento e a vírgula da linha**:

```json
"private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
                                                                             ↑↑
                                                              estes dois foram junto
```

**Por que quebra:** `fb_config_` (`FirebaseCore.gs:58`) troca os `\n` literais
por quebras reais, mas não remove nada do fim. O PEM entregue ao assinador
termina com uma linha `",` depois do `-----END PRIVATE KEY-----`, e a
assinatura RSA falha. Todo o Firestore de Eventos depende disso
(`EventosFirestore.gs`, `EventosPiloto.gs`).

**Não testado:** se o Firestore está de fato fora do ar na homologação. A
leitura diz que sim; confirmar rodando `firebaseTestarConexao`
(`FirebaseCore.gs:~300`), que devolve a etapa em que falhou.

**A PRODUÇÃO TAMBÉM — confirmado em 01/09/2026.** O usuário rodou a leitura
das propriedades no projeto Apps Script de produção:

```
FIREBASE_PRIVATE_KEY = 1734 caracteres, termina em "\n","
```

Mesmo tamanho, mesmo fim. A mesma cópia errada foi colada nos dois ambientes.

**E o sistema não sabe que está quebrado.** O `fb_config_` só confere se as
três propriedades EXISTEM; não valida o PEM. Então `firebaseDisponivel_()`
(`FirebaseCore.gs:66`) responde "sim, configurado", o código entra no caminho
do Firestore e só falha na hora de assinar. Afirmação errada seguida de erro,
em vez de recusa limpa.

**Ainda não sabido:** se os dois ambientes usam o MESMO projeto Firebase. A
homologação usa `sisgep-plataforma`; os valores de `FIREBASE_PROJETO` e
`FIREBASE_CLIENT_EMAIL` da produção ainda não foram lidos. Isso decide se a
chave nova entra nos dois ou só num — colar a chave de um projeto no outro
quebraria o que hoje funciona. Os 1734 caracteres NÃO provam que é a mesma
chave: toda RSA de 2048 bits dá esse tamanho.

**A correção acontece junto da troca da chave** — que já era necessária,
porque o valor foi exposto numa conversa em 31/08. Ao colar a chave nova,
colar **só o miolo**: começa em `-----BEGIN PRIVATE KEY-----\n` e termina em
`-----END PRIVATE KEY-----\n`, sem as aspas e sem a vírgula.

**Pendente de decisão:** endurecer o `fb_config_` para descascar aspas e
vírgula sobrando, em vez de confiar na colagem. É erro previsível e silencioso
— cai na REGRA Nº 0.6. Não foi implementado porque mexe em caminho de
credencial e o usuário ainda não decidiu.


### 43. Sessões — o gatilho diário de limpeza (instalado em 31/08, 20:47)

**O que JÁ foi verificado no ar, em 31/08/2026**, pelo usuário, no editor da
homologação — e isto sai da conta de "não testado":

| Passo | Resultado |
|---|---|
| Simulação, 20:42 | 62 expiradas · 6 vivas · 0 corrompidas · **0 apagadas** |
| Execução real, 20:44 | **62 apagadas** · 6 vivas preservadas · 7 outras intactas |
| Login depois da limpeza | pediu login e **entrou** — a autenticação continua funcionando |
| Instalação do gatilho, 20:47:35 | `✅ Gatilho instalado — limpeza diária às 3h.` |

Eram 68 sessões para 6 em uso. O print anterior mostrava 46 porque a tela de
Propriedades corta em 50 — o acúmulo era maior do que dava para ver.

O pedido de login **não foi causado pela limpeza**: ela só apaga quando
`expiraEm <= agora` (`Sessao.gs:492`), e a sessão do usuário era das 14:27,
com validade de 6h (`Sessao.gs:15`) — vencida às 20:27, antes da execução.

**O QUE FALTA, e é o que se cobra:**

1. **O gatilho disparar de fato às 3h.** Só se vê no dia seguinte, em
   Acionadores → Execuções: procurar `limparSessoesExpiradasDiario` com
   status Concluído. O emulador não executa `ScriptApp.newTrigger` — está
   declarado como não testável no `t115`.

2. **A contagem que não fechou — metade RESOLVIDA às 20:51.** O
   `diagnosticoPropriedades_()` listou as 14 propriedades pelo nome. As 8
   "outras" são `ANTHROPIC_API_KEY`, `COMPASSO_QR_SECRET`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJETO`,
   `SISGEP_AMBIENTE`, `SISGEP_AUDITORIA_DRIVE` e `SISGEP_URL_BASE` — todas
   legítimas. **A oitava era a `ANTHROPIC_API_KEY`, cadastrada pelo usuário
   entre uma execução e outra.** Nada sobrando, nada de chave de login
   vazando para as Propriedades.

   **Fica aberta só a contagem de sessões: são 6, e o esperado eram 7.**
   Explicação compatível com os dados, mas não provada: uma das 6 preservadas
   venceu entre 20:44 e 20:47 e foi apagada pelo próprio `getSessaoUsuario` ao
   ser apresentada (ele apaga na validação), enquanto o login novo somava uma
   — 6 − 1 + 1 = 6, e `expiradas: 0` porque a vencida já tinha saído. Para
   fechar: imprimir `criadoEm` de cada uma das 6 e ver se há alguma das ~20:45.
   Se houver, a conta fecha e o item some. Se NÃO houver, o login não gravou a
   sessão nas Propriedades e aí existe defeito de verdade.


### 40. Eventos — o painel executivo diz "sem dados do evento" (é o item 33)

**Visto pelo usuário em 31/08, 16:32**, no Painel de Eventos. Sintomas:

| Bloco | O que mostrou |
|---|---|
| Painel | INSCRIÇÕES 0 · A ANALISAR 0 · A ENVIAR 0 · **VAGAS RESTANTES 2000** |
| Executivo | tudo `—` + "O servidor respondeu sem dados do evento." |

**NÃO é regressão do carregamento sob demanda.** Verificado: os valores
estáticos do HTML são todos `—` (`exDias`, `exTotal`, `exIngressos`, `exVagas`,
`pnAnalisar`, `pnEnviar`, `pnVagas`). A tela mostrou **0** e **2000**, que são
valores carregados — logo a inicialização rodou e as duas cargas chamaram o
servidor. Fosse falha de inicialização, estaria tudo em `—`.

**É o item 33 desta lista, agora com sintoma visível.** Aquele item já previa:
*"Gravar capacidade 300 na Festa e ver o painel do evento dizer 300, não
2.000"* — e 2.000 é exatamente a constante `EMISSAO_CFG`, usada quando o
registro do evento não traz capacidade. O painel executivo depende do mesmo
registro e, sem ele, devolve vazio.

O aviso na tela é comportamento CORRETO: `evExecutivoCarregar()` foi escrito
para nunca ficar em silêncio quando a carga não vem.

**O que falta:** conferir a aba `EVENTOS_V2` na planilha de homologação — se
ganhou a coluna `capacidade` e se o registro da Festa está preenchido. É o
item de maior risco já declarado no 33.


### 36. Início — correção do Módulo 01 (parcialmente VERIFICADA em 31/08)

**Corrigido e publicado em 31/08/2026**, commit `cca3478`, Versão 73 da
homologação, pelo workflow `deploy-homologacao.yml`. O relatório de `conferir`
mostrou zero exclusões e zero criações: só `Helpers.html` e `index.html`.

**✅ VERIFICADO NO AR pelo usuário em 31/08, 14:27** — print da Home de
homologação:

| | |
|---|---|
| A linha "📄 Ofícios" existe e recebe valor | mostrou `ATENÇÃO` (3 ofícios pendentes) |
| O caminho novo do Helpers assumiu | apareceu "Atualizado em 31/08/2026 14:27:19" — essa linha só é escrita pelo `inicioMostrarAtualizacao_()`, que NÃO existe no caminho de reserva do index |
| Os números são coerentes entre si | 0+0+3+0+4 = 7, e o selo do topo diz 7 |
| Saúde bate com o contador de cada fonte | Financeiro OK (0), Jurídico OK (0), Comunicação OK (0), Administrativo ATENÇÃO (4), Ofícios ATENÇÃO (3) — 5 de 5 |
| A URL que dava erro do Drive | era outra implantação (`AKfycbxZISHCP...`); a oficial (`AKfycbzOfoQ...`) abre normalmente |

**🟡 A latência foi observada, e agora tem cara.** Entre dois prints do mesmo
minuto, a Home saiu de tudo "—" para preenchida. O resumo chegou às 14:27:19,
atrás das outras 39 chamadas que os módulos fechados disparam sozinhos. Não é
desperdício abstrato de cota: é o painel demorando para dizer o que precisa ser
feito hoje. **Isso eleva a prioridade da correção do leque de chamadas.**

**⚠ INSTRUÇÃO ANTERIOR ESTAVA ERRADA — corrigida em 31/08/2026.**

Este item mandava *"renomear a aba de Despesas e recarregar a Home; tem de
mostrar ⚠, nunca 0"*. **Não funcionaria, e teria dado resultado enganoso.**

`obterAbaDesp_()` (Despesas.gs:212) chama `garantirAbaDespesas_()` quando não
acha a aba — e essa **cria uma nova, vazia, com cabeçalho**. O mesmo vale para
o Jurídico (`jurObterAba_`, Juridico.gs:62). As fontes se auto-curam.

Então renomear produziria: aba nova vazia criada, resumo devolvido com sucesso
e zero itens, e a Home mostrando **0** — que é justamente o que o teste queria
denunciar. Quem fizesse concluiria que a correção falhou, e ainda ficaria com
uma aba vazia sobrando na planilha ao lado da renomeada.

**🔴 O QUE FICA, então:** o caminho "fonte falhou → ⚠" está provado no
emulador (`t108`, com falha injetada) e **não tem como ser forçado com
segurança na homologação** — a resiliência do próprio sistema impede. Fica
declarado assim, e não como pendência que alguém possa tentar fechar de novo
com a instrução errada.

**✅ O QUE DÁ PARA CONFERIR, e é seguro:** o caminho de SEM ACESSO, que é
outro ramo do mesmo desenho. Entrar com um usuário que **não tenha o módulo
Financeiro** e olhar a Home: a linha "Notas fiscais aguardando envio" deve
**sumir da lista** — não aparecer com zero. Zero risco, nada a desfazer.

**✅ MEDIDO em 31/08 — para onde cada card leva.** Não precisava de
conferência no ar: o destino está no `onclick` e o handler é executável no
harness (`t108`, passo 4b). O resultado, com os cinco:

| Card | Destino |
|---|---|
| Notas fiscais aguardando envio | `financeiro` — sem filtro |
| E-mails urgentes | `comunicacao` — sem filtro |
| Ofícios pendentes de envio | `documentos` com `{sub:'oficios'}` — chega no submódulo certo |
| Processos jurídicos com prazo | `juridico` — sem filtro |
| Escolas com cadastro incompleto | `escolas` — sem filtro |

**1 de 5 leva a algo mais específico que o módulo cru.** A diretriz de
dashboards do PROMPT-MESTRE pede a FILA correspondente: clicar em "4 escolas
com cadastro incompleto" deveria abrir as 4, não o módulo Escolas inteiro.

Fica como ATENÇÃO no `t108`, e **não** foi corrigido: cada módulo de destino
precisaria aceitar o filtro por parâmetro, o que é mudança de contrato entre
telas e pede desenho aprovado (REGRA Nº 0.5).

**Relatório completo:** https://claude.ai/code/artifact/443ffe43-6a53-4104-ab3e-c18ed32de0c7

### 35. Taxa assistencial e Documentos — três dias de trabalho sem registro aqui

**Entregue entre 29 e 31/08/2026**, commits `6c489f6` a `2884a0f`. A interface
modular do fluxo de oposição à taxa, o gateway autenticado, a preservação de
progresso em parcial próprio, e quatro correções em Documentos (card de
escolas, envio sem alias institucional, controles da taxa, inclusão por ficha).

Os testes automatizados foram escritos junto (`t100` a `t106`), mas pela REGRA
Nº -1 **nada disso é "pronto"** enquanto ninguém exercer no ar. Está aqui para
ser cobrado — o detalhamento do que conferir precisa ser escrito quando o
usuário for testar.


### 34. Compasso — importação de planilha e o diálogo do sistema

**Entregue em 26/08/2026.** Quatro arquivos colados pelo usuário no mesmo
dia: `DialogoSISGEP` (**novo**), `CompassoImportacao`, `CompassoInscricoes`,
`Code`.

**Por que entrou:** o usuário anexou a planilha e nada aconteceu — regressão
minha ao fechar a Importação numa IIFE, que tirou `escolheu` e `apontar` do
alcance dos `onchange` inline. Depois, o print do `confirm()` nativo
anunciando o endereço do googleusercontent: *"Ajustar essas telas para o
padrão Sisgep"*.

**O que precisa ser exercido no ar** — nesta ordem, porque a primeira falha
esconde as outras:

1. 🔴 **O arquivo novo existe?** Se `DialogoSISGEP.html` não tiver sido
   criado no projeto, o `include()` falha em SILÊNCIO (`Code.gs:313` engole a
   exceção) e as três perguntas somem — o botão parece morto. É o primeiro
   sintoma a descartar.
2. 🔴 **Anexar a planilha abre a conferência.** Era o defeito relatado.
   Também pelo arrastar-e-soltar, que passava por outro caminho.
3. 🔴 **Importar pergunta pelo diálogo do sistema**, faixa navy, sem citar
   googleusercontent. Idem "Emitir ingressos" e "Apagar tudo" — este último
   em vermelho.
4. 🟡 **Apontar coluna manualmente** (o `rg` saiu "não encontrei" no print):
   escolher no seletor e confirmar que a escolha é aceita. É o segundo
   `onchange` que estava preso na IIFE, e o único que ainda não foi visto
   funcionando.
5. 🟡 **Um cabeçalho só.** Como aba da Central, a Importação não pode repetir
   o título de módulo embaixo de "Festa Compasso da Vida 2026".
6. ⚪ Botões com o desenho do sistema; selo HOMOLOGAÇÃO fora do vermelho de
   erro.

**Não coberto por teste automatizado, e por quê:** a decisão de esconder o
cabeçalho depende de `getElementById` achar a Central numa página montada
pelo `include()` real — o harness resolve include desde hoje, mas não aplica
CSS, então "aparece/não aparece" continua só verificável no navegador.

### 33. Eventos — a entidade passou a mandar (Fase 1)

**Entregue em 26/08/2026.** Oito `.gs` colados pelo usuário no mesmo dia:
`EventosEmissao`, `EventosDominioV2`, `EventosRepositoryV2`,
`EventosControllerV2`, `EventosValidacao`, `EventosInscricoesV2`,
`EventosInscricaoPublica`, `EventosExecutivo`. Nenhum `.html`.

**O que mudou:** data e lotação deixaram de sair da constante `EMISSAO_CFG` e
passaram a vir do registro do evento (`compasso_dataEvento_` e
`compasso_limiteVagas_`). `capacidade` entrou na entidade. Dois endpoints
novos, ainda sem tela: `eventosV2Admin_listarEventos` e
`eventosV2Admin_criarEvento`.

**O que o emulador já provou** (t96, 16 asserções, 3 mutações mortas): o
registro vence a constante na data, na lotação, no contador de emissão, na
reserva de vaga e no resumo de validação.

**O que só o sistema no ar pode dizer:**

| | Como conferir |
|---|---|
| A tela de Informações da Festa continua salvando | Abrir Programação › Dados da Festa 2026, alterar um campo, salvar, recarregar |
| A migração da aba `EVENTOS_V2` funcionou | A aba ganhou a coluna `capacidade` no fim, sem perder linha. **Este é o item de maior risco:** se a aba já existia, o código acrescenta a coluna na primeira gravação |
| A lotação corrigida chega no painel | Gravar capacidade 300 na Festa e ver o painel do evento dizer 300, não 2.000 |
| A data corrigida chega no e-mail | Mudar a data, fazer uma inscrição de teste e conferir a data no e-mail de confirmação |
| Nada quebrou na emissão | Emitir um ingresso de teste e ver o número sair na sequência |

**Risco declarado:** o campo `capacidade` ainda **não tem onde ser preenchido**
— a tela de Informações não o mostra. Até a Fase 2, ele só existe se alguém
escrever na planilha à mão. Enquanto estiver vazio, o sistema usa a constante,
que é o comportamento de antes.

---

### 32. Compasso — a inscrição pública e a entrega do ingresso
**Aberto em:** 21/08/2026 · `EventosInscricaoPublica.gs`, `EventosEntrega.gs`,
`CompassoInscricaoPublica.html`, rotas novas no `Code.gs`

Fecha os dois buracos maiores do módulo: **não havia tela de inscrição** e o
**ingresso nunca chegava** ao associado.

**Os dois links novos** (pegue-os rodando `diagnosticoInscricaoCompasso_` no
editor — ele imprime a URL certa do ambiente):

- inscrição: `…/exec?page=compasso-inscricao` ← é o que vai na lista de
  transmissão e no site
- ingresso: `…/exec?page=ingresso&t=<token>` ← é o que vai no e-mail e no
  WhatsApp, gerado pelo sistema

Roteiro, na ordem que expõe problema mais rápido:

1. **Abrir o link de inscrição numa aba anônima.** Tem de carregar sem login.
2. **Digitar um CPF que está na base.** Nome, escola e cidade nascem
   preenchidos; e-mail e WhatsApp aparecem **mascarados** (`m••••a@gmail.com`)
   — isso é proposital, para o link público não virar porta de colheita da
   base. **Deixar como está** e enviar.
3. **Conferir no Firestore/tela de validação que o e-mail gravado é o REAL**,
   não a máscara. É a parte mais fácil de dar errado.
4. **Tentar inscrever o mesmo CPF de novo** — tem de recusar.
5. **Digitar um CPF fora da base** — tem de abrir em branco e aceitar, não
   recusar.
6. **Validar a inscrição** na Central e **emitir o ingresso**.
7. **Enviar por e-mail.** Abrir a caixa: tem de chegar com o botão do link
   **e o PDF anexo**.
8. 🔴 **ABRIR O PDF E LER O QR COM O CELULAR.** É o ponto mais provável de
   falha de toda esta entrega — o template da tela gera o QR por script de
   CDN, que não roda na conversão para PDF. Fiz um caminho separado que
   embute o QR como imagem, mas isso só se prova lendo.
9. **Abrir o link do ingresso numa aba anônima** — tem de mostrar, e **não**
   pode marcar check-in.
10. **Ler o QR na portaria.** Depois ler de novo: tem de recusar.
11. **Enviar por WhatsApp** — abre o `wa.me` com o texto pronto; você aperta
    enviar e depois confirma na tela.
12. **Lote:** selecionar alguns e enviar. Conferir a mensagem de cota.

Cobertura: `t78` (33 asserções, 9 mutações) e `t79` (40 asserções, 10
mutações). A tabela-verdade do token e a trava de duplicidade são
**executadas**, não lidas.

---

### 31. Compasso — pagamento do acompanhante (botão novo)
**Aberto em:** 21/08/2026 · `EventosPagamento.gs`, `EventosValidacaoAdmin.html`

Fechou um beco sem saída: a emissão V2 exigia `pagamentoStatus === 'PAGO'` e
**ninguém no projeto escrevia PAGO** — acompanhante nunca conseguiria ingresso.
Agora a Central de Validação tem o bloco de pagamento (Pix / Cartão), e a
confirmação lança a receita no Financeiro.

Roteiro:

1. Abrir uma inscrição de **acompanhante** na Central. O bloco 💳 tem de
   aparecer, com o valor já preenchido (R$ 500) e a origem escrita embaixo.
2. Abrir uma de **associado**. O bloco NÃO pode aparecer.
3. Confirmar com Pix. Conferir a mensagem: ela diz se a receita foi lançada
   no Financeiro **ou o motivo de não ter sido** — quem valida tem o módulo
   "eventos" e o `cadastrarReceita` exige "financeiro", então é bem possível
   que recuse. Se recusar, a mensagem manda lançar à mão; é o esperado, não
   um bug. **Anotar o que apareceu.**
4. Abrir a Central Financeira › Receitas e ver se o lançamento está lá.
5. Tentar confirmar de novo o mesmo pagamento — tem de recusar.
6. Emitir o ingresso desse acompanhante. Antes recusava sempre; agora tem de
   passar.
7. Estornar (precisa de ADMIN, e pede motivo). Depois de emitido o ingresso,
   o estorno tem de RECUSAR.

Cobertura: `t77` — 23 asserções, 9 mutações mortas.

---

### 30. Compasso da Vida 2026 — a trava de sessão mudou 35 assinaturas
**Aberto em:** 21/08/2026 · `Eventos*.gs`, `EventosPortaria.html`, `EventosValidacaoAdmin.html`

A análise do módulo de festas achou **32 funções do Compasso alcançáveis por
`google.script.run` sem trava nenhuma** — entre elas `compasso_regenerarQrToken`,
que devolve o QR válido em texto claro, e `emissao_limparTestes`, que zera o
contador das 2.000 vagas. Todas ganharam `exigirAdminOuSessao_` hoje.

O `t76` cobre isso com 14 asserções e 7 mutações mortas, e o `t6` mediu a
melhora **chamando** as funções sem token: a superfície anônima caiu de **230
para 221**. Isso prova que a trava recusa. **Não prova que as telas continuam
funcionando** — e é essa a pendência.

Roteiro para fechar, na ordem:

1. **Central de Validação** (planilha › diálogo): abrir. Se a lista carregar,
   a porta dupla está aceitando a conta Google. Se der "Sessão inválida",
   o e-mail da conta não está como ADMINISTRADOR ATIVO na aba de usuários.
2. **Aprovar e reprovar** uma inscrição. Ao reprovar, conferir que a vaga volta.
3. **Portaria** (diálogo, no celular): ler um QR. Depois ler o MESMO QR de novo
   — tem de recusar com "Ingresso já utilizado".
4. **Busca manual** na portaria e check-in manual com motivo — é a contingência
   de celular descarregado.
5. **Emissão** (`?painel=emissao`, com sessão): buscar associado e emitir.
   A busca agora resolve a planilha por `getPlanilhaId()` — em homologação ela
   tem de ler a base de HOMOLOGAÇÃO, não os 8.000 de produção. **Conferir isso
   explicitamente**: era o bug.
6. **Modo teste**: o padrão foi invertido para falhar fechado. Em homologação,
   declarar `EVENTO_MODO_TESTE=true` nas Propriedades do script — **sem isso o
   período 21/09–11/11 passa a ser exigido** e a emissão recusa fora dele.

### ⚠ O que esta correção NÃO resolveu

🔴 **O motor ligado na tela continua sendo o V1.** `EventosPainel.gs:43` chama
`emissao_emitirIngresso`, cujo QR codifica só o número do ingresso
(`FCV-2026-000123`) — falsificável por quem souber o formato. O motor V2, com
QR assinado por HMAC, existe e só é chamado por função de teste e pelo
simulador. Fechar o acesso não trocou o motor; essa decisão está pendente.

🔴 **As telas novas não têm rota web.** `EventosPortaria.html` e
`EventosValidacaoAdmin.html` só abrem por `showModalDialog` dentro da planilha.
Portaria é celular na porta.

🔴 **Firestore sem separação de ambiente.** Não há prefixo de coleção por
ambiente: se homologação apontar para o mesmo `FIREBASE_PROJETO`, a massa do
simulador cai no acervo real.

---

### 41. Bingo Online — nunca rodou em lugar nenhum  ·  *(era 29 — o número estava repetido três vezes)*
**Aberto em:** 20/08/2026 · `Bingo*.gs`, `Bingo*.html`, `BingoInscricao.*`

O módulo foi finalizado hoje: corrigido o botão morto, criada a inscrição
pública com teto de 300, ligado no menu sob Eventos, e coberto pelo `t73`
(30 asserções, 6 mutações mortas). **Nada disso foi executado.**

O `t73` cruza CÓDIGO. Não prova comportamento. Roteiro para fechar, na ordem:

1. **Configurar um evento de teste** no painel (Eventos › Bingo — painel):
   título, convite, prêmios, `inscricoesAte`, `sorteioEm`, YouTube, limite.
2. **Copiar o link de inscrição** e abrir numa aba anônima. Conferir que o
   convite aparece montado a partir da configuração, e não texto cravado.
3. **Inscrever-se com um CPF da base** — os campos devem nascer preenchidos.
4. **Inscrever-se de novo com o mesmo CPF** — tem de devolver a MESMA cartela,
   não um erro de duplicidade.
5. **Baixar o limite para 2** e tentar a 3ª inscrição — tem de RECUSAR.
6. **Pôr `inscricoesAte` no passado** — a página tem de fechar sozinha.
7. **Rodada completa**: gerar cartelas, iniciar, sortear até alguém bater,
   conferir que pausa, e usar o botão de expirar manifestação — que era o
   botão morto.
8. **Telão** em `?painel=bingo-telao`, projetado.

| | |
|---|---|
| 🔴 O e-mail com o link da cartela chega? | não testável no emulador |
| 🔴 O Firebase carrega dentro do HtmlService? | import de gstatic pode ser barrado pelo sandbox; há fallback por polling |
| 🔴 `fs_set_`/`fs_get_` gravam em `evento_participantes`? | coleção que nunca teve escrita |
| 🔴 O teto segura dois cliques simultâneos de verdade? | LockService só se prova no ar |


### 42. Tela genérica da Lixeira  ·  *(era 29 — o número estava repetido três vezes)*
**Aberto em:** 20/08/2026 · aprovado pelo usuário ("tela de lixeira eu concordo")

O backend da lixeira está pronto (`Lixeira.gs`) e os 21 pontos de exclusão de
cadastro já movem em vez de apagar. Falta a TELA que lista e restaura.

A decisão foi não fazer 21 telas: uma só, genérica, que liste de qualquer aba
`*_LIXEIRA` e permita restaurar. Enquanto ela não existe, a linha é recuperável
abrindo a planilha — nada se perde, mas depende de alguém saber onde olhar.

Segue a REGRA Nº 0.5: arquitetura e layout mostrados antes de implementar.


### 27. Isolamento das pastas do Drive entre produção e homologação
**Aberto em:** 20/08/2026 · `AmbienteRecursos.gs` (novo), `Comprovantes.gs`,
`Voucher.gs`, `RelatoriosBackend.gs`, `Recibo.gs`, `ReciboDiversos.gs`,
`Despesas_Oficio_Fiscal.gs`, `Utils.gs`, `SistemaConfig.gs`

O deploy de 20/08 levou os 219 arquivos para a homologação com os **mesmos
IDs de pasta do Drive da produção** — o de Comprovantes era byte a byte igual
nos dois branches. Testar Comprovantes, Recibos, Relatórios ou Voucher na
homologação gravava dentro do acervo real do sindicato, e gravava público,
porque esses fluxos chamam `setSharing`. Nada quebrava e nada avisava.

O mecanismo de ambiente já existia (`getAmbienteAtual()` lendo a Script
Property `SISGEP_AMBIENTE`) e já cobria a planilha e a pasta de Ofícios.
Faltavam quatro recursos. `AmbienteRecursos.gs` estende o mesmo mecanismo a
eles, com uma **trava**: em homologação, se a pasta resolvida for a de
produção, a gravação estoura dizendo qual chave falta configurar — em vez de
gravar calado.

Pastas de homologação criadas em 20/08 (conferidas contra a API do Drive):

| recurso | pasta de homologação |
|---|---|
| COMPROVANTES | `1COhM0dIacpViZPajSrTuPA9Mfwq6Xkta` |
| RECIBOS | `1tc21Wyl4ulIxEqlXpH6LtCKnjOwssnjr` |
| RELATORIOS | `1dIl0eav3fXD_eh_u9y-jnYquQ4UgGbQS` |
| VOUCHER_DOCUMENTOS | `1sNj2mcvuS8Cl7nojHMmdlIFyVZProPDu` |

**A pergunta que nenhum teste daqui responde:** a Script Property
`SISGEP_AMBIENTE` está setada como `homologacao` no projeto que está no ar? Se
não estiver, `getAmbienteAtual()` devolve `producao` por padrão e a homologação
está lendo e gravando na **planilha de produção** — a dos ~8.000 associados —
além das pastas. Isso não vive no repositório.

Coberto por `tests/e2e/t68-ambiente-recursos.js`: 51 asserções, 5 mutações
mortas. O que o emulador **não** prova: que a pasta certa recebeu o arquivo no
Drive de verdade, porque Drive ali é apenas registrado.

**✅ A pergunta foi respondida em 20/08/2026, 13:20.** O usuário rodou
`diagnosticoAmbienteRecursos_()` no editor da homologação e a saída veio:

```
  Script Property SISGEP_AMBIENTE : "homologacao"
  Ambiente resolvido              : HOMOLOGACAO
  PLANILHA
    id em uso : 1OGtjryOUagEgKMHjFaluiEgLnzZ11Ydc-PB-IdrHLMk   ← a de homologação
  COMPROVANTES        1COhM0dIacpViZPajSrTuPA9Mfwq6Xkta   ✅ ok
  RECIBOS             1tc21Wyl4ulIxEqlXpH6LtCKnjOwssnjr   ✅ ok
  RELATORIOS          1dIl0eav3fXD_eh_u9y-jnYquQ4UgGbQS   ✅ ok
  VOUCHER_DOCUMENTOS  1sNj2mcvuS8Cl7nojHMmdlIFyVZProPDu   ✅ ok
```

Ou seja: a propriedade está setada, a planilha em uso é a de homologação (não
a dos ~8.000 associados) e as quatro pastas resolvem para as de homologação.

**O caminho até essa saída não foi direto, e vale registrado.** Na primeira
tentativa a função não existia no projeto: `ReferenceError:
diagnosticoAmbienteRecursos_ is not defined`. O deploy tinha terminado verde,
mas um segundo caminho de deploy — `deploy-documentos-security-hml.js`, que
reescrevia a lista inteira de arquivos a partir de uma leitura anterior —
desfez a publicação 44 segundos depois. `AmbienteRecursos.gs` sumiu do projeto
e 8 arquivos voltaram à versão velha, sem que nada acusasse. Republicado, e o
caminho concorrente foi aposentado no mesmo dia.

| | |
|---|---|
| ✅ Rodar `diagnosticoAmbienteRecursos_()` no editor da HOMOLOGAÇÃO | **feito em 20/08 13:20** — `homologacao` e ✅ nas 4 pastas |
| 🔴 Rodar o mesmo no editor da PRODUÇÃO | tem que dizer `producao` e ✅ nas 4 pastas |
| 🔴 Lançar um comprovante na homologação | o arquivo tem que aparecer em `SISGEP - Comprovantes - HOMOLOGACAO`, e nenhum arquivo novo na pasta de produção |
| 🔴 Emitir um recibo na homologação | idem, em `SISGEP - Recibos - HOMOLOGACAO` |
| 🔴 Emitir um ofício na PRODUÇÃO (Marcela) | tem que continuar exatamente como estava — é a única operação viva |

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

### ✅ 19. SOFIA — a procedência embaixo da resposta — FECHADO em 31/08/2026
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
| ✅ Com CCT e Estatuto na mesma pergunta, os dois chips aparecem | **fechado por teste em 31/08** — `t39`, passo 7b: dois chips, um CCT e um Estatuto, sem aviso âmbar |
| ✅ Pergunta de cadastro não desenha nada | **fechado por teste em 31/08** — `t38` passos 8 e 15 (nenhum documento no prompt, e resposta de cadastro não dispara alerta) + `t39` passo 7 (a tela não anuncia fonte nenhuma) |

**Este item está FECHADO.** Os dois pontos que restavam não precisavam de
conferência no ar: eram comportamento de montagem de prompt e de renderização,
os dois exercitáveis no emulador. O de dois chips era buraco real — o `t38` já
provava que `fontesDoPrompt_` devolve os dois rótulos, mas ninguém tinha
provado que a TELA desenha os dois. Agora prova.

**O que o aviso pegou em 13/08, e vale registrar:** perguntado "quem pode
participar da votação?" no domínio Geral, sem documento anexado, a SOFIA
respondeu citando **arts. 74, 85 e 96**. Conferido contra o estatuto vigente:
o art. 74 é da eleição decenal dos órgãos diretivos, o art. 85 é da
publicação das chapas registradas — nenhum dos dois fala de quem vota. O
conteúdo citado existe, mas no **art. 88**, e quem pode votar é o **art. 4º,
II**. Três citações, três endereços errados, nada na resposta denunciando.
Isso gerou os itens 21 e a correção da redação do aviso.

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
| 🔴 Os chips cabem na barra e rolam | com o menu do Portal aberto e recolhido — **CSS, só no navegador** |
| 🔴 A coluna da direita some mesmo | e volta quando a escola é identificada — **CSS, só no navegador** |
| ✅ O ☰ recolhe | **verificado 13/08** |
| 🟡 A escolha sobrevive ao F5 | **parcial, 31/08** — o `t113` prova que gravação e restaurador usam a MESMA chave (o erro que quebraria a persistência sem quebrar teste). O F5 em si o jsdom não faz: dá armazenamento novo por janela |
| ✅ Clicar num módulo com submenu estando recolhido | **fechado por teste em 31/08** — `t113`: abre o menu E o acordeão; e alterna normalmente depois |
| ✅ `localStorage` bloqueado não derruba o menu | **fechado por teste em 31/08**, por acaso — o jsdom não tem localStorage, e os oito passos do acordeão passaram assim mesmo. É a promessa do `spAlternarMenu`, que estava escrita e não provada |
| ✅ **Ofícios continua igual** | **verificado 13/08** — "ofício apareceu"; emissão inteira conferida |

**Sobrou só o que é CSS.** Dos quatro 🔴 originais, dois fecharam por teste e
um virou parcial. Os dois que restam dependem de olho no navegador porque o
jsdom não aplica estilo — não há teste que os substitua.

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
| ✅ **`CIDADE / UF` e telefone** | **verificado por execução em 19/08/2026** — ver logo abaixo |

#### ✅ `CIDADE / UF` e telefone — verificado em 19/08/2026

<details>
<summary>Texto original do item, preservado</summary>

> 🔴 **Formulário de ofício** — `CIDADE/UF` deve mostrar cidade e UF
> separados, telefone no formato novo

</details>

**Primeiro, uma correção no próprio item:** ele mistura duas telas. O
formulário de ofício **não tem campo de telefone**, e o backend que o
alimenta (`listarEscolasOficio_interno_`) não devolve telefone. Quem mostra
telefone é o **Cadastro de Escolas**. Item que manda conferir um campo
inexistente nunca fecha — então ele se separa em dois, e os dois foram
medidos.

Teste: `tests/e2e/t67-cidade-uf-telefone.js` — **39 asserções**, base
semeada com os nomes de coluna reais (as constantes de `Escolas.gs`).

| O que foi medido | Resultado |
|---|---|
| `listarEscolas` devolve cidade e UF em campos separados | ✅ `cidade="Vitória"`, `uf="ES"`, sem separador dentro da cidade |
| e o telefone com máscara | ✅ `(27) 3222-1010` |
| `listarEscolasOficio_interno_` monta `Cidade / UF` para exibir | ✅ `"Vitória / ES"` — a junção é de exibição, na planilha continuam separadas |
| **Formulário de ofício:** clicar na escola preenche `#cidadeUfReceita` | ✅ `"Vitória / ES"`, pelo caminho real (clique no botão da lista A-Z) |
| **Cadastro de Escolas:** abrir a ficha preenche cidade, UF e telefone | ✅ `ceMunicipio="Vitória"`, `ceUf="ES"`, `ceTelefone="(27) 3222-1010"`, `ceWhatsapp` e `ceCep` junto |
| **Contraprova** — a 1 escola sem UF não ganha barra pendurada | ✅ sai `"Serra"`, não `"Serra / "` — nas duas telas |

Cinco mutações rodadas, todas mataram asserção (2, 1, 3, 1 e 3 falhas). A
mais instrutiva: apagar a normalização boa **não** derrubou o campo do
ofício, porque `preencherCompat` tem uma reserva — quem denunciou foi a
lista A-Z, que não tem. Duas asserções sobre o mesmo dado em telas
diferentes não é redundância.

**Achado que fica registrado, sem mexer:** `normalizarEscola` está
declarada **três vezes no mesmo escopo** de `OficiosScripts.html` (linhas
122, 133 e 146). Declaração de função sobe e a última vence — e só a última
entende `Municipio` e `cidadeUf`. As duas primeiras são inalcançáveis.
Funciona hoje, e quebra em silêncio se alguém apagar a cópia errada. Pela
REGRA Nº 1, remoção é decisão do usuário e vai em commit separado; até lá,
o passo 10 do t67 trava isso — apagar a cópia certa reprova o teste em vez
de quebrar a tela.

🔴 **Continua não testado:** como isso aparece com os 679 cadastros reais.
A base do teste é semeada — a forma do dado é a real, o volume não. E
aparência (cor, alinhamento, largura) não se mede em jsdom: isso é abrir a
tela.

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

## ✅ 01/09/2026 · Sessões — o gatilho diário DISPAROU na produção (item 46 FECHADO)

**Confirmado na tela de Acionadores da produção**, em 01/09/2026:

```
lpLimpezaDiaria    ·    1 de set. de 2026, 03:18:06    ·    0% de erro
```

Era a única parte que não se podia provar no dia da instalação — o `t115`
declarava, com todas as letras, que `ScriptApp.newTrigger` o emulador apenas
registra, e que a conferência dependia de olhar Acionadores no dia seguinte.
Olhou-se, e rodou.

**O ciclo completo, do sintoma ao fechamento, em menos de 24 horas:**

| | |
|---|---|
| 31/08, 20:42 | simulação: 62 expiradas · 6 vivas · 0 apagadas |
| 31/08, 20:44 | execução real: **592 apagadas** em três lotes, 6 vivas preservadas |
| 31/08, 20:46 | censo: 689 → 97 propriedades · 185,2 KB → **16,7 KB (3,3%)** |
| 31/08, 20:47 | gatilho instalado |
| **01/09, 03:18** | **disparou sozinho, 0% de erro** |

O que isso evitou: no ritmo medido de 3,48 KB/dia, o armazenamento de 500 KB
estouraria por volta de **30/11/2026** — e o que quebra ao encher é o LOGIN,
que é a porta da emissão de ofícios. Três semanas antes do acesso do Compasso,
em 19/12.


## ✅ 01/09/2026 · SOFIA — o item 21 FECHOU, e o caminho até ele achou dois defeitos maiores

**Verificado no ar**, homologação, Versões 80 e 81, com a chave da API já
configurada. O item 21 pedia conferir se a SOFIA cita **art. 88** ao responder
"quem pode participar da votação?" — e não 74/85/96.

**ANTES (Versão 79, 01/09 21:52):**

| Pergunta | Resposta |
|---|---|
| "quem pode participar da votação?" | citou arts. 74, 76, **82**, 94, 96 — nenhum deles o 88 |
| "é o 88 ou o 74?" | *"O Art. 88 **não consta** no Estatuto vigente"* |
| "quantos artigos tem?" | *"134 artigos"* — incompatível com a resposta anterior |
| "o que diz o art. 88?" | citou o art. 88 inteiro, e ele é sobre "a relação dos associados em condições de **votar**" |

**DEPOIS (Versão 81, 01/09 22:3x):** todas as citações conferidas contra o
documento, palavra por palavra:

| Citou | Confere? |
|---|---|
| **Art. 88, §1º** — *"Aos associados previstos no art. 5º fica assegurado o direito de voto em separado…"* | ✅ idêntico |
| **Art. 98** — *"Para comprovar sua identidade e o exercício do direito ao voto, o eleitor deverá apresentar qualquer documento de identificação oficial com foto."* | ✅ idêntico |
| Relação de votantes afixada 10 dias antes (Art. 88) | ✅ |

**Zero citação errada.** E o `§1º` que saía como "Art. 82" agora sai como
"Art. 88, §1º", transcrito.

**AS TRÊS CAUSAS, e nenhuma era a IA inventando** (commits `0241b80` e
`1eebbc6`, travadas pelo `t117` com 29 asserções):

1. **Pontuação por texto literal.** A pergunta gera "votacao", o art. 88
   escreve "votar", `indexOf` não achava, o artigo pontuava ZERO e era
   filtrado fora. Nunca chegava ao prompt. Em documento jurídico isso é
   sistemático: quem pergunta usa o substantivo, a lei escreve o verbo.
   Corrigido com `radicalBuscaIA_` — o radical vale 1 ponto contra 2 do termo
   exato, para entrar na disputa sem vencer de quem casou a palavra inteira.

2. **O parágrafo chegava sem o artigo.** O corte era por linha em branco, e
   "Art. 88…" e "§1º Aos associados…" são blocos separados: **74 dos 448
   blocos do Estatuto começam com §**. Chegava à IA um parágrafo legal SEM
   NÚMERO, e ela o pendurava no último número visível — daí "§1º do Art. 82".
   Ela não trocou o número: recebeu o texto sem número. `agruparPorArtigoIA_`
   levou os 74 órfãos a **zero**.

3. **Nada proibia afirmar ausência a partir de um pedaço.** Negar é pior que
   não achar: quem pergunta guarda a negação como fato e para de procurar. O
   prompt agora diz que os documentos chegam em TRECHOS e manda dizer "não veio
   nos trechos", nunca "não existe".

**E uma quarta, achada na própria conferência:** com o art. 4º chegando inteiro,
ela citou *"Art. 4º, I"* para "pleno gozo dos direitos associativos" — e o
inciso I é *"utilizar as dependências do sindicato"*. Artigo certo, algarismo
errado, com o texto à vista. Corrigido por prompt: ao citar inciso, alínea ou
parágrafo, **transcrever o texto entre aspas junto do número**. Quem é obrigado
a transcrever não erra o número, porque o erro fica visível na própria frase.

**O que NÃO se buscou, e é decisão consciente:** o art. 4º, II (*"votar e ser
votado em eleições"*) não aparece na resposta final. Ele CHEGA ao prompt — o
`t117` cobra isso —, e a IA escolheu liderar pelo art. 88, que é o artigo
específico sobre a relação de votantes. Não é erro, é ênfase. Perseguir isso
por prompt seria afinar a resposta para uma pergunta só.

**CORREÇÃO, medida em 01/09 logo depois de eu escrever o contrário:** eu disse
que "vale para CCT e Jurídico também". **Não vale, e as duas pontas estavam
erradas.**

| Documento | Tamanho | Limite | O que acontece |
|---|---|---|---|
| CCT | 10.094 | 90.000 (`ChatIACore.gs:1118`) | vai **INTEIRA**, sem seleção |
| Estatuto | 75.646 | 60.000 (`ChatIACore.gs:1144`) | vai **em trechos** |
| Memória organizacional | 0 | 30.000 | vazia |

Conferido por execução: para a CCT, a saída de `selecionarContextoIA_` é
**idêntica** ao documento — `texto.length <= limite` devolve tudo antes de
pontuar qualquer coisa. Nenhum dos defeitos deste registro pode atingi-la.

E **não existe documento do Jurídico**. Só CCT e Estatuto passam pelo seletor;
o Jurídico é um domínio do chat, não uma fonte documental. Eu juntei as duas
coisas.

**O Estatuto é o único documento que é cortado** — e é onde o defeito estava e
foi corrigido. Se um dia a CCT passar de 90.000 caracteres, ela entra na
seleção; aí a correção de hoje já está lá para recebê-la.

**ADOTADO em 01/09/2026, por decisão do usuário:** o limite do Estatuto subiu
de 60.000 para **90.000**, o mesmo da CCT. Com 75.646 caracteres, ele passa a
ser enviado **INTEIRO** — `selecionarContextoIA_` devolve o texto antes de
pontuar coisa alguma, e a classe de defeito deste registro deixa de existir:
não há trecho a escolher errado, nem parágrafo a separar do artigo, nem artigo
de fora.

Eu havia recomendado o contrário. O contrapeso continua real e fica dito: o
prompt vai a **78.416 caracteres (~21 mil tokens)**, e com 134 artigos dentro
dele achar o certo passa a depender da atenção do modelo em vez da seleção. O
usuário pesou isso contra o risco de a seleção errar de novo num documento
jurídico e escolheu o documento inteiro — o que também remove a dependência de
heurística num texto que vai para dentro de ofício.

A seleção **continua corrigida e testada**: o `t117` a exercita com um limite
menor de propósito (`LIMITE_QUE_FORCA_SELECAO`), porque com o teto de produção
todas aquelas asserções passariam por tautologia — e o dia em que o Estatuto
passar de 90.000 a seleção volta a valer sozinha, com teste no lugar.


| Data | Item | Como foi verificado |
|---|---|---|
| 10/08/2026 | Trilha abre e consulta | print do usuário |
| 10/08/2026 | Token nas 5 telas | print do usuário |

---


<!-- Movidos da seção ABERTO em 31/08/2026: estavam marcados como
     fechados e continuavam na lista de cobrança. Texto intacto. -->

### ✅ 39. Carregamento sob demanda, lote 3 — VERIFICADO em 31/08/2026

**Publicado na Versão 76** (commit `b015fe2`, run #46). O usuário abriu
Eventos → Festa Compasso 2026 → Inscrições e a lista carregou com dado real
(pessoas, situações "A analisar", "Ingresso a enviar", "Enviado").

Isso fecha o lote 3: a Central do Compasso deixou de se auto-abrir na carga da
Home e continua carregando pela ponte `compassoAplicarFiltro()`, chamada por
`EventosAdmin.html:505`.

**Acumulado do dia: 40 → 8 chamadas por carga da Home** (3 delas legítimas).

### ✅ 38. Carregamento sob demanda, lote 2 — VERIFICADO em 31/08/2026

**Publicado na Versão 75** (commit `5d7f892`, run #44). O usuário abriu os cinco
módulos e confirmou: **"Todos abrem"**.

Cinco telas convertidas: `EventosAdmin`, `JuridicoAdmin`, `ConfigAdmin`,
`AcessoAdmin` e `BeneficioReservaSimplesUI`.

**Duas exigiram criar ligação que não existia**, e as duas seguem o padrão que
o projeto já usava (o `initRH` chamando o `initRHEventos`):

| Tela | Ligação criada |
|---|---|
| `AcessoAdmin` | o `initConfig` passou a chamá-lo — ele é incluído DENTRO do `ConfigAdmin` |
| `BeneficioReservaSimplesUI` | o ramo `beneficios` do `initModulo` chama `initBeneficioReservaSimples`; a tela abre dois painéis (Guriri Beach e Assefaz), 4 chamadas |

**Acumulado: 40 → 12 chamadas por carga da Home.** Dessas 12, três são legítimas
(sessão, módulos do usuário, resumo do Início). O `t109` guarda dez telas nos
dois sentidos, com teto de regressão em 12.


### ✅ 37. Carregamento sob demanda, lote 1 — VERIFICADO em 31/08/2026

**Publicado na Versão 74** (commit `0f3afa6`, run #42). O usuário abriu os três
módulos alterados e confirmou: **"Todos carregaram"**.

**O que mudou:** o `index.html` inclui as 60 telas de uma vez, e vinte delas
buscavam os próprios dados no `DOMContentLoaded` — quando a PÁGINA carregava,
não quando o MÓDULO era aberto. Medido: 40 chamadas ao backend por carga da
Home, das quais o Início usa três.

Não foi preciso construir mecanismo: o `spIr()` já terminava em `initModulo()`,
que cobre 37 módulos. As telas faziam as duas coisas; a correção tirou a segunda.

| Tela | Ponto de entrada usado |
|---|---|
| `RHAdmin.html` | `initModulo` → `callFn("initRH")` |
| `CadastroPrestadores.html` | `initCadastroPrestadores` |
| `Scripts_Despesas.html` | `initFinanceiro` já encadeava |
| `FinanceiroConciliacao.html` | **não existia — criado no `initFinanceiro`** |

Duas telas foram examinadas e **não** alteradas: `MensalidadesAdmin` (os
listeners só ligam eventos; a busca já estava em `initMensalidades` — é o
padrão correto) e `DespesasAdmin` (o listener não faz uma chamada sequer).

**Resultado: 40 → 24 chamadas por carga.** O `t109` guarda os dois lados — que
a Home não peça, e que o módulo carregue ao abrir pelo `spIr()`.

**Meta: 3 chamadas.** Restam 24, sendo as maiores Compasso (6), Benefícios (4),
Acesso (3) e Escolas (2).


### ✅ 28. O acervo do Drive público — RESOLVIDO em 21/08/2026, 22:39

`auditoriaRevogar_({modo:'executar'})` rodou. **Os 28 arquivos foram fechados**,
cada um com a permissão relida DEPOIS da alteração:

```
COMPROVANTES        11    ANYONE_WITH_LINK → fechado (PRIVATE)
VOUCHER_DOCUMENTOS  10    ANYONE_WITH_LINK → fechado (PRIVATE)
OFICIOS              5    ANYONE_WITH_LINK → fechado (PRIVATE)
RELATORIOS           2    ANYONE_WITH_LINK → fechado (PRIVATE)
─────────────────────────────────────────────────────────────
                    28    ✅ nenhuma falha
```

Registrado na aba `_AUDITORIA_DRIVE_REVOGACAO`, com o acesso anterior de cada um.

**O que a lista revelou, e não estava previsto.** Os 5 de OFICIOS não eram
ofícios. Um é a logo do site; os outros quatro são anexos do JURÍDICO, gravados
por `Juridico.gs:366` — que usa a pasta de ofícios como destino:

```
JUR_JUR-82355079_total__dos__reclamantes.pdf
JUR_JUR-632A8085_total__dos__reclamantes.pdf
DOC_MANUAL_..._DEP-0140-2026_1_ABELITA PEREIRA SANTOS.pdf
DOC_MANUAL_..._DEP-0140-2026_1_Ponto agendado.pdf
```

Lista de reclamantes de processo trabalhista, aberta a quem tivesse a URL. Era
o mais grave do conjunto — mais que os vouchers. Um voucher exposto constrange;
uma lista de reclamantes exposta pode custar o emprego de quem está nela.

**CONFIRMADO POR MEDIÇÃO INDEPENDENTE**, 22:45:59 — `auditoriaDrive_contar_()`
rodado de novo, com o progresso zerado antes:

```
PASTA                    TOTAL   PÚBLICOS   DOMÍNIO   ERRO
COMPROVANTES                18          0        0      0
OFICIOS                    348          0        0      0
OFICIOS_DESFILIACAO         26          0        0      0
OFICIOS_HOMOLOGACAO          4          0        0      0
OFICIOS_TAXA_NEGOCIAL       84          0        0      0
RELATORIOS                   7          0        0      0
VOUCHER_DOCUMENTOS          10          0        0      0
──────────────────────────────────────────────────────────
TOTAL                      497          0        0      0

✅ Nenhum arquivo público encontrado nas pastas auditadas.
```

Dois códigos diferentes chegando ao mesmo número. O revogador disse que fechou;
o contador, que não conhece o revogador, confirmou. Um código confirmando a si
mesmo não seria prova.

**Dois detalhes que a segunda contagem também mostrou:**

- **RECIBOS sumiu da tabela.** Antes vinha `TOTAL 0 · ERRO 1`, porque o ID
  apontava para pasta inexistente. Agora a pasta nova é lida sem erro e, por
  estar vazia, nem aparece na listagem. O item 29 se confirma corrigido.
- **Os 497 não mudaram.** A revogação alterou permissão, não removeu arquivo —
  que é exatamente o que se esperava, e vale ter conferido.

### 29. A pasta de RECIBOS de produção não existia — CORRIGIDO em 21/08/2026

A auditoria devolveu `RECIBOS  TOTAL 0  ERRO 1`. Investigado:

```
PASTAS.RECIBOS = "1gudfaRCd3LxScSsqbF1kJXeI796LHr9b"
                 → "Requested entity was not found"
```

Não era permissão: a pasta não existia, nem para o script de produção nem para
acesso externo. **Consequência que ninguém tinha visto:** `gerarPDFRecibo`
chama `obterOuCriarSubpastaAno` com esse id e estoura — emitir recibo em
produção falharia. Passou despercebido porque Recibos não está em operação.

Criada `SISGEP - Recibos - PRODUCAO` (`12qepZmMbx343pI4qoulNh5Mk3uUztz1Y`) e
trocado o id em `SistemaConfig.gs` e `AmbienteRecursos.gs`.

| | |
|---|---|
| 🟡 Emitir um recibo em produção e ver o PDF cair na pasta nova | é o que fecha este item |

### ✅ 1. Trilha de Auditoria com dado real — Ofícios (FECHADO em 19/08/2026)

**Status: fechado por execução, aqui — não dependia do usuário.**

Aberto em 11/08 com "ele testa mais adiante", e ficou oito dias parado. Ao
sentar para testar em 19/08, dava para ter rodado desde sempre: o emulador
emite ofício de verdade e a trilha grava numa aba de verdade. Mandar para
o usuário o que eu podia rodar aqui é o que a REGRA Nº -1 chama de "não
sugeriu" — fica o registro do erro de julgamento.

**Provado por execução** (`t66-trilha-oficios-com-dado.js`, 27 asserções,
3 mutações mortas), o caminho inteiro:

    emitir ofício → registrarLogSistema → aud_deLogSistema_ → grava na aba
                  → auditoriaConsultar → a tela desenha a linha
                  → o clique abre o modal com os campos

- A trilha ganha uma linha por ofício emitido (a ponte é aditiva: o
  LOG_SISTEMA continua gravando).
- O registro sai como `Documentos › Ofícios`, com o número, o usuário e a
  escola.
- O filtro por módulo funciona, e filtro sem correspondência volta vazio.
- **A lista foi vista com dado** — era a pendência principal.
- **O modal foi aberto** — nunca tinha sido, em navegador nenhum.

**Armadilha registrada:** a resposta da consulta traz a lista em `acoes`,
não em `itens`. Meu primeiro probe procurou `itens`, achou zero e eu quase
reportei "a consulta não devolve nada" — o defeito era do probe.

**Continua não testado:** a aparência da lista e do modal. jsdom não
aplica CSS.

<details><summary>Registro original do item (11/08/2026)</summary>

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

</details>

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

---

## ✅ SINDICALIZAÇÃO — "todo azul, não abre nada" (VERIFICADO em 19/08/2026)

**Status: fechado pelo usuário** — *"Abriu os modulos"*, 19/08/2026, depois
de colar `Scripts_Certificado.html` e publicar.

**Causa:** `<div id="secCertificadoAdmin">` aberto na linha 269 e nunca
fechado. Como o `include()` cola tudo num HTML só e o Certificado entra em
`index.html:544` — antes de Aprovacaocadastro (573), FichasSindicaisAdmin
(651) e Carteirinhaadmin (658) —, os três módulos ficavam DENTRO da seção
do Certificado, escondida e com fundo navy.

Não era JavaScript morto nem erro de backend. O sintoma da REGRA Nº 0
apontou para HTML corrompido, e apontou certo.

**O defeito era antigo** — presente em HEAD~30. Não veio de entrega
recente.

**Guarda criada:** `t46` passo 6 — balanço de elementos de bloco
(`div/section/main/table/tbody/form`) em todos os `.html`. Os cinco passos
anteriores passavam verdes o tempo todo, porque nenhum olhava o balanço
dos ELEMENTOS. Duas mutações mortas.

**Lição para a próxima:** tela que renderiza mas não responde, ou módulo
que aparece com a cor de outro, é HTML corrompido até prova em contrário —
procurar tag antes de procurar erro no `.gs`. E rodar `t46`, que agora
pega este caso.

### ⚠ Pergunta em aberto

Se a Sindicalização **já funcionou** no ar antes, então o
`Scripts_Certificado.html` do projeto era mais antigo que o do repositório
e a versão quebrada foi colada em algum momento — o que indicaria outros
arquivos divergentes. O usuário ainda não respondeu.

---

## ✅ Histórico de Ofícios — VERIFICADO NO AR em 19/08/2026

**Confirmado pelo usuário, com estas palavras: "Histórico apareceu".**

Fecha o item que vinha desde o relato *"o histórico só está carregando"*,
e fecha por execução no sistema no ar — não por dedução minha.

### A sequência inteira, porque ela ensina

| Quando | O quê |
|---|---|
| relato | "o histórico só está carregando" |
| 1ª correção | trava de espera de 20s e ramo de erro na tela (`OficiosScripts.html`) |
| o print | **"⏱️ O servidor não respondeu ao carregar o histórico"** |
| 2ª correção | leitura coluna a coluna e pacote em texto (`HistoricoOficios.gs`) |
| agora | **"Histórico apareceu"** |

O print não foi um fracasso da primeira correção — **foi ela funcionando**.
Antes dela a tela ficava em "Carregando..." para sempre, sem erro e sem
log, e não havia como distinguir "demorou" de "não voltou". A trava
transformou silêncio em diagnóstico: nem o handler de sucesso nem o de
falha dispararam, o que em `google.script.run` só acontece por duas
causas. Foi isso que apontou para onde consertar.

### Qual das duas causas estava ativa — e por que continua sem resposta

As duas foram fechadas de uma vez:

1. **o pacote não serializava** — os campos iam crus da planilha, e uma
   Date inválida faz o cliente receber `null`, sem erro e sem log (o
   mesmo mecanismo que derrubou o envio do voucher em 18/08);
2. **a leitura era pesada demais** — `getDataRange()` trazia todas as
   colunas de todas as linhas, inclusive `HTML_BODY`, o corpo inteiro do
   e-mail de cada ofício, que a listagem nunca usa.

**Qual delas travava no sistema dele continua "não testado"** e vai
continuar: as duas foram corrigidas no mesmo commit, e agora funciona.
Só o painel de Execuções do Apps Script, olhando o histórico daquele dia,
diria. Não é pendência — é honestidade sobre o que a correção prova.

### O que a tela mostrar agora ainda não foi conferido

🔴 **O conteúdo da lista**, e não só o fato de ela aparecer: número,
escola, tipo, status e data legíveis, o link do PDF abrindo, e os filtros
por escola / número / status / tipo devolvendo o que devem. Uma linha
apareceu; que as 4 colunas estejam certas em todas é outra medição.

Cobertura automatizada que existe por trás: `t64` (a espera tem fim e o
erro aparece), `t65` (o pacote serializa e o corpo do e-mail não viaja) —
38 asserções entre os dois.

---

## 21/08/2026 · A fila de envio de ofícios estava travada — corrigida, a aplicar quando produção voltar

**Urgência rebaixada no mesmo dia.** Eu tinha marcado este item como 🔴 e
como "o mais urgente da lista", partindo do que este repositório registra:
que Ofícios é o único módulo em operação diária. O usuário corrigiu na
hora: *"Só estou trabalhando em homologação, produção está parado"*.

Então **não é fogo**. O conserto existe, está no repositório, e entra em
produção junto com o resto quando aquele projeto voltar a receber
publicação. O que não muda: enquanto o arquivo corrigido não subir lá, a
fila continua travada — o defeito não some sozinho.

O commit `731ed4e` (20/08) adicionou `ID: colId` à lista de colunas
obrigatórias de `processarFilaEnvioOficios`, mas declarou `var colId` só na
outra função que aquele commit tocou. A função lançava `ReferenceError` ao
montar o mapa de obrigatórias — **antes de processar a primeira linha da
fila**. Corrigido em `144ac67`.

**O que precisa ser conferido no sistema no ar, e só você pode:**

1. **Se a fila realmente parou de enviar entre 20 e 21/08.** No painel de
   Execuções do Apps Script, procurar `processarFilaEnvioOficios` no
   período e ver se aparece erro. O repositório e o projeto no ar divergem
   — pode ser que a versão publicada nem tivesse esse commit.
2. **Se ficou ofício parado na fila** com STATUS pendente à espera. Se
   ficou, ele sai sozinho na próxima execução do trigger (5 em 5 min)
   depois que o arquivo corrigido subir.
3. **Se algum ofício foi dado como erro** por causa disso e precisa ser
   reenviado.

O que já está provado: no emulador, depois da correção, a fila processa e
envia (`processados: 1, enviados: 1`). Isso prova que a função não explode
mais. **Não prova entrega de e-mail** — isso continua sendo teste manual.

## 21/08/2026 · A suíte de testes voltou a enxergar falha

Não é pendência de teste seu — é aviso sobre o que a suíte disse até
ontem. 47 dos 84 testes terminavam com `process.exit(0)` na marra, que
passa por cima do código de falha. Eles reprovavam na tela e devolviam
"tudo certo" ao sistema.

**Consequência prática: todo "suíte verde" dito antes de 21/08 valia menos
do que parecia.** Dois defeitos reais estavam escondidos ali — a fila de
ofícios acima, e o teto de exposição estourado desde 06/08.

Corrigido em `c9b7736`. As medições cegas foram 215 → 217 → 220 → 229 →
230 → 221 → 224.

## ✅ 21/08/2026 · bingo_inscricaoPreencher devolvia contato sem máscara — FECHADO

Rota pública. A partir de um CPF, devolve nome, e-mail e telefone crus.

É exatamente o buraco que foi fechado no `compasso_inscricaoPreencher` em
21/08 (máscara no contato + teto de consultas por navegador). **No bingo
continua aberto.** Não é regressão nova, e não bloqueia o Compasso — mas é
o único item de risco real entre as 9 funções públicas registradas no
`exposicao-teto.json`.

Enquanto não for fechado, quem tiver uma lista de CPFs consegue montar uma
lista de contatos pelo link público do bingo.

**Fechado no mesmo dia**, com a regra indo para uma camada comum
(`PrivacidadeCore.gs`) em vez de ser copiada — decisão do usuário. Compasso e
Bingo delegam para lá; regra de segurança duplicada é regra que diverge.

O difícil não era mascarar, era o caminho de volta: quem não mexe no campo
manda a máscara ao servidor, e `"m••••a@gmail.com"` **passa** num teste de
e-mail comum (• não é @ nem espaço). Sem tratar isso, o convite do sorteio
iria para um endereço inexistente e ninguém perceberia até o dia.

`t86`: 35 asserções, 9 mutações, nenhuma sobrevivente.

**Não testado no ar:** abrir a tela do bingo, digitar um CPF da base e ver o
pontinho aparecer com a explicação; deixar como está e conferir que a
inscrição gravou o contato certo.

## 21/08/2026 · As cinco abas de Eventos e o filtro por link

Entregue e coberto por teste executável (`t81`, 29 asserções, 8 mutações
mortas). Falta a conferência de tela, que nenhum teste alcança:

- as cinco abas trocam e a aba escolhida sobrevive a recarregar a página;
- o link de inscrição do Compasso aparece na aba Inscrições e copia;
- **os dois botões da aba Participantes** abrem o painel já filtrado, com
  o chip dourado à vista dizendo qual filtro está valendo;
- o card **"A analisar"** agora filtra de verdade — antes ele acendia e
  devolvia a lista inteira. Vale clicar e conferir que o número do card
  bate com o tamanho da lista.

---

## 21/08/2026 · Análise do módulo Eventos — o que ficou em aberto

Levantado depois que os 7 commits de arquitetura V2 chegaram (17h). Descreve
o **repositório**; o que está no ar em homologação é um subconjunto.

Nenhum destes itens bloqueia a Onda 1. Todos precisam de decisão antes de
dezembro.

### ✅ 1. `compasso_checkinBuscarManual` lê os 2.000 ingressos por busca — CORRIGIDO em 21/08

`EventosCheckinPainel.gs:15` — `fs_list_('ingressos', 1000)`, filtrado em
memória. O check-in por QR usa `fs_queryEquals_`, que é barato; **só a busca
manual é cara.**

Dez buscas manuais na portaria = 20.000 leituras = ~40% da faixa gratuita
diária do Firestore, no dia 19/12. A busca manual é o caminho de contingência
(celular descarregado, QR danificado) — ou seja, é usada exatamente quando a
fila já está travada.

**A medição da Onda 2 decide se dói.** A correção, se precisar, é trocar por
`fs_queryEquals_` sobre nome/CPF, como o caminho do QR já faz.

**Feito em 21/08**, sem esperar a medição: CPF completo e número do ingresso
passaram a usar `fs_queryEquals_` (custa o que devolve). Busca por nome, por
escola e por CPF **parcial** continuam na listagem — o Firestore não faz
"contém", e tirar isso quebraria a portaria. Atalho que não acha cai na
listagem em vez de desistir.

Coberto por `t83`: 27 asserções, 7 mutações, nenhuma sobrevivente. O teste
conta LEITURAS, não só resultados — 6 das 7 mutações mantêm o resultado certo
e só a contagem denuncia.

**Continua não medido no ar:** quanto isso vale de verdade no dia. A Onda 2
ainda decide.

### ✅ 2. Duas emissões coexistem — RESOLVIDO em 21/08 (V1 desligada)

- `EventosEmissao.gs` (V1) — QR **derivável do número do ingresso**
- `EventosEmissaoV2.gs` (V2) — QR assinado por HMAC

O piloto e o painel novo usam a V2. A V1 continua no projeto e alcançável.

**É a decisão que mais importa antes de dezembro**: deixar as duas é manter
uma porta de fechadura fraca ao lado da forte. Precisa de decisão do usuário
sobre qual morre — não é escolha técnica, é de operação (se alguém ainda
emite pela tela antiga).

**Resolvido no mesmo dia.** O usuário: *"V1 era para ser desabilitado"*.

`emissao_emitirIngresso` passou a RECUSAR, com código `V1_DESABILITADA`,
dizendo o motivo e para onde ir. A tentativa é auditada — se aparecer no log
depois de dezembro, alguém tinha link salvo.

**O arquivo `EventosEmissao.gs` NÃO foi apagado, e não pode ser.** Ele carrega
`EMISSAO_CFG` (evento, 2.000 vagas, prefixo, período, valor do acompanhante),
que o módulo inteiro lê — V2 inclusive — e o `emissao_formatarNumero_` que a
própria V2 usa para numerar. Apagar derrubaria tudo em silêncio. Só a função
de emissão foi desligada; o motor antigo virou
`emissao_emitirIngresso_legadoV1_`, preservado como legado.

Os dois caminhos que levavam até ela também foram tratados: a tela
`EventoPainel.html` ganhou faixa explicando (a rota `?painel=emissao`
continua existindo para quem tem link salvo), e o card da aba Inscrições
passou a explicar em vez de abrir.

`t84`: 23 asserções, 8 mutações, nenhuma sobrevivente.

### 🟡 3. O Firestore não separa homologação de produção

Zero ocorrências de prefixo por ambiente em `EventosFirestore.gs`. Hoje é o
mesmo projeto (`sisgep-plataforma`) para os dois, mesmas coleções.

Os ingressos de teste convivem com o que for real. A limpeza filtra por
`origem === 'IMPORTACAO_TESTE'` e funciona — mas é disciplina de código, não
separação estrutural. Um `fs_list_` sem filtro vê tudo.

### 🟡 4. A arquitetura V2 nova ainda é uma ilha

`EventosDominioV2` + `Repository` + `Service` + `Controller` = 714 linhas,
consumidas **apenas** pela aba Informações. Não conversam com inscrição,
emissão nem check-in.

Não é defeito — é obra em andamento, e nasceu bem fechada (o Repository
recusa ambiente que não seja homologação, o Service exige administrador).
**Vira problema se ficar no meio do caminho até dezembro**, com metade do
módulo em cada arquitetura.

### 🟢 5. `PRE_VALIDADA` e `EM_ANALISE` sem transição que os produza

Declarados em `EventosSeguranca.gs`, citados em `EventosValidacaoAdmin.html`,
e nenhum caminho os grava. Cosmético; só confunde quem for ler o ciclo de
status.

### O que continua "não testado" no fluxo do Compasso

Executado hoje de ponta a ponta: inscrição → validação → emissão (ingressos
FCV-2026-000001 e 000002) → e-mail saiu do servidor.

**Não provado, e nesta ordem de importância:**

1. 🔴 **o QR do PDF lido por câmera** — decide se a portaria funciona, e
   nenhum código prova;
2. 🔴 **o link público do ingresso** — saiu `/dev` nas duas rodadas; depende
   de declarar `SISGEP_URL_BASE`;
3. 🔴 **dupla leitura do mesmo QR** — a trava sob `LockService` só se prova
   com dois aparelhos (Onda 3);
4. ⚪ entrega do e-mail na caixa de outra pessoa, WhatsApp, internet ruim.

### O padrão que apareceu quatro vezes em 21/08

Documentei chamadas como quem escreve código, e quem usa está diante de um
seletor de funções: função com `_` que o editor não lista, funções que pedem
argumentos que o botão Executar não passa, e dois nomes quase iguais lado a
lado.

Todos corrigidos, o último de forma a não depender de acertar o nome. **Se
aparecer função nova que "não roda", suspeite disto antes do código.**
