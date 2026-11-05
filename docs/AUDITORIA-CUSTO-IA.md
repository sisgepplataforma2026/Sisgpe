> **CORREÇÃO (05/11/2026, ao implementar):** a leitura das fichas do Drive
> **já fica guardada** (`LEITURA_JSON` em `OficiosFichasDrive.gs`), e a tela
> só oferece "Ler com o robô" para ficha ainda não lida. O item "Ler ficha do
> Drive relê o PDF a cada clique" estava **errado** — eu li o código pela
> metade. Não há o que fazer ali; a economia de fichas do relatório é zero.

# Auditoria de custo de IA — SISGEP (05/11/2026)

Pedido do usuário: o prompt "AUDITORIA E OTIMIZAÇÃO DE CUSTOS DE IA". Regra
dele: **nada de código novo antes da aprovação expressa.**

**Escopo:** descreve o **repositório**. Não tive acesso ao painel da
Anthropic nem às planilhas de produção. Legenda:
**[MEDIDO]** = medido no emulador com o código real;
**[CÓDIGO]** = lido no código;
**[ESTIMADO]** = conta minha, com a premissa ao lado;
**[FALTA DADO]** = depende de número que só existe no ar.

> ⚠️ **Transparência:** antes deste pedido, a pedido do usuário ("Clarooo"),
> eu já tinha implementado o *prompt caching* da Sofia — **está só na
> homologação**, não em produção. Esta auditoria mostra que ele tem um risco
> que eu não tinha dito (item 2.A). A decisão de manter, ajustar ou desfazer
> fica com o usuário.

---

## 1. Diagnóstico

### 1.1 Preços usados (Claude Haiku 4.5 — o único modelo do sistema) [CÓDIGO + tabela pública]

| | US$ por milhão de tokens |
|---|---|
| Entrada | 1,00 |
| Saída | 5,00 |
| Gravar no cache (5 min) | 1,25 |
| Gravar no cache (1 h) | 2,00 |
| Ler do cache | 0,10 |

Cache nativo só vale com **trecho fixo ≥ ~4.096 tokens** (mínimo do Haiku
4.5); abaixo disso a API simplesmente não guarda. Português ≈ 3,5–4
caracteres por token.

### 1.2 Onde o sistema chama a IA [CÓDIGO]

| # | Ponto | Gatilho | Já evita repetir? |
|---|---|---|---|
| 1 | Robô da memória (`MemoriaEvolutiva.gs`) | gatilho 1×/dia | ✅ v755 |
| 2 | Sofia (`ChatIACore.gs`) | cada pergunta | resposta: não; prompt: cache em HML |
| 3 | Ler ficha do Drive (`OficiosFichasDrive.gs`) | clique | ❌ relê o PDF a cada clique |
| 4 | Ler comprovante (`CaixaFerramentas.gs`) | clique / robô 20h | ✅ guarda a leitura |
| 5 | Ver ofício do e-mail (`CaixaOficioEmail.gs`) | clique | ✅ CacheService |
| 6 | Sugerir resposta (Caixa) | clique | ✅ CacheService por mensagem |
| 7 | Categorizar Caixa do Financeiro | abrir a Caixa | ✅ lote de 20, guarda o tipo |
| 8 | Pedidos de voucher (`VoucherPedidosEmail.gs`) | leitura da ponte | ✅ só conversa nova |
| 9 | Funções de texto (IA_Funcoes, IA_Oficios, Jurídico, Documentos) | clique | prompt curto |
| 10 | Insights do Financeiro (`FinanceiroIA.gs`) | clique | [FALTA DADO] se é usado |
| 11 | Legados (CentralEmailIA, processarEmailsMensalidade, extrairEstiloCobrancas) | **sem gatilho** (editor, 05/11) | não gastam |

### 1.3 Tamanho real dos prompts da Sofia [MEDIDO no emulador]

| Pergunta | Parte fixa | Prompt total | Tokens (≈) |
|---|---|---|---|
| "quem pode votar na assembleia?" (Estatuto inteiro) | 77.297 car. | 78.415 car. | **~20–22 mil** |
| "qual o piso salarial na CCT?" (CCT inteira) | 12.234 car. | 13.352 car. | ~3,3–3,8 mil |
| "quantos associados temos?" | 1.336 car. | 2.454 car. | ~0,7 mil |

No ar o total é **maior** (a memória do sindicato entra com até 30 mil
caracteres e há dados reais) — [FALTA DADO] do tamanho exato.

### 1.4 O que o sistema NÃO mede hoje [CÓDIGO]

A resposta da Anthropic traz `usage` (tokens de entrada, saída, cache gravado
e cache lido) — **nenhum ponto do sistema guarda isso**. Também não se mede o
tempo de cada chamada. Por isso não existe "custo por módulo" real: **é o
primeiro desperdício a corrigir, porque sem ele toda economia é chute.**

---

## 2. Estratégias, módulo a módulo

### 2.A Sofia — prompt caching nativo

- **Comprovado:** a parte fixa (regras + Estatuto) é idêntica entre perguntas
  diferentes [MEDIDO, teste t238].
- **Risco que eu não tinha dito:** gravar no cache custa **25% a mais** que
  enviar normal. Só compensa se a mesma parte fixa for **reusada dentro de 5
  minutos**:

  | Usos em 5 min | Custo da parte fixa vs. sem cache |
  |---|---|
  | 1 (pergunta isolada) | **+25% (mais caro)** |
  | 2 | −32% |
  | 3 | −55% |
  | 5 | −67% |

- **Perguntas só sobre a CCT** (~3,5 mil tokens) ficam **abaixo do mínimo**
  de 4.096: o cache não age, nem ajuda nem atrapalha.
- **A "segunda leitura"** raramente aproveita: quando ela acontece é porque o
  documento NÃO estava no 1º prompt, então o 2º prompt tem outra parte fixa.
- **Cache de 1 hora** (gravar 2×) compensa a partir de 3 usos na hora.
- **Recomendação:** manter na homologação e **decidir com dado** — a aba
  `Sofia_Auditoria` tem a hora de cada pergunta: se a maioria vem em
  conversas (várias perguntas em minutos), publicar; se vem espaçada, desfazer.
- Validade/invalidação: automática (a Anthropic expira em 5 min; se o
  Estatuto mudar, o texto muda e o cache não casa — nunca responde com texto
  velho). Sem risco de dado desatualizado nem de privacidade (a parte fixa não
  tem dado pessoal; os dados do sistema ficam fora do cache).

### 2.B Sofia — cache de respostas
**Não recomendado.** A resposta depende de dados que mudam (associados,
escolas) e de quem pergunta (permissão). Reaproveitar resposta arrisca
informação velha ou de outro perfil — fere a regra 3 do pedido.

### 2.C Ler ficha do Drive — cache de resposta (guardar a leitura)
- **Desperdício comprovado [CÓDIGO]:** cada clique reenvia o PDF inteiro.
  Página escaneada ≈ 1.500–3.000 tokens [ESTIMADO, faixa da documentação].
- **Proposta:** guardar a leitura por arquivo, com chave = id do arquivo +
  data de alteração + tamanho; invalida sozinha se o PDF mudar; botão "Ler de
  novo" força. Igual ao "Ler comprovante", que já funciona assim.
- Desempenho: **melhora** (2ª abertura instantânea). Risco: baixo — a
  conferência com o cadastro (CPF, escola) continua rodando na hora, só a
  leitura do papel é reaproveitada. Não toca na emissão de ofício.

### 2.D Cache de dados e consultas
- A Sofia lê planilhas a cada pergunta para montar o contexto. Isso custa
  **tempo** (Apps Script), não dinheiro de IA. [FALTA DADO] quanto tempo.
  Investigar só se a Sofia for usada de verdade.
- CacheService/PropertiesService são gratuitos (limites: 100 KB por chave,
  até 6 h). **Custo de infraestrutura adicional: zero.**

### 2.E Trocar IA por regra
- Categorizar a Caixa: já há regra para Ofícios (`cxsOficioPorRegra_`).
  Remetentes automáticos conhecidos (banco, boleto, notificação) poderiam ser
  classificados por regra antes de ir à IA. Economia pequena (o lote de 20 já
  divide o custo). Prioridade baixa.
- Leitura de comprovante/ficha/documento de voucher: **precisa** de IA (papel
  escrito à mão, PDF escaneado).

### 2.F Robô da memória
Já otimizado (v755). Única melhoria possível: guardar o `usage` (item 1.4).

---

## 3. Simulação de economia [ESTIMADO]

Sem o volume real, a conta é por **cenário**. Premissas declaradas; cada
economia contada uma vez só.

**Premissas comuns:** Sofia — 60% das perguntas com Estatuto (~21 mil tokens
de entrada, ~500 de saída), 40% curtas (~1 mil). Fichas — 4 páginas por PDF,
2.000 tokens por página, cada ficha aberta 2× em média. Preço da seção 1.1.

| Cenário | Perguntas à Sofia/mês | Perguntas em sequência (<5 min) | Fichas/mês |
|---|---|---|---|
| Conservador (hoje: sistema ainda não operado) | 30 | 20% | 20 |
| Intermediário | 300 | 50% | 100 |
| Otimista (equipe usando todo dia) | 1.000 | 70% | 300 |

| | Conservador | Intermediário | Otimista |
|---|---|---|---|
| Sofia hoje | ~US$ 0,46 | ~US$ 4,65 | ~US$ 15,50 |
| Sofia com cache 5 min | ~US$ 0,47 (**+2%, sem ganho**) | ~US$ 3,50 (−25%) | ~US$ 8,85 (−43%) |
| Fichas hoje | ~US$ 0,35 | ~US$ 1,7 | ~US$ 5 |
| Fichas guardando a leitura | ~US$ 0,18 | ~US$ 0,9 | ~US$ 2,5 |
| **Economia líquida/mês** | **~US$ 0,15** | **~US$ 2** | **~US$ 9** |

Custo de infraestrutura: zero (serviços do Apps Script). Custo de
manutenção: duas funções pequenas, com teste.

**Leitura honesta:** com o uso de hoje, a economia é de centavos. O valor real
aparece quando a equipe começar a operar — e o maior ganho já foi feito no
robô da memória (que rodava sozinho, todo dia, sem ninguém pedir).

---

## 4. Testes e validação propostos

1. **Antes de tudo — medir (item 1.4):** guardar, de cada chamada, módulo,
   tokens de entrada/saída/cache, tempo e erro numa aba `IA_Uso`. Sem isso não
   há linha de base nem P95.
2. **Sofia com e sem cache** (HML, 2 semanas): mesmas perguntas reais;
   comparar tokens (`cache_read_input_tokens`), tempo médio e P95, e a
   resposta (mesmo artigo citado, mesma fonte). Aprovar se: tokens cobrados
   caem ≥ 20%, P95 não piora > 10%, nenhuma resposta muda de fonte.
3. **Fichas:** abrir a mesma ficha 2×: a 2ª não chama a IA; trocar o PDF: a
   leitura nova chama; "Ler de novo" chama.
4. **Monitoramento:** contador semanal na aba `IA_Uso` (custo por módulo).
5. **Reversão:** cada mudança é um arquivo isolado; produção volta pela
   versão anterior do deploy (hoje 755), sem perda de dado.

---

## 5. Relatório final

| Módulo | Custo atual | Recomendado | Economia estimada | Desempenho | Risco | Prioridade |
|---|---|---|---|---|---|---|
| **Medição de uso (todos)** | não medido | registrar `usage` e tempo | habilita todas as outras | neutro | muito baixo | **1** |
| **Ler ficha do Drive** | relê o PDF a cada clique [CÓDIGO] | guardar a leitura (id+data) | ~50% do módulo [ESTIMADO] | **melhora** | baixo | **2** |
| **Sofia** | ~21 mil tokens por pergunta de Estatuto [MEDIDO] | cache nativo **só se** houver perguntas em sequência | −43% a **+2%** [ESTIMADO] | neutro/melhora | médio (pode encarecer) | **3 — decidir com dado** |
| Robô da memória | já otimizado (v755) | — | já feita | — | — | feito |
| Comprovante, Ver ofício, Sugerir resposta, Voucher | já guardam | — | — | — | — | — |
| Categorizar Caixa | lote de 20, guarda | regra p/ remetente automático | pequena | neutro | baixo | 5 |
| Insights Financeiro | [FALTA DADO] | medir antes | ? | — | — | 4 (após medir) |
| Funções de texto | prompt curto | nada | ~0 | — | — | — |
| Sofia — cache de resposta | — | **não fazer** | — | — | alto (dado velho) | descartado |

### Diagnóstico geral
Arquitetura já econômica: modelo mais barato, quase tudo que é lido é
guardado, rotinas antigas desligadas. O maior gasto automático (robô da
memória) foi corrigido hoje. **O ponto fraco é não medir.**

### Plano por etapas (cada uma só com aprovação)
1. Medição de uso → HML → produção.
2. Guardar leitura das fichas → HML → produção.
3. Após 2 semanas de medição: decidir o cache da Sofia (publicar ou desfazer).
4. Revisar insights do Financeiro e regras da Caixa com os números.

### Riscos e prevenção
- Cache que encarece (Sofia com perguntas isoladas) → decidir por dado.
- Dado velho → nunca guardar resposta que dependa de cadastro; chaves com
  data do arquivo; TTL curto.
- Privacidade → nada de dado pessoal na parte em cache; leituras guardadas na
  mesma planilha com a mesma trava de acesso de hoje.
- Regressão → teste no emulador + suíte completa antes de cada publicação.
