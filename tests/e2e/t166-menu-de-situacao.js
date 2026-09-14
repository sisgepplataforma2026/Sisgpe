/**
 * TESTE — AS AÇÕES FICAM NA LINHA, UMA DO LADO DA OUTRA
 *
 * O QUE ORIGINOU, 14/09/2026. Ele mandou o print da tela de Despesas e disse
 * o que queria, sem deixar margem:
 *
 *   "Deveria ter um campo de ações. Quando o cara fez a inscrição, para eu
 *    emitir, eu reenviar, eu cancelar. Um do lado do outro. E não é o que
 *    está acontecendo."
 *
 * O QUE HAVIA. Em 26/08 a pílula de situação virou botão e concentrou as
 * ações num menu suspenso. A capacidade existia — escondida. A linha não
 * dizia o que era possível fazer com aquela pessoa; era preciso abrir o menu
 * para descobrir, uma pessoa de cada vez, numa fila de 2.000.
 *
 * Esta versão do arquivo trocou o menu pela COLUNA AÇÕES, no molde do
 * financeiro (`Scripts_Despesas.html:307`), com as mesmas classes.
 *
 * A REGRA QUE ESTE TESTE GUARDA, e que sobreviveu à troca de desenho:
 *
 *   1. quais ações existem em cada ESTADO — e quais NÃO existem, que é o que
 *      impede a linha de oferecer "Emitir" para quem já tem ingresso;
 *   2. que os botões e a pílula leem a MESMA `situacaoDe(x)`, e por isso não
 *      podem se contradizer;
 *   3. que validar e emitir são DUAS chamadas ao servidor, e que, se a
 *      segunda falhar, a mensagem diz que a primeira passou — senão a pessoa
 *      valida de novo e acha que o sistema não obedece.
 *
 * O QUE NÃO ALCANÇA: se os botões cabem na largura da coluna, se quebram bem
 * em duas linhas, e se os ícones aparecem. Aqui não há CSS nem layout — o que
 * se prova é QUAL botão nasce em cada estado e O QUE ele manda ao servidor.
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
    acoesDaLinha, acaoLinha, situacaoDe, linhaHtml, abrirGaveta
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

/** Os botões da coluna Ações para um registro. */
function acoesDe(registro) {
  const t = montarTela();
  t.tela.LISTA = [registro];
  return { html: t.tela.acoesDaLinha(registro, 0), t };
}

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A coluna existe na tabela, não num menu que precisa ser aberto");

passo("o cabeçalho tem a coluna");
ok(/<th>Ações<\/th>/.test(html), "a coluna Ações está no cabeçalho",
   "sem ela os botões não teriam onde morar");

passo("e a linha desenha os botões lado a lado");
ok(/acoes-cell/.test(html), "a célula usa .acoes-cell",
   "é a mesma classe do financeiro — o Design System manda reaproveitar");
ok(/\.acoes-cell\{[^}]*display:flex/.test(html),
   "que põe os botões em linha", "um do lado do outro, como ele pediu");

passo("o menu suspenso não existe mais");
ok(!/abrirMenuStatus|stMenu/.test(html),
   "nenhum resquício do menu antigo",
   "deixar os dois seria a mesma ação em dois lugares — o que ele reclamou");

passo("a linha vazia atravessa a coluna nova");
ok(/colspan="7"/.test(html), "colspan 7",
   "com 6 a mensagem 'nenhuma inscrição' pararia antes da última coluna");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A analisar — o estado mais frequente decide na própria linha");

const mA = acoesDe(pessoa()).html;

passo("o caminho comum é um clique");
ok(/Validar e emitir/.test(mA), "o botão valida e emite direto",
   "era o que custava abrir a gaveta, achar a seção e escolher num seletor");

passo("pendência e reprovação continuam pedindo motivo");
ok(/Pendência…/.test(mA), "pendência tem botão, com reticências");
ok(/Reprovar…/.test(mA), "reprovar também");
ok(/acaoLinha\(0,&quot;pendencia&quot;\)/.test(mA) &&
   /acaoLinha\(0,&quot;reprovar&quot;\)/.test(mA),
   "as duas têm ação própria — não caem num 'analisar' genérico");

/* As reticências não são enfeite: são a diferença entre um botão que executa
   e um que abre pergunta. Sem isso, quem clica em "Reprovar" esperando
   resolver leva um formulário na cara. */
ok(/✅ Validar e emitir<\/button>/.test(mA),
   "e validar NÃO tem reticências — essa resolve na hora");

passo("editar e excluir fecham a linha, em qualquer estado");
ok(/acaoLinha\(0,&quot;editar&quot;\)/.test(mA), "editar");
ok(/acaoLinha\(0,&quot;excluir&quot;\)/.test(mA), "excluir");

passo("e não oferece o que não faz sentido aqui");
ok(!/Emitir ingresso/.test(mA), "não oferece emitir para quem não foi validada");
ok(!/Cancelar/.test(mA), "nem cancelar um ingresso que não existe");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Validada sem ingresso — falta emitir, e é só isso");

const mV = acoesDe(pessoa({ status: "VALIDADA_ADMINISTRATIVAMENTE" })).html;
ok(/Emitir ingresso/.test(mV), "oferece emitir");
ok(!/Validar e emitir/.test(mV), "e não repete o validar de quem já foi validada");
ok(!/Reemitir/.test(mV), "nem reemitir — não há o que reemitir ainda");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Com ingresso — entregar vem primeiro, e reemitir passa a existir");

const mI = acoesDe(pessoa({ status: "VALIDADA_ADMINISTRATIVAMENTE",
                            ingressoId: "ING-1",
                            numeroIngresso: "FCV-2026-000428" })).html;
ok(/WhatsApp/.test(mI), "WhatsApp está na linha");
ok(mI.indexOf("WhatsApp") < mI.indexOf("E-mail"),
   "e vem ANTES do e-mail — a entrega é pelo zap, decisão dele em 09/09");
ok(/Reemitir/.test(mI), "reemitir aparece — existia no backend e faltava na tela");
ok(/Cancelar/.test(mI), "e cancelar, que devolve a vaga");
ok(!/Validar e emitir/.test(mI), "e some o validar — a decisão já foi tomada");

passo("depois de entregue, o botão passa a dizer Reenviar");
const mE = acoesDe(pessoa({ status: "VALIDADA_ADMINISTRATIVAMENTE",
                            ingressoId: "ING-1", numeroIngresso: "FCV-2026-000428",
                            entrega: { canais: ["WHATSAPP"] } })).html;
ok(/Reenviar/.test(mE), "diz Reenviar",
   "mandar 'Enviar' de novo faria a secretaria achar que a primeira não foi");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A pílula e os botões leem o MESMO estado");

/* Se fossem duas leituras separadas, a linha poderia dizer "Enviado" e
   oferecer "Emitir" no botão ao lado. */
const comIngresso = pessoa({ status: "VALIDADA_ADMINISTRATIVAMENTE",
                             ingressoId: "ING-1", numeroIngresso: "FCV-2026-000428" });
const t0 = montarTela();
t0.tela.LISTA = [comIngresso];
const linha = t0.tela.linhaHtml(comIngresso, 0);
igual(t0.tela.situacaoDe(comIngresso).rotulo, "Ingresso a enviar",
      "a situação lida uma vez");
ok(linha.indexOf("Ingresso a enviar") > -1, "  aparece na pílula");
ok(linha.indexOf("Reemitir") > -1, "  e os botões são os desse estado");
ok(linha.indexOf("Emitir ingresso") < 0,
   "  sem oferecer emitir para quem já emitiu");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Validar e emitir — as duas chamadas, e o que acontece se a segunda falhar");

passo("avisa o que vai acontecer ANTES de fazer");
let t = montarTela();
t.tela.LISTA = [pessoa()];
t.tela.acaoLinha(0, "validar");

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
t.tela.acaoLinha(0, "validar");
t.responder({ ok: false, erro: "Sessão inválida" });
igual(t.chamadas.length, 1, "parou na primeira");
ok(/não foi possível validar/i.test(t.els.msg.textContent),
   "e a tela diz por quê", t.els.msg.textContent);

passo("se a EMISSÃO falhar, a tela diz que a inscrição já foi validada");
t = montarTela();
t.tela.LISTA = [pessoa()];
t.tela.acaoLinha(0, "validar");
t.responder({ ok: true });                            /* validou */
t.responder({ ok: false, erro: "Vagas esgotadas" });  /* não emitiu */

const msg = t.els.msg.textContent;
ok(/VALIDADA/.test(msg), "a mensagem avisa que a validação passou", msg);
ok(/Vagas esgotadas/.test(msg), "e diz o que impediu a emissão");
ok(/Emitir ingresso/.test(msg),
   "apontando o caminho para terminar — sem isso a pessoa valida de novo achando que nada aconteceu");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("Os botões cabendo na coluna",
  "não há CSS nem layout aqui. Se os seis botões da linha com ingresso cabem " +
  "na largura, se quebram bem em duas fileiras e se os ícones aparecem, só o " +
  "navegador responde.");

resumo();
