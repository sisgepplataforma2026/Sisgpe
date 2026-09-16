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
  b.resumo(); process.exit(process.exitCode || 0);
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


  b.passo("3b. Buscar pelo CPF COM o zero à esquerda acha o associado");
  /* A base guarda o CPF como NÚMERO, e número não tem zero à esquerda —
   * o mesmo defeito que fez o certificado sair com "8538104780" cru. Quem
   * digita o CPF completo, como está no documento da pessoa, não achava
   * ninguém e concluía que o associado não estava cadastrado. */
  t.digitar("#certNvBusca", "011144477735".slice(1));   // 11144477735, como guardado
  await t.assentar(420);
  b.ok(doc.querySelectorAll("#certNvListaAssoc .cert-nv-item").length > 0,
    "acha digitando como está guardado");

  t.digitar("#certNvBusca", "0" + "8538104780");        // 11 dígitos, com zero
  await t.assentar(420);
  const semZero = ss.getSheetByName("Associados");
  semZero.getRange(3, 1, 1, 4).setValues([["Zero A Esquerda", "8538104780", "z@x.com", ""]]);
  t.digitar("#certNvBusca", "08538104780");
  await t.assentar(420);
  const achou = doc.querySelectorAll("#certNvListaAssoc .cert-nv-item");
  b.ok(achou.length > 0,
    "e acha o CPF guardado com 10 dígitos quando se digita os 11",
    achou.length + " resultado(s)");

  b.passo("3c. As máscaras de CPF e telefone existem no Utils");
  /* Do Helpers.html, uma só para o sistema inteiro — não reimplementada
   * aqui. Telefone gravado em três formatos quebra a busca depois. */
  const helpers = require("fs").readFileSync(dom.RAIZ + "/Helpers.html", "utf8");
  b.ok(/aplicarMascaraCPF\s*:/.test(helpers), "Utils.aplicarMascaraCPF existe");
  b.ok(/aplicarMascaraTelefone\s*:/.test(helpers), "Utils.aplicarMascaraTelefone existe");
  const tela = require("fs").readFileSync(dom.RAIZ + "/Scripts_Certificado.html", "utf8");
  b.ok(/Utils\[par\[1\]\]\(this\)/.test(tela) && /aplicarMascaraTelefone/.test(tela),
    "e a tela usa as do Utils, sem reimplementar");

  t.digitar("#certNvBusca", "Marcelo");
  await t.assentar(420);

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


  b.passo("4b. A escola vem da base das 679, não de texto livre");
  /* O campo era um input solto. Nome digitado à mão não casa com nada
   * depois, e o escolaId — que a Fase 4 usa para amarrar a solicitação à
   * escola de verdade — nunca seria preenchido. */
  const shEsc = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
  shEsc.clear();
  shEsc.getRange(1, 1, 1, 5).setValues([["Escola (Razão Social)", "CNPJ", "Cidade", "UF", "EscolaID"]]);
  shEsc.getRange(2, 1, 1, 5).setValues([["COLEGIO SAO JOSE LTDA", "13004995000100", "VITORIA", "ES", "ESC-000042"]]);

  t.digitar("#certNvEscola", "sao jose");
  await t.assentar(450);
  const itensEsc = doc.querySelectorAll("#certNvListaEscola .cert-nv-item");
  b.ok(itensEsc.length > 0, "a busca de escola devolveu resultado", itensEsc.length + " item(ns)");

  if (itensEsc.length) {
    t.clicar(itensEsc[0]);
    await t.assentar(120);
    b.igual(el("certNvEscola").value, "COLEGIO SAO JOSE LTDA", "nome preenchido");
    b.igual(el("certNvCnpjEscola").value, "13004995000100", "CNPJ preenchido junto");
    b.igual(el("certNvEscola").getAttribute("data-escola-id"), "ESC-000042",
      "e o escolaId viaja no elemento, para a Fase 4");
    b.ok(/ESC-000042/.test(t.texto("#certNvOrgEscola") || ""),
      "com o id à vista de quem digita", t.texto("#certNvOrgEscola"));
  }

  b.passo("4c. Digitar de novo solta o escolaId anterior");
  /* Deixá-lo grudado amarraria a solicitação a uma escola que a pessoa
   * acabou de trocar — e ninguém veria, porque o id não aparece no campo. */
  t.digitar("#certNvEscola", "outra coisa");
  await t.assentar(40);
  b.ok(!el("certNvEscola").getAttribute("data-escola-id"),
    "o id foi solto ao redigitar");

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
  /* JANELA LIVRE, e não a do seed. Período obrigatório desde 13/08/2026; e
     desde a regra de "uma por pessoa por período" (mesmo dia), o Marcelo do
     seed já ocupa 2026/1. A tela passou a barrar antes de chamar o backend —
     comportamento certo, teste desatualizado. Cada passo daqui usa a sua
     própria janela, senão um passo derruba o seguinte. */
  t.escolher("#certNvPeriodoAno", String(new Date().getFullYear() + 1));
  t.escolher("#certNvPeriodoSem", "1");
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
  /* O ANO DO PERÍODO passou a ser obrigatório em 13/08/2026 — na tela e no
     backend. Sem ele o modal não fecha, e é isso que o usuário viu na
     produção ao contrário: solicitação gravada SEM período, com a trava de
     duplicidade sem janela para comparar. */
  t.escolher("#certNvPeriodoAno", String(new Date().getFullYear() + 1));
  t.escolher("#certNvPeriodoSem", "2");
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



  b.passo("13b. Marcar 'não associado' MANTÉM o percentual e avisa do canal");
  /* ESTE PASSO EXIGIA O CONTRÁRIO — campo zerado — até 14/08/2026, quando o
   * usuário corrigiu a regra: todos têm o mesmo benefício, o não associado é
   * que solicita em papel e retira presencialmente.
   *
   * A asserção que importa aqui é a do AVISO, não a do número. O percentual
   * continuar em 70 é o comportamento novo; mas se o aviso do canal sumir,
   * a tela fica idêntica à do associado e a atendente não tem como saber que
   * aquele voucher não vai por e-mail. É por isso que o número e o aviso são
   * verificados juntos: um sem o outro é meio caminho. */
  t.clicar("#certBtnNova");
  await t.assentar(40);
  el("certNvCpf").value = CPF_M;
  el("certNvNome").value = "Marcelo Alves de Oliveira";
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "HUMANAS");
  await t.assentar(180);
  b.igual(String(el("certNvPercentual").value), "70", "associado: 70%");
  b.ok(!/presencial/i.test(t.texto("#certNvAvisos") || ""),
    "e nenhum aviso de presencial para ele");

  t.escolher("#certNvSituacao", "NAO_ASSOCIADO");
  await t.assentar(180);
  b.igual(String(el("certNvPercentual").value), "70",
    "não associado: MESMO percentual, o benefício não muda");
  b.ok(/presencial/i.test(t.texto("#certNvAvisos") || ""),
    "e a tela avisa que é papel e retirada presencial",
    (t.texto("#certNvAvisos") || "").slice(0, 90));


  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("NOVA SOLICITAÇÃO · Quem é o beneficiário decide o que aparece");

  b.passo("15. Com 'Próprio', os campos de dependente ficam escondidos");
  /* Campo vazio na tela é campo que alguém tenta preencher. Nome, idade e
   * declaração de IR não têm o que dizer quando o beneficiário é o próprio
   * associado. */
  t.clicar("#certBtnNova");
  await t.assentar(40);
  b.igual(el("certNvQuem").value, "PROPRIO", "abre em 'Próprio'");
  b.igual(el("certNvBoxNome").style.display, "none", "nome do beneficiário escondido");
  b.igual(el("certNvBoxIdade").style.display, "none", "idade escondida");
  b.igual(el("certNvBoxIR").style.display, "none", "declaração de IR escondida");

  b.passo("16. Escolher '2º filho' revela nome e idade, e deduz a ordem");
  t.escolher("#certNvQuem", "FILHO_2");
  await t.assentar(120);
  b.ok(el("certNvBoxNome").style.display !== "none", "nome aparece");
  b.ok(el("certNvBoxIdade").style.display !== "none", "idade aparece");
  b.igual(el("certNvBoxIR").style.display, "none", "IR continua escondida (é filho, não enteado)");

  el("certNvCpf").value = CPF_M;
  el("certNvNome").value = "Marcelo Alves de Oliveira";
  el("certNvBeneficiario").value = "Pedro";
  el("certNvIdade").value = "8";
  t.escolher("#certNvModalidade", "ENSINO_FUNDAMENTAL");
  await t.assentar(180);
  b.igual(String(el("certNvPercentual").value), "100",
    "2º filho do fundamental: 100% pela regra da convenção");

  b.passo("17. '3º filho' muda o percentual sem ninguém digitar a ordem");
  /* A ordem sai do seletor. Pedir três vezes a mesma coisa — beneficiário,
   * parentesco e ordem — era convite a contradição: a tela antiga permitia
   * "filho 2" com parentesco "Cônjuge". */
  t.escolher("#certNvQuem", "FILHO_3");
  await t.assentar(180);
  b.igual(String(el("certNvPercentual").value), "60", "3º filho: 60%");

  b.passo("18. 'Enteado' pede a declaração de IR");
  t.escolher("#certNvQuem", "ENTEADO");
  await t.assentar(120);
  b.ok(el("certNvBoxIR").style.display !== "none", "campo do IR aparece");
  b.ok(el("certNvBoxIdade").style.display !== "none", "e a idade também");

  b.passo("19. Voltar para 'Próprio' LIMPA o que ficou escondido");
  /* Campo invisível com valor dentro é o pior dos dois mundos: ninguém vê e
   * mesmo assim vai para a planilha. */
  t.escolher("#certNvQuem", "PROPRIO");
  await t.assentar(120);
  b.igual(el("certNvBeneficiario").value, "", "nome do beneficiário foi limpo");
  b.igual(el("certNvIdade").value, "", "idade foi limpa");

  b.passo("20. E o titular vira o beneficiário na gravação");
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "HUMANAS");
  await t.assentar(180);
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(250);
  const cProprio = t.chamadas.filter(c => c.fn === "voucherCriarSolicitacao").pop();
  b.igual(cProprio && cProprio.args[0].tipoBeneficiario, "TITULAR", "tipo TITULAR");
  b.igual(cProprio && cProprio.args[0].ordemFilho, "", "sem ordem de filho");
  b.igual(cProprio && cProprio.args[0].beneficiario, "Marcelo Alves de Oliveira",
    "e o beneficiário é o próprio titular");


  b.passo("21. Regime é seletor, e a regra da convenção o preenche");
  /* Só existem dois — anual e semestral — e é o regime que define de quanto
   * em quanto tempo o associado volta a pedir. Digitado à mão viraria
   * "Anual", "ANUAL" e "1 ano" na mesma coluna, e qualquer contagem de
   * renovação por regime pararia de fechar. */
  b.igual(String(el("certNvRegime").tagName).toUpperCase(), "SELECT",
    "o campo é um seletor, não texto livre");
  const ops = Array.prototype.map.call(el("certNvRegime").options, o => o.value).filter(Boolean);
  b.igual(ops.sort(), ["ANUAL", "SEMESTRAL"], "com as duas opções que existem");

  t.clicar("#certBtnNova");
  await t.assentar(40);
  el("certNvCpf").value = CPF_M;
  el("certNvNome").value = "Marcelo Alves de Oliveira";
  t.escolher("#certNvModalidade", "GRADUACAO");
  t.escolher("#certNvArea", "HUMANAS");
  await t.assentar(200);
  b.igual(el("certNvRegime").value, "SEMESTRAL",
    "graduação vem SEMESTRAL pela convenção");

  t.escolher("#certNvModalidade", "ENSINO_MEDIO");
  t.escolher("#certNvQuem", "FILHO_1");
  el("certNvIdade").value = "16";
  t.escolher("#certNvArea", "");
  await t.assentar(220);
  b.igual(el("certNvRegime").value, "ANUAL", "ensino médio vem ANUAL");

  b.passo("22. Idade: 24 passa, 25 não");
  /* O código dizia `>= 24` e a mensagem ao lado dizia "até 24 anos" — uma
   * negando a outra. Um dependente de 24 era recusado por erro de um ano,
   * com explicação que afirmava o contrário. */
  el("certNvIdade").value = "24";
  t.escolher("#certNvModalidade", "ENSINO_MEDIO");
  await t.assentar(220);
  b.igual(String(el("certNvPercentual").value), "100", "24 anos ainda tem direito");

  el("certNvIdade").value = "25";
  t.escolher("#certNvModalidade", "ENSINO_MEDIO");
  await t.assentar(220);
  b.igual(String(el("certNvPercentual").value), "", "25 anos: campo zerado");
  b.ok(/24 anos/.test(t.texto("#certNvAvisos") || ""),
    "com o limite escrito no aviso", (t.texto("#certNvAvisos") || "").slice(0, 70));


  /* ═══════════════════════════════════════════════════════════════════ */
  b.fluxo("APROVAR · a porta que estava trancada por dentro");

  b.passo("23. Solicitação criada em ANÁLISE pode ser aprovada");
  /* O usuário clicou em Aprovar e "não acontecia nada". Eram DOIS defeitos,
   * um escondendo o outro:
   *
   *   a) A trava exigia STATUS_VALIDACAO_SINDICAL = "VALIDADO". Solicitação
   *      criada em análise nasce PENDENTE, e o único lugar do sistema que
   *      grava VALIDADO não tem botão em tela nenhuma. O Aprovar recusava
   *      SEMPRE — porta trancada com a chave do lado de dentro.
   *   b) A recusa era escrita em #certMsgBox, que fica na área da LISTA —
   *      atrás do modal aberto. O backend respondia com um motivo claro e a
   *      tela não mostrava nada. */
  /* O `periodo` entrou aqui em 13/08/2026 e o teste ficou VERMELHO antes
   * disso — corretamente. Sem período a solicitação passava a ser recusada,
   * porque sem período a trava de "um por pessoa, por curso, por janela" não
   * tem janela para comparar e deixa a mesma pessoa passar duas vezes. O
   * teste é que estava desatualizado, não a regra nova. */
  const nova = g.voucherCriarSolicitacao({
    cpf: CPF_M, nome: "Marcelo Alves de Oliveira",
    modalidade: "GRADUACAO", area: "HUMANAS", percentual: 70,
    periodo: "2029/1", aprovar: false
  }, TOKEN);
  b.ok(nova.ok, "solicitação criada em análise", nova.protocolo || nova.mensagem);

  const aprov = g.aprovarSolicitacaoVoucher(nova.protocolo, "", TOKEN);
  b.ok(aprov && aprov.ok === true, "e o Aprovar funciona",
    String(aprov && aprov.mensagem || ""));

  b.passo("24. Aprovar É validar — grava quem e quando");
  /* Quem aprova está declarando que conferiu. Exigir um passo anterior que
   * não existe só produzia um estado do qual não se saía. */
  const shS = ss.getSheetByName("Voucher_Solicitacoes");
  const cabS = shS.getRange(1,1,1,shS.getLastColumn()).getValues()[0].map(x=>String(x||"").trim());
  let linha = null;
  const todas = shS.getRange(1,1,shS.getLastRow(),shS.getLastColumn()).getValues();
  for (let i = todas.length - 1; i >= 1; i--) {
    if (String(todas[i][cabS.indexOf("NUMERO_PROTOCOLO")]) === nova.protocolo) { linha = todas[i]; break; }
  }
  function vS(n){ const i=cabS.indexOf(n); return i===-1?"":String(linha[i]||""); }
  b.igual(vS("STATUS_SOLICITACAO"), "APROVADO", "status APROVADO");
  b.igual(vS("STATUS_VALIDACAO_SINDICAL"), "VALIDADO", "validação sindical marcada");
  b.ok(!!vS("USUARIO_VALIDACAO"), "com quem validou", vS("USUARIO_VALIDACAO"));

  b.passo("25. Não associado é APROVADO, com o presencial registrado");
  /* ESTE PASSO EXIGIA RECUSA até 14/08/2026 — era "a trava certa não foi
   * removida". A trava inteira estava errada, e o teste a defendia.
   *
   * O que ela causava, medido: o portal mandava o não associado à sede, ele
   * chegava com o papel, e o balcão recusava na aprovação e na emissão. O
   * atendimento presencial não existia na prática.
   *
   * A asserção do protocolo criado fica de pé pelo motivo de sempre: sem
   * ela, um "aprovou" sobre protocolo inexistente passaria despercebido. */
  const naoAss = g.voucherCriarSolicitacao({
    cpf: "52998224725", nome: "Nao Associado", modalidade: "GRADUACAO",
    area: "HUMANAS", situacaoSindical: "NAO_ASSOCIADO",
    periodo: "2026/2", aprovar: false
  }, TOKEN);
  b.ok(naoAss.ok, "a solicitação do não associado é criada", naoAss.protocolo || naoAss.mensagem);
  const rec = g.aprovarSolicitacaoVoucher(naoAss.protocolo, "", TOKEN);
  b.ok(rec && rec.ok === true, "aprovação ACEITA — o benefício é o mesmo", rec.mensagem);
  b.ok(!/s[óo] associado tem direito/i.test(rec.mensagem || ""),
    "e a frase da regra revogada não aparece", rec.mensagem);

  /* O rastro do canal vai para o HISTÓRICO, que é append-only — não para
   * OBSERVACOES, que a próxima ação sobrescreve. Ler o histórico é o que
   * prova que o registro sobrevive à emissão. */
  const histNA = g.SpreadsheetApp.openById(g.PLANILHA_ID)
    .getSheetByName("Voucher_Historico");
  const linhasHist = histNA ? histNA.getDataRange().getValues() : [];
  const achouPresencial = linhasHist.some(function (l) {
    return l.join(" | ").indexOf(naoAss.protocolo) > -1 &&
           /presencial/i.test(l.join(" | "));
  });
  b.ok(achouPresencial,
    "e o histórico guarda que o atendimento é presencial");

  b.passo("26. Com modal aberto, o aviso sai por toast — visível");
  t.clicar("#certBtnNova");
  await t.assentar(40);
  const antesToast = t.avisos.length;
  el("certNvCpf").value = "123";                 // inválido de propósito
  t.clicar("#certNvSalvarAprovar");
  await t.assentar(80);
  b.ok(t.avisos.length > antesToast,
    "o aviso foi para o toast, que fica acima do modal",
    t.avisos.length ? t.avisos[t.avisos.length-1].msg.slice(0, 60) : "nenhum");


  b.passo("27. Aprovar NÃO fecha o modal — a área de emissão aparece");
  /* Aprovar e emitir vêm colados. Fechar aqui obrigava a pessoa a achar a
   * mesma linha na lista e clicar no 🎓 — dois passos para continuar o que
   * ela já estava fazendo. A área de emissão já está neste modal; só ficava
   * escondida porque o status ainda não era APROVADO. */
  await t.assentar(60);
  /* Período obrigatório desde 13/08/2026 — e num período ainda livre, senão
     a trava de duplicidade recusa a criação e o resto do passo não acontece. */
  const emAnalise = g.voucherCriarSolicitacao({
    cpf: CPF_M, nome: "Marcelo Alves de Oliveira",
    modalidade: "GRADUACAO", area: "HUMANAS", percentual: 70,
    periodo: "2031/1", aprovar: false
  }, TOKEN);
  b.ok(emAnalise.ok, "a solicitação em análise foi criada",
    emAnalise.protocolo || emAnalise.mensagem);
  t.clicar("#certBtnRecarregar");
  await t.assentar(250);

  const linhaNova = doc.querySelector('.cert-btn-abrir-modal');
  if (linhaNova) {
    /* Abre pela lista, como quem opera faz. */
    win.certAbrirEnvio && null;
    const btns = doc.querySelectorAll('.cert-btn-abrir-modal');
    t.clicar(btns[0]);
    await t.assentar(120);
    b.ok(el("certModalOverlay").classList.contains("ativo"), "modal de análise aberto");

    t.clicar("#certBtnAprovar");
    await t.assentar(700);
    b.ok(el("certModalOverlay").classList.contains("ativo"),
      "continua aberto depois de aprovar");
    b.ok(el("certModalEmissaoArea").style.display !== "none",
      "e a área de emissão apareceu, pronta para gerar o certificado");
  } else {
    b.aviso("lista vazia no teste", "passo 27 não pôde rodar");
  }

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

  /* ══════════════════════════════════════════════════════════════════════
     A ESCOLA COMPLETA, e a busca aproximada

     Relatado com a tela na mão em 13/08/2026: o nome do empregador vinha da
     base de Associados, CNPJ e cidade ficavam em branco, e quem atendia
     precisava digitar a escola de novo no campo ao lado. Depois veio o
     motivo de a busca não achar: "está no nome da SEGEX UVV" — a base de
     Associados diz "UVV - VILA VELHA", o cadastro de Escolas diz outra coisa.
     ══════════════════════════════════════════════════════════════════════ */
  b.fluxo("NOVA SOLICITAÇÃO · A escola vem completa");

  const shE = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
  shE.clear();
  shE.getRange(1, 1, 1, 6).setValues([["EscolaID", "Escola (Razão Social)", "Nome Fantasia", "CNPJ", "Município", "UF"]]);
  shE.getRange(2, 1, 3, 6).setValues([
    ["ESC-000001", "SEGEX UVV LTDA", "SEGEX UVV", "12345678000199", "Vila Velha", "ES"],
    ["ESC-000002", "COLEGIO SAO JOSE", "SAO JOSE", "98765432000188", "Vitoria", "ES"],
    ["ESC-000003", "COLEGIO ANCHIETA", "ANCHIETA", "11222333000144", "Serra", "ES"]
  ]);
  /* O cadastro de escolas fica 5 min em CacheService — sem limpar, a busca
   * responderia com a lista de antes desta linha e o teste mediria o cache,
   * não o código. */
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (e) {}
  try { g.CacheService.getScriptCache().remove("sisgep_escolas_lista_v2"); } catch (e) {}
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_); } catch (e) {}

  b.passo("A1. Nome que existe no cadastro traz CNPJ, cidade e escolaId");
  const exata = g.voucherBuscarEscola("COLEGIO SAO JOSE", TOKEN);
  b.igual(exata.aproximada, false, "achou pelo texto — não precisou de aproximação");
  b.igual((exata.escolas[0] || {}).cnpj, "98765432000188", "o CNPJ vem junto");
  b.igual((exata.escolas[0] || {}).escolaId, "ESC-000002",
    "e o escolaId, que é o que amarra a solicitação à escola de verdade");

  b.passo("A2. 'UVV - VILA VELHA' acha 'SEGEX UVV' — o caso que motivou tudo");
  const aprox = g.voucherBuscarEscola("UVV - VILA VELHA", TOKEN);
  b.ok(aprox.aproximada === true, "veio pela busca aproximada, e vem MARCADA como tal");
  b.igual((aprox.escolas[0] || {}).nome, "SEGEX UVV LTDA", "e é a escola certa");

  b.passo("A3. Aproximado não vira qualquer coisa");
  /* Devolver muitos parecidos é pior que devolver nenhum: quem atende
   * escolheria da lista sem conferir, e CNPJ errado em certificado ninguém
   * relê depois — o campo está preenchido. */
  const nada = g.voucherBuscarEscola("ZZZZ QUE NAO EXISTE", TOKEN);
  b.igual(nada.escolas.length, 0, "termo sem parentesco nenhum não devolve palpite");
  b.igual(nada.aproximada, false, "e não se diz aproximada quando não achou nada");

  b.passo("A4. Palavra que não distingue nada não aproxima");
  /* "COLEGIO" está em duas das três — se contasse, meia base pareceria
   * semelhante a meia base. */
  b.ok(!g.voucherBuscarEscola("COLEGIO ZZZZ", TOKEN).aproximada,
    "'COLEGIO' sozinho não é parentesco");

  b.passo("A5. Erro de digitação ainda encontra");
  b.igual((g.voucherBuscarEscola("ANCHETA", TOKEN).escolas[0] || {}).nome, "COLEGIO ANCHIETA",
    "'ANCHETA' acha 'ANCHIETA' — uma letra a menos não pode esconder a escola");


  /* ══════════════════════════════════════════════════════════════════
     A LINHA SEM PERÍODO AVISA NA LISTA

     Pedido do usuário em 13/08/2026: "deveria avisar quando não estiver".
     Duas linhas da produção estão assim — gravadas antes de o período virar
     obrigatório — e apareciam como um "—" discreto, igual a qualquer campo
     em branco. O que a pessoa precisa saber é que aquela linha NÃO EMITE.

     A linha é criada escrevendo direto na aba, sem passar pelo backend, que
     hoje recusa: é a única forma de reproduzir o que já está gravado. */
  b.passo("P1. Período vazio vira aviso, não traço");
  const shP = ss.getSheetByName("Voucher_Solicitacoes");
  const cabP = shP.getRange(1,1,1,shP.getLastColumn()).getValues()[0].map(x=>String(x||"").trim());
  const linhaP = new Array(cabP.length).fill("");
  function poe(nome, v){ const i = cabP.indexOf(nome); if (i>-1) linhaP[i] = v; }
  poe("NUMERO_PROTOCOLO","BOLSA-SEM-PERIODO"); poe("CPF_SOLICITANTE",CPF_M);
  poe("NOME_SOLICITANTE","LINHA ANTIGA"); poe("MODALIDADE","GRADUACAO");
  poe("CURSO","Administracao"); poe("STATUS_SOLICITACAO","APROVADO");
  poe("PERIODO_REFERENCIA","");
  shP.appendRow(linhaP);

  t.clicar("#certBtnRecarregar");
  await t.assentar(300);
  const corpoTab = el("certTbody") ? el("certTbody").innerHTML : "";
  b.ok(/sem período/i.test(corpoTab),
    "a linha sem período diz 'sem período' na coluna, em vez de '—'");
  b.ok(/#d97706/.test(corpoTab),
    "na cor de alerta do design system, não no dourado institucional");
  /* E o aviso não pode aparecer nas linhas que TÊM período — senão vira
     ruído e a pessoa para de olhar. */
  /* Conta o AVISO VISÍVEL, não a palavra: o texto "sem período" aparece
     duas vezes na mesma célula — no rótulo e na explicação do title. Contar
     a palavra dava 2 e o teste acusava uma linha extra que não existe. */
  const quantosAvisos = (corpoTab.match(/⚠ sem período/g) || []).length;
  b.igual(quantosAvisos, 1, "e só naquela linha");

  b.resumo();
  process.exit(process.exitCode || 0);
})();
