/**
 * TESTE — O MENU DA COLUNA SITUAÇÃO DECIDE, EM VEZ DE SÓ ABRIR A GAVETA
 *
 * O QUE ORIGINOU, 14/09/2026. O usuário olhou a fila e viu a inscrição da
 * Marcelha oferecendo um único botão, "Reprovar", e um link "analisar
 * manualmente". Para ACEITAR alguém — o caminho comum da fila — era preciso
 * abrir a gaveta, achar a seção de análise, escolher num seletor e confirmar.
 *
 * O menu de situação já existia desde 01/09 e já mudava conforme o estado.
 * O que faltava era justamente o estado mais frequente: "A analisar" oferecia
 * só "Analisar agora", que era uma porta para a gaveta — o menu prometia
 * decidir e devolvia um desvio.
 *
 * A REGRA QUE ESTE TESTE GUARDA: o menu resolve o caminho comum em um clique,
 * e manda para a gaveta SÓ o que precisa de escolha — pendência e reprovação
 * exigem motivo de uma lista fechada, e escolher motivo pela pessoa seria
 * impor, não automatizar.
 *
 * E guarda a segunda metade, que é onde mora o defeito caro: validar e emitir
 * são DUAS chamadas ao servidor. Se a segunda falhar, a inscrição já está
 * validada — e a mensagem tem de dizer isso, senão a pessoa valida de novo e
 * acha que o sistema não obedece.
 *
 * O QUE NÃO ALCANÇA: se o menu aparece na tela, se abre para cima quando não
 * cabe embaixo, e se o texto cabe no cartão. Aqui não há CSS nem layout — o
 * que se prova é QUAL ação é oferecida em cada estado e O QUE ela manda ao
 * servidor.
 */
const fs = require("fs");
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");
const RAIZ = require("./load").RAIZ;

const html = fs.readFileSync(RAIZ + "/CompassoInscricoes.html", "utf8");

function elemento(id) {
  const classes = new Set();
  return {
    id, innerHTML: "", textContent: "", value: "", hidden: false, style: {},
    classList: { add: c => classes.add(c), remove: c => classes.delete(c),
                 contains: c => classes.has(c),
                 toggle: (c, on) => on ? classes.add(c) : classes.delete(c) },
    addEventListener() {}, querySelectorAll: () => []
  };
}

/** Um botão de linha, com a medida que o posicionador do menu consulta. */
const botaoFalso = () => ({
  getBoundingClientRect: () => ({ top: 200, bottom: 230, left: 400 })
});

function montarTela() {
  const els = {};
  const chamadas = [];      /* o que foi mandado ao servidor */
  const perguntas = [];     /* o que foi perguntado antes de mandar */
  let pendente = null;      /* o callback de sucesso da última chamada */

  const sandbox = {
    document: { getElementById: id => (els[id] = els[id] || elemento(id)),
                addEventListener() {},
                createElement: tag => Object.assign(elemento("novo"), { tag, click(){} }),
                body: { appendChild() {}, removeChild() {} } },
    window: { addEventListener() {}, innerHeight: 900, innerWidth: 1440 },
    location: { search: "" },
    /* O proxy GUARDA o callback de sucesso. Sem isso dá para provar o que a
       tela manda, nunca o que ela faz com a resposta — e a segunda metade
       desta tela só existe na resposta. */
    google: { script: { run: new Proxy({}, { get: (_, n) => {
      if (n === "withSuccessHandler") return cb => { pendente = cb; return sandbox.google.script.run; };
      if (n === "withFailureHandler") return () => sandbox.google.script.run;
      return (...args) => { chamadas.push({ fn: n, args }); };
    } }) } },
    /* O diálogo do sistema mora no DialogoSISGEP, que aqui não é incluído.
       Registra o que seria perguntado e confirma — o texto do aviso é parte
       do que este teste cobra. */
    perguntar: (opcoes, aoConfirmar) => { perguntas.push(opcoes); aoConfirmar(); },
    alert() {}, confirm: () => true, prompt: () => "motivo",
    setTimeout: fn => fn(), console
  };

  const corpo = (html.match(/<script>([\s\S]*)<\/script>/) || [])[1];
  const nomes = Object.keys(sandbox);
  const expor = `; return {
    set LISTA(v){LISTA=v}, get LISTA(){return LISTA},
    abrirMenuStatus, menuAcao, situacaoDe, abrirGaveta
  };`;
  const tela = new Function(...nomes, corpo + expor)(...nomes.map(n => sandbox[n]));
  return { tela, els, chamadas, perguntas,
           responder: r => { const cb = pendente; pendente = null; if (cb) cb(r); } };
}

const pessoa = extra => Object.assign({
  inscricaoId: "INS-1", nome: "MARIA DA SILVA", cpf: "12345678909",
  escola: "EMEF X", cidade: "Vitória", email: "maria@exemplo.com",
  whatsapp: "27999990000", categoria: "associado", status: "",
  situacaoAssociado: "ASSOCIADO", ingressoId: "", numeroIngresso: "",
  entrega: { canais: [] }, pagamento: {}, criadoEm: new Date().toISOString()
}, extra || {});

/** Abre o menu da primeira linha e devolve o HTML dele. */
function menuDe(registro) {
  const t = montarTela();
  t.tela.LISTA = [registro];
  t.tela.abrirMenuStatus(0, botaoFalso(), null);
  return { html: t.els.stMenu.innerHTML, t };
}

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A analisar — o estado mais frequente decide no próprio menu");

const mA = menuDe(pessoa()).html;

passo("o caminho comum virou um clique");
ok(/Validar e emitir ingresso/.test(mA),
   "o menu oferece validar e emitir direto",
   "era o que custava abrir a gaveta, achar a seção e escolher num seletor");
ok(!/Analisar agora/.test(mA),
   "e não oferece mais 'Analisar agora'",
   "prometer decidir e devolver um desvio para outra tela é pior que não prometer");

passo("pendência e reprovação continuam pedindo motivo");
ok(/Marcar pendência…/.test(mA), "pendência está no menu, com reticências");
ok(/Reprovar…/.test(mA), "reprovar também");
ok(/menuAcao\('pendencia'\)/.test(mA) && /menuAcao\('reprovar'\)/.test(mA),
   "as duas têm ação própria — não caem no mesmo 'analisar' genérico");

/* As reticências não são enfeite: elas são a diferença entre um botão que
   executa e um que abre pergunta. Sem isso, quem clica em "Reprovar"
   esperando resolver leva um formulário na cara. */
ok(/Validar e emitir ingresso<\/button>/.test(mA),
   "e validar NÃO tem reticências — essa resolve na hora");

passo("o cabeçalho do menu diz a situação antes de qualquer ação");
ok(/A analisar/.test(mA), "o rótulo do estado");
ok(/esperando h|entrou agora/.test(mA),
   "e há quanto tempo espera — é o que ordena a fila na cabeça de quem olha");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Validada sem ingresso — falta emitir, e é só isso");

const mV = menuDe(pessoa({ status: "VALIDADA_ADMINISTRATIVAMENTE" })).html;
ok(/Emitir ingresso/.test(mV), "oferece emitir");
ok(!/Validar e emitir/.test(mV), "e não repete o validar de quem já foi validada");
ok(!/Reemitir/.test(mV), "nem reemitir — não há o que reemitir ainda");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Com ingresso — entregar vem primeiro, e reemitir passa a existir");

const mI = menuDe(pessoa({ status: "VALIDADA_ADMINISTRATIVAMENTE",
                           ingressoId: "ING-1", numeroIngresso: "FCV-2026-000428" })).html;
ok(/Enviar pelo WhatsApp/.test(mI), "WhatsApp está no menu");
ok(mI.indexOf("Enviar pelo WhatsApp") < mI.indexOf("Enviar por e-mail"),
   "e vem ANTES do e-mail — a entrega é pelo zap, decisão dele em 09/09");
ok(/Reemitir ingresso/.test(mI),
   "reemitir passa a aparecer — existia no backend e faltava no menu");
ok(/Cancelar ingresso/.test(mI), "e cancelar, que devolve a vaga");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Validar e emitir — as duas chamadas, e o que acontece se a segunda falhar");

passo("avisa o que vai acontecer ANTES de fazer");
let t = montarTela();
t.tela.LISTA = [pessoa()];
t.tela.abrirMenuStatus(0, botaoFalso(), null);
t.tela.menuAcao("validar");

igual(t.perguntas.length, 1, "pergunta antes");
ok(/2\.000 vagas/.test(t.perguntas[0].texto),
   "dizendo que consome uma das 2.000 vagas", t.perguntas[0].texto);
ok(/WhatsApp/.test(t.perguntas[0].texto),
   "e que a entrega é um segundo passo, pelo WhatsApp — emitir não é entregar");

passo("a primeira chamada valida");
igual(t.chamadas.length, 1, "uma chamada até aqui");
igual(t.chamadas[0].fn, "compasso_validarDecisaoAdmin", "é a decisão administrativa");
igual(t.chamadas[0].args[1], "VALIDADA_ADMINISTRATIVAMENTE", "com o status de validada");

passo("e só depois de ela voltar é que o ingresso é emitido");
t.responder({ ok: true });
igual(t.chamadas.length, 2, "agora são duas");
igual(t.chamadas[1].fn, "compasso_emitirIngressoV2", "a segunda emite");
igual(t.chamadas[1].args[0].inscricaoId, "INS-1", "para a inscrição certa");

passo("se a validação falhar, o ingresso NÃO é emitido");
t = montarTela();
t.tela.LISTA = [pessoa()];
t.tela.abrirMenuStatus(0, botaoFalso(), null);
t.tela.menuAcao("validar");
t.responder({ ok: false, erro: "Sessão inválida" });
igual(t.chamadas.length, 1, "parou na primeira");
ok(/não foi possível validar/i.test(t.els.msg.textContent),
   "e a tela diz por quê", t.els.msg.textContent);

passo("se a EMISSÃO falhar, a tela diz que a inscrição já foi validada");
t = montarTela();
t.tela.LISTA = [pessoa()];
t.tela.abrirMenuStatus(0, botaoFalso(), null);
t.tela.menuAcao("validar");
t.responder({ ok: true });            /* validou */
t.responder({ ok: false, erro: "Vagas esgotadas" });  /* não emitiu */

const msg = t.els.msg.textContent;
ok(/VALIDADA/.test(msg),
   "a mensagem avisa que a validação passou", msg);
ok(/Vagas esgotadas/.test(msg), "e diz o que impediu a emissão");
ok(/Emitir ingresso/.test(msg),
   "apontando o caminho para terminar — sem isso a pessoa valida de novo achando que nada aconteceu");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O menu aparecendo na tela",
  "não há CSS nem layout aqui. Se o cartão abre para cima quando não cabe " +
  "embaixo, e se o texto cabe na largura, só o navegador responde.");

resumo();
