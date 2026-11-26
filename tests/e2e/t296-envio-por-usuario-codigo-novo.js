/**
 * ENVIO EM NOME DE QUEM ESTÁ LOGADO — CÓDIGO NOVO, AINDA SEM CHAMADOR (26/11/2026).
 * Prova: (1) quem é o remetente por usuário (financeiro@ → Financeiro; secretaria@ e os demais → Secretaria); (2) o pacote que vai ao leitor da
 * Secretaria leva destinatários, cópias, assunto, corpo e anexos em base64; (3) a trava de homologação vale; (4) sem destinatário, recusa;
 * (5) NADA do caminho de hoje mudou: nenhuma função em uso chama as novas. NÃO PROVA: o envio de verdade pelo leitor nem a caixa de Itens enviados.
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const { g } = b.subir({});
b.fluxo("ENVIO POR USUÁRIO · remetente");
b.passo("1. quem envia");
b.igual(g.envioRemetentePorSessao_({ email: "financeiro@sindeducacao.com", nome: "Qualquer" }), "FINANCEIRO", "financeiro@ → Financeiro");
b.igual(g.envioRemetentePorSessao_({ email: "secretaria@sindeducacao.com", nome: "Marcelha Aline" }), "SECRETARIA", "secretaria@ → Secretaria");
b.igual(g.envioRemetentePorSessao_({ email: "wanderson@outro.com", nome: "Wanderson Nascimento Castelo" }), "FINANCEIRO", "login de outro e-mail, mas é o financeiro pelo nome → Financeiro (mesma regra da Caixa)");
b.igual(g.envioRemetentePorSessao_({ email: "fulano@sindeducacao.com", nome: "Fulano de Tal" }), "SECRETARIA", "outro usuário → Secretaria ('as demais são com a Marcela')");
b.igual(g.envioRemetentePorSessao_(null), "SECRETARIA", "sem sessão → Secretaria");

b.fluxo("ENVIO POR USUÁRIO · pacote para o leitor da Secretaria");
let chamada = null;
g.cxgApi_ = (op, args) => { chamada = { op, args }; return { ok: true, anexos: (args.anexos || []).map((a) => a.nome) }; };
g.getAmbienteAtual = () => "producao";
const blob = g.Utilities.newBlob("conteudo do pdf", "application/pdf", "Oficio_232.pdf");
g.envioPelaSecretaria_({ to: "escola@exemplo.com", cc: "a@x.com, b@x.com", bcc: ["c@x.com"], subject: "Ofício 232/2026", htmlBody: "<p>oi</p>", attachments: [blob] }, "Segue ofício em anexo.");
b.ok(chamada && chamada.op === "novoEmail", "chama a operação 'novoEmail' do leitor");
const a = (chamada && chamada.args) || {};
b.ok(a.para === "escola@exemplo.com" && a.cc === "a@x.com,b@x.com" && a.cco === "c@x.com", "destinatário, cc e cco vão separados", JSON.stringify([a.para, a.cc, a.cco]));
b.ok(a.assunto === "Ofício 232/2026" && a.html === "<p>oi</p>" && a.texto === "Segue ofício em anexo." && a.soGuardar === false, "assunto, corpo html, texto simples; envia (não só guarda)");
b.ok(a.anexos && a.anexos.length === 1 && a.anexos[0].nome === "Oficio_232.pdf" && a.anexos[0].tipo === "application/pdf" && Buffer.from(a.anexos[0].b64, "base64").toString() === "conteudo do pdf", "o anexo vai em base64, igual ao original");

b.fluxo("ENVIO POR USUÁRIO · travas");
let erro = ""; try { g.envioPelaSecretaria_({ to: "", subject: "x" }, ""); } catch (e) { erro = String(e.message); }
b.ok(/sem destinat/i.test(erro), "sem destinatário, recusa", erro);
g.getAmbienteAtual = () => "homologacao";
erro = ""; chamada = null; try { g.envioPelaSecretaria_({ to: "escola@exemplo.com", subject: "x", htmlBody: "y" }, ""); } catch (e) { erro = String(e.message); }
b.ok(/HML/.test(erro) && chamada === null, "em homologação, e-mail para fora da equipe é BLOQUEADO antes de chamar o leitor", erro.slice(0, 60));
g.getAmbienteAtual = () => "producao";

b.fluxo("ENVIO POR USUÁRIO · o caminho de hoje não mudou");
const raiz = path.join(__dirname, "../..");
const quem = fs.readdirSync(raiz).filter((f) => f.endsWith(".gs") && f !== "EnvioPorUsuario.gs" && /envioPelaSecretaria_|envioRemetentePorSessao_|envioViaSecretariaDisponivel_/.test(fs.readFileSync(path.join(raiz, f), "utf8")));
b.igual(quem, [], "nenhum arquivo em uso chama as funções novas (só este arquivo e o teste as conhecem)", quem.join(", "));
b.naoTestavel("o envio de verdade pelo leitor da Secretaria e a pasta Itens enviados", "só no ar, com o leitor ligado");
b.resumo();
