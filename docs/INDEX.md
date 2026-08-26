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
| [../.claude/rules/numeracao-e-filas.md](../.claude/rules/numeracao-e-filas.md) | Número de ofício, recibo, guia, comprovante ou protocolo; fila de envio. |
| [../.claude/rules/eventos-e-vouchers.md](../.claude/rules/eventos-e-vouchers.md) | Evento, ingresso, QR, check-in, voucher, bolsa de estudo. |

## Ferramentas

| Comando | O que faz |
|---|---|
| `node tools/mapa.js` | Regenera `docs/MAPA.md`. Use `--json` para também gravar `docs/mapa.json`. |
| `node tools/verificar.js` | Verificação antes do push. `--sessoes` mostra a auditoria de sessão completa. `--max N` falha só acima do teto N. |
| `npm test` | O verificador com o teto da dívida herdada (`--max 22`). É o que a CI roda. |
| `tools/hook-verificar.sh` | Hook de Stop: roda o verificador ao fim da sessão, e só se algum `.gs`/`.html` mudou (arquivo novo incluído). |

## Ainda não escrito

Estes assuntos ainda não têm documento próprio. Enquanto não tiverem, a fonte é
o código — use o `MAPA.md` para chegar nele:

- regras sindicais (CCT, contribuições, elegibilidade) — **as únicas que não dá
  para deduzir do código; precisam vir do estatuto e das convenções**;
- procedimento de deploy para produção (o de **homologação** está no próprio `.github/workflows/deploy-homologacao.yml`: branch `main` ou `homolog/*`, disparo manual);
- modelo de dados aba a aba;
- fluxos de UI e padrão visual;
- plano de testes ponta a ponta.

Ao escrever qualquer um deles, acrescente a linha aqui e **não copie o conteúdo
para o `CLAUDE.md`** — referencie.
