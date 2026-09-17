# Desenhos de tela — antes de virar código

Fonte dos wireframes de alta fidelidade do SISGEP. Existe por causa da
**REGRA Nº 0.5** do `CLAUDE.md`: arquitetura e layout são mostrados e aprovados
**antes** de se escrever backend ou tela.

## O que tem aqui

Cada `.dc.html` é uma tela desenhada, medida em pixel, usando os valores exatos
do design system (`OficiosStyles.html` — navy `#001f4d`, navy2 `#002f6c`, blue
`#1565C0`, gold `#C9A84C`, Plus Jakarta Sans, raios 12/16/20px, sombras
`--sh-*`). Não é protótipo clicável: é desenho para decidir.

| Arquivo | Tela |
|---|---|
| `Main.dc.html` | Eventos › Painel do evento |
| `Inscricoes.dc.html` | Eventos › Inscrições, como fila de trabalho |
| `Eventos.dc.html` | Eventos › lista de eventos (a entidade que ainda não existe) |
| `canvas.json` | posição das telas no quadro e as notas de cada uma |

**Estes desenhos NÃO são o sistema.** Descrevem o que se propõe construir —
25/08/2026, depois de o usuário dizer que o layout da tela de Eventos estava
horrível e que um projeto assim não se vende. A distância entre o que está
desenhado aqui e o que está no ar é justamente o trabalho a fazer.

## Por que o `.html` montado não é versionado

O arquivo publicado tem ~2,5 MB, porque carrega o editor de canvas junto. Ele é
**reconstruído** a partir dos `.dc.html` sempre que necessário, então fica de
fora do repositório (`.gitignore`). O que importa versionar é o desenho.
