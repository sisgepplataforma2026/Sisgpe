/**
 * TESTE — A TELA DE NOVA SOLICITAÇÃO
 *
 * É a tela onde a memória se encontra com quem digita. O que ela tem que
 * provar, em ordem de importância:
 *
 *   1. Que digitar o CPF do Marcelo traz a história dele preenchida —
 *      o exemplo que o usuário deu, ponta a ponta, no DOM.
 *   2. Que o que a pessoa JÁ DIGITOU nunca é sobrescrito pela memória.
 *      Memória preenche o vazio; não corrige quem está digitando.
 *   3. Que a origem de cada campo preenchido aparece na tela. Campo cheio
 *      sem dizer de onde veio passa impressão de conferido.
 *   4. Que "Salvar e aprovar" grava APROVADO e "Salvar em análise" grava
 *      ANALISE — e que a memória aprende só com o aprovado.
 */
const b = require("./base");
const dom = require("./dom");

if (!dom.jsdomDisponivel()) {
  b.fluxo("VOUCHER · Tela de nova solicitação");
  b.naoTestavel("tela de nova solicitação", "jsdom não instalado");
  b.resumo(); process.exit(0);
}

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
g.setupVoucherModuleFase1();

const CPF_M = "11144477735";

/* Marcelo já pediu uma vez: Multivix, Administração, Humanas, 70%. */
g.voucherCriarSolicitacao({
  cpf: CPF_M, nome: "Marcelo Alves de Oliveira", email: "marcelo@exemplo.com",
  telefone: "(27) 99111-2233", escola: "COLEGIO SAO JOSE",
  instituicao: "MULTIVIX", cnpjInstituicao: "31344800000100",
  emailInstituicao: "bolsas@multivix.edu.br",
  modalidade: "GRADUACAO", area: "HUMANAS", curso: "Administracao",
  percentual: 70, periodo: "2026/1", aprovar: true
}, TOKEN);

/* A base de associados, para a busca por nome funcionar. */
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.clear();
shA.getRange(1, 1, 1, 4).setValues([["Nome", "CPF", "E-mail", "Telefone"]]);
shA.getRange(2, 1, 1, 4).setValues([["Marcelo Alves de Oliveira", CPF_M, "marcelo@exemplo.com", "(27) 99111-2233"]]);

const t = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
const win = t.win, doc = t.doc;
function el(id) { return doc.getElementById(id); }

(async function () {
  win.initCertificadoAdmin();
  await t.assentar(60);

  b.fluxo("NOVA SOLICITAÇÃO · A tela existe e abre");

  b.passo("1. Os elementos do formulário existem");
  ["certBtnNova","certNovaOverlay","certNvCpf","certNvNome","certNvModalidade",
   "certNvArea","certNvCurso","certNvPercentual","certNvInstituicao",
   "certNvSalvarAnalise","certNvSalvarAprovar","certNvOrgPct"].forEach(function (id) {
    b.ok(!!el(id), "existe #" + id);
  });

  b.passo("2. O botão abre o modal");
  t.clicar("#certBtnNova");
  await t.assentar(30);
  b.ok(el("certNovaOverlay").classList.contains("ativo"), "modal aberto");

  b.fluxo("NOVA SOLICITAÇÃO · O caso do Marcelo, na tela");

  b.passo("3. Buscar pelo nome acha o associado");
  t.digitar("#certNvBusca", "Marcelo");
  await t.assentar(420);
  const itens = doc.querySelectorAll("#certNvListaAssoc .cert-nv-item");
  b.ok(itens.length > 0, "a lista de sugestões apareceu", itens.length + " item(ns)");
  b.ok(/\*/.test(doc.querySelector("#certNvListaAssoc small").textContent),
    "e o CPF sai MASCARADO na lista de busca",
    doc.querySelector("#certNvListaAssoc small").textContent);

  b.passo("4. Escolher o associado traz a HISTÓRIA dele preenchida");
  t.clicar(itens[0]);
  await t.assentar(220);
  b.igual(el("certNvCpf").value, CPF_M, "CPF preenchido");
  b.igual(el("certNvNome").value, "Marcelo Alves de Oliveira", "nome");
  b.igual(el("certNvInstituicao").value, "MULTIVIX", "a faculdade dele volta");
  b.igual(el("certNvCnpjInst").value, "31344800000100", "com o CNPJ");
  b.igual(el("certNvEmailInst").value, "bolsas@multivix.edu.br", "e o e-mail da instituição");
  b.igual(el("certNvCurso").value, "Administracao", "o curso");
  b.igual(el("certNvModalidade").value, "GRADUACAO", "a modalidade");
  b.igual(String(el("certNvPercentual").value), "70", "e os 70% PREENCHIDOS");

  b.passo("5. A origem do percentual aparece na tela");
  const org = (t.texto("#certNvOrgPct") || "");
  b.ok(org.length > 0, "a etiqueta de origem foi pintada", org);
  b.ok(/convenç|última|padrão/i.test(org), "e diz de onde veio", org);

  b.passo("6. Há aviso dizendo que os campos vieram do histórico");
  const avisos = t.texto("#certNvAvisos") || "";
  b.ok(/solicita/i.test(avisos), "aviso presente", avisos.slice(0, 70));

  b.fluxo("NOVA SOLICITAÇÃO · A memória não atropela quem digita");

  b.passo("7. Trocar a área recalcula o percentual pela REGRA");
  t.escolher("#certNvArea", "SAUDE");
  await t.assentar(150);
  b.igual(String(el("certNvPercentual").value), "50",
    "área Saúde traz 50%, e não os 70% do histórico");

  b.passo("8. Mestrado zera o campo e diz o motivo");
  t.escolher("#certNvModalidade", "MESTRADO");
  await t.assentar(150);
  b.igual(String(el("certNvPercentual").value), "",
    "campo em branco — a convenção não prevê");
  b.ok(/não prev|convenç/i.test(t.texto("#certNvOrgPct") || ""),
    "com a etiqueta de recusa", t.texto("#certNvOrgPct"));
  b.ok(/desconto/i.test(t.texto("#certNvAvisos") || ""),
    "e o motivo escrito", (t.texto("#certNvAvisos") || "").slice(0, 70));

  b.passo("9. O que a pessoa digitou NÃO é sobrescrito");
  /* Memória preenche o vazio; não corrige quem está digitando. */
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "HUMANAS");
  el("certNvCurso").value = "Curso Digitado À Mão";
  t.digitar("#certNvEmail", "outro@exemplo.com");
  await t.assentar(180);
  b.igual(el("certNvCurso").value, "Curso Digitado À Mão", "o curso digitado permanece");
  b.igual(el("certNvEmail").value, "outro@exemplo.com", "e o e-mail digitado também");


  b.passo("9b. Sugestão atrasada de outra digitação é descartada");
  /* Quem digita depressa dispara várias sugestões. Sem sequência, a resposta
   * de "Saúde" chega depois da de "Humanas" e sobrescreve o campo com 50%
   * quando a tela já mostra Humanas — o percentual passa a contradizer a
   * área escolhida, e é ele que vai para a planilha. */
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "SAUDE");
  await t.assentar(180);
  b.igual(String(el("certNvPercentual").value), "50", "partindo de Saúde, 50%");

  const idxCorrida = t.chamadas.length;
  t.atrasar("voucherSugerirSolicitacao", idxCorrida, 200);   // Saúde vai demorar
  t.escolher("#certNvArea", "SAUDE");
  await t.assentar(15);
  t.escolher("#certNvArea", "HUMANAS");                      // Humanas chega antes
  await t.assentar(320);                                     // Saúde chega atrasada
  b.igual(String(el("certNvPercentual").value), "70",
    "o campo mostra os 70% de Humanas, e não os 50% da resposta atrasada");

  b.fluxo("NOVA SOLICITAÇÃO · Gravar");

  b.passo("10. Sem CPF válido, a tela barra antes de ir ao servidor");
  el("certNvCpf").value = "123";
  const antes = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length;
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(80);
  b.igual(t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").length, antes,
    "nenhuma chamada saiu");

  b.passo("11. Salvar em análise grava ANALISE");
  el("certNvCpf").value = CPF_M;
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "HUMANAS");
  await t.assentar(150);
  t.clicar("#certNvSalvarAnalise");
  await t.assentar(200);
  const cAnalise = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop();
  b.ok(!!cAnalise, "chamou o backend");
  b.igual(cAnalise && cAnalise.args[0].aprovar, false, "com aprovar = false");
  b.ok(cAnalise && cAnalise.args[1] === TOKEN, "e com o token");

  b.passo("12. Salvar e aprovar grava APROVADO");
  t.clicar("#certBtnNova");
  await t.assentar(40);
  el("certNvCpf").value = CPF_M;
  el("certNvNome").value = "Marcelo Alves de Oliveira";
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "HUMANAS");
  el("certNvCurso").value = "Administracao";
  await t.assentar(150);
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(250);
  const cAprov = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop();
  b.igual(cAprov && cAprov.args[0].aprovar, true, "com aprovar = true");
  b.ok(!el("certNovaOverlay").classList.contains("ativo"), "e o modal fechou");

  b.passo("13. A solicitação chegou mesmo na planilha");
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(x=>String(x||"").trim());
  const ult = sh.getRange(sh.getLastRow(),1,1,sh.getLastColumn()).getValues()[0];
  function v(n){ const i=cab.indexOf(n); return i===-1?"":ult[i]; }
  b.igual(String(v("STATUS_SOLICITACAO")), "APROVADO", "status APROVADO");
  b.igual(String(v("CANAL_ENTRADA")), "EMAIL", "canal EMAIL, não PORTAL");
  b.ok(!!String(v("USUARIO_VALIDACAO")), "com o aprovador gravado", String(v("USUARIO_VALIDACAO")));
  b.ok(!!String(v("NUMERO_PROTOCOLO")), "e com protocolo", String(v("NUMERO_PROTOCOLO")));


  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("NOVA SOLICITAÇÃO · O CSS alcança o modal novo");

  b.passo("14. Toda classe compartilhada tem regra para ESTE modal");
  /* POR QUE ESTE PASSO EXISTE
   *
   * A tela foi entregue com 44 asserções verdes e o modal SEM ESTILO: título
   * ilegível, seções invisíveis, botão de fechar quebrado. As duas coisas
   * conviviam sem se contradizer porque jsdom não desenha — o teste prova a
   * LÓGICA da tela, nunca o desenho.
   *
   * A causa foi textual, e é essa que dá para pegar aqui: as regras
   * `.cert-modal-head`, `.cert-section-title` e companhia estão escritas
   * ESCOPADAS por id — `#certModalBox .cert-modal-head`. Ao criar o modal de
   * envio eu acrescentei `#certEnvioBox` à lista; ao criar o de solicitação,
   * esqueci. As classes estavam no HTML e a regra não alcançava nenhuma.
   *
   * Aparência não se testa sem navegador. Mas "existe regra de CSS cujo
   * seletor casa com este id" é propriedade de texto — e é exatamente o que
   * faltava. */
  const fonte = require("fs").readFileSync(dom.RAIZ + "/Scripts_Certificado.html", "utf8");

  const CAIXAS = ["certModalBox", "certEnvioBox", "certNovaBox"];
  const problemas = [];

  CAIXAS.forEach(function (caixa) {
    const box = doc.getElementById(caixa);
    if (!box) { problemas.push(caixa + " não existe no HTML"); return; }

    /* As classes que o modal usa de fato, lidas do DOM montado. */
    const usadas = new Set();
    box.querySelectorAll("[class]").forEach(function (el) {
      String(el.getAttribute("class") || "").split(/\s+/).forEach(function (c) {
        if (c.indexOf("cert-modal") === 0 || c.indexOf("cert-section") === 0 ||
            c.indexOf("cert-info") === 0 || c.indexOf("cert-obs") === 0) usadas.add(c);
      });
    });

    usadas.forEach(function (classe) {
      /* A classe só precisa de escopo se ela é DECLARADA escopada por algum
       * #cert...Box. Classe global (como .cert-btn) alcança todo mundo. */
      /* `\\b` NÃO SERVE AQUI, e foi o que fez a mutação sobreviver na
       * primeira rodada: entre "head" e "-l" existe fronteira de palavra,
       * então procurar `.cert-modal-head\\b` casava dentro de
       * `.cert-modal-head-l`. Tirar a regra de `.cert-modal-head` não
       * derrubava nada, porque a da variante ainda estava lá.
       * O fim da classe tem que ser um caractere que não pode compor nome
       * de classe. */
      const fim = "(?![A-Za-z0-9_-])";
      const escopada = new RegExp("#cert\\w*Box\\s+\\." + classe + fim).test(fonte);
      if (!escopada) return;
      const alcanca = new RegExp("#" + caixa + "\\s+\\." + classe + fim).test(fonte);
      if (!alcanca) problemas.push(caixa + " usa ." + classe + " e não há regra para ele");
    });
  });

  b.ok(problemas.length === 0,
    "nenhuma classe fica sem regra em nenhum dos três modais",
    problemas.length ? problemas.slice(0, 4).join(" · ") : "");

  b.resumo();
  process.exit(0);
})();
