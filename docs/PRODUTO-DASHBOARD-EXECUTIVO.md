# Dashboard Executivo — proposta de produto (06/11/2026)

Pedido do usuário: *"seja um gestor de projeto, um analista, um designer ...
olhe como um produto que vai impactar quem está vendo, quem está trabalhando,
que facilite a vida das pessoas, que automatize tarefas."*

Mockup de referência: `docs/mock-dashboard-executivo.png` (números de exemplo).

---

## 1. Visão

**A página inicial é a mesa de trabalho do dia.** Quem entra sabe em 10
segundos o que precisa fazer, e encontra o trabalho **já preparado pelo
robô**: a pessoa confere e clica. É o "funcionário que aprende" do CLAUDE.md
visto de fora — e é isso que vende o sistema.

Frase-guia: *"o SISGEP já fez a parte chata; você só decide."*

## 2. Quem usa e o que cada um precisa ver

> **DECIDIDO (06/11/2026):** são **só 2 usuários — Wanderson e Marcela — e
> os dois são administradores.** Os dois veem o sindicato inteiro. A única
> diferença é a CAIXA DE E-MAIL (regra de 31/10): a Marcela vê a secretaria@,
> o Wanderson a financeiro@. Não há perfil "diretoria" separado.


Mesmo desenho para todos; **o conteúdo muda pelo perfil** (a trava continua
no servidor).

| Perfil | Precisa ver primeiro |
|---|---|
| **Financeiro / administrador** (Wanderson) | guias e boletos, notas fiscais, e-mails da financeiro@, comprovantes lidos, pagamentos do China Park, visão do sindicato inteiro |
| **Secretaria** (Marcelha / Marcela) | ofícios (fila, erro, reenvio, fichas do Drive), e-mails da secretaria@, certificados de bolsa, sindicalização |
| **Diretoria** (a confirmar) | números do mês: filiações × desfiliações, ofícios enviados, eventos, prazos jurídicos, assembleias |

## 3. Princípios (valem para toda tela nova)

1. **Todo número leva a uma ação.** Número que não abre nada sai da tela.
2. **O robô trabalha antes da pessoa.** O item chega "pronto para conferir":
   ofício preenchido pela ficha, e-mail categorizado com resposta sugerida,
   comprovante lido, guia gerada.
3. **Nada sai sozinho.** Resolver = conferir + um clique, sempre com
   confirmação (regra de 29/10).
4. **Mostrar o ganho.** "Hoje o robô preparou 14 tarefas para você" — é o
   número que convence quem compra e quem usa.
5. **Só dado com fonte.** O que o sistema não sabe não aparece inventado; a
   origem fica à vista (REGRA 0.6).

## 4. A tela (mockup)

1. Topo: saudação + resumo do dia ("23 assuntos, 4 urgentes"), "Peça à
   Sofia", Sofia pequena no canto.
2. Seis indicadores: urgente hoje · e-mails · ofícios · guias e boletos ·
   notas fiscais · benefícios.
3. **Precisa de você agora** — lista por urgência, cada linha com o botão
   que resolve.
4. **O sindicato por área** — oito blocos com número e atalho.
5. **Chegou agora** — o que entrou nas últimas horas.
6. Menu com contadores; sino com avisos de verdade.
7. *(nova, proposta)* **O robô já preparou** — "4 ofícios prontos pelas
   fichas · 12 e-mails categorizados · 8 comprovantes lidos".

## 5. Fases

| Fase | Entrega | Ganho para quem usa |
|---|---|---|
| **1 — Painel real** | a tela do mockup com fontes reais, por perfil; links levando à lista certa; sino real; correção do que hoje está quebrado (sino falso, "?", "WC", "Ver todas") | abrir o sistema e saber o que fazer |
| **2 — Resolver daqui** | botões que resolvem sem sair da tela, para as 3 tarefas mais frequentes: reenviar ofício com erro, enviar guia, aprovar reserva | menos cliques por tarefa |
| **3 — O robô prepara** | boletos vencendo → aviso pronto para a escola; fichas do Drive → ofício pronto; e-mail → resposta pronta (já existe parte) | trabalho chega feito |
| **4 — Medir e vender** | painel de produto: tarefas resolvidas, tempo médio, % preparada pelo robô, acerto do robô por tarefa | número para a diretoria e para vender |

## 6. Como saber se deu certo

- Tempo para a pessoa saber o que fazer ao entrar: **< 10 s**.
- Cliques para resolver as 3 tarefas mais comuns: **cair pela metade** na fase 2.
- % de tarefas que chegam preparadas pelo robô: medir a partir da fase 3.
- Nenhum número na tela sem fonte (teste automático).

## 7. Decisões que dependem do usuário

1. Os perfis estão certos? Quem mais usa (diretoria, outro funcionário)?
2. Fontes que talvez não existam: **vencimento dos boletos** e **pagamento
   do China Park** — se o SISGEP não guarda, o item sai ou vira fase 3.
3. Sino: avisos de verdade (proposta) ou tirar.
4. Aprovar a ordem das fases e começar pela fase 1.

## 8. Mapa de fontes (levantado no código em 06/11/2026)

| Número do mockup | De onde sai | Situação |
|---|---|---|
| E-mails a tratar | `caixaResumoDoDia` (Caixa, por caixa de cada um) | ✅ existe (já está na Home) |
| E-mails chegados hoje | data das conversas da Caixa | 🟡 dado existe, falta a conta |
| Ofícios: fila · erro · e-mail voltou | `getDashboardOficiosData` (FilaOficios / Monitoramento) | ✅ existe — hoje soma os três num número só |
| Ofícios do mês por tipo | registro dos ofícios emitidos | 🟡 dado existe, falta a conta |
| Escolas que não descontaram | `oficiosConferenciaMensal` | ✅ existe |
| Fichas novas no Drive | `ofdLinhas_` (robô das fichas) | ✅ existe |
| Certificados de bolsa para conferir / faltam documentos | `voucherPedidosPainel` | ✅ existe |
| China Park — reservas aguardando | `Reservaparquechina.gs`, STATUS = PENDENTE | ✅ existe |
| China Park — pagamento a confirmar | STATUS_PAGAMENTO e VENCIMENTO_PAGAMENTO da reserva | ✅ existe |
| Notas fiscais aguardando | `obterResumoDespesas_interno_` | ✅ existe (já está na Home) |
| Escolas com cadastro incompleto | `listarEscolasCadastro` | ✅ existe (já está na Home) |
| Festa — inscritos / dias | Compasso (importação das inscrições) | ✅ existe |
| Comprovantes lidos pelo robô | `Caixa_Comprovantes_Lidos` | ✅ existe |
| **Guias sindicais e boletos das escolas — a enviar / vencendo** | `TaxasSindicais.gs` tem VENCIMENTO e STATUS, mas **quem pagou é controlado no Condomob** (decisão de 03/11) | ⚠️ **não confiável no SISGEP**: o SISGEP não sabe quem já pagou, então "vencendo" mostraria escola que já pagou. Ver decisão abaixo |
| Guias de pagamento (contas a pagar a prestadores) | `GuiasPagamento.gs` — LEGADO no cabeçalho | ⚠️ é outra coisa (pagar prestador), não boleto de escola |
| "O robô já preparou" | soma de fichas lidas + e-mails categorizados + comprovantes lidos | 🟡 dados existem, falta a conta |

**Decisão pendente — Financeiro (guias e boletos):** sem o Condomob, o
SISGEP não sabe o que foi pago. Opções: (a) o card mostra só o que o SISGEP
faz — guias **emitidas e enviadas** no mês, sem "vencendo"; (b) esperar o
Robô do Condomob (descrito em 03/11) para trazer quem está devendo.
