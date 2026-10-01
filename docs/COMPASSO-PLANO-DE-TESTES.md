# PLANO DE TESTES — FESTA COMPASSO DA VIDA 2026

**Definido pelo usuário em 21/08/2026.** Este documento é o plano dele,
registrado aqui porque plano que fica só na conversa se perde — e este tem
quatro meses de duração.

> "Como a festa é só em dezembro, temos uma janela boa para testar com calma e
> corrigir o que aparecer. O mais importante é não deixar o teste pesado para
> a última semana. Cada falha encontrada agora vira correção e depois entra
> como teste permanente."

A última frase é a regra de operação deste documento: **toda falha encontrada
em qualquer onda vira asserção nos testes `t76`–`t79`**, para não voltar.

---

## O calendário

| Quando | Onda | O que se prova |
|---|---|---|
| **Ago/Set** | estrutura + 10, 50, 200 | a lógica está certa |
| **Outubro** | carga 1.000 e 2.000 + correções | o sistema aguenta |
| **Novembro** | portaria real, 6–8 celulares | funciona no mundo físico |
| **Início de dez** | reteste final + GO/NO-GO + congelamento | está pronto |

---

## ONDA 1 — Ago/Set · estrutura e volume pequeno

### 1.1 Antes de qualquer coisa

No editor do Apps Script de **homologação**, escolha no seletor de funções:

```
compassoDiagnostico()
```

> **Por que não `diagnosticoPilotoCompasso_()`.** O Apps Script trata função
> terminada em `_` como privada — ela **não aparece no seletor de execução**.
> Este documento mandava rodar aquela, e não dava. `compassoDiagnostico()` é
> o atalho executável: mesma saída, com trava de administrador (sem o `_`,
> qualquer página pública alcançaria a função por `google.script.run`, e ela
> conta o projeto do Firestore e o tamanho da base).

Diz o que falta configurar e imprime os dois links. **Se o Firestore não
estiver conectado, nada do Compasso funciona** — inscrição, ingresso e
check-in vivem lá. É o primeiro bloqueio a resolver.

### 1.2 O piloto de uma pessoa só

```
compassoPiloto()
```

> **Sem argumentos, de propósito.** O botão Executar do editor chama a função
> SEM parâmetros — não existe onde digitar o e-mail. Em 21/08/2026 isso fez o
> piloto terminar em menos de um segundo, calado, porque a recusa por e-mail
> vazio era devolvida como valor de retorno e o editor não mostra retorno.
> O `compassoPiloto()` usa **o e-mail de quem está executando** e diz no
> registro de onde ele veio. Para outro endereço ou para incluir o WhatsApp,
> declare `COMPASSO_PILOTO_EMAIL` e `COMPASSO_PILOTO_WHATSAPP` nas
> Propriedades do script.

Roda a cadeia inteira com o seu contato: inscrição → validação → emissão →
e-mail com PDF → link. Depois:

1. abrir o e-mail: tem de vir o botão **e** o PDF anexo;
2. 🔴 **abrir o PDF e LER o QR com a câmera** — é o ponto mais provável de
   falha de toda a entrega (ver a nota técnica no fim);
3. abrir o link do ingresso em aba anônima: tem de mostrar, e **não** marcar
   entrada;
4. ler o QR na portaria; ler **de novo**: a segunda tem de recusar.

### 1.3 A tela pública, com gente de verdade

Abrir `?page=compasso-inscricao` no celular, não no computador. Testar:

- CPF que está na base → campos nascem preenchidos, contato **mascarado**;
- deixar a máscara como está → conferir que o e-mail gravado é o **real**;
- mesmo CPF de novo → tem de recusar;
- CPF fora da base → abre em branco e **aceita**;
- CPF com dígito errado → recusa antes de enviar.

### 1.4 Volume pequeno pelo simulador

```
compasso_simulacaoIniciar(10)     → depois compasso_simulacaoExecutarLote(loteId)
compasso_simulacaoIniciar(50)
compasso_simulacaoIniciar(200)
```

O simulador só roda com `SISGEP_AMBIENTE=HOMOLOGACAO` **e** modo teste — as
duas travas, de propósito.

**O que olhar em cada rodada:** `erros` tem de ser 0, e `emitidos` tem de
bater com `inscritos`. Qualquer divergência é achado, não ruído.

---

## Como o link vai ser distribuído — decisão do usuário em 25/08/2026

> "link vai para a lista de transmissão" · **"vou encaminhar aos poucos, não
> tudo de uma única vez"**

As duas frases juntas são o que define a carga real da inscrição, e a segunda
é a que resolve o problema criado pela primeira.

**Por que importa mais do que parece.** Cada inscrição segura a trava do script
enquanto grava no Firestore. Para uma pessoa é instantâneo; para centenas no
mesmo minuto vira fila, e quem espera demais recebia um erro cru do Apps
Script — que fazia a pessoa preencher tudo de novo e criava a duplicidade que a
trava de CPF existe para impedir. O erro virou recusa explicada em 25/08
(`EventosInscricaoPublica.gs`, `compasso_criarInscricaoAssociado_publica_`),
mas isso faz a fila falhar com educação; **não faz a fila ser curta.**

**Enviar em levas é o que faz a fila ser curta.** É a única medida que ataca a
causa, e ela é operacional — não tem código envolvido.

Duas notas para a hora de fazer:

- **não anunciar hora exata de abertura.** Hora marcada concentra o clique de
  propósito, e desfaz o efeito das levas.
- **esperar a leva anterior ser absorvida** antes de mandar a seguinte. O que
  diz que foi absorvida é a fila de análise parar de crescer, não o relógio.

Isto **não substitui** a onda 2 abaixo. As levas reduzem o pico esperado; a
simulação de carga mede o que acontece quando o pico vem assim mesmo — por uma
leva maior do que o previsto, ou porque alguém repassou o link adiante. Um link
em lista de transmissão é reencaminhável, e não há como controlar isso.

---

## ONDA 2 — Outubro · carga

```
compasso_simulacaoIniciar(1000)
compasso_simulacaoIniciar(2000)
compasso_simulacaoIniciar(2500)   ← estoura o limite de propósito
```

A de 2.500 é a mais importante das três: ela prova a **trava das 2.000
vagas**. O resultado esperado é `bloqueados = 500` e `emitidos = 2000`. Se
emitir 2.001, é defeito grave — significa que a contagem de vagas tem corrida.

Também nesta onda:

- `compasso_testeDuplicidade()` — mesmo CPF duas vezes;
- `compasso_testeQrReutilizado(qrToken, "CEL-A", "CEL-B")` — o mesmo QR em
  dois aparelhos.

### ⚠️ O consumo do Firebase — o que existe e o que NÃO existe

O usuário pediu: *"medir o consumo do Firebase em cada rodada e confirmar,
com dados reais, se o fluxo está ficando dentro da faixa gratuita."*

**Hoje o sistema ESTIMA, não MEDE.** `compasso_estimarConsumoEvento` e
`compasso_estimarDiaFesta` calculam a partir de uma fórmula com números
supostos. Isso responde "quanto deve dar", não "quanto deu".

Para ter dado real há dois caminhos:

1. **Console do Firebase**, aba Uso, antes e depois de cada rodada. Não custa
   nada implementar e é a fonte oficial.
2. **Um contador no próprio sistema**, envolvendo `fs_get_` e `fs_set_` para
   tabular leituras e escritas por rodada. Dá o número por operação e por
   etapa do fluxo, que o console não separa.

O caminho 2 ainda **não está construído**. Se você quiser, é um trabalho
pequeno e vale a pena antes da onda de 2.000 — é ali que o número importa.

---

## ONDA 3 — Novembro · portaria real, 6–8 celulares

É a onda que nenhum teste de código alcança. O que só aqui se descobre:

- **leitura do QR em luz ruim** e em tela de celular com brilho baixo;
- **6–8 leitores ao mesmo tempo** no mesmo ingresso — a trava de duplo
  check-in é sob `LockService`, e é aqui que se prova;
- **internet ruim**: o que a portaria vê quando a chamada demora ou cai. Se a
  tela ficar "carregando" para sempre, a fila para;
- **busca manual** — o caminho de contingência para celular descarregado ou
  QR danificado;
- **cancelamento**: cancelar um ingresso e tentar entrar com ele.

**Levar por escrito o que fazer quando der errado.** Uma portaria travada com
200 pessoas na fila não é hora de descobrir o procedimento.

---

## ONDA 4 — Início de dezembro · GO/NO-GO

- reteste completo das ondas 1 a 3, na versão **congelada**;
- nenhuma alteração de código depois deste ponto, exceto correção de defeito
  bloqueante;
- decisão explícita GO ou NO-GO, registrada com data e por quem.

---

## A regra que faz o plano valer

Toda falha encontrada em qualquer onda:

1. vira **correção**;
2. vira **asserção permanente** em `t76`–`t79`;
3. vira **mutação** que prova que a asserção morde.

Sem o passo 3, a asserção pode estar passando por acaso — foi o que aconteceu
duas vezes em 21/08: a trava de duplicidade e a do modo teste passavam sem
provar nada, e só a mutação revelou.

---

## Nota técnica — por que o PDF é o ponto frágil

O `EventosIngressoTemplate.html` gera o QR com um script de CDN (qrcodejs).
Em `getAs(MimeType.PDF)` **script não roda** — o conversor renderiza HTML
estático. O QR sairia em branco no papel, e ninguém perceberia até alguém
chegar na portaria com uma folha sem código.

Por isso o PDF tem caminho próprio: o QR é buscado como PNG no servidor e
embutido como `data:` URI. **Mas isso só se prova lendo o código com a
câmera.** É o primeiro teste de toda rodada.

---

## Cobertura automatizada que já existe

| Teste | O que guarda | Asserções | Mutações |
|---|---|---|---|
| `t76` | nenhuma função alcançável sem identificar quem chama | 21 | 11 |
| `t77` | pagamento do acompanhante, receita sem falha silenciosa | 23 | 9 |
| `t78` | entrega: token, PDF, lote, "ver não é entrar" | 33 | 9 |
| `t79` | inscrição pública: CPF, máscara, duplicidade | 40 | 10 |

Eles provam **código**. Nenhum deles prova e-mail entregue, PDF legível, QR
lido por câmera ou portaria sob carga — que é exatamente o que as quatro
ondas existem para provar.
