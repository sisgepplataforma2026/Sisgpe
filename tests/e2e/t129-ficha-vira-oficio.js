/**
 * t129 — MÓDULO 03 · A PONTE DA FICHA PARA O OFÍCIO
 *
 * Frente A, sétima rodada, 01/09/2026. As três funções de
 * `SindicalizacaoOficio.gs` que geram ofício a partir de uma ficha assinada
 * — e que nunca foram executadas por teste nenhum.
 *
 * POR QUE ESTA PONTE MERECE TESTE PRÓPRIO
 *
 * `aprovarEEncaminharFicha` faz DUAS coisas irreversíveis em sequência:
 * emite a MATRÍCULA do trabalhador e depois gera o OFÍCIO para a escola. Se a
 * segunda falhar, a primeira já aconteceu — e não se desfaz. A função sabe
 * disso e devolve `sucesso: true` com `parcial: true`.
 *
 * Esse retorno é a coisa mais delicada do arquivo. Uma tela que leia só
 * `sucesso` mostra "deu certo" para um caso em que o ofício NÃO foi gerado —
 * e o trabalhador fica matriculado sem que a escola seja comunicada. Ninguém
 * percebe até a escola cobrar.
 *
 * (A tela lê: `FichasSindicaisAdmin.html:842` mostra "Concluído com
 * pendência". O passo 7 trava isso para que continue lendo.)
 *
 * O ACHADO QUE ESTE TESTE REGISTRA
 *
 * A mensagem do caso parcial manda: *"Use 'Reemitir ofício' depois de
 * verificar o arquivo."* A função `reemitirOficioFicha` existe, tem porta e
 * funciona — mas NENHUMA tela a chama. Os cinco passos da REGRA Nº 1 foram
 * rodados e deram isso. Ou seja: no exato momento em que o sistema instrui a
 * pessoa a apertar um botão, o botão não existe.
 *
 * Não é código morto — é o contrário: é código vivo sem porta de entrada. Por
 * isso ele fica, é coberto por teste aqui, e a falta da tela vira item para o
 * usuário decidir (REGRA Nº 0.5: tela se desenha antes de implementar).
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");  /* ADMINISTRADOR — todos os módulos */
const SIN = b.logar(g, "joscimar");   /* escolas + sindicalizacao, SEM documentos */
const FIN = b.logar(g, "rogerio");    /* financeiro + rh — NÃO tem sindicalizacao */

function tentar(fn) {
  try { return { passou: true, valor: fn(), msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}
const deuCerto = r => !!(r && (r.ok === true || r.sucesso === true));

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) {
  ss.insertSheet("CONFIG").getRange(1, 1, 1, 2).setValues([["CHAVE", "VALOR"]]);
}
g.configurarAbaSindicalizacao();

/* As abas Associados e Escolas já existem na produção — o sistema só lê. */
const cabAssociados = [
  "Nome fantasia", "Nome", "CPF", "Filiado", "Logradouro", "Número",
  "Bairro", "Cidade", "CEP", "Celular", "CELULAR2", "E-mail",
  "ULTIMA_ATUALIZACAO", "MATRICULA", "DATA_FILIACAO", "ID_FICHA"];
if (!ss.getSheetByName("Associados")) {
  ss.insertSheet("Associados")
    .getRange(1, 1, 1, cabAssociados.length).setValues([cabAssociados]);
}

/* A escola destinatária, com CNPJ e e-mail — é o que o ofício exige. */
let abaEsc = ss.getSheetByName("Escolas");
if (!abaEsc) abaEsc = ss.insertSheet("Escolas");
abaEsc.getRange(1, 1, 1, 5).setValues([[
  "NOME", "RAZAO SOCIAL", "CNPJ", "E-MAIL (PRINCIPAL)", "E-MAILS (TODOS)"]]);
abaEsc.getRange(2, 1, 1, 5).setValues([[
  "Escola Modelo", "Modelo Educacional LTDA", "12345678000199",
  "secretaria@modelo.com", "secretaria@modelo.com, diretoria@modelo.com"]]);

/* A aba Controle é onde o ofício nasce — o gerarOficioWeb escreve nela. Sem o
   cabeçalho, ele para em "Aba de registro não encontrada" e o teste falharia
   por motivo que não é do sistema. */
let abaCtrl = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (!abaCtrl) abaCtrl = ss.insertSheet(g.PLANILHA_REGISTRO);
abaCtrl.getRange(1, 1, 1, 10).setValues([[
  "Número do Ofício", "Data", "TIPO", "Escola", "CNPJ", "E-mail",
  "Status", "CONFIG", "Observações", "Link"]]);

const ESCOLA = {
  nome: "Modelo Educacional LTDA",
  cnpj: "12345678000199",
  emailPrincipal: "secretaria@modelo.com",
  emailsTodos: "secretaria@modelo.com, diretoria@modelo.com"
};

/* Uma ficha até ASSINADA, pelo mesmo caminho da tela. */
const env = g.submeterFichaSindicalizacao({
  nome: "Maria Aparecida Souza", cpf: "111.444.777-35", rg: "1234567",
  dataNascimento: "1985-04-12", sexo: "F", estadoCivil: "SOLTEIRO",
  email: "maria.teste@exemplo.com", telefone: "(27) 99999-1234",
  celular: "(27) 99999-1234", cepResidencial: "29000-000",
  endereco: "Rua Teste, 100", numero: "100", bairro: "Centro",
  cidade: "Vitória", uf: "ES", escola: "Escola Modelo",
  cargo: "Auxiliar Administrativo", dataAdmissao: "2020-03-10",
  salario: "2500,00"
});
const IDF = env && (env.idFicha || env.id);

b.fluxo("MÓDULO 03 · a prévia do ofício de filiação");

b.passo("1. as três portas — quem não tem sindicalização não passa");
[["previewOficioFiliacao", t => g.previewOficioFiliacao(IDF, ESCOLA, t)],
 ["aprovarEEncaminharFicha", t => g.aprovarEEncaminharFicha(IDF, ESCOLA, "x", t)],
 ["reemitirOficioFicha", t => g.reemitirOficioFicha(IDF, ESCOLA, "x", t)]
].forEach(function (par) {
  const semSessao = tentar(() => par[1](""));
  b.ok(!semSessao.passou, "sem sessão: " + par[0],
    semSessao.passou ? "PASSOU" : semSessao.msg.substring(0, 38));
  const semModulo = tentar(() => par[1](FIN));
  b.ok(!semModulo.passou, "sem o módulo: " + par[0],
    semModulo.passou ? "PASSOU" : semModulo.msg.substring(0, 38));
});

b.passo("2. a prévia exige escola destinatária ANTES de montar nada");
/* O ofício não existe sem CNPJ e e-mail da escola; recusar aqui é melhor que
   montar uma prévia que não vira ofício. */
const semEscola = g.previewOficioFiliacao(IDF, null, ADM);
b.ok(semEscola && semEscola.sucesso === false,
  "sem escola, a prévia é recusada", semEscola && semEscola.mensagem);
const semCnpj = g.previewOficioFiliacao(IDF, { nome: "X" }, ADM);
b.ok(semCnpj && semCnpj.sucesso === false, "escola sem CNPJ também");

b.passo("3. ficha inexistente não gera prévia");
const fantasma = g.previewOficioFiliacao("FICHA-QUE-NAO-EXISTE", ESCOLA, ADM);
b.ok(fantasma && fantasma.sucesso === false, "ficha inexistente é recusada",
  fantasma && fantasma.mensagem);

b.fluxo("MÓDULO 03 · aprovar e encaminhar — as duas coisas irreversíveis");

b.passo("4. ficha NÃO assinada não vira ofício");
/* A ordem importa: assinar é o consentimento do trabalhador. Encaminhar antes
   disso mandaria à escola uma filiação que ninguém confirmou. */
const naoAssinada = g.aprovarEEncaminharFicha(IDF, ESCOLA, "Wanderson", ADM);
b.ok(naoAssinada && naoAssinada.sucesso === false,
  "ficha sem assinatura é barrada",
  naoAssinada && naoAssinada.mensagem
    ? naoAssinada.mensagem.substring(0, 52) : "");

b.passo("5. escola sem e-mail é barrada — e a mensagem diz o que fazer");
/* REGRA Nº 0.6: erro previsível se avisa antes. E o aviso tem que dizer o
   conserto, não só o problema — é o mesmo buraco do e-mail errado que faz o
   ofício voltar. */
const semEmail = g.aprovarEEncaminharFicha(
  IDF, { nome: "X", cnpj: "12345678000199" }, "Wanderson", ADM);
b.ok(semEmail && semEmail.sucesso === false, "escola sem e-mail é barrada");
b.ok(/atualize o cadastro/i.test(String(semEmail && semEmail.mensagem || "")),
  "e a mensagem manda atualizar o cadastro da escola",
  String(semEmail && semEmail.mensagem || "").substring(0, 52));

b.passo("6. assina a ficha e encaminha de verdade");
const codigo = g.CacheService.getScriptCache().get("SIND_OTP_" + IDF) || "";
const assinou = tentar(() => g.validarOTPEAssinarFicha(IDF, codigo, "127.0.0.1"));
b.ok(deuCerto(assinou.valor), "a ficha foi assinada",
  assinou.passou ? "" : assinou.msg.substring(0, 40));

/* Com o ADM, que tem os dois módulos. O porquê disso importar está no passo
   15 — é o achado desta rodada. */
const r = g.aprovarEEncaminharFicha(IDF, ESCOLA, "Wanderson", ADM);
b.ok(r && r.sucesso === true, "aprovarEEncaminharFicha conclui",
  r && r.mensagem ? r.mensagem.substring(0, 56) : "");

b.passo("7. E O CAMPO QUE DECIDE SE A TELA MENTE — parcial");
/* Se o ofício falhar depois da matrícula, a função devolve sucesso:true com
   parcial:true. Tela que leia só `sucesso` mostra "deu certo" para um caso em
   que a escola não foi comunicada. A FichasSindicaisAdmin.html lê o parcial
   hoje; este passo é o que trava isso. */
const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const tela = fs.readFileSync(path.join(RAIZ, "FichasSindicaisAdmin.html"), "utf8");
b.ok(/r\.parcial/.test(tela),
  "a tela lê o campo parcial, não só o sucesso");
b.ok(/pend[êe]ncia/i.test(tela),
  "e mostra que ficou pendência, em vez de 'concluído'");

b.passo("8. o que a conclusão devolve — é isso que a tela mostra e o que fica");
b.ok(!!(r && r.matricula), "matrícula emitida", r && r.matricula);
b.ok(!r.parcial, "não ficou parcial — o ofício foi gerado junto",
  r.parcial ? "PARCIAL: " + r.mensagem : "completo");
b.ok(/^\d{3}\/\d{4}$/.test(String(r.numeroOficio || "")),
  "número na forma oficial NNN/AAAA", String(r.numeroOficio || "(vazio)"));
b.ok(!!(r && r.codigoVerificacao),
  "código de verificação, que é o que a escola usa para validar");
b.igual(String(r.emailDestino || ""), ESCOLA.emailsTodos,
  "e o destino é a lista TODOS, não só a principal");

b.passo("9. INTEGRAÇÃO — o ofício entrou na fila de envio");
/* Gerar o ofício sem enfileirar seria gerar um PDF que ninguém recebe. */
const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS");
b.ok(!!fila, "a fila existe depois da operação");
/* Procura em qualquer coluna: a ordem do cabeçalho é do sistema, e prender o
   teste à posição faria ele quebrar numa mudança que não é defeito. */
const linhasFila = fila ? fila.getDataRange().getValues() : [];
const naFila = linhasFila.filter(
  l => l.some(c => String(c || "").trim() === String(r.numeroOficio)));
b.igual(naFila.length, 1, "o ofício está na fila, uma vez só");
b.ok(naFila.length === 1 &&
     naFila[0].some(c => String(c || "").indexOf("modelo.com") >= 0),
  "e com o e-mail da escola como destino");

b.passo("10. E O SEGUNDO ACHADO — o número do ofício NÃO fica na ficha");
/* O código tenta gravar `OBSERVACOES_OFICIO` na ficha, dentro de um try com
   catch vazio e o comentário "campo opcional". Só que a coluna não existe na
   aba que o próprio sistema cria (SINDICALIZACAO_COLUNAS, Sindicalizacao.gs),
   e o `sindAdm_gravar_` NÃO lança erro quando o campo não tem coluna: ele
   descarta em silêncio. O catch nunca dispara porque não há o que capturar.

   Consequência: some o vínculo entre a ficha e o ofício que comunicou a
   filiação à escola. Depois, não há como saber qual ofício falou de qual
   trabalhador. */
const fichaDepois = g.listarFichasSindicalizacao({}, ADM);
const lista = (fichaDepois && (fichaDepois.fichas || fichaDepois.itens || [])) || [];
const minha = lista.filter(f => String(f.ID_FICHA || f.id || "") === String(IDF))[0];
b.ok(!!minha, "a ficha continua listável depois de encaminhada");

const temColuna = (g.SINDICALIZACAO_COLUNAS || []).indexOf("OBSERVACOES_OFICIO") >= 0;
b.ok(!temColuna,
  "confirmado: a coluna OBSERVACOES_OFICIO não existe no esquema do sistema",
  temColuna ? "existe — o achado mudou, revisar" : "ausente de SINDICALIZACAO_COLUNAS");
b.ok(!minha || !minha.OBSERVACOES_OFICIO,
  "e o número do ofício realmente não chegou à ficha",
  minha ? String(minha.OBSERVACOES_OFICIO || "(vazio, como previsto)") : "");

b.aviso(
  "o vínculo entre a ficha e o ofício se perde sem erro nenhum",
  "aprovarEEncaminharFicha grava OBSERVACOES_OFICIO na ficha, mas a coluna " +
  "não existe no esquema que o configurarAbaSindicalizacao cria, e o " +
  "sindAdm_gravar_ descarta campo sem coluna EM SILÊNCIO — não lança, então " +
  "o catch marcado como 'campo opcional' nunca dispara. Depois de aprovada, " +
  "não há como saber qual ofício comunicou qual filiação. NÃO corrigi: " +
  "acrescentar coluna é mudança de esquema numa aba com dado real, e o " +
  "configurarAbaSindicalizacao REESCREVE a linha 1 inteira — se a planilha " +
  "de produção tiver colunas além da lista, rodá-lo sobrescreveria o " +
  "cabeçalho delas. A decisão é do usuário (REGRA Nº 1 e Nº 0.5)"
);

b.passo("11. encaminhar de novo a mesma ficha não emite segunda matrícula");
/* A ficha agora está MATRICULADA, não ASSINADA. */
const denovo = g.aprovarEEncaminharFicha(IDF, ESCOLA, "Wanderson", ADM);
b.ok(denovo && denovo.sucesso === false,
  "a segunda tentativa é recusada",
  denovo && denovo.mensagem ? denovo.mensagem.substring(0, 52) : "");

b.fluxo("MÓDULO 03 · reemitir — a função sem tela");

b.passo("12. só ficha MATRICULADA pode ter ofício reemitido");
const reem = g.reemitirOficioFicha(IDF, ESCOLA, "Wanderson", ADM);
b.ok(reem && reem.sucesso === true, "a reemissão funciona",
  reem && reem.mensagem ? reem.mensagem.substring(0, 52) : "");
b.ok(/^\d{3}\/\d{4}$/.test(String(reem && reem.numeroOficio || "")),
  "e sai com número oficial próprio", String(reem && reem.numeroOficio || ""));
b.ok(String(reem.numeroOficio) !== String(r.numeroOficio),
  "que é DIFERENTE do primeiro — reemitir não reaproveita número");

b.passo("13. e escola sem CNPJ válido continua barrada na reemissão");
const reemRuim = g.reemitirOficioFicha(IDF, { nome: "X", cnpj: "123" }, "W", ADM);
b.ok(reemRuim && reemRuim.sucesso === false, "CNPJ curto é recusado");

b.passo("14. O ACHADO — nenhuma tela chama reemitirOficioFicha");
/* Cinco passos da REGRA Nº 1 rodados: cabeçalho, Code.gs e rotas, gatilhos,
   git log e grep no projeto inteiro. Só a declaração aparece. */
const arquivos = fs.readdirSync(RAIZ).filter(f => /\.(gs|html)$/.test(f));
const chamadores = arquivos.filter(function (a) {
  const src = fs.readFileSync(path.join(RAIZ, a), "utf8");
  return /reemitirOficioFicha\s*\(/.test(src) &&
         !/function\s+reemitirOficioFicha/.test(src);
});
b.igual(chamadores.length, 0,
  "confirmado: nenhum arquivo chama reemitirOficioFicha", chamadores.join(", "));

b.aviso(
  "o sistema manda apertar um botão que não existe",
  "quando o ofício falha depois da matrícula, a mensagem diz: \"Use " +
  "'Reemitir ofício' depois de verificar o arquivo\". A reemitirOficioFicha " +
  "existe, tem porta e funciona (provado nos passos 12 e 13) — mas nenhuma " +
  "tela a chama. A ficha fica MATRICULADA sem ofício e sem caminho pela " +
  "interface. Não é código morto: é código vivo sem porta de entrada, então " +
  "FICA. Falta a tela, e tela se desenha antes de implementar (REGRA Nº 0.5)"
);

b.fluxo("MÓDULO 03 · o achado de permissão, visto do outro lado");

b.passo("15. quem só tem SINDICALIZAÇÃO passa da porta e para no ofício");
/* O joscimar tem escolas+sindicalizacao. A porta de aprovarEEncaminharFicha
   pede sindicalizacao — ele passa. Mas o gerarOficioWeb lá dentro pede
   DOCUMENTOS, e aí ele para. Antes de 01/09/2026 essa parada era mentirosa:
   o token não descia, e a recusa vinha como "Sessão inválida ou expirada" —
   erro que manda a pessoa fazer login de novo para um problema que login
   nenhum resolve. Agora a mensagem diz a verdade. */
(function () {
  const env2 = g.submeterFichaSindicalizacao({
    nome: "João Carlos Lima", cpf: "529.982.247-25", rg: "7654321",
    dataNascimento: "1990-02-20", sexo: "M", estadoCivil: "SOLTEIRO",
    email: "joao.teste@exemplo.com", telefone: "(27) 98888-1111",
    celular: "(27) 98888-1111", cepResidencial: "29000-000",
    endereco: "Rua Dois, 200", numero: "200", bairro: "Centro",
    cidade: "Vitória", uf: "ES", escola: "Escola Modelo",
    cargo: "Professor", dataAdmissao: "2021-05-01", salario: "3000,00"
  });
  const id2 = env2 && (env2.idFicha || env2.id);
  const cod2 = g.CacheService.getScriptCache().get("SIND_OTP_" + id2) || "";
  g.validarOTPEAssinarFicha(id2, cod2, "127.0.0.1");

  const r2 = g.aprovarEEncaminharFicha(id2, ESCOLA, "Joscimar", SIN);
  b.ok(r2 && r2.parcial === true,
    "matrícula sai, ofício não — e o retorno avisa que ficou parcial",
    r2 && r2.mensagem ? r2.mensagem.substring(0, 58) : "");
  b.ok(/m[óo]dulo Documentos/i.test(String(r2 && r2.mensagem || "")),
    "E A MENSAGEM DIZ A VERDADE: falta o módulo Documentos",
    /sess[ãa]o inv[áa]lida/i.test(String(r2 && r2.mensagem || ""))
      ? "AINDA diz 'Sessão inválida' — a correção não pegou"
      : "nomeia o módulo que falta");
})();

b.aviso(
  "aprovar uma ficha exige DOIS módulos: Sindicalização E Documentos",
  "quem aprova ficha está fazendo trabalho de sindicalização; o ofício é " +
  "efeito colateral que o sistema gera por ela. Hoje, sem o módulo " +
  "Documentos, a pessoa emite a matrícula e não comunica a escola. É o mesmo " +
  "formato do item 52 (e-mail da escola atrás de outro módulo). Não mudei: " +
  "qual módulo guarda uma ação é política de acesso, e a decisão é do usuário"
);

b.naoTestavel(
  "se o e-mail com o ofício e a ficha anexada chega na escola",
  "o emulador registra o envio, não entrega. O que se prova aqui é que o " +
  "ofício entra na fila com o destino certo — a chegada só a produção diz"
);

b.resumo();
