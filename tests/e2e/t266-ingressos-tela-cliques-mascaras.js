/**
 * INGRESSOS · TELA: máscaras, clique repetido e disparo do robô (14/11/2026).
 * Usuário: "se eu clicar uma, duas, três vezes, ele dá a entender que está gerando três vezes";
 * "máscara no CPF, e-mail e telefone"; "dar mensagem aguardando o robô, ágil".
 * Tela REAL (jsdom) + backend real; base do TickOne, pasta do robô e GitHub FALSOS; dados FICTÍCIOS.
 * NÃO PROVA: aparência/CSS (jsdom não desenha), nem o teclado do celular de verdade.
 */
const dom = require("./dom");
const b = require("./base");
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

/* pasta do robô falsa: a fila de emissão já existe (o robô a cria) */
const arquivos = { "emissoes-fila.json": JSON.stringify({ itens: [] }) };
g.cingPastaRobo_ = () => ({
  getFilesByName: n => { const tem = n in arquivos; let usado = false; return { hasNext: () => tem && !usado, next: () => { usado = true; return { setContent: t => { arquivos[n] = t; }, getBlob: () => ({ getDataAsString: () => arquivos[n] }) }; } }; },
  createFile: (n, t) => { arquivos[n] = t; }
});
const disparos = []; g.UrlFetchApp = { fetch(url, o) { disparos.push(url); return { getResponseCode: () => 204, getContentText: () => "" }; } };
g.PropertiesService.getScriptProperties().setProperty("INGRESSOS_GH_TOKEN", "ghp_FICTICIA0123456789abcdefghijklmn");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["CompassoIngressos.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
const abertos = []; win.open = u => { const w = { closed: false, close() { this.closed = true; }, _h: "" }; Object.defineProperty(w, "location", { value: { set href(v) { abertos.push(v); } } }); if (u && u !== "about:blank") abertos.push(u); return w; };
const contar = nome => { const o = g[nome]; const c = { n: 0 }; g[nome] = function () { c.n++; return o.apply(this, arguments); }; return c; };
const digitar = (i, k, v) => { const f = doc.querySelectorAll("#ciPessoas .ci-pessoa")[i].querySelector("[data-k=" + k + "]"); f.value = v; f.dispatchEvent(new win.Event(f.tagName === "SELECT" ? "change" : "input", { bubbles: true })); return f; };

(async function () {
  win.cingCarregar(); await t.assentar(300);
  b.fluxo("TELA · máscaras");
  t.clicar("[data-ci='aba'][data-arg='solicitar']");
  let f = digitar(0, "cpf", "45317828791");
  b.ok(f.value === "453.178.287-91", "CPF digitado só com números vira 453.178.287-91", f.value);
  f = digitar(0, "telefone", "27977770009");
  b.ok(f.value === "(27) 97777-0009", "telefone vira (27) 97777-0009", f.value);
  f = digitar(0, "telefone", "5527977770009");
  b.ok(f.value === "(27) 97777-0009", "telefone colado com 55 na frente perde o 55", f.value);
  f = digitar(0, "email", " Maria@Exemplo.COM ");
  b.ok(f.value === "maria@exemplo.com", "e-mail em minúsculas e sem espaços", f.value);
  f = digitar(0, "cpf", "111.111.111-11");
  b.ok(/CPF inválido/.test(doc.querySelector("#ciPessoas .ci-pessoa").textContent), "CPF com dígito errado mostra a dica 'CPF inválido'");
  f = digitar(0, "email", "maria@");
  b.ok(/E-mail inválido/.test(doc.querySelector("#ciPessoas .ci-pessoa").textContent), "e-mail incompleto mostra a dica");
  f = digitar(0, "cpf", "453.178.287-91"); f = digitar(0, "email", "maria@exemplo.com");
  b.ok(!/inválido/.test(doc.querySelector("#ciPessoas .ci-pessoa").textContent), "corrigido, a dica some");

  b.fluxo("TELA · clicar várias vezes não repete");
  t.clicar("[data-ci='limpar']"); await t.assentar(20);
  t.clicar("[data-ci='aba'][data-arg='enviar']"); await t.assentar(20);
  const cMsg = contar("compassoIngressos_mensagem"), cReg = contar("compassoIngressos_registrarEnvio");
  for (let i = 0; i < 3; i++) t.clicar("[data-ci='zap'][data-arg='AAAA-0003']");
  await t.assentar(300);
  b.ok(cMsg.n === 1 && abertos.length === 1, "3 cliques no WhatsApp: pede a mensagem 1 vez e abre 1 conversa", "chamadas " + cMsg.n + ", abas " + abertos.length);
  for (let i = 0; i < 3; i++) t.clicar("[data-ci='confirmar'][data-arg='AAAA-0003']");
  await t.assentar(300);
  b.ok(cReg.n === 1 && g.compassoIngressos_estado(TOKEN).enviados === 1, "3 cliques em Confirmar envio: registra 1 envio", "chamadas " + cReg.n);
  b.ok(g.compassoIngressos_registrarEnvio("AAAA-0003", TOKEN).repetido === true && g.compassoIngressos_estado(TOKEN).enviados === 1, "e se chegar de novo em 30 s, o servidor também não duplica");

  b.passo("navegador que BLOQUEIA a janela (celular/Safari): aparece 'Abrir WhatsApp'");
  const abrirOk = win.open; win.open = () => null;
  t.clicar("[data-ci='zap'][data-arg='AAAA-0001']"); await t.assentar(300);
  const lk = doc.querySelector("a[data-ci='abriuLink'][data-arg='AAAA-0001']");
  b.ok(!!lk && /^https:\/\/wa\.me\/5527999990001\?text=/.test(lk.getAttribute("href")) && lk.getAttribute("target") === "_blank", "bloqueado: surge o link 'Abrir WhatsApp' (âncora comum, abre no toque seguinte) com a mensagem pronta");
  b.ok(!!doc.querySelector("[data-ci='confirmar'][data-arg='AAAA-0001']"), "e o 'Confirmar envio' continua ao lado");
  win.open = abrirOk;

  b.passo("pedir emissão, 3 cliques");
  t.clicar("[data-ci='aba'][data-arg='solicitar']"); await t.assentar(20);
  digitar(0, "nome", "Pedro Individual"); digitar(0, "cpf", "453.178.287-91"); digitar(0, "telefone", "27977770009"); digitar(0, "categoria", "acompanhante");
  t.clicar("[data-ci='conferir']"); await t.assentar(400);
  t.clicar("[data-ci='emisAbrir']"); await t.assentar(50);
  const cEmis = contar("compassoIngressos_pedirEmissao"); el("ciEmisOk").checked = true;
  for (let i = 0; i < 3; i++) t.clicar("[data-ci='emisPedir']");
  await t.assentar(500);
  const fila = JSON.parse(arquivos["emissoes-fila.json"]);
  b.ok(cEmis.n === 1 && fila.itens.length === 1, "3 cliques em Pedir emissão: UM pedido na fila", "chamadas " + cEmis.n + ", fila " + fila.itens.length);
  b.ok(disparos.length === 1 && /ingressos-emitir\.yml\/dispatches/.test(disparos[0]), "o robô de emissão foi acionado UMA vez", disparos.join(","));
  b.ok(doc.querySelectorAll("#ciEmisBox .ci-linha, #ciEmisBox li, #ciEmisBox div").length > 0 && /Pedro/.test(el("ciEmisBox").textContent), "o pedido aparece na lista de emissões na hora, sem recarregar");

  b.fluxo("TELA · Atualizar base e chave do robô");
  const cAtu = contar("compassoIngressos_atualizarBase");
  for (let i = 0; i < 3; i++) t.clicar("[data-ci='atualizarBase']");
  await t.assentar(100);
  b.ok(cAtu.n === 1 && disparos.length === 2 && /ler-base/.test(disparos[1]), "3 cliques em Atualizar base: aciona a leitura 1 vez", "chamadas " + cAtu.n);
  b.ok(el("ciAtu").disabled === true && /Lendo/.test(el("ciAtu").textContent), "o botão fica 'Lendo o TickOne…' enquanto espera");
  t.clicar("[data-ci='robo']"); await t.assentar(100);
  b.ok(el("ciRobo").hidden === false && /Ligado/.test(el("ciRoboEst").textContent) && !/ghp_/.test(doc.body.innerHTML), "painel do robô mostra 'Ligado' e nunca a chave");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
