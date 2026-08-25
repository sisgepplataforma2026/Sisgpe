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
                 contains: c => classes.has(c),
                 toggle: (c, on) => on ? classes.add(c) : classes.delete(c) },
    addEventListener() {}, querySelectorAll: () => []
  };
}
function montarTela() {
  const els = {};
  const criados = [];
  const sandbox = {
    document: { getElementById: id => (els[id] = els[id] || elemento(id)),
                addEventListener() {},
                /* o download monta um <a> temporário e o clica */
                createElement(tag){ const e = elemento("novo:" + tag);
                                    e.tag = tag; e.click = () => e.clicado = true;
                                    criados.push(e); return e; },
                body: { appendChild() {}, removeChild() {} } },
    criados,
    location: { search: "" },
    google: { script: { run: new Proxy({}, { get: (_, n) =>
      (n === "withSuccessHandler" || n === "withFailureHandler")
        ? () => sandbox.google.script.run : () => {} }) } },
    /* a tela expõe compassoAplicarFiltro para quem a inclui */
    window: {},
    /* Esc/Enter do diálogo do sistema */
    alert() {}, confirm: () => true, prompt: () => "motivo", setTimeout() {}, console
  };
  const corpo = (html.match(/<script>([\s\S]*)<\/script>/) || [])[1];
  const nomes = Object.keys(sandbox);
  const expor = `; return {
    get LISTA(){return LISTA}, set LISTA(v){LISTA=v},
    get ABERTO(){return ABERTO},
    get ABA(){return ABA},
    get ARQUIVO(){return ARQUIVO}, set ARQUIVO(v){ARQUIVO=v},
    set SOU_ADMIN(v){SOU_ADMIN=v},
    set OPCOES(v){OPCOES=v},
    get SEL(){return SEL},
    abrirGaveta, fecharGaveta, montarMotivos, pintarLista, marcarTodos,
    selecionarTudo, irAba, abrirModalIngresso, fecharModal, mdBaixar
  };`;
  return { tela: new Function(...nomes, corpo + expor)(...nomes.map(n => sandbox[n])),
           els, sandbox };
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

/* ═══ AS ABAS ═════════════════════════════════════════════════════════════
   "Tudo num único lugar: Central de Inscrições — validação, importar
   planilha, emissão e etc" (usuário, 24/08/2026). */
passo("a Central abre na lista e a importação é uma aba dela");

t = montarTela();
igual(t.tela.ABA, "lista", "começa na lista");
t.tela.irAba("lista");
igual(t.els.painelLista.hidden, false, "  com a lista à vista");
igual(t.els.painelImportar.hidden, true, "  e a importação escondida");

t.tela.irAba("importar");
igual(t.els.painelLista.hidden, true, "trocar de aba esconde a lista");
igual(t.els.painelImportar.hidden, false, "  e mostra a importação");

t.tela.irAba("lista");
igual(t.els.painelLista.hidden, false, "e volta");

/* ═══ O MODAL DO INGRESSO ═════════════════════════════════════════════════
   "Gera e abre um modal para emissão, envio, download, impressão, envio zap e
   por email e editar" — a lógica do ofício, pedida nominalmente. */
passo("emitiu, abre o modal com tudo o que se faz com o ingresso");

t = montarTela(); t.tela.LISTA = [pessoa({ status:"VALIDADA_ADMINISTRATIVAMENTE" })];
t.tela.abrirGaveta(0);
/* getElementById materializa o elemento no DOM de mentira — mdFundo só é
   tocado quando o modal entra em cena. */
const mdFundo = t.sandbox.document.getElementById("mdFundo");
igual(mdFundo.classList.contains("on"), false, "o modal começa fechado");

t.tela.abrirModalIngresso("INS-1", "FCV-2026-000123", "MARIA DA SILVA");
igual(mdFundo.classList.contains("on"), true, "abre depois de emitir");
ok(/FCV-2026-000123/.test(t.els.mdTitulo.textContent), "  com o número do ingresso");
igual(t.els.mdSub.textContent, "MARIA DA SILVA", "  e de quem é");
ok(/Preparando/.test(t.els.mdStatus.innerHTML),
   "  e avisa que o arquivo está sendo preparado",
   "os botões de baixar e imprimir dependem do PDF que ainda está vindo");

/* Os seis botões que o usuário nomeou, um a um. */
const htmlModal = html.slice(html.indexOf('<div class="md-fundo"'),
                             html.indexOf('<!-- ══ GAVETA'));
[["mdAbrir","abrir o ingresso"], ["mdBaixar","baixar o PDF"],
 ["mdImprimir","imprimir"], ["mdEmail","enviar por e-mail"],
 ["mdWhats","enviar por WhatsApp"], ["mdEditar","editar os dados"]].forEach(([f, oq]) => {
  ok(htmlModal.indexOf('onclick="' + f + '()"') >= 0, "  tem botão para " + oq);
  ok(new RegExp("function " + f + "\\(").test(html), "    e a função existe");
});

passo("baixar não inventa arquivo que não chegou");

t = montarTela(); t.tela.LISTA = [pessoa()]; t.tela.abrirGaveta(0);
t.tela.ARQUIVO = null;
t.tela.mdBaixar();
igual(t.sandbox.criados.length, 0,
      "sem o PDF na mão, não monta link de download",
      "um link para 'data:application/pdf;base64,undefined' baixaria um " +
      "arquivo corrompido e a pessoa acharia que o ingresso saiu errado");

t.tela.ARQUIVO = { base64: "QUJD", arquivo: "Ingresso FCV-1.pdf", url: "https://x/y" };
t.tela.mdBaixar();
igual(t.sandbox.criados.length, 1, "com o PDF, monta o link");
igual(t.sandbox.criados[0].download, "Ingresso FCV-1.pdf",
      "  com o nome do arquivo do ingresso");
ok(/^data:application\/pdf;base64,QUJD$/.test(t.sandbox.criados[0].href),
   "  e o conteúdo do PDF");
igual(t.sandbox.criados[0].clicado, true, "  e dispara o download");

passo("o backend do arquivo não entrega o que não pode");

const entrega = ler("EventosEntrega.gs");
ok(/function compasso_ingressoArquivo\(inscricaoId, tokenSessao\)/.test(entrega),
   "compasso_ingressoArquivo existe");
const corpoArq = corpoDe(entrega, "compasso_ingressoArquivo").corpo;
ok(/exigirAdminOuSessao_/.test(corpoArq), "  com trava de sessão");
ok(/compasso_contextoEntrega_/.test(corpoArq),
   "  e passa pelo contexto de entrega, que recusa sem ingresso e cancelado");
ok(!/compasso_registrarEntrega_/.test(corpoArq),
   "  e NÃO registra entrega",
   "baixar não é entregar: marcar aqui encheria o filtro 'enviadas' de gente " +
   "que não recebeu nada");

passo("emitir pela lista e pela gaveta é o mesmo caminho");

ok(/function emitir\(i\)\{ abrirGaveta\(i\); emitirGaveta\(\); \}/.test(html),
   "o atalho da linha passa pela gaveta",
   "dois caminhos de emissão foi exatamente o que o usuário mandou acabar");
ok(/abrirModalIngresso\(id, r\.numero, nome\)/.test(html),
   "e emitir abre o modal, como no ofício");

passo("a tela de Eventos passou a ter um caminho só");

const admin2 = ler("EventosAdmin.html");
["Central de validação", "Importar planilha (teste)", "Emissão avulsa"].forEach(txt => {
  ok(admin2.indexOf(txt) < 0, 'o card "' + txt + '" saiu da aba Inscrições');
});
ok(/Central de Inscrições/.test(admin2), "e o que ficou chama-se Central de Inscrições");
ok(!/evAvisoCentral/.test(admin2),
   "e o aviso que mandava abrir pelo menu da planilha saiu junto",
   "aquele menu nunca existiu: criarMenuEventos só cadastra 'Emissão de Ingressos'");

/* A Central de Validação FICA no repositório — REGRA Nº 1. */
ok(fs.existsSync(path.join(RAIZ, "EventosValidacaoAdmin.html")),
   "o arquivo da Central de Validação continua no projeto");
ok(/LEGADO — mantida de propósito/.test(val),
   "  documentado como legado no cabeçalho da função que a abre",
   "apagar seria irreversível; voltar é um card de HTML");

/* ═══ EXCLUIR VÁRIAS ══════════════════════════════════════════════════════
   "As inscrições importadas não têm opção de excluir todos" (usuário,
   24/08/2026). Ele tinha 122 linhas erradas e o único caminho era abrir uma a
   uma.

   A CAUSA não era falta do botão — era o CHECKBOX. Ele só nascia na linha de
   quem já tinha ingresso, e nenhuma das 122 tinha. Não havia o que selecionar.
   Um botão de lote sem seleção possível seria um botão morto. */
passo("dá para selecionar qualquer linha, com ingresso ou sem");

t = montarTela();
t.tela.LISTA = [pessoa({ ingressoId: "" }), pessoa({ inscricaoId:"INS-2", ingressoId:"ING-2" })];
t.tela.pintarLista();
igual((t.els.tb.innerHTML.match(/type="checkbox"/g) || []).length, 2,
      "as duas linhas têm caixa de seleção",
      "sem caixa na linha sem ingresso, as 122 importadas eram inselecionáveis");

/* ── o lote no backend ── */
passo("excluir em lote herda as travas, uma a uma");

function mundoLote(opcoes) {
  opcoes = opcoes || {};
  const base = mundo({ admin: opcoes.admin });
  /* Duas inscrições a mais: uma limpa e uma com ingresso emitido, que tem de
     ser recusada mesmo dentro do lote. */
  base.banco.inscricoesEventos["INS-2"] = {
    inscricaoId:"INS-2", eventoId:"festa-2026", nome:"JOAO", cpf:"22233344455",
    pessoaId:"P-2", status:"", vagaReservada:true };
  base.banco.inscricoesEventos["INS-3"] = {
    inscricaoId:"INS-3", eventoId:"festa-2026", nome:"ANA", cpf:"33344455566",
    pessoaId:"P-3", status:"VALIDADA_ADMINISTRATIVAMENTE", vagaReservada:true,
    ingressoId:"ING-3", numeroIngresso:"FCV-2026-000003" };
  base.banco.reservasEventos["festa-2026"].reservadas = 3;

  const lote = fn(insc2, "compasso_excluirInscricoesEmLote", {
    exigirAdminOuSessao_: (tok, mod, rot, exigeAdmin) => {
      if (exigeAdmin && !opcoes.admin)
        throw new Error("Ação permitida somente para administradores.");
      return "secretaria@sindeducacao.org.br";
    },
    compasso_excluirInscricao: base.excluir,
    compasso_auditar_: (acao, tipo, id, det) =>
      base.auditoria.push({ acao, tipo, id, det })
  });
  return Object.assign(base, { lote });
}

let L = mundoLote({ admin: true });
let rl = L.lote(["INS-1", "INS-2", "INS-3"], "limpeza da importação", "tok");
igual(rl.ok, true, "o lote roda");
igual(rl.excluidas, 2, "exclui as duas que podiam");
igual(rl.recusadas.length, 1, "  e devolve a que não pôde");
igual(rl.recusadas[0].inscricaoId, "INS-3", "  dizendo qual");
ok(/cancele o ingresso/i.test(rl.recusadas[0].motivo || ""),
   "  e por quê",
   "um lote que diz só '2 excluídas' esconde a que ficou, e a pessoa só " +
   "descobre relendo a lista");
ok(!L.banco.inscricoesEventos["INS-3"].excluida,
   "a que tem ingresso continua viva",
   "a trava do ingresso vale dentro do lote igual a fora — o lote não " +
   "reimplementa regra nenhuma");
igual(L.banco.reservasEventos["festa-2026"].reservadas, 1,
      "e só as vagas das excluídas voltaram");

L = mundoLote({ admin: false });
let erroLote = null;
try { L.lote(["INS-1"], "teste", ""); } catch (e) { erroLote = String(e.message || e); }
ok(erroLote && /administrador/i.test(erroLote),
   "quem não é administrador não exclui em lote");

L = mundoLote({ admin: true });
igual(L.lote([], "x", "tok").ok, false, "lote vazio é recusado");
igual(L.lote(["INS-1"], "  ", "tok").ok, false, "e sem motivo também");

const audLote = L.auditoria.filter(a => a.acao === "EXCLUSAO_INSCRICAO_LOTE");
L = mundoLote({ admin: true });
L.lote(["INS-1", "INS-3"], "limpeza", "tok");
igual(L.auditoria.filter(a => a.acao === "EXCLUSAO_INSCRICAO_LOTE").length, 1,
      "o lote é auditado como lote, além de cada exclusão");

/* ── o lote na tela ── */
passo("o botão de excluir em lote só aparece para administrador");

t = montarTela();
t.tela.LISTA = [pessoa({ ingressoId: "" })];
t.tela.pintarLista();
t.tela.SOU_ADMIN = false;
t.sandbox.document.getElementById("tb");   /* materializa */
ok(/onclick="excluirLote\(\)"/.test(html), "o botão existe na barra de lote");
ok(/function excluirLote\(\)/.test(html), "  e a função também");
ok(/compasso_excluirInscricoesEmLote/.test(html),
   "  chamando a função de lote do backend, não um laço na tela",
   "laço no cliente faria N chamadas e perderia o resumo do que foi recusado");

const corpoBarra = (html.match(/function atualizarBarra\(\)\{[\s\S]*?\n\}/) || [""])[0];
ok(/g\('btLoteExcluir'\)\.hidden = !SOU_ADMIN/.test(corpoBarra),
   "e ele só aparece para quem é administrador");
ok(/g\('btLoteEmail'\)\.hidden   = !comIngresso/.test(corpoBarra),
   "enquanto o de enviar depende de haver ingresso na seleção",
   "oferecer 'enviar ingresso' para quem não tem ingresso é botão que só " +
   "produz erro");

/* ═══ A NAVEGAÇÃO POR SUBMÓDULOS ══════════════════════════════════════════
   "Quando eu clicasse Inscrições, já caía no relatório" e "participantes
   deveriam estar dentro de inscrições — tudo num único lugar" (usuário,
   24/08/2026).

   Este bloco EXECUTA a navegação da tela de Eventos, porque as duas coisas
   que importam aqui são invisíveis a um teste de texto: se entrar num
   submódulo já abre a primeira tela, e se essa tela carrega o painel EM VEZ
   de abrir aba nova do navegador. */
passo("entrar no submódulo já abre a primeira tela");

function montarEventos() {
  const els = {};
  function el(id) {
    const classes = new Set();
    return { id, innerHTML:"", textContent:"", value:"", hidden:false, style:{},
             src:"", attrs:{},
             setAttribute(k,v){ this.attrs[k]=v; },
             getAttribute(k){ return this.attrs[k]; },
             classList:{ add:c=>classes.add(c), remove:c=>classes.delete(c),
                         contains:c=>classes.has(c),
                         toggle:(c,on)=>on?classes.add(c):classes.delete(c) },
             addEventListener(){} };
  }
  const abertas = [];        /* window.open — o que NÃO deve acontecer */
  const chamadas = [];
  const win = {};
  const sandbox = {
    window: win,
    document: {
      getElementById: id => (els[id] = els[id] || el(id)),
      querySelector: () => (els["__wrap"] = els["__wrap"] || el("__wrap")),
      /* `evTelaInterno` passou a varrer os blocos de conteúdo pelo DOM em
         25/08 — antes era um array literal, e faltavam dois nomes nele. Este
         andaime precisa devolver os mesmos blocos para o teste continuar
         medindo o que mede. */
      querySelectorAll: sel => (/ev-conteudo/.test(String(sel))
        ? ["calendario","informacoes","painel","executivo","inscricoes",
           "participantes","credenciamento","sorteios"]
            .map(n => (els["conteudo-"+n] = els["conteudo-"+n] || el("conteudo-"+n)))
        : []),
      addEventListener(){}, readyState:"complete"
    },
    localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
    google: { script: { run: new Proxy({}, { get: (_, n) => {
      if (n === "withSuccessHandler") return cb => { sandbox.__ok = cb; return sandbox.google.script.run; };
      if (n === "withFailureHandler") return () => sandbox.google.script.run;
      return (...args) => { chamadas.push({ nome:n, args });
                            if (sandbox.__ok) sandbox.__ok("https://exec.exemplo"); };
    } }) } },
    setTimeout(){}, alert(){}, confirm:()=>true, prompt:()=>"m", console,
    spIr(){}, avisar(){},
    /* a tela lê a sessão desta global; sem ela, evQuadroAbrir desiste antes
       de tocar no quadro */
    SISGEP_TOKEN_SESSAO: "TOKEN",
    abertas
  };
  win.open = (u) => { abertas.push(u); };

  const corpo = (ler("EventosAdmin.html").match(/<script>([\s\S]*)<\/script>/) || [])[1];
  const nomes = Object.keys(sandbox);
  new Function(...nomes, corpo)(...nomes.map(n => sandbox[n]));
  return { win, els, abertas, chamadas };
}

const ev = montarEventos();
ev.win.evSub("festa");

igual(ev.els["sub-festa"].getAttribute("aria-selected"), "true",
      "o submódulo Festa fica marcado");
ok(/tela-inscricoes/.test(ev.els.evTelas.innerHTML),
   "  e a barra mostra as telas dele");
ok(/tela-ingressos/.test(ev.els.evTelas.innerHTML) &&
   /tela-credenciamento/.test(ev.els.evTelas.innerHTML),
   "  Inscrições, Ingressos e Credenciamento — as três do desenho aprovado");
ok(!/tela-participantes/.test(ev.els.evTelas.innerHTML),
   "  e 'Participantes' não é mais uma delas",
   "era a mesma lista de Inscrições noutro estado, e virou a tela Ingressos");

/* A LISTA É RENDERIZADA AQUI DENTRO — nem quadro, nem aba nova.
   25/08/2026: a primeira tentativa foi um quadro (iframe) apontando para a
   propria rota, e ele nao carregou — web app do Apps Script dentro de outro
   web app do Apps Script é aninhamento que o navegador recusa. O usuário viu:
   "quando eu clico em inscrições, deveria aparecer uma tabela renderizada, e
   não pedir pra abrir uma nova aba". */
igual(ev.els.evInscricoes.hidden, false,
      "ENTRAR NO SUBMÓDULO JÁ MOSTRA A LISTA, renderizada na página",
      "o usuário pediu que clicar em Inscrições caísse no relatório");
igual(ev.els.evQuadroWrap.hidden, true,
      "  e o quadro fica fora do caminho",
      "ele sobra apenas para a importação, que ainda usa rota própria");

const adminFonte = ler("EventosAdmin.html");
ok(/include\('CompassoInscricoes'\)/.test(adminFonte),
   "a Central é INCLUÍDA no arquivo, não carregada por endereço");

passo("nada disso abre aba do navegador");

igual(ev.abertas.length, 0,
      "navegar entre submódulos não abriu nenhuma aba",
      "era window.open a cada ação: analisar, ver fila, importar — cada uma " +
      "numa aba do Chrome. 'Eu não preciso abrir várias abas pra buscar uma " +
      "informação'");

passo("a barra de submódulos não se repete dentro da tela");

ok(/<div class="ev-abas" role="tablist" hidden>/.test(adminFonte),
   "a barra horizontal de submódulos está escondida",
   "ela repetia Painel/Programação/Festa/Bingo, que o menu lateral já mostra — " +
   "o usuário: 'está tendo o mesmo submódulo, está com abas, está repetido'");
ok(/id="evOnde"/.test(adminFonte),
   "  e o nome do submódulo aparece no lugar dela",
   "tirar a barra sem dizer onde se está deixaria a pessoa sem referência");

passo("a tela Ingressos é a mesma lista, noutro estado");

/* Ingressos é a MESMA lista embutida, com outro recorte — sem recarregar
   página nenhuma: a tela já está aqui, só se pede o filtro a ela. */
let filtroPedido = null;
ev.win.compassoAplicarFiltro = f => { filtroPedido = f; };
ev.win.evTela("ingressos");
igual(ev.els.evInscricoes.hidden, false, "Ingressos mostra a mesma lista");
igual(filtroPedido, "participantes",
      "  pedindo a ela o recorte de quem já tem ingresso",
      "é a mesma tela noutro estado, não outra tela");

passo("Bingo é submódulo próprio, não uma aba de sorteios");

ev.win.evSub("bingo");
igual(ev.els["sub-bingo"].getAttribute("aria-selected"), "true", "o submódulo existe");
igual(ev.els["sub-festa"].getAttribute("aria-selected"), "false",
      "  e a Festa deixa de estar selecionada",
      "Festa 2026 e Bingo são processos diferentes, não estados do mesmo");

/* ═══ QUADRO EM BRANCO NUNCA ══════════════════════════════════════════════
   25/08/2026. A navegação por submódulos subiu e funcionou — mas o quadro
   ficou VAZIO, sem uma palavra. A pessoa não tem como saber se está
   carregando, se deu erro ou se não há nada ali.

   A causa mais provável é conhecida deste projeto: `ScriptApp.getService()
   .getUrl()` devolve `/dev` quando a chamada nasce do editor, e `/dev` não
   abre para quem não tem acesso de edição — muito menos dentro de um quadro.
   Foi o que estragou o link do ingresso no piloto de 21/08.

   Duas defesas, porque a primeira pode não bastar: preferir a URL que o
   sistema aprendeu, e AVISAR quando o quadro não carregar. */
passo("o quadro nunca fica em branco calado");

const adminHtml = ler("EventosAdmin.html");
ok(/id="evQuadroAviso"/.test(adminHtml), "existe uma área de aviso sobre o quadro");
ok(/onload="evQuadroCarregou\(\)"/.test(adminHtml),
   "e o quadro avisa quando termina de carregar",
   "sem o onload não há como distinguir 'carregando' de 'não carregou'");

const abrirQuadro = (adminHtml.match(/function evQuadroAbrir\([\s\S]*?\n\}/) || [""])[0];
ok(/setTimeout/.test(abrirQuadro) && /evQuadroAviso/.test(abrirQuadro),
   "  e há um prazo: passou dele sem carregar, a tela explica",
   "área em branco sem explicação é o pior resultado possível");
ok(/\/dev/.test(abrirQuadro),
   "  o caso /dev é reconhecido e nomeado antes de tentar",
   "é a causa conhecida: /dev só abre para quem edita o projeto");
ok(/evQuadroNovaAba/.test(adminHtml.match(/function evQuadroAviso[\s\S]*?\n\}/)[0]),
   "  e todo aviso oferece o caminho que funciona");

/* A URL vem da base APRENDIDA antes de cair no getUrl(). */
const agenda = ler("EventosAgenda.gs");
const corpoUrl = corpoDe(agenda, "eventos_obterWebAppUrl").corpo;
ok(/getSistemaUrlBase/.test(corpoUrl),
   "eventos_obterWebAppUrl prefere a base aprendida (SISGEP_URL_BASE)");
ok(corpoUrl.indexOf("getSistemaUrlBase") < corpoUrl.indexOf("ScriptApp.getService"),
   "  e só cai no getUrl() se aquela não existir",
   "a ordem é a correção: getUrl() é justamente quem devolve /dev");

/* ═══ SEM DIÁLOGO NATIVO ══════════════════════════════════════════════════
   25/08/2026. O usuário mandou a foto de um confirm() do navegador anunciando
   "uma página incorporada em n-hlio7e77srckp5nxhl6gitflvadt2qapsbjnp6q-0lu-
   script.googleusercontent.com diz", com o campo de motivo dentro. Comentário
   dele: "fora do padrão SISGEP".

   O CLAUDE.md já proibia isso em letra — "nunca usar alert()/confirm()
   nativo". Eu tinha usado prompt() e confirm() em treze pontos desta tela. */
passo("nenhuma pergunta usa caixa do navegador");

const semNativos = html
  .replace(/\/\*[\s\S]*?\*\//g, "")     /* comentários citam os nomes */
  .replace(/<!--[\s\S]*?-->/g, "");
ok(!/[^.\w]confirm\s*\(/.test(semNativos),
   "não há confirm() nativo",
   "além de fora do padrão, ele mostra o endereço cru do googleusercontent " +
   "no meio de uma exclusão");
ok(!/[^.\w]prompt\s*\(/.test(semNativos),
   "  nem prompt()");
ok(/function perguntar\(opcoes, aoConfirmar\)/.test(html),
   "existe UM diálogo do sistema, reaproveitado");
ok(/id="dgFundo"/.test(html) && /id="dgCampo"/.test(html),
   "  com marcação própria e campo opcional");

/* O campo obrigatório é validado DENTRO do diálogo. */
const corpoConfirmar = (html.match(/function dgConfirmar\(\)\{[\s\S]*?\n\}/) || [""])[0];
ok(/Preencha antes de confirmar/.test(corpoConfirmar),
   "diálogo com campo não confirma vazio",
   "sem isso a exclusão seguiria sem motivo, e o motivo é o que fica na " +
   "auditoria");
ok(/dgFechar\(\)/.test(corpoConfirmar) && corpoConfirmar.indexOf("acao(valor)") > 0,
   "  e só chama a ação depois de fechar, com o valor digitado");

/* As ações destrutivas pedem motivo — e o pedido está no diálogo, não fora. */
["excluirLote", "excluirInscricao", "cancelarIngresso", "estornarPagamento"].forEach(nome => {
  const corpo = (html.match(new RegExp("function " + nome + "\\([^)]*\\)\\{[\\s\\S]*?\\n\\}")) || [""])[0];
  ok(/campo: true/.test(corpo), nome + " pede motivo pelo diálogo");
  ok(/perigo: true/.test(corpo), "  e se apresenta como ação destrutiva");
});

/* ═══ SELECIONAR A LISTA INTEIRA ══════════════════════════════════════════
   "Não tem a opção de selecionar e excluir todos" — dito com 50 marcadas na
   tela. O checkbox do cabeçalho pega a PÁGINA, que é o que ele mostra; para
   alcançar as 124 era preciso trocar o tamanho da página antes, e ninguém
   adivinha isso. */
passo("dá para pular da página para a lista inteira");

t = montarTela();
t.tela.LISTA = Array.from({ length: 124 }, (_, i) => pessoa({ inscricaoId: "INS-" + i }));
t.tela.pintarLista();
t.tela.marcarTodos({ checked: true });

const selPagina = Object.keys(t.tela.SEL).length;
igual(selPagina, 50, "o cabeçalho marca a página — 50");
igual(t.els.btSelTudo.hidden, false,
      "e aparece o atalho para a lista inteira",
      "é o gesto do Gmail: marcou a página, ofereça o resto");
ok(/124/.test(t.els.btSelTudo.textContent),
   "  dizendo quantas são ao todo");

t.tela.selecionarTudo();
igual(Object.keys(t.tela.SEL).length, 124,
      "clicar nele seleciona as 124",
      "é o que faltava para 'excluir todos' em um gesto");
igual(t.els.btSelTudo.hidden, true,
      "  e o atalho some, porque não há mais o que somar");

/* Com tudo cabendo numa página, o atalho não faz sentido. */
t = montarTela();
t.tela.LISTA = [pessoa(), pessoa({ inscricaoId: "INS-2" })];
t.tela.pintarLista();
t.tela.marcarTodos({ checked: true });
igual(t.els.btSelTudo.hidden, true,
      "lista curta não mostra o atalho",
      "oferecer 'selecionar todas as 2' com as 2 já marcadas é ruído");

/* ═══ `hidden` QUE NÃO ESCONDE ════════════════════════════════════════════
   25/08/2026. Escondi a barra de submódulos com o atributo `hidden` e o
   usuário respondeu "continua duplicado" — com a barra na tela.

   A causa é uma regra de cascata que engana: `hidden` vale `display:none`
   pela folha do NAVEGADOR, e qualquer `display` escrito numa regra de classe
   ganha dela. `.ev-abas{display:flex}` mantinha a barra visível apesar do
   atributo.

   Meu teste anterior viu o `hidden` no HTML e passou. Ver o atributo não é
   ver o efeito — por isso esta varredura cruza as duas coisas, e roda sobre
   TODAS as telas: o mesmo engano estava em mais quatro lugares, incluindo a
   numeração de página, que nunca sumia, e o seletor de motivo, que ficava na
   tela mesmo ao escolher "Validar". */
passo("todo elemento escondido está mesmo escondido");

["EventosAdmin.html", "CompassoInscricoes.html", "CompassoImportacao.html"].forEach(arq => {
  const src = ler(arq);
  const css = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n");

  const comDisplay = new Set();
  [...css.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g)]
    .forEach(m => { if (/display\s*:/.test(m[2])) comDisplay.add(m[1]); });
  const protegidas = new Set(
    [...css.matchAll(/\.([a-zA-Z0-9_-]+)\[hidden\]/g)].map(m => m[1]));

  /* Quem é escondido, pelas TRÊS formas — e a terceira é a que escapou na
     primeira versão desta varredura: elemento sem id, escondido só pelo
     atributo. Era exatamente o caso da barra de submódulos, e a mutação
     "barra volta a aparecer" sobreviveu por causa disso. */
  const furos = [];
  const conferir = (classes, quem) => String(classes || "").split(/\s+/).forEach(c => {
    if (comDisplay.has(c) && !protegidas.has(c)) furos.push(quem + " (." + c + ")");
  });

  /* 1. qualquer tag com class e o atributo hidden, com ou sem id */
  [...src.matchAll(/<[a-z]+[^>]*class="([^"]*)"[^>]*\bhidden\b[^>]*>/g)]
    .forEach(m => conferir(m[1], "tag hidden"));
  [...src.matchAll(/<[a-z]+[^>]*\bhidden\b[^>]*class="([^"]*)"[^>]*>/g)]
    .forEach(m => conferir(m[1], "tag hidden"));

  /* 2. e os que o script esconde por id */
  [...src.matchAll(/g\(.([a-zA-Z0-9_-]+).\)\.hidden/g)].map(m => m[1]).forEach(id => {
    const re = new RegExp('id="' + id + '"[^>]*class="([^"]*)"|class="([^"]*)"[^>]*id="' + id + '"');
    const m = re.exec(src);
    if (m) conferir(m[1] || m[2], id);
  });

  ok(furos.length === 0,
     arq + ": nenhum `hidden` anulado por display",
     furos.length ? "ficam visíveis mesmo escondidos: " + furos.join(", ")
                  : "cada classe com display próprio precisa da regra [hidden]");
});

/* ══════════════════════════════════════════════════════════════════════════
   OS DOIS LINKS — 25/08/2026

   Duas perguntas do usuário no mesmo dia, e as duas eram a mesma falha de
   raciocínio minha:

     "o link do ingresso não aparece também"
     "O link da inscrição? Foi para aonde?"

   O DO INGRESSO nunca existiu na tela: `compasso_ingressoArquivo` devolvia a
   URL e o modal só tinha um botão que fazia `window.open` — bloqueado com
   frequência dentro do iframe do Apps Script, e sem nada de onde copiar.

   O DA INSCRIÇÃO existia e eu o escondi: quando a Central passou a ser
   desenhada dentro da tela de Eventos, escondi o cabeçalho dela para não
   empilhar dois títulos, e o cabeçalho carregava os dois botões de ação.

   A lição das duas é uma só, e é a mesma da barra duplicada: esconder um
   contêiner esconde tudo o que ele carrega. Estas asserções não conferem
   estilo — conferem que os botões estão FORA do cabeçalho que some.
   ══════════════════════════════════════════════════════════════════════════ */
passo("os dois links, e o contêiner que os levou junto");

const insc = ler("CompassoInscricoes.html");
const admin = ler("EventosAdmin.html");

/* ─── o link de inscrição ─── */
const cabecalho = (insc.match(/<div class="of-modulo-header">[\s\S]*?<\/div>\s*<\/div>/) || [""])[0];
ok(cabecalho.indexOf("copiarLink()") < 0,
   "o botão de copiar link NÃO está mais dentro do cabeçalho do módulo",
   "é esse cabeçalho que a tela de Eventos esconde ao embutir a Central");

const linhaAbas = (insc.match(/<div class="of-tabs-linha">[\s\S]*?<\/div>\s*<\/div>/) || [""])[0];
ok(/copiarLink\(\)/.test(linhaAbas) && /carregar\(\)/.test(linhaAbas),
   "  e está na linha das abas, junto com o atualizar",
   "a linha das abas aparece nos dois modos: embutida e pela rota ?painel=compasso");

ok(/\.of-tabs-acoes\s*\{/.test(insc) && /\.of-tabs-linha\s*\{/.test(insc),
   "  com estilo próprio declarado — nada herdado do cabeçalho que sumiu");

/* A regra que causou tudo continua lá, e deve continuar: o que mudou é o que
   ela alcança. Se alguém devolver os botões para o cabeçalho, esta asserção
   acima cai — que é exatamente o ponto. */
ok(/\.ev-embutido #compassoInscricoes>\.of-modulo-header\{display:none\}/.test(admin),
   "a tela de Eventos continua escondendo só o cabeçalho da Central embutida");
ok(/o link da inscrição foi para onde/i.test(admin),
   "  e a regra carrega, em comentário, o que ela já custou",
   "quem for mexer nela precisa ler isto antes");

/* ─── o link do ingresso ─── */
ok(/id="mdLinkBox"/.test(insc) && /id="mdLink"/.test(insc),
   "o modal do ingresso tem campo para o link");
ok(/mdLinkBox[\s\S]{0,40}hidden/.test(insc),
   "  que nasce escondido",
   "campo vazio à espera passa a impressão de que o link não existe");
ok(/if \(r\.url\)\{[^}]*mdLink.*value = r\.url[\s\S]{0,80}hidden = false/.test(insc),
   "  e só aparece quando o backend devolve a URL");
ok(/readonly/.test(insc) && /onclick="this\.select\(\)"/.test(insc),
   "  o campo é de leitura e seleciona ao clicar");
ok(/function mdCopiarLink\(\)/.test(insc), "  há botão de copiar");
/* A MUTAÇÃO CORRIGIU ESTA ASSERÇÃO. A primeira versão procurava "selecionar"
   até 120 caracteres depois do writeText — e o `catch(e){ selecionar(); }`
   logo abaixo fazia o teste passar mesmo com o tratamento de recusa removido.
   O que precisa existir é o SEGUNDO argumento do .then: a promessa recusada é
   o caminho comum dentro do iframe, e sem ele o botão falha em silêncio. */
ok(/writeText\(url\)\.then\(\s*function\(\)\{[^}]*\},\s*selecionar\)/.test(insc),
   "  com plano B na RECUSA da promessa, não só no throw",
   "dentro do iframe a promessa costuma ser recusada, não estourar — " +
   "o plano B seleciona o texto em vez de devolver erro");
ok(/\.md-link\[hidden\]\{display:none\}/.test(insc),
   "  e a regra [hidden] do campo, para o display da classe não vencer o atributo");

/* A URL vem do servidor, não é montada na tela — se um dia o link mudar de
   formato, muda num lugar só. */
const gsEntrega = ler("EventosEntrega.gs");
ok(/url: compasso_ingressoUrlPublica_\(ctx\.qrToken\)/.test(gsEntrega),
   "a URL do ingresso é montada no servidor e devolvida pronta",
   "a tela não concatena endereço — nunca fica desencontrada do que vai no e-mail");

resumo();
