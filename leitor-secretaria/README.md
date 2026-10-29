# Leitor da Secretaria — pedidos de voucher por e-mail

Projeto Apps Script **separado do SISGEP**. Roda na conta
**`sindeducacaosecretaria@gmail.com`**, que recebe a cópia automática da
`secretaria@sindeducacao.com` (redirecionamento da KingHost, configurado em
21/10/2026).

## Por que existe

O SISGEP roda na conta do Financeiro, e o usuário decidiu em 21/10/2026 que
*"os e-mails da secretaria não devem ser acessados pelo financeiro"*. Então:

- **o leitor** (este projeto, na conta da Secretaria) olha a caixa e, com a
  IA, **entende o que é cada e-mail**. Copia para uma planilha-ponte **só** os
  pedidos de voucher. Os outros ganham uma etiqueta no Gmail desta conta
  ("SISGEP/Filiação", "SISGEP/Propaganda"…) e, na ponte, só o número da
  conversa — sem assunto, remetente, texto nem tipo. Propaganda e notificação
  automática nem chegam à IA. Sem IA (sem crédito), não copia nada;
- **o SISGEP** lê a ponte, confere e mostra o pedido no painel da Marcela;
- **as respostas** voltam pela ponte, e o leitor envia como `secretaria@`, na
  conversa do associado. Ele só responde em conversa que ele mesmo copiou
  como pedido, e só anexa PDF.

## Instalação (uma vez, uns 10 minutos)

Tudo **logado na conta `sindeducacaosecretaria@gmail.com`**.

1. Abra `script.google.com` → **Novo projeto**. Dê o nome **Leitor da Secretaria**.
2. Apague o conteúdo do arquivo `Código.gs`, cole todo o conteúdo de
   `LeitorSecretaria.gs.txt` e renomeie o arquivo para `LeitorSecretaria`.
3. ⚙️ **Configurações do projeto** → marque **"Mostrar o arquivo de manifesto
   appsscript.json"**. Volte ao editor, abra `appsscript.json` e substitua
   pelo conteúdo de `appsscript.json.txt`.
4. Salve. No topo, escolha a função **`configurarLeitor`** e clique em **Executar**.
   - O Google pede autorização: **Revisar permissões** → escolha a conta da
     Secretaria → **Avançado** → **Acessar Leitor da Secretaria** → **Permitir**.
5. No **Registro de execução** aparece:
   `VOUCHER_PEDIDOS_PONTE_ID = 1AbC...` — **copie esse código**.
6. No **projeto do SISGEP** (conta do Financeiro): ⚙️ **Configurações do
   projeto** → **Propriedades do script** → **Adicionar propriedade**:
   - Propriedade: `VOUCHER_PEDIDOS_PONTE_ID`
   - Valor: o código copiado no passo 5
7. Ainda no SISGEP, rode uma vez `instalarGatilhoVoucherPedidosEmail`.

O `configurarLeitor` já deixa a planilha-ponte e a pasta de anexos
compartilhadas com `financeirosindecucacao@gmail.com` e liga o gatilho de 15
minutos. Rodar de novo não duplica nada.

## Atualização de 29/10/2026 — o leitor passa a entender o e-mail

A primeira versão separava por palavra e copiou propaganda (Leroy Merlin,
Sam's Club…) para a ponte. Para trocar pela versão que entende o e-mail,
**logado na conta `sindeducacaosecretaria@gmail.com`**:

1. No projeto **Leitor da Secretaria**, apague o conteúdo de `LeitorSecretaria`
   e cole o novo `LeitorSecretaria.gs.txt`. Substitua também o
   `appsscript.json` pelo novo `appsscript.json.txt` (ele ganhou a permissão de
   chamar a IA).
2. ⚙️ **Configurações do projeto** → **Propriedades do script** → adicione
   `ANTHROPIC_API_KEY` com **a mesma chave** que está no SISGEP.
3. **Com crédito na Anthropic**, escolha `leitorLimparCopiasIndevidas` e
   **Executar**. O Google vai pedir autorização de novo (por causa da
   permissão nova): autorize. O registro diz quantas conversas saíram da ponte.
   Sem crédito ela para sem apagar nada — pode rodar de novo depois.
4. No SISGEP, **Ler agora**: o que saiu da ponte some do painel.

## Publicação automática (29/10/2026 — "Faça vc")

O leitor passou a ser publicado pelo GitHub
(`.github/workflows/deploy-leitor-secretaria.yml`), sem colar à mão. Para
isso, UMA vez, na conta da Secretaria:

1. Abra o projeto **Leitor da Secretaria** → botão **Compartilhar** (ícone de
   pessoa, no alto) → adicione `financeirosindecucacao@gmail.com` como
   **Editor**.
2. ⚙️ **Configurações do projeto** → copie o **ID do script** e mande para o
   Claude. Ele grava em `leitor-secretaria/SCRIPT_ID.txt`, e daí em diante
   cada mudança no leitor é publicada sozinha.

O leitor continua RODANDO como a Secretaria (o gatilho é dela). A troca
aceita: a conta do Financeiro passa a poder alterar o código do leitor.

Quando uma versão pedir permissão nova (o `appsscript.json` mudar), o leitor
para até alguém da Secretaria abrir o editor, rodar qualquer função e
autorizar — parado, ele não copia nada.

## Pedidos antigos sem resposta (pastas CERTIFICADO 2026-2 e 2027-1)

O redirecionamento só copia o que chega depois de 21/10. Para trazer os
pedidos antigos que a Marcela separou nas pastas da KingHost, UMA vez, no
Gmail `sindeducacaosecretaria@gmail.com`: ⚙️ → Ver todas as configurações →
**Contas e importação** → **Importar e-mails e contatos** → `secretaria@sindeducacao.com`
(servidor `imap.kinghost.net`, porta 993, SSL) → marcar só **Importar e-mails**
(desmarcar "novos e-mails pelos próximos 30 dias" e contatos).

As pastas viram etiquetas. Daí o leitor, uma passada por dia durante 7 dias,
copia para o SISGEP só as conversas das etiquetas "CERTIFICADO 2026-2" e
"CERTIFICADO 2027-1" (não as "EMITIDOS") cuja última mensagem é de quem pediu
— as que a Secretaria ainda não respondeu. Não duplica o que já veio depois de
21/10.

## Conferir que funcionou

1. De outro e-mail, mande para `secretaria@sindeducacao.com` um pedido de
   teste: *"Quero o voucher de Pedagogia para 2027/1"*, com um PDF qualquer anexo.
2. Em até 15 minutos o leitor copia a conversa. Para não esperar, rode
   `leitorCiclo` no editor do leitor.
3. No SISGEP → Benefícios → Vouchers → **Pedidos por e-mail** → **Ler agora**.
   O pedido aparece no painel.

## O que este projeto NÃO faz

Não confere documento e não decide resposta. A IA aqui só responde "o que é
este e-mail" — para separar o voucher do resto antes de copiar. A conferência
do pedido e a validação humana ficam no SISGEP.
A conferência e a validação humana ficam no SISGEP (`VoucherPedidosEmail.gs`).
