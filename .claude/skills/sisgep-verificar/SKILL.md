---
name: sisgep-verificar
description: Verifica o SISGEP antes de commit ou de clasp push — sintaxe dos .gs e do JS nos .html, nomes globais duplicados, google.script.run chamando função inexistente, segredos no código e funções sem checagem de sessão. Use antes de publicar qualquer alteração.
---

# Verificar antes de publicar

```
node tools/verificar.js
```

Sem dependências, ~0,2 s, sem processo em segundo plano. Sai com código 1 se
achar problema.

## O que ele checa

| Checagem | Por que importa |
|---|---|
| Sintaxe dos `.gs` (parser V8) | O `clasp push` aceita o arquivo e o erro só aparece quando o usuário clica |
| Sintaxe do JS dentro dos `.html` | Idem, e sem aviso nenhum no editor |
| Nome global duplicado | Todos os `.gs` dividem um escopo só: uma definição apaga a outra |
| `google.script.run` sem função no servidor | Botão que falha em produção |
| Segredo em texto claro | Chave de API não pode ir para o repositório |
| Função sem checagem de sessão (aviso) | Toda função de `google.script.run` é endpoint público do webapp |

Lista completa da auditoria de sessão:
```
node tools/verificar.js --sessoes
```

## Achados que já existem

O projeto entra com 22 problemas herdados e ~181 funções a revisar quanto a
sessão. Estão catalogados em `docs/DEBITO-TECNICO.md`.

**Ao mexer numa alteração, compare com essa linha de base:** o que importa é não
acrescentar problema novo. Se o número subiu, o novo é seu.

Isso é automático: o hook de Stop (`tools/hook-verificar.sh`) roda a verificação
ao fim de qualquer sessão que tenha alterado `.gs` ou `.html` — arquivo novo
incluído — e barra o encerramento se o total passar de 22. A mesma checagem
roda no deploy de homologação.
