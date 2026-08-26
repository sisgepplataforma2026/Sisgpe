# SISGEP — Sistema Integrado de Gestão Sindical

Google Apps Script (runtime V8) + HtmlService. Google Sheets é o banco.
78 arquivos `.gs` (servidor) e 63 `.html` (telas e fragmentos), todos na raiz —
o Apps Script não tem pastas. Deploy por `clasp`.

## Regra número um deste projeto

**Todos os `.gs` compartilham um único escopo global.** Duas funções com o mesmo
nome em arquivos diferentes não convivem: uma apaga a outra, e qual delas vence
depende da ordem de carga do projeto. Antes de criar uma função, confira se o
nome já existe (`grep -n "^function nome" *.gs`).

## Localize antes de ler

O repositório tem ~4,5 MB de código; arquivos individuais chegam a 217 KB.
Ler arquivo inteiro para achar uma função gasta contexto à toa.

`docs/MAPA.md` é o índice gerado do projeto — consulte-o **primeiro**, com
`grep`, não lendo inteiro:

| Pergunta | Comando |
|---|---|
| Que arquivos são do módulo X? | `grep '\*\*X\*\*' docs/MAPA.md` |
| De onde vem esse botão da tela? | `grep '`nomeDaFuncao`' docs/MAPA.md` |
| Quem grava na aba Y? | `grep '\*\*Y\*\*' docs/MAPA.md` |
| Onde está definida a função Z? | `grep -n "^function Z" *.gs` |

Só depois abra o arquivo — e de preferência a faixa de linhas
(`sed -n '400,480p' Arquivo.gs`), não o arquivo todo.

Mexeu no código, regenere: `node tools/mapa.js`

## Antes de qualquer push

```
node tools/verificar.js
```

Checa sintaxe dos `.gs` e do JS embutido nos `.html`, nomes globais duplicados,
`google.script.run` chamando função que não existe no servidor, e segredos no
código. Roda em ~0,2 s, sem dependências. Sai com código 1 se achar problema.
Hoje ele acusa 22 problemas pré-existentes — veja `docs/DEBITO-TECNICO.md`.

## Regras por assunto — leia só a que interessar

| Vai mexer em | Leia antes |
|---|---|
| qualquer `.gs` / `.html`, deploy, `clasp` | `.claude/rules/apps-script.md` |
| login, sessão, CPF, dados pessoais, logs, permissões | `.claude/rules/seguranca-lgpd.md` |
| cobrança, boleto, PIX, baixa, conciliação, mensalidade | `.claude/rules/financeiro.md` |

Documentação de apoio: `docs/INDEX.md`.

## Como trabalhar aqui

- Preserve o que funciona. Não apague função sem dizer o impacto e como reverter.
- Mudança relevante vem com critério de aceite e como testar.
- Produção e homologação são ambientes distintos — diga para qual você está mexendo.
- Vários usuários mexem ao mesmo tempo: pense em concorrência e idempotência.
- Não invente regra de negócio. Se não estiver no código nem na documentação, pergunte.
