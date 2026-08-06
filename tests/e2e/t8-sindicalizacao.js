/**
 * TESTE PONTA A PONTA — SINDICALIZAÇÃO
 *
 * O ciclo de vida do associado: ficha preenchida na escola (sem login) →
 * assinatura por OTP → aprovação da secretaria → virou associado →
 * carteirinha → desfiliação. É o fluxo que define quem é sócio do sindicato,
 * então erro aqui é erro de base cadastral.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const SIN = b.logar(g, "joscimar");   // escolas + sindicalizacao
const FIN = b.logar(g, "rogerio");    // financeiro + rh — NÃO tem sindicalizacao

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1, 1, 1, 2).setValues([["CHAVE", "VALOR"]]);
// Setup do próprio módulo — cria a aba SISGEP_Sindicalizacao com o cabeçalho.
g.configurarAbaSindicalizacao();

// As abas Associados (~8.000 linhas) e Escolas (681) JÁ EXISTEM na planilha
// de produção — o sistema nunca as cria, só lê. Sem elas aqui, o teste
// falharia por um motivo que não é do sistema ("Aba Associados não
// encontrada"), e um teste que falha pelo motivo errado é pior que nenhum.
// Cabeçalho copiado do contrato documentado em SindicalizacaoAssociados.gs:9.
const cabAssociados = [
  "Nome fantasia", "Nome", "CPF", "Filiado", "Logradouro", "Número",
  "Bairro", "Cidade", "CEP", "Celular", "CELULAR2", "E-mail",
  "ULTIMA_ATUALIZACAO", "MATRICULA", "DATA_FILIACAO", "ID_FICHA"
];
if (!ss.getSheetByName("Associados")) {
  ss.insertSheet("Associados").getRange(1, 1, 1, cabAssociados.length).setValues([cabAssociados]);
}
if (!ss.getSheetByName("Escolas")) {
  const abaEsc = ss.insertSheet("Escolas");
  abaEsc.getRange(1, 1, 2, 2).setValues([["CNPJ", "Escola"], ["", "Escola Modelo"]]);
}

const CPF = "111.444.777-35";
const ficha = {
  nome: "Maria Aparecida Souza", cpf: CPF, rg: "1234567",
  dataNascimento: "1985-04-12", sexo: "F", estadoCivil: "SOLTEIRO",
  email: "maria.teste@exemplo.com", telefone: "(27) 99999-1234",
  celular: "(27) 99999-1234",
  cepResidencial: "29000-000", endereco: "Rua Teste, 100", numero: "100",
  bairro: "Centro", cidade: "Vitória", uf: "ES",
  escola: "Escola Modelo", cargo: "Auxiliar Administrativo",
  dataAdmissao: "2020-03-10", salario: "2500,00"
};

/* ══════════ 1. A FICHA NASCE NA ESCOLA, SEM LOGIN ══════════ */
b.fluxo("SINDICALIZAÇÃO · Ficha → assinatura → aprovação → associado → carteirinha");

b.passo("1. Trabalhador preenche a ficha pelo QR da visita (sem login)");
const env = g.submeterFichaSindicalizacao(ficha);
const deuCerto = r => !!(r && (r.ok === true || r.sucesso === true));
const recusou  = r => !!(r && (r.ok === false || r.sucesso === false));
b.ok(deuCerto(env), "submeterFichaSindicalizacao registra",
  env && !env.ok ? "ERRO: " + (env.mensagem || JSON.stringify(env)) : "ID " + (env.idFicha || env.id || "?"));
const IDF = env && (env.idFicha || env.id);

b.passo("2. Registro — a ficha existe e tem status inicial");
let fichas = g.listarFichasSindicalizacao({}, SIN);
const arr = (fichas && fichas.fichas) || [];
const minha = arr.find(f => String(f.ID_FICHA) === String(IDF));
b.ok(!!minha, "a ficha aparece na fila da secretaria",
  minha ? "status: " + minha.STATUS : arr.length + " fichas na lista, nenhuma com esse ID");

b.passo("3. Duplicidade — mesmo CPF enviado de novo");
const dup = g.submeterFichaSindicalizacao(ficha);
if (deuCerto(dup) && String(dup.idFicha || dup.id) !== String(IDF)) {
  b.aviso("o mesmo CPF gerou uma SEGUNDA ficha", "id " + (dup.idFicha || dup.id));
} else {
  b.ok(true, "reenvio do mesmo CPF não cria ficha duplicada", dup && (dup.mensagem || "reaproveitou " + (dup.idFicha || dup.id)));
}

b.passo("4. CPF inválido é recusado");
const ruim = g.submeterFichaSindicalizacao(Object.assign({}, ficha, { cpf: "000.000.000-00", nome: "" }));
b.ok(!deuCerto(ruim), "ficha com CPF inválido e nome vazio é recusada",
  ruim && (ruim.mensagem || (ruim.erros || []).join(" | ")));

b.passo("5. Assinatura por OTP");
let otp; try { otp = g.enviarOTPSindicalizacao(IDF); } catch (e) { otp = { ok: false, mensagem: e.message }; }
b.ok(otp && otp.ok !== false, "enviarOTPSindicalizacao dispara o código", JSON.stringify(otp).slice(0, 80));
b.ok(amb.outbox.length >= 1, "o código sai por e-mail/SMS", amb.outbox.map(m => m.to).join(" · ") || "nada enviado");

b.passo("6. OTP errado não assina");
let otpErrado; try { otpErrado = g.validarOTPEAssinarFicha(IDF, "000000", "127.0.0.1"); }
catch (e) { otpErrado = { ok: false, mensagem: e.message }; }
b.ok(recusou(otpErrado), "código errado é recusado", otpErrado && otpErrado.mensagem);

b.passo("6b. Assinar com o código certo");
// O OTP fica gravado na linha da ficha. Ler dali é o que um teste pode fazer;
// o associado recebe por e-mail. Sem assinar, a aprovação é barrada — e é
// esse encadeamento que o teste precisa provar.
// O OTP NÃO fica na planilha — fica no CacheService, com validade curta e
// contador de tentativas. É o desenho certo: código de assinatura não deve
// sobreviver numa planilha que várias pessoas abrem.
const codigo = g.CacheService.getScriptCache().get("SIND_OTP_" + IDF) || "";
let ass; try { ass = g.validarOTPEAssinarFicha(IDF, codigo, "127.0.0.1"); }
catch (e) { ass = { sucesso: false, mensagem: e.message }; }
b.ok(deuCerto(ass), "código certo assina a ficha", ass && ass.mensagem);
b.ok(!!codigo, "o código vive no cache, não na planilha", codigo ? "recuperado do CacheService" : "não encontrado no cache");

/* ══════════ 2. APROVAÇÃO ══════════ */
b.passo("7. Aprovar a ficha (só depois de assinada)");
let apr; try { apr = g.aprovarFichaSindicalizacao(IDF, "Joscimar", SIN); }
catch (e) { apr = { ok: false, mensagem: e.message }; }
b.ok(deuCerto(apr), "aprovarFichaSindicalizacao aprova", apr && !apr.ok ? "ERRO: " + apr.mensagem : "");

b.passo("8. INTEGRAÇÃO — aprovar a ficha cria o associado?");
const abaAss = ss.getSheetByName("Associados");
let virouAssociado = false, linhaAss = null;
if (abaAss && abaAss.getLastRow() >= 2) {
  const dados = abaAss.getRange(2, 1, abaAss.getLastRow() - 1, abaAss.getLastColumn()).getValues();
  const so = s => String(s || "").replace(/\D/g, "");
  linhaAss = dados.find(l => l.some(c => so(c) === so(CPF) && so(c).length === 11));
  virouAssociado = !!linhaAss;
}
b.ok(virouAssociado, "o aprovado vira registro na aba Associados",
  virouAssociado ? "encontrado pelo CPF" : "NÃO encontrado — a ficha aprovada não alimentou a base");

/* ══════════ 3. CARTEIRINHA ══════════ */
// A carteirinha nasce de uma SOLICITAÇÃO com foto, feita pelo associado no
// Portal Público, que cai na aba "Carteirinhas". Sem essa linha, qualquer
// chamada devolve "Solicitação não encontrada" — e um teste que aceite essa
// resposta como "respondeu" não está testando carteirinha nenhuma.
const cabCarteirinhas = ["CPF", "Nome", "URL_Foto", "Status", "Data_Envio",
  "Data_Aprovacao", "Aprovado_Por", "Origem", "Motivo_Rejeicao"];
const abaCart = ss.insertSheet("Carteirinhas");
abaCart.getRange(1, 1, 1, cabCarteirinhas.length).setValues([cabCarteirinhas]);
abaCart.appendRow([CPF, ficha.nome, "https://drive/foto.jpg", "Pendente", new Date(), "", "", "PORTAL", ""]);

b.passo("9. Aprovar a foto e emitir a carteirinha do recém-filiado");
let cart; try { cart = g.aprovarEEmitirCarteirinha(CPF, "28/02/2027", SIN); }
catch (e) { cart = { sucesso: false, mensagem: e.message }; }
b.ok(deuCerto(cart), "aprovarEEmitirCarteirinha emite", cart && cart.mensagem);

b.passo("10. INTEGRAÇÃO — a emissão chega em Carteirinhas_Emitidas com código");
const abaEmit = ss.getSheetByName("Carteirinhas_Emitidas");
let emitida = null;
if (abaEmit && abaEmit.getLastRow() >= 2) {
  const linhas = abaEmit.getRange(2, 1, abaEmit.getLastRow() - 1, abaEmit.getLastColumn()).getValues();
  emitida = linhas.find(l => String(l[0]).replace(/\D/g, "") === CPF.replace(/\D/g, ""));
}
b.ok(!!emitida && String(emitida[3]).toUpperCase() === "ATIVA",
  "a carteirinha fica ATIVA na aba que o Portal do Associado lê",
  emitida ? "status " + emitida[3] + ", validade " + emitida[4] : "nenhuma emissão gravada");
b.ok(!!emitida && String(emitida[2] || "").length >= 8 && String(emitida[2]).indexOf(CPF.replace(/\D/g, "")) === -1,
  "o código de validação do QR não é dedutível do CPF",
  emitida ? "código " + emitida[2] : "sem código");

b.passo("11. Carteirinha de CPF que não tem solicitação");
let cartFake; try { cartFake = g.aprovarEEmitirCarteirinha("529.982.247-25", "28/02/2027", SIN); }
catch (e) { cartFake = { sucesso: false, mensagem: e.message }; }
b.ok(recusou(cartFake), "CPF sem solicitação não gera carteirinha", cartFake && cartFake.mensagem);

/* ══════════ 4. DESFILIAÇÃO ══════════ */
// sindAss_desfiliar_ termina com "_": é interna, chamada por gerarOficioWeb
// no ofício de desfiliação. Não existe sindAss_desfiliar sem underscore — a
// versão anterior deste teste chamava esse nome, tomava "is not a function"
// e ainda assim contava como passou. Assinatura real: (cpf, usuario, token).
b.passo("12. Desfiliar (o que o ofício de desfiliação executa)");
let desf; try { desf = g.sindAss_desfiliar_(CPF, "Joscimar", SIN); }
catch (e) { desf = { erro: e.message }; }
b.ok(desf && desf.encontrado === true, "sindAss_desfiliar_ localiza e desfilia",
  desf && desf.erro ? "ERRO: " + desf.erro : "linha " + (desf && desf.linha));

b.passo("13. INTEGRAÇÃO — desfiliar marca Filiado = N e revoga a carteirinha");
const situacao = g.consultarAssociadoPorCPF(CPF, SIN);
b.ok(situacao && situacao.existe && situacao.filiado === false,
  "o associado consta como NÃO filiado depois da desfiliação",
  situacao && situacao.existe ? "filiado=" + situacao.filiado : "sumiu da base");

let emitidaDepois = null;
if (abaEmit && abaEmit.getLastRow() >= 2) {
  const linhas = abaEmit.getRange(2, 1, abaEmit.getLastRow() - 1, abaEmit.getLastColumn()).getValues();
  emitidaDepois = linhas.reverse().find(l => String(l[0]).replace(/\D/g, "") === CPF.replace(/\D/g, ""));
}
b.ok(!!emitidaDepois && String(emitidaDepois[3]).toUpperCase() !== "ATIVA",
  "a carteirinha do desfiliado deixa de ser ATIVA",
  emitidaDepois ? "status " + emitidaDepois[3] : "sem emissão");

b.passo("14. Carteirinha para quem não é mais filiado");
abaCart.appendRow([CPF, ficha.nome, "https://drive/foto2.jpg", "Pendente", new Date(), "", "", "PORTAL", ""]);
let cartDesf; try { cartDesf = g.aprovarEEmitirCarteirinha(CPF, "28/02/2027", SIN); }
catch (e) { cartDesf = { sucesso: false, mensagem: e.message }; }
b.ok(recusou(cartDesf), "desfiliado não consegue emitir carteirinha nova",
  cartDesf && cartDesf.mensagem);

/* ══════════ 4. PERMISSÃO ══════════ */
b.fluxo("SINDICALIZAÇÃO · Permissão");

b.passo("12. Rogério (Financeiro/RH) mexendo em ficha de associado");
b.bloqueia(() => g.listarFichasSindicalizacao({}, FIN), "listarFichasSindicalizacao nega quem não tem o módulo");
b.bloqueia(() => g.aprovarFichaSindicalizacao(IDF, "Rogério", FIN), "aprovarFichaSindicalizacao nega");
b.bloqueia(() => g.aprovarEEmitirCarteirinha(CPF, "2027-12-31", FIN), "aprovarEEmitirCarteirinha nega");

b.passo("13. Sem sessão");
b.bloqueia(() => g.listarFichasSindicalizacao({}, ""), "listarFichasSindicalizacao nega token vazio");

b.naoTestavel("PDF da ficha e da carteirinha", "template do Google Docs");
b.naoTestavel("Entrega do código OTP por SMS", "depende de gateway externo");

b.resumo();
process.exit(0);
