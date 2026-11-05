# Levantamento de custo de IA — SISGEP (05/11/2026)

Pedido do usuário: *"fazer um levantamento do sistema inteiro, o que pode ser
aproveitado, como caching ... para que o sistema fique cada vez menos custoso
e mais eficiente."*

Descreve o **repositório**. O custo real só se confere em
console.anthropic.com → Usage. Todo o sistema usa **Claude Haiku 4.5** (o mais
barato); trocar de modelo não economiza.

## Onde o sistema chama a IA

| # | Onde | Quando roda | Já economiza? | O que dá para fazer |
|---|---|---|---|---|
| 1 | **Robô da memória** (`MemoriaEvolutiva.gs`) | gatilho, 1×/dia | ✅ desde a v755: pula e-mail gerado pelo SISGEP, só chama com algo novo | — |
| 2 | **Sofia** (`ChatIACore.gs`) | a cada pergunta | ✅ em HML (05/11): regras + Estatuto/CCT em bloco com cache | publicar em produção |
| 3 | **Leitura de fichas do Drive** (`OficiosFichasDrive.gs` → `oficiosFichasLer`) | clique "Ler ficha" | ❌ **relê o PDF inteiro a cada clique** | **guardar a leitura** pelo arquivo (id + data de alteração); só relê se o arquivo mudar ou com "Ler de novo" |
| 4 | **Ler comprovante** (Caixa) | clique / robô 20h | ✅ guarda a leitura | — |
| 5 | **Ver ofício** do e-mail (`CaixaOficioEmail.gs`) | clique | ✅ CacheService (até 6 h) | — |
| 6 | **Sugerir resposta** (Caixa) | clique | ✅ CacheService por mensagem | — |
| 7 | **Categorizar a Caixa do Financeiro** (`cxsClassificarFinanceiro_`) | ao abrir a Caixa | ✅ em lote, guarda o tipo, textos cortados | — |
| 8 | **Pedidos de voucher** (`vpeProcessarThread_`) | leitura da ponte | ✅ só conversa nova | lê anexos (PDF/imagem): ver nota A |
| 9 | Funções de texto (`IA_Funcoes.gs`, `IA_Oficios.gs`, `Juridico.gs`, `IA_DocumentosSindicalizacao.gs`) | clique "melhorar texto" etc. | prompt curto | nada a ganhar |
| 10 | Financeiro IA (`FinanceiroIA.gs`) | clique "insights" | — | medir se é usado; se for, guardar o resultado do dia |
| 11 | Legados (`CentralEmailIA.gs` pré-categorização, `MensalidadeCore.gs processarEmailsMensalidade`, `MemoriaCore extrairEstiloCobrancas`) | **sem gatilho ligado** (conferido no editor, 05/11) | não gastam hoje | não religar sem necessidade |

## Por que o caching NÃO vale na maioria

A Anthropic só guarda em cache um trecho fixo **grande** (no Haiku, a partir de
uns 4 mil tokens ≈ 14 mil caracteres). Só a Sofia tem isso (Estatuto 75 mil
caracteres + CCT 10 mil). Os prompts da Caixa, do comprovante e das funções de
texto têm a parte fixa curta: com cache, pagariam igual.

Nesses, a economia certa é **não chamar de novo o que já foi lido** — que a
maioria já faz (itens 4 a 8). O que falta é o item 3.

## Nota A — documentos e imagens são o que mais pesa por chamada

Uma página de PDF escaneado vira ~1.500 a 3.000 tokens. Ficha com 5 páginas,
relida 3 vezes, custa 15 leituras de página. Guardar a leitura (item 3) é a
economia mais direta que sobra.

## Ordem sugerida

1. Publicar em produção o cache da Sofia (já em HML).
2. Guardar a leitura das fichas do Drive (item 3).
3. Daqui a 7 dias: comparar a conta (Usage) antes e depois; contar as linhas
   da aba `Sofia_Auditoria` para saber quanto a Sofia é usada.
4. Só depois disso, olhar o item 10 com número na mão.
