# Testes ponta a ponta do SISGEP

Emulador do Google Apps Script em Node. Carrega os **100 arquivos `.gs` reais** do projeto
num único escopo global — como o Apps Script faz — contra uma planilha em memória.
Nada toca a planilha de produção.

## Rodar

```
cd tests/e2e
node t1-documentos.js
node t2-beneficios.js
```

Não precisa instalar nada. Node 18+ basta.

## O que é testado de verdade

Planilha (linhas, colunas, `appendRow`, `getRange/setValue`), `LockService` — inclusive
detecção de lock aninhado, que já causou bug real na folha de pagamento —,
`PropertiesService`, `CacheService`, `Utilities`, datas, sessão e login (com o hash
de senha real do sistema), permissão por módulo e integração entre módulos.

## O que NÃO é testado (e por isso continua "não testado" no relatório)

- Conteúdo de PDF gerado por template do Google Docs
- Entrega real de e-mail e rastreio de abertura por pixel
- Comportamento da tela (HTML/JS no navegador)
- Agendamento efetivo dos gatilhos de horário

## Como escrever um teste novo

```js
const b = require("./base");
const { g, amb } = b.subir({});   // g = escopo global com todas as funções .gs
b.seedUsuarios(g);                 // cria wanderson (admin), rogerio (fin+rh), joscimar (escolas+sind)
const TOKEN = b.logar(g, "wanderson");

b.fluxo("NOME DO FLUXO");
b.passo("1. primeira etapa");
const r = g.minhaFuncaoPublica(payload, TOKEN);
b.ok(r && r.ok, "descrição do que deveria acontecer", detalhe);
b.bloqueia(() => g.funcao(payload, TOKEN_SEM_ACESSO), "nega quem não tem o módulo");
b.naoTestavel("o que não dá para validar aqui", "por quê");
b.resumo();
```

`amb.outbox` guarda os e-mails que o sistema tentou enviar, `amb.driveFiles` os arquivos
que tentou criar, `amb.lockEvents` a sequência de locks e `amb.triggers` os gatilhos instalados.

## Cuidado ao interpretar uma falha

Metade das falhas na primeira rodada de cada módulo é erro do teste, não do sistema —
nome de campo trocado, ordem de argumento errada. **Antes de reportar bug, confira a
assinatura da função no `.gs`.** Só é bug depois de confirmado que a chamada estava certa.
