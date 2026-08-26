#!/usr/bin/env bash
# Hook de Stop: so verifica quando algum .gs ou .html mudou nesta sessao.
# Sessao que so leu codigo ou mexeu em documentacao nao paga nada.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Arquivos de producao alterados (working tree + staged), ignorando o resto.
mudou=$(git diff --name-only HEAD -- '*.gs' '*.html' 2>/dev/null | head -1)
[ -z "$mudou" ] && exit 0

saida=$(node tools/verificar.js --max 22 2>&1)
codigo=$?
[ $codigo -eq 0 ] && exit 0

echo "$saida" >&2
echo "" >&2
echo "Voce mexeu em .gs/.html e a verificacao passou do teto de 22 problemas herdados." >&2
echo "Os problemas acima do teto sao desta alteracao. Corrija antes de encerrar," >&2
echo "ou explique por que o teto deve subir." >&2
exit 2
