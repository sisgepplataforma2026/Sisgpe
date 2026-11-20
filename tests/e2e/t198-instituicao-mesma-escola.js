/**
 * TESTE — A INSTITUIÇÃO DE ENSINO NÃO SE DIGITA DUAS VEZES
 *
 * "Instituição onde estuda deveria estar aqui?" e, depois da resposta,
 * "Mas sim automatize" — você, 24/09/2026.
 *
 * A RESPOSTA À PERGUNTA É NÃO, no caso geral, e o teste guarda isso: onde a
 * pessoa TRABALHA e onde ela ESTUDA são empresas diferentes. O formulário as
 * separou de propósito — antes havia um campo só, e por isso a cópia do
 * certificado não chegava na faculdade certa. O campo "Escola / Empregador"
 * entra no texto do documento ("empregado da instituição X, inscrita no CNPJ
 * nº…"); o campo "Instituição de ensino" é o ENDEREÇO PARA ONDE O
 * CERTIFICADO É ENVIADO (VoucherEnvio.gs:127). Preencher um com o outro
 * automaticamente mandaria o documento para o lugar errado.
 *
 * MAS HÁ UM CASO EM QUE SÃO A MESMA, e num sindicato de educação ele não é
 * raro: quem dá aula na faculdade e faz curso nessa mesma faculdade. Para
 * esse caso existe o botão — que COPIA e mostra de onde veio, em vez de
 * preencher em silêncio (REGRA Nº 0.6).
 *
 * O QUE ESTE TESTE NÃO PROVA: a aparência do botão. jsdom não desenha.
 */
const b = require("./base");
const dom = require("./dom");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* ─── a escola tem e-mail no cadastro; é dele que o botão vai viver ─── */
let shE = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
shE.clear();
shE.getRange(1, 1, 1, 7).setValues([[
  "EscolaID", "Escola (Razão Social)", "NOME_FANTASIA", "CNPJ",
  "E-mail (principal)", "Cidade", "UF"
]]);
shE.getRange(2, 1, 2, 7).setValues([
  ["ESC-0517", "SOCIEDADE EDUCACAO E GESTAO DE EXCELENCIA S.A.", "UVV",
   "37745762000127", "rh@uvv.br", "Vila Velha", "ES"],
  /* A segunda existe SEM e-mail, de propósito: é o caso em que copiar não
     basta, e o sistema precisa dizer isso em vez de fingir sucesso. */
  ["ESC-0999", "COLEGIO SEM CONTATO LTDA", "", "11222333000181", "", "Serra", "ES"]
]);
g.invalidarCacheEscolas_();

b.fluxo("BOLSAS · O e-mail da escola chega na tela");

/* ══════════════════════════════════════════════════════════════════
   PARTE 1 — O BACKEND ENTREGA O QUE O BOTÃO PRECISA
   ══════════════════════════════════════════════════════════════════ */
const achada = g.voucherBuscarEscola("SOCIEDADE EDUCACAO", TOKEN);
const uvv = (achada.escolas || [])[0] || {};
b.igual(uvv.nome, "SOCIEDADE EDUCACAO E GESTAO DE EXCELENCIA S.A.", "a escola é achada");
b.igual(uvv.cnpj, "37745762000127", "com o CNPJ");
b.igual(uvv.email, "rh@uvv.br",
  "e com o E-MAIL — que a tela não mostra, mas o botão de copiar precisa");

const semEmail = (g.voucherBuscarEscola("SEM CONTATO", TOKEN).escolas || [])[0] || {};
b.igual(semEmail.email, "", "escola sem e-mail no cadastro devolve vazio, não 'undefined'");

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("o botão na tela", "jsdom não instalado (npm i)");
  b.resumo();
  return;
}

(async function () {
  const tela = dom.montar(g, ["Scripts_Certificado.html"], { token: TOKEN });
  if (tela.win.initCertificadoAdmin) tela.win.initCertificadoAdmin();
  await tela.assentar(80);
  const doc = tela.doc;

  /* ABRIR PELO BOTÃO, como quem atende abre. Não é detalhe: `cert_msg` só
   * manda o aviso pelo toast quando há modal ABERTO — com o overlay fechado,
   * a mensagem iria para uma caixa coberta e ninguém veria. Montar o estado
   * na mão esconderia justamente isso. */
  tela.clicar("#certBtnNova");
  await tela.assentar(80);
  b.ok(doc.getElementById("certNovaOverlay").classList.contains("ativo"),
    "o modal de nova solicita\u00e7\u00e3o abriu");

  async function escolherEscola(termo) {
    tela.digitar("#certNvEscola", termo);
    await tela.assentar(700);
    tela.clicar(".cert-nv-item");
    await tela.assentar(80);
  }

  /* ══════════════════════════════════════════════════════════════════
     PARTE 2 — O BOTÃO SÓ EXISTE QUANDO TEM O QUE COPIAR
     ══════════════════════════════════════════════════════════════════ */
  b.fluxo("BOLSAS · O botão 'mesma da escola' aparece quando faz sentido");

  const btn = doc.getElementById("certNvMesmaEscola");
  b.ok(!!btn, "o botão existe no formulário");
  b.igual(btn.style.display, "none",
    "e começa ESCONDIDO — sem escola escolhida não há o que copiar, e botão que não faz nada promete");

  await escolherEscola("SOCIEDADE EDUCACAO");
  b.igual(doc.getElementById("certNvEscola").value,
    "SOCIEDADE EDUCACAO E GESTAO DE EXCELENCIA S.A.", "a escola foi escolhida");
  b.igual(btn.style.display, "", "escolhida a escola, o botão aparece");

  /* ══════════════════════════════════════════════════════════════════
     PARTE 3 — COPIAR, COM A ORIGEM À VISTA
     ══════════════════════════════════════════════════════════════════ */
  b.fluxo("BOLSAS · Copiar a escola para a instituição de ensino");

  b.igual(doc.getElementById("certNvInstituicao").value, "",
    "antes do clique, a instituição está vazia — e é assim que tem de ser: o sistema não sabe onde o filho estuda");

  tela.clicar("#certNvMesmaEscola");
  await tela.assentar(80);

  b.igual(doc.getElementById("certNvInstituicao").value,
    "SOCIEDADE EDUCACAO E GESTAO DE EXCELENCIA S.A.", "o nome foi copiado");
  b.igual(doc.getElementById("certNvCnpjInst").value, "37745762000127",
    "o CNPJ foi junto");
  b.igual(doc.getElementById("certNvEmailInst").value, "rh@uvv.br",
    "e o e-mail também — é ele que decide se o certificado chega");

  /* ORIGEM À VISTA. Campo preenchido sem dizer de onde veio passa por
     conferido, e é isso que vira erro que ninguém percebe. */
  const org = doc.getElementById("certNvOrgInst").textContent;
  b.ok(org.indexOf("copiado da escola") > -1,
    "a etiqueta diz que veio da escola, para não passar por conferido", org.trim());
  b.ok(doc.getElementById("certNvOrgEmailInst").textContent.indexOf("copiado da escola") > -1,
    "e o e-mail também carrega a etiqueta");

  /* COPIAR NÃO AMARRA: o que foi copiado continua editável. */
  tela.digitar("#certNvInstituicao", "OUTRA FACULDADE QUALQUER");
  b.igual(doc.getElementById("certNvInstituicao").value, "OUTRA FACULDADE QUALQUER",
    "o campo copiado continua editável — o botão sugere, não impõe");

  /* ══════════════════════════════════════════════════════════════════
     PARTE 4 — ESCOLA SEM E-MAIL NÃO PODE PASSAR POR SUCESSO
     ══════════════════════════════════════════════════════════════════ */
  b.fluxo("BOLSAS · Escola sem e-mail avisa em vez de fingir que deu certo");

  /* Reabrir pelo botão é o que limpa o formulário (nvAbrir chama nvLimpar) —
     e é o caminho real entre um atendimento e o seguinte. */
  tela.clicar("#certBtnNova");
  await tela.assentar(80);
  b.igual(doc.getElementById("certNvEmailInst").value, "",
    "limpar o formulário limpa a instituição junto");
  b.igual(btn.style.display, "none",
    "e o botão volta a sumir — senão o próximo atendimento copiaria a escola do associado anterior");

  await escolherEscola("SEM CONTATO");
  tela.clicar("#certNvMesmaEscola");
  await tela.assentar(80);

  b.igual(doc.getElementById("certNvInstituicao").value, "COLEGIO SEM CONTATO LTDA",
    "nome copiado mesmo sem e-mail");
  b.igual(doc.getElementById("certNvEmailInst").value, "",
    "e-mail continua vazio, porque o cadastro não tem");
  b.igual(doc.getElementById("certNvOrgEmailInst").textContent.trim(), "",
    "e NÃO leva etiqueta de origem — não veio de lugar nenhum");
  const avisos = (tela.avisos || []).map(function (a) { return String(a && a.msg || a); }).join(" | ");
  b.ok(/não tem e-mail|nao tem e-mail/i.test(avisos),
    "quem atende é avisado de que falta o e-mail para o certificado chegar",
    avisos.slice(0, 120));

  /* ══════════════════════════════════════════════════════════════════
     PARTE 5 — A SUGESTÃO DE INSTITUIÇÃO, COM O CNPJ AO LADO
     ══════════════════════════════════════════════════════════════════ */
  b.fluxo("BOLSAS · A memória de instituições mostra o CNPJ como a de escolas");

  /* A memória guarda instituições já usadas. Duas com nome quase igual e
     CNPJ diferente é o caso da UCL, que apareceu no seu print da busca de
     escola: /0001 e /0005. */
  g.voucherInstLembrar_({ nome: "UCL ENSINO SUPERIOR UNIFICADO CENTRO LESTE", cnpj: "02598162000107", email: "a@ucl.br" });
  g.voucherInstLembrar_({ nome: "UCL ENSINO SUPERIOR UNIFICADO CENTRO LESTE LTDA", cnpj: "02598162000522", email: "b@ucl.br" });

  const sug = g.voucherInstituicoesSugerir("", TOKEN);
  if (!sug.ok || !(sug.instituicoes || []).length) {
    b.naoTestavel("a lista de instituições desenhada",
      "a memória de instituições está vazia neste ambiente — a montagem do item é a mesma da escola, coberta no t197");
  } else {
    tela.digitar("#certNvInstituicao", "UCL");
    await tela.assentar(700);
    const htmlInst = doc.getElementById("certNvListaInst").innerHTML;
    b.ok(htmlInst.indexOf("cert-nv-item-nome") > -1 && htmlInst.indexOf("cert-nv-item-cnpj") > -1,
      "a sugestão de instituição usa o MESMO item da escola: nome à esquerda, CNPJ à direita");
    b.ok(/usada \d+x/.test(htmlInst),
      "e a segunda linha guarda o que esta lista tem de diferente: quantas vezes já foi usada");
    /* O CASO DA UCL, que você viu no print da busca de escola: dois
       estabelecimentos com nome quase igual, separados só pelo número. Com o
       CNPJ espremido na segunda linha eles eram indistinguíveis. */
    b.ok(htmlInst.indexOf("02.598.162/0001-07") > -1 && htmlInst.indexOf("02.598.162/0005-22") > -1,
      "matriz e filial de mesmo nome aparecem com os CNPJs pontuados ao lado do nome");
  }

  b.resumo();
})();
