# Documentação do SISGEP

Índice. Abra só o documento que a tarefa exigir — nenhum destes é carregado
automaticamente.

## Gerado a partir do código

| Documento | Para quê |
|---|---|
| [MAPA.md](MAPA.md) | Índice do projeto: módulos, rotas, chamadas cliente→servidor, abas da planilha, saúde do código. Consulte com `grep`. Regenere com `node tools/mapa.js`. |
| [DEBITO-TECNICO.md](DEBITO-TECNICO.md) | Linha de base dos problemas conhecidos, com evidência e o que fazer. |

## Regras de trabalho

| Documento | Quando ler |
|---|---|
| [../CLAUDE.md](../CLAUDE.md) | Sempre — é o mínimo que fica carregado. |
| [../.claude/rules/apps-script.md](../.claude/rules/apps-script.md) | Mexer em `.gs`/`.html`, deploy, clasp. |
| [../.claude/rules/seguranca-lgpd.md](../.claude/rules/seguranca-lgpd.md) | Login, sessão, CPF, dados pessoais, logs, permissões, exportação. |
| [../.claude/rules/financeiro.md](../.claude/rules/financeiro.md) | Cobrança, boleto, PIX, baixa, conciliação, mensalidade. |

## Ferramentas

| Comando | O que faz |
|---|---|
| `node tools/mapa.js` | Regenera `docs/MAPA.md`. Use `--json` para também gravar `docs/mapa.json`. |
| `node tools/verificar.js` | Verificação antes do push. `--sessoes` mostra a auditoria de sessão completa. |

## Ainda não escrito

Estes assuntos ainda não têm documento próprio. Enquanto não tiverem, a fonte é
o código — use o `MAPA.md` para chegar nele:

- regras sindicais (CCT, contribuições, elegibilidade);
- procedimento de deploy para produção;
- modelo de dados aba a aba;
- fluxos de UI e padrão visual;
- plano de testes ponta a ponta.

Ao escrever qualquer um deles, acrescente a linha aqui e **não copie o conteúdo
para o `CLAUDE.md`** — referencie.
