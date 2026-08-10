# Auditoria Técnica do SISGEP — Relatório Final

**Base auditada:** commit `c605cc9` (Segunda versão do Projeto-Sisgepadm), branch `main`
**Escopo:** 78 arquivos `.gs` + 63 arquivos `.html` — 1.346 funções de nível superior
**Data:** 10/08/2026
**Padrão de classificação:** Crítico / Alto / Médio / Baixo (skill `qa-auditoria-sisgep`)

---

## 1. Sumário executivo

| Severidade | Qtd. |
|---|---|
| Crítico | 5 |
| Alto | 7 |
| Médio | 7 |
| Baixo | 2 |
| **Total** | **21** |

A primeira rodada da auditoria (achados #1 a #10) foi corrigida e mergeada no PR #1. O commit
`81bc626` ("Segunda versão do Projeto-Sisgepadm") reexportou o projeto do Apps Script por cima
dessas correções e **desfez as 20 correções**, em 40 arquivos. Este relatório trata a regressão
como o achado **#11** e acrescenta os achados **#12 a #31**, resultado da varredura dos módulos
que a primeira rodada não tinha alcançado (Central de E-mail, Portal do Associado, Eventos,
Comprovantes, Despesas, Guias, Login/Sessão, Escolas, Agendamento Oftalmológico, Voucher).

**A cadeia de risco principal**, que amarra os quatro primeiros achados críticos:

1. O app publica rotas **sem login** (`?portal=associado`, `?ficha=sindicalizacao`);
2. Qualquer página servida pelo app — inclusive as públicas — recebe a ponte `google.script.run`,
   que alcança **todas** as funções globais do projeto;
3. **219 das 264** funções de backend chamadas pelo front-end não verificam sessão;
4. A única checagem alternativa existente (`eiaAcessoAutorizado_`, na Central de E-mail)
   **falha aberto** por causa do fallback para `Session.getEffectiveUser()`.

Resultado prático: um visitante anônimo que abra a ficha pública de sindicalização e o console do
navegador alcança a caixa de e-mail do sindicato, a base de associados, despesas, guias, recibos e
ofícios.

---

## 2. Achados

### #11 — Regressão: as 20 correções da primeira rodada foram desfeitas

- **Severidade:** Crítico
- **Cenário:** O projeto foi reexportado do Apps Script (commit `81bc626`) por cima da branch já
  corrigida, sem merge. 40 arquivos voltaram ao estado anterior às correções.
- **Resultado atual:** Nenhuma das correções dos achados #1–#10 existe no código de hoje.
  Verificado marcador a marcador:

  | Correção original | Commit | Situação hoje |
  |---|---|---|
  | XSS em `Aprovacaocadastro.html` (`aprovEsc`, cache de fichas) | `7e6ab58` | Ausente |
  | Sessão em aprovação de cadastro (3 funções) | `c94713d` | Ausente |
  | Sessão em 5 funções de leitura de Visitas | `02480c0` | Ausente (voltou o `if (token !== undefined)`) |
  | Sessão nas 4 ações administrativas de Sindicalização | `1042bb2` | Ausente |
  | Limite de 5 tentativas de OTP | `af269f4` | Ausente |
  | Captura de IP/navegador na assinatura | `0b46d4a` | Ausente |
  | `IA_DocumentosSindicalizacao.gs` (leitura por IA) | `4a5b549` | Arquivo apagado |
  | Remoção do legado `ParqueChina.gs` | `0d16961` | Arquivo restaurado (664 linhas) |
  | 9 colisões de nome de função | `0e4871f`, `3d447dd` | Todas voltaram (ver #18) |
  | Rota do pixel de leitura de NF | `9b1706c` | Ausente (ver #16) |
  | Rota pública `?codigo=` de validação | `3d447dd` | Ausente (ver #17) |
  | Numeração do ofício fiscal via `gerarProximoNumeroSeguro` | `3d447dd` | Ausente (ver #19) |
  | Voucher/Bolsa de Estudo ligado ao Portal e ao admin | `0ab7e02`, `be4f2ed` | Ausente (ver #26) |
  | Prevenção de duplicidade em ofícios | `9e0094b` | Ausente (`PrevencaoDuplicata.gs` existe, desligado) |
  | Paginação em histórico/status de ofícios | `65d5d66` | Ausente |
  | Cota de e-mail antes de processar a fila | `79dcaa6` | Ausente |

- **Resultado esperado:** As correções permanecem no código; alterações feitas no editor do Apps
  Script chegam ao Git por merge, não por sobrescrita.
- **Impacto:** Todos os riscos das rodadas anteriores voltaram ao ar simultaneamente, e o histórico
  de auditoria perdeu valor — nada garante que a próxima correção sobreviva ao próximo export.
- **Evidência:** `git show --stat 81bc626` (40 arquivos, 1.160 inserções, 1.508 remoções);
  `git log --oneline 3d447dd~1..42add50` (20 commits de correção anteriores ao export).
- **Correção recomendada:** Antes de qualquer nova correção, definir o fluxo de sincronização
  (recomendado: `clasp pull` numa branch → PR → `clasp push` só a partir da `main`). Depois,
  reaplicar as 20 correções sobre a segunda versão, preservando as melhorias novas que vieram no
  export (`MensalidadeCore.gs`, `GuiasPagamento.gs`).
- **Teste de validação:** Após reaplicar, rodar de novo os greps de marcador deste relatório
  (`aprovEsc`, `exigirSessaoDocumentos_` em `AprovacaoCadastro.gs`, `TENTATIVAS_OTP`) e confirmar
  que a varredura de colisões devolve zero.

---

### #12 — 219 funções de backend expostas sem checagem de sessão

- **Severidade:** Crítico
- **Cenário:** O `doGet` serve rotas públicas antes de exigir sessão (`?portal=associado`,
  `?ficha=sindicalizacao`). Toda página servida pelo web app recebe a ponte `google.script.run`,
  que enxerga o escopo global inteiro do projeto — não só as funções da tela aberta.
- **Resultado atual:** Das 264 funções `.gs` referenciadas pelo front-end, **49 verificam sessão**,
  **5 verificam condicionalmente** (bypassável) e **219 não verificam nada**. Concentração por módulo:

  | Módulo | Funções sem checagem | Exemplos |
  |---|---|---|
  | `Reservaparquechina.gs` | 36 | `aprovarReservaParqueChina`, `registrarPagamentoParqueChina`, `emitirOficioAutorizacaoParqueChina` |
  | `Despesas.gs` | 23 | `registrarLancamentoDespesa`, `marcarDespesaComoPaga`, `cancelarDespesa`, `editarDespesa` |
  | `GuiasPagamento.gs` | 19 | `salvarEGerarGuiaPagamento`, `marcarGuiaComoPaga`, `excluirPrestador` |
  | `CentralEmailIA.gs` | 19 | `sisgepEnviarEmailDireto`, `sisgepArquivarEmailIA` (ver #13) |
  | `Comprovantes.gs` | 15 | `gerarComprovanteWeb`, `excluirComprovante`, `enviarEmailLoteComprovantes` |
  | `Escolas.gs` | 10 | `excluirEscolasEmLote`, `removerEscolasDuplicadas` |
  | `AgendOftalm.gs` | 10 | `excluirAgendamentoOftalmo`, `cancelarHorarioOftalmo` |
  | `Sindicalizacaoadmin.gs` + `AprovacaoCadastro.gs` | 6 | aprovação/rejeição de fichas e cadastros |
  | demais 20 arquivos | 87 | — |

  Trinta e cinco dessas funções **recebem** `tokenSessao` como argumento e nunca o validam — a
  assinatura sugere proteção que não existe.

- **Resultado esperado:** Toda função que lê ou grava dado de associado, financeiro ou institucional
  exige `tokenSessao` válido via `exigirSessaoDocumentos_()`, como já ocorre nos 49 casos corretos
  (módulo de Ofícios, Recibos, Sessão).
- **Impacto:** Escrita e leitura irrestritas na base do sindicato por qualquer pessoa que alcance
  uma das rotas públicas. Inclui aprovar reserva, marcar guia como paga, excluir escolas em lote,
  cancelar despesa e emitir ofício de autorização.
- **Evidência:** `Reservaparquechina.gs:800` (`aprovarReservaParqueChina`), `Despesas.gs:2000`
  (`marcarDespesaComoPaga`), `Escolas.gs:375` (`excluirEscolasEmLote`), `Comprovantes.gs:1039`
  (`excluirComprovante`). Rotas públicas: `Code.gs:70` e `Code.gs:93`.
- **Correção recomendada:** Aplicar `exigirSessaoDocumentos_(tokenSessao, false)` na primeira linha
  de cada função administrativa, em ondas por módulo (Parque China → Despesas → Guias → Comprovantes
  → Escolas → Oftalmo), atualizando os chamadores no `.html` para enviar `SISGEP_TOKEN_SESSAO`.
  Para as funções genuinamente públicas (identificação por CPF+nascimento, upload por token),
  documentar a exceção no cabeçalho da função.
- **Teste de validação:** Abrir `?ficha=sindicalizacao` sem login, chamar no console
  `google.script.run.withSuccessHandler(console.log).listarDespesas({})` — deve retornar erro de
  sessão, não a lista.

---

### #13 — A checagem de acesso da Central de E-mail falha aberto

- **Severidade:** Crítico
- **Cenário:** As 23 funções da Central de E-mail chamam `eiaAcessoAutorizado_()`, que resolve o
  e-mail do usuário e o compara com a lista `SEGURANCA.USUARIOS_AUTORIZADOS`.
- **Resultado atual:** A cadeia é `eiaAcessoAutorizado_()` → `eiaEmailUsuarioAtivo_()` →
  `obterEmailUsuarioAtual_()` → `obterEmailUsuarioAtual()`, e esta última faz:

  ```js
  var email = Session.getActiveUser().getEmail();
  if (!email) email = Session.getEffectiveUser().getEmail();   // ← fallback
  ```

  Com o app publicado como `executeAs: USER_DEPLOYING`, `getActiveUser()` devolve string vazia para
  qualquer visitante que não seja o dono, e o fallback devolve **sempre o e-mail do dono** — que
  está na lista de autorizados. A checagem aprova todo mundo.
  Há ainda um segundo caminho de falha aberta em `eiaAcessoAutorizado_`:
  `if (typeof usuarioAutorizado !== "function") return true;`.
- **Resultado esperado:** A identidade vem do token de sessão do SISGEP (`getSessaoUsuario`), nunca
  de `Session.getEffectiveUser()`, que sob `executeAs: USER_DEPLOYING` é uma constante.
- **Impacto:** Acesso completo à caixa de e-mail institucional do sindicato — listar, ler, baixar
  anexos, arquivar, excluir, adiar, criar rascunho e **enviar e-mail em nome do sindicato**
  (`sisgepEnviarEmailDireto`, `sisgepEnviarRespostaIA`). Os escopos `gmail.modify`, `gmail.send` e
  `gmail.compose` já estão concedidos no manifesto.
- **Evidência:** `CentralEmailIA.gs:721-724`, `CentralEmailIA.gs:697-709`, `SistemaConfig.gs:159-179`,
  `appsscript.json` (`executeAs: USER_DEPLOYING`).
- **Correção recomendada:** Trocar `eiaAcessoAutorizado_()` por uma checagem baseada em
  `tokenSessao` (`exigirSessaoDocumentos_`), passando o token em todas as 23 funções e nos
  chamadores em `CentralemailIA.html`. Remover o fallback para `getEffectiveUser()` de
  `obterEmailUsuarioAtual()` e o `return true` de `eiaAcessoAutorizado_`.
- **Teste de validação:** Sem login, chamar `google.script.run.sisgepListarEmailsIA({})` a partir de
  uma rota pública — deve devolver "Acesso não autorizado", e hoje devolve a caixa de entrada.

---

### #14 — Portal do Associado entrega dados pessoais completos só com o CPF na URL

- **Severidade:** Crítico (LGPD)
- **Cenário:** `GET .../exec?portal=associado&cpf=<11 dígitos>`, sem nenhuma autenticação.
- **Resultado atual:** `servirPortalAssociado` busca o associado só pelo CPF e renderiza a tela já
  preenchida com **nome, CPF, situação de filiação, logradouro, número, bairro, cidade, CEP,
  celular, celular 2 e e-mail**. Não há segundo fator de identificação, rate limit ou log de acesso.
  O `PortalVoucher.html` — construído depois — já exige CPF **+ data de nascimento**, o que mostra
  que o padrão correto existe no próprio projeto.
- **Resultado esperado:** Identificação por CPF + segundo dado (data de nascimento ou matrícula),
  ou link com token de uso único e prazo, como já é feito nos portais de NF e de guias.
- **Impacto:** Enumeração da base inteira (~8.000 associados). CPF não é segredo — circula em folha
  de pagamento, listas de escola e vazamentos públicos. Exposição de dado pessoal em massa, com
  risco de sanção sob a LGPD (art. 46) e de uso para golpe direcionado contra o associado.
- **Evidência:** `Portalassociado.gs:228-277` (`servirPortalAssociado`), `Portalassociado.gs:23-45`
  (`buscarAssociadoPorCPF_`), `Code.gs:70` (rota sem checagem de sessão).
- **Correção recomendada:** Exigir `cpf` + `nascimento` no formulário de entrada do portal (mesma
  função de conferência já usada em `identificarSolicitanteVoucher`), servir uma tela de
  identificação antes dos dados, limitar tentativas por IP/CPF via `CacheService` e registrar cada
  acesso bem-sucedido numa aba de auditoria.
- **Teste de validação:** Abrir a URL com o CPF de um associado real sem nenhum outro dado — deve
  cair na tela de identificação, não no painel preenchido.

---

### #15 — `salvarSolicitacaoAtualizacao` aceita a linha e o CPF do cliente sem vínculo com quem envia

- **Severidade:** Crítico
- **Cenário:** Um visitante envia uma solicitação de atualização cadastral pelo portal público,
  alterando o campo `linha` e o `cpf` do payload.
- **Resultado atual:** A função grava na aba `Solicitacoes_Atualizacao` exatamente o que recebeu —
  `dadosFormulario.linha`, `dadosFormulario.cpf`, novo endereço, novo celular, novo e-mail e nova
  foto — sem verificar que o remetente é o dono daquela linha. A única validação é
  `Number(linha) < 1` e um CPF de demonstração. Depois, `aprovarSolicitacaoCadastro(numeroLinha, …)`
  grava esses valores direto na aba `Associados` na linha indicada — e essa função também está sem
  checagem de sessão (#11/#12).
- **Resultado esperado:** A linha é resolvida **no servidor** a partir da identificação já validada
  (CPF + segundo fator), nunca aceita do cliente.
- **Impacto:** Sequestro de cadastro de qualquer associado: o atacante troca e-mail e celular de um
  terceiro por dados sob seu controle. Como o e-mail e o celular são o canal de contato do
  sindicato (OTP de sindicalização, boletos, ofícios), o efeito se propaga para os outros módulos.
  A etapa de aprovação humana não protege — a solicitação chega com aparência legítima.
- **Evidência:** `Portalassociado.gs:83-140`, campo `"Linha na Planilha"` gravado a partir de
  `dadosFormulario.linha`; consumo em `AprovacaoCadastro.gs:65`.
- **Correção recomendada:** Remover `linha` e `cpf` do payload aceito. Guardar a identificação
  validada em `CacheService` no momento em que o portal identifica o associado e recuperar a linha
  a partir dela no servidor. Registrar na solicitação o CPF resolvido pelo servidor, não o enviado.
- **Teste de validação:** Enviar uma solicitação com `linha` apontando para outro associado — deve
  ser recusada; hoje é gravada e fica pendente de aprovação.

---

### #16 — Seis rotas públicas enviadas por e-mail não existem no `doGet`

- **Severidade:** Alto
- **Cenário:** Prestador recebe o e-mail "envie sua NF" e clica no link; contabilidade recebe o
  documento e clica em "confirmar recebimento".
- **Resultado atual:** O código monta e dispara 6 URLs distintas no padrão `?page=pub-*`, mas o
  `doGet` **nunca lê o parâmetro `page`** — os únicos parâmetros tratados são `portal`, `painel`,
  `ficha`, `track`, `recuperar`, `sessao`, `acao`, `usuario`, `senha`, `id`, `idVisita`. Todos esses
  links caem na verificação de sessão e terminam na tela de Login.

  | URL gerada | Ocorrências | Origem |
  |---|---|---|
  | `?page=pub-nf-despesa` | 4 | `Despesas.gs:914, 1253, 2350, 2529` |
  | `?page=pub-contabil-despesa` | 3 | `Despesas.gs:915, 1707`, `Despesas_Oficio_Fiscal.gs:513` |
  | `?page=pub-pixel-nf` | 2 | `Despesas.gs:1459`, `GuiasPagamento.gs:2742` |
  | `?page=pub-confirmar-guia` | 1 | `GuiasPagamento.gs:2368` |
  | `?page=pub-envio-nf` | 1 | `GuiasPagamento.gs:2739` |
  | `?page=pub-validar-voucher` | 1 | `VoucherPdf.gs:616` (QR Code do voucher) |

  As 4 telas correspondentes (`PubNFDespesa.html`, `PubContabilDespesa.html`, `PortalEnvioNF.html`,
  `PortalConfirmacaoGuia.html`) existem no projeto e não são referenciadas por nenhum
  `createHtmlOutputFromFile`, `createTemplateFromFile` ou `include`.
- **Resultado esperado:** Cada URL gerada tem rota correspondente no `doGet`, no mesmo padrão de
  `?portal=associado` e `?ficha=sindicalizacao`.
- **Impacto:** O fluxo de recebimento de nota fiscal e de confirmação de pagamento está quebrado de
  ponta a ponta. O prestador vê uma tela de login que não lhe pertence; o financeiro conclui que
  ninguém responde e refaz a cobrança por telefone. Os pixels de leitura nunca disparam, então
  `despesas_registrarLeituraEmail` e `guiasPagamento_registrarLeituraEmail` nunca rodam e os
  indicadores de "documento lido" ficam permanentemente zerados.
- **Evidência:** `Code.gs:61-160` (nenhuma leitura de `p.page`); URLs listadas acima.
- **Correção recomendada:** Adicionar no `doGet`, antes da checagem de sessão, um bloco
  `switch (String(p.page || ""))` com as 6 rotas, servindo cada tela pública com o token na query e
  reaproveitando `pixelTransparente_()` para o caso do pixel.
- **Teste de validação:** Gerar uma despesa com prestador, abrir o link recebido no e-mail em janela
  anônima — deve abrir o formulário de envio de NF.

---

### #17 — Validação pública de ofício e de voucher sem rota

- **Severidade:** Alto
- **Cenário:** Uma escola recebe o ofício da Taxa Assistencial e usa o link "validar autenticidade";
  um parceiro lê o QR Code impresso no voucher de Bolsa de Estudo.
- **Resultado atual:** `TaxaAssistencial.gs` imprime `{{LINK_VALIDACAO}}` como `baseUrl + "?codigo=" +
  codigoVerificacao` e `VoucherPdf.gs` gera o QR apontando para `?page=pub-validar-voucher&codigo=`.
  O `doGet` não lê `p.codigo` nem `p.page`. A função `validarVoucherPublico` existe completa em
  `VoucherValidacao.gs` e não tem nenhum chamador.
- **Resultado esperado:** As duas rotas respondem publicamente com o resultado da validação.
- **Impacto:** O selo de autenticidade do ofício institucional não funciona — quem tentar validar
  vê a tela de login e conclui que o documento é falso. O QR Code impresso em todo voucher emitido
  é decorativo. Perda de credibilidade do documento oficial perante escolas e parceiros.
- **Evidência:** `TaxaAssistencial.gs:281, 401`; `VoucherPdf.gs:611-617`; `VoucherValidacao.gs:1`
  (função órfã); `Code.gs:61-160`.
- **Correção recomendada:** Restaurar a rota `?codigo=` (removida na regressão #11, commit `3d447dd`)
  e acrescentar `?page=pub-validar-voucher` chamando `validarVoucherPublico`.
- **Teste de validação:** Abrir `...exec?codigo=<código de um ofício emitido>` em janela anônima —
  deve exibir a confirmação de autenticidade.

---

### #18 — Dezessete colisões de nome de função no escopo global

- **Severidade:** Alto
- **Cenário:** O Apps Script carrega todos os `.gs` num único escopo global; quando duas definições
  têm o mesmo nome, a última carregada vence, e a ordem não é garantida a partir do Git.
- **Resultado atual:** 17 colisões (a primeira rodada tinha zerado esse número):

  | Função | Definições |
  |---|---|
  | `aprovarReservaParqueChina` | `ParqueChina.gs:495`, `Reservaparquechina.gs:800` |
  | `recusarReservaParqueChina` | `ParqueChina.gs:557`, `Reservaparquechina.gs:810` |
  | `solicitarReservaParqueChina` | `ParqueChina.gs:409`, `Reservaparquechina.gs:640` |
  | `listarReservasParqueChina` | `ParqueChina.gs:471`, `Reservaparquechina.gs:677` |
  | `dashboardReservaParqueChina` | `ParqueChina.gs:623`, `Reservaparquechina.gs:667` |
  | `agoraFormatado_` | `ParqueChina.gs:181`, `Utils.gs:29` |
  | `exportarPlanilhaTemporaria_` | `RelatoriosOficios.gs:223`, `SistemaExportacao.gs:16` |
  | `converterHtmlParaPdf_` | `Oficios.gs:32`, `Recibo.gs:4368` |
  | `enviarOTPSindicalizacao` | `Sindicalizacao.gs:251`, `SindicalizacaoEmails.gs:127` |
  | `registrarLeituraEmail` | `Despesas.gs:2477`, `GuiasPagamento.gs:3202` |
  | `getHeaderMap_` | `MensalidadeCore.gs:52`, `Utils.gs:46` |
  | `parseValorTexto_` | `Recibo.gs:3127`, `Utils.gs:233` |
  | `buscarBeneficiariosReciboPorEmpresa` | `Recibo.gs:4324`, `ReciboDiversos.gs:1030` |
  | `analisarEscolaIA` | `IACore.gs:17`, `IA_Oficios.gs:10` |
  | `diagnosticarModuloOficios` | `OficiosDiagnostico.gs:8`, `Utils.gs:343` |
  | `processarRelatorioMensalidade` | `MensalidadeCore.gs:548` e `:761` (mesmo arquivo) |
  | `verificarEEnviarLembretesNF` | `GuiasPagamento.gs:2296` e `:2683` (mesmo arquivo) |

- **Resultado esperado:** Zero colisões — cada nome global aponta para uma única implementação.
- **Impacto:** Três consequências já mapeadas na primeira rodada e hoje de volta:
  1. **Aprovação de reserva com argumentos trocados.** `Parquechinaadmin.html` chama
     `aprovarReservaParqueChina(idReserva, dados, tokenSessao)` — 3 argumentos, assinatura de
     `Reservaparquechina.gs`. A versão de `ParqueChina.gs` recebe 4 argumentos e nenhum token: se
     ela vencer a colisão, aprovações e recusas de reservas reais recebem valores deslocados,
     silenciosamente.
  2. **Privacidade decidida por sorteio.** As duas `exportarPlanilhaTemporaria_` têm comportamento
     de compartilhamento diferente: a de `RelatoriosOficios.gs` publica o arquivo exportado como
     "qualquer pessoa com o link"; a de `SistemaExportacao.gs` mantém privado. Qual delas vence
     decide a privacidade de exportações de dados de associados e de auditoria.
  3. **Reenvio automático de lembrete de NF que nunca roda.** Das duas `verificarEEnviarLembretesNF`
     em `GuiasPagamento.gs`, a segunda (sem o reenvio a cada 15 dias) vence por ser a última — o
     reenvio automático está escrito no arquivo e nunca é executado.
- **Evidência:** Varredura completa de definições de nível superior nos 78 `.gs` (`funcs.txt`).
- **Correção recomendada:** Remover `ParqueChina.gs` (legado — nenhuma de suas ~23 funções
  exclusivas tem chamador; foi apagado no commit `0d16961` e voltou no export) e reaplicar os
  renomes por prefixo de módulo do commit `0e4871f`.
- **Teste de validação:** Rerodar a varredura de duplicatas — deve devolver zero.

---

### #19 — Numeração do ofício fiscal lê só a última linha e usa sequência paralela

- **Severidade:** Alto
- **Cenário:** Emissão de ofício fiscal de despesa quando a última linha da aba `Controle` não é a
  de maior número do ano (linha excluída, importação fora de ordem, edição manual).
- **Resultado atual:** `gerarProximoNumeroOficioFiscal_` percorre a coluna de trás para frente mas
  tem um `break` **incondicional** ao fim da primeira iteração com valor — ou seja, examina apenas
  a última linha preenchida e ignora todo o resto da coluna:

  ```js
  for (var i = dados.length - 1; i >= 0; i--) {
    var val = String(dados[i][0] || "").trim();
    if (!val) continue;
    …
    break;              // ← sempre, mesmo sem ter achado número do ano corrente
  }
  ```

  Além disso, essa numeração lê a aba `Controle`, enquanto o restante dos ofícios usa
  `gerarProximoNumeroSeguro` sobre `PLANILHA_REGISTRO` — duas sequências independentes gerando
  números no mesmo formato `NNN/AAAA`.
- **Resultado esperado:** Varredura completa da coluna para achar o maior número do ano, sob o mesmo
  lock e a mesma sequência dos demais ofícios.
- **Impacto:** Dois ofícios institucionais distintos com o mesmo número — problema de validade
  documental perante escolas, contabilidade e fiscalização, e quebra da rastreabilidade do
  protocolo. É o achado que o commit `3d447dd` já tinha corrigido delegando a
  `gerarProximoNumeroSeguro`.
- **Evidência:** `Despesas_Oficio_Fiscal.gs:9-40` (o `break`); `Oficios.gs:179-219`
  (`gerarProximoNumeroSeguro`, varredura completa + consulta ao número da Taxa Assistencial).
- **Correção recomendada:** Substituir o corpo de `gerarProximoNumeroOficioFiscal_` por uma chamada
  a `gerarProximoNumeroSeguro()`, como no commit `3d447dd`.
- **Teste de validação:** Inserir na aba `Controle` uma linha `015/2026` seguida de `008/2026` e
  emitir um ofício fiscal — deve gerar `016/2026`, e hoje gera `009/2026`.

---

### #20 — Dezessete PDFs com dados pessoais publicados como "qualquer pessoa com o link"

- **Severidade:** Alto (LGPD)
- **Cenário:** Qualquer emissão de recibo, comprovante, ficha sindical, ofício fiscal, voucher ou
  documento de despesa.
- **Resultado atual:** 17 chamadas a
  `setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)` sobre arquivos que contêm
  CPF, endereço, valores e assinatura:

  | Arquivo | Linhas |
  |---|---|
  | `Comprovantes.gs` | 97, 528, 817, 1496, 1527 |
  | `Recibo.gs` | 547, 4237 |
  | `ReciboDiversos.gs` | 371, 446, 624 |
  | `Despesas.gs` | 1024, 1423 |
  | `Sindicalizacaoadmin.gs` | 380 (ficha sindical assinada) |
  | `Voucher.gs` / `VoucherPdf.gs` | 786 / 189 |
  | `Despesas_Oficio_Fiscal.gs` | 571 |
  | `RelatoriosOficios.gs` | 234 (exportação de auditoria) |

  Nenhuma das chamadas é revertida depois do envio, e não há expiração.
- **Resultado esperado:** O arquivo permanece privado; o destinatário recebe o PDF como anexo, ou
  acessa por link com token de uso único e prazo, no padrão já usado nos portais de NF.
- **Impacto:** Documento pessoal permanentemente público para quem tiver ou descobrir a URL — que
  circula em e-mail, WhatsApp e encaminhamentos. Tratamento de dado pessoal sem base legal para o
  destinatário indeterminado (LGPD art. 6º, VII e art. 46). Agrava-se em `RelatoriosOficios.gs:234`,
  que publica **exportações de auditoria** inteiras.
- **Evidência:** linhas acima; contraste com `SistemaExportacao.gs:16`, que mantém o arquivo privado
  numa pasta — as duas implementações colidem (ver #18).
- **Correção recomendada:** Anexar o PDF ao e-mail em vez de compartilhá-lo, quando o tamanho
  permitir; onde o link for necessário, gerar token em `ScriptProperties` com validade e servir o
  arquivo por rota pública que valida o token. Como medida imediata, revogar o compartilhamento
  após o envio (`setSharing(PRIVATE, NONE)`).
- **Teste de validação:** Emitir um recibo, copiar a URL do PDF e abri-la em janela anônima sem
  conta Google — não deve abrir.

---

### #21 — Senha com SHA-256 sem sal e aceitação de senha em texto puro

- **Severidade:** Alto
- **Cenário:** Login de operador do SISGEP.
- **Resultado atual:** `gerarHashSenha_` aplica SHA-256 puro, sem sal e sem alongamento de chave.
  Em `autenticarUsuario`, se o hash não bate, o código ainda compara a senha **em texto puro** com o
  valor salvo:

  ```js
  var confereComHash      = (senhaSalva === hashDigitado);
  var confereComTextoPuro = (!confereComHash && senhaSalva === senha);
  var senhaConfere        = confereComHash || confereComTextoPuro;
  ```

  A migração para hash só acontece quando o usuário faz login — contas que nunca logaram
  permanecem com a senha legível na planilha. Existe ainda uma rotina que converte a senha padrão
  `"123456"` (`Login1.gs:571-585`).
- **Resultado esperado:** Hash com sal por usuário e função de derivação com custo (ou, no limite do
  Apps Script, SHA-256 com sal aleatório por linha e muitas iterações), sem qualquer caminho que
  aceite texto puro.
- **Impacto:** Quem tiver acesso de leitura à planilha de usuários — incluindo qualquer conta com
  compartilhamento herdado — recupera senhas de operadores por tabela arco-íris (SHA-256 sem sal de
  senha curta é quebra instantânea) ou simplesmente lê as que ainda estão em texto puro. As mesmas
  senhas costumam abrir e-mail e outros sistemas.
- **Evidência:** `Login1.gs:319-323` (fallback), `Login1.gs:488-500` (hash), `Login1.gs:560-590`
  (senha padrão). Nota positiva: o limite de tentativas e o bloqueio temporário existem e estão
  corretos (`Login1.gs:12-17, 251, 305`).
- **Correção recomendada:** Adicionar coluna `SALT` na aba de usuários; gerar sal aleatório por
  usuário na próxima troca de senha; iterar o SHA-256 (≥ 10.000 voltas); remover
  `confereComTextoPuro` e forçar redefinição obrigatória para quem ainda estiver em texto puro.
- **Teste de validação:** Gravar manualmente uma senha em texto puro na planilha e tentar logar com
  ela — deve falhar.

---

### #22 — Emissão de ingressos: modo teste ligado por padrão e painel sem sessão

- **Severidade:** Alto
- **Cenário:** Evento em produção, com a propriedade `EVENTO_MODO_TESTE` nunca configurada.
- **Resultado atual:** `emissao_modoTeste_()` devolve `true` sempre que a propriedade for diferente
  da string `'false'` — inclusive quando ela **não existe**:

  ```js
  return PropertiesService.getScriptProperties().getProperty('EVENTO_MODO_TESTE') !== 'false';
  ```

  Ou seja, o padrão é modo teste ligado, e a validação de período do evento é ignorada
  silenciosamente. Além disso, `painelEmissao_status`, `painelEmissao_buscar` e
  `painelEmissao_emitirGrupo` não verificam sessão (a rota `?painel=emissao` verifica, mas as
  funções continuam alcançáveis a partir de qualquer página pública — ver #12).
- **Resultado esperado:** Padrão seguro é produção (`=== 'true'` para ligar o teste), e as funções
  do painel exigem sessão por conta própria.
- **Impacto:** Ingressos emitidos fora do período válido sem nenhum aviso, e emissão de ingresso por
  quem não passou pelo login. O contador de vagas em Firestore é consumido do mesmo jeito, então o
  limite do evento pode ser esgotado por emissões indevidas.
- **Evidência:** `EventosEmissao.gs:22-33`; `EventosPainel.gs:14-31`; `Code.gs:75-89` (a rota checa,
  as funções não).
- **Correção recomendada:** Inverter o padrão para `=== 'true'` e aplicar `exigirSessaoDocumentos_`
  nas três funções `painelEmissao_*`, propagando o token a partir de `EventoPainel.html`.
- **Teste de validação:** Apagar a propriedade `EVENTO_MODO_TESTE` e chamar `emissao_status()` —
  `modoTeste` deve vir `false`.

---

### #23 — Manifesto incoerente com o uso real e trilha de auditoria não confiável

- **Severidade:** Médio
- **Cenário:** Republicação do web app a partir deste repositório.
- **Resultado atual:** `appsscript.json` declara `"access": "MYSELF"`, o que impediria qualquer
  associado de abrir a ficha pública de sindicalização ou o Portal do Associado — funcionalidades
  centrais do sistema. O manifesto versionado, portanto, não corresponde à implantação em uso.
  Combinado a `"executeAs": "USER_DEPLOYING"`, as **36 chamadas** a `Session.getActiveUser().getEmail()`
  espalhadas por 20 arquivos devolvem string vazia para qualquer usuário que não seja o dono do
  script — e é esse valor que alimenta os campos de autoria.
- **Resultado esperado:** O manifesto reflete a implantação real, e a autoria dos registros vem da
  sessão do SISGEP (`getSessaoUsuario(token).nome`), não de `Session`.
- **Impacto:** Republicar do Git derruba todos os portais públicos. E os campos de auditoria —
  `CRIADO_POR` em despesas, `usuario` em `registrarLogSistema`, autoria em Escolas, Visitas, Recibos
  e Taxa Assistencial — gravam vazio ou o e-mail do dono, e não quem realmente executou a ação.
  `GuiasPagamento.gs:113` já faz o certo (tenta `sessao.nome` antes de cair no `Session`) e serve de
  modelo.
- **Evidência:** `appsscript.json`; `Despesas.gs:944`, `Oficios.gs:224-240`, `Escolas.gs:163`,
  `Visitas.gs:997`, `MensalidadeCore.gs:1082`, `TaxaAssistencial.gs:116, 209, 358`.
- **Correção recomendada:** Corrigir `access` para o valor realmente usado na implantação e criar um
  helper único `usuarioDaSessao_(tokenSessao)` que devolve o nome do usuário logado, substituindo as
  36 chamadas diretas a `Session.getActiveUser()`.
- **Teste de validação:** Registrar uma despesa logado como operador B e conferir a coluna
  `CRIADO_POR` — deve trazer o nome de B.

---

### #24 — XSS no painel de emissão de ingressos

- **Severidade:** Médio
- **Cenário:** Operador busca um associado no painel de emissão; o nome vem da base.
- **Resultado atual:** `EventoPainel.html` não define nenhuma função de escape e concatena os dados
  direto no `innerHTML`, inclusive **dentro de atributo**:

  ```js
  d.innerHTML = '<strong>'+a.nome+'</strong> … '+(a.cpf||'')+'…';        // L124
  … '<input value="'+ex.nome+'" oninput=…>' …                            // L170
  ```

- **Resultado esperado:** Mesmo padrão `fsaEsc`/`vadEsc`/`esc` já usado no resto do SISGEP —
  inclusive `CentralemailIA.html`, que escapa corretamente.
- **Impacto:** Um nome com aspas ou marcação, vindo da base de associados ou digitado no campo de
  acompanhante, quebra o HTML e executa script no navegador do operador, que está logado. Menor que
  os críticos porque a origem do dado é interna, mas o campo de acompanhante é digitado livremente.
- **Evidência:** `EventoPainel.html:124` e `:170`.
- **Correção recomendada:** Adicionar `epEsc()` no padrão dos demais módulos e aplicá-la a `a.nome`,
  `a.cpf` e `ex.nome`; trocar o `value="…"` concatenado por atribuição via propriedade.
- **Teste de validação:** Cadastrar um acompanhante chamado `"><img src=x onerror=alert(1)>` — o
  texto deve aparecer literal.

---

### #25 — Anexo de e-mail vira `data:` URL com o content-type informado pelo remetente

- **Severidade:** Médio
- **Cenário:** Alguém envia um e-mail ao sindicato com anexo de tipo arbitrário; o operador clica
  no anexo na Central de E-mail.
- **Resultado atual:** `sisgepObterAnexoEmailIA` monta `dataUrl: "data:" + tipo + ";base64," + base64`
  usando `blob.getContentType()` — valor que vem do e-mail recebido. O cliente só verifica se a
  string começa com `data:`. Para tipos que não são imagem nem PDF, o HTML monta
  `<a download href="data:…">`. Some-se a isso que a função `esc()` do módulo **não escapa aspa
  simples** (`.replace(/&/…).replace(/</…).replace(/>/…).replace(/"/…)`), e o módulo insere valores
  escapados dentro de strings JS delimitadas por aspa simples.
- **Resultado esperado:** Content-type validado contra uma lista permitida antes de virar `data:`
  URL; escape cobrindo também `'`.
- **Impacto:** Superfície de execução de conteúdo de origem externa dentro da tela do operador
  logado. O atributo `download` e o bloqueio do navegador a navegação de topo para `data:` limitam
  o alcance hoje, mas a validação existente é frágil e o dado é 100% controlado por terceiro.
- **Evidência:** `CentralEmailIA.gs:313-338`; `CentralemailIA.html:895` (`esc`), `:1916` (iframe).
- **Correção recomendada:** Restringir `tipo` a uma lista permitida (`image/*`, `application/pdf`,
  `text/plain`) e servir os demais como download via Drive; acrescentar `.replace(/'/g,"&#39;")` a
  `esc()`.
- **Teste de validação:** Enviar ao sindicato um anexo `.html` e abri-lo na Central — deve cair no
  caminho de download controlado, não em renderização.

---

### #26 — Onze telas nunca são servidas

- **Severidade:** Médio
- **Cenário:** Manutenção do sistema; pessoa nova tenta entender qual tela está no ar.
- **Resultado atual:** Nenhum `createHtmlOutputFromFile`, `createTemplateFromFile` ou `include`
  aponta para: `PubNFDespesa.html`, `PubContabilDespesa.html`, `PortalEnvioNF.html`,
  `PortalConfirmacaoGuia.html` (as 4 do achado #16), `PortalVoucher.html`,
  `SolicitacaoCertificado.html`, `BeneficiosAdmin.html`, `HistoricoRecibos.html`,
  `DashboardOficiosDashboardOficiosUI.html`, `TelaOficios.html` e `Relatorios.html`.
  `ReservaParqueChina.html` só é servido por `ParqueChina.gs`, o módulo legado que deveria ter sido
  removido (#18).
- **Resultado esperado:** Toda tela do projeto ou está ligada a uma rota/include, ou está marcada
  como legado no cabeçalho do arquivo.
- **Impacto:** Além do fluxo quebrado do #16, há duplicação ativa: `PortalVoucher.html` e
  `SolicitacaoCertificado.html` são dois formulários concorrentes do **mesmo** benefício (Bolsa de
  Estudo), e `BeneficiosAdmin.html` é um painel administrativo pronto que ninguém alcança. O tempo
  de manutenção se divide entre cópias, e correções são aplicadas na tela errada.
- **Evidência:** varredura de referências a cada nome de arquivo nos `.gs` e `.html`.
- **Correção recomendada:** Ligar `PortalVoucher.html` e `BeneficiosAdmin.html` (havia commits
  prontos para isso — `0ab7e02` e `be4f2ed`, perdidos na regressão #11), marcar
  `SolicitacaoCertificado.html`, `TelaOficios.html` e `Relatorios.html` como legado no cabeçalho e
  remover `DashboardOficiosDashboardOficiosUI.html` se confirmado obsoleto.
- **Teste de validação:** Rerodar a varredura de referências — cada `.html` deve ter referência ou
  cabeçalho de legado.

---

### #27 — Protocolo de Bolsa de Estudo gerado por número aleatório sem conferência

- **Severidade:** Médio
- **Cenário:** Duas solicitações de Bolsa de Estudo no mesmo ano.
- **Resultado atual:** `gerarNumeroProtocolo_` devolve `"BOLSA-" + ano + "-" + aleatório de 6
  dígitos`, sem consultar os protocolos já emitidos e sem lock. Com 900.000 valores possíveis, a
  chance de repetição passa de 50% por volta de 1.100 protocolos no mesmo ano (paradoxo do
  aniversário). `gerarCodigoValidacaoVoucher_` tem problema análogo: timestamp legível + 4 dígitos
  aleatórios, o que o torna previsível para quem sabe a data/hora aproximada da emissão.
- **Resultado esperado:** Sequência conferida contra os protocolos existentes sob `LockService`,
  como em `gerarNumeroComprovante_` e `gerarProximoNumeroSeguro`; código de validação com entropia
  criptográfica e sem timestamp embutido.
- **Impacto:** Dois associados com o mesmo número de protocolo — busca ambígua, risco de aprovar ou
  indeferir a solicitação errada. No código de validação, previsibilidade permite forjar um código
  aceito pela conferência pública (quando a rota do #17 for restaurada).
- **Evidência:** `Voucher.gs:63-75`; contraste com `Comprovantes.gs:214-241`.
- **Correção recomendada:** Reescrever `gerarNumeroProtocolo_` no padrão de
  `gerarNumeroComprovante_` (lock + varredura + sequencial). Trocar `gerarCodigoValidacaoVoucher_`
  por valor aleatório de ≥ 16 caracteres sem timestamp.
- **Teste de validação:** Emitir 200 protocolos em sequência e conferir unicidade da coluna.

---

### #28 — `Comprovantes.gs` redefine globais dentro de blocos condicionais

- **Severidade:** Médio
- **Cenário:** Carga do projeto pelo Apps Script.
- **Resultado atual:** O arquivo redefine `PLANILHA_ID` (`:1103-1112`) e `obterEmailUsuarioAtual_`
  (`:1132-1134`) dentro de blocos `if (typeof … === 'undefined')`. Como `var` e declarações de
  função são içadas para o topo do escopo global compartilhado, essas guardas não avaliam o que
  parecem avaliar, e a redefinição pode sombrear a versão de `SistemaConfig.gs`. A versão local de
  `obterEmailUsuarioAtual_` devolve `Session.getActiveUser().getEmail()` cru, sem o tratamento da
  versão oficial.
- **Resultado esperado:** Cada global tem uma única definição, no seu módulo dono.
- **Impacto:** Comportamento dependente da ordem de carga — o mesmo tipo de armadilha do #18, mas
  invisível à varredura de duplicatas porque as definições estão indentadas dentro de blocos.
  Se a versão local vencer, o módulo de Comprovantes passa a usar uma resolução de usuário
  diferente do resto do sistema.
- **Evidência:** `Comprovantes.gs:1103-1135`.
- **Correção recomendada:** Remover as duas redefinições e depender de `SistemaConfig.gs`,
  declarando a dependência no cabeçalho do arquivo.
- **Teste de validação:** Remover os blocos e executar `testarModuloComprovantes()` — deve passar.

---

### #29 — Cem leituras de planilha inteira, incluindo no caminho público

- **Severidade:** Médio
- **Cenário:** Volume de produção — ~8.000 associados, milhares de recibos e ofícios.
- **Resultado atual:** 100 ocorrências de `getDataRange().getValues()` em 26 arquivos
  (`Recibo.gs` 22, `RecibosHistorico.gs` 7, `ReciboDiversos.gs` 7, `GuiasPagamento.gs` 7,
  `AgendOftalm.gs` 7, `Despesas.gs` 6…). O caso mais sensível é `buscarAssociadoPorCPF_`
  (`Portalassociado.gs:23`), que carrega a aba `Associados` inteira em memória e varre linha a linha
  a cada acesso ao portal público — sem cache e sem índice.
- **Resultado esperado:** Leitura por faixa (`getRange` só das colunas necessárias), índice CPF→linha
  em `CacheService`/`ScriptProperties`, e paginação nas listagens.
- **Impacto:** Tempo de resposta crescente e risco de estourar o limite de 6 minutos de execução do
  Apps Script à medida que a base cresce. No portal público, cada acesso paga o custo da varredura
  completa — e o portal é justamente o ponto de maior concorrência (campanha de atualização
  cadastral atinge todos os associados ao mesmo tempo).
- **Evidência:** contagem por arquivo acima; `Portalassociado.gs:23-45`.
- **Correção recomendada:** Começar pelo caminho público: construir um índice CPF→linha em cache
  (invalidação na aprovação de cadastro) e ler só as colunas usadas. Em seguida, aplicar a
  paginação já preparada em `paginarItens_` (perdida na regressão #11) às listagens de recibos e
  ofícios.
- **Teste de validação:** Medir `console.time` em `servirPortalAssociado` com a base cheia — meta
  abaixo de 2s.

---

### #30 — `doGet` devolve o stack trace na tela em caso de erro

- **Severidade:** Baixo
- **Cenário:** Qualquer exceção não tratada na abertura do sistema.
- **Resultado atual:** O `catch` do `doGet` monta uma página com
  `erro.stack` visível ao usuário final, incluindo nomes de funções e arquivos internos.
- **Resultado esperado:** Mensagem genérica na tela e detalhe apenas no `Logger`/Stackdriver.
- **Impacto:** Entrega gratuita do mapa interno do projeto a quem estiver sondando o app — os nomes
  de função revelados são exatamente os alvos dos achados #12 e #13.
- **Evidência:** `Code.gs:144-160`.
- **Correção recomendada:** Trocar o corpo da página de erro por texto genérico, mantendo
  `Logger.log(erro.stack)`.
- **Teste de validação:** Forçar uma exceção no `doGet` e conferir que a tela não exibe nomes de
  função.

---

### #31 — `RelatoriosRecibos.gs` é código de navegador dentro de um arquivo de servidor

- **Severidade:** Baixo
- **Cenário:** Manutenção do histórico de recibos.
- **Resultado atual:** O arquivo `.gs` contém uma cópia integral do JavaScript de
  `Scripts_HistoricoRecibos.html` — usa `document.getElementById`, `addEventListener` e
  `google.script.run`, que não existem no servidor. São 8 funções (`initHistoricoRecibos`,
  `_histCarregarResumo`, `_histCarregar`, `_histRenderizarTabela`, `_histEscape`,
  `_histReenviarEmail`…) que nunca podem executar onde estão.
- **Resultado esperado:** Código de navegador vive em `.html`; o `.gs` guarda só o backend.
- **Impacto:** Ocupa nomes no escopo global compartilhado, aparece nas varreduras como função de
  backend exposta (poluindo a análise de segurança) e cria uma segunda cópia que diverge da versão
  real em `Scripts_HistoricoRecibos.html` a cada manutenção.
- **Evidência:** `RelatoriosRecibos.gs:1-230` vs. `Scripts_HistoricoRecibos.html:8-160`.
- **Correção recomendada:** Excluir `RelatoriosRecibos.gs` após confirmar que nenhuma função de
  backend real ficou só nele.
- **Teste de validação:** Abrir o Histórico de Recibos após a remoção — deve funcionar igual.

---

## 3. Pontos positivos verificados

Nem tudo que foi auditado apresentou problema. Vale registrar o que está correto, para não ser
desfeito em manutenções futuras:

- **Nenhuma chave de API no código.** Toda credencial (`ANTHROPIC_API_KEY`,
  `FIRESTORE_SERVICE_ACCOUNT`, IDs de planilha e pasta) vem de `PropertiesService`. Varredura por
  padrões de chave não achou nada embutido.
- **`LockService` bem distribuído.** 30 usos em 17 arquivos, cobrindo numeração de recibo, guia,
  despesa, ofício e comprovante, emissão de ingresso, fila de ofícios e reservas do Parque China.
- **Limite de tentativas de login implementado corretamente** — janela de 15 minutos, bloqueio
  progressivo e lock para evitar corrida no contador (`Login1.gs:12-17, 173-216`).
- **`CentralemailIA.html` escapa consistentemente** os campos vindos de e-mail externo na renderização
  da lista (assunto, remetente, resumo, categoria) — é o melhor exemplo do padrão no projeto.
- **Módulo de Ofícios é a referência de sessão**: 47 chamadas a `exigirSessaoDocumentos_`,
  com token propagado corretamente a partir do front-end.

---

## 4. Ordem de correção sugerida

| Onda | Achados | Racional |
|---|---|---|
| 1 — Contenção imediata | #14, #15, #13 | Exposição de dado pessoal e da caixa institucional, exploráveis hoje sem nenhuma credencial |
| 2 — Fundação | #11, #12 | Restabelecer as correções perdidas e fechar a sessão módulo a módulo; sem isso as demais ondas se perdem no próximo export |
| 3 — Integridade documental | #18, #19, #27 | Colisões de função e numeração duplicada afetam validade de ofício e protocolo |
| 4 — Fluxos quebrados | #16, #17, #26 | Devolver ao ar NF, confirmação de guia, validação pública e as telas prontas não ligadas |
| 5 — Endurecimento | #20, #21, #22, #23, #24, #25 | Compartilhamento de PDF, senha, modo teste, auditoria e XSS |
| 6 — Higiene | #28, #29, #30, #31 | Desempenho e limpeza |

**Pré-requisito da onda 2:** definir o fluxo `clasp` ↔ Git antes de reaplicar qualquer correção.
Enquanto o editor do Apps Script for a fonte da verdade e o Git receber exports por cima, toda
correção deste relatório tem prazo de validade de um export.

---

## 5. Metodologia

- Extração das 1.346 definições de função de nível superior dos 78 `.gs` e varredura de colisões de
  escopo global.
- Cruzamento das 627 funções públicas com referências nos 63 `.html` → 264 funções alcançáveis pelo
  front-end; análise do corpo de cada uma em busca de `exigirSessao*`, `validarSessao*`,
  `getSessaoUsuario` e de checagens condicionais bypassáveis.
- Varredura de `innerHTML` com concatenação de variável, cruzada com as funções de escape definidas
  em cada arquivo.
- Comparação das URLs geradas nos `.gs` (`?page=`, `?portal=`, `?codigo=`, `?track=`) com os
  parâmetros efetivamente lidos no `doGet`.
- Rastreamento de referências a cada arquivo `.html` (`include`, `createHtmlOutputFromFile`,
  `createTemplateFromFile`) para identificar telas órfãs.
- Inspeção manual dos caminhos de autenticação, numeração sequencial, compartilhamento de arquivos
  no Drive e uso de `Session.getActiveUser()`.
- Revalidação dos achados #1–#10 por marcador de código, contra o histórico de commits do PR #1.
