/**
 * TESTE — A MEMÓRIA EVOLUTIVA DO VOUCHER
 *
 * Pedido do usuário em 12/08/2026: "Tem que ter memória evolutiva, auto
 * salvar e aprender com as solicitações realizadas: Ex. Percentual de
 * desconto por curso, modalidade, ensino".
 *
 * São DUAS memórias, e elas aprendem coisas diferentes:
 *
 *   Voucher_Instituicoes — quem é a instituição: CNPJ, e-mail, escolaId.
 *   Voucher_Padroes      — quanto se concedeu, por modalidade/área/curso.
 *
 * O QUE ESTE TESTE EXISTE PARA PROVAR, em ordem de importância:
 *
 *   1. Que a memória NÃO INVENTA. Sugestão sem lastro é pior que sugestão
 *      nenhuma: percentual é dinheiro do sindicato, e um número que aparece
 *      preenchido é um número que ninguém relê.
 *   2. Que a correção humana VENCE e vira a nova memória. Errar duas vezes o
 *      mesmo e-mail é o que não pode acontecer.
 *   3. Que a prévia NÃO ensina. Alguém experimentando 100% para ver como
 *      fica não está concedendo nada.
 *   4. Que a resposta traz o NÚMERO DE CASOS. "70%" sozinho é palpite
 *      disfarçado de fato; "70% em 9 de 11" é informação.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const ESC = b.logar(g, "joscimar");        // sem benefícios
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

function limpar(nome) {
  const sh = ss.getSheetByName(nome);
  if (sh) ss.deleteSheet(sh);
}
limpar("Voucher_Instituicoes");
limpar("Voucher_Padroes");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("MEMÓRIA · Porta de entrada");

b.passo("1. As duas consultas exigem o módulo Benefícios");
b.bloqueia(() => g.voucherInstituicoesSugerir("IES"), "sugestão de instituição recusa anônimo");
b.bloqueia(() => g.voucherInstituicaoDetalhe("IESES"), "detalhe recusa anônimo");
b.bloqueia(() => g.voucherPadraoPercentual("GRADUACAO", "", ""), "padrão de percentual recusa anônimo");
b.bloqueia(() => g.voucherInstituicoesSugerir("IES", ESC), "e recusa quem não tem Benefícios");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("MEMÓRIA · Instituições — nasce do uso, ninguém cadastra");

b.passo("2. Memória vazia não inventa nada");
const vazio = g.voucherInstituicoesSugerir("", ADM);
b.igual(vazio.instituicoes.length, 0, "nenhuma sugestão antes do primeiro uso");
const semDetalhe = g.voucherInstituicaoDetalhe("IESES", ADM);
b.igual(semDetalhe.achou, false, "e o detalhe diz que não achou, em vez de devolver casca vazia");

b.passo("3. O primeiro uso cria a linha");
g.voucherInstLembrar_({ nome: "IESES", cnpj: "02213188000181",
  email: "rh@ieses.edu.br", percentual: 70, quem: "wanderson" });
const d1 = g.voucherInstituicaoDetalhe("02213188000181", ADM);
b.ok(d1.achou, "achou pela primeira vez");
b.igual(d1.nome, "IESES", "nome guardado");
b.igual(d1.email, "rh@ieses.edu.br", "e-mail guardado");
b.igual(d1.vezes, 1, "contou uma vez");

b.passo("4. O segundo uso NÃO duplica — conta");
g.voucherInstLembrar_({ nome: "IESES", cnpj: "02213188000181", percentual: 70 });
const d2 = g.voucherInstituicaoDetalhe("02213188000181", ADM);
b.igual(d2.vezes, 2, "a mesma instituição virou 2 usos, não 2 linhas");
b.igual(g.voucherInstituicoesSugerir("", ADM).instituicoes.length, 1, "e a lista tem 1 instituição");

b.passo("5. Nome escrito diferente é a MESMA instituição");
/* "IESES", "Ieses" e "IESES " são a mesma faculdade. Casar por nome cru
 * criaria três linhas para uma — a duplicidade que o item 8 do
 * PROMPT-MESTRE manda evitar. */
g.voucherInstLembrar_({ nome: "  ieses  ", percentual: 50 });
b.igual(g.voucherInstituicoesSugerir("", ADM).instituicoes.length, 1,
  "grafia diferente não cria linha nova");

b.passo("6. CORREÇÃO VENCE — e vira a nova memória");
/* O sinal mais forte que o sistema recebe: alguém olhou o endereço
 * sugerido, viu que estava errado e digitou o certo. */
g.voucherInstLembrar_({ nome: "IESES", cnpj: "02213188000181",
  email: "coordenacao@ieses.edu.br", quem: "marcela" });
b.igual(g.voucherInstituicaoDetalhe("02213188000181", ADM).email,
  "coordenacao@ieses.edu.br", "o e-mail corrigido substituiu o anterior");

b.passo("7. Campo VAZIO não apaga o que a memória já sabia");
/* Quem enviou sem preencher a cópia não está dizendo que o e-mail antigo é
 * falso — está dizendo que não quis mandar cópia desta vez. */
g.voucherInstLembrar_({ nome: "IESES", cnpj: "02213188000181", email: "" });
b.igual(g.voucherInstituicaoDetalhe("02213188000181", ADM).email,
  "coordenacao@ieses.edu.br", "o e-mail continua lá depois de um envio sem cópia");

b.passo("8. Sem nome e sem CNPJ, não grava");
/* Linha em branco na memória viraria sugestão vazia na tela de quem digita. */
const antes = g.voucherInstituicoesSugerir("", ADM).instituicoes.length;
b.igual(g.voucherInstLembrar_({ email: "solto@exemplo.com" }), false, "recusa gravar");
b.igual(g.voucherInstituicoesSugerir("", ADM).instituicoes.length, antes, "e nada entrou");

b.passo("9. A sugestão ordena pelas mais usadas");
g.voucherInstLembrar_({ nome: "MULTIVIX", cnpj: "31344800000100", percentual: 50 });
["a","b","c"].forEach(() => g.voucherInstLembrar_({ nome: "FAESA", cnpj: "28127319000100" }));
const sug = g.voucherInstituicoesSugerir("", ADM).instituicoes;
b.igual(sug[0].nome, "IESES", "IESES na frente (4 usos)");
b.igual(sug[1].nome, "FAESA", "FAESA depois (3 usos)");

b.passo("10. Busca por trecho do nome e por CNPJ");
b.igual(g.voucherInstituicoesSugerir("mult", ADM).instituicoes.length, 1, "acha por trecho do nome");
b.igual(g.voucherInstituicoesSugerir("2812", ADM).instituicoes[0].nome, "FAESA", "acha por CNPJ");
b.igual(g.voucherInstituicoesSugerir("zzzz", ADM).instituicoes.length, 0, "termo que não existe devolve nada");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("MEMÓRIA · Percentual por modalidade, área e curso");

b.passo("11. Sem histórico, não sugere percentual nenhum");
const p0 = g.voucherPadraoPercentual("GRADUACAO", "HUMANAS", "Pedagogia", ADM);
b.igual(p0.achou, false, "não achou");
b.igual(p0.aviso, "", "e não inventa aviso");

b.passo("12. Aprende nas três granularidades de uma vez");
for (let i = 0; i < 9; i++) {
  g.voucherPadraoLembrar_({ modalidade: "EDUCACAO_INFANTIL", area: "", curso: "Maternal", percentual: 70 });
}
const pCurso = g.voucherPadraoPercentual("EDUCACAO_INFANTIL", "", "Maternal", ADM);
b.ok(pCurso.achou, "achou pelo curso");
b.igual(pCurso.percentualSugerido, 70, "sugere 70%");
b.igual(pCurso.nivel, "CURSO", "e diz que casou no nível do CURSO");

b.passo("13. Curso desconhecido cai para a MODALIDADE");
/* É o que faz a memória valer desde o começo: um curso novo de uma
 * modalidade já conhecida não fica sem resposta. */
const pMod = g.voucherPadraoPercentual("EDUCACAO_INFANTIL", "", "Jardim II", ADM);
b.ok(pMod.achou, "achou mesmo com curso que nunca apareceu");
b.igual(pMod.nivel, "MODALIDADE", "e avisa que a base foi a modalidade inteira");
b.igual(pMod.percentualSugerido, 70, "com o mesmo percentual");

b.passo("14. A resposta diz QUANTOS CASOS — sem isso é palpite disfarçado");
b.igual(pCurso.total, 9, "conta os 9 casos");
b.ok(/9/.test(pCurso.aviso) && /70/.test(pCurso.aviso),
  "e o aviso traz o número e o percentual", pCurso.aviso);

b.passo("15. O MAIS USADO vence o último, e a exceção fica visível");
/* Um caso isolado de 100% não pode virar a sugestão para sempre — mas
 * também não pode sumir: quem analisa precisa saber que houve exceção. */
g.voucherPadraoLembrar_({ modalidade: "EDUCACAO_INFANTIL", area: "", curso: "Maternal", percentual: 100 });
const pDepois = g.voucherPadraoPercentual("EDUCACAO_INFANTIL", "", "Maternal", ADM);
b.igual(pDepois.percentualSugerido, 70, "continua sugerindo 70, não o 100 que veio por último");
b.igual(pDepois.casos, 9, "com 9 casos");
b.igual(pDepois.total, 10, "de 10 no total");
b.ok(/100%/.test(pDepois.variacao), "e a exceção de 100% aparece na variação", pDepois.variacao);
b.ok(/9 de 10/.test(pDepois.aviso), "o aviso deixa a proporção explícita", pDepois.aviso);

b.passo("16. Percentual inválido não entra na memória");
/* Sujeira aqui vira sugestão errada meses depois, quando ninguém lembra de
 * onde veio. */
[0, -5, 150, "", null, "abc"].forEach(function (v) {
  b.igual(g.voucherPadraoLembrar_({ modalidade: "TECNICO", curso: "X", percentual: v }),
    false, "recusa percentual " + JSON.stringify(v));
});
b.igual(g.voucherPadraoPercentual("TECNICO", "", "X", ADM).achou, false,
  "e nada foi aprendido de TECNICO");

b.passo("17. Modalidades diferentes não se contaminam");
g.voucherPadraoLembrar_({ modalidade: "GRADUACAO", area: "HUMANAS", curso: "Pedagogia", percentual: 50 });
b.igual(g.voucherPadraoPercentual("GRADUACAO", "HUMANAS", "Pedagogia", ADM).percentualSugerido, 50,
  "Graduação aprendeu 50");
b.igual(g.voucherPadraoPercentual("EDUCACAO_INFANTIL", "", "Maternal", ADM).percentualSugerido, 70,
  "e Educação Infantil continua com 70");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("MEMÓRIA · A prévia NÃO ensina");

b.passo("18. Emitir ensina; pré-visualizar, não");
/* Se a prévia alimentasse a memória, o padrão passaria a refletir o que se
 * EXPERIMENTOU, não o que se DEU — e a sugestão pioraria a cada teste.
 * Aqui se prova pela contagem: uma prévia não pode mexer no número. */
const antesPrevia = g.voucherPadraoPercentual("EDUCACAO_INFANTIL", "", "Maternal", ADM).total;

g.setupVoucherModuleFase1();
const sh = ss.getSheetByName("Voucher_Solicitacoes");
const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
const campos = {
  ID_SOLICITACAO: "SOL-PREVIA", CPF_SOLICITANTE: "39053344705",
  NOME_SOLICITANTE: "Teste da Prévia", EMAIL: "t@exemplo.com",
  MODALIDADE: "EDUCACAO_INFANTIL", CURSO: "Maternal",
  SITUACAO_SINDICAL: "ASSOCIADO", STATUS_VALIDACAO_SINDICAL: "VALIDADO",
  STATUS_SOLICITACAO: "APROVADO", NUMERO_PROTOCOLO: "BOLSA-PREVIA-1"
};
sh.getRange(sh.getLastRow() + 1, 1, 1, cab.length)
  .setValues([cab.map(c => (campos[c] !== undefined ? campos[c] : ""))]);

g.gerarDocumentoVoucher("BOLSA-PREVIA-1", "PREVIA", { percentual: 100 });
const depoisPrevia = g.voucherPadraoPercentual("EDUCACAO_INFANTIL", "", "Maternal", ADM);
b.igual(depoisPrevia.total, antesPrevia, "a prévia não mexeu na contagem");
b.igual(depoisPrevia.percentualSugerido, 70,
  "e o 100% experimentado na prévia não virou sugestão");


/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("MEMÓRIA · O caso do Marcelo — o exemplo do usuário, ponta a ponta");

/* O cenário, nas palavras dele (12/08/2026):
 *
 *   "Marcelo é da faculdade Multivix. Ele solicita um voucher de desconto
 *    para o curso de graduação, 70%. Quando o Marcelo no próximo semestre
 *    solicitar novamente, quando a gente digita Marcelo Alves de Oliveira,
 *    ele já aparece: curso de administração, 70%. Ou quando a gente digita
 *    administração, 70%. Se eu digitar Direito, já está preestabelecido
 *    50%. A partir do momento que eu fiz a primeira vez, as demais ele já
 *    faz."
 *
 * É o teste que decide se a memória serve para alguma coisa. */

const CPF_MARCELO = "11144477735";
const CPF_NOVATO  = "52998224725";

function solicitar(campos) {
  const sh2 = ss.getSheetByName("Voucher_Solicitacoes");
  const c = sh2.getRange(1, 1, 1, sh2.getLastColumn()).getValues()[0]
    .map(x => String(x || "").trim());
  sh2.getRange(sh2.getLastRow() + 1, 1, 1, c.length)
    .setValues([c.map(x => (campos[x] !== undefined ? campos[x] : ""))]);
}

b.passo("19. Antes da primeira vez, a memória não sabe nada dele");
const antesDeTudo = g.voucherMemoriaAssociado(CPF_NOVATO, ADM);
b.igual(antesDeTudo.achou, false, "associado novo não traz nada");
b.ok(!antesDeTudo.curso, "e não inventa curso");

b.passo("20. Primeira solicitação do Marcelo — Multivix, Administração, 70%");
solicitar({
  ID_SOLICITACAO: "SOL-M1", CPF_SOLICITANTE: CPF_MARCELO,
  NOME_SOLICITANTE: "Marcelo Alves de Oliveira",
  EMAIL: "marcelo@exemplo.com", TELEFONE: "(27) 99111-2233",
  SITUACAO_SINDICAL: "ASSOCIADO", ESCOLA_SELECIONADA: "COLEGIO SAO JOSE",
  INSTITUICAO_ENSINO: "MULTIVIX", CNPJ_INSTITUICAO: "31344800000100",
  EMAIL_INSTITUICAO: "bolsas@multivix.edu.br",
  MODALIDADE: "GRADUACAO", CURSO: "Administracao", AREA_CURSO: "HUMANAS",
  REGIME: "SEMESTRAL", PERCENTUAL_APLICADO: 70,
  PERIODO_REFERENCIA: "2026/1", STATUS_SOLICITACAO: "EMITIDO",
  NUMERO_PROTOCOLO: "BOLSA-2026-M1"
});
g.voucherPadraoLembrar_({ modalidade: "GRADUACAO", area: "HUMANAS",
  curso: "Administracao", percentual: 70 });

b.passo("21. Semestre seguinte: digitar o Marcelo traz TUDO preenchido");
const m = g.voucherMemoriaAssociado(CPF_MARCELO, ADM);
b.ok(m.achou, "achou o Marcelo", m.aviso);
b.igual(m.nome, "Marcelo Alves de Oliveira", "nome");
b.igual(m.instituicao, "MULTIVIX", "a faculdade dele volta preenchida");
b.igual(m.cnpjInstituicao, "31344800000100", "com o CNPJ");
b.igual(m.emailInstituicao, "bolsas@multivix.edu.br", "e com o e-mail da instituição");
b.igual(m.curso, "Administracao", "o curso volta preenchido");
b.igual(m.modalidade, "GRADUACAO", "a modalidade também");
b.igual(m.percentual, 70, "e os 70% vêm PREENCHIDOS — decisão do usuário");
b.igual(m.origemPercentual, "ULTIMA_SOLICITACAO",
  "dizendo que veio da última solicitação dele, não de uma média");
b.igual(m.email, "marcelo@exemplo.com", "e-mail do associado");
b.igual(m.telefone, "(27) 99111-2233", "telefone");

b.passo("22. Digitar só o CURSO também traz o percentual");
/* O segundo caminho do exemplo: "ou quando a gente digita administração,
 * 70%". Sem pessoa, sem modalidade — só o nome do curso. */
const porCurso = g.voucherPercentualPorCurso("Administracao", ADM);
b.ok(porCurso.achou, "achou pelo curso solto");
b.igual(porCurso.percentualSugerido, 70, "sugere 70%");
b.ok(/70/.test(porCurso.aviso), "com o aviso pronto", porCurso.aviso);

b.passo("23. E Direito, que saiu a 50%, vem com 50% — não com 70%");
/* A frase exata do usuário: "se eu digitar Direito, já está preestabelecido
 * cinquenta por cento". Se os dois cursos voltassem com o mesmo número, a
 * memória não estaria aprendendo por curso — estaria só repetindo o último. */
g.voucherPadraoLembrar_({ modalidade: "GRADUACAO", area: "HUMANAS",
  curso: "Direito", percentual: 50 });
const dir = g.voucherPercentualPorCurso("Direito", ADM);
b.igual(dir.percentualSugerido, 50, "Direito sugere 50%");
b.igual(g.voucherPercentualPorCurso("Administracao", ADM).percentualSugerido, 70,
  "e Administração continua com 70% — os cursos não se contaminam");

b.passo("24. Grafia diferente do curso ainda acha");
b.igual(g.voucherPercentualPorCurso("  administracao ", ADM).percentualSugerido, 70,
  "espaços e maiúsculas não atrapalham");
b.igual(g.voucherPercentualPorCurso("Engenharia", ADM).achou, false,
  "curso que nunca apareceu não inventa percentual");

b.passo("25. A ÚLTIMA vence a primeira — a vida do associado muda");
/* Marcelo trocou de curso e o percentual mudou. A sugestão tem que refletir
 * a vida dele hoje, não a de dois semestres atrás. */
solicitar({
  ID_SOLICITACAO: "SOL-M2", CPF_SOLICITANTE: CPF_MARCELO,
  NOME_SOLICITANTE: "Marcelo Alves de Oliveira", EMAIL: "marcelo@exemplo.com",
  INSTITUICAO_ENSINO: "MULTIVIX", MODALIDADE: "POS_GRADUACAO",
  CURSO: "Gestao de Pessoas", AREA_CURSO: "HUMANAS",
  PERCENTUAL_APLICADO: 40, PERIODO_REFERENCIA: "2026/2",
  STATUS_SOLICITACAO: "EMITIDO", NUMERO_PROTOCOLO: "BOLSA-2026-M2"
});
const m2 = g.voucherMemoriaAssociado(CPF_MARCELO, ADM);
b.igual(m2.curso, "Gestao de Pessoas", "traz o curso mais recente");
b.igual(m2.percentual, 40, "e o percentual mais recente");
b.igual(m2.vezes, 2, "contando as 2 solicitações dele");
b.ok(/2 solicita/.test(m2.aviso), "o aviso diz quantas foram", m2.aviso);

b.passo("26. Associado sem percentual anterior cai no padrão do curso");
/* Primeira bolsa de alguém, num curso que outros já fizeram: a memória da
 * pessoa está vazia, mas a do curso não. */
solicitar({
  ID_SOLICITACAO: "SOL-N1", CPF_SOLICITANTE: CPF_NOVATO,
  NOME_SOLICITANTE: "Fulano Novato", MODALIDADE: "GRADUACAO",
  AREA_CURSO: "HUMANAS", CURSO: "Direito", PERCENTUAL_APLICADO: "",
  STATUS_SOLICITACAO: "ANALISE", NUMERO_PROTOCOLO: "BOLSA-2026-N1"
});
const nov = g.voucherMemoriaAssociado(CPF_NOVATO, ADM);
b.ok(nov.achou, "achou a solicitação dele");
b.igual(nov.percentual, 50, "e o percentual veio do padrão do curso Direito");
b.igual(nov.origemPercentual, "PADRAO_DO_CURSO",
  "dizendo claramente que NÃO veio da história dele");

b.passo("27. CPF inválido é recusado, sem sugerir nada");
const ruim = g.voucherMemoriaAssociado("123", ADM);
b.igual(ruim.achou, false, "não acha");
b.ok(/11 d/.test(ruim.mensagem || ""), "e explica o motivo", ruim.mensagem);

b.passo("28. A memória do associado exige o módulo Benefícios");
b.bloqueia(() => g.voucherMemoriaAssociado(CPF_MARCELO), "recusa anônimo");
b.bloqueia(() => g.voucherPercentualPorCurso("Direito"), "percentual por curso recusa anônimo");
b.bloqueia(() => g.voucherMemoriaAssociado(CPF_MARCELO, ESC), "recusa quem não tem Benefícios");


/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("REGRA DA CCT · dois defeitos que estavam no motor");

b.passo("29. ENSINO_MEDIO era oferecido no menu e não tinha regra");
/* getPortalVoucherInitData oferece "Ensino Médio (15–17 anos)", e quem
 * escolhesse caía em "Modalidade não reconhecida" — pedido recusado por um
 * buraco no código, não por regra da convenção. */
const medio = g.calcularRegraVoucher_(
  { modalidade: "ENSINO_MEDIO", tipoBeneficiario: "FILHO", ordemFilho: "1" }, 10);
b.ok(medio.apto, "ensino médio é aceito", medio.observacao);
b.igual(medio.percentual, "100", "1º filho do ensino médio: 100%");
b.igual(g.calcularRegraVoucher_(
  { modalidade: "ENSINO_MEDIO", tipoBeneficiario: "FILHO", ordemFilho: "3" }, 10).percentual,
  "60", "3º filho do ensino médio: 60%");

b.passo("30. Titular de MESTRADO saía com 100% — o oposto da convenção");
/* O bloco `if (tipoBeneficiario === "TITULAR")` era alcançado quando NENHUMA
 * modalidade casava, e concedia desconto integral. Mestrado não tem regra;
 * logo, mestrado dava 100%. */
const mest = g.calcularRegraVoucher_(
  { modalidade: "MESTRADO", tipoBeneficiario: "TITULAR" }, "");
b.ok(!mest.apto, "mestrado é recusado");
b.igual(mest.percentual, "", "sem percentual nenhum");
b.ok(/n[ãa]o h[áa] desconto/i.test(mest.observacao),
  "e com o motivo escrito", mest.observacao);
b.ok(!g.calcularRegraVoucher_(
  { modalidade: "DOUTORADO", tipoBeneficiario: "TITULAR" }, "").apto,
  "doutorado idem");

b.passo("31. As demais regras continuam como estavam");
b.igual(g.calcularRegraVoucher_(
  { modalidade: "GRADUACAO", areaCurso: "HUMANAS", tipoBeneficiario: "TITULAR" }, "").percentual,
  "70", "graduação humanas 70%");
b.igual(g.calcularRegraVoucher_(
  { modalidade: "GRADUACAO", areaCurso: "SAUDE", tipoBeneficiario: "TITULAR" }, "").percentual,
  "50", "graduação saúde 50%");
b.igual(g.calcularRegraVoucher_(
  { modalidade: "POS_GRADUACAO", tipoBeneficiario: "TITULAR" }, "").percentual,
  "70", "pós 70%");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("RESOLVEDOR · a chamada única que a tela de solicitação consome");

b.passo("32. A REGRA da convenção é a base");
const s1 = g.voucherSugerirSolicitacao(
  { modalidade: "GRADUACAO", area: "HUMANAS", curso: "Filosofia" }, ADM);
b.igual(s1.campos.percentual, 70, "70% para humanas");
b.igual(s1.origens.percentual, "REGRA_CCT", "e a origem é a convenção, não a memória");

b.passo("33. Sem regra que case, cai no padrão observado do curso");
/* Modalidade em branco: a convenção não tem o que dizer, mas a memória do
 * curso tem. É o caso de quem digita só "Direito" no balcão. */
const s2 = g.voucherSugerirSolicitacao({ curso: "Direito" }, ADM);
b.igual(s2.campos.percentual, 50, "Direito vem com 50% da memória");
b.igual(s2.origens.percentual, "PADRAO_DO_CURSO", "e diz que veio do padrão do curso");

b.passo("34. Com CPF conhecido, o formulário inteiro vem preenchido");
const s3 = g.voucherSugerirSolicitacao({ cpf: CPF_MARCELO }, ADM);
b.igual(s3.campos.nome, "Marcelo Alves de Oliveira", "nome");
b.igual(s3.campos.instituicao, "MULTIVIX", "faculdade");
b.igual(s3.origens.instituicao, "ULTIMA_SOLICITACAO", "com a origem marcada");
b.ok(s3.avisos.length > 0, "e um aviso dizendo de onde veio", s3.avisos[0]);

b.passo("35. O que a tela mandou VENCE o que a memória lembrou");
/* Se a pessoa já trocou a modalidade no formulário, é sobre a NOVA que ela
 * quer saber o percentual — não sobre a do semestre passado. */
const s4 = g.voucherSugerirSolicitacao(
  { cpf: CPF_MARCELO, modalidade: "GRADUACAO", area: "SAUDE", curso: "Enfermagem" }, ADM);
b.igual(s4.campos.curso, "Enfermagem", "o curso digitado agora prevalece");
b.igual(s4.campos.percentual, 50, "e o percentual é o da área nova (saúde)");
b.igual(s4.origens.percentual, "REGRA_CCT", "vindo da convenção");

b.passo("36. Divergência entre a regra e a história do associado APARECE");
/* Um associado que vinha recebendo 40% num caso cuja regra diz 70% é uma
 * exceção que alguém concedeu. Pode ter havido motivo, e pode ter havido
 * engano — esconder qualquer um dos dois números decidiria por quem
 * deveria decidir. */
const s5 = g.voucherSugerirSolicitacao(
  { cpf: CPF_MARCELO, modalidade: "GRADUACAO", area: "HUMANAS", curso: "Administracao" }, ADM);
b.igual(s5.campos.percentual, 70, "o campo vem com o da regra");
b.ok(!!s5.divergencia, "e a divergência é sinalizada");
b.igual(s5.divergencia && s5.divergencia.associado, 40, "com o valor da última dele");
b.ok(s5.avisos.some(a => /[úu]ltima bolsa/i.test(a)),
  "e um aviso em texto para quem analisa", (s5.avisos.find(a => /[úu]ltima/i.test(a)) || ""));

b.passo("37. Regra que RECUSA deixa o campo vazio E diz o motivo");
const s6 = g.voucherSugerirSolicitacao({ modalidade: "MESTRADO" }, ADM);
b.igual(s6.campos.percentual, "", "campo em branco");
b.igual(s6.origens.percentual, "REGRA_CCT_RECUSA", "com a origem marcando a recusa");
b.ok(s6.bloqueadoPelaRegra === true, "e o bloqueio sinalizado para a tela");
b.ok(s6.avisos.some(a => /n[ãa]o h[áa] desconto/i.test(a)), "com o motivo à vista", s6.avisos[0]);

b.passo("38. Memória NÃO fura a recusa da convenção");
/* O mais importante deste bloco: se o mestrado não tem desconto, nenhuma
 * memória pode preencher um número ali. */
g.voucherPadraoLembrar_({ modalidade: "MESTRADO", curso: "Mestrado em Gestao", percentual: 80 });
const s7 = g.voucherSugerirSolicitacao(
  { modalidade: "MESTRADO", curso: "Mestrado em Gestao" }, ADM);
b.igual(s7.campos.percentual, "", "continua vazio, mesmo com padrão observado de 80%");
b.ok(s7.bloqueadoPelaRegra === true, "e continua bloqueado");

b.passo("39. O resolvedor exige o módulo Benefícios");
b.bloqueia(() => g.voucherSugerirSolicitacao({ cpf: CPF_MARCELO }), "recusa anônimo");
b.bloqueia(() => g.voucherSugerirSolicitacao({ cpf: CPF_MARCELO }, ESC), "recusa sem o módulo");


/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("REGRA DA CCT · quem tem direito, e até quantos filhos");

b.passo("40. Só ASSOCIADO tem direito");
/* Ditado pelo usuário em 12/08/2026: "dependente: só tem direito quem é
 * associado". A verificação existia só na EMISSÃO — ou seja, a solicitação
 * era cadastrada, analisada e aprovada, e o "não pode" só aparecia na hora
 * de gerar o documento, com todo o trabalho já feito. */
const naoAssoc = g.calcularRegraVoucher_(
  { modalidade: "GRADUACAO", areaCurso: "HUMANAS", tipoBeneficiario: "TITULAR",
    situacaoSindical: "NAO_ASSOCIADO" }, "");
b.ok(!naoAssoc.apto, "não-associado é recusado no cálculo, não só na emissão");
b.ok(/s[óo] associado/i.test(naoAssoc.observacao), "com o motivo escrito", naoAssoc.observacao);
b.ok(g.calcularRegraVoucher_(
  { modalidade: "GRADUACAO", areaCurso: "HUMANAS", tipoBeneficiario: "TITULAR",
    situacaoSindical: "ASSOCIADO" }, "").apto, "e associado passa normalmente");

b.passo("41. Situação em BRANCO não é recusa");
/* Quem ainda não escolheu o campo não está declarando que a pessoa é
 * não-associada. Recusar aqui faria o formulário nascer bloqueado. */
b.ok(g.calcularRegraVoucher_(
  { modalidade: "GRADUACAO", areaCurso: "HUMANAS", tipoBeneficiario: "TITULAR" }, "").apto,
  "campo vazio não bloqueia o cálculo");

b.passo("42. Desconto vai até o 3º filho");
b.igual(g.calcularRegraVoucher_(
  { modalidade: "EDUCACAO_INFANTIL", tipoBeneficiario: "FILHO", ordemFilho: "1",
    situacaoSindical: "ASSOCIADO" }, 10).percentual, "100", "1º filho 100%");
b.igual(g.calcularRegraVoucher_(
  { modalidade: "EDUCACAO_INFANTIL", tipoBeneficiario: "FILHO", ordemFilho: "3",
    situacaoSindical: "ASSOCIADO" }, 10).percentual, "60", "3º filho 60%");

b.passo("43. Do 4º em diante, recusa — e a mensagem fala da ORDEM");
/* A versão anterior devolvia "Ordem do filho inválida para a modalidade
 * informada" — mensagem que faz quem lê procurar erro na MODALIDADE, quando
 * o problema é a ordem. Recusar é certo; explicar errado custa uma ligação
 * para o sindicato. */
const quarto = g.calcularRegraVoucher_(
  { modalidade: "EDUCACAO_INFANTIL", tipoBeneficiario: "FILHO", ordemFilho: "4",
    situacaoSindical: "ASSOCIADO" }, 10);
b.ok(!quarto.apto, "4º filho é recusado");
b.ok(/3º filho/.test(quarto.observacao) && /4/.test(quarto.observacao),
  "e a mensagem diz o limite E o que foi informado", quarto.observacao);
b.ok(!/modalidade/i.test(quarto.observacao),
  "sem culpar a modalidade, que não tem nada a ver");

b.passo("44. O resolvedor repassa a situação sindical à regra");
/* Sem repassar, o resolvedor calcularia percentual para quem não é
 * associado e a recusa só apareceria lá na emissão. */
const rNao = g.voucherSugerirSolicitacao(
  { modalidade: "GRADUACAO", area: "HUMANAS", situacaoSindical: "NAO_ASSOCIADO" }, ADM);
b.igual(rNao.campos.percentual, "", "campo vazio para não-associado");
b.ok(rNao.bloqueadoPelaRegra === true, "e bloqueado");
b.ok(rNao.avisos.some(a => /s[óo] associado/i.test(a)), "com o aviso na tela",
  (rNao.avisos.find(a => /associado/i.test(a)) || ""));

b.resumo();
process.exit(0);
