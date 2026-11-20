/**
 * A EMISSÃO V1 ESTÁ DESLIGADA — E O ARQUIVO DELA CONTINUA SENDO ESSENCIAL
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. Na análise do módulo, apontei que duas emissões coexistiam e
 * que a decisão era do usuário. Ele respondeu: *"V1 era para ser
 * desabilitado"*.
 *
 * POR QUE ELA SAI
 *
 * O QR da V1 é DERIVÁVEL DO NÚMERO DO INGRESSO (`emissao_gerarQrCodeUrl_`):
 * quem descobrisse o padrão fabricava um ingresso válido sem passar por lugar
 * nenhum. A V2 assina o token com HMAC e guarda o hash em `qrTokens`, que é o
 * índice que prova que o ingresso foi realmente emitido.
 *
 * A ARMADILHA QUE ESTE TESTE GUARDA
 *
 * "Desabilitar a V1" parece que quer dizer "apagar EventosEmissao.gs". **Não
 * quer.** Aquele arquivo carrega `EMISSAO_CFG` — evento, limite de 2.000
 * vagas, prefixo do número, período, valor do acompanhante — e o módulo
 * INTEIRO lê de lá, a V2 inclusive. Também mora ali o
 * `emissao_formatarNumero_` que a própria V2 usa para numerar.
 *
 * Apagar o arquivo derrubaria o módulo todo, silenciosamente: `EMISSAO_CFG`
 * viraria `undefined` e cada leitura de `EMISSAO_CFG.EVENTO_ID` estouraria em
 * um lugar diferente. É exatamente o caso que a REGRA Nº 1 existe para
 * impedir, e por isso metade das asserções aqui verifica o que PRECISA
 * CONTINUAR VIVO.
 *
 * MUTAÇÕES MATADAS (21/08/2026) — 8 de 8, nenhuma sobrevivente
 *
 *   1. a V1 voltar a emitir ................................... quebra dura
 *   2. a recusa virar ok:true ................................. 1 falha
 *   3. a recusa não dizer para onde ir ........................ 1 falha
 *   4. EMISSAO_CFG sumir do arquivo ........................... 1 falha
 *   5. emissao_formatarNumero_ sumir (a V2 numera com ele) .... 1 falha
 *   6. a tela antiga perder a faixa de aviso .................. 1 falha
 *   7. o card da aba voltar a abrir o painel morto ............ 1 falha
 *   8. a auditoria da tentativa sumir ......................... quebra dura
 *
 * As mutações 1 e 8 dão "quebra dura": o teste nem chega ao fim. É de
 * propósito — as dependências injetadas em `emitirV1` são armadilhas. Se a
 * função voltar a emitir, ela bate num `LockService` e num `fs_set_` que
 * lançam exceção. Emissão de verdade não passa despercebida num teste que
 * não tem como gravar nada.
 *
 * O QUE A MUTAÇÃO CORRIGIU NO PRÓPRIO TESTE
 *
 * A 5 sobreviveu na primeira rodada. Eu procurava a função por
 * `/^function\s+emissao_formatarNumero_/` — sem âncora de fim, isso casa por
 * PREFIXO: renomear para `emissao_formatarNumero_REMOVIDA_` passava batido, e
 * a asserção que existe justamente para provar que a V2 ainda consegue
 * numerar continuava verde. Agora a regex exige o `(` logo depois do nome.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

const emissao = ler("EventosEmissao.gs");
const emissaoV2 = ler("EventosEmissaoV2.gs");
const telaAntiga = ler("EventoPainel.html");
const telaAdmin = ler("EventosAdmin.html");

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1].split(",").map(s => s.trim()).filter(Boolean),
           corpo: codigo.slice(m.index + m[0].length, i - 1) };
}

fluxo("EMISSÃO V1 · desligada, sem derrubar o que o módulo precisa");

/* ─────────────────────────────────────────────────────────────────────────
   1. A V1 RECUSA — executada, não lida
   ───────────────────────────────────────────────────────────────────────*/
passo("a emissão antiga, chamada de verdade");

let auditado = [];
function emitirV1(payload) {
  auditado = [];
  const alvo = corpoDe(emissao, "emissao_emitirIngresso");
  const deps = {
    exigirAdminOuSessao_: () => "",
    compasso_auditar_: (acao, tipo, id, extra) => auditado.push({ acao, extra }),
    Logger: { log: () => {} },
    EMISSAO_V1_DESABILITADA_EM: (emissao.match(/EMISSAO_V1_DESABILITADA_EM = '([^']+)'/) || [])[1],
    LockService: { getScriptLock: () => { throw new Error("A V1 NÃO PODE chegar ao lock — ela recusa antes"); } },
    fs_set_: () => { throw new Error("A V1 NÃO PODE gravar nada"); }
  };
  const nomes = Object.keys(deps);
  return new Function(...alvo.args, ...nomes, alvo.corpo)(
    payload, "", ...nomes.map(n => deps[n]));
}

/* MUTAÇÕES 1 e 2: se a V1 voltar a emitir, as dependências acima estouram —
   o lock e o fs_set_ são armadilhas de propósito. */
const r = emitirV1({ nome: "TESTE", categoria: "associado" });

igual(r.ok, false,
      "a emissão V1 recusa",
      "era o pedido: 'V1 era para ser desabilitado'");
igual(r.codigo, "V1_DESABILITADA",
      "e diz por um código, não só por texto",
      "código dá para a tela tratar; texto só dá para a pessoa ler");

/* MUTAÇÃO 3: recusa que não diz para onde ir deixa a pessoa parada. */
ok(/painel de inscri/i.test(String(r.erro || "")),
   "a recusa aponta para onde emitir agora",
   "recusar sem dizer o caminho é transformar segurança em obstáculo");
ok(/n[ãa]o era assinado|n[ãa]o assinado/i.test(String(r.erro || "")),
   "e diz o motivo: o QR não era assinado");

/* A tentativa fica registrada: é assim que se descobre se alguém ainda
   depende deste caminho — por uso real, não por suposição. */
igual(auditado.length, 1, "a tentativa é registrada na auditoria");
igual(auditado[0].acao, "EMISSAO_V1_RECUSADA",
      "com ação própria: " + auditado[0].acao,
      "se aparecer no log depois de dezembro, alguém tinha um link salvo");

/* ─────────────────────────────────────────────────────────────────────────
   2. O QUE NÃO PODE CAIR JUNTO  (REGRA Nº 1)
   ───────────────────────────────────────────────────────────────────────*/
passo("o arquivo continua sendo infraestrutura do módulo");

/* MUTAÇÃO 4: sem EMISSAO_CFG o módulo inteiro morre em silêncio. */
ok(/var EMISSAO_CFG = \{/.test(emissao),
   "EMISSAO_CFG continua declarado em EventosEmissao.gs",
   "é daqui que TODO o módulo lê evento, vagas e prefixo — V2 inclusive");

["EVENTO_ID", "LIMITE_VAGAS", "PREFIXO", "VALOR_ACOMPANHANTE"].forEach(ch => {
  ok(new RegExp(ch + ":").test(emissao), "  EMISSAO_CFG." + ch + " presente");
});

/* MUTAÇÃO 5: a V2 numera com o formatador que mora no arquivo da V1. */
ok(/emissao_formatarNumero_/.test(emissaoV2),
   "a V2 usa emissao_formatarNumero_, que mora no arquivo da V1",
   "é o motivo concreto de o arquivo não poder ser apagado");
/* O `\s*\(` no fim NÃO é decoração: sem ele, a regex casa por PREFIXO, e
   renomear a função para `emissao_formatarNumero_REMOVIDA_` passaria batido.
   Foi o que aconteceu na primeira rodada de mutação deste arquivo. */
const declara = (codigo, nome) =>
  new RegExp("^function\\s+" + nome + "\\s*\\(", "m").test(codigo);

ok(declara(emissao, "emissao_formatarNumero_"),
   "  e ele continua lá, com esse nome exato");

/* Os outros consumidores que a checagem dos 5 passos encontrou. */
["emissao_lerContador_", "emissao_modoTeste_", "emissao_buscarAssociado"].forEach(f => {
  ok(declara(emissao, f), "  " + f + " preservada");
});

/* O motor antigo fica legível, para quem precisar entender o que mudou. */
ok(/^function\s+emissao_emitirIngreso?so?_legadoV1_/m.test(emissao) ||
   /emissao_emitirIngresso_legadoV1_/.test(emissao),
   "o motor antigo fica preservado como legado, não apagado",
   "na dúvida entre remover e manter, mantém e documenta");

/* ─────────────────────────────────────────────────────────────────────────
   3. A V2 CONTINUA SENDO O CAMINHO
   ───────────────────────────────────────────────────────────────────────*/
passo("a emissão que ficou");

ok(declara(emissaoV2, "compasso_emitirIngressoV2"),
   "compasso_emitirIngressoV2 existe e é o caminho vivo");
ok(/qrTokens/.test(emissaoV2),
   "e guarda o hash em qrTokens — o índice que prova a emissão",
   "é o que a V1 não tinha: sem índice, QR deduzido passa");

/* ─────────────────────────────────────────────────────────────────────────
   4. NINGUÉM É MANDADO PARA A PORTA FECHADA
   ───────────────────────────────────────────────────────────────────────*/
passo("os caminhos que levavam até ela");

/* MUTAÇÃO 6 */
ok(/desativada em 21\/08\/2026|foi desativada/i.test(telaAntiga),
   "a tela antiga explica a desativação em vez de só dar erro",
   "a rota ?painel=emissao continua existindo; quem tem link salvo chega lá");

/* MUTAÇÃO 7 */
ok(!/onclick="evAbrirPainel\('emissao'\)"/.test(telaAdmin),
   "o card da aba Inscrições não abre mais o painel desligado");
ok(/evAvisoEmissaoV1/.test(telaAdmin),
   "  ele explica por quê");
ok(/window\.evAbrirEmissaoIngressos/.test(telaAdmin),
   "evAbrirEmissaoIngressos continua existindo",
   "outras telas podem chamá-la; sumir com a função quebraria o JavaScript da página");

resumo();
