/**
 * A CONFIRMAÇÃO DA INSCRIÇÃO — O COMPROVANTE QUE NÃO EXISTIA
 *
 * O QUE ORIGINOU
 *
 * A auditoria de 25/08/2026 classificou a comunicação com o associado como
 * lacuna G1: a pessoa se inscrevia, lia uma frase na tela e fechava o
 * navegador sem nada na mão. No dia seguinte ligava para a secretaria para
 * perguntar se tinha dado certo — trabalho que o sistema já sabe evitar, que
 * é exatamente o que a REGRA Nº 0.6 do CLAUDE.md manda procurar.
 *
 * O QUE ESTE TESTE GUARDA, E POR QUE CADA COISA
 *
 * 1. QUE O E-MAIL SAI, e com o conteúdo certo — protocolo, dados conferíveis,
 *    e o aviso de que não é o ingresso.
 *
 * 2. QUE ELE NUNCA DERRUBA A INSCRIÇÃO. Esta é a asserção mais importante do
 *    arquivo. A inscrição já está gravada quando a confirmação é disparada; se
 *    o envio falhar e isso virar erro na tela, a pessoa se inscreve de novo e
 *    o sindicato ganha uma duplicidade por causa de um servidor de e-mail fora
 *    do ar. O teste derruba o envio de propósito e exige que a inscrição
 *    continue de pé, gravada, com a falha registrada.
 *
 * 3. QUE A FALHA NÃO SOME. Registro no documento, não Logger.log e pronto —
 *    senão a primeira notícia de que os e-mails pararam vem da fila de
 *    telefonemas.
 *
 * 4. QUE O CONTATO E O CPF NÃO VIAJAM INTEIROS. O e-mail fica guardado em
 *    caixa que não é nossa.
 *
 * O QUE ELE NÃO PROVA: que a mensagem chega. `enviarEmailSISGEP_` é executado
 * de verdade e a mensagem é registrada pelo emulador — a caixa de entrada
 * real continua sendo a única prova, e ela é sua.
 */
const b = require("./base");
const { fluxo, passo, ok, igual, naoTestavel, resumo } = b;

const { g, amb } = b.subir({});
b.seedUsuarios(g);

/* ─── Firestore em memória (mesmo desvio do t91, mesma honestidade) ─── */
const BANCO = new Map();
const clonar = o => JSON.parse(JSON.stringify(o));
g.fs_set_ = (c, i, o) => { BANCO.set(c + "/" + i, clonar(o)); return { ok: true }; };
g.fs_get_ = (c, i) => { const v = BANCO.get(c + "/" + i); return v ? clonar(v) : null; };
g.fs_list_ = c => { const o = []; BANCO.forEach((v, k) => { if (k.indexOf(c + "/") === 0) o.push(clonar(v)); }); return o; };
g.fs_queryEquals_ = (c, campo, v) => g.fs_list_(c).filter(d => String(d[campo]) === String(v));

const props = g.PropertiesService.getScriptProperties();
props.setProperty("SISGEP_AMBIENTE", "homologacao");
props.setProperty("EVENTO_MODO_TESTE", "true");
g.getAmbienteAtual._cache = undefined;
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

const CPF = "11144477735";
(function seedAssociados() {
  const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
  let aba = ss.getSheetByName(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  if (!aba) aba = ss.insertSheet(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  const l = new Array(12).fill("");
  l[0] = "EMEF Castelo Branco"; l[1] = "Maria Aparecida da Silva"; l[2] = CPF;
  l[3] = "S"; l[7] = "Vitória"; l[9] = "(27) 99876-5432"; l[11] = "mariaaparecida@gmail.com";
  aba.getRange(1, 1, 1, 12).setValues([["ESCOLA","NOME","CPF","FILIADO","E","F","G","CIDADE","I","CELULAR","K","EMAIL"]]);
  aba.getRange(2, 1, 1, 12).setValues([l]);
})();

const inscrever = (extra) => g.compasso_inscrever(Object.assign({
  nome: "Maria Aparecida da Silva", cpf: CPF, escola: "EMEF Castelo Branco",
  cidade: "Vitória", email: "mariaaparecida@gmail.com",
  whatsapp: "27998765432", termoAceito: true
}, extra || {}));

fluxo("COMPASSO · A confirmação da inscrição");

/* ══════════════════════════════════════════════════════════════════════════
   1 · O CAMINHO NORMAL
   ══════════════════════════════════════════════════════════════════════════ */
passo("1 · a pessoa se inscreve e recebe o comprovante");

const antes = amb.outbox.length;
const r1 = inscrever();
ok(r1.ok === true, "a inscrição é aceita", r1.ok ? r1.inscricaoId : r1.erro);
igual(amb.outbox.length, antes + 1, "  e um e-mail saiu");

const msg = amb.outbox[amb.outbox.length - 1];
igual(msg.to, "mariaaparecida@gmail.com", "  para o e-mail da pessoa");
ok(/Inscrição recebida/i.test(String(msg.subject || "")),
   "  com assunto que diz o que é: " + msg.subject);

const corpo = String(msg.body || "");
ok(/NÃO É O INGRESSO/i.test(corpo),
   "  e o aviso de que NÃO é o ingresso, em destaque",
   "sem esta frase alguém aparece na portaria em 19/12 com a confirmação na mão");
ok(/QR Code chega por WhatsApp/i.test(corpo),
   "  dizendo por onde o ingresso vem de verdade");
ok(/Maria/.test(corpo) && /EMEF Castelo Branco/.test(corpo) && /Vitória/.test(corpo),
   "  os dados enviados vêm para conferência");

/* ══════════════════════════════════════════════════════════════════════════
   2 · O PROTOCOLO
   ══════════════════════════════════════════════════════════════════════════ */
passo("2 · um número que se dita ao telefone");

const ins1 = g.fs_get_("inscricoesEventos", r1.inscricaoId);
ok(/^[A-Z0-9]{6}$/.test(String(ins1.protocolo || "")),
   "o protocolo tem 6 caracteres: " + ins1.protocolo,
   "o inscricaoId é um UUID — ninguém dita isso para a secretaria");
ok(corpo.indexOf(ins1.protocolo) > 0, "  e é o mesmo que foi para o e-mail");
ok(String(r1.inscricaoId).toUpperCase().indexOf(ins1.protocolo) > 0,
   "  e continua apontando para o ID real",
   "a secretaria acha a linha por ele");

/* ══════════════════════════════════════════════════════════════════════════
   3 · O QUE NÃO VIAJA INTEIRO
   ══════════════════════════════════════════════════════════════════════════ */
passo("3 · o e-mail atravessa a internet e fica guardado fora daqui");

ok(corpo.indexOf(CPF) < 0 && corpo.indexOf("111.444.777-35") < 0,
   "o CPF cheio NÃO vai no corpo");
ok(/111\.\*\*\*\.\*\*\*-35/.test(corpo),
   "  vai o começo e o fim, que bastam para reconhecer");
ok(corpo.indexOf("mariaaparecida@gmail.com") < 0,
   "nem o e-mail cheio",
   "quem lê a caixa da pessoa já sabe o endereço dela; repetir não acrescenta");
ok(corpo.indexOf("@gmail.com") > 0, "  mas dá para reconhecer o próprio");
ok(corpo.indexOf("998765432") < 0 && /5432/.test(corpo),
   "e o telefone também vai mascarado");

/* ══════════════════════════════════════════════════════════════════════════
   4 · A ASSERÇÃO QUE MAIS IMPORTA
   ══════════════════════════════════════════════════════════════════════════ */
passo("4 · o e-mail cai e a inscrição continua de pé");

const enviarOriginal = g.enviarEmailSISGEP_;
g.enviarEmailSISGEP_ = function () { throw new Error("servidor de e-mail fora do ar"); };

const antesQueda = g.fs_list_("inscricoesEventos").length;
const r2 = inscrever({ cpf: "52998224725", nome: "João Pereira Santos",
                       email: "joao@exemplo.com", whatsapp: "27991112222" });

ok(r2.ok === true,
   "com o envio quebrado, a inscrição AINDA é aceita",
   "se virasse erro na tela, a pessoa se inscreveria de novo — e o sindicato " +
   "ganharia uma duplicidade por causa de um servidor de e-mail");
igual(g.fs_list_("inscricoesEventos").length, antesQueda + 1,
      "  e está gravada no banco");

const ins2 = g.fs_get_("inscricoesEventos", r2.inscricaoId);
ok(!ins2.confirmacaoEnviadaEm, "  sem carimbo de envio, porque não saiu");
ok(/fora do ar/.test(String(ins2.confirmacaoErro || "")),
   "  e com a falha registrada NO DOCUMENTO: " + ins2.confirmacaoErro,
   "só Logger.log faria a primeira notícia vir da fila de telefonemas");

g.enviarEmailSISGEP_ = enviarOriginal;

/* ══════════════════════════════════════════════════════════════════════════
   5 · QUEM NÃO TEM E-MAIL
   ══════════════════════════════════════════════════════════════════════════ */
passo("5 · inscrição só com WhatsApp");

const antesSemEmail = amb.outbox.length;
const r3 = inscrever({ cpf: "16899535009", nome: "Ana Lúcia Ferreira",
                       email: "", whatsapp: "27993334444" });
ok(r3.ok === true, "inscrição só com WhatsApp é aceita");
igual(amb.outbox.length, antesSemEmail,
      "  e nenhum e-mail é tentado",
      "não há para onde mandar — e isso não é falha, é o caso normal de quem " +
      "só deixou o WhatsApp");
const ins3 = g.fs_get_("inscricoesEventos", r3.inscricaoId);
ok(!ins3.confirmacaoErro,
   "  nem fica marcada como erro",
   "marcar erro aqui encheria o painel de falso alarme");

/* ══════════════════════════════════════════════════════════════════════════
   6 · O CAMINHO DO ENVIO
   ══════════════════════════════════════════════════════════════════════════ */
passo("6 · por onde a mensagem sai");

const fs = require("fs"), path = require("path");
const src = fs.readFileSync(
  path.join(require("./load").RAIZ, "EventosInscricaoPublica.gs"), "utf8");

ok(/enviarEmailSISGEP_\(/.test(src),
   "a confirmação passa pela camada central de e-mail",
   "remetente institucional, status estruturado e registro em " +
   "Log_Emails_Enviados — o que MailApp direto não dá");
ok(!/MailApp\.sendEmail/.test(src) && !/GmailApp\.sendEmail/.test(src),
   "  e este arquivo não chama MailApp nem GmailApp direto");

const carimbo = /function compasso_carimbarConfirmacao_/.test(src);
ok(carimbo, "há função própria para o carimbo, chamada nos dois desfechos");

naoTestavel("a confirmação chega na caixa da pessoa",
            "o emulador registra o despacho; a caixa real é a única prova — " +
            "e ela depende de alguém se inscrever de verdade em homologação");

resumo();
