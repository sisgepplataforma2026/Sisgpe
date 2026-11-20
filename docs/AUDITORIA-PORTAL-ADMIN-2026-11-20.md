# AUDITORIA DO PORTAL ADMINISTRATIVO SISGEP — 20/11/2026

> **Esta auditoria descreve o REPOSITÓRIO (commit `6033fd8`), não necessariamente o que a equipe está usando no ar.**
> Segue `docs/PROMPT-MESTRE.md` (v2, 06/08/2026). Nada aqui foi alterado no sistema: é só leitura, medição e execução de testes.

## 0. Como ler — o que é evidência e o que é opinião

| Marca | Significado |
|---|---|
| **MEDIDO** | rodei hoje e o número veio da execução (suíte, t6, contagens do repositório) |
| **HEURÍSTICA** | contagem de texto por padrão — indica onde olhar, não prova defeito |
| **JULGAMENTO** | opinião do auditor sobre o que foi medido (notas de maturidade, prioridades) |
| **NÃO TESTADO** | nenhuma execução cobre; só dá para provar com o sistema no ar |

**Evidência executada hoje (MEDIDO):**
- Suíte completa (`tests/run-suite.js`): **274 arquivos, 9.595 asserções, 0 falha** — sobre o emulador de Apps Script em Node.
- `t6-exposicao`: das **1.113 funções públicas**, **826 recusam sem sessão**, **199 respondem sem sessão** (77 com nome de ação que grava; a classificação é por nome), 88 inconclusivas. Teto aceito: 204.
- Repositório: 209 `.gs` + 106 `.html`, ~109 mil linhas de `.gs`, ~80 mil de `.html`, 3.144 funções; projeto com 9.556.758 bytes.

**O que o emulador NÃO prova** (continua **NÃO TESTADO**): PDF impresso, entrega de e-mail, tela no navegador de verdade, gatilhos agendados, Drive real, TickOne real, Gmail/KingHost real. A lista viva está em `docs/PENDENTE-VERIFICACAO.md` (7.015 linhas).

---

## 1. Resumo para decisão (leia só isto se tiver 2 minutos)

1. **🔴 Segurança — a maior pendência.** 199 funções do servidor respondem a quem chama sem login, e 77 delas **têm nome de ação que grava ou apaga** (o `t6` classifica pelo nome, não provou a gravação; ex.: `excluirPrestador`, `excluirReceita`, `cadastrarReceita`, `aprovarAtualizacaoCadastro`, `enviarCobracasMensalidade`, `excluirSolicitacaoVoucher`, `resetarMemoriaEvolutiva`, `gerarHashInicialUsuarios123456`, `salvarGuiaPagamento`, `marcarGuiaComoPaga`). No Apps Script toda função global é endpoint de `google.script.run` para **qualquer página do projeto**, e o `appsscript.json` publica o app como `ANYONE_ANONYMOUS` executando como o dono. Medido no emulador; **não confirmado no ar**. Prioridade 1 do roadmap.
2. **🟠 Patrimônio não guarda dado no servidor.** `PatrimonioAdmin.html` não tem `.gs` e só usa `localStorage`: o que se cadastra fica no navegador de quem digitou e some se limpar o cache. Está dentro de Financeiro, onde não pertence.
3. **🟠 Módulos mal posicionados e áreas ausentes** (seção 3): Negociação, Assembleias, Patrimônio, Mensalidade e Taxas estão fora do lugar que o PROMPT-MESTRE define; Sindicalização, Comunicação e Relatórios/BI cobrem menos da metade da estrutura pedida.
4. **🟠 Dashboards:** existem e são de ação em Início, Financeiro, Eventos, Auditoria, Benefícios, Escolas, Ofícios e Voucher; **faltam** em Jurídico, Governança, Patrimônio, Sindicalização e Comunicação (seção 4).
5. **🟡 Trilha de auditoria incompleta.** Existe a trilha única (`AuditoriaCore.auditar_`, 14 campos), mas só 41 dos 209 arquivos a usam. **HEURÍSTICA:** 221 de 453 funções que gravam têm algum registro; no pior caso, `Recibo.gs` (1 de 15), `GuiasPagamento.gs` (2 de 14), `CompassoIngressosDados.gs` (0 de 10), `EventosCartaoExterno.gs` (0 de 7).
6. **🟡 Folga de tamanho.** A produção recusou o projeto com 9,874 MB; o banner dos canhotos saiu do código e a folga voltou a ~310 KB. Sem decisão estrutural, volta a apertar em poucas semanas de trabalho.
7. **✅ O que está sólido (MEDIDO):** a regra de negócio dos fluxos que têm teste executável — Ofícios (77 testes citam), Voucher (82), Escolas (125), Eventos/Compasso (81), Caixa de e-mails (39), Taxas (38) — passa inteira na suíte.

---

## 2. Escopo e método

- **Escopo:** apenas o Portal Administrativo (menu lateral de `index.html`). Portais públicos entram só como origem/destino.
- **Método:** (a) mapa de módulos a partir do menu real (`index.html`, 2.983 linhas); (b) medição por arquivo (funções, funções públicas, funções que gravam, registro de auditoria); (c) execução da suíte e do `t6-exposicao`; (d) leitura do corpo das funções públicas sem guarda aparente; (e) cruzamento com `docs/PENDENTE-VERIFICACAO.md` e `docs/ARQUITETURA-SUBMODULOS.md`.
- **Limite do método:** contagem de texto (guardas, logs) é **HEURÍSTICA**; só o `t6` e a suíte são execução.

---

## 3. Mapa: módulos recomendados × o que existe

Classificação: ✅ existe como recomendado · 🔧 existe mas mal posicionado/incompleto · ⭕ ausente.

| # | Módulo recomendado | Situação | Evidência (arquivos / menu) | Problema |
|---|---|---|---|---|
| 1 | Início / Dashboard Geral | ✅ | `InicioExecutivo.gs`, `index.html` | Falta a lista "precisa de você agora" clicável provada em tela (**NÃO TESTADO**) |
| 2 | SOFIA | 🔧 | `SofiaDocumentos.html`, `SofiaEscolasUI.html`, `IA*.gs` | Existe como assistente de documentos/escolas; não é camada transversal em todos os módulos |
| 3 | Sindicalização | 🔧 | Menu: Fichas Sindicais, Carteirinhas; `Sindicalizacao*.gs` (5) | Faltam como telas: Dashboard, Filiações, Desfiliações, Situação, Histórico Sindical, Visitas (estas estão em Escolas) |
| 4 | Atualização Cadastral | 🔧 | `AprovacaoCadastro.gs/.html`, `aprovarAtualizacaoCadastro` | Sem entrada própria no menu lateral (carregada por `initAprovacaoCadastro`); sem filas por estado (Pendentes/Em análise/Devolvidas/Rejeitadas) |
| 5 | Documentos | ✅ | Menu: Ofícios, Recibos, Declarações, Histórico; `Oficio*`, `Recibo*`, `Declaracao*` | Faltam Certidões, Modelos, Assinaturas, Protocolo como submódulos; Relatórios de Ofícios está solto fora do módulo |
| 6 | Benefícios | ✅ | Menu: China Park, Vouchers (+ Guriri/Assefaz/Histórico **ocultos**); `Voucher*` (19 `.gs`), `Reservaparquechina.gs` | Motor comum de benefícios não existe como serviço único; Oftalmológico foi encerrado e apagado (decisão do usuário, 13/11) |
| 7 | Financeiro | 🔧 | Menu: Painel, Despesas e Pagamentos, Receitas, Mensalidade, Taxas, Comunicação da Taxa, Prestadores, Patrimônio, Auditoria de Valores | Faltam Bancos (conciliação é do Condomob por decisão do usuário), Diretoria, Fluxo de Caixa, Prestação de Contas. **Patrimônio não pertence aqui** |
| 8 | Escolas | ✅ | Menu: Cadastro, Pendências, Visitas, Gestão de Visitas, Cobrança de Relação Nominal; `Escolas*.gs` (5) | Falta "Histórico 360°" e "Unidades/Grupos econômicos" como telas; entidade Escola única existe (identidade, 679 cadastros) |
| 9 | RH | ✅ | Menu único `rh`; `RH*.gs` (8) | Sem submódulos no menu (tudo numa tela); dashboard fraco |
| 10 | Jurídico | 🔧 | Menu `juridico`; `Juridico.gs` | Tela única; **Negociação Coletiva** está no menu como módulo próprio, mas pertence a Jurídico |
| 11 | Patrimônio | 🔧 | `PatrimonioAdmin.html` apenas | **Sem backend; só `localStorage`** (ver seção 1, item 2) |
| 12 | Central de Comunicação | 🔧 | Menu: só "Caixa de E-mails"; `Caixa*.gs` (13) | Faltam Enviados/Rascunhos dedicados, Campanhas, WhatsApp, Modelos, Assinaturas como telas; o serviço comum de e-mail/WhatsApp não é usado por todos os módulos |
| 13 | Eventos | ✅ | Menu: Painel, Eventos, Festa Compasso, Credenciamento, Sorteios; `Evento*`, `Compasso*`, `Bingo*` | Forte e testado; faltam Fornecedores/Orçamento/Prestação de contas como telas |
| 14 | Relatórios e BI | 🔧 | `Relatorios*.gs`; menu só "Relatórios de Ofícios" | Não há Dashboard Executivo de BI nem relatórios por módulo no menu |
| 15 | Governança e Diretoria | 🔧 | Menu `governanca`, `assembleias`; `Governanca.gs` (29 KB), `Assembleias.gs` | **Assembleias é módulo solto**; sem Pautas, Atas, Eleições, Verbas de Diretoria como telas |
| 16 | Auditoria e Compliance | ✅ | Menu com 9 telas; `Auditoria*`, `Lgpd*`, `Incidentes*` | Completo na estrutura; cobertura da trilha nos módulos é parcial (seção 6) |
| 17 | Configurações, Segurança e Integrações | 🔧 | Menu `config`; `SistemaConfig.gs`, `Acesso*` | Uma tela só; Usuários/Perfis/Integrações/Backup/Diagnóstico não são telas separadas |
| 18 | (Início de Sessão/Login) | ✅ | `Login1.gs`, `Sessao.gs` | Troca de senha e recuperação respondem sem sessão por desenho (rota de login) |

**Módulos mal posicionados (a reorganizar):** Negociação → Jurídico; Assembleias → Governança; Patrimônio → módulo próprio; Mensalidade/Taxas → Financeiro › Receitas/Cobranças (hoje são botões irmãos de "Receitas"); Relatórios de Ofícios → Documentos.
**Áreas de sindicato ausentes:** Prestação de Contas, Fluxo de Caixa, Eleições/Editais, Atas, Certidões, Campanhas de comunicação, Relatórios agendados.

---

## 4. Dashboards — três níveis

| Nível | Existe? | Evidência | Lacuna |
|---|---|---|---|
| **Geral** | ✅ | `getPainelExecutivoSISGEP` (`InicioExecutivo.gs`) | Cards clicáveis: **NÃO TESTADO** em tela |
| **Módulo** | parcial | `finDashboardExecutivo`, `auditoriaPainel`, `getDashboardBeneficioSimples`, `resumoDashboardEscolas`, `getDashboardOficiosData`, `dashboardVoucher`, `negcolPainel`, `caixaSecretariaPainel` | **Sem painel próprio:** RH (1 menção), Jurídico, Governança, Patrimônio (0), Sindicalização, Comunicação (Painel do Dia retirado por decisão de 03/11) |
| **Processo** | parcial | Fila de ofícios (`dashboardFila*`), China Park, Voucher, Cobrança (`cob_listarPainel`) | Pagamentos, Visitas, Processos Jurídicos sem painel de processo |

Regra do prompt ("mostra o que fazer agora", "cards clicáveis") só tem teste executável nos painéis que passam pela suíte; a aparência e o clique são **NÃO TESTADO** (jsdom não desenha).

---

## 5. Fluxos ponta a ponta

Critério do prompt: gatilho → entrada → validação → registro → encaminhamento → análise → aprovação → execução → confirmação → comprovação → integração → status → histórico → auditoria → encerramento. **Nada é "Completo" sem evidência no ar.**

| Fluxo | Classificação | Base da classificação |
|---|---|---|
| Ofícios (gerar → fila → enviar) | **Parcial** — única operação viva | Regras e fila testadas na suíte (77 testes); PDF e entrega do e-mail **NÃO TESTÁVEIS no emulador**; há histórico de fila travada (21/08) corrigida |
| Voucher (pedido → aprovar → emitir → enviar) | **Parcial** | 82 testes passam; protocolo sequencial só vale em 2027 (**NÃO TESTADO**); Central refinada **só na homologação** |
| Voucher por e-mail (Caixa → conferência → envio) | **Parcial / Não testado no ar** | Lógica testada; Gmail/KingHost reais e leitor em `PENDENTE-VERIFICACAO` |
| China Park (interesse → análise → aprovação → 2º formulário → autorização) | **Parcial** | `Reservaparquechina.gs` com testes; "consulta à Presidência" **não implementada por decisão do usuário**; só 8 de 28 funções que gravam têm registro |
| Despesas → pagamento → contabilidade | **Parcial** | `Despesas.gs` (13 gravam, 6 com log); conciliação bancária é do Condomob (fora do SISGEP por decisão) → fluxo nasce incompleto de propósito |
| Taxa Negocial / Assistencial | **Parcial** | 38 testes; recebimento e compensação não são do SISGEP (decisão de 03/11) |
| Sindicalização (ficha → OTP → assinatura → ofício de filiação) | **Parcial** | `Sindicalizacao*.gs`; `submeterFichaSindicalizacao`/`validarOTPEAssinarFicha` são públicas por desenho; OTP por e-mail **NÃO TESTÁVEL** |
| Atualização cadastral (portal → aprovação) | **Parcial** | `aprovarAtualizacaoCadastro` responde sem sessão (MEDIDO) — ver risco 1 |
| Ingressos da festa (TickOne) | **Não testado** no TickOne real | Robô só contra TickOne falso (t260/t261); 494 PDFs conferidos no Drive pelo conector |
| Eventos / Compasso (inscrição → credenciamento → sorteio) | **Parcial** | 81 testes; impressão e QR reais **NÃO TESTADOS** |
| RH, Jurídico, Governança, Negociação, Assembleias | **Não testado** como processo | Há teste de regra (24/5/1/2/10 testes citam), sem fluxo completo executado |
| Patrimônio | **Quebrado (conceitual)** | Sem servidor |

Cenários que o prompt exige (duplo clique, perda de sessão, arquivo inválido, falha de integração, estorno, reabertura): **cobertos de forma desigual** — há testes de duplicidade e CPF/CNPJ inválido nos módulos novos (Voucher, Ingressos, Escolas), e nenhum conjunto uniforme por módulo. **NÃO TESTADO** de forma sistemática.

---

## 6. Segurança, permissões, LGPD e auditoria

### 6.1 Exposição sem login — MEDIDO hoje
- 1.113 funções públicas · 826 protegidas · **199 expostas** · 88 inconclusivas · **77 expostas que gravam**.
- Concentração das expostas: `GuiasPagamento.gs` 25, `SistemaConfig.gs` 19, `Comprovantes.gs` 14, `Despesas.gs` 13, `MensalidadeCore.gs` 12, `Utils.gs` 8, `contatos.gs` 8, `Recibo.gs` 7, `Voucher.gs` 7.
- Parte é **legítima por desenho** (rotas públicas: inscrição do bingo e da festa, link de fornecedor/contabilidade por token, login e recuperação de senha, formulário do China Park, ficha de sindicalização). O `exposicao-teto.json` já registra essas decisões.
- **Parte não é**: funções administrativas (excluir/cadastrar prestador e receita, aprovar atualização cadastral, cobranças de mensalidade, gerar/cancelar guia, resetar memória da IA, `gerarHashInicialUsuarios123456`) sem checagem de sessão no corpo.
- O teste usa o emulador: **"respondeu" não prova exploração no ar**. Prova que a barreira não está na função.
- Já aceito pelo projeto como teto "só desce" (204 → hoje 199); a meta registrada é a separação dos projetos público/administrativo.

### 6.2 Permissões
Há um modelo de sessão + módulo por usuário (`exigirAdminOuSessao_`, `cxsMeuPapel_`, etc.) e a regra de cada um ver só a sua caixa (31/10). Só 2 usuários reais (administradores). Matriz completa de permissões por tela/anexo/exportação do prompt: **NÃO TESTADA** de forma sistemática.

### 6.3 LGPD
Existem `LgpdRetencao.gs` (painel, gatilho de expurgo), `Incidentes`, exportações e compartilhamentos auditados. Duas rotas públicas devolvem dado pessoal e já têm máscara/teto de consultas (`compasso_inscricaoPreencher`, `bingo_inscricaoPreencher`, fechado em 21/08). Rotina de expurgo em produção: **NÃO TESTADA no ar** (`instalarTriggerExpurgoLGPD` está entre as expostas).

### 6.4 Auditoria
- Trilha única `AuditoriaCore.auditar_` com os 14 campos e Firestore imutável — **o desenho atende o prompt**.
- Uso: 41 de 209 arquivos. Módulos financeiros e de documentos ainda usam logs próprios (`LOG_SISTEMA`, `DESPESAS_PAGAMENTOS_LOG`, `Historico_Guias`) — o próprio cabeçalho do arquivo já descreve a fragmentação.
- **HEURÍSTICA:** 221/453 funções que gravam com algum registro (49%). Lista de piores acima (item 5 do resumo).

---

## 7. Dados, Firebase e Apps Script

- **Banco real:** Google Sheets (Associados ~8.000, Escolas 679, abas por módulo). Firebase/Firestore aparece só em Eventos/Bingo e na trilha de auditoria (`FirebaseCore`, `EventosFirestore`, `AuditoriaCore`).
- O prompt pede coleções por entidade (`associados`, `escolas`, `despesas`, …). **Hoje não existem** — são abas. Migração é plano, não fato.
- **Limites:** planilha com teto de 10 milhões de células (risco documentado no `AuditoriaCore`); projeto Apps Script no limite de tamanho (produção recusou 9,874 MB); escopo global único (3.144 funções sem módulos), o que torna a exposição de 6.1 estrutural.
- **Entidade Escola única:** existe (`EscolasIdentidade.gs`, migração de 11/08), alinhada ao prompt.

---

## 8. SOFIA

Classificação por processo (Consultar / Sugerir / Preparar / Executar com confirmação):

| Processo | Hoje |
|---|---|
| Documentos de sindicalização, escolas | Consultar + Sugerir (`IA_DocumentosSindicalizacao`, `IA_AgentEscolas`) |
| Caixa de e-mails | Sugerir + Preparar (propõe categoria e resposta; **nada sai sozinho** — regra do usuário) |
| Despesas | Sugerir (`finClassificarHibridoIA` — responde sem sessão, MEDIDO) |
| Demais módulos | Não implementada |

Aprendizado do robô (registrar → usar → medir → subir de nível) existe na Caixa (`CaixaRoboNiveis`, `Memoria*`); a diretriz de 30/10 vale para os módulos novos. Taxa de acerto no ar: **NÃO TESTADA**.

---

## 9. Tempo economizado

Para todos os processos: **"Estimativa pendente de medição operacional."** O sistema não mede hoje tempo de execução por processo; a única operação em uso é Ofícios. Proposta de medição: registrar início/fim de cada ofício emitido (a trilha já tem data/hora) e comparar com o tempo manual declarado pela Marcela, por 2 semanas.

---

## 10. Índice de maturidade (JULGAMENTO do auditor, 0–10)

| Dimensão | Nota | Justificativa |
|---|---|---|
| Arquitetura | 5 | Escopo global único e 3.144 funções; mas módulos coesos por prefixo e entidade Escola única |
| Processos | 5 | Ofícios/Voucher/Eventos bem desenhados; RH/Jurídico/Governança em tela única |
| UX operacional | 6 | Design System, mockup antes de implementar, Caixa no formato Outlook; telas lentas/grandes não medidas |
| Dashboard | 5 | 8 de ~13 módulos têm painel de ação |
| Integração | 5 | Caixa↔Ofícios↔Voucher↔Despesas integrados; sem motor comum de benefícios nem de comunicação |
| Segurança | **3** | 199 funções sem barreira de sessão, 77 gravam; app anônimo executando como dono |
| LGPD | 5 | Retenção, incidentes, máscara em rotas públicas; expurgo e matriz de acesso não provados |
| Auditoria | 5 | Desenho excelente; adoção em ~20% dos arquivos |
| Automação | 6 | Robôs de e-mail/fichas/ingressos com "nada sai sozinho"; ainda sem medir acerto no ar |
| SOFIA | 4 | Assistentes locais; não é camada transversal |
| Testabilidade | 7 | 274 arquivos / 9.595 asserções, emulador próprio, t46/t250/t6 como travas |
| Escalabilidade | 3 | Planilha como banco, teto de células, limite de tamanho do projeto |
| Manutenibilidade | 4 | Documentação farta, mas `PENDENTE-VERIFICACAO` com 7 mil linhas e índice parado em 31/08 |
| **Maturidade geral** | **5** | Sólido onde há uso real (Ofícios, Voucher, Eventos); frágil em segurança e em módulos ainda só "construídos" |

---

## 11. Roadmap e prioridades

**P0 — Segurança (sem mudar comportamento visível)**
1. Fechar as 77 funções expostas que **gravam** e são administrativas: guarda de sessão/perfil no corpo, uma família por vez (Prestadores/Receitas → Mensalidade → Guias → Voucher → Config). Cada família: teste que prova "sem sessão recusa" **e** "com sessão continua funcionando", antes de publicar. Teto do t6 desce a cada rodada.
2. Confirmar no ar (com você, em homologação): chamar uma dessas funções sem login e ver a recusa.
3. Remover/restringir `gerarHashInicialUsuarios123456` e demais `setup*/instalar*/configurar*` expostas (rodar uma vez, depois só administrador).

**P1 — Estrutura (a janela é agora, o sistema não está em operação fora de Ofícios)**
4. Patrimônio: backend em aba própria com auditoria, ou retirar do menu até existir.
5. Reorganizar menu: Negociação → Jurídico, Assembleias → Governança, Patrimônio → módulo, Mensalidade/Taxas → Receitas.
6. Dashboards de ação para Jurídico, RH, Governança, Sindicalização.

**P2 — Auditoria e dados**
7. Levar `Recibo`, `GuiasPagamento`, `Despesas`, `Reservaparquechina`, `DeclaracaoDiretor`, `CompassoIngressosDados` para `auditar_`.
8. Decidir banco: continuar em planilha com teto monitorado ou migrar entidades críticas para Firestore.

**P3 — Produto**
9. Motor comum de benefícios e serviço comum de comunicação; SOFIA transversal; medição de tempo economizado.

**Fora do alcance desta auditoria / depende de você:** o que está **no ar** (confirmar versão de produção e arquivos), a medição operacional e a matriz de permissões por perfil.

---

## 12. Plano de testes e reteste

- **Já existe e deve continuar barrando publicação:** t46 (integridade), t250 (função chamada existe), t6 (exposição), t45 (tamanho), suíte inteira.
- **A criar (próxima rodada):** (a) `t-sem-sessao-recusa`: para cada função administrativa listada em P0, chamada sem token → `ok:false`; com token válido → comportamento atual; (b) fumaça de dashboards: cada painel devolve números e cada card tem destino; (c) matriz de permissões: por perfil × tela × ação, gerada do `appsscript`/`SistemaConfig`.
- **Só no ar (roteiro manual):** impressão de ofício, entrega de e-mail, Gmail/KingHost, TickOne, canhotos no papel, gatilhos (expurgo, limpeza de sessão, robô das 20h).

## 13. Critérios de conclusão

Um módulo só é dado como **Completo** quando: (1) teste executável do fluxo inteiro; (2) o item correspondente de `PENDENTE-VERIFICACAO` fechado **pelo usuário**; (3) trilha de auditoria nas ações que gravam; (4) nenhuma função administrativa do módulo no `exposicao-detalhe` como exposta.

## 14. Plano de implantação e migração

- **Implantação:** cada rodada de P0 passa por homologação, a suíte, e só então produção, com o modo `conferir` mostrando o diff antes (como já é feito).
- **Migração:** não há migração de dados proposta nesta rodada. Se Patrimônio ganhar backend, o `localStorage` existente é descartável (sem dado real conhecido — **confirmar com quem digitou**).
- **Reversão:** o deploy de produção já guarda cópia do estado anterior em artefato do GitHub; qualquer rodada de P0 pode voltar para a versão anterior.

---

## 15. As funções entregam o que foi proposto? (adendo de 20/11/2026)

Duas medições novas, executadas hoje. **Não substituem o teste do fluxo no ar.**

### 15.1 Chamada de cada função que a tela usa, com sessão de administrador — MEDIDO
Script: chama no emulador, com token de administrador e sem outros argumentos, as 489 funções do servidor que alguma tela chama (43 de efeito colateral foram puladas: excluir, enviar, instalar, importar…).

| Resultado | Qtde | Leitura |
|---|---|---|
| Devolveu dado (`ok`) | 159 | respondem |
| Devolveu `ok:false` | 199 | normal sem argumento (falta o parâmetro); **não prova defeito nem prova entrega** |
| Recusou por permissão | 62 | barreira funcionando |
| Falhou por entrada vazia ou ambiente | 26 | ver abaixo |
| **Quebrada (nome/constante inexistente em tempo de execução)** | **0** | nenhuma função chamada pela tela cai em `ReferenceError` |

Das 26 que falharam: **18 dependem de Firebase configurado** (Bingo e painéis de Eventos: `bingo_*`, `compasso_executivoResumo`, `compasso_validacaoResumo`, `painelEmissao_status`) e 2 de Eventos V2 bloqueado por desenho — **o emulador não tem Firebase; essas funções ficam NÃO TESTADAS aqui.** As demais pedem aba/dado que o emulador sem semente não tem (Recibo, Sindicalização, Escolas) ou validam entrada (`identificarSolicitanteVoucher`: "Informe um CPF válido"). Uma única é fragilidade real de entrada vazia: `painelEmissao_emitirGrupo` estoura com `Cannot read properties of undefined (reading 'length')` quando chamada sem lista.

### 15.2 Quanto do que a tela oferece tem teste que a exercita — HEURÍSTICA
Cruzei as funções do servidor chamadas por cada tela com os nomes citados nos 274 arquivos de teste: **509 funções chamadas por 86 telas; 221 (43%) aparecem em algum teste.** Citar o nome é o piso — a função pode ser exercitada por outra, ou o teste só mencionar. Onde a cobertura é mais fraca:

| Tela / módulo | Funções que a tela chama | Citadas em teste | Sem teste |
|---|---|---|---|
| `RHAdmin.html` (RH) | 35 | 2 | **33** |
| `JuridicoAdmin.html` (Jurídico) | 28 | 1 | **27** |
| `Parquechinaadmin.html` (China Park, admin) | 31 | 6 | **25** |
| `CentralemailIA.html` (Central de e-mail IA, legado) | 20 | 0 | **20** |
| `ComprovantesNF.html` (Comprovantes / NF) | 16 | 0 | **16** |
| `Scripts_Despesas.html` (Despesas) | 22 | 11 | 11 |
| `Scripts_Recibos.html` (Recibos) | 13 | 3 | 10 |
| `CobrancaAdmin.html` (Cobrança de relação nominal) | 11 | 1 | 10 |
| `VisitasAdmin.html` / `VisitasCampo.html` (Visitas) | 9 / 7 | 0 / 0 | 9 / 7 |
| `VerbasAdmin.html`, `TaxasAdmin.html` | 6 / 5 | 0 / 0 | 6 / 5 |

Em contraste, `OficiosScripts.html` (Ofícios) tem 32 de 40 citadas — o módulo vivo é o mais coberto.

### 15.3 Conclusão sobre "entregam o que foi proposto"
- **Entregam, com evidência executada:** Ofícios, Voucher, Escolas, Eventos/Compasso, Caixa de e-mails, Taxas e Sindicalização — as regras passam na suíte; e nenhuma função chamada pela tela está quebrada por nome inexistente.
- **Não dá para afirmar (módulo construído, sem teste do que a tela oferece):** RH, Jurídico, China Park (parte administrativa), Comprovantes/NF, Cobrança, Visitas, Verbas, Taxas (tela). Veredito: **NÃO TESTADO**.
- **Não dá para provar neste ambiente:** Bingo e painéis de Eventos que dependem de Firebase, PDF, e-mail, impressão, gatilhos.
- **Quebrado de fato (conceitual):** Patrimônio (só `localStorage`).
- **Para fechar a pergunta de verdade** é preciso, módulo a módulo, o fluxo completo do prompt — começando por RH, Jurídico e China Park admin, que têm mais função sem teste que com teste.

### 15.4 Fluxos completos executados em 20/11/2026 (RH, Jurídico, China Park admin)
Três testes novos, ponta a ponta, no emulador (suíte: 277 arquivos, 9.726 asserções, 0 falha):

| Módulo | Teste | Asserções | Resultado | Achados |
|---|---|---|---|---|
| RH | `t279-rh-fluxo-completo` | 54 | **Parcial** (regra provada; holerite PDF/e-mail e gatilhos NÃO TESTÁVEIS aqui) | Permissão por módulo e por administrador, pró-rata, regerar sem duplicar, reajuste (desligado fora), 13º/férias com duplicidade e estorno com motivo — tudo conforme. Observação: o estorno de evento **não cancela a despesa já criada no Financeiro** (avisa na mensagem; é manual); as ações do RH não usam a trilha única `auditar_` |
| Jurídico | `t280-juridico-fluxo-completo` | 44 (+1 atenção) | **Parcial** (IA, DataJud, Drive e Agenda reais NÃO TESTÁVEIS) | **Achado real, latente:** `jurSalvarPrazo` com `id` **reabre** um prazo já cumprido se `cumprido` não for enviado. Nenhuma tela chama essa edição hoje (a tela só cria prazo), por isso fica como ATENÇÃO, não falha. Correção de uma linha quando for editar. "Excluir processo" só desativa (`ATIVO=NAO`), não apaga |
| China Park (admin) | `t281-chinapark-admin-fluxo` | 33 | **Parcial** (ofício/PDF/e-mail NÃO TESTÁVEIS; check-in e check-out não puderam ser exercitados sem o ofício) | Módulo benefícios **e** administrador exigidos; suíte obrigatória e específica na aprovação; conflito de suíte barrado tanto na aprovação quanto no agendamento manual; pagamento parcial/total/acima do total; recusa, cancelamento e no-show exigem motivo; duplo clique tratado; suíte liberada pelo cancelamento volta a ficar disponível |

Cobertura de função-citada-em-teste para essas três telas: antes 2/35, 1/28 e 6/31; agora cobrem o fluxo principal de cada uma. Restam sem teste de fluxo: Cobrança, Visitas, Verbas, Comprovantes/NF, Central de e-mail IA (legado), Recibos e Despesas (parte).
