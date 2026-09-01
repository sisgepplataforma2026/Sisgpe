/**
 * EVENTOS — O CICLO DE VIDA INTEIRO, EXECUTADO DE UMA VEZ SÓ
 *
 * O QUE ORIGINOU
 *
 * 25/08/2026. O usuário mandou auditar o módulo de Eventos inteiro com uma
 * pergunta única no comando:
 *
 *   "O usuário consegue executar o processo real de Eventos do início ao fim,
 *    e o SISGEP entrega corretamente tudo aquilo que foi desenhado?"
 *
 * E o princípio que ele escreveu antes de tudo: não vale contar como
 * implementado porque existe função, botão, tela, coluna na planilha ou
 * chamada para o backend.
 *
 * POR QUE ESTE TESTE PRECISOU EXISTIR
 *
 * O módulo já tinha 691 asserções passando em 16 arquivos de teste (t73, t76 a
 * t90). Todas verdadeiras — e nenhuma delas percorria o processo. Cada uma
 * prova uma etapa isolada contra um estado montado à mão: t79 prova a
 * inscrição, t78 prova a entrega, t83 prova a busca do check-in. O que
 * ninguém tinha executado nem uma vez é a FRASE INTEIRA:
 *
 *   inscrição → validação → emissão → entrega → portaria → segunda leitura
 *
 * num mesmo banco, com o dado de cada etapa saindo da etapa anterior. É onde
 * moram os defeitos que a etapa isolada não vê: o campo que a emissão grava e
 * a entrega procura com outro nome, o contador que anda quando não devia, o
 * status que fica para trás.
 *
 * O QUE ESTE TESTE PROVA — E O QUE ELE NÃO PROVA
 *
 * PROVA: estado gravado, transição de status, reserva e devolução de vaga,
 * numeração, unicidade de QR, atomicidade do check-in, trilha de auditoria,
 * permissão por módulo, e os números do relatório conferidos contra o banco.
 *
 * NÃO PROVA, e nenhum código consegue: PDF legível, QR lido por câmera,
 * e-mail entregue na caixa de alguém, portaria com 8 celulares e internet
 * ruim. Esses continuam "não testado" e dependem das ondas 3 e 4 do
 * `docs/COMPASSO-PLANO-DE-TESTES.md`.
 *
 * O FIRESTORE AQUI É DE MENTIRA — E ISSO ESTÁ DECLARADO
 *
 * O Compasso guarda inscrição, ingresso e QR no Firestore, que fala por HTTP.
 * O emulador só REGISTRA UrlFetch, não responde. Então este teste troca as
 * cinco funções de transporte (`fs_get_`, `fs_set_`, `fs_queryEquals_`,
 * `fs_list_`, `fs_findByField_`) por um Map em memória.
 *
 * O que isso significa, sem eufemismo: a REGRA DE NEGÓCIO roda de verdade —
 * é o código real de `EventosInscricaoPublica.gs`, `EventosSeguranca.gs`,
 * `EventosEmissaoV2.gs`, `EventosCheckin.gs`. O FIRESTORE não. Um erro de
 * credencial, de índice, de limite de cota ou de latência não aparece aqui.
 */
const b = require("./base");
const { fluxo, passo, ok, igual, aviso, naoTestavel, resumo } = b;

const { g, amb } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");           // ADMINISTRADOR
const FIN = b.logar(g, "rogerio");             // financeiro,rh — NÃO tem eventos

/* ─── Firestore em memória ───────────────────────────────────────────────── */
const BANCO = new Map();
const chave = (col, id) => col + "/" + id;
const clonar = o => JSON.parse(JSON.stringify(o), (k, v) =>
  (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) ? new Date(v) : v);

g.fs_set_ = (col, id, obj) => { BANCO.set(chave(col, id), clonar(obj)); return { ok: true }; };
g.fs_get_ = (col, id) => {
  const v = BANCO.get(chave(col, id));
  return v ? clonar(v) : null;
};
g.fs_queryEquals_ = (col, campo, valor) => g.fs_list_(col, 10000)
  .filter(d => String(d[campo]) === String(valor));
g.fs_list_ = (col) => {
  const out = [];
  BANCO.forEach((v, k) => { if (k.indexOf(col + "/") === 0) out.push(clonar(v)); });
  return out;
};
g.fs_findByField_ = (col, campo, valor, limite) =>
  g.fs_queryEquals_(col, campo, valor).slice(0, limite || 100);

/** Conta quantos documentos existem numa coleção — a conferência do banco. */
const contar = col => g.fs_list_(col).length;

/* ─── Ambiente de homologação declarada ──────────────────────────────────── */
const props = g.PropertiesService.getScriptProperties();
props.setProperty("SISGEP_AMBIENTE", "HOMOLOGACAO");
props.setProperty("EVENTO_MODO_TESTE", "true");
props.setProperty("COMPASSO_QR_SECRET", "segredo-de-teste-nao-usar-em-producao");
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

/* ─── A base de associados do ambiente ───────────────────────────────────── */
/* Colunas conforme o cabeçalho que compasso_buscarAssociado_ lê:
   A escola · B nome · C CPF · D filiado · H cidade · J celular · L e-mail. */
const CPF_ASSOCIADO   = "11144477735";
const CPF_FORA_DA_BASE = "52998224725";

(function seedAssociados() {
  const ss = g.SpreadsheetApp.openById(g.getPlanilhaId());
  let aba = ss.getSheetByName(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  if (!aba) aba = ss.insertSheet(g.EMISSAO_CFG.ABA_ASSOCIADOS);
  const linha = n => { const l = new Array(12).fill(""); n.forEach(([i, v]) => l[i] = v); return l; };
  aba.getRange(1, 1, 1, 12).setValues([[
    "ESCOLA", "NOME", "CPF", "FILIADO", "E", "F", "G", "CIDADE", "I", "CELULAR", "K", "EMAIL"]]);
  aba.getRange(2, 1, 1, 12).setValues([linha([
    [0, "EMEF Castelo Branco"], [1, "Maria Aparecida da Silva"], [2, CPF_ASSOCIADO],
    [3, "S"], [7, "Vitória"], [9, "(27) 99876-5432"], [11, "mariaaparecida@gmail.com"]])]);
})();

fluxo("EVENTOS · O ciclo de vida inteiro, do link público à portaria");

/* ══════════════════════════════════════════════════════════════════════════
   E2E-00 · CRIAR UM EVENTO — o cenário 01 do comando de auditoria
   ══════════════════════════════════════════════════════════════════════════

   O comando pede: abrir Eventos → criar evento → preencher → salvar → ver na
   listagem → reabrir → conferir. Existe uma tela que faz isso: a Programação
   (`EventosAgenda.gs`). Este bloco a executa inteira — e mede até onde ela vai.
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-00 · criar, listar, reabrir e excluir um evento na Programação");

const antesAgenda = g.listarEventosAgenda(ADM).length;
const semNome = g.salvarEventoAgenda({ nome: "" }, ADM);
ok(semNome.ok === false, "criar evento sem nome é recusado", semNome.mensagem);

const criado = g.salvarEventoAgenda({
  nome: "Assembleia Geral Extraordinária", data: "2026-10-15",
  tipo: "Assembleia", status: "Planejado" }, ADM);
ok(criado.ok === true, "criar evento funciona", criado.id);

const agenda = g.listarEventosAgenda(ADM);
igual(agenda.length, antesAgenda + 1, "  e ele aparece na listagem");
const naLista = agenda.filter(e => e.id === criado.id)[0];
igual(naLista.nome, "Assembleia Geral Extraordinária", "  com o nome íntegro ao reabrir");
igual(naLista.status, "Planejado", "  e o status inicial");

const editado = g.salvarEventoAgenda({
  id: criado.id, nome: "Assembleia Geral Extraordinária", data: "2026-10-15",
  tipo: "Assembleia", status: "Realizado" }, ADM);
ok(editado.ok === true, "editar o evento funciona");
igual(g.listarEventosAgenda(ADM).filter(e => e.id === criado.id)[0].status,
      "Realizado", "  e a alteração persiste");

const excl = g.excluirEventoAgenda(criado.id, ADM);
ok(excl.ok === true, "excluir o evento funciona");
igual(g.listarEventosAgenda(ADM).filter(e => e.id === criado.id).length, 0,
      "  e ele sai da listagem");

/* ─── E AQUI ESTÁ O ACHADO ESTRUTURAL DA AUDITORIA ─── */
passo("E2E-00b · o que a Programação NÃO é");

const camposAgenda = Object.keys(g.listarEventosAgenda(ADM)[0] || naLista);
ok(camposAgenda.length <= 5,
   "a Programação guarda só " + camposAgenda.length + " campos: " + camposAgenda.join(", "),
   "o cenário 02 do comando pede local, modalidade, público, limite de " +
   "participantes, período de inscrição, responsáveis, imagem, regras, anexos — " +
   "nada disso existe");

ok(!g.EMISSAO_CFG.EVENTO_ID.match(/^EVT/),
   "e a Festa NÃO é um registro criado por ninguém: é uma constante no código",
   "EMISSAO_CFG.EVENTO_ID = '" + g.EMISSAO_CFG.EVENTO_ID + "', vagas " +
   g.EMISSAO_CFG.LIMITE_VAGAS + ", data e período fixos em EventosEmissao.gs");

const idsAgenda = g.listarEventosAgenda(ADM).map(e => e.id);
ok(idsAgenda.indexOf(g.EMISSAO_CFG.EVENTO_ID) < 0,
   "  e ela nem aparece na Programação",
   "criar um evento na Programação não cria inscrição, ingresso, vaga nem " +
   "check-in; e o único evento que TEM tudo isso não está na Programação. " +
   "São dois mundos que não se falam.");

/* ══════════════════════════════════════════════════════════════════════════
   E2E-01 · A INSCRIÇÃO PÚBLICA
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-01 · a pessoa se inscreve pelo link");

const estado = g.compasso_inscricaoEstado();
ok(estado.aberta === true, "as inscrições estão abertas");
ok(!!estado.termo && estado.termo.length > 100, "o termo vem do servidor, não da tela");
ok(estado.vagas === undefined,
   "  e a tela pública NÃO recebe a contagem de vagas",
   "decisão do código: capacidade é indicador administrativo, e mostrar " +
   "'restam 12' numa página pública cria corrida por vaga");

/* O preenchimento automático — a REGRA Nº 0.6 em execução. */
const prefill = g.compasso_inscricaoPreencher(CPF_ASSOCIADO);
ok(prefill.ok === true, "CPF da base → a tela nasce preenchida");
igual(prefill.nome, "Maria Aparecida da Silva", "  com o nome do cadastro");
ok(prefill.email.indexOf("mariaaparecida") < 0 && prefill.email.indexOf("@gmail.com") > 0,
   "  e o contato mascarado: " + prefill.email,
   "endpoint público não devolve base de 8.000 contatos");

const ANTES_INSC = contar("inscricoesEventos");
const r1 = g.compasso_inscrever({
  nome: "Maria Aparecida da Silva", cpf: CPF_ASSOCIADO, rg: "1234567",
  escola: "EMEF Castelo Branco", cidade: "Vitória",
  email: prefill.email, whatsapp: prefill.whatsapp, termoAceito: true
});
ok(r1.ok === true, "a inscrição é aceita", r1.ok ? r1.inscricaoId : r1.erro);
const INS_ID = r1.inscricaoId;

/* TESTE 16 do comando: o estado do banco ANTES e DEPOIS. */
igual(contar("inscricoesEventos"), ANTES_INSC + 1, "  e o banco ganhou exatamente 1 registro");

const insGravada = g.fs_get_("inscricoesEventos", INS_ID);
igual(insGravada.status, "RECEBIDA", "  gravada em RECEBIDA");
igual(insGravada.eventoId, "festa-compasso-2026", "  amarrada ao evento certo");
igual(insGravada.vagaReservada, true, "  com a vaga reservada");
igual(insGravada.email, "mariaaparecida@gmail.com",
      "  e o e-mail REAL no banco, não a máscara",
      "a máscara é para os olhos da pessoa, nunca para o banco");
ok(!!insGravada.termoHash && !!insGravada.termoAceitoEm,
   "  com o aceite do termo carimbado (versão, hash e hora)");
ok(/^INS-/.test(INS_ID), "  e um ID técnico próprio, não o CPF como chave");

const auditInsc = g.fs_list_("auditoriaEventos").filter(a => a.entidadeId === INS_ID);
ok(auditInsc.length === 1 && auditInsc[0].acao === "INSCRICAO_PUBLICA",
   "  a trilha de auditoria registrou a inscrição");

const reserva = g.fs_get_("reservasEventos", "festa-compasso-2026");
igual(Number(reserva.reservadas), 1, "  e o contador de vagas andou 1");

/* ─── TESTE 2 e 3 do comando: obrigatórios e inválidos ─── */
passo("E2E-01b · o que o servidor recusa");

const recusas = [
  [{ nome: "Maria", cpf: CPF_FORA_DA_BASE, escola: "X", cidade: "Y", email: "a@b.com", termoAceito: true },
   "nome", "nome sem sobrenome"],
  [{ nome: "Fulano de Tal", cpf: "11144477730", escola: "X", cidade: "Y", email: "a@b.com", termoAceito: true },
   "cpf", "CPF com dígito verificador errado"],
  [{ nome: "Fulano de Tal", cpf: "11111111111", escola: "X", cidade: "Y", email: "a@b.com", termoAceito: true },
   "cpf", "CPF de dígitos repetidos"],
  [{ nome: "Fulano de Tal", cpf: CPF_FORA_DA_BASE, escola: "", cidade: "Y", email: "a@b.com", termoAceito: true },
   "escola", "sem escola"],
  [{ nome: "Fulano de Tal", cpf: CPF_FORA_DA_BASE, escola: "X", cidade: "", email: "a@b.com", termoAceito: true },
   "cidade", "sem cidade"],
  [{ nome: "Fulano de Tal", cpf: CPF_FORA_DA_BASE, escola: "X", cidade: "Y", email: "", whatsapp: "", termoAceito: true },
   "email", "sem e-mail E sem WhatsApp — não haveria como entregar"],
  [{ nome: "Fulano de Tal", cpf: CPF_FORA_DA_BASE, escola: "X", cidade: "Y", email: "a@b.com", termoAceito: false },
   "termo", "sem aceitar o termo"]
];
const antesRecusas = contar("inscricoesEventos");
recusas.forEach(([dados, campo, rotulo]) => {
  const r = g.compasso_inscrever(dados);
  ok(r.ok === false && r.campo === campo, "recusa: " + rotulo,
     r.ok ? "ACEITOU — defeito" : r.erro);
});
igual(contar("inscricoesEventos"), antesRecusas,
      "  e nenhuma recusa deixou lixo no banco");

/* CPF fora da base é ACEITO — decisão do usuário: a festa não é só de filiado. */
const rFora = g.compasso_inscrever({
  nome: "João Pereira Santos", cpf: CPF_FORA_DA_BASE, escola: "EMEF Nova",
  cidade: "Serra", email: "joao@exemplo.com", termoAceito: true });
ok(rFora.ok === true, "CPF fora da base → aceita e marca a situação");
igual(g.fs_get_("inscricoesEventos", rFora.inscricaoId).situacaoAssociado,
      "NAO_ENCONTRADO", "  com o selo NAO_ENCONTRADO para a análise decidir");

/* ══════════════════════════════════════════════════════════════════════════
   E2E-02 · A VALIDAÇÃO ADMINISTRATIVA
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-02 · a secretaria analisa");

const lista = g.compasso_validacaoListar({}, ADM);
ok(Array.isArray(lista) && lista.length === 2,
   "a Central de Inscrições lista as 2 inscrições",
   "obtido: " + (lista || []).length);
ok(lista.some(i => i.inscricaoId === INS_ID), "  com a inscrição da Maria");

const resumo1 = g.compasso_validacaoResumo(ADM);
igual(Number(resumo1.total), 2, "o resumo bate com o banco: total");
igual(Number(resumo1.naoAnalisadas), 2, "  todas ainda por analisar");

/* TESTE 3: status inválido é recusado no BACKEND, não só na tela. */
let barrou = false;
try { g.compasso_validarDecisaoAdmin(INS_ID, "INVENTADO", "", "", ADM); }
catch (e) { barrou = /inválido/i.test(e.message); }
ok(barrou, "status inventado é recusado pelo servidor");

let semMotivo = false;
try { g.compasso_validarDecisaoAdmin(INS_ID, "REPROVADA", "", "", ADM); }
catch (e) { semMotivo = /motivo/i.test(e.message); }
ok(semMotivo, "reprovar sem motivo é recusado");

const val = g.compasso_validarDecisaoAdmin(INS_ID, "VALIDADA_ADMINISTRATIVAMENTE", "", "", ADM);
ok(val.ok === true, "validar funciona");
const insVal = g.fs_get_("inscricoesEventos", INS_ID);
igual(insVal.status, "VALIDADA_ADMINISTRATIVAMENTE", "  status persistido");
ok(!!insVal.analisadoPor && !!insVal.analisadoEm,
   "  com quem analisou e quando: " + insVal.analisadoPor);
ok(g.fs_list_("auditoriaEventos").some(
     a => a.entidadeId === INS_ID && a.acao === "VALIDACAO_ADMINISTRATIVA"),
   "  e a trilha registrou a decisão");

/* ══════════════════════════════════════════════════════════════════════════
   E2E-03 · A EMISSÃO DO INGRESSO
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-03 · o ingresso é emitido");

const em1 = g.compasso_emitirIngressoV2({ inscricaoId: INS_ID }, ADM);
ok(em1.ok === true, "a emissão funciona", em1.ok ? em1.numero : em1.erro);
const ING_ID = em1.id, QR_TOKEN = em1.qrToken;

igual(contar("ingressos"), 1, "  1 ingresso no banco");
const ing = g.fs_get_("ingressos", ING_ID);
igual(ing.status, "EMITIDO", "  em EMITIDO");
ok(/^FCV-2026-\d+$/.test(ing.numero), "  com número sequencial: " + ing.numero);
igual(ing.inscricaoId, INS_ID, "  amarrado à inscrição que o originou");
ok(!ing.qrToken && !!ing.qrTokenHash,
   "  e o banco guarda o HASH do QR, nunca o token",
   "quem lê o banco não consegue fabricar um ingresso");

const insDepois = g.fs_get_("inscricoesEventos", INS_ID);
igual(insDepois.ingressoId, ING_ID, "  a inscrição aponta de volta para o ingresso");
igual(insDepois.numeroIngresso, ing.numero, "  e guarda o número");

const contador = g.fs_get_("contadores", "festa-compasso-2026");
igual(Number(contador.vagasUsadas), 1, "  o contador de vagas usadas andou 1");

/* TESTE 4 do comando: duplicidade / idempotência. */
const em2 = g.compasso_emitirIngressoV2({ inscricaoId: INS_ID }, ADM);
ok(em2.ok === false && /já possui/i.test(em2.erro || ""),
   "emitir de novo a MESMA inscrição é recusado", em2.erro);
igual(contar("ingressos"), 1, "  e nenhum segundo ingresso foi criado");
igual(Number(g.fs_get_("contadores", "festa-compasso-2026").vagasUsadas), 1,
      "  nem o contador andou de novo");

/* Emitir sem validar. */
const emSemVal = g.compasso_emitirIngressoV2({ inscricaoId: rFora.inscricaoId }, ADM);
ok(emSemVal.ok === false && /valida/i.test(emSemVal.erro || ""),
   "emitir uma inscrição NÃO validada é recusado", emSemVal.erro);

/* ══════════════════════════════════════════════════════════════════════════
   E2E-04 · A ENTREGA
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-04 · o ingresso chega na mão da pessoa");

/* O canal principal é o WhatsApp — o usuário foi explícito em 25/08:
   "os ingressos são enviados por WhatsApp, prioritariamente". */
const zap = g.compasso_prepararIngressoWhatsApp(INS_ID, ADM);
ok(zap.ok === true, "o WhatsApp é preparado com link e texto prontos");
ok(/^55\d{10,11}$/.test(String(zap.telefone || "")),
   "  com o telefone já no formato internacional: " + zap.telefone,
   "sem o 55 o link do WhatsApp não abre a conversa");
ok(String(zap.texto || "").indexOf(ing.numero) > 0,
   "  e o texto traz o número do ingresso");
ok(String(zap.url || "").indexOf("?page=ingresso") > 0,
   "  e o link público do ingresso: " + String(zap.url || "").slice(0, 55) + "…");

const antesEnvio = g.fs_get_("inscricoesEventos", INS_ID);
ok(!String(antesEnvio.entregaCanais || ""),
   "  PREPARAR ainda não é ENTREGAR — nada foi marcado",
   "o sistema não sabe se a pessoa apertou enviar no aplicativo; quem confirma é ela");

const conf = g.compasso_confirmarEnvioWhatsApp(INS_ID, ADM);
ok(conf.ok === true, "confirmar o envio marca a entrega");
const depoisEnvio = g.fs_get_("inscricoesEventos", INS_ID);
ok(String(depoisEnvio.entregaCanais || "").indexOf("WHATSAPP") >= 0,
   "  com o canal registrado na inscrição: " + depoisEnvio.entregaCanais);
ok(!!depoisEnvio.entregaEm || !!depoisEnvio.entregaUltimaEm,
   "  e a data da entrega");

/* O e-mail: aqui só se prova que a chamada saiu e o que ela levava.
   Entrega em caixa de e-mail nenhum teste alcança. */
const antesOutbox = amb.outbox.length;
const mail = g.compasso_enviarIngressoEmail(INS_ID, ADM);
ok(mail.ok === true, "o envio por e-mail executa sem erro", mail.ok ? "" : mail.erro);
ok(amb.outbox.length > antesOutbox, "  e uma mensagem foi realmente despachada");
const msg = amb.outbox[amb.outbox.length - 1];
ok(String(msg.to || "").indexOf("mariaaparecida@gmail.com") >= 0,
   "  para o e-mail certo: " + msg.to);
naoTestavel("o e-mail chega na caixa da pessoa",
            "MailApp é registrado, não entregue — só a caixa real prova");
naoTestavel("o PDF abre e o QR é legível por câmera",
            "getAs(PDF) não roda aqui; é a onda 1 do plano, aberta desde 21/08");

/* ══════════════════════════════════════════════════════════════════════════
   E2E-06 · A PORTARIA
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-06 · a entrada no dia da festa");

/* Ver o ingresso não pode consumir a entrada — a pessoa confere o próprio em
   casa. É a separação entre a rota pública e o check-in. */
const antesVer = g.fs_get_("ingressos", ING_ID).status;
try { g.compasso_validarQrTokenPublico_(QR_TOKEN); } catch (e) {}
igual(g.fs_get_("ingressos", ING_ID).status, antesVer,
      "abrir o ingresso NÃO marca entrada");

const ck1 = g.compasso_checkinValidarToken(QR_TOKEN, "CEL-PORTARIA-A", ADM);
ok(ck1 && ck1.ok === true, "a primeira leitura do QR libera a entrada",
   ck1 && ck1.ok ? ck1.nome : (ck1 && ck1.erro));
const ingCk = g.fs_get_("ingressos", ING_ID);
igual(ingCk.status, "UTILIZADO", "  o ingresso passa a UTILIZADO");
ok(!!ingCk.utilizadoEm && !!ingCk.utilizadoPor,
   "  com hora e operador gravados: " + ingCk.utilizadoPor);
igual(ingCk.dispositivoId, "CEL-PORTARIA-A",
      "  e o aparelho que leu",
      "com 8 celulares na portaria, saber qual leu é o que permite auditar depois");
igual(contar("checkinsEventos"), 1, "  e 1 check-in no banco");

/* O P0 do plano de riscos: o mesmo QR em dois aparelhos. */
const ck2 = g.compasso_checkinValidarToken(QR_TOKEN, "CEL-PORTARIA-B", ADM);
ok(ck2 && ck2.ok === false, "a SEGUNDA leitura do mesmo QR é recusada",
   ck2 && ck2.erro);
igual(contar("checkinsEventos"), 1, "  e continua 1 check-in, não 2");

const qrInventado = g.compasso_checkinValidarToken("token-que-nao-existe", "CEL-A", ADM);
ok(qrInventado && qrInventado.ok === false, "QR inventado é recusado");

/* Contingência: celular descarregado, QR rasgado — a busca manual. */
const busca = g.compasso_checkinBuscarManual("Maria", ADM);
ok(Array.isArray(busca) && busca.length >= 1,
   "a busca manual acha a pessoa pelo nome",
   "é o caminho quando o QR não pode ser lido");
const buscaNum = g.compasso_checkinBuscarManual(ing.numero, ADM);
ok(Array.isArray(buscaNum) && buscaNum.length === 1,
   "  e pelo número do ingresso também");
const buscaCpf = g.compasso_checkinBuscarManual(CPF_ASSOCIADO, ADM);
ok(Array.isArray(buscaCpf) && buscaCpf.length === 1,
   "  e pelo CPF");

/* Desfazer: alguém leu o ingresso errado. */
const desfazer = g.compasso_desfazerCheckin(ING_ID, "Leitura equivocada na portaria", ADM);
ok(desfazer && desfazer.ok === true, "desfazer o check-in funciona");
igual(g.fs_get_("ingressos", ING_ID).status, "EMITIDO",
      "  e o ingresso volta a poder entrar");
const ck3 = g.compasso_checkinValidarToken(QR_TOKEN, "CEL-PORTARIA-A", ADM);
ok(ck3 && ck3.ok === true, "  a leitura seguinte é aceita de novo");

/* ══════════════════════════════════════════════════════════════════════════
   E2E-07 · CANCELAR, REPROVAR, EXCLUIR — as ações reversas
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-07 · desfazer sem corromper a contagem");

let semMotivoCanc = false;
try { g.compasso_cancelarIngressoV2(ING_ID, "", ADM); }
catch (e) { semMotivoCanc = /motivo/i.test(e.message); }
ok(semMotivoCanc, "cancelar sem motivo é recusado");

/* Este ingresso JÁ ENTROU na festa. Cancelar depois da entrada não pode
   devolver a vaga: a pessoa está lá dentro, e a vaga foi consumida de fato. */
const usadasAntes = Number(g.fs_get_("contadores", "festa-compasso-2026").vagasUsadas);
const canc = g.compasso_cancelarIngressoV2(ING_ID, "Desistência da associada", ADM);
ok(canc && canc.ok === true, "cancelar o ingresso funciona", canc && canc.erro);
igual(g.fs_get_("ingressos", ING_ID).status, "CANCELADO", "  status CANCELADO");
igual(Number(g.fs_get_("contadores", "festa-compasso-2026").vagasUsadas), usadasAntes,
      "  cancelar DEPOIS da entrada não devolve a vaga",
      "a pessoa já entrou — devolver aqui abriria uma vaga que não existe mais");
ok(canc.avisoJaEntrou === true,
   "  e o sistema avisa que essa pessoa já tinha entrado");

const ckCanc = g.compasso_checkinValidarToken(QR_TOKEN, "CEL-A", ADM);
ok(ckCanc && ckCanc.ok === false, "ingresso cancelado NÃO entra na festa",
   "é P0 do registro de riscos");

/* Reprovar libera a vaga da reserva. */
const reservaAntes = Number(g.fs_get_("reservasEventos", "festa-compasso-2026").reservadas);
const rep = g.compasso_validarDecisaoAdmin(
  rFora.inscricaoId, "REPROVADA", "DADOS_INCONSISTENTES", "", ADM);
ok(rep.ok === true, "reprovar funciona com motivo do catálogo");
igual(Number(g.fs_get_("reservasEventos", "festa-compasso-2026").reservadas),
      reservaAntes - 1, "  e devolve a vaga reservada");

/* Excluir — só administrador, e nunca com ingresso ativo. */
passo("E2E-07b · a exclusão é do administrador, e nunca em cima de ingresso ativo");

const semMotivoExc = g.compasso_excluirInscricao(rFora.inscricaoId, "", ADM);
ok(semMotivoExc && semMotivoExc.ok === false, "excluir sem motivo é recusado",
   semMotivoExc && semMotivoExc.erro);

const exc = g.compasso_excluirInscricao(rFora.inscricaoId, "Duplicidade confirmada", ADM);
ok(exc && exc.ok === true, "excluir funciona com motivo", exc && exc.erro);
const insExc = g.fs_get_("inscricoesEventos", rFora.inscricaoId);
ok(insExc && insExc.excluida === true,
   "  e a exclusão é LÓGICA — o registro continua, marcado",
   "auditoria de evento com dado real não pode sumir da base");
ok(!!insExc.excluidaPor && !!insExc.motivoExclusao,
   "  com quem excluiu e por quê: " + insExc.motivoExclusao);

/* ══════════════════════════════════════════════════════════════════════════
   E2E-09 · A TRAVA DAS VAGAS
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-09 · a lotação — a 2.001ª não entra");

/* O limite real é 2.000; aqui ele é reduzido para provar a MESMA trava sem
   criar 2.000 registros. O que se prova é a regra, não o número. */
const LIMITE_REAL = g.EMISSAO_CFG.LIMITE_VAGAS;
g.EMISSAO_CFG.LIMITE_VAGAS = 5;
const reservaAtual = g.fs_get_("reservasEventos", "festa-compasso-2026");
reservaAtual.limite = 5;
g.fs_set_("reservasEventos", "festa-compasso-2026", reservaAtual);

/* CPFs GERADOS com dígito verificador correto. Na primeira rodada eu tinha
   inventado os números à mão: três eram inválidos, foram recusados pelo CPF e
   não pela lotação — e o teste mediu a coisa errada, dando um "bloqueou" que
   não provava a trava de vaga nenhuma. */
const cpfValido = base => {
  const n = String(base).padStart(9, "0").slice(0, 9).split("").map(Number);
  let s1 = 0; for (let i = 0; i < 9; i++) s1 += n[i] * (10 - i);
  let d1 = (s1 * 10) % 11; if (d1 === 10) d1 = 0;
  const m = n.concat([d1]);
  let s2 = 0; for (let i = 0; i < 10; i++) s2 += m[i] * (11 - i);
  let d2 = (s2 * 10) % 11; if (d2 === 10) d2 = 0;
  return m.concat([d2]).join("");
};
const cpfsExtra = [201, 202, 203, 204, 205, 206, 207, 208].map(
  i => cpfValido(100000000 + i * 137));
cpfsExtra.forEach(c => ok(g.compasso_cpfValido_(c), "  CPF de teste " + c + " é válido"));
let aceitas = 0, bloqueadas = 0;
cpfsExtra.forEach((cpf, i) => {
  const r = g.compasso_inscrever({
    nome: "Teste Lotacao " + i, cpf: cpf, escola: "E", cidade: "C",
    email: "t" + i + "@x.com", termoAceito: true });
  if (r.ok) aceitas++; else bloqueadas++;
});
const rFinal = g.fs_get_("reservasEventos", "festa-compasso-2026");
ok(Number(rFinal.reservadas) <= 5,
   "a reserva nunca passa do limite: " + rFinal.reservadas + " de 5",
   "aceitas " + aceitas + ", bloqueadas " + bloqueadas);
ok(bloqueadas > 0, "  e as que sobraram foram bloqueadas com aviso");

const cfgFechada = g.compasso_inscricaoEstado();
ok(cfgFechada.aberta === false && /esgot/i.test(cfgFechada.motivoFechada || ""),
   "com as vagas esgotadas, a tela pública fecha sozinha",
   cfgFechada.motivoFechada);
g.EMISSAO_CFG.LIMITE_VAGAS = LIMITE_REAL;

naoTestavel("duas inscrições SIMULTÂNEAS na última vaga",
            "o emulador é de uma thread só; o LockService está no código e a " +
            "corrida real só a onda de carga do plano prova");

/* ══════════════════════════════════════════════════════════════════════════
   TESTE 9 do comando · PERMISSÃO — a trava é do backend, não da tela
   ══════════════════════════════════════════════════════════════════════════ */
passo("PERMISSÃO · quem não tem o módulo não passa");

const protegidas = [
  ["compasso_validacaoListar",      [{}]],
  ["compasso_validacaoResumo",      []],
  ["compasso_emitirIngressoV2",     [{ inscricaoId: INS_ID }]],
  ["compasso_enviarIngressoEmail",  [INS_ID]],
  ["compasso_checkinValidarToken",  [QR_TOKEN, "CEL-X"]],
  ["compasso_excluirInscricao",     [INS_ID, "motivo"]],
  ["compasso_executivoResumo",      []],
  ["compasso_ingressoArquivo",      [INS_ID]]
];
protegidas.forEach(([nome, args]) => {
  let recusou = false, detalhe = "";
  try { g[nome](...args, FIN); }
  catch (e) { recusou = /permit|permiss|acesso|autoriz|sess|administrador/i.test(e.message); detalhe = e.message; }
  ok(recusou, nome + " recusa quem não tem o módulo eventos", detalhe.slice(0, 62));
});

/* A PORTA DUPLA. Sem token, `exigirAdminOuSessao_` não fecha: ele cai para a
   identidade Google de quem executa — é o que permite rodar pelo editor e
   pelo menu da planilha, onde tokenSessao não existe.
   Então "sem token" NÃO é o teste de segurança: o teste é sem token E sem
   identidade conhecida. */
const guardado = g.__usuarioAtivoEmail;
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";
let admPassa = false;
try { g.compasso_validacaoListar({}, ""); admPassa = true; } catch (e) {}
ok(admPassa, "sem token, o ADMINISTRADOR identificado pelo Google passa",
   "é a porta dupla: o menu da planilha e o editor não têm token de sessão");

g.__usuarioAtivoEmail = "estranho@fora.com";
let estranhoBarrado = false, msgEstranho = "";
try { g.compasso_validacaoListar({}, ""); }
catch (e) { estranhoBarrado = true; msgEstranho = e.message; }
ok(estranhoBarrado, "sem token E sem identidade conhecida, recusa",
   msgEstranho.slice(0, 62));
g.__usuarioAtivoEmail = guardado;

/* ══════════════════════════════════════════════════════════════════════════
   E2E-08 · OS RELATÓRIOS — conferidos contra o banco, não contra si mesmos
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-08 · os números do painel batem com o banco");

const todas = g.fs_list_("inscricoesEventos").filter(i => !i.excluida);
const resumoFinal = g.compasso_validacaoResumo(ADM);
igual(Number(resumoFinal.total), todas.length,
      "o total do painel = o total do banco (" + todas.length + ")");

const validadasBanco = todas.filter(i => i.status === "VALIDADA_ADMINISTRATIVAMENTE").length;
igual(Number(resumoFinal.validadas), validadasBanco,
      "as validadas do painel = as validadas do banco (" + validadasBanco + ")");

const exec = g.compasso_executivoResumo(ADM);
ok(exec && exec.evento && Number(exec.evento.dias) > 0,
   "o executivo conta os dias que faltam: " + (exec.evento || {}).dias);
igual(Number(exec.inscricoes.total), Number(resumoFinal.total),
      "  e usa o mesmo total do painel operacional",
      "dois painéis com números diferentes destroem a confiança nos dois");
ok(Array.isArray(exec.riscos) && exec.riscos.length > 0,
   "  e lista riscos com ação, não só número");

/* Uma duplicidade DE VERDADE, para o relatório ter o que achar. Em
   homologação a trava de CPF único está solta (pedido do usuário em 24/08),
   e é justamente por isso que o relatório de duplicidade precisa existir:
   ele é a rede quando a trava não pega. */
/* O limite do documento de reserva também volta ao real — o bloco da lotação
   o deixou em 5, e sem isto a inscrição abaixo morreria por vaga esgotada e o
   relatório não teria duplicidade nenhuma para achar. */
const rst = g.fs_get_("reservasEventos", "festa-compasso-2026");
rst.limite = LIMITE_REAL;
g.fs_set_("reservasEventos", "festa-compasso-2026", rst);

const dobrada = g.compasso_inscrever({
  nome: "Maria Aparecida da Silva", cpf: CPF_ASSOCIADO, escola: "EMEF Castelo Branco",
  cidade: "Vitória", email: "mariaaparecida@gmail.com", termoAceito: true });
ok(dobrada.ok === true, "em homologação o mesmo CPF pode se inscrever de novo",
   "pedido do usuário em 24/08 para poder testar; em produção a trava fica inteira");

const dup = g.compasso_validacaoDuplicidades(ADM);
ok(Array.isArray(dup) && dup.length >= 1,
   "o relatório de duplicidades acha o mesmo CPF inscrito duas vezes",
   dup.length + " grupo(s) suspeito(s)");
ok(dup.every(grupo => Array.isArray(grupo.itens) && grupo.itens.length > 1),
   "  e cada grupo tem de fato mais de uma inscrição",
   "nenhuma suspeita é apagada sozinha — o operador é quem resolve");

/* ══════════════════════════════════════════════════════════════════════════
   O QUE O CICLO NÃO TEM — encerramento
   ══════════════════════════════════════════════════════════════════════════ */
passo("E2E-07/12 · o encerramento do evento");

const temEncerrar = Object.keys(g).some(k =>
  /^(compasso|eventos?)_.*encerrar/i.test(k) && typeof g[k] === "function");
ok(!temEncerrar, "não existe encerramento de evento — e isso é um GAP, não um bug",
   "depois da festa ninguém 'fecha' o evento: não há consolidação de presença, " +
   "ausência, nem congelamento contra novas operações");

aviso("ausência não é registrada em lugar nenhum",
      "quem não fez check-in fica indistinguível de quem não foi lido — " +
      "e o termo que a pessoa aceita fala em 'ausência sem aviso fica registrada'");

resumo();
