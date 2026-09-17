/**
 * INFRA PARA TESTAR TELA DE VERDADE — DOM real, backend real, cliques reais.
 *
 * POR QUE ISTO EXISTE
 *
 * Até 12/08/2026 toda tela deste projeto era entregue com o veredito "não
 * testado", porque o emulador do Apps Script (gas.js) cobre .gs e mais nada.
 * O usuário apontou duas vezes no mesmo dia — "tem que testar todas as
 * funções do início ao fim" — e estava certo nas duas: eu vinha provando o
 * backend e mandando a tela no escuro.
 *
 * Aqui o HTML é carregado num DOM de verdade (jsdom), os blocos de <script>
 * são executados, e o `google.script.run` é ligado NO BACKEND REAL carregado
 * pelo gas.js. Clicar num botão desta tela executa o mesmo caminho que ele
 * executa no navegador do sindicato, até a planilha em memória e de volta.
 *
 * O QUE ISTO AINDA NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 *   - aparência: cor, alinhamento, o que cabe na tela. jsdom não desenha.
 *   - CSS: nenhuma folha de estilo é aplicada, então `display:none` vindo de
 *     classe não existe aqui. Visibilidade só se testa no navegador.
 *   - o Apps Script de verdade: o template engine e a implantação continuam
 *     fora do alcance. O `include()` passou a ser resolvido aqui em
 *     26/08/2026 — ver `resolverIncludes` —, mas resolver o include não é
 *     rodar o Apps Script: scriptlet com lógica (`<? if … ?>`) continua fora.
 *
 * Ou seja: prova a LÓGICA da tela — o que ela pede ao servidor, o que faz
 * com a resposta, e o que acontece quando se clica. Não prova o desenho.
 */
const fs = require("fs");
const path = require("path");

/* A RAIZ SAI DO LOCAL DESTE ARQUIVO, NUNCA DE UM CAMINHO DE MÁQUINA.
   Aqui havia "/home/user/Sisgpe" cravado. Funcionava na minha máquina e
   estourava em qualquer outra: no runner do GitHub o repositório fica em
   /home/runner/work/Sisgpe/Sisgpe, e todo teste que sobe o emulador
   morria com ENOENT antes da primeira asserção. Foi o CI que achou, no
   primeiro deploy de homologação — 19/08/2026. */
const RAIZ = require("path").resolve(__dirname, "..", "..");

/* jsdom não é dependência do projeto — o repositório não tem node_modules
 * versionado. Quem quiser rodar instala uma vez. Sem ele, o teste se declara
 * NÃO TESTÁVEL em vez de falhar: falha diria que a tela está quebrada, o que
 * seria mentira. */
function jsdomDisponivel() {
  try { carregarJsdom(); return true; } catch (e) { return false; }
}
function carregarJsdom() {
  const candidatos = [
    "jsdom",
    path.join(RAIZ, "node_modules/jsdom"),
    "/tmp/claude-0/-home-user-Sisgpe/11c95821-41d5-5b17-825f-bd6e67629831/scratchpad/node_modules/jsdom"
  ];
  let ultimo = null;
  for (const c of candidatos) {
    try { return require(c); } catch (e) { ultimo = e; }
  }
  throw ultimo || new Error("jsdom não encontrado");
}

/* O `include()` PASSOU A SER RESOLVIDO AQUI — 26/08/2026.
 *
 * Este harness ignorava scriptlet: `<?!= include('X'); ?>` virava texto morto
 * e o arquivo X simplesmente não entrava na página. Enquanto cada tela era um
 * arquivo só, isso não aparecia. Apareceu quando o diálogo do sistema saiu de
 * dentro de CompassoInscricoes.html e virou componente incluído: o teste da
 * Central passou a estourar "perguntar is not defined" numa tela que, no
 * navegador, funciona — porque lá o template engine resolve o include antes
 * de o HTML existir.
 *
 * Um harness que não resolve include mede uma página que não existe. Pior:
 * empurra a correção para o lado errado — a tentação é desfazer a extração
 * para o teste voltar a passar.
 *
 * O que é fiel ao Apps Script: o include é textual, avaliado em qualquer
 * posição, e o resultado é colado no lugar. O que NÃO é: aqui não há proteção
 * contra recursão, então um arquivo que se inclui trava o Node em vez de
 * estourar a memória do servidor. O limite de profundidade abaixo transforma
 * isso num erro legível — é o mesmo defeito da REGRA Nº 0, e o teste tem de
 * dizer o nome dele.
 */
function resolverIncludes(bruto, jaAbertos) {
  jaAbertos = jaAbertos || [];
  const marca = /<\?!?=?\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g;
  return bruto.replace(marca, function (_, nome) {
    if (jaAbertos.indexOf(nome) >= 0)
      throw new Error("include recursivo: " + jaAbertos.concat(nome).join(" → "));
    const caminho = path.join(RAIZ, nome + ".html");
    if (!fs.existsSync(caminho)) return "";  /* o Apps Script engole e segue */
    return resolverIncludes(fs.readFileSync(caminho, "utf8"), jaAbertos.concat(nome));
  });
}

/** Separa o HTML dos blocos de <script>, para poder rodar os dois na ordem. */
function fatiar(arquivo) {
  const bruto = resolverIncludes(fs.readFileSync(path.join(RAIZ, arquivo), "utf8"),
                                [arquivo.replace(/\.html$/, "")]);
  const scripts = [];
  const marca = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  const corpo = bruto.replace(marca, function (_, js) { scripts.push(js); return ""; });
  return { corpo: corpo, scripts: scripts };
}

/**
 * Sobe uma janela com as telas pedidas e o google.script.run ligado no backend.
 *
 * @param {Object} g        escopo global do gas.js, com os .gs já carregados
 * @param {Array}  arquivos nomes de .html, na ordem em que o index.html inclui
 * @param {Object} opts     { token }
 */
function montar(g, arquivos, opts) {
  opts = opts || {};
  const { JSDOM } = carregarJsdom();

  const partes = arquivos.map(fatiar);
  const dom = new JSDOM(
    "<!doctype html><html><body>" + partes.map(function (p) { return p.corpo; }).join("\n") + "</body></html>",
    { runScripts: "outside-only", pretendToBeVisual: true }
  );
  const win = dom.window;

  win.SISGEP_TOKEN_SESSAO = opts.token || "";

  /* As chamadas ficam registradas. É por aqui que se prova o que a tela PEDE
   * ao servidor — que é metade do que ela faz de errado quando erra. */
  const chamadas = [];

  /* Atraso por função, para poder forçar CORRIDA: a resposta de uma chamada
   * antiga chegando depois de uma nova. Sem isto o teste nunca exercita o
   * descarte por número de sequência — e uma mutação que remova o descarte
   * sobrevive, como sobreviveu na primeira rodada. */
  const atrasos = {};

  /* google.script.run de mentira, backend de verdade.
   *
   * Assíncrono de propósito, com setTimeout(0): no navegador ele é, e uma
   * tela que só funciona com resposta síncrona é uma tela que vai quebrar em
   * produção. Foi assim que o descarte silencioso de busca apareceu. */
  function novoRunner() {
    let ok = null, falha = null;
    /* Os dois with* devolvem o PROXY, não o objeto cru — senão a cadeia
     * `.withSuccessHandler(...).withFailureHandler(...).minhaFuncao()` perde
     * o proxy no primeiro elo e o nome da função do backend não resolve.
     * Foi o primeiro defeito deste andaime, e ele fingiu ser bug da tela. */
    let proxy;
    const runner = {
      withSuccessHandler: function (fn) { ok = fn; return proxy; },
      withFailureHandler: function (fn) { falha = fn; return proxy; }
    };
    proxy = new Proxy(runner, {
      get: function (alvo, prop) {
        if (prop in alvo) return alvo[prop];
        if (typeof prop !== "string") return undefined;
        return function () {
          const args = Array.prototype.slice.call(arguments);
          chamadas.push({ fn: prop, args: JSON.parse(JSON.stringify(args)) });
          const espera = atrasos[prop + ":" + (chamadas.length - 1)] || 0;
          setTimeout(function () {
            let r;
            try {
              if (typeof g[prop] !== "function") throw new Error("função inexistente no backend: " + prop);
              r = g[prop].apply(null, args);
            } catch (e) {
              if (falha) falha(e);
              return;
            }
            if (ok) ok(JSON.parse(JSON.stringify(r === undefined ? null : r)));
          }, espera);
        };
      }
    });
    return proxy;
  }

  /* Cada chamada precisa de um runner NOVO: no Apps Script real, dois
   * `google.script.run` em voo não compartilham handler. Reaproveitar um só
   * faria a resposta de uma chamada cair no handler de outra — e o teste
   * passaria a mentir sobre corrida, que é justo o que ele existe para pegar. */
  win.google = { script: { host: { close: function () {} } } };
  Object.defineProperty(win.google.script, "run", { get: novoRunner });

  /* jsdom não implementa DataTransfer nem deixa escrever em input.files.
   *
   * A tela de ofícios usa os dois para montar o anexo de ficha de cada
   * trabalhador — sem eles, criar um cartão explode em "DataTransfer is not
   * defined" e o teste acusaria defeito onde não há. O que está aqui é o
   * mínimo que o navegador oferece: uma lista de arquivos que se pode
   * montar e atribuir.
   *
   * ATENÇÃO ao que isto NÃO prova: o arquivo não é lido, não tem conteúdo e
   * não sobe para lugar nenhum. Serve para exercitar a LÓGICA de
   * distribuição e contagem. O upload de verdade continua "não testado"
   * pela REGRA Nº -1 e exige navegador. */
  win.DataTransfer = function () {
    const arquivos = [];
    this.items = { add: function (f) { arquivos.push(f); } };
    Object.defineProperty(this, "files", { get: function () { return arquivos; } });
  };
  Object.defineProperty(win.HTMLInputElement.prototype, "files", {
    configurable: true,
    get: function () { return this._filesFalsos || []; },
    set: function (v) { this._filesFalsos = Array.prototype.slice.call(v || []); }
  });

  /* jsdom não implementa scrollIntoView — não é falta da tela, é falta do
   * andaime. Sem este remendo, qualquer tela que role até a mensagem de
   * feedback explode no meio do teste, e a explosão se parece com bug da
   * tela. Vazio de propósito: rolagem é aparência, e aparência não se testa
   * aqui de todo jeito. */
  win.Element.prototype.scrollIntoView = function () {};

  /* toast() e a navegação entre módulos são do index.html, que não entra
   * aqui. Registrados para o teste poder afirmar que a tela avisou. */
  const avisos = [];
  win.toast = function (msg, tipo) { avisos.push({ msg: String(msg), tipo: tipo || "" }); };
  const navegacoes = [];
  win.abrirEscolas = function () { navegacoes.push("escolas"); };

  partes.forEach(function (p, i) {
    p.scripts.forEach(function (js, k) {
      try {
        win.eval(js);
      } catch (e) {
        throw new Error("script " + (k + 1) + " de " + arquivos[i] + " quebrou: " + e.message);
      }
    });
  });

  return {
    win: win,
    doc: win.document,
    chamadas: chamadas,
    /** Faz a N-ésima chamada de `fn` demorar `ms` — para testar corrida. */
    atrasar: function (fn, indice, ms) { atrasos[fn + ":" + indice] = ms; },
    avisos: avisos,
    navegacoes: navegacoes,
    /** Espera o DOM parar de mudar — as respostas do backend são assíncronas. */
    assentar: function (ms) {
      return new Promise(function (r) { setTimeout(r, ms === undefined ? 30 : ms); });
    },
    texto: function (sel) {
      const el = win.document.querySelector(sel);
      return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
    },
    /* UM disparo por ação, e só um.
     *
     * A primeira versão fazia dispatchEvent E chamava o onclick na mão, "por
     * garantia". Em jsdom o dispatchEvent já invoca o onclick, então todo
     * clique valia por dois. Num botão de página isso não aparece — ir para
     * a 2 duas vezes dá a 2. Num card que ALTERNA o filtro, liga e desliga
     * na mesma ação, e o teste acusou a tela de não filtrar quando o
     * defeito era do andaime. Andaime que mente é pior que nenhum. */
    clicar: function (sel) {
      const el = typeof sel === "string" ? win.document.querySelector(sel) : sel;
      if (!el) throw new Error("elemento não existe para clicar: " + sel);
      if (el.disabled) return false;
      el.dispatchEvent(new win.Event("click", { bubbles: true }));
      return true;
    },
    /* SELETOR **OU** ELEMENTO, como o clicar() já aceitava.
     *
     * Os três divergiam: clicar() resolvia elemento, digitar() e escolher()
     * não — e passar um elemento a eles caía num DOMException do seletor,
     * erro que não diz o que houve. Apareceu em 13/08/2026 num teste de
     * bloco repetível, onde os campos não têm id: eles são achados dentro do
     * card, e o que se tem em mãos é o elemento. */
    digitar: function (sel, valor) {
      const el = typeof sel === "string" ? win.document.querySelector(sel) : sel;
      if (!el) throw new Error("campo não existe: " + sel);
      el.value = valor;
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
    },
    escolher: function (sel, valor) {
      const el = typeof sel === "string" ? win.document.querySelector(sel) : sel;
      if (!el) throw new Error("select não existe: " + sel);
      el.value = valor;
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
    },
    /* CHECKBOX NÃO SE MARCA COM clicar().
     *
     * `new Event("click")` não é evento confiável, e o jsdom não executa a
     * "activation behavior" do checkbox para ele: a caixa NÃO alterna e o
     * `change` NÃO dispara. Quem usasse clicar() num checkbox veria o estado
     * não mudar e culparia a tela — foi o que aconteceu na primeira rodada
     * do t34, onde o campo da cópia "não desabilitava".
     *
     * Aqui o estado é posto à mão e o `change` disparado explicitamente, que
     * é o que a tela de fato escuta. */
    marcar: function (sel, valor) {
      const el = win.document.querySelector(sel);
      if (!el) throw new Error("checkbox não existe: " + sel);
      el.checked = !!valor;
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
      return el.checked;
    }
  };
}

module.exports = { montar: montar, jsdomDisponivel: jsdomDisponivel, RAIZ: RAIZ };
