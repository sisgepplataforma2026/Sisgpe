# Segurança e LGPD

Leia antes de mexer em login, sessão, permissão, CPF/CNPJ, documento, log ou
exportação.

## O que o sistema guarda

CPF, RG, endereço, telefone, e-mail, dados bancários, documentos digitalizados,
dados de dependentes (inclusive menores), filiação sindical. Filiação sindical é
dado sensível pela LGPD (art. 5º, II) — exige cuidado maior que cadastro comum.

## Autorização

- `getSessaoUsuario(token)` (`Sessao.gs`) valida a sessão. Toda função de
  `google.script.run` que altera dado ou mostra dado pessoal precisa validar.
- **Não confie em argumento do cliente para decidir permissão.** Quem aprovou,
  perfil e id de usuário vêm da sessão do servidor, nunca do parâmetro.
- Rotas públicas (sem login) são só estas, e nenhuma outra:
  `?portal=associado`, `?ficha=sindicalizacao`, `?track=open`, `?recuperar=`.
  Rota pública não pode listar, editar nem exportar dado de terceiro.
- `node tools/verificar.js` lista as funções sem sinal de checagem de sessão.
  A lista é heurística: serve para revisar, não é veredito.

## Logs

- `Logger.log` não recebe CPF, senha, token, OTP nem conteúdo de documento.
  Registre id e ação — `"ficha 4821 aprovada por sessao 9f2a"`, não o CPF.
- Ação crítica (aprovar, cancelar, estornar, excluir, exportar) grava trilha:
  quem, quando, o quê, valor antes e depois.

## Segredos

- Chave de API e credencial ficam em `PropertiesService`, nunca no código —
  o repositório é versionado e o Apps Script é legível por quem tem acesso ao
  projeto. `node tools/verificar.js` procura segredo em texto claro.

## Exportação e retenção

- Exportar planilha/CSV com dado pessoal: só para perfil autorizado, e registre
  a exportação.
- Arquivo temporário no Drive tem que ser apagado ou ter acesso restrito —
  link do Drive vaza se ficar público.
- Exclusão de titular a pedido segue política definida; não apague histórico
  financeiro ou de auditoria sem checar a obrigação legal de guarda.
