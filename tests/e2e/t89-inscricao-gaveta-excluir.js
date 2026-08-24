/**
 * TUDO NUM LUGAR SÓ — E O EXCLUIR QUE NÃO PODE VIRAR PERDER
 *
 * O QUE ORIGINOU
 *
 * 24/08/2026. O usuário: "o painel de inscrições deveria ter os dados do
 * associado, e nas ações deveria ter enviar, emitir, cancelar, excluir,
 * validar — tudo num lugar só. E não em links diferente como é hoje".
 *
 * Era exato. Analisar uma inscrição exigia sair do painel, abrir a Central de
 * Validação e procurar a mesma pessoa de novo — perdendo filtro, página e o
 * lugar onde se estava. Pior: `compasso_cancelarIngressoV2` existia no backend
 * e NÃO TINHA BOTÃO em tela nenhuma.
 *
 * DUAS COISAS DIFERENTES ESTÃO SENDO TESTADAS AQUI
 *
 * 1. EXCLUIR (backend, executado contra um Firestore em memória). É a única
 *    ação da tela que tira um registro de circulação, e o usuário pediu que
 *    fosse do administrador. As três travas que a acompanham não são zelo
 *    meu — cada uma evita um estrago concreto:
 *
 *      · exige administrador           → reprovar é do módulo; excluir, não
 *      · recusa com ingresso emitido   → senão fica um QR válido apontando
 *                                        para inscrição que não existe, e a
 *                                        portaria deixa entrar
 *      · exclusão lógica + auditoria   → o rastro é justamente o que alguém
 *                                        vai procurar quando a pessoa
 *                                        aparecer dizendo que se inscreveu
 *
 *    E dois efeitos que ninguém lembra até doerem: a vaga volta para as 2.000,
 *    e o índice de inscrição única é liberado — sem isso a pessoa excluída não
 *    conseguiria se inscrever de novo, e a mensagem diria que ela já tem
 *    inscrição, sem nenhuma inscrição à vista.
 *
 * 2. A GAVETA (tela, executada num DOM de mentira). O que se prova aqui não é
 *    que os botões existem — é que cada um SÓ APARECE no estado em que pode
 *    ser clicado. "Emitir" numa inscrição não validada e "Cancelar ingresso"
 *    em quem não tem ingresso são cliques que só produzem mensagem de erro.
 *
 * O QUE NÃO ESTÁ COBERTO
 *
 * O Firestore de verdade, o e-mail que sai, o PDF e o QR. Aqui o veredito
 * continua "não testado" e o roteiro manual vai junto.
 */

const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

const insc2 = ler("EventosInscricoesV2.gs");
const val   = ler("EventosValidacao.gs");
const html  = ler("CompassoInscricoes.html");

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1].split(",").map(s => s.trim()).filter(Boolean),
           corpo: codigo.slice(m.index + m[0].length, i - 1) };
}
const fn = (codigo, nome, deps) => {
  const a = corpoDe(codigo, nome);
  const nomes = Object.keys(deps || {});
  return (...vals) => new Function(...a.args, ...nomes, a.corpo)(
    ...vals, ...nomes.map(n => (deps || {})[n]));
};

fluxo("INSCRIÇÕES · a gaveta reúne as ações, e excluir tem dono");

/* ── mundo de mentira ────────────────────────────────────────────────────── */
function mundo(opcoes) {
  opcoes = opcoes || {};
  const banco = {
    inscricoesEventos: {},
    inscricaoUnicaEventos: {},
    reservasEventos: { "festa-2026": { limite: 2000, reservadas: 1 } }
  };
  const auditoria = [];
  const EMISSAO_CFG = { EVENTO_ID: "festa-2026", LIMITE_VAGAS: 2000 };

  banco.inscricoesEventos["INS-1"] = Object.assign({
    inscricaoId: "INS-1", eventoId: "festa-2026", nome: "MARIA DA SILVA",
    cpf: "12345678909", pessoaId: "P-1", status: "VALIDADA_ADMINISTRATIVAMENTE",
    vagaReservada: true
  }, opcoes.inscricao || {});
  banco.inscricaoUnicaEventos["chave:12345678909"] =
    { inscricaoId: "INS-1", status: "ATIVA" };

  const deps = {
    EMISSAO_CFG,
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    fs_get_: (col, id) => banco[col][id] || null,
    fs_set_: (col, id, obj) => { banco[col][id] = obj; },
    compasso_chavePessoaEvento_: (ev, pid, cpf) => "chave:" + cpf,
    compasso_emailUsuario_: () => "secretaria@sindeducacao.org.br",
    compasso_auditar_: (acao, tipo, id, det) =>
      auditoria.push({ acao, tipo, id, det }),
    compasso_lerReservaVagas_: () => banco.reservasEventos["festa-2026"],
    /* A liberação de vaga é a de verdade, não um stub: é ela que devolve a
       vaga para as 2.000, e é o efeito que ninguém confere. */
    compasso_liberarVagaInscricao_: fn(insc2, "compasso_liberarVagaInscricao_", {
      EMISSAO_CFG,
      fs_get_: (col, id) => banco[col][id] || null,
      fs_set_: (col, id, obj) => { banco[col][id] = obj; },
      compasso_lerReservaVagas_: () => banco.reservasEventos["festa-2026"]
    }),
    exigirAdminOuSessao_: (tok, mod, rotulo, exigeAdmin) => {
      if (exigeAdmin && !opcoes.admin)
        throw new Error("Ação permitida somente para administradores.");
      return "secretaria@sindeducacao.org.br";
    }
  };
  return { banco, auditoria, excluir: fn(insc2, "compasso_excluirInscricao", deps) };
}

/* ───────────────────────────────────────────────────────────────────────── */
passo("excluir é do administrador");

let m = mundo({ admin: false });
let erro = null;
try { m.excluir("INS-1", "teste", ""); } catch (e) { erro = String(e.message || e); }
ok(erro && /administrador/i.test(erro),
   "quem não é administrador leva recusa",
   "reprovar qualquer pessoa do módulo faz; excluir tira o registro de vista");
ok(!m.banco.inscricoesEventos["INS-1"].excluida,
   "  e a inscrição continua lá");

/* ───────────────────────────────────────────────────────────────────────── */
passo("o motivo é obrigatório");

m = mundo({ admin: true });
let r = m.excluir("INS-1", "   ", "tok");
igual(r.ok, false, "sem motivo, recusa");
ok(/motivo/i.test(r.erro || ""), "  e diz que falta o motivo");
ok(!m.banco.inscricoesEventos["INS-1"].excluida, "  nada foi excluído");

/* ───────────────────────────────────────────────────────────────────────── */
passo("INGRESSO EMITIDO BARRA A EXCLUSÃO");

m = mundo({ admin: true, inscricao: { ingressoId: "ING-9", numeroIngresso: "FCV-2026-000009" } });
r = m.excluir("INS-1", "duplicada", "tok");
igual(r.ok, false, "com ingresso emitido, recusa");
igual(r.codigo, "INGRESSO_ATIVO", "  com código próprio, para a tela reagir");
ok(/cancele o ingresso/i.test(r.erro || ""),
   "  e diz o que fazer antes",
   "excluir com ingresso vivo deixa um QR válido apontando para inscrição " +
   "que não existe mais — a portaria deixaria entrar");
ok(!m.banco.inscricoesEventos["INS-1"].excluida, "  a inscrição fica");
igual(m.banco.reservasEventos["festa-2026"].reservadas, 1,
      "  e a vaga NÃO foi devolvida",
      "devolver vaga numa exclusão recusada abriria uma vaga fantasma");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a exclusão que vale");

m = mundo({ admin: true });
r = m.excluir("INS-1", "inscrição em duplicidade", "tok");
igual(r.ok, true, "administrador com motivo e sem ingresso: exclui");

const doc = m.banco.inscricoesEventos["INS-1"];
ok(!!doc, "o documento CONTINUA no Firestore",
   "apagar de verdade levaria junto o rastro de que a inscrição existiu");
igual(doc.excluida, true, "  marcado como excluída");
igual(doc.motivoExclusao, "inscrição em duplicidade", "  com o motivo gravado");
igual(doc.excluidaPor, "secretaria@sindeducacao.org.br", "  e quem excluiu");
ok(!!doc.excluidaEm, "  e quando");

igual(m.banco.reservasEventos["festa-2026"].reservadas, 0,
      "a vaga voltou para as 2.000");
igual(m.banco.inscricaoUnicaEventos["chave:12345678909"].status, "CANCELADA",
      "e o índice de inscrição única foi liberado",
      "sem isso a pessoa excluída não conseguiria se inscrever de novo, e a " +
      "mensagem diria que ela já tem inscrição — sem nenhuma inscrição à vista");

const aud = m.auditoria.filter(a => a.acao === "EXCLUSAO_INSCRICAO");
igual(aud.length, 1, "a exclusão foi auditada");
igual(aud[0].det.motivo, "inscrição em duplicidade", "  com o motivo");
igual(aud[0].det.nome, "MARIA DA SILVA", "  e com o nome, para achar depois");

/* ───────────────────────────────────────────────────────────────────────── */
passo("excluir duas vezes não conta duas vagas");

r = m.excluir("INS-1", "de novo", "tok");
igual(r.ok, false, "a segunda tentativa recusa");
igual(m.banco.reservasEventos["festa-2026"].reservadas, 0,
      "  e a vaga não é devolvida outra vez",
      "sem esta trava, dois cliques criariam uma vaga do nada");

/* ───────────────────────────────────────────────────────────────────────── */
passo("excluída some da lista antes de qualquer filtro");

const listar = fn(val, "compasso_validacaoListar_interno_", {
  EMISSAO_CFG: { EVENTO_ID: "festa-2026" },
  fs_list_: () => [
    { inscricaoId:"A", eventoId:"festa-2026", nome:"ANA",  status:"" },
    { inscricaoId:"B", eventoId:"festa-2026", nome:"BIA",  status:"", excluida:true },
    { inscricaoId:"C", eventoId:"outro-evento", nome:"CID", status:"" }
  ],
  compasso_pagamentoDaInscricao_: () => ({}),
  compasso_entregaDaInscricao_: () => ({ canais: [] })
});

const saida = listar({});
igual(saida.length, 1, "só a inscrição viva deste evento aparece");
igual(saida[0].nome, "ANA", "  e é a certa");
ok(!saida.some(x => x.inscricaoId === "B"),
   "a excluída não aparece",
   "se o corte ficasse depois dos filtros, o card 'total' contaria gente " +
   "excluída e os números da tela mentiriam");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a checagem de administrador não vira porta nova");

ok(/function compasso_ehAdministrador_\(/.test(insc2),
   "a checagem é helper privado (termina em _)",
   "função pública nova só para responder true/false seria mais uma linha na " +
   "conta do t6-exposicao em troca de nada");
ok(/admin:compasso_ehAdministrador_\(tokenSessao\)/.test(val.replace(/\s/g, "")
     .replace(/admin:compasso_ehAdministrador_\(tokenSessao\)/, "admin:compasso_ehAdministrador_(tokenSessao)")) ||
   /admin:\s*compasso_ehAdministrador_\(tokenSessao\)/.test(val),
   "e a resposta viaja em compasso_validacaoOpcoes, que a tela já chamava");

/* ═══ A GAVETA ════════════════════════════════════════════════════════════ */

function elemento(id) {
  const classes = new Set();
  return {
    id, innerHTML: "", textContent: "", value: "", checked: false,
    disabled: false, hidden: false, style: {}, options: [],
    classList: { add: c => classes.add(c), remove: c => classes.delete(c),
                 contains: c => classes.has(c) },
    addEventListener() {}, querySelectorAll: () => []
  };
}
function montarTela() {
  const els = {};
  const sandbox = {
    document: { getElementById: id => (els[id] = els[id] || elemento(id)),
                addEventListener() {} },
    location: { search: "" },
    google: { script: { run: new Proxy({}, { get: (_, n) =>
      (n === "withSuccessHandler" || n === "withFailureHandler")
        ? () => sandbox.google.script.run : () => {} }) } },
    alert() {}, confirm: () => true, prompt: () => "motivo", setTimeout() {}, console
  };
  const corpo = (html.match(/<script>([\s\S]*)<\/script>/) || [])[1];
  const nomes = Object.keys(sandbox);
  const expor = `; return {
    get LISTA(){return LISTA}, set LISTA(v){LISTA=v},
    get ABERTO(){return ABERTO},
    set SOU_ADMIN(v){SOU_ADMIN=v},
    set OPCOES(v){OPCOES=v},
    get MOTIVO_SELECIONADO(){return document.getElementById('aMotivo').innerHTML},
    abrirGaveta, fecharGaveta, montarMotivos, pintarLista
  };`;
  return { tela: new Function(...nomes, corpo + expor)(...nomes.map(n => sandbox[n])), els };
}

const pessoa = extra => Object.assign({
  inscricaoId: "INS-1", nome: "MARIA DA SILVA", cpf: "12345678909",
  escola: "EMEF X", cidade: "Vitória", regiao: "Metropolitana",
  email: "maria@exemplo.com", whatsapp: "27999990000", matricula: "M-1",
  categoria: "associado", status: "", situacaoAssociado: "ASSOCIADO",
  ingressoId: "", numeroIngresso: "", entrega: { canais: [] }, pagamento: {}
}, extra || {});

/* ───────────────────────────────────────────────────────────────────────── */
passo("a gaveta traz os dados que antes exigiam outra tela");

let t = montarTela();
t.tela.LISTA = [pessoa()];
t.tela.abrirGaveta(0);

[["dNome","MARIA DA SILVA"], ["dCpf","12345678909"], ["dEscola","EMEF X"],
 ["dCidade","Vitória"], ["dRegiao","Metropolitana"],
 ["dEmail","maria@exemplo.com"], ["dWhatsapp","27999990000"],
 ["dMatricula","M-1"]].forEach(([campo, valor]) => {
  igual(t.els[campo].value, valor, "  " + campo.slice(1).toLowerCase());
});
igual(t.els.gvNome.textContent, "MARIA DA SILVA", "e o nome no topo");

/* ───────────────────────────────────────────────────────────────────────── */
passo("CADA BOTÃO SÓ APARECE ONDE PODE SER CLICADO");

/* não analisada: nem emitir, nem enviar, nem cancelar */
t = montarTela(); t.tela.LISTA = [pessoa({ status: "" })]; t.tela.abrirGaveta(0);
igual(t.els.btEmitir.hidden, true,  "não analisada: sem Emitir",
      "emitir antes de validar só produz mensagem de erro");
igual(t.els.btCancelar.hidden, true, "  sem Cancelar ingresso");
igual(t.els.btEmail.hidden, true,    "  sem Enviar");

/* validada e sem ingresso: só emitir */
t = montarTela();
t.tela.LISTA = [pessoa({ status: "VALIDADA_ADMINISTRATIVAMENTE" })];
t.tela.abrirGaveta(0);
igual(t.els.btEmitir.hidden, false, "validada sem ingresso: Emitir aparece");
igual(t.els.btEmail.hidden, true,   "  e enviar ainda não");
igual(t.els.btCancelar.hidden, true, "  nem cancelar");

/* com ingresso: enviar e cancelar, nunca emitir de novo */
t = montarTela();
t.tela.LISTA = [pessoa({ status:"VALIDADA_ADMINISTRATIVAMENTE",
                         ingressoId:"ING-1", numeroIngresso:"FCV-2026-000001" })];
t.tela.abrirGaveta(0);
igual(t.els.btEmitir.hidden, true,   "com ingresso: Emitir some",
      "emitir duas vezes consumiria duas das 2.000 vagas para a mesma pessoa");
igual(t.els.btEmail.hidden, false,   "  Enviar por e-mail aparece");
igual(t.els.btWhats.hidden, false,   "  Enviar por WhatsApp aparece");
igual(t.els.btCancelar.hidden, false, "  e Cancelar ingresso aparece",
      "compasso_cancelarIngressoV2 existia no backend e não tinha botão em " +
      "tela nenhuma até aqui");

/* ───────────────────────────────────────────────────────────────────────── */
passo("pagamento só para quem paga");

t = montarTela(); t.tela.LISTA = [pessoa({ categoria: "associado" })];
t.tela.abrirGaveta(0);
igual(t.els.secPagamento.hidden, true, "associado não vê bloco de pagamento");

t = montarTela(); t.tela.LISTA = [pessoa({ categoria: "acompanhante" })];
t.tela.abrirGaveta(0);
igual(t.els.secPagamento.hidden, false, "acompanhante vê");

/* ───────────────────────────────────────────────────────────────────────── */
passo("excluir só aparece para administrador");

t = montarTela(); t.tela.LISTA = [pessoa()];
t.tela.SOU_ADMIN = false; t.tela.abrirGaveta(0);
igual(t.els.secExcluir.hidden, true, "quem não é administrador não vê Excluir");

t = montarTela(); t.tela.LISTA = [pessoa()];
t.tela.SOU_ADMIN = true; t.tela.abrirGaveta(0);
igual(t.els.secExcluir.hidden, false, "administrador vê");

/* ───────────────────────────────────────────────────────────────────────── */
passo("REPROVAR TRAZ O SELETOR DE MOTIVOS — foi o que o usuário pediu");

t = montarTela();
t.tela.OPCOES = { reprovacao: [{codigo:"FORA_DA_BASE", label:"Não é associado"},
                               {codigo:"OUTRO", label:"Outro"}],
                  pendencia:  [{codigo:"DADOS", label:"Dados incompletos"}] };
t.tela.LISTA = [pessoa()];
t.tela.abrirGaveta(0);

t.els.aStatus.value = "REPROVADA"; t.tela.montarMotivos();
igual(t.els.aMotivoBox.hidden, false, "reprovar mostra o seletor");
ok(/FORA_DA_BASE/.test(t.els.aMotivo.innerHTML) && /Não é associado/.test(t.els.aMotivo.innerHTML),
   "  com os motivos de reprovação, pelo rótulo que a pessoa lê");
ok(!/DADOS/.test(t.els.aMotivo.innerHTML),
   "  e sem os motivos de pendência, que são outra lista");
ok(/vaga/i.test(t.els.aNota.textContent),
   "  avisando que reprovar devolve a vaga");

t.els.aStatus.value = "PENDENTE"; t.tela.montarMotivos();
ok(/DADOS/.test(t.els.aMotivo.innerHTML), "pendência troca a lista de motivos");
ok(!/FORA_DA_BASE/.test(t.els.aMotivo.innerHTML), "  sem misturar com reprovação");

t.els.aStatus.value = "VALIDADA_ADMINISTRATIVAMENTE"; t.tela.montarMotivos();
igual(t.els.aMotivoBox.hidden, true, "validar não pede motivo, e o campo some");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a decisão nasce apontando para o estado atual");

t = montarTela(); t.tela.LISTA = [pessoa({ status: "REPROVADA" })];
t.tela.abrirGaveta(0);
igual(t.els.aStatus.value, "REPROVADA",
      "reabrir uma reprovada não pré-seleciona Validar",
      "ver 'Validar' pronto numa inscrição reprovada convida ao clique errado");

/* ───────────────────────────────────────────────────────────────────────── */
passo("a lista mostra quem é a pessoa sem precisar abrir");

t = montarTela(); t.tela.LISTA = [pessoa({ categoria: "acompanhante" })];
t.tela.pintarLista();
ok(/maria@exemplo\.com/.test(t.els.tb.innerHTML),
   "o e-mail aparece embaixo do nome",
   "sem ele, duas Marias da mesma escola são indistinguíveis na lista");
ok(/acompanhante/.test(t.els.tb.innerHTML), "e a categoria também");
ok(/abrirGaveta\(0\)/.test(t.els.tb.innerHTML),
   "e o botão abre a gaveta, não outra tela");

resumo();
