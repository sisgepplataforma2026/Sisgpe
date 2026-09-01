/**
 * COMPASSO · A ANÁLISE VIRA CONFERÊNCIA, E AS DUAS CATEGORIAS GANHAM PORTA
 *
 * O QUE ORIGINOU — 26/08/2026
 *
 * O usuário abriu a gaveta de uma inscrição importada, viu o bloco ANÁLISE com
 * "Validar / Pendência / Reprovar" e perguntou: "Essa análise seria?". Depois:
 * "Deveria ser: Associado, Não associado e outro?".
 *
 * A pergunta estava certa sobre o ASSUNTO e errada sobre o REMÉDIO. Ele mesmo
 * fechou a regra do evento em seguida:
 *
 *   • ingresso próprio é só para ASSOCIADO;
 *   • ACOMPANHANTE é avulso, paga R$ 500, NÃO precisa de titular vinculado, e
 *     o cadastro "é feito diretamente pela equipe administrativa";
 *   • CONVIDADO é gratuito, por indicação da diretoria.
 *
 * Com essa regra, analisar uma inscrição pública deixa de ser julgamento e
 * vira CONFERÊNCIA: o CPF está na base de filiados ou não está. E o sistema já
 * sabia a resposta — o selo de vínculo estava impresso na linha da lista.
 *
 * E procurando onde o acompanhante nascia, apareceu o buraco de verdade:
 * `compasso_criarInclusaoAdministrativa` existia desde o commit e086213 e
 * NENHUMA tela a chamava. A equipe administrativa não tinha como cadastrar
 * acompanhante nem convidado. Motor pronto, sem porta.
 *
 * O QUE ESTE TESTE PROVA — executando, não lendo
 *
 * A conferência em lote sobre um banco com os três vínculos misturados; que
 * ela valida só quem deve; que NÃO reprova ninguém; que não desfaz decisão de
 * gente; a inclusão de convidado e de acompanhante pela porta nova; e as
 * recusas que protegem a regra de negócio.
 *
 * O QUE ELE NÃO PROVA: que o veredito APARECE na tela com a cor certa. jsdom
 * não aplica CSS e não desenha — isso continua "não testado" e está no
 * roteiro do item 34 de docs/PENDENTE-VERIFICACAO.md.
 */
const b = require("./base");
const { fluxo, passo, ok, igual, resumo } = b;

const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");   // ADMINISTRADOR
const FIN = b.logar(g, "rogerio");     // financeiro,rh — NÃO tem eventos

/* ─── Firestore em memória (mesma técnica do t91) ────────────────────────── */
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
g.fs_queryEquals_ = (col, campo, valor) => g.fs_list_(col, 10000)
  .filter(d => String(d[campo]) === String(valor));
g.fs_findByField_ = (col, campo, valor, limite) =>
  g.fs_queryEquals_(col, campo, valor).slice(0, limite || 100);

const props = g.PropertiesService.getScriptProperties();
props.setProperty("SISGEP_AMBIENTE", "HOMOLOGACAO");
props.setProperty("EVENTO_MODO_TESTE", "true");
props.setProperty("COMPASSO_QR_SECRET", "segredo-de-teste-nao-usar-em-producao");
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

/* ─── A base de associados: os TRÊS vínculos que existem ─────────────────── */
/* CPFs válidos de propósito — a busca normaliza, mas um CPF inventado esconde
   defeito de normalização atrás de "não achou mesmo". */
const CPF_FILIADO   = "11144477735";   // está na base, Filiado = S
const CPF_DESFILIADO = "52998224725";  // está na base, Filiado = N
const CPF_FORA      = "87748248800";   // não está na base

(function seedAssociados() {
  const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
  let aba = ss.getSheetByName(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  if (!aba) aba = ss.insertSheet(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  const linha = n => { const l = new Array(12).fill(""); n.forEach(([i, v]) => l[i] = v); return l; };
  aba.getRange(1, 1, 1, 12).setValues([[
    "ESCOLA", "NOME", "CPF", "FILIADO", "E", "F", "G", "CIDADE", "I", "CELULAR", "K", "EMAIL"]]);
  aba.getRange(2, 1, 1, 12).setValues([linha([
    [0, "EMEF Castelo Branco"], [1, "Maria Aparecida da Silva"], [2, CPF_FILIADO],
    [3, "S"], [7, "Vitória"], [11, "maria@exemplo.com"]])]);
  aba.getRange(3, 1, 1, 12).setValues([linha([
    [0, "EMEF Castelo Branco"], [1, "João Pedro Nunes"], [2, CPF_DESFILIADO],
    [3, "N"], [7, "Vitória"], [11, "joao@exemplo.com"]])]);
})();

fluxo("COMPASSO · Conferência de vínculo e a porta das duas categorias");

/* ══════════════════════════════════════════════════════════════════════════
   1 · O BANCO DE PARTIDA — os quatro casos que a planilha importada produz
   ══════════════════════════════════════════════════════════════════════════ */
passo("1 · monta o banco com os quatro casos que existem de verdade");

function semear(id, dados) {
  g.fs_set_("inscricoesEventos", id, Object.assign({
    inscricaoId: id, eventoId: g.EMISSAO_CFG.EVENTO_ID,
    status: g.COMPASSO_STATUS.RECEBIDA, vagaReservada: true,
    origem: "IMPORTACAO_TESTE", criadoEm: new Date()
  }, dados));
}

semear("INS-A", { nome: "Maria Aparecida da Silva", cpf: CPF_FILIADO,
                  situacaoAssociado: "NAO_ENCONTRADO" });   /* palpite VELHO de propósito */
semear("INS-B", { nome: "João Pedro Nunes", cpf: CPF_DESFILIADO });
semear("INS-C", { nome: "Fulano Sem Cadastro", cpf: CPF_FORA });
semear("INS-D", { nome: "Já Decidida", cpf: CPF_FILIADO,
                  status: g.COMPASSO_STATUS.REPROVADA,
                  motivoCodigo: "INSCRICAO_DUPLICADA",
                  analisadoPor: "outra.pessoa@sindeducacao.com" });

igual(g.fs_list_("inscricoesEventos").length, 4, "quatro inscrições no banco");

/* ══════════════════════════════════════════════════════════════════════════
   2 · A CONFERÊNCIA EM LOTE
   ══════════════════════════════════════════════════════════════════════════ */
passo("2 · conferir todas contra a base");

const r = g.compasso_conferirVinculoEmLote(ADM);
ok(r && r.ok === true, "a conferência roda e devolve ok");
igual(r.validadas, 1, "  validou exatamente 1 — só quem está na base filiado");
igual(r.naoFiliados, 1, "  contou 1 que consta na base sem filiação ativa");
igual(r.foraDaBase, 1, "  contou 1 fora da base");
igual(r.jaAnalisadas, 1, "  e deixou 1 já analisada de fora da contagem");
ok(!r.erros.length, "  sem erros por inscrição");

const A = g.fs_get_("inscricoesEventos", "INS-A");
igual(A.status, g.COMPASSO_STATUS.VALIDADA, "o filiado ficou VALIDADO");
igual(A.situacaoAssociado, "ASSOCIADO",
      "  e o vínculo foi RELIDO da base, não aproveitado do palpite gravado");
ok(A.analisadoPor === "wanderson@sindeducacao.com",
   "  com o carimbo de quem rodou a conferência");
ok(/conferência de vínculo em lote/i.test(String(A.observacaoAnalise || "")),
   "  e a observação diz que foi automática",
   "quem abrir em dezembro precisa saber que ninguém olhou caso a caso");

/* ── O QUE ELA NÃO PODE FAZER. Cada linha abaixo é uma decisão consciente,
      não uma limitação: reprovar em massa sobre uma leitura de base
      desatualizada apagaria inscrição de quem se filiou semana passada. ── */
const B = g.fs_get_("inscricoesEventos", "INS-B");
igual(B.status, g.COMPASSO_STATUS.RECEBIDA,
      "quem consta sem filiação ativa NÃO foi decidido pela máquina",
      "é o caso que exige julgamento — inadimplência, desfiliação ou erro de cadastro");
igual(B.situacaoAssociado, "NAO_FILIADO",
      "  mas o vínculo dele foi gravado, para a tela mostrar o veredito certo");

const C = g.fs_get_("inscricoesEventos", "INS-C");
igual(C.status, g.COMPASSO_STATUS.RECEBIDA, "quem está fora da base NÃO foi reprovado em lote");
igual(C.situacaoAssociado, "NAO_ENCONTRADO", "  e o vínculo dele também foi gravado");

const D = g.fs_get_("inscricoesEventos", "INS-D");
igual(D.status, g.COMPASSO_STATUS.REPROVADA, "a decisão de uma pessoa não foi desfeita");
igual(D.analisadoPor, "outra.pessoa@sindeducacao.com", "  nem o nome de quem decidiu");
igual(D.motivoCodigo, "INSCRICAO_DUPLICADA", "  nem o motivo que ela escreveu");

passo("2b · rodar de novo não muda nada (idempotência)");
const r2 = g.compasso_conferirVinculoEmLote(ADM);
igual(r2.validadas, 0, "a segunda passada não valida ninguém",
      "sem isto, clicar duas vezes recarimbaria o analisadoPor de todo mundo");
igual(g.fs_get_("inscricoesEventos", "INS-A").analisadoPor,
      "wanderson@sindeducacao.com", "  e o carimbo do primeiro continua de pé");

passo("2c · quem não é do módulo não confere nada");
let barrou = false;
try { g.compasso_conferirVinculoEmLote(FIN); } catch (e) { barrou = true; }
ok(barrou, "usuário sem o módulo Eventos é recusado",
   "conferência em lote muda status de muita gente de uma vez");

passo("2d · a conferência deixa trilha");
const trilha = g.fs_list_("auditoriaEventos")
  .filter(x => String(x.acao || "") === "CONFERENCIA_VINCULO_LOTE");
ok(trilha.length >= 1, "há registro de auditoria da conferência",
   trilha.length ? "" : "sem trilha, ninguém explica em dezembro por que 200 foram validadas juntas");

/* ══════════════════════════════════════════════════════════════════════════
   3 · A PORTA QUE FALTAVA — convidado e acompanhante
   ══════════════════════════════════════════════════════════════════════════ */
passo("3 · incluir convidado (gratuito, indicação da diretoria)");

const semIndicacao = g.compasso_criarInclusaoAdministrativa(
  { categoria: "convidado", nome: "Convidado Sem Padrinho" }, ADM);
ok(semIndicacao.ok === false, "convidado sem quem indicou é recusado",
   "é a única resposta possível para a pergunta que alguém faz na porta do salão");

const conv = g.compasso_criarInclusaoAdministrativa({
  categoria: "convidado", nome: "Vereador Convidado",
  email: "convidado@exemplo.com", indicadoPor: "Diretora Ana Paula" }, ADM);
ok(conv.ok === true, "convidado com indicação é aceito");
const docConv = g.fs_get_("inscricoesEventos", conv.inscricaoId);
igual(docConv.categoria, "convidado", "  gravado como convidado");
igual(docConv.indicadoPor, "Diretora Ana Paula", "  com o nome de quem indicou");
igual(docConv.status, g.COMPASSO_STATUS.VALIDADA,
      "  já nasce validado", "quem a equipe inclui não precisa de conferência de vínculo");
igual(docConv.origem, "ADMIN_CONVIDADO", "  e a origem separa do fluxo público");

passo("3b · incluir acompanhante (R$ 500, avulso, SEM titular)");
const acomp = g.compasso_criarInclusaoAdministrativa({
  categoria: "acompanhante", nome: "Acompanhante Avulso",
  cpf: CPF_FORA, whatsapp: "27999990000" }, ADM);
ok(acomp.ok === true, "acompanhante é aceito sem titular vinculado",
   'o usuário: "não precisa estar vinculado a um associado titular e pode ser avulso pagando"');
const docAc = g.fs_get_("inscricoesEventos", acomp.inscricaoId);
igual(docAc.categoria, "acompanhante", "  gravado como acompanhante");
igual(String(docAc.titularId || ""), "", "  com titular vazio, e isso não é erro");
ok(!docAc.pagamento || String(docAc.pagamento.status || "") !== "PAGO",
   "  e nasce SEM pagamento",
   "o dinheiro se registra na gaveta; dois lugares para receber é como se recebe duas vezes");

passo("3c · a porta recusa o que não é dela");
const tentaAssociado = g.compasso_criarInclusaoAdministrativa(
  { categoria: "associado", nome: "Quer Furar a Fila" }, ADM);
ok(tentaAssociado.ok === false, "incluir ASSOCIADO por aqui é recusado",
   "associado tem porta própria — o formulário público, que confere o vínculo");
const semNome = g.compasso_criarInclusaoAdministrativa(
  { categoria: "acompanhante", nome: "  " }, ADM);
ok(semNome.ok === false, "sem nome é recusado");

passo("3d · quem não é do módulo não inclui ninguém");
let barrou2 = false;
try { g.compasso_criarInclusaoAdministrativa(
  { categoria: "convidado", nome: "X", indicadoPor: "Y" }, FIN); } catch (e) { barrou2 = true; }
ok(barrou2, "usuário sem o módulo Eventos é recusado na inclusão");

passo("3e · a inclusão consome vaga e deixa trilha");
const reserva = g.fs_get_("reservasEventos", g.EMISSAO_CFG.EVENTO_ID);
ok(reserva && Number(reserva.reservadas) >= 2,
   "as duas inclusões reservaram vaga",
   "convidado é gratuito, mas ocupa cadeira igual — sem isso o salão estoura");
const trilhaInc = g.fs_list_("auditoriaEventos")
  .filter(x => String(x.acao || "") === "INCLUSAO_ADMINISTRATIVA");
igual(trilhaInc.length, 2, "as duas inclusões estão na auditoria");
ok(trilhaInc.some(t => /Ana Paula/.test(JSON.stringify(t))),
   "  e quem indicou o convidado ficou registrado na trilha também");

/* ══════════════════════════════════════════════════════════════════════════
   4 · A TELA — o que ela oferece em cada vínculo
   ══════════════════════════════════════════════════════════════════════════
   Aqui é leitura de arquivo, e está declarado: prova que o CAMINHO existe e
   aponta para a função certa. Que o quadro apareça com a cor certa depende de
   CSS, que jsdom não aplica — continua "não testado". */
passo("4 · a gaveta oferece o caminho certo para cada vínculo");
const fs = require("fs"), path = require("path");
const tela = fs.readFileSync(path.resolve(__dirname, "..", "..", "CompassoInscricoes.html"), "utf8");

ok(/function montarAnalise\(x\)/.test(tela), "há um veredito desenhado por vínculo");
ok(/montarAnalise\(x\);/.test(tela), "  e a gaveta o chama ao abrir",
   "função que ninguém chama é a definição de tela que não mudou");
["ASSOCIADO", "NAO_FILIADO", "NAO_ENCONTRADO"].forEach(s =>
  ok(new RegExp("s === '" + s + "'").test(tela), "  trata o caso " + s));
ok(/analiseValidar\(\)/.test(tela) && /analisePendencia\(\)/.test(tela) &&
   /analiseReprovar\(\)/.test(tela), "  com uma ação por caso");
ok(/NAO_E_ASSOCIADO/.test(tela),
   "reprovar por fora da base já vai com o motivo certo",
   "o motivo é o que fica na auditoria; deixá-lo para a pessoa escolher é pedir digitação do óbvio");
ok(/onclick="analiseManual\(\)"/.test(tela) && /id="aManual" hidden/.test(tela),
   "os três campos de sempre continuam, atrás de \"analisar manualmente\"",
   "automatizar não é decidir pela pessoa");
ok(/function decidir\(\)/.test(tela), "  e a decisão manual não foi removida");

passo("4b · a porta de incluir inscrição existe na tela");
ok(/onclick="abrirInclusao\(\)"/.test(tela), "há botão de incluir inscrição");
ok(/compasso_criarInclusaoAdministrativa/.test(tela),
   "  ligado à função que estava sem tela desde o commit e086213");
ok(/onclick="conferirVinculoTodas\(\)"/.test(tela), "há botão de conferir contra a base");
ok(/compasso_conferirVinculoEmLote/.test(tela), "  ligado à conferência em lote");
ok(!/id="incCidade"|id="incRegiao"|id="incEscola"/.test(tela),
   "a inclusão não pede cidade, região nem escola",
   "pedido do usuário: para convidado e acompanhante seriam três campos vazios sempre");
ok(/id="incIndicadoPor"/.test(tela) && /incIndicadoBox/.test(tela),
   "pede quem indicou, e só para convidado");
ok(/indicadoPor/.test(tela) && /Indicado por/.test(tela),
   "  e mostra isso no histórico da gaveta");

resumo();

/* ══════════════════════════════════════════════════════════════════════════
   5 · A GAVETA ENCOLHEU, E O CPF FICOU LEGÍVEL — 27/08/2026
   ══════════════════════════════════════════════════════════════════════════
   O usuário: "Acho que pode ser melhorado, esta sem mascara de telefone e
   CPF, tela muita grande, me de opções". Escolheu resumo no topo + tudo o
   mais recolhido.
   ══════════════════════════════════════════════════════════════════════════ */
fluxo('COMPASSO · A gaveta enxuta e as máscaras');

passo('5 · a formatação de CPF e telefone, executada');
/* Rodar a função de verdade, não conferir se ela existe. É lógica pura: dá
   para exercer no Node sem navegador nenhum, e é onde moram os casos que
   ninguém lembra — o 55 do país que a planilha trouxe, e o dado torto. */
const fsT = require('fs'), pathT = require('path');
const ler = arq => fsT.readFileSync(pathT.resolve(__dirname, '..', '..', arq), 'utf8');
const telaC = ler('CompassoInscricoes.html');
const corpoFmt = (telaC.match(/function fmtCpf\([\s\S]*?\n\}/) || [''])[0] +
                 (telaC.match(/function fmtTel\([\s\S]*?\n\}/) || [''])[0];
const fmt = {};
new Function('exports', corpoFmt + '\nexports.fmtCpf=fmtCpf;exports.fmtTel=fmtTel;')(fmt);

igual(fmt.fmtCpf('06907829770'), '069.078.297-70', 'CPF cru vira CPF pontuado');
igual(fmt.fmtCpf('069.078.297-70'), '069.078.297-70', '  e já pontuado continua igual');
igual(fmt.fmtCpf('123'), '123',
      'CPF torto sai como veio, sem inventar formato',
      'pontuar 11 dígitos que não existem esconderia o erro de cadastro');
igual(fmt.fmtCpf(''), '', '  vazio continua vazio');

igual(fmt.fmtTel('27999735890'), '(27) 99973-5890', 'celular de 11 dígitos');
igual(fmt.fmtTel('2733334444'), '(27) 3333-4444', 'fixo de 10 dígitos');
igual(fmt.fmtTel('5527999735890'), '(27) 99973-5890',
      'número com o 55 do país perde o prefixo',
      'a planilha importada trouxe assim; sem isto vira uma sequência que ninguém reconhece');
igual(fmt.fmtTel('279997358900'), '279997358900',
      'número com dígito a mais sai como veio',
      'é dado torto de verdade — o print do usuário tinha um desses');

passo('5b · a gaveta abre enxuta');
ok(/id="gvResumo"/.test(telaC), 'há um resumo de quem é a pessoa');
ok(/function montarResumo\(x\)/.test(telaC) && /montarResumo\(x\);/.test(telaC),
   '  desenhado ao abrir a gaveta');
['secDados','secIngresso','secComprovante','secHistorico'].forEach(id =>
  ok(new RegExp('id="' + id + '"').test(telaC) &&
     new RegExp("gvDobrar\\('" + id + "'\\)").test(telaC),
     '  ' + id + ' é seção recolhível'));
ok(/\.gv-dobra > \.gv-dobra-corpo\{max-height:0/.test(telaC.replace(/\s*\n\s*/g,'')),
   'as seções nascem FECHADAS',
   'era isso ou continuar rolando seis blocos abertos');
ok(/forEach\(function\(id\)\{ var el=g\(id\); if\(el\) el\.classList\.remove\('on'\); \}\)/.test(telaC),
   'e cada inscrição abre do zero, sem herdar o que ficou aberto na anterior',
   'sem isto o estado de uma pessoa vaza para a próxima e a tela cresce ao longo do dia');

passo('5c · as máscaras usam o helper do sistema, não uma cópia');
ok(/Utils\.aplicarMascaraCPF/.test(telaC) && /Utils\.aplicarMascaraTelefone/.test(telaC),
   'os campos usam Utils de Helpers.html',
   'é o que tem o dígito verificador certo — o CLAUDE.md proíbe reimplementar');
ok(/if \(MASCARAS_LIGADAS\) return;/.test(telaC),
   '  registrando o ouvinte uma vez só',
   'abrir a gaveta cem vezes registraria cem ouvintes no mesmo campo');
ok(/esc\(fmtCpf\(x\.cpf\)\)/.test(telaC) && /esc\(fmtTel\(x\.whatsapp\)/.test(telaC),
   'a LISTA também mostra formatado',
   'é onde a pessoa olha o dia todo, mais do que a gaveta');

passo('5d · o veredito não culpa um campo que está preenchido');
/* O print do usuário: CPF 06907829770 no campo, e embaixo "Sem CPF não dá
   para cruzar com a base". A frase mandava procurar defeito onde não havia —
   a causa real era não ter rodado a conferência. */
ok(/!String\(x\.cpf\|\|''\)\.replace\(\/\\D\/g,''\)/.test(telaC),
   'a tela distingue "sem CPF" de "ainda não conferido"');
ok(/Vínculo ainda não conferido/.test(telaC),
   '  e o caso comum tem frase própria');
ok(/Conferir contra a base<\/button>/.test(telaC),
   '  com o botão que resolve, ali mesmo',
   'dizer o que está errado sem oferecer a saída é meio caminho');

resumo();
