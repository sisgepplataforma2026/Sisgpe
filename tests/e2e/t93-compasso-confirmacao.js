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
ok(/Inscrição recebida/i.test(String(msg.subject || "")),
   "  com assunto que diz o que é: " + msg.subject);

const corpo = String(msg.body || "");
ok(/Este e-mail não é o seu ingresso/i.test(corpo),
   "  e o aviso de que NÃO é o ingresso, em destaque",
   "sem esta frase alguém aparece na portaria em 19/12 com a confirmação na mão");
ok(/ingresso oficial com QR Code/i.test(corpo),
   "  dizendo o que vem depois");
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
ok(/Abertura: 19h00 \| Início: 20h00/.test(comFesta),
   "  e os dois horários na mesma linha");

/* A REGRA QUE EVITA O PIOR DESFECHO — e o teste dela mudou de forma hoje.
   Antes bastava apagar as propriedades para a linha sumir. Agora o local real
   virou PADRÃO no código, então apagar propriedade não esvazia mais nada — o
   que é justamente o comportamento desejado para esta festa.

   A regra continua valendo, e continua importando: para uma edição futura sem
   local fechado, ou para um evento novo, o campo vazio não pode virar
   "Local: (não informado)" num e-mail para 2.000 pessoas. O teste esvazia o
   próprio padrão para provar isso. */
passo("7b · o que falta simplesmente não aparece");

["COMPASSO_LOCAL", "COMPASSO_ENDERECO", "COMPASSO_HORA_ABERTURA",
 "COMPASSO_HORA_INICIO", "COMPASSO_REFERENCIA"].forEach(k => props.deleteProperty(k));

const padraoGuardado = {
  local: g.COMPASSO_FESTA_PADRAO.local,
  endereco: g.COMPASSO_FESTA_PADRAO.endereco,
  referencia: g.COMPASSO_FESTA_PADRAO.referencia
};
g.COMPASSO_FESTA_PADRAO.local = "";
g.COMPASSO_FESTA_PADRAO.endereco = "";
g.COMPASSO_FESTA_PADRAO.referencia = "";

inscrever({ cpf: cpfGerado(322222222), nome: "Beatriz Souza Alves",
            email: "beatriz@exemplo.com" });
const semLocal = String(amb.outbox[amb.outbox.length - 1].body || "");
ok(semLocal.indexOf("Local:") < 0 && semLocal.indexOf("Endereço:") < 0,
   "sem local definido, a linha some — não vira 'Local: (não informado)'",
   "melhor faltar do que mandar campo vazio para 2.000 pessoas");
ok(/19 de dezembro de 2026/.test(semLocal),
   "  mas a data continua, porque ela sempre existe");
ok(/COMPASSO DA VIDA 2026/.test(semLocal),
   "  e o bloco não desaparece inteiro por causa disso");

g.COMPASSO_FESTA_PADRAO.local = padraoGuardado.local;
g.COMPASSO_FESTA_PADRAO.endereco = padraoGuardado.endereco;
g.COMPASSO_FESTA_PADRAO.referencia = padraoGuardado.referencia;

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
passo("9 · o convite da festa, não um ofício");

/* ESTE BLOCO ESTAVA AO CONTRÁRIO ATÉ HOJE, e a inversão é o registro de uma
   correção do usuário. De manhã ele pediu "tom mais institucional" e eu
   escrevi um ofício — "Prezado(a)", "procederá à conferência",
   "Atenciosamente". À tarde ele mandou o texto que queria de verdade: festivo,
   com emoji, fechando em "Nos vemos no Compasso da Vida 2026!".

   Ele está certo, e a razão importa mais que a redação: institucional é o tom
   de uma cobrança. Isto é o convite da festa de fim de ano, e quem lê é a
   associada. As asserções abaixo guardam a decisão DELE — se alguém devolver
   o ofício, elas caem. */
ok(/^Olá, \w+! 👋/m.test(corpo),
   "abre como convite, com o primeiro nome",
   "decisão do usuário em 25/08, corrigindo o tom institucional que eu tinha escrito");
ok(/Nos vemos no Compasso da Vida 2026/.test(corpo),
   "e fecha convidando, não protocolando");
ok(!/Prezado\(a\)/.test(corpo) && !/Atenciosamente/.test(corpo),
   "  sem fórmula de ofício");
ok(/🎶|🎉|📅|📍/.test(corpo),
   "  com os marcadores visuais que ele escolheu",
   "num e-mail em texto puro, o emoji é o que dá hierarquia — não é enfeite");

/* O QUE O TOM NÃO PODE LEVAR JUNTO. Estas três sobrevivem a qualquer
   mudança de redação, e é por isso que estão separadas do bloco acima. */
passo("9b · o que nenhuma redação pode perder");

ok(/não é o seu ingresso/i.test(corpo),
   "o aviso de que não é o ingresso continua",
   "sem ele alguém imprime este e-mail e vai para a portaria em 19/12");
ok(corpo.indexOf(CPF) < 0 && corpo.indexOf("mariaaparecida@gmail.com") < 0,
   "CPF e e-mail continuam mascarados");
ok(corpo.indexOf(ins1.protocolo) > 0,
   "e o protocolo continua no corpo");

/* ══════════════════════════════════════════════════════════════════════════
   10 · O LOCAL REAL COMO PADRÃO
   ══════════════════════════════════════════════════════════════════════════ */
passo("10 · o endereço da festa sai mesmo sem ninguém configurar");

ok(/Espaço Patrick Ribeiro/.test(corpo),
   "o local sai sem depender de propriedade declarada",
   "a festa já tem local fechado; exigir configuração faria o e-mail sair " +
   "sem endereço até alguém lembrar de preencher");
ok(/Roza Helena Schorling Albuquerque/.test(corpo) && /29109-350/.test(corpo),
   "  com endereço e CEP");
ok(/Ao lado do Aeroporto de Vitória/.test(corpo),
   "  e a referência de quem vai de carro",
   "endereço de avenida sem número precisa de ponto de referência");
ok(/sábado, 19 de dezembro/.test(corpo),
   "  e a data traz o dia da semana",
   "saber que cai num sábado é o que decide se a pessoa consegue ir");

/* Propriedade declarada ganha do padrão — o local pode mudar sem deploy. */
props.setProperty("COMPASSO_LOCAL", "Outro Espaço");
inscrever({ cpf: cpfGerado(411111111), nome: "Teste Local Novo",
            email: "local@exemplo.com" });
const trocado = String(amb.outbox[amb.outbox.length - 1].body || "");
ok(/Outro Espaço/.test(trocado) && !/Espaço Patrick Ribeiro/.test(trocado),
   "propriedade declarada vence o padrão do código",
   "trocar o local não exige deploy");
props.deleteProperty("COMPASSO_LOCAL");

/* ══════════════════════════════════════════════════════════════════════════
   11 · O COMPROVANTE PELO WHATSAPP — a premissa corrigida em 25/08/2026
   ══════════════════════════════════════════════════════════════════════════

   "os associados fazem inscrição pelo ZAP". Confirmado depois que o LINK vai
   pela lista de transmissão e a pessoa preenche a tela — mas o contato que a
   maioria deixa é o WhatsApp, não o e-mail. A confirmação automática que este
   arquivo testa acima alcança só quem digitou e-mail.

   O que se prova aqui: que existe caminho para o resto, que ele usa O MESMO
   TEXTO, e que ele respeita a regra das duas etapas.
   ══════════════════════════════════════════════════════════════════════════ */
passo("11 · quem só deixou WhatsApp");

const ADM = b.logar(g, "wanderson");
const rZap = inscrever({ cpf: cpfGerado(511111111), nome: "Solange Martins Rocha",
                         email: "", whatsapp: "27994445555" });
ok(rZap.ok === true, "inscrição só com WhatsApp é aceita");

const prep = g.compasso_prepararConfirmacaoWhatsApp(rZap.inscricaoId, ADM);
ok(prep && prep.ok === true, "o comprovante por WhatsApp é preparado",
   prep && prep.erro);
ok(/^55\d{10,11}$/.test(String(prep.telefone || "")),
   "  com o telefone no formato internacional: " + prep.telefone,
   "sem o 55 o link não abre a conversa");

/* A prova de que não há duas redações para a mesma coisa. */
ok(/Sua inscrição para a Festa Compasso da Vida 2026 foi recebida/.test(prep.texto),
   "  e com O MESMO texto do e-mail",
   "duas redações para a mesma coisa divergem no primeiro ajuste, e aí cada " +
   "canal promete uma coisa diferente");
ok(/não é o seu ingresso/i.test(prep.texto),
   "  inclusive o aviso de que não é o ingresso");
ok(prep.texto.indexOf("994445555") < 0,
   "  e com o contato mascarado, como no e-mail");

/* O protocolo nasce aqui para quem nunca passou pelo e-mail. */
ok(/^[A-Z0-9]{6}$/.test(String(prep.protocolo || "")),
   "o protocolo nasce no preparo: " + prep.protocolo,
   "quem só deixou WhatsApp nunca passou pela confirmação por e-mail, que é " +
   "onde ele era gravado");
igual(g.fs_get_("inscricoesEventos", rZap.inscricaoId).protocolo, prep.protocolo,
      "  e fica gravado, para a secretaria e a pessoa citarem o mesmo número");

passo("11b · preparar não é enviar");

ok(!g.fs_get_("inscricoesEventos", rZap.inscricaoId).confirmacaoEnviadaEm,
   "abrir a conversa NÃO marca o comprovante como enviado",
   "o sistema não sabe se a pessoa apertou enviar no aplicativo");

const marcou = g.compasso_confirmarEnvioConfirmacao(rZap.inscricaoId, ADM);
ok(marcou && marcou.ok === true, "quem enviou é quem confirma");
const insZap = g.fs_get_("inscricoesEventos", rZap.inscricaoId);
ok(!!insZap.confirmacaoEnviadaEm, "  aí sim fica a data");
igual(insZap.confirmacaoVia, "WHATSAPP", "  e o canal");
ok(!!insZap.confirmacaoPor, "  e quem registrou: " + insZap.confirmacaoPor);
ok(g.fs_list_("auditoriaEventos").some(a => a.entidadeId === rZap.inscricaoId &&
                                            a.acao === "COMPROVANTE_WHATSAPP"),
   "  e a trilha registra o envio");

passo("11c · as recusas");

const semZap = inscrever({ cpf: cpfGerado(611111111), nome: "Paulo Henrique Dias",
                           email: "paulo@exemplo.com", whatsapp: "" });
const prepSemZap = g.compasso_prepararConfirmacaoWhatsApp(semZap.inscricaoId, ADM);
ok(prepSemZap && prepSemZap.ok === false,
   "sem WhatsApp válido, recusa com o motivo à vista", prepSemZap && prepSemZap.erro);

const prepInexistente = g.compasso_prepararConfirmacaoWhatsApp("INS-nao-existe", ADM);
ok(prepInexistente && prepInexistente.ok === false, "inscrição inexistente recusa");

/* Permissão: as duas passam pela mesma porta do resto do módulo. */
const FIN = b.logar(g, "rogerio");
[["compasso_prepararConfirmacaoWhatsApp", [rZap.inscricaoId]],
 ["compasso_confirmarEnvioConfirmacao",   [rZap.inscricaoId]]].forEach(([nome, args]) => {
  let recusou = false, msg = "";
  try { g[nome](...args, FIN); }
  catch (e) { recusou = /permit|permiss|acesso|autoriz|sess|administrador/i.test(e.message); msg = e.message; }
  ok(recusou, nome + " recusa quem não tem o módulo eventos", msg.slice(0, 55));
});

/* ══════════════════════════════════════════════════════════════════════════
   12 · A GAVETA
   ══════════════════════════════════════════════════════════════════════════ */
passo("12 · o que a tela mostra");

const tela = fs.readFileSync(path.join(require("./load").RAIZ,
  "CompassoInscricoes.html"), "utf8");

ok(/id="cpvSituacao"/.test(tela) && /id="btCpvWhats"/.test(tela),
   "a gaveta tem a seção do comprovante");
ok(/Comprovante da inscrição/.test(tela),
   "  nomeada de forma a não confundir com o INGRESSO",
   "são duas coisas diferentes na mesma gaveta");
ok(/function comprovanteWhats\(\)/.test(tela) && /function comprovanteMarcar\(\)/.test(tela),
   "  com as duas etapas separadas em duas funções");

/* ONDE AS FUNÇÕES MORAM, e por que isso virou asserção.
   Eu as escrevi em EventosInscricaoPublica.gs, que é o arquivo PÚBLICO — e o
   t79 quebrou na hora: ele guarda que aquele arquivo exponha EXATAMENTE as
   três funções que a tela do associado precisa. Estava certo. Funções
   administrativas ali dentro alargam a superfície pública de um arquivo cuja
   regra é justamente não ter nada além do necessário.
   Foram para EventosEntrega.gs, que já tem o mesmo par preparar/confirmar do
   ingresso. Esta asserção existe para não voltarem. */
const pub = fs.readFileSync(path.join(require("./load").RAIZ,
  "EventosInscricaoPublica.gs"), "utf8");
const entregaSrc = fs.readFileSync(path.join(require("./load").RAIZ,
  "EventosEntrega.gs"), "utf8");
ok(!/function compasso_prepararConfirmacaoWhatsApp/.test(pub) &&
   !/function compasso_confirmarEnvioConfirmacao/.test(pub),
   "as duas funções administrativas NÃO moram no arquivo público",
   "t79 guarda que EventosInscricaoPublica.gs exponha só as três da tela");
ok(/function compasso_prepararConfirmacaoWhatsApp/.test(entregaSrc) &&
   /function compasso_confirmarEnvioConfirmacao/.test(entregaSrc),
   "  e sim em EventosEntrega.gs, junto do mesmo par do ingresso");
ok(/Você enviou o comprovante para/.test(tela),
   "  e a pergunta de confirmação depois de abrir a conversa");
ok(/confirmacaoErro[\s\S]{0,200}O envio automático falhou/.test(tela),
   "a falha do envio automático aparece NA TELA",
   "é aqui que alguém descobre que o e-mail não saiu, e ainda dá para resolver");

const listagem = fs.readFileSync(path.join(require("./load").RAIZ,
  "EventosValidacao.gs"), "utf8");
ok(/confirmacaoEnviadaEm:x\.confirmacaoEnviadaEm/.test(listagem) &&
   /confirmacaoVia:String\(x\.confirmacaoVia/.test(listagem),
   "e a listagem devolve o estado do comprovante para a gaveta pintar");

naoTestavel("o WhatsApp abre e a mensagem chega",
            "wa.me depende do navegador e do aplicativo; só o clique real prova");

/* ══════════════════════════════════════════════════════════════════════════
   13 · O PICO DA LISTA DE TRANSMISSÃO
   ══════════════════════════════════════════════════════════════════════════

   O usuário confirmou como o link chega: "link vai para a lista de
   transmissão". Isso define o perfil de carga — todo mundo recebe no mesmo
   instante e clica na mesma hora, sem chegada distribuída.

   Cada inscrição segura a trava do script durante duas ou três chamadas ao
   Firestore. `waitLock` LANÇA EXCEÇÃO quando não consegue a trava no prazo, e
   até 25/08 essa exceção subia crua até a tela: erro do Apps Script, sem
   mensagem, sem instrução. Quem vê isso preenche tudo de novo — e se a
   primeira tentativa tiver passado, nasce a duplicidade que a trava de CPF
   existe justamente para impedir.
   ══════════════════════════════════════════════════════════════════════════ */
passo("13 · quando a trava não vem a tempo");

const lockOriginal = g.LockService.getScriptLock;
g.LockService.getScriptLock = function () {
  return {
    waitLock: function () { throw new Error("Could not obtain lock in 20000 ms."); },
    releaseLock: function () {},
    tryLock: function () { return false; },
    hasLock: function () { return false; }
  };
};

const antesPico = g.fs_list_("inscricoesEventos").length;
let estourou = false, rPico = null;
try { rPico = inscrever({ cpf: cpfGerado(711111111), nome: "Fernanda Alves Pinto",
                          email: "fernanda@exemplo.com" }); }
catch (e) { estourou = true; }

ok(!estourou,
   "a exceção da trava NÃO sobe crua para a tela",
   "erro do Apps Script sem mensagem é o que faz a pessoa preencher tudo de novo");
ok(rPico && rPico.ok === false, "  volta como recusa explicada");
ok(/NÃO foi registrada/i.test(String((rPico || {}).erro || "")),
   "  e a mensagem diz que a inscrição não foi registrada",
   "sem essa frase a pessoa não sabe se pode tentar de novo: " + (rPico || {}).erro);
ok(/espere um minuto|tente/i.test(String((rPico || {}).erro || "")),
   "  e o que fazer em seguida");
igual(g.fs_list_("inscricoesEventos").length, antesPico,
      "  e nada foi gravado pela metade");

g.LockService.getScriptLock = lockOriginal;

/* A trava continua de pé no caminho normal — a recusa acima não pode ter
   virado "seguir sem travar". */
const rDepois = inscrever({ cpf: cpfGerado(811111111), nome: "Marcos Vieira Luz",
                            email: "marcos@exemplo.com" });
ok(rDepois.ok === true, "com a trava disponível, a inscrição volta a funcionar");

naoTestavel("quantas pessoas simultâneas a trava aguenta de verdade",
            "o emulador é de uma thread só. Só a onda de carga do plano " +
            "(1.000, 2.000 e 2.500) mede a fila real — e ela nunca foi rodada");

resumo();