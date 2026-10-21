/**
 * TESTE — O INGRESSO EMITIDO VIRA ARQUIVO GUARDADO, COM NOME DE GENTE
 *
 * O QUE ORIGINOU, 09/09/2026. O usuário descreveu a operação inteira da festa
 * por voz, e uma etapa dela não existia no sistema:
 *
 *     inscrição no SISGEP → comprovante → análise individual → validação →
 *     INGRESSO GERADO E SALVO EM PASTA NOMINAL → envio pelo zap, em novembro
 *
 * E depois, em duas mensagens curtas, o formato do nome:
 *
 *     "Deve ser salvo nominal, com data e categoria"
 *     "Associado, acomapnahnte ou convidado"
 *
 * O que o código fazia: `compasso_ingressoPdf_` montava o PDF NA HORA e o
 * entregava direto como anexo. O arquivo nunca tocava o Drive.
 *
 * POR QUE ISSO ERA GRAVE, e não só uma ausência. O ingresso é emitido em
 * setembro e entregue em novembro. Sem acervo, o que sai em novembro não é o
 * arquivo conferido em setembro: é um arquivo NOVO, montado de novo, dependendo
 * de novo do quickchart.io responder e do conversor de PDF do Google se
 * comportar igual — dois meses depois, para 2.000 pessoas.
 *
 * O QUE ESTE TESTE MEDE: que o arquivo é gravado, onde é gravado, com que nome,
 * que não duplica, que a entrega passa a puxar do acervo, e que falhar no Drive
 * NÃO desfaz a emissão.
 *
 * O QUE ELE NÃO ALCANÇA: se o PDF abre, se o QR sai legível no papel, e se a
 * pasta do Drive de verdade aceita a escrita. O emulador registra a chamada;
 * quem responde isso é a pasta real. Ver as ressalvas no fim.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ADM = b.logar(g, "wanderson");

/* ─── Firestore em memória (mesmo padrão do t91) ─────────────────────────── */
const BANCO = new Map();
const chave = (col, id) => col + "/" + id;
const clonar = o => JSON.parse(JSON.stringify(o), (k, v) =>
  (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) ? new Date(v) : v);

g.fs_set_ = (col, id, obj) => { BANCO.set(chave(col, id), clonar(obj)); return { ok: true }; };
g.fs_get_ = (col, id) => { const v = BANCO.get(chave(col, id)); return v ? clonar(v) : null; };
g.fs_list_ = (col) => {
  const out = [];
  BANCO.forEach((v, k) => { if (k.indexOf(col + "/") === 0) out.push(clonar(v)); });
  return out;
};
g.fs_queryEquals_ = (col, campo, valor) =>
  g.fs_list_(col).filter(d => String(d[campo]) === String(valor));
g.fs_findByField_ = (col, campo, valor, limite) =>
  g.fs_queryEquals_(col, campo, valor).slice(0, limite || 100);

/* ─── Ambiente: HOMOLOGAÇÃO. É metade do que este teste existe para provar. ─ */
const props = g.PropertiesService.getScriptProperties();
props.setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual(true);   /* releitura: o cache pode ter sido preenchido na carga */
props.setProperty("EVENTO_MODO_TESTE", "true");
props.setProperty("COMPASSO_QR_SECRET", "segredo-de-teste-nao-usar-em-producao");
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

const PASTA_HML = g.RECURSOS_AMBIENTE.INGRESSOS_FESTA.homologacao;
const PASTA_PRD = g.RECURSOS_AMBIENTE.INGRESSOS_FESTA.producao;

/* ─── Base de associados do ambiente ─────────────────────────────────────── */
const CPF = "11144477735";
(function seedAssociados() {
  const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
  let aba = ss.getSheetByName(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  if (!aba) aba = ss.insertSheet(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  const linha = n => { const l = new Array(12).fill(""); n.forEach(([i, v]) => l[i] = v); return l; };
  aba.getRange(1, 1, 1, 12).setValues([[
    "ESCOLA", "NOME", "CPF", "FILIADO", "E", "F", "G", "CIDADE", "I", "CELULAR", "K", "EMAIL"]]);
  aba.getRange(2, 1, 1, 12).setValues([linha([
    [0, "EMEF Castelo Branco"], [1, "Maria Aparecida da Silva"], [2, CPF],
    [3, "S"], [7, "Vitória"], [9, "(27) 99876-5432"], [11, "mariaaparecida@gmail.com"]])]);
})();

/** Emite um ingresso do começo: inscrição → validação → emissão. */
function emitir(nome, cpf) {
  const r = g.compasso_inscrever({
    nome: nome, cpf: cpf, rg: "1234567", escola: "EMEF Castelo Branco",
    cidade: "Vitória", email: "teste@exemplo.com", whatsapp: "27998765432",
    termoAceito: true
  });
  if (!r.ok) throw new Error("inscrição recusada: " + r.erro);
  g.compasso_validarDecisaoAdmin(r.inscricaoId, "VALIDADA_ADMINISTRATIVAMENTE", "", "", ADM);
  const em = g.compasso_emitirIngressoV2({ inscricaoId: r.inscricaoId }, ADM);
  if (!em.ok) throw new Error("emissão recusada: " + em.erro);
  return { inscricaoId: r.inscricaoId, emissao: em };
}

const naPasta = id => amb.driveFiles.filter(f => f.parent === String(id) && !f.trashed);

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · emitir o ingresso grava o arquivo");
passo("a emissão produz um arquivo, e um só");

/* CONTAR A PASTA, NÃO O DRIVE INTEIRO. O emulador fabrica um arquivo toda vez
   que alguém chama `getFileById` com um id que ele não conhece — e a montagem
   do PDF busca a arte do ingresso assim. Contar `driveFiles.length` mediria o
   emulador, não o sistema. O que importa é o que entra NA PASTA DO ACERVO. */
const antesArquivos = naPasta(PASTA_HML).length;
const um = emitir("Maria Aparecida da Silva", CPF);
const ING_ID = um.emissao.id;

ok(um.emissao.arquivo && um.emissao.arquivo.ok === true,
   "a emissão devolve o arquivo gravado",
   um.emissao.arquivo ? um.emissao.arquivo.nome : "não devolveu campo arquivo");
igual(naPasta(PASTA_HML).length, antesArquivos + 1,
      "  e exatamente 1 arquivo foi criado na pasta do acervo");

passo("o arquivo está na pasta do AMBIENTE, não na da festa de verdade");

igual(naPasta(PASTA_HML).length, 1,
      "o arquivo caiu na pasta de HOMOLOGAÇÃO");
igual(naPasta(PASTA_PRD).length, 0,
      "e NENHUM arquivo caiu na pasta de PRODUÇÃO");
ok(PASTA_HML !== PASTA_PRD,
   "as duas pastas são de fato diferentes: " + PASTA_HML + " ≠ " + PASTA_PRD,
   "iguais, a trava do AmbienteRecursos.gs não teria o que separar");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · o nome do arquivo é a interface do acervo");
passo("carrega as três coisas que o usuário pediu");

const nome = um.emissao.arquivo.nome;
const ing = g.fs_get_("ingressos", ING_ID);

ok(nome.indexOf(ing.numero) === 0,
   "o número vem na frente: " + nome,
   "é o que ordena a pasta pela ordem de emissão e é a chave única");
ok(nome.indexOf("MARIA APARECIDA DA SILVA") > -1,
   "  o nome da pessoa está no arquivo (nominal)",
   'palavra dele: "deve ser salvo nominal"');
ok(nome.indexOf("ASSOCIADO") > -1,
   "  a categoria está no arquivo",
   '"Associado, acomapnahnte ou convidado"');
ok(/\d{2}-\d{2}-\d{4}\.pdf$/.test(nome),
   "  e a data, em dd-MM-aaaa: " + nome.slice(-14),
   "barra no nome quebra o Drive — por isso hífen");

passo("a data é a da EMISSÃO, não a de hoje");

/* Reprocessar o acervo em novembro não pode renomear para novembro um ingresso
   emitido em setembro. Quem garante isso é `ing.emitidoEm`, não `new Date()`. */
const emJulho = { ingressoId: "x", numero: "FCV-2026-000999", nome: "João da Silva",
                  categoria: "convidado", emitidoEm: new Date(2026, 6, 4, 10, 0, 0) };
igual(g.compasso_ingressoNomeArquivo_(emJulho),
      "FCV-2026-000999 - JOÃO DA SILVA - CONVIDADO - 04-07-2026.pdf",
      "um ingresso de julho continua nomeado como julho");

passo("acento fica; o que quebra o Drive sai");

igual(g.compasso_ingressoNomeArquivo_({
        ingressoId: "y", numero: "FCV-2026-000001", nome: "José da Conceição",
        categoria: "associado", emitidoEm: new Date(2026, 8, 9) }),
      "FCV-2026-000001 - JOSÉ DA CONCEIÇÃO - ASSOCIADO - 09-09-2026.pdf",
      "acento permanece — o arquivo é para gente ler");

ok(g.compasso_ingressoNomeArquivo_({
     ingressoId: "z", numero: "FCV/2026/2", nome: "Ana Maria",
     categoria: "acompanhante", emitidoEm: new Date(2026, 8, 9) }).indexOf("/") < 0,
   "barra no número vira espaço",
   "barra no nome de arquivo confunde o Drive e os clientes de sincronização");

ok(g.compasso_ingressoNomeArquivo_({ ingressoId: "w" }).indexOf("SEM-NOME") > -1,
   "ingresso sem nome vira SEM-NOME em vez de arquivo anônimo",
   "arquivo com nome vazio é arquivo que ninguém acha depois");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · o ingresso guarda onde o arquivo ficou");
passo("os quatro campos");

ok(!!ing.arquivoId,   "o ingresso guarda o arquivoId", ing.arquivoId);
ok(!!ing.arquivoNome, "  e o nome do arquivo",         ing.arquivoNome);
ok(!!ing.arquivoUrl,  "  e a URL");
ok(!!ing.arquivadoEm, "  e quando foi arquivado");
igual(ing.arquivoNome, nome, "  e o nome bate com o que foi gravado");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · arquivar duas vezes não cria duas cópias");
passo("idempotência pelo arquivoId");

const antesDup = naPasta(PASTA_HML).length;
const denovo = g.compasso_arquivarIngresso_(g.fs_get_("ingressos", ING_ID));
igual(denovo.novo, false, "a segunda chamada reconhece o arquivo que já existe");
igual(denovo.id, ing.arquivoId, "  e devolve o MESMO id");
igual(naPasta(PASTA_HML).length, antesDup, "  sem criar arquivo nenhum");

passo("baixar e imprimir também não duplicam");

const baixado = g.compasso_ingressoArquivo(um.inscricaoId, ADM);
ok(baixado.ok === true, "baixar o ingresso funciona");
igual(baixado.arquivo, nome, "  e entrega o arquivo DO ACERVO, com o nome do acervo");
igual(naPasta(PASTA_HML).length, antesDup,
      "  sem criar uma segunda cópia na pasta",
      "entregar por e-mail e depois pelo zap encheria a pasta de duplicata");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · a entrega passa a puxar do acervo");
passo("o PDF não é gerado de novo quando já existe arquivo");

let geracoes = 0;
const pdfOriginal = g.compasso_ingressoPdf_;
g.compasso_ingressoPdf_ = function (i, t) { geracoes++; return pdfOriginal(i, t); };

const doAcervo = g.compasso_ingressoPdfDoAcervo_(g.fs_get_("ingressos", ING_ID));
igual(geracoes, 0,
      "com arquivo no acervo, o PDF NÃO é montado de novo",
      "é o ponto da mudança: em novembro sai o arquivo conferido em setembro");
igual(doAcervo.getName(), nome, "  e o que volta é o arquivo do acervo");

passo("sem arquivo no acervo, ele grava e devolve");

const semAcervo = { ingressoId: g.compasso_uuid_(), numero: "FCV-2026-000500",
                    nome: "Pedro Alves", categoria: "convidado",
                    eventoId: g.EMISSAO_CFG.EVENTO_ID, status: "EMITIDO",
                    emitidoEm: new Date(2026, 8, 9) };
g.fs_set_("ingressos", semAcervo.ingressoId, semAcervo);

const antesLazy = naPasta(PASTA_HML).length;
g.compasso_ingressoPdfDoAcervo_(semAcervo);
igual(geracoes, 1, "  aí sim o PDF é montado");
igual(naPasta(PASTA_HML).length, antesLazy + 1,
      "  e fica gravado no acervo a partir de agora",
      "ingresso emitido antes desta mudança se conserta na primeira entrega");
ok(!!g.fs_get_("ingressos", semAcervo.ingressoId).arquivoId,
   "  com o arquivoId anotado no ingresso");

g.compasso_ingressoPdf_ = pdfOriginal;

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · falhar no Drive NÃO desfaz a emissão");
passo("o ingresso continua emitido, e o erro fica visível");

const salvarOriginal = g.arquivoSalvarPrivado_;
g.arquivoSalvarPrivado_ = function () { throw new Error("Drive fora do ar (simulado)"); };

const quebrado = emitir("Antonio Carlos Souza", "52998224725");

ok(quebrado.emissao.ok === true,
   "a emissão continua VÁLIDA mesmo com o Drive fora do ar",
   "o número já foi consumido e a vaga baixada — derrubar aqui faria a pessoa emitir de novo");
igual(quebrado.emissao.arquivo.ok, false, "  e o resultado diz que o arquivo falhou");
ok(String(quebrado.emissao.arquivo.erro).indexOf("Drive") > -1,
   "  com o motivo: " + quebrado.emissao.arquivo.erro);
igual(g.fs_get_("ingressos", quebrado.emissao.id).status, "EMITIDO",
      "  e o ingresso está EMITIDO no banco");
ok(g.fs_list_("auditoriaEventos").some(a => a.acao === "ARQUIVO_INGRESSO_FALHOU"),
   "  e a trilha registrou a falha",
   "falha silenciosa aqui vira ingresso sem arquivo descoberto só em novembro");

g.arquivoSalvarPrivado_ = salvarOriginal;

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · o acervo do que já foi emitido");
passo("a varredura grava o que falta");

const pendentes = g.compassoArquivarIngressosPendentes(50, ADM);
ok(pendentes.ok === true, "a varredura roda", pendentes.mensagem);
ok(pendentes.arquivados >= 1,
   "  e arquiva o que ficou para trás: " + pendentes.arquivados,
   "o do Drive fora do ar é justamente um desses");
ok(pendentes.jaTinham >= 2, "  reconhecendo os que já tinham arquivo: " + pendentes.jaTinham);

passo("rodar de novo não faz nada");

const antesSegunda = naPasta(PASTA_HML).length;
const segunda = g.compassoArquivarIngressosPendentes(50, ADM);
igual(segunda.arquivados, 0, "a segunda varredura não arquiva nada");
igual(naPasta(PASTA_HML).length, antesSegunda, "  e não cria arquivo nenhum");

passo("ingresso cancelado não entra no acervo");

const cancelado = emitir("Beatriz Lima Ferreira", "39053344705");
g.compasso_cancelarIngressoV2(cancelado.emissao.id, "teste de acervo", ADM);
const antesCancel = naPasta(PASTA_HML).length;
const terceira = g.compassoArquivarIngressosPendentes(50, ADM);
igual(terceira.arquivados, 0, "cancelado não é arquivado pela varredura");
igual(naPasta(PASTA_HML).length, antesCancel, "  e a pasta não muda");

passo("a varredura tem porta");

/* Sem token E sem usuário ativo — é o que um anônimo tem. Zerar o
   `__usuarioAtivoEmail` é o que reproduz isso: com ele preenchido, o emulador
   está simulando alguém logado no editor, que legitimamente passa. */
const quemEstava = g.__usuarioAtivoEmail;
g.__usuarioAtivoEmail = "";
let recusou = false;
try {
  const r = g.compassoArquivarIngressosPendentes(10);
  recusou = !!(r && r.ok === false);
} catch (e) { recusou = /sess|permiss|autoriza|administrador|login/i.test(e.message); }
g.__usuarioAtivoEmail = quemEstava;
ok(recusou, "sem sessão e sem usuário ativo, a varredura é recusada",
   "ela lê o acervo inteiro de 2.000 ingressos — não pode ser endpoint aberto");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · gravar o arquivo acontece FORA do lock da emissão");
passo("o lock já foi solto quando o Drive é chamado");

/* Gerar PDF é HTTP + conversão + escrita no Drive: alguns segundos, com rede
   no meio. O lock é do SCRIPT INTEIRO — segurá-lo por isso faria toda
   inscrição que chegasse no mesmo instante esperar. Com a inscrição aberta,
   é o pior momento possível para isso. */
let lockNaHoraDeGravar = null;
const salvarEspiao = g.arquivoSalvarPrivado_;
g.arquivoSalvarPrivado_ = function (blob, pasta, opcoes) {
  const ultimos = amb.lockEvents.filter(e => e.kind === "script");
  lockNaHoraDeGravar = ultimos.length ? ultimos[ultimos.length - 1].resultado : "(nenhum)";
  return salvarEspiao(blob, pasta, opcoes);
};

emitir("Carla Regina Nunes", "45317828791");

igual(lockNaHoraDeGravar, "LIBERADO",
      "o último evento do lock, na hora de gravar, é LIBERADO",
      "estivesse OBTIDO, a escrita no Drive estaria segurando a fila de inscrições");

g.arquivoSalvarPrivado_ = salvarEspiao;

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("FESTA · o que este teste NÃO prova");

naoTestavel("se a pasta real do Drive aceita a escrita",
  "o emulador registra a chamada e devolve um arquivo de mentira. Os IDs " +
  "1bNDz0... (produção) e 1fK5Kd... (homologação) só se provam gravando lá. " +
  "Rode compassoDiagnostico() no projeto — a linha 'Pasta dos ingressos' responde.");

naoTestavel("se o PDF gravado abre, e se o QR sai legível no papel",
  "o emulador não converte HTML em PDF: o blob é o próprio HTML. Quem responde " +
  "isso é abrir um arquivo da pasta e ler o QR com a câmera do celular.");

naoTestavel("se 2.000 arquivos numa pasta só continuam fáceis de achar",
  "a busca do Drive acha por nome, e o nome carrega número, pessoa, categoria " +
  "e data. Mas isso é uma aposta de desenho — quem confirma é a secretaria " +
  "procurando uma pessoa na pasta cheia.");

resumo();
