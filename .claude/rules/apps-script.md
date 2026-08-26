# Regras do runtime Apps Script

Leia antes de mexer em qualquer `.gs` ou `.html` deste projeto.

## Escopo global único

Não existe módulo, `import` nem `require`. Todos os `.gs` são concatenados num
escopo global só. Consequências práticas:

- Nome de função repetido em dois arquivos: **uma apaga a outra**, e qual vence
  depende da ordem de carga do projeto no Apps Script. Não é erro de compilação
  — é comportamento errado silencioso em produção.
- Antes de criar função nova: `grep -n "^function nome" *.gs`.
- Função auxiliar de um módulo leva prefixo do módulo (`pcValidarMapaColunas_`,
  `sindAdm_buscarPorId_`). O `_` no fim marca a função como privada e a esconde
  do `google.script.run` — use nas auxiliares.
- Constante global (`PLANILHA_ID`, `ABA_ESCOLAS`) idem: nome único.

`node tools/verificar.js` acusa todos os nomes duplicados.

## Fronteira cliente ↔ servidor

O `.html` chama o servidor por `google.script.run.nomeDaFuncao(args)`.

- **Toda função alcançável por `google.script.run` é endpoint público do webapp.**
  Quem tem a URL chama direto, sem passar pela tela. Argumento vindo do cliente
  não é confiável — inclusive "quem aprovou", "perfil", "idUsuario".
- Só trafega dado serializável (sem `Date` dentro de objeto aninhado, sem função).
- Erro no servidor chega ao cliente pelo `withFailureHandler`. Sem ele, a falha
  some sem ninguém ver.
- Renomeou função do servidor? O `.html` que a chama não acusa nada até o usuário
  clicar. Rode `node tools/verificar.js`.

## HtmlService

- `include('Arquivo')` cola outro `.html` (usado para `Scripts_*` e `*Styles`).
- Scriptlet `<?= ?>` / `<? ?>` só funciona em arquivo servido por
  `createTemplateFromFile`, não por `createHtmlOutputFromFile`.
- O GAS remove `<meta>` do HTML: viewport tem que vir por
  `.addMetaTag('viewport', ...)`, senão a tela fica minúscula no celular.
- Interpolar dado do usuário em `innerHTML` é XSS. Prefira `textContent`; quando
  precisar de HTML, escape antes.

## Planilha como banco

- Planilha principal: `1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E`.
- Leia por cabeçalho (`getHeaderMap_`, `obterIndiceColunaPorCabecalho_`), nunca
  por índice fixo de coluna: inserir uma coluna quebraria tudo.
- `getValues()`/`setValues()` em bloco. Chamada dentro de laço é o gargalo
  clássico do Apps Script e estoura o limite de 6 minutos.
- Escrita concorrente exige `LockService` — dois usuários salvando ao mesmo
  tempo sobrescrevem um ao outro. Numeração sequencial (ofícios, protocolos)
  **sempre** sob lock.

## Deploy

- `clasp push` envia a raiz inteira; o que está em `tools/`, `docs/` e `.claude/`
  fica fora pelo `.claspignore`.
- Homologação e produção são projetos Apps Script distintos. Confirme o destino
  antes de publicar.
- Rollback é por versão do Apps Script (`clasp deployments`), não por git.
