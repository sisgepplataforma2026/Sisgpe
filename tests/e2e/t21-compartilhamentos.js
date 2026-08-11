/**
 * TESTE — COMPARTILHAMENTOS (tela 16.6)
 *
 * O QUE ESTE TESTE EXISTE PARA PROVAR
 * Que a revogação revoga de verdade.
 *
 * Uma tela que lista links e tem um botão "revogar" que só muda um status é
 * pior que não ter tela: dá sensação de controle sem o controle. Quem
 * revogasse iria dormir tranquilo com o link ainda abrindo.
 *
 * Por isso o passo 6 é o centro daqui — ele revoga e DEPOIS tenta usar o
 * link pelo mesmo caminho que o fornecedor usaria.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

/* ══════════ 1. O LINK NASCE REGISTRADO ══════════ */
b.fluxo("COMPARTILHAMENTO · O link nasce registrado");

b.passo("1. Gerar token de fornecedor registra o link");
// O gancho está no funil de criação — todo link de fornecedor nasce ali,
// venha de qual ponto de envio vier.
const tokenForn = g.gerarTokenFornecedorDespesa_("DESP-2026-0500");
const lista1 = g.compartListar({}, ADM);
b.ok(lista1.ok && lista1.total >= 1, "um registro por link gerado",
  lista1.total + " link(s)");

b.passo("2. Com tipo, referência e validade");
const link = lista1.links[0];
b.ok(link.tipo === "NF_FORNECEDOR" && link.referencia === "DESP-2026-0500" && !!link.validade,
  "dá para saber o que é, de qual despesa e até quando vale",
  link.tipoRotulo + " · " + link.referencia);

b.passo("3. Nasce ATIVO");
b.ok(link.estado === "ATIVO", "estado inicial", link.estado);

b.passo("4. O TOKEN INTEIRO NUNCA SAI PARA A TELA");
// Se saísse, esta tela viraria uma lista de acessos prontos para uso —
// qualquer um que a abrisse teria os links funcionando na mão.
const vazouToken = JSON.stringify(lista1).indexOf(tokenForn) > -1;
b.ok(vazouToken === false && link.tokenPrefixo.length === 8,
  "só o prefixo de 8 caracteres chega à tela",
  vazouToken ? "VAZOU O TOKEN INTEIRO" : "prefixo: " + link.tokenPrefixo);

b.passo("5. E a criação entra na trilha");
const naTrilha = g.auditoriaConsultar({ acao: "GERAR_LINK_PUBLICO" }, ADM).acoes;
b.ok(naTrilha.length >= 1 && naTrilha[0].submodulo === "Compartilhamentos",
  "gerar link público é evento de auditoria",
  naTrilha.length ? naTrilha[0].justificativa : "não achou");

/* ══════════ 2. O PASSO QUE MAIS IMPORTA ══════════ */
b.fluxo("COMPARTILHAMENTO · Revogar revoga DE VERDADE");

b.passo("6. Antes de revogar, o link abre");
// Estabelece a linha de base pelo MESMO caminho que o fornecedor usa.
const antesRevogar = g.buscarTokenFornecedorDespesa_(tokenForn);
b.ok(antesRevogar && antesRevogar.idDespesa === "DESP-2026-0500",
  "o token vale e devolve a despesa", antesRevogar ? antesRevogar.idDespesa : "null");

b.passo("7. Depois de revogar, o link PARA de abrir");
// Se este passo falhar, a tela inteira é decoração.
const rev = g.compartRevogar(link.id, "Enviado para o e-mail errado", ADM);
const depoisRevogar = g.buscarTokenFornecedorDespesa_(tokenForn);
b.ok(rev.ok === true && depoisRevogar === null,
  "o mesmo caminho que o fornecedor usa passa a recusar",
  "revogou=" + rev.ok + " · buscarToken devolveu " + String(depoisRevogar));

b.passo("8. E o estado na lista acompanha");
const lista2 = g.compartListar({}, ADM);
const revogado = lista2.links.filter(x => x.id === link.id)[0];
b.ok(revogado.estado === "REVOGADO" && revogado.motivo === "Enviado para o e-mail errado" &&
     !!revogado.revogadoPor,
  "quem revogou, quando e por quê",
  revogado.revogadoPor + " · " + revogado.motivo);

b.passo("9. Revogar duas vezes não é erro silencioso");
const rev2 = g.compartRevogar(link.id, "tentando de novo", ADM);
b.ok(rev2.ok === false && String(rev2.mensagem).indexOf("já estava") > -1,
  "diz que já estava revogado", rev2.mensagem);

/* ══════════ 3. O MOTIVO É OBRIGATÓRIO ══════════ */
b.fluxo("COMPARTILHAMENTO · Motivo obrigatório");

b.passo("10. Sem motivo, não revoga");
// Revogar desliga o acesso de alguém de fora que estava contando com ele. O
// fornecedor descobre que o link parou, sem explicação — quem revogou
// precisa ter deixado escrito por quê.
const tokenCont = g.gerarTokenContabilidadeDespesa_("DESP-2026-0501");
const listaC = g.compartListar({}, ADM);
const linkCont = listaC.links.filter(x => x.tipo === "CONTABILIDADE")[0];
const semMotivo = g.compartRevogar(linkCont.id, "", ADM);
b.ok(semMotivo.ok === false, "recusa sem motivo", semMotivo.mensagem);

b.passo("11. Motivo curto demais também não passa");
const curto = g.compartRevogar(linkCont.id, "erro", ADM);
b.ok(curto.ok === false, "quatro letras não é justificativa", curto.mensagem);

b.passo("12. E o link continua valendo depois da recusa");
// Recusar a revogação não pode deixar o link num meio-termo.
b.ok(g.buscarTokenContabilidadeDespesa_(tokenCont) !== null,
  "recusa não desliga nada pela metade", "token ainda vale");

/* ══════════ 4. USO E EXPIRAÇÃO ══════════ */
b.fluxo("COMPARTILHAMENTO · Uso e expiração");

b.passo("13. Abrir o link marca como usado");
const listaU = g.compartListar({}, ADM);
const usado = listaU.links.filter(x => x.id === linkCont.id)[0];
b.ok(usado.estado === "USADO" && !!usado.usadoEm,
  "dá para saber se o destinatário chegou a abrir", usado.estado);

b.passo("14. Validade vencida vira EXPIRADO sem ninguém mexer");
// O estado é derivado da data, não de uma rotina que precise rodar. Rotina
// que não roda deixaria links "ativos" para sempre na tela.
const aba = ss.getSheetByName("SISGEP_Links");
const ontem = new Date(new Date().getTime() - 24 * 3600 * 1000);
aba.getRange(2, 8).setValue(ontem);   // VALIDADE
aba.getRange(2, 9).setValue("ATIVO"); // ESTADO
const listaE = g.compartListar({}, ADM);
const expirado = listaE.links.filter(x => String(x.id) === String(aba.getRange(2,1).getValue()))[0];
b.ok(expirado && expirado.estado === "EXPIRADO",
  "o estado é derivado da data", expirado ? expirado.estado : "não achou");

/* ══════════ 5. O PIXEL NÃO É REVOGÁVEL ══════════ */
b.fluxo("COMPARTILHAMENTO · O que não faz sentido revogar");

b.passo("15. Pixel de leitura não é revogável");
// Ele não dá acesso a nada — só registra que o e-mail foi aberto. Oferecer
// "revogar" ali seria prometer uma proteção que não existe.
g.compart_registrar_({ token: "pix" + Date.now(), tipo: "PIXEL_LEITURA", referencia: "NF-01" });
const listaP = g.compartListar({}, ADM);
const pixel = listaP.links.filter(x => x.tipo === "PIXEL_LEITURA")[0];
b.ok(pixel && pixel.revogavel === false, "a tela não oferece o botão", "revogavel=" + pixel.revogavel);

b.passo("16. E o backend recusa mesmo se chamarem direto");
const tentaPixel = g.compartRevogar(pixel.id, "quero revogar assim mesmo", ADM);
b.ok(tentaPixel.ok === false, "a trava não é só da tela", tentaPixel.mensagem);

/* ══════════ 6. NADA DISSO PODE DERRUBAR A OPERAÇÃO ══════════ */
b.fluxo("COMPARTILHAMENTO · O registro não derruba o envio");

b.passo("17. Registro quebrado não impede o link de ser gerado");
// A geração do token acontece no meio do fluxo que manda e-mail ao
// fornecedor. Falhar aqui não pode impedir o e-mail de sair.
const guardada = g.compart_registrar_;
g.compart_registrar_ = function () { throw new Error("falha simulada"); };
let derrubou = false, t = null;
try { t = g.gerarTokenFornecedorDespesa_("DESP-2026-0502"); } catch (e) { derrubou = true; }
g.compart_registrar_ = guardada;
b.ok(derrubou === false && !!t, "o token sai mesmo assim", derrubou ? "LANÇOU" : "token gerado");

b.passo("18. Checagem de revogação quebrada mantém o link valendo");
// Escolha deliberada: erra para o lado do acesso, não do bloqueio. Se uma
// falha de leitura bloqueasse todos os links, uma indisponibilidade da
// planilha derrubaria o envio de nota fiscal de todos os fornecedores de
// uma vez, sem ninguém entender por quê.
const guardada2 = g.compart_revogado_;
g.compart_revogado_ = function () { throw new Error("planilha fora do ar"); };
const aindaVale = g.buscarTokenFornecedorDespesa_(t);
g.compart_revogado_ = guardada2;
b.ok(aindaVale !== null, "indisponibilidade não vira bloqueio geral",
  aindaVale ? "link seguiu válido" : "BLOQUEOU TUDO");

/* ══════════ 7. PERMISSÃO ══════════ */
b.fluxo("COMPARTILHAMENTO · Permissão");

b.passo("19. Listar exige o módulo");
b.bloqueia(() => g.compartListar({}, FIN), "compartListar nega");
b.bloqueia(() => g.compartListar({}, ""), "nega token vazio");

b.passo("20. Revogar exige administrador");
b.bloqueia(() => g.compartRevogar("LNK-1", "motivo qualquer", FIN), "compartRevogar nega não-admin");

b.naoTestavel("O link aberto no navegador de quem recebeu",
  "roteiro manual: gerar um envio de NF, abrir o link, revogar pela tela e " +
  "recarregar o link — tem que deixar de abrir");
b.naoTestavel("Links criados ANTES desta tela existir",
  "não há registro deles em lugar nenhum para recuperar; continuam " +
  "funcionando e não aparecem na lista");

b.resumo();
process.exit(0);
