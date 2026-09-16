/**
 * TESTE — O DOCUMENTO QUE O ASSOCIADO ANEXA TEM DE CHEGAR A QUEM APROVA
 *
 * POR QUE ESTE ARQUIVO EXISTE — 16/09/2026.
 *
 * O usuário pediu que a Gestão de Bolsas funcionasse "no mesmo modelo da
 * festa: o associado faz a solicitação pelo link, aparecem os dados dele no
 * painel, com os documentos dele anexados, aprovamos ou não e enviamos".
 *
 * Auditando, eu afirmei que os documentos NÃO chegavam ao painel e que quem
 * aprovava aprovava às cegas. ERA FALSO. Cheguei nisso por um grep que não
 * achou `listarDocumentos*` e concluí ausência em vez de seguir o dado. A
 * cadeia existe inteira, e são cinco arquivos diferentes:
 *
 *   PortalVoucher.html:968   lê o arquivo em base64
 *   Voucher.gs:1255          grava no Drive e na aba Voucher_Documentos
 *   VoucherSolicitacao.gs:190 copia os links para a LINHA da solicitação
 *   Voucher.gs:1529          devolve linkContracheque/linkDocPessoal
 *   Scripts_Certificado.html:1449 desenha os dois botões no modal
 *
 * O QUE ESTE TESTE PROVA: que a corrente inteira aguenta, ponta a ponta, por
 * EXECUÇÃO. Nenhum dos 16 testes do módulo cobria esse caminho — todos param
 * antes ou depois dele. Uma corrente de cinco elos que ninguém puxa é uma
 * corrente que se descobre quebrada no dia da aprovação.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1: os botões
 * aparecendo no navegador, e o arquivo abrindo do Drive.
 */
const b = require("./base");

const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

let shA = ss.getSheetByName("Associados");
if (!shA) {
  shA = ss.insertSheet("Associados");
  shA.appendRow(["CPF", "Nome", "Filiado", "Email", "Celular"]);
}
const CPF = "11144477735";
shA.appendRow([CPF, "MARIA DE TESTE", "SIM", "maria@teste.com", "27999997777"]);

/* Base64 de verdade, não string solta: é ele que o Utilities.base64Decode
   recebe, e um valor inválido faria o teste passar por um caminho de erro
   silencioso em vez do caminho bom. */
const PDF_FALSO = Buffer.from("%PDF-1.4 teste de contracheque").toString("base64");
const JPG_FALSO = Buffer.from("\xFF\xD8\xFF teste de documento", "binary").toString("base64");

const PAYLOAD = {
  cpf: CPF,
  nome: "MARIA DE TESTE",
  dataNascimento: "1980-05-10",
  escolaAtual: "COLEGIO DE TESTE",
  situacaoSindicalDeclarada: "ASSOCIADO",
  tipoBeneficiario: "TITULAR",
  dataNascimentoBeneficiario: "1980-05-10",
  /* PÓS-GRADUAÇÃO de propósito: é o caso real que o usuário emitiu em
     produção (BOLSA-2026-817957, 70%). A primeira versão deste payload usava
     GRADUACAO com areaCurso "EDUCACAO" — que NÃO é área reconhecida pela
     convenção. A regra recusava, o percentual vinha vazio, e eu quase reportei
     isso como defeito do sistema. Era dado de teste inválido. */
  modalidade: "POS_GRADUACAO",
  curso: "MBA - GESTAO DE PROJETOS",
  periodoReferencia: "2026/2",
  regime: "SEMESTRAL",
  email: "maria@teste.com",
  telefone: "27999997777",
  contracheque: { nome: "contracheque.pdf", tipo: "application/pdf", tamanho: 30, base64: PDF_FALSO },
  docPessoal:   { nome: "rg.jpg",          tipo: "image/jpeg",      tamanho: 22, base64: JPG_FALSO }
};

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · Do link do associado até a mesa de quem aprova");

b.passo("1. O associado envia a solicitação pelo link, com os dois arquivos");
const enviado = g.salvarCadastroESolicitacaoVoucher(PAYLOAD);
/* `ok !== false` NÃO serve: a primeira versão desta linha passou VERDE com a
   solicitação rejeitada por falta de areaCurso, porque o retorno de erro é
   {ok:false, mensagem} e eu testei campos que nem existem. Asserção que passa
   no caminho de falha é pior do que asserção nenhuma. */
b.ok(enviado && enviado.ok === true,
  "o portal aceita a solicitação", (enviado && enviado.mensagem) || "sem retorno");
b.ok(enviado && !enviado.naoAssociado, "e não cai no caminho presencial, porque é filiada");
const protocolo = enviado && enviado.protocolo && enviado.protocolo.numeroProtocolo;
b.ok(!!protocolo, "veio com número de protocolo", protocolo);

b.passo("2. Os arquivos viraram arquivo no Drive, não bytes perdidos");
const shDocs = ss.getSheetByName("Voucher_Documentos");
b.ok(!!shDocs && shDocs.getLastRow() >= 3,
  "a aba Voucher_Documentos ganhou as DUAS linhas",
  shDocs ? (shDocs.getLastRow() - 1) + " linha(s)" : "aba não existe");

const cabDocs = shDocs.getRange(1, 1, 1, shDocs.getLastColumn()).getValues()[0];
const colDoc = n => cabDocs.indexOf(n);
const linhasDocs = shDocs.getRange(2, 1, shDocs.getLastRow() - 1, shDocs.getLastColumn()).getValues();
const tipos = linhasDocs.map(l => String(l[colDoc("TIPO_DOCUMENTO")] || ""));
b.ok(tipos.indexOf("DOCUMENTO_PESSOAL") > -1,
  "o documento pessoal foi classificado como tal", tipos.join(" | "));
b.ok(tipos.some(t => t && t !== "DOCUMENTO_PESSOAL"),
  "e o de vínculo recebeu o tipo inferido do que ela mandou", tipos.join(" | "));
/* O `length === 2` vem ANTES e junto: `every()` sobre lista vazia devolve
   TRUE, e foi assim que estas duas linhas passaram verdes enquanto a aba não
   tinha registro nenhum. Verdade vacuosa é a forma mais silenciosa de um
   teste mentir. */
b.ok(linhasDocs.length === 2 && linhasDocs.every(l => String(l[colDoc("LINK_ARQUIVO")] || "").length > 0),
  "as duas linhas têm link de arquivo — sem link, o anexo não existe para quem aprova",
  linhasDocs.length + " linha(s)");
b.ok(linhasDocs.length === 2 && linhasDocs.every(l => String(l[colDoc("ID_SOLICITACAO")] || "").length > 0),
  "e as duas apontam para a solicitação que as gerou");

b.passo("3. Os links foram copiados para a LINHA da solicitação");
/* É este o elo que o painel lê. Guardar só na aba de documentos deixaria o
   dado certo no lugar que a tela de aprovação não consulta. */
const shSol = ss.getSheetByName("Voucher_Solicitacoes");
const cabSol = shSol.getRange(1, 1, 1, shSol.getLastColumn()).getValues()[0];
/* Sem esta trava, quando nada foi gravado o getLastRow() devolve a linha 1 —
   o CABEÇALHO — e as asserções abaixo "passam" comparando com o próprio nome
   da coluna. Foi exatamente o que aconteceu na primeira execução. */
b.ok(shSol.getLastRow() >= 2, "existe ao menos uma solicitação gravada", shSol.getLastRow() + " linha(s)");
const linhaSol = shSol.getRange(shSol.getLastRow(), 1, 1, shSol.getLastColumn()).getValues()[0];
const valSol = n => String(linhaSol[cabSol.indexOf(n)] || "");
b.ok(valSol("LINK_CONTRACHEQUE").length > 0, "LINK_CONTRACHEQUE preenchido", valSol("LINK_CONTRACHEQUE"));
b.ok(valSol("LINK_DOC_PESSOAL").length > 0, "LINK_DOC_PESSOAL preenchido", valSol("LINK_DOC_PESSOAL"));
b.ok(valSol("LINK_CONTRACHEQUE") !== valSol("LINK_DOC_PESSOAL"),
  "e são arquivos DIFERENTES — o mesmo link nos dois campos seria o bug mais fácil de não notar");

b.passo("4. O painel de quem aprova recebe os dois links");
const lista = g.listarSolicitacoesCertBolsa(TOKEN);
b.ok(Array.isArray(lista) && lista.length > 0, "o painel lista a solicitação", lista.length + " item(ns)");
const minha = lista.filter(s => String(s.cpf || "").replace(/\D/g, "") === CPF)[0];
b.ok(!!minha, "e ela está lá, achável pelo CPF");
if (!minha) { b.resumo(); process.exit(1); }
b.ok(String(minha.linkContracheque || "").length > 0,
  "linkContracheque chega ao painel — é o que o modal desenha", minha.linkContracheque);
b.ok(String(minha.linkDocPessoal || "").length > 0,
  "linkDocPessoal também", minha.linkDocPessoal);
b.ok(minha.linkContracheque === valSol("LINK_CONTRACHEQUE"),
  "e é exatamente o que está gravado na linha, sem transformação pelo caminho");

b.passo("5. A trava de permissão vale para a lista do painel");
const TOKEN_SEM = b.logar(g, "joscimar");
b.bloqueia(() => g.listarSolicitacoesCertBolsa(TOKEN_SEM),
  "usuário sem o módulo Benefícios não lê as solicitações");

b.passo("6. Solicitação SEM anexo não inventa link");
/* O contrário do defeito: campo preenchido com lixo faria o modal mostrar um
   botão que abre nada, que é pior do que mostrar "Nenhum anexo". */
const semDocs = g.salvarCadastroESolicitacaoVoucher(
  Object.assign({}, PAYLOAD, { contracheque: null, docPessoal: null, periodoReferencia: "2027/1" }));
b.ok(semDocs && !semDocs.erro, "a solicitação sem anexo é aceita", (semDocs && semDocs.mensagem) || "");
const linhaSem = shSol.getRange(shSol.getLastRow(), 1, 1, shSol.getLastColumn()).getValues()[0];
b.ok(String(linhaSem[cabSol.indexOf("LINK_CONTRACHEQUE")] || "") === "",
  "e o campo fica VAZIO, não com link quebrado");

b.passo("7. O percentual chega ao painel, e o modal o mostra");
/* "Está definido, mas tem que conferir antes do envio" — você, 16/09/2026.

   O percentual é calculado pela regra da convenção na SOLICITAÇÃO e gravado
   em PERCENTUAL_APLICADO; a emissão lê o guardado e não recalcula. O modal de
   aprovação é o último ponto em que um valor errado ainda pode ser barrado
   por gente — e já houve um errado: certificado de Medicina com 70% onde o
   correto era 50%, achado em 17/08/2026 conferindo um PDF real. */
b.ok(String(minha.percentual || "").length > 0,
  "a lista do painel devolve o percentual gravado", minha.percentual);
b.ok(/^\d+$/.test(String(minha.percentual).replace("%", "").trim()),
  "e ele é um número, não texto solto", minha.percentual);

const fsP = require("fs");
const painelHtml = fsP.readFileSync(require("path").join(__dirname, "..", "..", "Scripts_Certificado.html"), "utf8");
b.ok(/id="cmi-percentual"/.test(painelHtml),
  "o modal tem onde mostrar o percentual");
b.ok(/id="cmi-pctOrigem"/.test(painelHtml),
  "e onde mostrar a ORIGEM do número — REGRA Nº 0.6, sugerir sem esconder de onde veio");
b.ok(/cert-pct-falta/.test(painelHtml),
  "com estado próprio para solicitação SEM percentual, que não pode passar como '—'");
b.ok(/s\.percentual/.test(painelHtml),
  "e a renderização lê o campo que o servidor manda");

b.fluxo("BOLSAS · O CPF chega ao painel com o zero que a planilha comeu");
/* O CASO REAL: o CPF 085.381.047-80 aparecia no painel como "8538104780".
   A planilha guarda a coluna como NÚMERO, e número não tem zero à esquerda.

   O conserto de fundo já existia — `formatarCpfVoucher_` completa os zeros e
   PROVA o resultado pelo dígito verificador antes de aceitar, e é por isso
   que o certificado e o e-mail sempre saíram certos. A lista do painel era o
   único lugar que ainda mostrava o número cru. */
b.ok(g.formatarCpfVoucher_("8538104780") === "085.381.047-80",
  "o formatador devolve o zero perdido", g.formatarCpfVoucher_("8538104780"));
b.ok(g.formatarCpfVoucher_("08538104780") === "085.381.047-80",
  "e é idempotente — CPF já íntegro passa igual");

/* NÃO INVENTA. Se o número completado não passar no dígito verificador, não
   era CPF com zero perdido: volta como veio. Documento com dado cru é ruim;
   documento com CPF fabricado que pertence a outra pessoa é muito pior. */
b.ok(g.formatarCpfVoucher_("999999999") === "999999999",
  "número que não vira CPF válido volta cru, sem chute",
  g.formatarCpfVoucher_("999999999"));

/* Sem `||` de escape: a solicitação do teste tem CPF de 11 dígitos válido, e
   o que se exige é a máscara. Um `||` que aceita "qualquer coisa que não
   tenha 11 dígitos" tornaria a asserção quase sempre verdadeira. */
const daMaria = g.listarSolicitacoesCertBolsa(TOKEN)
  .filter(x => String(x.cpf || "").replace(/\D/g, "") === CPF)[0];
b.ok(!!daMaria, "a solicitação é achável pelo CPF em dígitos, venha como vier");
b.ok(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(String(daMaria.cpf)),
  "e a LISTA do painel entrega o CPF formatado, não o número cru", daMaria.cpf);

b.fluxo("BOLSAS · A validação cadastral tem onde ser feita");
/* O ESTADO QUE NÃO TINHA FILA — 16/09/2026.

   Quem pede pelo portal e cujo CPF NÃO está na base de Associados fica em
   AGUARDANDO_VALIDACAO_CADASTRAL. Não é recusa: pode ser associado novo,
   ainda não lançado. O sistema pede conferência humana.

   Só que ela não tinha onde acontecer. Nenhum card de contagem cobria o
   status, o filtro não o oferecia, e não havia ação que o resolvesse. Uma
   solicitação real (Fucape) ficou parada, invisível em todos os indicadores.
   Este bloco existe para isso não voltar. */

/* Um CPF que a base NÃO conhece — é o que produz o estado. */
const CPF_FORA = "52998224725";
const foraDaBase = g.salvarCadastroESolicitacaoVoucher(
  Object.assign({}, PAYLOAD, { cpf: CPF_FORA, nome: "MARCELA DE TESTE",
                               periodoReferencia: "2028/1" }));
b.ok(foraDaBase && foraDaBase.ok, "a solicitação de quem não está na base é ACEITA — não recusada",
  (foraDaBase && foraDaBase.mensagem) || "");
b.ok(String(foraDaBase.status || "") === "AGUARDANDO_VALIDACAO_CADASTRAL",
  "e nasce aguardando validação cadastral", foraDaBase.status);

const protoFora = foraDaBase.protocolo.numeroProtocolo;
b.bloqueia(() => g.confirmarCadastroCertBolsa(protoFora, "", TOKEN_SEM),
  "usuário sem Benefícios não confirma cadastro");

const conf = g.confirmarCadastroCertBolsa(protoFora, "", TOKEN);
b.ok(conf.ok, "o administrador confirma o cadastro", conf.mensagem);

const depois = g.listarSolicitacoesCertBolsa(TOKEN)
  .filter(x => x.protocolo === protoFora)[0];
b.ok(depois && depois.status === "PENDENTE",
  "e a solicitação vai para a FILA DE ANÁLISE, não para aprovada",
  depois && depois.status);
b.ok(depois && /ASSOCIADO/i.test(String(depois.situacaoSindicalDeclarada || "")),
  "com a situação sindical registrada como associado",
  depois && depois.situacaoSindicalDeclarada);

/* CONFIRMAR NÃO É APROVAR. Se as duas decisões fossem a mesma, a conferência
   cadastral concederia benefício sem ninguém olhar a regra da convenção. */
b.ok(depois && depois.status !== "APROVADO",
  "confirmar cadastro NÃO aprova a bolsa — são duas decisões");

/* E não pode ser aplicado duas vezes: repetir jogaria de volta para PENDENTE
   uma solicitação já decidida, desfazendo-a em silêncio. */
const repetido = g.confirmarCadastroCertBolsa(protoFora, "", TOKEN);
b.ok(!repetido.ok && /não está aguardando/i.test(repetido.mensagem),
  "repetir é recusado, com o motivo dito", repetido.mensagem);
b.ok(g.confirmarCadastroCertBolsa("NAO-EXISTE", "", TOKEN).ok === false,
  "protocolo inexistente é recusado");

/* A TELA precisa mostrar a fila, senão a função existe e ninguém a alcança. */
const painelHtml2 = fsP.readFileSync(require("path").join(__dirname, "..", "..", "Scripts_Certificado.html"), "utf8");
b.ok(/id="certStatCadastro"/.test(painelHtml2), "o painel tem o card de validação cadastral");
/* Precisa CONTAR, não só ter o card: a primeira versão desta asserção tinha
   um `||` que a deixava quase sempre verdadeira — asserção que não pode
   falhar de novo, no mesmo dia. Aqui se exige a linha exata que incrementa. */
b.ok(/if\(st==='AGUARDANDO_VALIDACAO_CADASTRAL'\) vc\+\+;/.test(painelHtml2),
  "e conta esse status — antes ele não entrava em card nenhum");
b.ok(/certStatCadastro'\)\.textContent = vc;/.test(painelHtml2.replace(/g\('/g, "('")),
  "escrevendo a contagem no card");
b.ok(/<option value="AGUARDANDO_VALIDACAO_CADASTRAL">/.test(painelHtml2),
  "o filtro de status oferece a fila");
b.ok(/id="certBtnConfirmarCadastro"/.test(painelHtml2),
  "e existe o botão que resolve o estado");

b.fluxo("BOLSAS · Até três dependentes num envio só");
/* "Ele pode ter até três dependentes", "para os ensinos Infantil até o Médio",
   "se for na mesma escola, por associado", "tem que ter os documentos de cada
   dependente" — você, 16/09/2026. */
const DOC_DEP = Buffer.from("%PDF-1.4 rg do dependente").toString("base64");
function dependente(nome, ordem, nasc) {
  return {
    nomeBeneficiario: nome, dataNascimentoBeneficiario: nasc,
    tipoBeneficiario: "FILHO", parentesco: "FILHO", ordemFilho: String(ordem),
    modalidade: "ENSINO_FUNDAMENTAL", curso: (5 + ordem) + " ANO",
    docPessoal: { nome: nome + ".pdf", tipo: "application/pdf", tamanho: 25, base64: DOC_DEP }
  };
}
const basePai = Object.assign({}, PAYLOAD, { periodoReferencia: "2029/1" });
delete basePai.modalidade; delete basePai.curso; delete basePai.docPessoal;

const antesDeps = ss.getSheetByName("Voucher_Solicitacoes").getLastRow();
const tres = g.salvarSolicitacoesDependentesVoucher(Object.assign({}, basePai, {
  dependentes: [dependente("ANA", 1, "2016-03-02"),
                dependente("BRUNO", 2, "2014-07-19"),
                dependente("CLARA", 3, "2012-11-30")]
}));
b.ok(tres.ok && tres.gravadas === 3, "os três são gravados", tres.mensagem);
b.ok(tres.protocolos.length === 3 && new Set(tres.protocolos).size === 3,
  "cada um com protocolo PRÓPRIO — o certificado sai por pessoa",
  tres.protocolos.join(", "));

/* O PERCENTUAL DA CONVENÇÃO, por ordem: 1º e 2º a 100%, 3º a 60%. */
const porNome = {};
tres.resultados.forEach(r => { porNome[r.nome] = r; });
b.ok(porNome["ANA"].percentual === "100", "1º filho a 100%", porNome["ANA"].percentual);
b.ok(porNome["BRUNO"].percentual === "100", "2º filho a 100%", porNome["BRUNO"].percentual);
b.ok(porNome["CLARA"].percentual === "60", "3º filho a 60%", porNome["CLARA"].percentual);

b.ok(ss.getSheetByName("Voucher_Solicitacoes").getLastRow() === antesDeps + 3,
  "viraram TRÊS linhas, não uma com colunas repetidas");

/* CADA SOLICITAÇÃO CARREGA AS DUAS PROVAS: o vínculo do associado e o
   documento daquele dependente. Aprovar sem a prova anexada é aprovar às
   cegas — e cada uma é aprovada sozinha. */
const listaDeps = g.listarSolicitacoesCertBolsa(TOKEN)
  .filter(x => tres.protocolos.indexOf(x.protocolo) > -1);
b.ok(listaDeps.length === 3, "as três aparecem no painel", listaDeps.length + "");
b.ok(listaDeps.every(x => String(x.linkContracheque || "").length > 0),
  "todas com o comprovante de vínculo do associado");
b.ok(listaDeps.every(x => String(x.linkDocPessoal || "").length > 0),
  "e cada uma com o documento do SEU dependente");
b.ok(new Set(listaDeps.map(x => x.linkDocPessoal)).size === 3,
  "documentos DIFERENTES entre si — o mesmo link nas três seria o bug mais fácil de não notar");

b.passo("O teto de três, e a ordem repetida");
const quatro = g.salvarSolicitacoesDependentesVoucher(Object.assign({}, basePai, {
  periodoReferencia: "2029/2",
  dependentes: [dependente("A", 1, "2016-01-01"), dependente("B", 2, "2015-01-01"),
                dependente("C", 3, "2014-01-01"), dependente("D", 1, "2013-01-01")]
}));
b.ok(!quatro.ok && /até 3/i.test(quatro.mensagem), "quatro dependentes é recusado", quatro.mensagem);

const repetida = g.salvarSolicitacoesDependentesVoucher(Object.assign({}, basePai, {
  periodoReferencia: "2029/2",
  dependentes: [dependente("A", 1, "2016-01-01"), dependente("B", 1, "2015-01-01")]
}));
b.ok(!repetida.ok && /ordem/i.test(repetida.mensagem),
  "duas vezes o mesmo 1º filho é recusado ANTES de gravar qualquer coisa", repetida.mensagem);

b.passo("Quem está fora da regra é REGISTRADO, não recusado em silêncio");
/* "Ele deve ter uma informação e a Marcelha verifica e responde pelo SISGEP"
   — você. Bloquear em silêncio faz o sindicato perder o registro de que a
   pessoa procurou. */
const comVelho = g.salvarSolicitacoesDependentesVoucher(Object.assign({}, basePai, {
  periodoReferencia: "2030/1",
  dependentes: [dependente("JOVEM", 1, "2016-05-05"),
                dependente("VELHO", 2, "1980-05-05")]
}));
b.ok(comVelho.gravadas === 2,
  "o dependente fora da idade TAMBÉM é gravado — vai para a fila de análise",
  comVelho.mensagem);
const oVelho = g.listarSolicitacoesCertBolsa(TOKEN)
  .filter(x => x.protocolo === comVelho.resultados.filter(r => r.nome === "VELHO")[0].protocolo)[0];
b.ok(oVelho && oVelho.status === "BLOQUEADA_POR_REGRA",
  "com status que diz o porquê", oVelho && oVelho.status);
b.ok(comVelho.resultados.filter(r => r.nome === "VELHO")[0].apto === false,
  "e o portal recebe `apto: false` para avisar a pessoa na hora");

/* E A TELA PRECISA MOSTRAR ESSA FILA, senão o registro é tão invisível
   quanto a recusa muda que ele veio substituir. */
const painelHtml3 = fsP.readFileSync(require("path").join(__dirname, "..", "..", "Scripts_Certificado.html"), "utf8");
b.ok(/<option value="BLOQUEADA_POR_REGRA">/.test(painelHtml3),
  "o filtro do painel oferece 'Fora da regra'");
b.ok(/<option value="AGUARDANDO_ATENDIMENTO_PRESENCIAL">/.test(painelHtml3),
  "e o atendimento presencial, que também era invisível");
b.ok(/id="certStatRegra"/.test(painelHtml3) && /if\(st==='BLOQUEADA_POR_REGRA'\) fr\+\+;/.test(painelHtml3),
  "com card próprio e contagem de verdade");

b.naoTestavel("Os botões no navegador e o arquivo abrindo do Drive",
  "jsdom não renderiza o modal do painel; o Drive é dublê no emulador");
b.resumo();
