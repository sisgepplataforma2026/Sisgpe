#!/usr/bin/env bash
# Hook de Stop: so verifica quando algum .gs ou .html mudou nesta sessao.
# Sessao que so leu codigo, ou que mexeu so em documentacao, nao paga nada.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# git status --porcelain, e nao git diff: precisa pegar tambem arquivo NOVO
# ainda nao rastreado — um .gs recem-criado e justamente o caso mais provavel
# de introduzir colisao de nome no escopo global.
mudou=$(git status --porcelain -- '*.gs' '*.html' 2>/dev/null | head -1)
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
