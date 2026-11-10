/**
 * OFTALMO · FORA DA TELA, NADA APAGADO (10/11/2026).
 * O usuário: "tudo que for de oftalmo no sistema pode retirar (não terá mais
 * esse serviço)" e, em seguida, "cuidado para não tirar qualquer coisa, ele só
 * não aparece na tela". Este teste trava as duas metades:
 *   1. nenhuma tela mostra o Oftalmo (menu, card, portal do associado,
 *      atalho de Despesas, seletor de link de interesse);
 *   2. o código e as rotas continuam no projeto (REGRA 1).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const RAIZ = path.join(__dirname, "..", "..");
const ler = f => fs.readFileSync(path.join(RAIZ, f), "utf8");

b.fluxo("OFTALMO · fora da tela");
const index = ler("index.html");
b.passo("1. O menu de Benefícios não tem mais o botão do exame oftalmológico");
b.ok(!/data-benef-sub="agendaOftalmo"/.test(index), "sem botão no menu");
b.passo("2. O painel de Benefícios não tem mais o card do exame oftalmológico");
b.ok(!/<h4>Exame oftalmológico<\/h4>/.test(index), "sem card");
b.passo("3. O Portal do Associado não mostra o card Oftalmo");
b.ok(!/onclick="mostrarOftalmo\(\)"/.test(ler("PortalAssociado.html")), "sem card no portal");
b.passo("4. Despesas não oferece o atalho 'Agenda de Oftalmo'");
b.ok(!/sisgepAplicarBeneficioRapido\(\\'Agenda de Oftalmo\\'\)/.test(ler("DespesasAdmin.html")), "sem atalho");
b.passo("5. A prévia do portal (Portalassociado.gs) não mostra 'Agenda Oftalmo'");
b.ok(!/Agenda Oftalmo/.test(ler("Portalassociado.gs")), "sem item na prévia");

const { g } = b.subir({}); b.seedUsuarios(g); const T = b.logar(g, "wanderson");
b.passo("6. O seletor de link de interesse não lista o Oftalmo");
const lista = g.beneficiosListarLinksInteresse(T);
const chaves = (lista.itens || []).map(i => i.chave);
b.ok(lista.ok && chaves.indexOf("oftalmo") === -1 && chaves.indexOf("voucher") > -1, "fora do seletor", chaves.join(", "));

b.fluxo("OFTALMO · nada apagado");
b.passo("7. Os quatro arquivos do Oftalmo continuam no projeto");
["AgendOftalm.gs", "AgendOftalmo.html", "AgendaOftalmoPublica.html", "Scripts_AgendOftalmo.html"].forEach(f =>
  b.ok(fs.existsSync(path.join(RAIZ, f)), f + " existe"));
b.passo("8. A tela e a rota pública continuam ligadas (só não aparecem)");
b.ok(/include\('AgendOftalmo'\)/.test(index) && /include\('Scripts_AgendOftalmo'\)/.test(index), "includes mantidos");
b.ok(/p\.portal === "oftalmo"/.test(ler("Code.gs")), "rota ?portal=oftalmo mantida");
b.ok(typeof g.buscarAgendamentosOftalmo === "function" && typeof g.reservarHorarioOftalmo === "function" && typeof g.buscarAssociadosOftalmo === "function", "funções do servidor carregadas");
b.passo("9. A definição do link continua, marcada como oculta");
b.ok(g.BENEF_LINKS && g.BENEF_LINKS.oftalmo && g.BENEF_LINKS.oftalmo.oculto === true, "BENEF_LINKS.oftalmo.oculto");
b.resumo();
