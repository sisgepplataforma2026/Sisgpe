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
