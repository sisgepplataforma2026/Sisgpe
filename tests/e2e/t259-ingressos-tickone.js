/**
 * INGRESSOS DA FESTA (TickOne) — CompassoIngressosDados.gs + CompassoIngressos.html (14/11/2026).
 * Usuário: "se a pessoa está na base do ingresso, se já foi feito"; "quando for solicitar,
 * sempre pesquisar antes"; categorias Associado / Acompanhante Associado / Convite / Cortesia /
 * Pago; sem limite de vagas; envio individual no WhatsApp; tela também no celular.
 * Backend real, tela real (jsdom); a BASE DO TICKONE e a pasta de PDFs são FALSAS (sem rede),
 * dados FICTÍCIOS. NÃO PROVA: o robô ler o TickOne de verdade, o WhatsApp receber a mensagem,
 * nem a emissão (não está ligada).
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
let SEM_MODULO = null; try { SEM_MODULO = b.logar(g, "rogerio"); } catch (e) {}

const agora = new Date().toISOString();
function base(lidoEm) {
  return { lidoEm: lidoEm || agora, evento: "No Compasso da Vida", total: 3, linhas: [
    { nome: "Maria Exemplo da Silva", cpf: "52998224725", tel: "(27) 99999-0001", codigo: "AAAA-0001", tipo: "Associado", escola: "Escola Modelo", cidade: "Vitória", ref: "REF1", zap: 1 },
    { nome: "João Teste Souza", cpf: "11144477735", tel: "99999-0002", codigo: "AAAA-0002", tipo: "Associado", escola: "Colégio Fictício", cidade: "Serra", ref: "REF2", zap: 0 },
    { nome: "Ana Demonstração", cpf: "39053344705", tel: "(27) 98888-0003", codigo: "AAAA-0003", tipo: "Acompanhante Associado", escola: "Escola Modelo", cidade: "Vila Velha", ref: "REF3", zap: 0 }] };
}
let BASE = base();
g.cingLerBase_ = () => { const d = JSON.parse(JSON.stringify(BASE)); d.linhas = d.linhas.map(l => ({ ...l, cpf: String(l.cpf).replace(/\D/g, "") })); return d; };
g.cingPdfs_ = () => ({ "maria exemplo da silva": "https://drive.example/maria.pdf" });
g.compasso_dadosDaFesta_ = () => ({ data: "2026-12-19", horaInicio: "20h", local: "Patrick Ribeiro", endereco: "Aeroporto de Vitória" });
g.compasso_dataPorExtenso_ = () => "sábado, 19 de dezembro de 2026";

b.fluxo("INGRESSOS · regras de dados");
b.passo("1. CPF, telefone e categoria");
b.ok(g.cingCpfValido_("529.982.247-25") && !g.cingCpfValido_("111.111.111-11") && !g.cingCpfValido_("123"), "CPF com dígito verificador");
b.ok(g.cingFone_("(27) 99999-0001") === "5527999990001" && g.cingFone_("5527999990001") === "5527999990001" && g.cingFone_("99999-0002") === "" && g.cingFone_("(27) 3333-4444") === "552733334444", "telefone: põe o 55, recusa sem DDD");
b.ok(g.cingCategoria_("Acompanhante Associado") === "acompanhante" && g.cingCategoria_("Acompanhante de Associado") === "acompanhante" && g.cingCategoria_("Convite") === "convite" && g.cingCategoria_("xyz") === "", "as 5 categorias do TickOne");
b.ok(g.CING_CATEGORIAS.length === 5, "cinco categorias");

b.fluxo("INGRESSOS · enviar (base do TickOne)");
b.passo("2. Estado e lista");
const est = g.compassoIngressos_estado(TOKEN);
b.ok(est.ok && est.existe && est.total === 3 && est.porTipo.associado === 2 && est.porTipo.acompanhante === 1 && est.enviados === 0, "estado: 3 ingressos, 2 Associado, 1 Acompanhante", JSON.stringify(est.porTipo));
const li = g.compassoIngressos_lista(TOKEN);
b.ok(li.ok && li.linhas.length === 3 && li.linhas[0].cpf === "529.***.***-25" && !JSON.stringify(li).includes("52998224725"), "CPF sempre mascarado na lista");
b.ok(li.linhas[0].pdfDrive === "https://drive.example/maria.pdf" && li.linhas[1].foneOk === false && li.linhas[1].urlIngresso.indexOf("ref=REF2") > 0, "PDF do Drive quando existe; sem DDD marca 'conferir telefone'; link do ingresso no TickOne");
b.passo("3. Mensagem do WhatsApp (não envia nada)");
const ms = g.compassoIngressos_mensagem("AAAA-0001", TOKEN);
b.ok(ms.ok && /^https:\/\/wa\.me\/5527999990001\?text=/.test(ms.url) && /AAAA-0001/.test(ms.texto) && /Ol%C3%A1/.test(ms.url), "link do WhatsApp com a mensagem e o código");
b.ok(g.compassoIngressos_mensagem("AAAA-0002", TOKEN).ok === false, "telefone sem DDD: não monta o link");
b.passo("4. Só vira 'enviado' depois da confirmação");
b.ok(g.compassoIngressos_estado(TOKEN).enviados === 0, "pedir a mensagem não marca enviado");
const rg = g.compassoIngressos_registrarEnvio("AAAA-0001", TOKEN);
b.ok(rg.ok && rg.enviado.vezes === 1 && g.compassoIngressos_estado(TOKEN).enviados === 1, "registrado, com quando e quem");
b.ok(g.compassoIngressos_lista(TOKEN).linhas[0].enviado.quem !== "", "a lista mostra quem enviou");
b.ok(g.compassoIngressos_registrarEnvio("NAO-EXISTE", TOKEN).ok === false, "código inexistente é recusado");

b.fluxo("INGRESSOS · pesquisar antes de pedir");
b.passo("5. Conferência da lista");
const lista = [
  { nome: "Maria Exemplo da Silva", cpf: "529.982.247-25", telefone: "", categoria: "Associado" },
  { nome: "Pedro Novo Fictício", cpf: "529.982.247-25", telefone: "(27) 97777-0004", categoria: "Convite" },
  { nome: "Carla Nova Exemplo", cpf: "168.995.350-09", telefone: "(27) 97777-0005", categoria: "Convidado" },
  { nome: "Carla Nova Exemplo", cpf: "168.995.350-09", telefone: "(27) 97777-0005", categoria: "Convite" },
  { nome: "João Teste Souza", cpf: "000.000.000-00", telefone: "(27) 97777-0006", categoria: "Associado" },
  { nome: "Sem Telefone Ltda", cpf: "453.178.287-91", telefone: "99999", categoria: "Associado" },
  { nome: "Cat Errada", cpf: "111.222.333-96", telefone: "(27) 97777-0007", categoria: "VIP" }
];
const cf = g.compassoIngressos_conferir(lista, TOKEN);
const R = cf.resultados;
b.ok(cf.ok && R[0].situacao === "ja_tem" && R[0].codigo === "AAAA-0001", "já tem ingresso (pelo CPF): mostra o código, não pede de novo");
b.ok(R[0].telefone === "5527999990001" && R[0].telefoneOrigem === "telefone da base do ingresso", "telefone que faltava veio da base, com a origem");
b.ok(R[1].situacao === "ja_tem" && R[1].codigo === "AAAA-0001", "mesmo CPF com outro nome também é 'já tem'");
b.ok(R[2].situacao === "novo" && R[2].categoria === "convite", "novo; 'Convidado' vira Convite");
b.ok(R[3].situacao === "conferir" && R[3].motivos.some(m => /repetido/.test(m)), "CPF repetido na lista");
b.ok(R[4].situacao === "conferir" && R[4].motivos.some(m => /CPF válido/.test(m)) && R[4].motivos.some(m => /nome/i.test(m) && /AAAA-0002/.test(m)), "CPF inválido + nome já existe na base (código)");
b.ok(R[5].situacao === "conferir" && R[5].motivos.some(m => /telefone/i.test(m)), "telefone inválido");
b.ok(R[6].situacao === "conferir" && R[6].motivos.some(m => /Categoria/.test(m)), "categoria inválida");
b.ok(cf.contagem.ja_tem === 2 && cf.contagem.novo === 1 && cf.contagem.conferir === 4, "contagem", JSON.stringify(cf.contagem));
b.passo("5b. Campos obrigatórios por categoria");
const rc = g.compassoIngressos_conferir([
  { nome: "Acomp Só Nome e CPF", cpf: "168.995.350-09", categoria: "Acompanhante Associado" },
  { nome: "Convidado Só Nome e CPF", cpf: "453.178.287-91", categoria: "Convite" },
  { nome: "Associado Incompleto", cpf: "111.222.333-96", telefone: "(27) 97777-0010", categoria: "Associado" },
  { nome: "Associado Completo", cpf: "390.533.447-05", telefone: "(27) 97777-0011", email: "a@exemplo.com", escola: "Escola Y", cidade: "Serra", categoria: "Associado" }
], TOKEN).resultados;
b.ok(rc[0].situacao === "novo" && rc[0].motivos.length === 0 && rc[0].avisos.length === 1, "Acompanhante com só nome e CPF: libera (telefone em branco vira aviso)");
b.ok(rc[1].situacao === "novo" && rc[1].motivos.length === 0, "Convite com só nome e CPF: libera");
b.ok(rc[2].situacao === "conferir" && rc[2].motivos.some(m => /escola/.test(m)) && rc[2].motivos.some(m => /cidade/.test(m)) && rc[2].motivos.some(m => /e-mail/.test(m)), "Associado: falta escola, cidade e e-mail → trava");
b.ok(rc[2].motivos.length === 1 && /^Associado Associado Incompleto: está faltando .*nome da escola.*cidade/.test(rc[2].motivos[0]) && /e-mail/.test(rc[2].motivos[0]) && !/telefone/.test(rc[2].motivos[0]), "diz QUEM é e O QUE falta, numa frase só", rc[2].motivos[0]);
const rf = g.compassoIngressos_conferir([{ nome: "Fulana Sem Nada", cpf: "168.995.350-09", categoria: "Associado" }], TOKEN);
b.ok(rf.faltasAssociado.length === 1 && /Associado Fulana Sem Nada: está faltando telefone com DDD, e-mail, nome da escola, cidade\./.test(rf.faltasAssociado[0]), "resumo das faltas por associado", rf.faltasAssociado[0]);
b.ok(g.compassoIngressos_conferir([{ nome: "Ja Tem Maria", cpf: "529.982.247-25", categoria: "Associado" }], TOKEN).resultados[0].faltando === undefined, "quem já tem ingresso não é cobrado por campo faltando");
b.ok(rc[3].situacao === "ja_tem" || (rc[3].situacao === "novo" && rc[3].motivos.length === 0), "Associado com todos os campos: libera (ou já tem)", rc[3].situacao);
b.passo("6. Base velha avisa");
b.ok(cf.emissaoLiberada === false && /Corrija as linhas/.test(cf.emissaoMotivo), "com linhas em 'Conferir', a emissão NÃO é liberada");
BASE = base(new Date(Date.now() - 40 * 60000).toISOString());
const cfVelho = g.compassoIngressos_conferir(lista.slice(0, 1), TOKEN);
b.ok(cfVelho.baseRecente === false && /mais de 15 minutos/.test(cfVelho.emissaoMotivo), "base com 40 min: pede para ler de novo antes de pedir");
BASE = base();
const sb = g.cingLerBase_; g.cingLerBase_ = () => null;
b.ok(g.compassoIngressos_conferir(lista, TOKEN).ok === false && g.compassoIngressos_estado(TOKEN).existe === false, "sem base lida: não confere e diz por quê");
g.cingLerBase_ = sb;
if (SEM_MODULO) b.ok(g.compassoIngressos_lista("token-invalido").ok === false, "sem sessão válida não lê a lista");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["CompassoIngressos.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
const abertos = []; win.open = u => { abertos.push(u); return null; };
(async function () {
  b.fluxo("INGRESSOS · tela (computador e celular, mesma página)");
  win.cingCarregar(); await t.assentar(300);
  b.passo("7. Quadro e lista");
  b.ok(el("ciTotal").textContent === "3" && el("ciEnv").textContent === "1" && el("ciFalta").textContent === "2", "contadores");
  b.ok(doc.querySelectorAll("#ciLista .ci-linha").length === 3 && /529\.\*\*\*\.\*\*\*-25/.test(el("ciLista").textContent), "3 linhas, CPF mascarado");
  b.ok(/📎 PDF/.test(el("ciLista").textContent) && /🎟️ Ingresso/.test(el("ciLista").textContent), "PDF do Drive quando há; senão o botão 🎟️ Ingresso (TickOne)");
  b.ok(doc.querySelector("style").textContent.indexOf("@media(max-width:760px)") > 0, "tem o ajuste de celular (cartões)");
  b.passo("8. Filtros e busca");
  t.clicar("[data-ci='chip'][data-arg='fone']"); await t.assentar(20);
  b.ok(doc.querySelectorAll("#ciLista .ci-linha").length === 1 && /João/.test(el("ciLista").textContent), "só os de telefone para conferir");
  t.clicar("[data-ci='chip'][data-arg='falta_dados']"); await t.assentar(20);
  b.ok(doc.querySelectorAll("#ciLista .ci-linha").length === 1 && /Associado: está faltando telefone com DDD/.test(el("ciLista").textContent), "filtro 'Faltam dados do associado' mostra quem e o que falta");
  t.clicar("[data-ci='chip'][data-arg='enviados']"); await t.assentar(20);
  b.ok(doc.querySelectorAll("#ciLista .ci-linha").length === 1 && /Maria/.test(el("ciLista").textContent), "só os enviados");
  t.clicar("[data-ci='chip'][data-arg='todos']"); el("ciBusca").value = "ana demo"; el("ciBusca").dispatchEvent(new win.Event("input", { bubbles: true })); await t.assentar(20);
  b.ok(doc.querySelectorAll("#ciLista .ci-linha").length === 1 && /Ana/.test(el("ciLista").textContent), "busca por nome");
  el("ciBusca").value = ""; el("ciBusca").dispatchEvent(new win.Event("input", { bubbles: true })); await t.assentar(20);
  b.passo("9. WhatsApp: abre, e só confirma com o clique da pessoa");
  const antes = g.compassoIngressos_estado(TOKEN).enviados;
  t.clicar("[data-ci='zap'][data-arg='AAAA-0003']"); await t.assentar(300);
  b.ok(abertos.length === 1 && /^https:\/\/wa\.me\/5527988880003\?text=/.test(abertos[0]), "abriu o WhatsApp certo com a mensagem");
  b.ok(g.compassoIngressos_estado(TOKEN).enviados === antes && !!doc.querySelector("[data-ci='confirmar'][data-arg='AAAA-0003']"), "ainda NÃO marcou enviado; apareceu 'Confirmar envio'");
  t.clicar("[data-ci='confirmar'][data-arg='AAAA-0003']"); await t.assentar(300);
  b.ok(g.compassoIngressos_estado(TOKEN).enviados === antes + 1 && /Enviado/.test(el("ciLista").textContent), "confirmou: registrado e a linha mostra 'Enviado'");
  b.ok(doc.querySelector("[data-ci='zap'][data-arg='AAAA-0002']").disabled === true, "telefone sem DDD: botão do WhatsApp travado");
  b.passo("10. Pedir ingresso: cartões de pessoa (como o '+ Adicionar' do Ofício), planilha, conferência");
  const preencher = (i, o) => { const card = doc.querySelectorAll("#ciPessoas .ci-pessoa")[i]; Object.keys(o).forEach(k => { const f = card.querySelector("[data-k=" + k + "]"); f.value = o[k]; f.dispatchEvent(new win.Event(f.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }); };
  t.clicar("[data-ci='aba'][data-arg='solicitar']");
  b.ok(el("ciBoxPlan").hidden === true && !!doc.querySelector("[data-ci='togPlan']"), "a planilha fica escondida atrás do botão 'Subir planilha'; o cartão da pessoa é a entrada principal");
  b.ok(doc.querySelectorAll("#ciPessoas .ci-pessoa").length === 1, "começa com 1 cartão de pessoa");
  t.clicar("[data-ci='addPessoa']"); t.clicar("[data-ci='addPessoa']"); await t.assentar(20);
  b.ok(doc.querySelectorAll("#ciPessoas .ci-pessoa").length === 3, "'+ Adicionar pessoa' acrescenta cartões em sequência, sem abrir nem fechar nada");
  t.clicar("[data-ci='addApos'][data-arg='0']"); await t.assentar(20);
  b.ok(doc.querySelectorAll("#ciPessoas .ci-pessoa").length === 4, "o '+' de cada cartão insere outra pessoa logo depois dele");
  t.clicar("[data-ci='delPessoa'][data-arg='3']"); t.clicar("[data-ci='delPessoa'][data-arg='2']"); t.clicar("[data-ci='delPessoa'][data-arg='1']"); await t.assentar(20);
  b.ok(doc.querySelectorAll("#ciPessoas .ci-pessoa").length === 1, "o × tira o cartão");
  t.clicar("[data-ci='togPlan']"); b.ok(el("ciBoxPlan").hidden === false, "o botão abre a planilha");
  preencher(0, { nome: "Pedro Individual", cpf: "453.178.287-91", telefone: "(27) 97777-0009", categoria: "acompanhante" });
  el("ciPlan").value = "Nome;Email;CPF;Telefone;Cidade;Escola;Tipo\nMaria Exemplo da Silva;;529.982.247-25;;Vitória;Escola Modelo;Associado\nCarla Nova Exemplo;;168.995.350-09;(27) 97777-0005;Serra;Escola X;Convite";
  t.clicar("[data-ci='lerPlan']"); await t.assentar(20);
  b.ok(/3 pessoas na lista/.test(el("ciQtd").textContent) && doc.querySelectorAll("#ciPessoas .ci-pessoa").length === 3, "cartão individual (1) + planilha (2) = 3 na lista", el("ciQtd").textContent);
  t.clicar("[data-ci='addPessoa']"); await t.assentar(20);
  b.ok(/3 pessoas na lista/.test(el("ciQtd").textContent), "um cartão em branco não conta como pessoa");
  t.clicar("[data-ci='conferir']"); await t.assentar(400);
  const cartoes = [...doc.querySelectorAll("#ciPessoas .ci-pessoa")];
  b.ok(/Já tem ingresso · AAAA-0001/.test(cartoes[1].textContent) && /Nova pessoa/.test(cartoes[0].textContent) && /Nova pessoa/.test(cartoes[2].textContent), "o resultado aparece DENTRO de cada cartão: 'já tem' com o código e as novas");
  b.ok(!!cartoes[1].querySelector("[data-ci='zap']") && (!!cartoes[1].querySelector("a[href*='drive.example']") || !!cartoes[1].querySelector("a[href*='ref=REF1']")), "quem já tem ingresso ganha 📱 Enviar no WhatsApp e o PDF/ingresso (antes faltavam)");
  b.ok(/Pedir emissão dos 2 novos/.test(el("ciRes").textContent), "sem pendência e com a base recente, aparece 'Pedir emissão dos 2 novos' (o pedido em si é testado no t261)");
  b.ok(el("ciPasso2").classList.contains("on") && !el("ciPasso3").classList.contains("on"), "o indicador de passos foi para o 2 (Conferência)");
  b.resumo();
})();
