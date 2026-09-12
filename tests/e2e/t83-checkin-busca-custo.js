/**
 * A BUSCA DA PORTARIA NÃO PODE CUSTAR A COLEÇÃO INTEIRA
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026, na análise do módulo Eventos. `compasso_checkinBuscarManual`
 * chamava `fs_list_('ingressos', 1000)` e filtrava em memória — a cada busca.
 *
 * O Firestore cobra por DOCUMENTO LIDO, não por chamada. Com 2.000 ingressos,
 * dez buscas manuais na noite de 19/12 custariam 20.000 leituras: cerca de
 * 40% da faixa gratuita diária, gasta na contingência. E contingência é o que
 * se usa quando a fila JÁ está travada — celular descarregado, QR danificado,
 * pessoa que não achou o e-mail.
 *
 * POR QUE ESTE TESTE MEDE CUSTO, E NÃO SÓ RESULTADO
 *
 * Um teste que só conferisse "achou a pessoa certa" passaria igual antes e
 * depois da correção — as duas versões acham. O que mudou foi o PREÇO, e
 * preço só se prova contando o que foi lido. Por isso cada asserção aqui
 * conta chamadas a `fs_list_` e a `fs_queryEquals_`.
 *
 * O QUE NÃO PODE QUEBRAR
 *
 * A portaria busca por nome parcial e por CPF parcial. Se o atalho barato
 * tivesse substituído a listagem, esses casos parariam de achar — e ninguém
 * perceberia até a noite do evento, com fila na frente. Metade das asserções
 * existe para isso: garantir que o caminho caro continua lá, para quem
 * precisa dele.
 *
 * MUTAÇÕES MATADAS (21/08/2026) — 7 de 7, nenhuma sobrevivente
 *
 *   1. voltar a listar sempre (desfazer a correção) ............ 1 falha
 *   2. o atalho de CPF sumir .................................. 1 falha
 *   3. o atalho de número sumir ............................... 5 falhas
 *   4. atalho vazio ENCERRAR a busca (não cair na listagem) ... 1 falha
 *   5. parar de filtrar por evento no atalho .................. 1 falha
 *   6. CPF de 11 dígitos virar número de ingresso ............. 1 falha
 *   7. o teto de 20 resultados sumir .......................... 1 falha
 *
 * Várias morrem por UMA asserção só — a que conta listagens. É o esperado
 * num teste de custo: o resultado continua certo em quase todas, e só a
 * contagem denuncia. Um teste que não medisse leitura passaria em 6 das 7.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const src = fs.readFileSync(path.join(RAIZ, "EventosCheckinPainel.gs"), "utf8");

function corpoDe(nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(src);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < src.length && prof > 0) {
    const c = src[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1].split(",").map(s => s.trim()).filter(Boolean),
           corpo: src.slice(m.index + m[0].length, i - 1) };
}

const EVENTO = "COMPASSO2026";

/* 2.000 ingressos, como no dia do evento. O volume importa: é ele que
   transforma "uma listagem" em "40% da cota". */
const BASE = [];
for (let i = 1; i <= 2000; i++) {
  BASE.push({
    ingressoId: "ing-" + i,
    eventoId: EVENTO,
    numero: "FCV-2026-" + String(i).padStart(6, "0"),
    nome: "PESSOA " + i,
    cpf: String(10000000000 + i),
    escola: i % 2 ? "EEEFM Central" : "EMEF Norte",
    categoria: "associado",
    status: "EMITIDO"
  });
}
/* Um homônimo parcial e um de outro evento, para as bordas. */
BASE.push({ ingressoId: "ing-maria", eventoId: EVENTO, numero: "FCV-2026-009999",
  nome: "MARIA APARECIDA", cpf: "52998224725", escola: "EEEFM Sul",
  categoria: "associado", status: "EMITIDO" });
BASE.push({ ingressoId: "ing-outro", eventoId: "OUTRO", numero: "FCV-2026-000001",
  nome: "PESSOA 1", cpf: "10000000001", escola: "X", categoria: "x", status: "EMITIDO" });

/** Roda a busca contando o que ela leu. */
function buscar(termo) {
  const conta = { listagens: 0, docsLidos: 0, consultas: 0, docsPorConsulta: 0 };
  const alvo = corpoDe("compasso_checkinBuscarManual");
  const deps = {
    exigirAdminOuSessao_: () => "",
    EMISSAO_CFG: { EVENTO_ID: EVENTO, PREFIXO: "FCV-2026-" },
    fs_list_: () => { conta.listagens++; conta.docsLidos += BASE.length;
                      return BASE.map(x => Object.assign({}, x)); },
    fs_queryEquals_: (col, campo, valor) => {
      conta.consultas++;
      const achados = BASE.filter(x => String(x[campo]) === String(valor)).slice(0, 5);
      conta.docsPorConsulta += achados.length;
      return achados.map(x => Object.assign({}, x));
    },
    compasso_checkinResumo_: new Function("x", corpoDe("compasso_checkinResumo_").corpo),
    compasso_checkinNumeroCanonico_: new Function("termo", "nums",
      corpoDe("compasso_checkinNumeroCanonico_").corpo)
  };
  const nomes = Object.keys(deps);
  const r = new Function(...alvo.args, ...nomes, alvo.corpo)(
    termo, "", ...nomes.map(n => deps[n]));
  return { r: r, conta: conta };
}

fluxo("PORTARIA · a busca manual não pode custar a coleção inteira");

/* ─── 1. os atalhos: acham, e custam pouco ─── */
passo("CPF e número: consulta com filtro, não a coleção");

/* MUTAÇÃO 1 e 2: sem o atalho de CPF, isto lista 2.002 documentos. */
const porCpf = buscar("52998224725");
igual(porCpf.r.length, 1, "CPF completo acha a pessoa");
igual(porCpf.r[0].nome, "MARIA APARECIDA", "e é a pessoa certa");
igual(porCpf.conta.listagens, 0,
      "sem listar a coleção: 0 listagem(ns)",
      "é o ponto inteiro da correção — antes era 1 listagem = 2.002 documentos");
ok(porCpf.conta.docsPorConsulta <= 5,
   "leu " + porCpf.conta.docsPorConsulta + " documento(s), não 2.002",
   "com 10 buscas assim: 10 leituras em vez de 20.000");

/* MUTAÇÃO 3: sem o atalho de número, isto lista tudo. */
[["FCV-2026-000042", "número completo"],
 ["42", "só o número"],
 ["000042", "número com zeros"]].forEach(([termo, rot]) => {
  const b = buscar(termo);
  igual(b.r.length, 1, rot + " acha 1 ingresso");
  igual(b.r[0].numero, "FCV-2026-000042", "  → " + b.r[0].numero);
  igual(b.conta.listagens, 0, "  sem listar a coleção");
});

/* MUTAÇÃO 5: o atalho tem de respeitar o evento. */
const doOutroEvento = buscar("10000000001");
ok(doOutroEvento.r.every(x => x.ingressoId !== "ing-outro"),
   "o atalho não devolve ingresso de outro evento",
   "dois eventos na mesma coleção: sem o filtro, a portaria libera quem não é da festa");

/* MUTAÇÃO 6: CPF tem 11 dígitos e não pode virar número de ingresso. */
const canonico = new Function("termo", "nums",
  corpoDe("compasso_checkinNumeroCanonico_").corpo);
igual(canonico("52998224725", "52998224725"), "",
      "CPF de 11 dígitos NÃO é tratado como número de ingresso");
igual(canonico("42", "42"), "FCV-2026-000042", "e um número curto é");
igual(canonico("maria", ""), "", "nome não vira número");

/* ─── 2. o caminho caro continua lá, para quem precisa ─── */
passo("nome e CPF parcial: a listagem preservada");

/* MUTAÇÃO 4: se o atalho vazio encerrasse a busca, estas parariam de achar. */
const porNome = buscar("maria");
igual(porNome.r.length, 1, "busca por nome parcial continua achando");
igual(porNome.conta.listagens, 1,
      "e aqui a listagem acontece mesmo — é o preço de buscar por trecho",
      "Firestore não faz 'contém'; tirar isso quebraria a portaria");

const cpfParcial = buscar("5299822");
igual(cpfParcial.r.length, 1, "CPF PARCIAL continua achando");
igual(cpfParcial.r[0].nome, "MARIA APARECIDA", "  → " + cpfParcial.r[0].nome);

const porEscola = buscar("eeefm sul");
ok(porEscola.r.length >= 1, "busca por escola continua achando");

/* MUTAÇÃO 4 de novo, pelo lado do CPF: CPF completo que NÃO existe tem de
   cair na listagem, não devolver vazio. */
const cpfInexistente = buscar("99999999999");
igual(cpfInexistente.conta.listagens, 1,
      "CPF completo sem resultado cai na listagem em vez de desistir",
      "atalho que devolve vazio seria pior que atalho nenhum");

const numeroInexistente = buscar("999999");
igual(numeroInexistente.conta.listagens, 1,
      "número sem resultado também cai na listagem");

/* MUTAÇÃO 7 ─── */
passo("o teto de resultados");

const muitos = buscar("pessoa");
igual(muitos.r.length, 20,
      "a lista devolvida para no 20º",
      "sem teto, a portaria recebe 2.000 linhas num celular");

/* ─── 3. o resumo devolvido ─── */
passo("o que a portaria recebe de volta");

const campos = Object.keys(porCpf.r[0]).sort().join(",");
igual(campos, "categoria,cpf,escola,ingressoId,nome,numero,status,utilizadoEm,utilizadoPor",
      "os campos do atalho são os MESMOS da listagem",
      "se divergissem, a tela quebraria só no caminho barato — e só no dia");

const campoNome = buscar("maria").r[0];
igual(Object.keys(campoNome).sort().join(","), campos,
      "e a listagem devolve exatamente o mesmo formato");

resumo();
