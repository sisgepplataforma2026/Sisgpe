---
name: sisgep-modulos
description: Roteia uma tarefa do SISGEP para o módulo certo — quais arquivos abrir, qual regra ler antes, o que já quebrou ali e o que precisa de cuidado. Use ao começar qualquer tarefa de negócio do SISGEP (financeiro, ofícios, eventos, sindicalização, Parque China, portal, e-mail, benefícios) antes de procurar código.
---

# Roteamento por módulo

Antes de procurar código, ache o módulo. Cada linha dá os arquivos, a regra que
vale ali e o risco conhecido — pule direto para o que interessa.

Lista completa e sempre atualizada de arquivos: `grep '\*\*Módulo\*\*' docs/MAPA.md`.

## Tabela de roteamento

| Se a tarefa é sobre | Comece por | Leia antes | Risco conhecido |
|---|---|---|---|
| mensalidade, taxa assistencial, guia, boleto, PIX, CCT | `MensalidadeCore.gs`, `GuiasPagamento.gs`, `TaxaAssistencial.gs`, `CCTCore.gs` | `.claude/rules/financeiro.md` | `getHeaderMap_` e `processarRelatorioMensalidade` estão duplicados |
| despesa, comprovante, nota fiscal, contabilidade | `Despesas.gs` (120k), `Comprovantes.gs` (70k) | `.claude/rules/financeiro.md` | `Scripts_Despesas.html` chama `obterHistoricoDespesa`, que não existe |
| recibo | `Recibo.gs` (138k), `ReciboDiversos.gs` | `.claude/rules/numeracao-e-filas.md` | `parseValorTexto_` e `converterHtmlParaPdf_` duplicados com `Utils.gs`/`Oficios.gs` |
| ofício, numeração, fila de envio, protocolo, rastreamento | `Oficios.gs`, `FilaOficios.gs`, `MonitoramentoOficios.gs`, `HelperOficios.gs` | `.claude/rules/numeracao-e-filas.md` | `diagnosticarModuloOficios` duplicado com `Utils.gs` |
| ficha de sindicalização, aprovação de cadastro, associado | `Sindicalizacao.gs`, `Sindicalizacaoadmin.gs`, `SindicalizacaoAssociados.gs`, `AprovacaoCadastro.gs` | `.claude/rules/seguranca-lgpd.md` | `aprovarFichaSindicalizacao` aceita "quem aprovou" vindo do cliente |
| reserva de suíte, hóspede, ocupação do Parque China | **`Reservaparquechina.gs`** (156k) | `.claude/rules/seguranca-lgpd.md` | `ParqueChina.gs` é legado que voltou por engano e colide em 5 funções — confira qual arquivo você está editando |
| evento, ingresso, QR, check-in | `EventosEmissao.gs`, `EventosFirestore.gs` | `.claude/rules/eventos-e-vouchers.md` | dado fica no Firestore, não na planilha; modo teste é flag global |
| voucher, bolsa de estudo, certificado | `Voucher.gs`, `VoucherSolicitacao.gs`, `VoucherValidacao.gs` | `.claude/rules/eventos-e-vouchers.md` | protocolo usa `Math.random()` sem lock — pode colidir |
| escola, prestador, CNPJ, receita | `Escolas.gs`, `BuscaEscola.gs`, `EscolasReceita.gs` | `.claude/rules/seguranca-lgpd.md` | `atualizarSituacaoEscolasEmLote` altera em lote sem sessão |
| e-mail, caixa de entrada, classificação, anexo | `CentralEmailIA.gs` (83k), `EmailService.gs` | `.claude/rules/seguranca-lgpd.md` | `registrarLeituraEmail` duplicado entre `Despesas.gs` e `GuiasPagamento.gs` |
| portal do associado, carteirinha, autoatendimento | `Portalassociado.gs` | `.claude/rules/seguranca-lgpd.md` | rota pública `?portal=associado` — não pode expor dado de terceiro |
| visita a escola, ficha por QR em campo | `Visitas.gs` | `.claude/rules/seguranca-lgpd.md` | rota pública `?ficha=sindicalizacao` |
| Sofia, chat, OCR, cockpit, memória | `IACore.gs`, `ChatIACore.gs`, `CockpitCore.gs`, `MemoriaCore.gs` | `.claude/rules/seguranca-lgpd.md` | `analisarEscolaIA` duplicado; a chave fica em `ANTHROPIC_API_KEY` no `PropertiesService` |
| oftalmológico, agendamento, benefício | `AgendOftalm.gs` | `.claude/rules/seguranca-lgpd.md` | dado de saúde — trate como sensível |
| login, sessão, permissão, configuração | `Sessao.gs`, `Login1.gs`, `SistemaConfig.gs`, `Code.gs` | `.claude/rules/seguranca-lgpd.md` | `Code.gs` é o roteador; toda rota nova passa por lá |
| relatório, dashboard, exportação | `RelatoriosBackend.gs`, `RelatoriosOficios.gs`, `SistemaExportacao.gs` | `.claude/rules/seguranca-lgpd.md` | `dashboardExecutivoGeral`, `relatorioOficios` e `exportarCSV` são chamados pelas telas e não existem |

## Antes de escrever qualquer linha

1. O arquivo é grande? Abra a faixa de linhas com `sed -n`, não o arquivo todo.
   Nove arquivos passam de 80 KB.
2. Vai criar função? Confira o nome primeiro: `grep -n "^function nome" *.gs`.
   Escopo global é único — nome repetido apaga o outro.
3. Terminou? `node tools/verificar.js --max 22`.

## O que não fazer

Não invente regra de negócio. Se a regra não está no código, nem em
`.claude/rules/`, nem em `docs/`, **pergunte** — sindicato tem regra estatutária
e de CCT que não dá para deduzir do código.
