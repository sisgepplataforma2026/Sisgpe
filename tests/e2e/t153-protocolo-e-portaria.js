/**
 * TESTE — O QUE A PESSOA LEVA DA INSCRIÇÃO, E POR ONDE A PORTARIA LÊ
 *
 * O QUE ORIGINOU, 09/09/2026. O usuário testou a festa na homologação e, no
 * meio do teste, reafirmou pela terceira vez:
 *
 *     "não sairá nenhum convite por email e todos serão pelo zap enviados"
 *
 * E o log do próprio teste dele mostrou o resto:
 *
 *     [enviarEmailSISGEP_] ... Service invoked too many times for one day: gmail
 *
 * O comprovante NÃO SAIU. E a tela pública, naquele momento, dizia à pessoa
 * "o ingresso será enviado para o seu e-mail e WhatsApp" — prometendo um
 * e-mail desligado por decisão E que nem teria saído.
 *
 * TRÊS DEFEITOS QUE SÓ APARECERAM PORQUE ALGUÉM RODOU:
 *
 *   1. o protocolo nascia DENTRO do caminho do e-mail — quem não deixou
 *      e-mail saía sem protocolo nenhum. Justamente quem só tem WhatsApp,
 *      que pela descrição do usuário é a maioria;
 *   2. o protocolo nunca voltava para a tela, nem para quem tinha e-mail;
 *   3. a única forma de abrir o leitor de QR era um diálogo dentro da
 *      planilha. Não havia URL para dar a quem fica na porta.
 *
 * Ele resumiu o sintoma do 3 assim: "a câmera reconhece o qr code mas não
 * acontece nada". Não era o QR — era não haver para onde levá-lo.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = f => fs.readFileSync(path.join(RAIZ, f), "utf8");

/* ─── Firestore em memória ───────────────────────────────────────────────── */
const BANCO = new Map();
const ch = (c, i) => c + "/" + i;
const cl = o => JSON.parse(JSON.stringify(o));
g.fs_set_ = (c, i, o) => { BANCO.set(ch(c, i), cl(o)); return { ok: true }; };
g.fs_get_ = (c, i) => { const v = BANCO.get(ch(c, i)); return v ? cl(v) : null; };
g.fs_list_ = c => { const o = []; BANCO.forEach((v, k) => { if (k.indexOf(c + "/") === 0) o.push(cl(v)); }); return o; };
g.fs_queryEquals_ = (c, campo, valor) => g.fs_list_(c).filter(d => String(d[campo]) === String(valor));
g.fs_findByField_ = (c, campo, valor, lim) => g.fs_queryEquals_(c, campo, valor).slice(0, lim || 100);

const props = g.PropertiesService.getScriptProperties();
props.setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual(true);
props.setProperty("EVENTO_MODO_TESTE", "true");
props.setProperty("COMPASSO_QR_SECRET", "segredo-de-teste");

function inscrever(extra) {
  return g.compasso_inscrever(Object.assign({
    nome: "Maria Aparecida da Silva", rg: "1234567",
    escola: "EMEF Castelo Branco", cidade: "Vitória", termoAceito: true
  }, extra));
}

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · a inscrição fica identificada, com ou sem e-mail");
passo("com e-mail");

const comEmail = inscrever({ cpf: "11144477735", email: "a@exemplo.com", whatsapp: "27998877665" });
ok(comEmail.ok === true, "a inscrição é aceita", comEmail.erro || comEmail.inscricaoId);
ok(!!comEmail.protocolo, "e a inscrição fica com protocolo: " + comEmail.protocolo,
   "é como a equipe identifica a inscrição na fila do zap — a TELA não o mostra");

passo("SEM e-mail — o caso que estava quebrado");

/* Era aqui que o protocolo sumia: o caminho antigo devolvia SEM_EMAIL antes de
   gerá-lo. Quem só tem WhatsApp saía sem número nenhum. */
const semEmail = inscrever({ cpf: "52998224725", email: "", whatsapp: "27991112222" });
ok(semEmail.ok === true, "inscrição só com WhatsApp é aceita");
ok(!!semEmail.protocolo,
   "e TAMBÉM fica com protocolo: " + semEmail.protocolo,
   "é a maioria das pessoas desta festa — não pode ser o caso sem identificação");

igual(g.fs_get_("inscricoesEventos", semEmail.inscricaoId).protocolo, semEmail.protocolo,
      "e o gravado é o mesmo que a função devolveu");

passo("o protocolo é estável — não muda se alguém reprocessar");

igual(g.compasso_protocoloInscricao_(comEmail.inscricaoId), comEmail.protocolo,
      "recalcular dá o mesmo valor",
      "derivado do inscricaoId; protocolo que muda é protocolo que não serve");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · a mensagem final não promete o que não vai acontecer");
passo("nada de e-mail");

const msg = String(comEmail.mensagem || "");
ok(!/e-?mail/i.test(msg),
   "a mensagem NÃO fala em e-mail: \"" + msg.slice(0, 70) + "…\"",
   'o usuário, três vezes: "não sairá nenhum convite por email"');
ok(/whats/i.test(msg), "e diz que o ingresso vem pelo WhatsApp");
ok(/não é preciso fazer nada|conferir/i.test(msg),
   "e diz que a pessoa não precisa fazer mais nada agora",
   "sem isso ela fica esperando um passo que não existe");

passo("é uma mensagem simples, não um número para decorar");

/* O usuário cortou a caixa de protocolo que eu tinha posto na tela: "não é
   protocolo e sim uma mensagem simples de inscrição realizada". Esta tela
   existe para quem tem pouca prática com computador — um código destacado faz
   a pessoa achar que precisa fazer alguma coisa com ele. */
ok(!/protocolo/i.test(msg),
   "a mensagem NÃO joga um número de protocolo na cara da pessoa");
const telaHtml = ler("CompassoInscricaoPublica.html");
ok(!/fimProtocolo/.test(telaHtml),
   "e a tela não tem mais a caixa de protocolo",
   "o protocolo continua gravado para a equipe; só não é mais assunto do associado");

passo("o texto é ajustável sem publicar versão");

/* "podemos até ajustar esse texto" — e ajustar texto não pode custar deploy.
   Mesma regra que já vale para o convite e para o termo. */
props.setProperty("COMPASSO_MSG_CONCLUSAO", "Deu tudo certo, viu!");
const custom = inscrever({ cpf: "98765432100", email: "", whatsapp: "27995556666" });
igual(custom.mensagem, "Deu tudo certo, viu!",
      "a propriedade COMPASSO_MSG_CONCLUSAO troca o texto na hora");
props.setProperty("COMPASSO_MSG_CONCLUSAO", "");

passo("quem não deixou WhatsApp é avisado do que fazer");

const semNada = inscrever({ cpf: "39053344705", email: "c@exemplo.com", whatsapp: "" });
ok(/secretaria/i.test(String(semNada.mensagem || "")),
   "sem WhatsApp, a mensagem manda procurar a secretaria",
   "é a única pessoa que o zap não alcança — precisa de outro caminho");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · pendência não é erro");
passo("três estados, não dois");

/* O t93 pegou isto quando eu tinha juntado os dois: "marcar erro aqui encheria
   o painel de falso alarme". Com a entrega toda pelo zap, quase toda inscrição
   cai no estado do meio — e um painel de erro com 2.000 falsos alarmes é o
   mesmo que não ter painel. */
const insSemEmail = g.fs_get_("inscricoesEventos", semEmail.inscricaoId);
ok(!insSemEmail.confirmacaoErro,
   "quem não deixou e-mail NÃO fica marcado como erro");
ok(!!insSemEmail.confirmacaoPendente,
   "fica marcado como PENDENTE: " + String(insSemEmail.confirmacaoPendente).slice(0, 45),
   "é a fila do WhatsApp — gente para avisar, não defeito para investigar");

passo("com o comprovante desligado, também é pendência");

props.setProperty(g.COMPASSO_PROP_EMAIL_COMPROVANTE, "false");
const desligado = inscrever({ cpf: "45317828791", email: "d@exemplo.com", whatsapp: "27993334444" });
const insDesl = g.fs_get_("inscricoesEventos", desligado.inscricaoId);
ok(!insDesl.confirmacaoErro, "e-mail desligado por decisão não é erro");
ok(!!insDesl.confirmacaoPendente, "  é pendência");
ok(!!desligado.protocolo, "  e o protocolo sai do mesmo jeito: " + desligado.protocolo);
props.setProperty(g.COMPASSO_PROP_EMAIL_COMPROVANTE, "");

passo("falha de verdade continua sendo erro");

/* Foi o que aconteceu no ar em 09/09: o Gmail recusou por cota. Isso É para
   alguém olhar — e tem de se distinguir de quem simplesmente não tem e-mail. */
/* Liga o comprovante de propósito: o padrão é DESLIGADO (t151), e desligado
   nunca chega no envio. O que se mede aqui é o que acontece quando o envio é
   TENTADO e falha — que é o caso real de hoje, e tem de continuar sendo erro
   para quem religar o e-mail um dia. */
props.setProperty(g.COMPASSO_PROP_EMAIL_COMPROVANTE, "true");
const envioOriginal = g.enviarEmailSISGEP_;
g.enviarEmailSISGEP_ = () => ({ ok: false, mensagem: "Service invoked too many times for one day: gmail." });
const falhou = inscrever({ cpf: "12345678909", email: "e@exemplo.com", whatsapp: "27994445555" });
const insFalhou = g.fs_get_("inscricoesEventos", falhou.inscricaoId);
ok(!!insFalhou.confirmacaoErro,
   "cota estourada FICA marcada como erro",
   "é o caso real de hoje — se virasse pendência, ninguém investigaria");
ok(!insFalhou.confirmacaoPendente, "  e não como pendência");
ok(!!falhou.protocolo,
   "  mas o protocolo sai assim mesmo: " + falhou.protocolo,
   "foi o defeito central: sem isso a inscrição de hoje teria ficado sem identificação");
g.enviarEmailSISGEP_ = envioOriginal;
props.setProperty(g.COMPASSO_PROP_EMAIL_COMPROVANTE, "");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · a portaria tem endereço");
passo("existe rota para o leitor de QR");

const code = ler("Code.gs");
ok(/p\.painel === "portaria"/.test(code),
   "o Code.gs serve a portaria por URL (?painel=portaria)",
   'antes só abria como diálogo dentro da planilha — não havia link para dar a quem fica na porta');
ok(/createHtmlOutputFromFile\("EventosPortaria"\)/.test(code),
   "  e serve o arquivo do leitor de QR");

const trechoPortaria = code.slice(code.indexOf('p.painel === "portaria"'));
ok(trechoPortaria.indexOf("getSessaoUsuario") < trechoPortaria.indexOf("EventosPortaria"),
   "  conferindo a sessão ANTES de servir a tela",
   "a portaria dá entrada em festa de 2.000 pessoas — não pode abrir sem login");

passo("o leitor avisa quando a sessão não chega");

const portaria = ler("EventosPortaria.html");
ok(/if\(!COMPASSO_TOKEN\)/.test(portaria),
   "sem sessão, a tela avisa em vez de recusar leitura por leitura",
   "senão a fila anda e cada pessoa recebe um erro genérico, uma por vez");
ok(/start\.disabled=true/.test(portaria),
   "  e desliga o botão de ler");

passo("e avisa quando o aparelho não tem leitor nativo");

ok(/BarcodeDetector' in window/.test(portaria) && /Android/.test(portaria),
   "a tela diz que precisa de aparelho com leitor nativo",
   "BarcodeDetector é do Chromium — no iPhone não existe, e descobrir isso " +
   "na porta em 19/12 é tarde");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · o que este teste NÃO prova");

naoTestavel("se a sessão chega na portaria pela URL",
  "no Apps Script a tela roda dentro de um iframe isolado, e `location.search` " +
  "lá pode não trazer os parâmetros da URL original. As outras telas de painel " +
  "leem do mesmo jeito e nunca foram operadas — então ou funciona para todas " +
  "ou está quebrado para todas. Só abrindo o link responde. O aviso de 'sem " +
  "sessão' existe justamente para essa resposta ser imediata.");

naoTestavel("se a câmera abre dentro do iframe do Apps Script",
  "getUserMedia dentro de iframe sandbox depende de permissão do navegador. " +
  "Quem responde é abrir a portaria num Android com Chrome e apontar para um QR.");

naoTestavel("a segunda leitura do mesmo QR recusando",
  "a trava sob LockService só se prova com dois aparelhos lendo o mesmo " +
  "ingresso. Continua sendo o item da Onda 3.");

resumo();
