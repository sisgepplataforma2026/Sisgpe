---
name: sisgep-localizar
description: Localiza código no SISGEP sem abrir o repositório inteiro — qual arquivo tem uma função, de onde vem um botão da tela, quem grava numa aba da planilha, quais arquivos formam um módulo. Use antes de ler arquivos de código do SISGEP.
---

# Localizar código no SISGEP

O repositório tem 141 arquivos na raiz, ~4,5 MB, arquivos individuais de até
217 KB. Abrir arquivo para procurar é o maior desperdício de contexto aqui.

`docs/MAPA.md` é o índice gerado. **Consulte com `grep`, não leia inteiro.**

## Receitas

Módulo → arquivos:
```
grep '\*\*Ofícios\*\*' docs/MAPA.md
```

Botão da tela → função do servidor (dá o `.html` de origem e o `.gs` que define):
```
grep '`aprovarReservaParqueChina`' docs/MAPA.md
```

Aba da planilha → quem grava e quem só lê:
```
grep '\*\*Escolas\*\*' docs/MAPA.md
```

Definição de uma função:
```
grep -n "^function nomeDaFuncao" *.gs
```

Quem chama uma função interna:
```
grep -n "nomeDaFuncao(" *.gs *.html
```

## Depois de localizar

Abra a faixa de linhas, não o arquivo:
```
sed -n '400,480p' Reservaparquechina.gs
```

## Manter o mapa em dia

Depois de acrescentar, renomear ou remover função ou arquivo:
```
node tools/mapa.js
```

O mapa também traz, no fim, a seção **Saúde do código** — chamadas do cliente
sem função no servidor e nomes globais duplicados.
