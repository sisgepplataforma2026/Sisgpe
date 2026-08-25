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

/* CPFs GERADOS, não inventados. Já errei isso uma vez no t91: números
   escritos à mão são recusados pelo dígito verificador, a inscrição nem
   acontece, e o teste mede a coisa errada achando que mediu a certa. */
const cpfGerado = base => {
  const n = String(base).padStart(9, "0").slice(0, 9).split("").map(Number);
  let s1 = 0; for (let i = 0; i < 9; i++) s1 += n[i] * (10 - i);
  let d1 = (s1 * 10) % 11; if (d1 === 10) d1 = 0;
  const m = n.concat([d1]);
  let s2 = 0; for (let i = 0; i < 10; i++) s2 += m[i] * (11 - i);
  let d2 = (s2 * 10) % 11; if (d2 === 10) d2 = 0;
  return m.concat([d2]).join("");
};

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
ok(/Confirmação de inscrição/i.test(String(msg.subject || "")),
   "  com assunto que diz o que é: " + msg.subject);

const corpo = String(msg.body || "");
ok(/NÃO CONSTITUI\s*\n?INGRESSO/i.test(corpo),
   "  e o aviso de que NÃO é o ingresso, em destaque",
   "sem esta frase alguém aparece na portaria em 19/12 com a confirmação na mão");
ok(/QR Code será\s*\n?encaminhado por WhatsApp/i.test(corpo),
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

/* ══════════════════════════════════════════════════════════════════════════
   7 · QUANDO E ONDE É A FESTA — pedido do usuário em 25/08/2026
   ══════════════════════════════════════════════════════════════════════════

   "esse texto precisa ser ajustado", e o que faltava era o óbvio: o e-mail
   confirmava inscrição para uma festa sem dizer a data. Junto veio a escolha
   de tom institucional.

   A busca desses dados tem uma armadilha que o teste guarda: a tela de
   Informações grava pela camada V2, e `eventosV2Repo_exigirHomologacao_`
   ESTOURA fora de homologação. Em dezembro, em produção, ler dali quebraria
   dentro do caminho público da inscrição. Por isso a cascata — e por isso a
   asserção que derruba a camada de propósito.
   ══════════════════════════════════════════════════════════════════════════ */
passo("7 · a data, o horário e o local");

props.setProperty("COMPASSO_LOCAL", "Pavilhão de Carapina");
props.setProperty("COMPASSO_ENDERECO", "Av. Central, 1000 — Serra/ES");
props.setProperty("COMPASSO_HORA_ABERTURA", "19h00");
props.setProperty("COMPASSO_HORA_INICIO", "20h00");

const antesFesta = amb.outbox.length;
inscrever({ cpf: cpfGerado(300000000), nome: "Carlos Eduardo Lima", email: "carlos@exemplo.com" });
const comFesta = String(amb.outbox[amb.outbox.length - 1].body || "");
ok(amb.outbox.length === antesFesta + 1, "saiu o e-mail com os dados da festa");
ok(/19 de dezembro de 2026/.test(comFesta),
   "  a data vem por extenso, como em ofício: 19 de dezembro de 2026",
   "vem de EMISSAO_CFG.DATA_EVENTO, que existe em qualquer ambiente");
ok(/Pavilhão de Carapina/.test(comFesta) && /Av\. Central/.test(comFesta),
   "  o local e o endereço aparecem");
ok(/Abertura[.\s]+19h00/.test(comFesta) && /Início[.\s]+20h00/.test(comFesta),
   "  e os dois horários");

/* A regra que evita o pior desfecho deste bloco. */
passo("7b · o que falta simplesmente não aparece");

["COMPASSO_LOCAL", "COMPASSO_ENDERECO", "COMPASSO_HORA_ABERTURA", "COMPASSO_HORA_INICIO"]
  .forEach(k => props.deleteProperty(k));

inscrever({ cpf: cpfGerado(300007919), nome: "Beatriz Souza Alves", email: "beatriz@exemplo.com" });
const semLocal = String(amb.outbox[amb.outbox.length - 1].body || "");
ok(semLocal.indexOf("Local") < 0 && semLocal.indexOf("Endereço") < 0,
   "sem local definido, a linha some — não vira 'Local: (não informado)'",
   "melhor faltar do que mandar campo vazio para 2.000 pessoas");
ok(/19 de dezembro de 2026/.test(semLocal),
   "  mas a data continua, porque ela sempre existe");
ok(/A FESTA/.test(semLocal), "  e o bloco não desaparece inteiro por causa disso");

/* ══════════════════════════════════════════════════════════════════════════
   8 · A CAMADA V2 CAI E O E-MAIL NÃO CAI JUNTO
   ══════════════════════════════════════════════════════════════════════════ */
passo("8 · em produção a tela de Informações é bloqueada");

const repoOriginal = g.eventosV2Repo_listar_;
g.eventosV2Repo_listar_ = function () {
  throw new Error("Eventos V2: operação bloqueada. Esta camada de persistência " +
                  "está habilitada somente em HOMOLOGAÇÃO.");
};

const antesBloqueio = amb.outbox.length;
const rBloq = inscrever({ cpf: cpfGerado(300015838), nome: "Rafael Mendes Costa",
                          email: "rafael@exemplo.com" });
ok(rBloq.ok === true,
   "com a camada V2 recusando, a inscrição continua aceita",
   "EventosRepositoryV2.gs:55 estoura fora de homologação — e em dezembro " +
   "o sistema estará em produção");
igual(amb.outbox.length, antesBloqueio + 1, "  e o e-mail sai assim mesmo");
ok(/19 de dezembro de 2026/.test(String(amb.outbox[amb.outbox.length - 1].body || "")),
   "  ainda com a data, que não depende daquela camada");

g.eventosV2Repo_listar_ = repoOriginal;

/* ══════════════════════════════════════════════════════════════════════════
   9 · O TOM
   ══════════════════════════════════════════════════════════════════════════ */
passo("9 · correspondência do sindicato, não recado");

ok(/^Prezado\(a\) /m.test(corpo),
   "abre com tratamento institucional");
ok(!/Prezada |Prezado [A-Z]/.test(corpo),
   "  em '(a)', sem deduzir tratamento pelo nome",
   "o cadastro não guarda como a pessoa se trata, e deduzir erra com gente de verdade");
ok(/Atenciosamente,/.test(corpo), "fecha com o encerramento de ofício");
ok(/Sindicato dos Educadores Técnico-Administrativos/.test(corpo),
   "e assina com o nome por extenso da entidade");
ok(!/Olá,/.test(corpo) && !/!\n/.test(corpo.split("\n")[0]),
   "  sem saudação informal");

resumo();
