/**
 * TESTE — O GOVERNADOR DA COTA DE E-MAIL
 *
 * O QUE ORIGINOU, 11/09/2026. O usuário, pedindo a comunicação da Taxa
 * Negocial para a base inteira de escolas:
 *
 *   "tem que ver a questão da cota de emails por dia, se chegar próximo da
 *    cota ele trava, joga para o dia seguinte"
 *
 * O QUE EXISTIA: teto escrito no código, cego. O `TaxaAssistencial.gs` manda
 * 100 por hora e reagenda, sem consultar a cota nenhuma vez — zero ocorrências
 * de getRemainingDailyQuota no arquivo inteiro. Com 679 escolas isso termina
 * em SETE HORAS, e disparo desse tamanho foi o que estourou o limite em 09/09
 * e de novo em 10/09, matando quatro ofícios.
 *
 * A REGRA QUE ESTE ARQUIVO GUARDA: quem envia em laço pergunta antes; quem
 * envia um só, não pergunta. A reserva É o orçamento dos avulsos — é por isso
 * que o conserto não exige migrar os ~21 arquivos que mandam e-mail direto.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA (REGRA Nº -1): o limite de CHAMADAS ao serviço
 * Gmail, que é o que de fato estourou em 09/09. O Google não o expõe, e o
 * emulador só sabe simular o contador de DESTINATÁRIOS. Por isso o governador
 * é a primeira linha e não a única — a segunda é o `oficio_ehLimiteDoGmail_`,
 * coberto pelo t155.
 */
const b = require("./base");
const { g } = b.subir({});
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const CAMP = "TAXA_NEGOCIAL_2026_P1";

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("E-MAIL · o governador da cota");

passo("a reserva tem padrão, e é o número que o usuário deu");

igual(g.cotaEmail_reserva_(), 40, "a reserva nasce em 40");

passo("com folga, cabe o que a campanha pedir");

g.__cotaEmailRestante = 1500;
let o = g.cotaEmail_orcamentoDoDia_(CAMP, 25);
igual(o.motivo, "OK", "veredito OK");
igual(o.disponivel, 25, "  cabem 25 — o teto da campanha é quem manda aqui",
      "1500 - 40 de reserva daria 1460; o teto existe para não fazer num dia o que é de vinte");

passo("A CONTA QUE O USUÁRIO ESCREVEU, e ela decide sozinha qual limite vale");

/* "Cota restante 63, reserva 40, disponível 23 → envia 23, mesmo com teto 25." */
g.__cotaEmailRestante = 63;
o = g.cotaEmail_orcamentoDoDia_(CAMP, 25);
igual(o.disponivel, 23, "63 − 40 = 23, e não os 25 do teto",
      "é a reserva mandando: o resto do SISGEP não pode ficar sem e-mail");
igual(o.motivo, "OK", "  ainda dá para enviar");

/* "Cota 95, reserva 40, disponível 55, teto 25 → envia 25." */
g.__cotaEmailRestante = 95;
o = g.cotaEmail_orcamentoDoDia_(CAMP, 25);
igual(o.disponivel, 25, "95 − 40 = 55, mas o teto corta em 25",
      "é o teto mandando: o menor dos dois sempre ganha");

passo("PERTO DA COTA ELE TRAVA — o pedido, em uma asserção");

g.__cotaEmailRestante = 40;
o = g.cotaEmail_orcamentoDoDia_(CAMP, 25);
igual(o.disponivel, 0, "cota igual à reserva: não sai mais nada hoje");
igual(o.motivo, "RESERVA", "  e o motivo é a reserva, não o teto");

g.__cotaEmailRestante = 12;
o = g.cotaEmail_orcamentoDoDia_(CAMP, 25);
igual(o.disponivel, 0, "cota abaixo da reserva também trava",
      "sem o Math.max isso viraria negativo e o laço mandaria mesmo assim");

passo("o motivo distingue RESERVA de TETO — porque a ação é diferente");

/* Em RESERVA a pessoa espera amanhã. Em TETO ela pode aumentar o teto se o
   prazo apertar. Devolver só um número esconderia essa escolha dela. */
g.__cotaEmailRestante = 1500;
g.cotaEmail_registrarEnvio_(CAMP, 25);
o = g.cotaEmail_orcamentoDoDia_(CAMP, 25);
igual(o.disponivel, 0, "alcançado o teto do dia, para");
igual(o.motivo, "TETO", "  e diz que foi o TETO, não a cota");
ok(/teto pode ser aumentado/.test(o.mensagem),
   "  e a mensagem oferece a saída",
   "aviso sem saída é só má notícia");

passo("o contador é POR DIA e POR CAMPANHA");

igual(g.cotaEmail_jaEnviadoHoje_(CAMP), 25, "a campanha contou os 25");
igual(g.cotaEmail_jaEnviadoHoje_("OUTRA_COISA"), 0,
      "outra campanha começa do zero",
      "senão uma campanha comeria o teto da outra sem ninguém ver");

passo("'posso mandar N?' nunca devolve mais do que cabe");

g.__cotaEmailRestante = 63;
let r = g.cotaEmail_quantosCabem_("NOVA", 500, 25);
igual(r.cabem, 23, "pediu 500, cabem 23");
r = g.cotaEmail_quantosCabem_("NOVA", 5, 25);
igual(r.cabem, 5, "pediu 5, cabem 5 — não infla o pedido");

g.__cotaEmailRestante = 10;
r = g.cotaEmail_quantosCabem_("NOVA", 10, 25);
igual(r.cabem, 0, "sem folga, cabem 0 — o laço tem de sair",
      "zero significa PARE e reagende, sem gastar tentativa de ninguém");

passo("a mensagem é para a secretaria, não para um programador");

ok(/continua amanhã, sozinha/.test(r.mensagem),
   "diz que a campanha retoma sozinha",
   "sem isso a reação natural é tentar de novo agora, que é o que mais gasta");
ok(!/quota|Quota|getRemaining/.test(r.mensagem),
   "  e não devolve nome de função nem inglês");

passo("a reserva é ajustável, porque 40 é um palpite bom e não uma lei");

g.cotaEmail_definirReserva_(100);
igual(g.cotaEmail_reserva_(), 100, "aceita valor novo");
g.__cotaEmailRestante = 120;
igual(g.cotaEmail_orcamentoDoDia_("X", 0).disponivel, 20, "e ele passa a valer: 120 − 100");
let recusou = false;
try { g.cotaEmail_definirReserva_(-5); } catch (e) { recusou = true; }
ok(recusou, "  e recusa valor negativo", "reserva negativa daria folga que não existe");
g.cotaEmail_definirReserva_(40);

naoTestavel("O limite de CHAMADAS ao serviço Gmail",
            "é o que de fato estourou em 09/09; o Google não expõe esse contador " +
            "e o emulador só simula o de destinatários. A segunda linha de defesa " +
            "é o oficio_ehLimiteDoGmail_, coberto pelo t155.");

resumo();
