# PENDENTE DE VERIFICAÇÃO EM AMBIENTE REAL

> Lista do que está **"não testado"** pela REGRA Nº -1 e depende de alguém
> executar no sistema no ar. Não é lista de bug nem de tarefa: é o que foi
> entregue e ainda **não pode ser chamado de pronto**.
>
> Regra de uso: o Claude relê este arquivo no começo de cada sessão e cobra
> o que estiver aberto. Item só sai daqui com o usuário dizendo que rodou —
> nunca por dedução, nunca por "deve estar funcionando".

---

## 🔴 ABERTO

### 1. Trilha de Auditoria com dado real — Ofícios
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

| Data | Item | Como foi verificado |
|---|---|---|
| 10/08/2026 | Trilha abre e consulta | print do usuário |
| 10/08/2026 | Token nas 5 telas | print do usuário |
