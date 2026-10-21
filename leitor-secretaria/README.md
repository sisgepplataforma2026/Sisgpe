# Leitor da Secretaria — pedidos de voucher por e-mail

Projeto Apps Script **separado do SISGEP**. Roda na conta
**`sindeducacaosecretaria@gmail.com`**, que recebe a cópia automática da
`secretaria@sindeducacao.com` (redirecionamento da KingHost, configurado em
21/10/2026).

## Por que existe

O SISGEP roda na conta do Financeiro, e o usuário decidiu em 21/10/2026 que
*"os e-mails da secretaria não devem ser acessados pelo financeiro"*. Então:

- **o leitor** (este projeto, na conta da Secretaria) olha a caixa e copia
  para uma planilha-ponte **só** as conversas que parecem pedido de voucher.
  Do resto guarda só o número da conversa, sem assunto, remetente nem texto;
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

## Conferir que funcionou

1. De outro e-mail, mande para `secretaria@sindeducacao.com` um pedido de
   teste: *"Quero o voucher de Pedagogia para 2027/1"*, com um PDF qualquer anexo.
2. Em até 15 minutos o leitor copia a conversa. Para não esperar, rode
   `leitorCiclo` no editor do leitor.
3. No SISGEP → Benefícios → Vouchers → **Pedidos por e-mail** → **Ler agora**.
   O pedido aparece no painel.

## O que este projeto NÃO faz

Não chama IA, não confere documento e não decide resposta. Ele só transporta.
A conferência e a validação humana ficam no SISGEP (`VoucherPedidosEmail.gs`).
