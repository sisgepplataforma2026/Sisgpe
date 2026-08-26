# MAPA DO SISGEP

> Gerado por `node tools/mapa.js`. Não edite à mão — rode o gerador depois de mexer no código.
> Serve para localizar o arquivo certo **sem abrir o repositório inteiro**.

Apps Script V8 · 78 arquivos `.gs` (servidor) · 63 arquivos `.html` (telas e fragmentos) · 1329 funções de servidor.
Tudo na raiz: o Apps Script não tem pastas. Todos os `.gs` compartilham **um único escopo global**.

## Como usar

1. Ache o módulo na tabela abaixo → já reduz a busca a poucos arquivos.
2. Para um botão da tela: procure a função em **Chamadas cliente → servidor**; ela diz o `.html` de origem e o `.gs` que a define.
3. Para um dado gravado: procure a aba em **Planilhas**.
4. Só então abra o arquivo — de preferência com `sed -n` na faixa de linhas, não inteiro.

## Módulos

| Módulo | Servidor (.gs) | Telas (.html) |
|---|---|---|
| **Ofícios** | `DashboardOficios.gs` 25k<br>`Despesas_Oficio_Fiscal.gs` 37k<br>`EmailOficios.gs` 13k<br>`FilaOficios.gs` 30k<br>`HelperOficios.gs` 14k<br>`HistoricoOficios.gs` 9k<br>`IA_Oficios.gs` 3k<br>`MonitoramentoOficios.gs` 27k<br>`OficioService.gs` 3k<br>`Oficios.gs` 48k<br>`OficiosDiagnostico.gs` 7k<br>`RastreamentoOficios.gs` 2k<br>`RelatoriosOficios.gs` 12k<br>`SindicalizacaoOficio.gs` 18k | `DashboardOficiosDashboardOficiosUI.html` 41k<br>`OficiosFormulario.html` 81k<br>`OficiosScripts.html` 98k<br>`OficiosStyles.html` 53k<br>`TelaOficios.html` 1k |
| **Outros** | `CentralFinanceiraIA.gs` 5k<br>`FinanceiroIA.gs` 18k<br>`Sem título.gs` 0k<br>`SistemaExportacao.gs` 6k<br>`contatos.gs` 27k | `ChatSISGEP.html` 43k<br>`ConfigAdmin.html` 5k<br>`FinanceiroAdmin.html` 8k<br>`FinanceiroConciliacao.html` 8k<br>`JuridicoAdmin.html` 7k<br>`PatrimonioAdmin.html` 7k<br>`RHAdmin.html` 17k<br>`Scripts_Dash.html` 15k<br>`Taxaprogressoenvio.html` 8k |
| **IA Sofia** | `ChatIACore.gs` 34k<br>`CockpitCore.gs` 13k<br>`IACore.gs` 14k<br>`IA_Funcoes.gs` 1k<br>`IA_Menu.gs` 0k<br>`IA_Prompts.gs` 1k<br>`IA_SISGEP.gs` 1k<br>`IA_TESTES.gs` 1k<br>`MemoriaCore.gs` 17k<br>`MemoriaEvolutiva.gs` 13k | `CockpitInteligente.html` 52k<br>`SofiaDocumentos.html` 22k |
| **Recibos** | `Recibo.gs` 138k<br>`ReciboDiversos.gs` 42k<br>`Recibo_Testes.gs` 2k<br>`RecibosHistorico.gs` 21k<br>`RelatoriosRecibos.gs` 9k | `HistoricoRecibos.html` 10k<br>`ReciboDiversosNovo.html` 14k<br>`Recibos.html` 29k<br>`Reciboshistorico.html` 10k<br>`Scripts_HistoricoRecibos.html` 9k<br>`Scripts_ReciboDiversos.html` 47k<br>`Scripts_Recibos.html` 122k |
| **Núcleo/Infra** | `Code.gs` 8k<br>`DiagnosticoSISGEP.gs` 2k<br>`Login1.gs` 20k<br>`PrevencaoDuplicata.gs` 3k<br>`Sessao.gs` 14k<br>`SistemaConfig.gs` 33k<br>`Teste.gs` 1k<br>`Utils.gs` 22k | `Helpers.html` 3k<br>`Login.html` 34k<br>`index.html` 98k |
| **Vouchers** | `Voucher.gs` 43k<br>`VoucherAdmin.gs` 12k<br>`VoucherAuditoria.gs` 3k<br>`VoucherCadastro.gs` 11k<br>`VoucherPdf.gs` 24k<br>`VoucherSetup.gs` 2k<br>`VoucherSolicitacao.gs` 20k<br>`VoucherValidacao.gs` 3k | `PortalVoucher.html` 61k<br>`Scripts_Certificado.html` 44k<br>`SolicitacaoCertificado.html` 29k |
| **Financeiro/Guias** | `CCTCore.gs` 12k<br>`EscolasReceita.gs` 16k<br>`GuiasPagamento.gs` 138k<br>`MensalidadeCore.gs` 47k<br>`Receita.gs` 5k<br>`TaxaAssistencial.gs` 33k | `GuiaPagamento.html` 94k<br>`PortalConfirmacaoGuia.html` 12k<br>`Scripts_Guias.html` 16k |
| **Financeiro/Despesas** | `Comprovantes.gs` 70k<br>`Despesas.gs` 120k | `CSS_GestaoDespesas.html` 12k<br>`ComprovantesNF.html` 69k<br>`DespesasAdmin.html` 69k<br>`PortalEnvioNF.html` 16k<br>`PubContabilDespesa.html` 16k<br>`PubNFDespesa.html` 26k<br>`Scripts_Despesas.html` 83k |
| **Sindicalização** | `AprovacaoCadastro.gs` 7k<br>`Sindicalizacao.gs` 23k<br>`SindicalizacaoAssociados.gs` 19k<br>`SindicalizacaoEmails.gs` 13k<br>`Sindicalizacaoadmin.gs` 33k | `Aprovacaocadastro.html` 10k<br>`FichasSindicaisAdmin.html` 31k<br>`Fichasindicalizacao.html` 32k |
| **Parque China** | `Importarhistoricoparquechina.gs` 6k<br>`ParqueChina.gs` 22k<br>`Reservaparquechina.gs` 156k | `Adminreservaparquechina.html` 15k<br>`Parquechinaadmin.html` 212k<br>`ReservaParqueChina.html` 12k<br>`Scripts_China.html` 8k |
| **Central de E-mail** | `CentralEmailIA.gs` 83k<br>`Comunicacão.gs` 1k<br>`EmailService.gs` 22k | `CentralemailIA.html` 154k<br>`Comunicacao.html` 58k<br>`Scripts_Comunicacao.html` 31k |
| **Eventos** | `EventosEmissao.gs` 9k<br>`EventosFirestore.gs` 5k<br>`EventosPainel.gs` 2k | `EventoPainel.html` 11k<br>`EventosAdmin.html` 7k |
| **Relatórios** | `RelatoriosBackend.gs` 9k | `Relatorio HTML.html` 23k<br>`Relatorios.html` 22k<br>`Scripts_Relatorios.html` 13k<br>`blocoRelatorios.html` 6k |
| **Benefícios/Saúde** | `AgendOftalm.gs` 35k | `AgendOftalmo.html` 36k<br>`BeneficiosAdmin.html` 29k<br>`Scripts_AgendOftalmo.html` 47k |
| **Escolas** | `BuscaEscola.gs` 34k<br>`Escolas.gs` 30k | `CadastroEscolas.html` 92k<br>`CadastroPrestadores.html` 61k |
| **Visitas** | `Visitas.gs` 55k | `VisitasAdmin.html` 45k<br>`VisitasCampo.html` 22k |
| **Portal do Associado** | `Portalassociado.gs` 39k | `PortalAssociado.html` 26k |

## Entradas do sistema

`Code.gs` concentra o roteamento web:

| Rota | Destino |
|---|---|
| `doGet` sem parâmetro | `Login.html` → `index.html` (precisa de sessão) |
| `?portal=associado` | `servirPortalAssociado` (público) |
| `?ficha=sindicalizacao` | `Fichasindicalizacao.html` (público, QR das visitas) |
| `?painel=emissao` | `EventoPainel.html` (exige sessão) |
| `?track=open&id=` | pixel de leitura de e-mail |
| `?recuperar=` | recuperação de senha |
| `doPost acao=loginDireto` | autentica e serve `index.html` |

## Chamadas cliente → servidor

238 funções de servidor são chamadas por `google.script.run`. Esta é a fronteira frontend/backend.

| Função | Chamada em (.html) | Definida em (.gs) |
|---|---|---|
| `adicionarContato` | `Scripts_Comunicacao.html` | `contatos.gs` |
| `agendarVisitasEmLote` | `VisitasAdmin.html` | `Visitas.gs` |
| `ajustarRecorrencia` | `Scripts_Despesas.html` | `Despesas.gs` |
| `analisarEscolaIA` | `CadastroEscolas.html` | `IACore.gs`, `IA_Oficios.gs` |
| `analisarEscolasDuplicadas` | `CadastroEscolas.html` | `Escolas.gs` |
| `aprovarEEncaminharFicha` | `FichasSindicaisAdmin.html` | `SindicalizacaoOficio.gs` |
| `aprovarFichaSindicalizacao` | `Aprovacaocadastro.html`, `FichasSindicaisAdmin.html` | `Sindicalizacaoadmin.gs` |
| `aprovarReservaParqueChina` | `Adminreservaparquechina.html`, `BeneficiosAdmin.html`, `Parquechinaadmin.html` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `aprovarSolicitacaoCadastro` | `Aprovacaocadastro.html` | `AprovacaoCadastro.gs` |
| `atualizarContato` | `Scripts_Comunicacao.html` | `contatos.gs` |
| `atualizarEmailEscola` | `FichasSindicaisAdmin.html` | `SindicalizacaoOficio.gs` |
| `atualizarSituacaoEscolasEmLote` | `CadastroEscolas.html` | `Escolas.gs` |
| `atualizarStatusMensalidadePorLinha` | `OficiosFormulario.html` | `MensalidadeCore.gs` |
| `atualizarStatusOficio` | `OficiosScripts.html` | `MonitoramentoOficios.gs` |
| `atualizarStatusWhatsappRecibo` | `Scripts_Recibos.html` | `Recibo.gs` |
| `autenticarUsuario` | `Login.html` | `Login1.gs` |
| `buscarAgendamentosOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `buscarBeneficiariosReciboPorEmpresa` | `Scripts_Recibos.html` | `Recibo.gs`, `ReciboDiversos.gs` |
| `buscarCadastroBeneficiarioRecibo` | `Scripts_Recibos.html` | `Recibo.gs` |
| `buscarConfigRecibo` | `Scripts_Recibos.html` | `Recibo.gs` |
| `buscarContatos` | `Scripts_Comunicacao.html` | `contatos.gs` |
| `buscarEnderecoPorCEP` | `Fichasindicalizacao.html` | `Sindicalizacao.gs` |
| `buscarEscolasOficioSmart` | `OficiosScripts.html` | `BuscaEscola.gs` |
| `buscarEscolasParaOficio` | `FichasSindicaisAdmin.html` | `SindicalizacaoOficio.gs` |
| `buscarFichasDrive` | `OficiosScripts.html` | `Utils.gs` |
| `buscarPrestadorGuiaPagamento` | `GuiaPagamento.html`, `Scripts_Guias.html` | `GuiasPagamento.gs` |
| `cadastrarEscola` | `CadastroEscolas.html` | `Escolas.gs` |
| `cadastrarNovoPrestador` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `cadastroRapidoNaVisita` | `VisitasCampo.html` | `Visitas.gs` |
| `calcularPreviaAgendamentoParqueChina` | `BeneficiosAdmin.html`, `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `calcularPreviaPublicaParqueChina` | `ReservaParqueChina.html` | `Reservaparquechina.gs` |
| `cancelarDespesa` | `Scripts_Despesas.html` | `Despesas.gs` |
| `cancelarEnvioDespesaLote` | `Scripts_Despesas.html` | `Despesas.gs` |
| `cancelarGuiaPagamento` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `cancelarHorarioOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `cancelarReservaParqueChina` | `BeneficiosAdmin.html`, `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `carregarConfiguracoesChinaParkV4` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `chatSISGEP` | `ChatSISGEP.html` | `ChatIACore.gs` |
| `confirmarDistribuicaoAutomaticaParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `confirmarPagamentoDespesaPublico` | `PubContabilDespesa.html` | `Despesas.gs` |
| `confirmarPagamentoPublico` | `PortalConfirmacaoGuia.html` | `GuiasPagamento.gs` |
| `consultarCnpjEscola` | `CadastroEscolas.html` | `BuscaEscola.gs` |
| `consultarDisponibilidadeParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `criarAgendamentoManualParqueChina` | `BeneficiosAdmin.html`, `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `dashboardExecutivoGeral` | `Scripts_Dash.html` | **❌ não existe** |
| `dashboardFilaEnvioResumo` | `Scripts_Dash.html` | `FilaOficios.gs` |
| `dashboardReservaParqueChina` | `ReservaParqueChina.html`, `Scripts_China.html` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `duplicarDespesa` | `Scripts_Despesas.html` | `Despesas.gs` |
| `editarDespesa` | `Scripts_Despesas.html` | `Despesas.gs` |
| `editarReservaParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `emitirOficioAutorizacaoParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `encerrarSessaoUsuario` | `index.html` | `Sessao.gs` |
| `enviarCobracasMensalidade` | `OficiosFormulario.html` | `MensalidadeCore.gs` |
| `enviarConfirmacoesHospedesParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `enviarEmailConfirmacaoOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `enviarEmailManualReservaParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `enviarGuiaPorEmailSISGEP` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `enviarLembretePrestadoresManual` | `CadastroPrestadores.html` | `Despesas.gs` |
| `enviarLoteDespesasComOficio` | `Scripts_Despesas.html` | `Despesas_Oficio_Fiscal.gs` |
| `enviarOTPSindicalizacao` | `Fichasindicalizacao.html` | `Sindicalizacao.gs`, `SindicalizacaoEmails.gs` |
| `enviarOficioAutorizacaoParqueChinaAgora` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `enviarOficioDaFilaAgora` | `OficiosScripts.html` | `FilaOficios.gs` |
| `enviarReciboDiversoContabilidade` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `enviarReciboManualPorEmail` | `Scripts_Recibos.html` | `Recibo.gs` |
| `enviarRelatorioAgendaOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `enviarTesteEmailAutorizacaoParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `excluirAgendamentoOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `excluirContato` | `Scripts_Comunicacao.html` | `contatos.gs` |
| `excluirEscolasEmLote` | `CadastroEscolas.html` | `Escolas.gs` |
| `excluirPrestadorDesp` | `CadastroPrestadores.html` | `Despesas.gs` |
| `excluirProcessoRecibo` | `Scripts_Recibos.html` | `Recibo.gs` |
| `excluirReciboDiverso` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `excluirReciboHistorico` | `Scripts_HistoricoRecibos.html` | `RecibosHistorico.gs` |
| `excluirRegistroOficio` | `OficiosScripts.html` | `Oficios.gs` |
| `excluirRegistrosOficio` | `OficiosScripts.html` | `Oficios.gs` |
| `executarPipelineReceita` | `CadastroEscolas.html` | `EscolasReceita.gs` |
| `exportarAuditoriaLog` | `Scripts_Relatorios.html` | `RelatoriosOficios.gs` |
| `exportarAuditoriaRelatorio` | `Relatorios.html` | `RelatoriosBackend.gs` |
| `exportarCSV` | `Relatorio HTML.html` | **❌ não existe** |
| `exportarControleGeralRelatorio` | `Relatorios.html` | `RelatoriosBackend.gs` |
| `exportarRelatorio` | `Scripts_Relatorios.html` | `RelatoriosOficios.gs` |
| `finClassificarHibridoIA` | `FinanceiroAdmin.html` | `FinanceiroIA.gs` |
| `finGerarInsightsFinanceirosIA` | `FinanceiroAdmin.html` | `FinanceiroIA.gs` |
| `finalizarVisita` | `VisitasCampo.html` | `Visitas.gs` |
| `gerarDespesasEmLote` | `Scripts_Despesas.html` | `Despesas.gs` |
| `gerarDocumentoCertBolsaCompleto` | `Scripts_Certificado.html` | `VoucherPdf.gs` |
| `gerarLinkFichaDaVisita` | `VisitasCampo.html` | `Visitas.gs` |
| `gerarLinkRotaDoDia` | `VisitasCampo.html` | `Visitas.gs` |
| `gerarOficioIA` | `CadastroEscolas.html` | `IACore.gs` |
| `gerarOficioWeb` | `OficiosScripts.html` | `Oficios.gs` |
| `gerarReciboWeb` | `Scripts_Recibos.html` | `Recibo.gs` |
| `gerarRecuperacaoSenha` | `Login.html` | `Sessao.gs` |
| `getCentralBeneficiosAdmin` | `index.html` | `Reservaparquechina.gs` |
| `getCockpit` | `CockpitInteligente.html` | `CockpitCore.gs` |
| `getConfigPublica` | `ConfigAdmin.html` | `SistemaConfig.gs` |
| `getDashboardChinaPark` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `getDashboardOficiosData` | `DashboardOficiosDashboardOficiosUI.html` | `DashboardOficios.gs` |
| `getPortalVoucherInitData` | `PortalVoucher.html` | `Voucher.gs` |
| `getSessaoUsuario` | `Login.html`, `index.html` | `Sessao.gs` |
| `iaAssistente` | `SofiaDocumentos.html` | `IACore.gs` |
| `identificarSolicitanteVoucher` | `PortalVoucher.html` | `VoucherCadastro.gs` |
| `importarBeneficiariosReciboDaAbaImportacao` | `Scripts_Recibos.html` | `Recibo.gs` |
| `importarDocumentosEGerarPlanilha` | `Scripts_Recibos.html` | `Recibo.gs` |
| `importarEscolasDeAba` | `CadastroEscolas.html` | `Escolas.gs` |
| `listarDespesas` | `Scripts_Despesas.html` | `Despesas.gs` |
| `listarDespesasParaEnvioContabilidade` | `Scripts_Despesas.html` | `Despesas.gs` |
| `listarEscolas` | `OficiosScripts.html`, `Scripts_Comunicacao.html` | `Escolas.gs` |
| `listarEscolasCadastro` | `CentralemailIA.html` | `Escolas.gs` |
| `listarEscolasParaFicha` | `Fichasindicalizacao.html` | `SindicalizacaoAssociados.gs` |
| `listarEscolasParaModulo` | `CadastroEscolas.html` | `Escolas.gs` |
| `listarEscolasVisitas` | `VisitasAdmin.html` | `Visitas.gs` |
| `listarFichasSindicalizacao` | `FichasSindicaisAdmin.html` | `Sindicalizacaoadmin.gs` |
| `listarHistoricoGuias` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `listarHistoricoOficios` | `OficiosScripts.html`, `Scripts_Relatorios.html` | `HistoricoOficios.gs` |
| `listarHistoricoReciboDiversos` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `listarHistoricoRecibos` | `Scripts_HistoricoRecibos.html` | `RecibosHistorico.gs` |
| `listarHorariosOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `listarListasTransmissao` | `Scripts_Comunicacao.html` | `contatos.gs` |
| `listarListasTransmissaoDisponiveis` | `Scripts_Comunicacao.html` | `contatos.gs` |
| `listarMensalidadeStatus` | `ChatSISGEP.html`, `OficiosFormulario.html` | `MensalidadeCore.gs` |
| `listarPrestadoresDesp` | `CadastroPrestadores.html`, `Scripts_Despesas.html` | `Despesas.gs` |
| `listarPrestadoresFixos` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `listarPrestadoresSemEmailDesp` | `CadastroPrestadores.html` | `Despesas.gs` |
| `listarProcessosRecibo` | `Scripts_Recibos.html` | `Recibo.gs` |
| `listarRelatorioGuiasPagamento` | `Scripts_Guias.html` | `GuiasPagamento.gs` |
| `listarReservasParaAutorizacaoParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `listarReservasParqueChina` | `Adminreservaparquechina.html`, `BeneficiosAdmin.html` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `listarSolicitacoesCertBolsa` | `Scripts_Certificado.html` | `Voucher.gs` |
| `listarSolicitacoesPendentes` | `Aprovacaocadastro.html` | `AprovacaoCadastro.gs` |
| `listarStatusOficios` | `OficiosScripts.html` | `MonitoramentoOficios.gs` |
| `listarUltimosPrestadoresGuia` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `marcarCompareceuOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `marcarDespesaComoPaga` | `Scripts_Despesas.html` | `Despesas.gs` |
| `marcarGuiaComoPaga` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `marcarReciboDiversoAssinado` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `obterAgendaDoDia` | `VisitasAdmin.html`, `VisitasCampo.html` | `Visitas.gs` |
| `obterAgendaMensalParqueChina` | `Adminreservaparquechina.html`, `BeneficiosAdmin.html` | `Reservaparquechina.gs` |
| `obterArquivoDriveBase64` | `OficiosScripts.html` | `Utils.gs` |
| `obterCnpjPrestadorDespesa` | `PubNFDespesa.html` | `Despesas.gs` |
| `obterCoberturaPorMunicipio` | `VisitasAdmin.html` | `Visitas.gs` |
| `obterConfiguracoesParqueChinaParaPainel` | `BeneficiosAdmin.html` | `Reservaparquechina.gs` |
| `obterDadosDespesaPorTokenContabilidade` | `PubContabilDespesa.html` | **❌ não existe** |
| `obterDadosDespesaPorTokenFornecedor` | `PubNFDespesa.html` | `Despesas.gs` |
| `obterDadosGuiaPorToken` | `PortalConfirmacaoGuia.html` | `GuiasPagamento.gs` |
| `obterDadosGuiaPorTokenNF` | `PortalEnvioNF.html` | `GuiasPagamento.gs` |
| `obterDashboardPendencias` | `Scripts_Dash.html` | `GuiasPagamento.gs` |
| `obterEscola360` | `VisitasAdmin.html` | `Visitas.gs` |
| `obterEstatisticasEscolas` | `DashboardOficiosDashboardOficiosUI.html` | `Escolas.gs` |
| `obterHistoricoDespesa` | `Scripts_Despesas.html` | **❌ não existe** |
| `obterIndicadoresVisitas` | `VisitasAdmin.html` | `Visitas.gs` |
| `obterOperacaoHojeParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `obterPreviewOficioFiscalDesp` | `Scripts_Despesas.html` | `Despesas_Oficio_Fiscal.gs` |
| `obterProgressoGeracao` | `Scripts_Recibos.html` | `Recibo.gs` |
| `obterRankingDiretores` | `VisitasAdmin.html` | `Visitas.gs` |
| `obterRelatorioParqueChina` | `BeneficiosAdmin.html`, `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `obterResumoDespesas` | `Scripts_Despesas.html` | `Despesas.gs` |
| `obterResumoFinanceiroProcesso` | `Scripts_Recibos.html` | `Recibo.gs` |
| `obterResumoGuiasPagamento` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `obterResumoHistoricoRecibos` | `Scripts_HistoricoRecibos.html` | `RecibosHistorico.gs` |
| `obterResumoRelatorios` | `Relatorios.html` | `RelatoriosBackend.gs` |
| `obterStatusFilaTaxaAssistencial` | `OficiosFormulario.html`, `Taxaprogressoenvio.html` | `TaxaAssistencial.gs` |
| `organizarListasWhatsApp` | `Scripts_Comunicacao.html` | `contatos.gs` |
| `painelEmissao_buscar` | `EventoPainel.html` | `EventosPainel.gs` |
| `painelEmissao_emitirGrupo` | `EventoPainel.html` | `EventosPainel.gs` |
| `painelEmissao_status` | `EventoPainel.html` | `EventosPainel.gs` |
| `prepararComunicacaoManualReservaParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `previewOficioAutorizacaoParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `previewOficioFiliacao` | `FichasSindicaisAdmin.html` | `SindicalizacaoOficio.gs` |
| `previewOficioWeb` | `OficiosScripts.html` | `Oficios.gs` |
| `previewReciboDiverso` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `previewReciboWeb` | `Scripts_Recibos.html` | `Recibo.gs` |
| `processarAlertasMensalidade` | `OficiosFormulario.html` | `MensalidadeCore.gs` |
| `processarRelatorioMensalidade` | `OficiosFormulario.html` | `MensalidadeCore.gs` |
| `receberUploadDocFornecedor` | `PubNFDespesa.html` | `Despesas.gs` |
| `receberUploadNF` | `PortalEnvioNF.html` | `GuiasPagamento.gs` |
| `recusarReservaParqueChina` | `Adminreservaparquechina.html`, `BeneficiosAdmin.html`, `Parquechinaadmin.html` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `redefinirSenhaComToken` | `Login.html` | `Sessao.gs` |
| `reenviarEmailRecibo` | `Scripts_HistoricoRecibos.html` | `RecibosHistorico.gs` |
| `reenviarEmailReciboDiverso` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `reenviarOficio` | `OficiosScripts.html` | `EmailOficios.gs` |
| `registrarCheckin` | `VisitasCampo.html` | `Visitas.gs` |
| `registrarCheckinParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `registrarCheckoutParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `registrarEnvioGuiaPagamento` | `Scripts_Guias.html` | `GuiasPagamento.gs` |
| `registrarLancamentoDespesa` | `Scripts_Despesas.html` | `Despesas.gs` |
| `registrarLimpezaParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `registrarNoShowParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `registrarOcorrenciaOperacaoParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `registrarOficioGerado` | `OficiosScripts.html` | `RelatoriosOficios.gs` |
| `registrarPagamentoParqueChina` | `BeneficiosAdmin.html`, `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `rejeitarFichaSindicalizacao` | `Aprovacaocadastro.html`, `FichasSindicaisAdmin.html` | `Sindicalizacaoadmin.gs` |
| `rejeitarSolicitacaoCadastro` | `Aprovacaocadastro.html` | `AprovacaoCadastro.gs` |
| `relatorioOficios` | `Relatorio HTML.html` | **❌ não existe** |
| `removerEscolasDuplicadas` | `CadastroEscolas.html` | `Escolas.gs` |
| `reservarHorarioOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `responderEmailIA` | `CadastroEscolas.html` | `IACore.gs` |
| `resumoFinanceiroPorProcesso` | `Scripts_Recibos.html` | `Recibo.gs` |
| `salvarAnexoAssinadoDiverso` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `salvarCadastroESolicitacaoVoucher` | `PortalVoucher.html` | `VoucherSolicitacao.gs` |
| `salvarConfiguracoesChinaParkV4` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `salvarConfiguracoesParqueChina` | `BeneficiosAdmin.html` | `Reservaparquechina.gs` |
| `salvarContatoPrestadorRapido` | `CadastroPrestadores.html` | `Despesas.gs` |
| `salvarDadosVisita` | `VisitasCampo.html` | `Visitas.gs` |
| `salvarEGerarGuiaPagamento` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `salvarEscolaOficio` | `OficiosScripts.html` | `RelatoriosOficios.gs` |
| `salvarGuiaPagamento` | `GuiaPagamento.html` | `GuiasPagamento.gs` |
| `salvarLinkAssinadoDiverso` | `Scripts_ReciboDiversos.html` | `ReciboDiversos.gs` |
| `salvarPrestadorDesp` | `CadastroPrestadores.html` | `Despesas.gs` |
| `salvarSolicitacaoAtualizacao` | `PortalAssociado.html` | `Portalassociado.gs` |
| `salvarSolicitacaoCertBolsa` | `SolicitacaoCertificado.html` | `Voucher.gs` |
| `sincronizarEscolaPorCnpj` | `CadastroEscolas.html` | `BuscaEscola.gs` |
| `sisgepAcaoEmLoteEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepAdiarEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepAlternarEstrelaEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepAnalisarEmailIA` | `CentralemailIA.html`, `CockpitInteligente.html` | `CentralEmailIA.gs` |
| `sisgepArquivarEmailIA` | `CentralemailIA.html`, `CockpitInteligente.html` | `CentralEmailIA.gs` |
| `sisgepCancelarAdiamentoEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepCriarRascunhoDireto` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepCriarRascunhoRespostaIA` | `CentralemailIA.html`, `CockpitInteligente.html` | `CentralEmailIA.gs` |
| `sisgepEncaminharEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepEnviarEmailDireto` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepEnviarRespostaIA` | `CentralemailIA.html`, `CockpitInteligente.html` | `CentralEmailIA.gs` |
| `sisgepGerarEmailComIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepListarEmailsIA` | `CentralemailIA.html`, `CockpitInteligente.html` | `CentralEmailIA.gs` |
| `sisgepObterAnexoEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepObterEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepParsearComprovanteMensalidade` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepPreCategorizarEmailsIA` | `CentralemailIA.html`, `CockpitInteligente.html` | `CentralEmailIA.gs` |
| `sisgepResolverEmailDestinatario` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `sisgepRestaurarEmailIA` | `CentralemailIA.html` | `CentralEmailIA.gs` |
| `solicitarNFDespesa` | `Scripts_Despesas.html` | `Despesas.gs` |
| `solicitarReservaParqueChina` | `ReservaParqueChina.html`, `Scripts_China.html` | `ParqueChina.gs`, `Reservaparquechina.gs` |
| `submeterFichaSindicalizacao` | `Fichasindicalizacao.html` | `Sindicalizacao.gs` |
| `sugerirDistribuicaoAutomaticaParqueChina` | `Parquechinaadmin.html` | `Reservaparquechina.gs` |
| `trocarSenhaPrimeiroAcesso` | `Login.html` | `Login1.gs` |
| `uploadDocumentoManual` | `Scripts_Despesas.html` | `Despesas.gs` |
| `validarAssociadoOftalmo` | `Scripts_AgendOftalmo.html` | `AgendOftalm.gs` |
| `validarOTPEAssinarFicha` | `Fichasindicalizacao.html` | `Sindicalizacao.gs` |

## Planilhas (camada de dados)

Planilha principal: `1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E`.

| Aba | Grava | Só lê |
|---|---|---|
| **Escolas** | — | `BuscaEscola.gs`, `EscolasReceita.gs`, `RelatoriosOficios.gs`, `SindicalizacaoOficio.gs`, `Sindicalizacaoadmin.gs`, `TaxaAssistencial.gs`, `Voucher.gs`, `VoucherPdf.gs` |
| **FILA_ENVIO_OFICIOS** | `FilaOficios.gs`, `MonitoramentoOficios.gs`, `Oficios.gs` | `DashboardOficios.gs`, `OficiosDiagnostico.gs`, `RastreamentoOficios.gs` |
| **Associados** | `Portalassociado.gs` | `AgendOftalm.gs`, `Sindicalizacaoadmin.gs`, `Teste.gs`, `VoucherCadastro.gs` |
| **Voucher_Emitidos** | `VoucherPdf.gs` | `Voucher.gs`, `VoucherAuditoria.gs`, `VoucherSetup.gs`, `VoucherValidacao.gs` |
| **CONFIG** | `Despesas.gs`, `GuiasPagamento.gs`, `Recibo.gs`, `ReciboDiversos.gs` | — |
| **Controle** | — | `BuscaEscola.gs`, `Despesas_Oficio_Fiscal.gs`, `TaxaAssistencial.gs` |
| **Voucher_Solicitacoes** | `Voucher.gs`, `VoucherAdmin.gs` | `VoucherSolicitacao.gs` |
| **Voucher_Protocolos** | `VoucherAdmin.gs` | `Voucher.gs`, `VoucherSolicitacao.gs` |
| **Mensalidade_Controle** | — | `CockpitCore.gs`, `MensalidadeCore.gs` |
| **ENVIO_TAXA_ASSISTENCIAL** | `TaxaAssistencial.gs` | `Oficios.gs` |
| **LOG_SISTEMA** | `Oficios.gs` | `RelatoriosOficios.gs` |
| **Solicitacoes_Atualizacao** | `Portalassociado.gs` | `Reservaparquechina.gs` |
| **DESPESAS** | `CentralFinanceiraIA.gs` | — |
| **Controle_Oficios** | — | `CockpitCore.gs` |
| **Ofícios** | — | `CockpitCore.gs` |
| **COMPROVANTES_ITENS** | `Comprovantes.gs` | — |
| **IMPORTACAO_ESCOLAS** | — | `Escolas.gs` |
| **FIN_EVENTOS_IA** | `FinanceiroIA.gs` | — |
| **ImportacaoHistoricoParqueChina** | — | `Importarhistoricoparquechina.gs` |
| **IMPORTAR_RECIBOS** | — | `Recibo.gs` |
| **ESCOLAS** | — | `RelatoriosOficios.gs` |
| **escolas** | — | `RelatoriosOficios.gs` |
| **DestinatariosAutorizacoesParqueChina** | `Reservaparquechina.gs` | — |
| **AutorizacoesParqueChina** | `Reservaparquechina.gs` | — |
| **ComunicacoesParqueChina** | `Reservaparquechina.gs` | — |
| **OperacaoParqueChina** | `Reservaparquechina.gs` | — |
| **USUARIO** | — | `SistemaConfig.gs` |
| **Voucher_Regras** | — | `Voucher.gs` |
| **Voucher_Historico** | `Voucher.gs` | — |
| **Voucher_Documentos** | `Voucher.gs` | — |
| **Voucher_Auditoria** | `VoucherAuditoria.gs` | — |
| **Voucher_Cadastros** | `VoucherCadastro.gs` | — |
| **Voucher_EscolasPendentes** | `VoucherSetup.gs` | — |

## Fragmentos incluídos (include)

| Arquivo | Inclui |
|---|---|
| `OficiosFormulario.html` | `SofiaDocumentos.html` |
| `Relatorio HTML.html` | `Estilo.html` |
| `TelaOficios.html` | `OficiosStyles.html`, `OficiosCentral.html`, `OficiosFormulario.html`, `blocoRelatorios.html`, `OficiosScripts.html`, `Scripts_Relatorios.html`, `Taxaprogressoenvio.html` |
| `index.html` | `OficiosStyles.html`, `CockpitInteligente.html`, `CentralemailIA.html`, `OficiosFormulario.html`, `Recibos.html`, `ReciboDiversosNovo.html`, `Reciboshistorico.html`, `Scripts_Recibos.html`, `Scripts_ReciboDiversos.html`, `Scripts_HistoricoRecibos.html`, `blocoRelatorios.html`, `SofiaDocumentos.html`, `CadastroEscolas.html`, `ChatSISGEP.html`, `Parquechinaadmin.html`, `AgendOftalmo.html`, `Scripts_AgendOftalmo.html`, `Aprovacaocadastro.html`, `DespesasAdmin.html`, `Scripts_Despesas.html`, `FinanceiroConciliacao.html`, `FinanceiroAdmin.html`, `RHAdmin.html`, `JuridicoAdmin.html`, `PatrimonioAdmin.html`, `EventosAdmin.html`, `FichasSindicaisAdmin.html`, `VisitasCampo.html`, `VisitasAdmin.html`, `ConfigAdmin.html`, `Helpers.html`, `OficiosScripts.html`, `Scripts_Relatorios.html`, `Taxaprogressoenvio.html` |

## Saúde do código

### Chamadas sem função no servidor (5)

A tela chama, o servidor não tem — falha em runtime.

| Função | Chamada em |
|---|---|
| `dashboardExecutivoGeral` | `Scripts_Dash.html` |
| `exportarCSV` | `Relatorio HTML.html` |
| `obterDadosDespesaPorTokenContabilidade` | `PubContabilDespesa.html` |
| `obterHistoricoDespesa` | `Scripts_Despesas.html` |
| `relatorioOficios` | `Relatorio HTML.html` |

### Nomes globais duplicados (17)

Todos os `.gs` dividem um escopo global só. Com o nome repetido, **uma definição apaga a outra** e qual delas vence depende da ordem de carga do projeto.

| Função | Definida em |
|---|---|
| `agoraFormatado_` | `ParqueChina.gs` , `Utils.gs` |
| `analisarEscolaIA` | `IACore.gs` , `IA_Oficios.gs` |
| `aprovarReservaParqueChina` | `ParqueChina.gs` , `Reservaparquechina.gs` |
| `buscarBeneficiariosReciboPorEmpresa` | `Recibo.gs` , `ReciboDiversos.gs` |
| `converterHtmlParaPdf_` | `Oficios.gs` , `Recibo.gs` |
| `dashboardReservaParqueChina` | `ParqueChina.gs` , `Reservaparquechina.gs` |
| `diagnosticarModuloOficios` | `OficiosDiagnostico.gs` , `Utils.gs` |
| `enviarOTPSindicalizacao` | `Sindicalizacao.gs` , `SindicalizacaoEmails.gs` |
| `exportarPlanilhaTemporaria_` | `RelatoriosOficios.gs` , `SistemaExportacao.gs` |
| `getHeaderMap_` | `MensalidadeCore.gs` , `Utils.gs` |
| `listarReservasParqueChina` | `ParqueChina.gs` , `Reservaparquechina.gs` |
| `parseValorTexto_` | `Recibo.gs` , `Utils.gs` |
| `recusarReservaParqueChina` | `ParqueChina.gs` , `Reservaparquechina.gs` |
| `registrarLeituraEmail` | `Despesas.gs` , `GuiasPagamento.gs` |
| `solicitarReservaParqueChina` | `ParqueChina.gs` , `Reservaparquechina.gs` |
| `verificarEEnviarLembretesNF` | `GuiasPagamento.gs` (duas vezes **no mesmo arquivo**) |
| `processarRelatorioMensalidade` | `MensalidadeCore.gs` (duas vezes **no mesmo arquivo**) |
