# Débito técnico — linha de base

Levantado em 2026-08-26 por `node tools/verificar.js` sobre o commit então na
branch. Serve como marco: **o que interessa é não aumentar esta lista.** Rode o
verificador antes de publicar e compare.

Nada aqui foi corrigido — corrigir cada item é mudança de comportamento em
produção e precisa de decisão e teste do time.

## 1. Nomes globais duplicados (17)

Todos os `.gs` dividem um escopo global só. Com o nome repetido, uma definição
apaga a outra e qual delas vence depende da ordem de carga do projeto no Apps
Script. Não dá erro: dá comportamento errado silencioso.

| Função | Definida em |
|---|---|
| `registrarLeituraEmail` | `Despesas.gs`, `GuiasPagamento.gs` |
| `analisarEscolaIA` | `IACore.gs`, `IA_Oficios.gs` |
| `getHeaderMap_` | `MensalidadeCore.gs`, `Utils.gs` |
| `converterHtmlParaPdf_` | `Oficios.gs`, `Recibo.gs` |
| `diagnosticarModuloOficios` | `OficiosDiagnostico.gs`, `Utils.gs` |
| `agoraFormatado_` | `ParqueChina.gs`, `Utils.gs` |
| `solicitarReservaParqueChina` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `listarReservasParqueChina` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `aprovarReservaParqueChina` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `recusarReservaParqueChina` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `dashboardReservaParqueChina` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `parseValorTexto_` | `Recibo.gs`, `Utils.gs` |
| `buscarBeneficiariosReciboPorEmpresa` | `Recibo.gs`, `ReciboDiversos.gs` |
| `exportarPlanilhaTemporaria_` | `RelatoriosOficios.gs`, `SistemaExportacao.gs` |
| `enviarOTPSindicalizacao` | `Sindicalizacao.gs`, `SindicalizacaoEmails.gs` |
| `verificarEEnviarLembretesNF` | duas vezes **no mesmo** `GuiasPagamento.gs` |
| `processarRelatorioMensalidade` | duas vezes **no mesmo** `MensalidadeCore.gs` |

### `ParqueChina.gs` voltou por engano

O commit `0d16961` removeu `ParqueChina.gs` dizendo "módulo legado, substituído
por `Reservaparquechina.gs`". O commit `81bc626` ("Segunda versão do
Projeto-Sisgepadm") trouxe o arquivo de volta. São 5 das 17 colisões acima, e o
módulo de reservas hoje depende de qual dos dois o Apps Script carregar por
último. **É o item de maior risco desta lista.** Confirme que
`Reservaparquechina.gs` é mesmo o vigente e remova o legado.

## 2. Telas chamando função que não existe no servidor (5)

`google.script.run.X()` sem `function X` em nenhum `.gs`: o botão falha em
produção, e sem `withFailureHandler` falha calado.

| Função chamada | Tela |
|---|---|
| `obterDadosDespesaPorTokenContabilidade` | `PubContabilDespesa.html` |
| `relatorioOficios` | `Relatorio HTML.html` |
| `exportarCSV` | `Relatorio HTML.html` |
| `dashboardExecutivoGeral` | `Scripts_Dash.html` |
| `obterHistoricoDespesa` | `Scripts_Despesas.html` |

Cada uma é: implementar a função, ou tirar o botão da tela.

## 3. Funções sem checagem de sessão (≈181 de 238) — a revisar

Toda função alcançável por `google.script.run` é endpoint público do webapp:
quem tem a URL chama direto, sem passar pela tela. O verificador aponta 181 sem
sinal de validação de sessão.

**A checagem é heurística** — parte pode validar por caminho que o padrão não
reconhece. A lista serve para revisar, não é veredito. Lista completa:
`node tools/verificar.js --sessoes`.

Três casos conferidos à mão, todos confirmados:

- `aprovarFichaSindicalizacao(idFicha, aprovadoPor)` — `Sindicalizacaoadmin.gs`:
  quem aprovou vem como **texto do cliente**. Dá para aprovar ficha em nome de
  qualquer pessoa.
- `aprovarReservaParqueChina(...)` — `ParqueChina.gs`: sem sessão, e ainda por
  cima é uma das funções duplicadas do item 1.
- `atualizarSituacaoEscolasEmLote(cnpjs, novaSituacao)` — `Escolas.gs`: altera
  situação de escolas em lote, sem sessão.

O histórico mostra que isso já vinha sendo tratado caso a caso (commits
"Exige sessão nas funções de aprovação de cadastro", "Torna obrigatória a
checagem de sessão em 5 funções de Visitas"). Vale priorizar por impacto:
primeiro o que aprova, cancela, estorna, exclui ou exporta.

## 4. Deploy de homologação nunca roda

`.github/workflows/deploy-homologacao.yml` exige
`github.ref == 'refs/heads/feat/compasso-2026-hardening'` — branch que não
existe mais. O workflow é `workflow_dispatch` e a condição sempre dá falso: ele
nunca executa.

Os passos de teste também apontavam para arquivos ausentes
(`tests/e2e/t46-arquivos-integros.js`, `npm test` sem `package.json`), o que
faria o job falhar mesmo se a trava passasse. Isso foi trocado por
`node tools/verificar.js`. **A trava de branch continua como estava** — decidir
quais branches podem publicar em homologação é decisão do time, não do
verificador.

## 5. Menores

- `Sem título.gs` (29 bytes) e `codigo.js` (1 byte) são arquivos vazios na raiz.
- `Comunicacão.gs` tem acento no nome — o Apps Script aceita, mas quebra script
  de shell que não cite o caminho.
- 539 usos de `innerHTML` nos `.html`. Nem todos recebem dado de usuário; os que
  recebem são XSS. Vale varrer por módulo, começando pelas telas públicas.
- `eval()` em `Reservaparquechina.gs:1715` — é fallback de `typeof` para
  detectar função global, não recebe entrada de usuário. Aceitável; se for
  mexer, `globalThis[nome]` já resolve e a linha acima já faz isso.
