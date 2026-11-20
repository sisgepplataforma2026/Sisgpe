/**
 * O DEPLOY SELETIVO NÃO PODE APAGAR O QUE OUTRO DEPLOY ACABOU DE PUBLICAR
 *
 * O QUE ORIGINOU — MEDIDO, NÃO SUPOSTO
 *
 * 20/08/2026. Dois caminhos de deploy escreveram no mesmo projeto de
 * homologação com minutos de diferença:
 *
 *   15:53:37–15:53:46  deploy-homologacao.yml envia o repositório inteiro
 *                      (219 arquivos, inclusive AmbienteRecursos.gs, novo)
 *   15:54:30           scripts/deploy-documentos-security-hml.js grava
 *
 * O segundo troca 3 arquivos, mas o PUT em /projects/{id}/content REESCREVE
 * A LISTA INTEIRA. Ele leu o projeto, alterou 3 itens na memória e devolveu
 * tudo. Como a leitura dele foi anterior ao envio do primeiro, o PUT devolveu
 * o projeto ao estado ANTERIOR.
 *
 * Os DOIS terminaram verdes. O modo `conferir`, rodado logo depois, mostrou
 * o estrago:
 *
 *     repositorio: 220 arquivos      homologacao: 219
 *     SERIAM CRIADOS:   AmbienteRecursos.gs
 *     SERIAM ALTERADOS: Comprovantes.gs, Recibo.gs, SistemaConfig.gs,
 *                       Utils.gs, Voucher.gs, RelatoriosBackend.gs,
 *                       ReciboDiversos.gs, Despesas_Oficio_Fiscal.gs (+2)
 *
 * E o usuário confirmou no editor do projeto:
 *
 *     ReferenceError: diagnosticoAmbienteRecursos_ is not defined
 *
 * Um deploy desfez o outro em silêncio. É a pior forma de defeito, porque o
 * relatório de sucesso é a prova aparente de que deu certo.
 *
 * O QUE ESTE TESTE MEDE
 *
 * Roda o script de verdade contra um Apps Script API falso e verifica que:
 *
 *   1. quando o projeto NÃO muda entre a leitura e a escrita, ele publica;
 *   2. quando MUDA, ele ABORTA e não chega a escrever;
 *   3. a recusa nomeia o que surgiu e o que sumiria;
 *   4. a verificação pós-escrita olha a lista INTEIRA, não só os 3 alvos —
 *      senão o defeito original passaria de novo, com os alvos certos e o
 *      resto varrido.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(RAIZ, "scripts", "deploy-documentos-security-hml.js");

/* ─────────────────────────────────────────────────────────────────────────
   O DUBLÊ DA API

   Roda o script REAL num processo separado, com global.fetch trocado por um
   simulador. Testar o script de verdade é o ponto: um teste que reimplemente
   a lógica não prova nada sobre o arquivo que roda no CI.
   ───────────────────────────────────────────────────────────────────────── */
function rodar(opts) {
  const preload = `
const ALVOS = ["Comprovantes", "ComprovantesNF", "RelatoriosOficios"];
let leituras = 0;
const registro = [];

function arquivos(extra) {
  const base = [
    { name: "appsscript",        type: "JSON",      source: "{}" },
    { name: "Comprovantes",      type: "SERVER_JS", source: "antigo" },
    { name: "ComprovantesNF",    type: "HTML",      source: "antigo" },
    { name: "RelatoriosOficios", type: "SERVER_JS", source: "antigo" },
    { name: "Code",              type: "SERVER_JS", source: "antigo" }
  ];
  return extra ? base.concat(extra) : base;
}

/* ${opts.descricao} */
const INTRUSO = ${JSON.stringify(opts.intruso || null)};
const DERRUBA = ${JSON.stringify(opts.derruba || null)};
const APARECE_NA_LEITURA = ${opts.apareceNaLeitura};

const DEP = "AKfycbzOfoQ4y2yc7oM9hiz2ATvB6YztGEMDjgO1FiezQ0schgqcOJnJgROzCC3sEeV6h4n0ZA";
let guardado = null;
let implantado = null;

global.fetch = async (url, init) => {
  const u = String(url);
  const metodo = (init && init.method) || "GET";
  registro.push(metodo + " " + u.replace("https://script.googleapis.com/v1", ""));

  if (u.indexOf("oauth2.googleapis.com/token") !== -1) {
    return resposta({ access_token: "tok-de-teste" });
  }
  if (u.indexOf("/content") !== -1 && metodo === "GET") {
    leituras++;
    /* A CORRIDA: o intruso aparece a partir da leitura indicada. */
    const temIntruso = INTRUSO && leituras >= APARECE_NA_LEITURA;
    if (guardado && leituras > 2) return resposta({ files: guardado });
    return resposta({ files: arquivos(temIntruso ? [INTRUSO] : null) });
  }
  if (u.indexOf("/content") !== -1 && metodo === "PUT") {
    guardado = JSON.parse(init.body).files;
    /* Escrita PARCIAL: a API aceita e devolve 200, mas um arquivo não
       sobrevive. Acontece de verdade, e é indistinguível de sucesso para
       quem só confere os próprios alvos. */
    if (DERRUBA) guardado = guardado.filter(f => f.name !== DERRUBA);
    return resposta({ files: guardado });
  }
  /* O dublê PRECISA lembrar o que foi implantado: o script faz PUT no
     deployment e depois RELÊ para conferir se a versão bateu. Um dublê que
     devolvesse sempre a mesma coisa reprovaria o script por defeito do
     próprio teste — foi o que aconteceu na primeira rodada. */
  if (u.indexOf("/deployments/") !== -1 && metodo === "PUT") {
    implantado = JSON.parse(init.body).deploymentConfig;
    return resposta({ deploymentId: DEP, deploymentConfig: implantado });
  }
  if (u.indexOf("/deployments/") !== -1 && metodo === "GET") {
    return resposta({
      deploymentId: DEP,
      deploymentConfig: implantado || { manifestFileName: "appsscript" }
    });
  }
  if (u.indexOf("/versions") !== -1) return resposta({ versionNumber: 99 });
  return resposta({});
};

function resposta(json) {
  return { ok: true, status: 200,
           text: async () => JSON.stringify(json),
           json: async () => json };
}

process.on("exit", () => {
  try {
    require("fs").writeFileSync(process.env.REGISTRO_SAIDA,
      JSON.stringify({ registro, guardado }, null, 1));
  } catch (e) {}
});
`;

  const preloadPath = path.join(require("os").tmpdir(), "t70-preload.js");
  const registroPath = path.join(require("os").tmpdir(), "t70-registro.json");
  fs.writeFileSync(preloadPath, preload);
  try { fs.unlinkSync(registroPath); } catch (e) {}

  const r = spawnSync(process.execPath, ["--require", preloadPath, SCRIPT], {
    encoding: "utf8",
    cwd: RAIZ,
    env: Object.assign({}, process.env, {
      REGISTRO_SAIDA: registroPath,
      CLASPRC_JSON: JSON.stringify({
        tokens: { default: {
          client_id: "cid", client_secret: "seg", refresh_token: "ref"
        } }
      })
    })
  });

  let extra = {};
  try { extra = JSON.parse(fs.readFileSync(registroPath, "utf8")); } catch (e) {}

  return {
    codigo: r.status,
    saida: (r.stdout || "") + (r.stderr || ""),
    registro: extra.registro || [],
    gravado: extra.guardado || null
  };
}

/* Guarda o arquivo de erro que o script escreve, para o teste não sujar o
   repositório com a prova de uma falha simulada. */
const ARQ_ERRO = path.join(RAIZ, ".ci", "security-documentos-hml-deploy-error.json");
const ARQ_OK   = path.join(RAIZ, ".ci", "security-documentos-hml-deploy.json");
const backup = {};
[ARQ_ERRO, ARQ_OK].forEach(function (p) {
  backup[p] = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
});
function restaurar() {
  [ARQ_ERRO, ARQ_OK].forEach(function (p) {
    if (backup[p] === null) { try { fs.unlinkSync(p); } catch (e) {} }
    else fs.writeFileSync(p, backup[p]);
  });
}

/* ═════════════════════════════════════════════════════════════════════════
   1. SEM CORRIDA — o script tem de continuar funcionando
   ═════════════════════════════════════════════════════════════════════════ */
fluxo("DEPLOY SELETIVO · Sem corrida, publica normalmente");

const calmo = rodar({ descricao: "projeto estável", intruso: null, apareceNaLeitura: 99 });

passo("publica");
ok(calmo.codigo === 0, "o script termina com sucesso quando ninguém mexeu no projeto",
   calmo.codigo === 0 ? "" : calmo.saida.trim().split("\n").slice(-3).join(" | "));

ok(calmo.registro.some(l => l.indexOf("PUT") === 0 && l.indexOf("/content") !== -1),
   "e chega a escrever o conteúdo",
   calmo.registro.join(" → "));

passo("não perde arquivo");
ok(calmo.gravado && calmo.gravado.length === 5,
   "a lista escrita tem os mesmos 5 arquivos que foram lidos",
   calmo.gravado ? calmo.gravado.map(f => f.name).join(", ") : "(nada gravado)");

ok(calmo.gravado && calmo.gravado.some(f => f.name === "Code"),
   "inclusive os que não são alvo — Code continua lá",
   "é isso que o deploy antigo apagava");

/* ═════════════════════════════════════════════════════════════════════════
   2. COM CORRIDA — tem de abortar ANTES de escrever
   ═════════════════════════════════════════════════════════════════════════ */
fluxo("DEPLOY SELETIVO · Com corrida, recusa e não escreve");

/* O intruso aparece na SEGUNDA leitura: é exatamente o caso real —
   AmbienteRecursos.gs entrou no projeto depois de o script ter lido. */
const corrida = rodar({
  descricao: "outro deploy publicou entre a leitura e a escrita",
  intruso: { name: "AmbienteRecursos", type: "SERVER_JS", source: "novo" },
  apareceNaLeitura: 2
});

passo("aborta");
ok(corrida.codigo !== 0, "o script FALHA em vez de publicar por cima",
   "código de saída " + corrida.codigo);

ok(/CORRIDA DETECTADA/.test(corrida.saida),
   "e diz que foi corrida, não um erro genérico",
   (corrida.saida.match(/DEPLOY HML FALHOU: [^\n]{0,120}/) || [""])[0]);

passo("não escreveu");
igual(corrida.registro.filter(l => l.indexOf("PUT") === 0 && l.indexOf("/content") !== -1), [],
      "nenhum PUT de conteúdo chegou a sair");

ok(corrida.gravado === null,
   "e o projeto simulado não foi alterado",
   "abortar depois de escrever não serviria de nada");

passo("a mensagem é acionável");
ok(/AmbienteRecursos/.test(corrida.saida),
   "a recusa nomeia o arquivo que apareceu",
   "quem lê o erro precisa saber o que quase perdeu");

ok(/deploy-homologacao\.yml/.test(corrida.saida),
   "e diz qual deploy rodar no lugar",
   "erro que não ensina o próximo passo vira tentativa e erro");

/* ═════════════════════════════════════════════════════════════════════════
   3. ESCRITA PARCIAL — a API aceitou, mas um arquivo não sobreviveu

   Conferir só os 3 alvos deixaria passar exatamente o defeito de hoje: os
   alvos certos, o resto varrido, e um relatório de sucesso por cima. A
   mutação provou que esta asserção faltava — sem ela, apagar a verificação
   da lista inteira não derrubava nada.
   ═════════════════════════════════════════════════════════════════════════ */
fluxo("DEPLOY SELETIVO · Escrita parcial é detectada, não celebrada");

const parcial = rodar({
  descricao: "a API engole um arquivo no PUT",
  intruso: null, apareceNaLeitura: 99,
  derruba: "Code"
});

passo("detecta");
ok(parcial.codigo !== 0,
   "sumir um arquivo que não é alvo FAZ o deploy falhar",
   "código de saída " + parcial.codigo);

ok(/n[aã]o bate com a que|perdido/i.test(parcial.saida),
   "e o erro diz que a lista de arquivos não bateu",
   (parcial.saida.match(/DEPLOY HML FALHOU: [^\n]{0,110}/) || [""])[0]);

ok(!/Deploy HML confirmado/.test(parcial.saida),
   "não imprime confirmação de sucesso",
   "foi o sucesso aparente que escondeu o estrago de hoje");

restaurar();
resumo();
