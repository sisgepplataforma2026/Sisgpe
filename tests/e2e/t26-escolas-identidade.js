/**
 * TESTE — IDENTIDADE ÚNICA DA ESCOLA (Fase 1 do item 8 do PROMPT-MESTRE)
 *
 * O QUE ESTE TESTE EXISTE PARA PROVAR
 *
 * Que o escolaId aguenta ser identidade. Um id que muda, que se repete ou que
 * é reaproveitado é pior que nenhum id: cria a confiança de que a referência
 * aponta para a escola certa, sem a garantia.
 *
 * Os passos que mais importam são o 8 (id não volta a ser usado depois de a
 * escola ser excluída) e o 14 (id absorvido numa fusão continua resolvendo).
 * Se qualquer um dos dois falhar, o vínculo dos ~8.000 associados não pode
 * ser migrado para cá — e a Fase 4 inteira cai.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const ESC = b.logar(g, "joscimar");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CNPJ_A = "11222333000181";
const CNPJ_B = "22333444000181";
const CNPJ_C = "33444555000181";

const CABECALHO = [
  "Unidade", "Escola (Razão Social)", "CNPJ", "E-mail (principal)", "E-mails (todos)",
  "Telefone 1", "Telefone 2", "Cidade", "Endereço", "Número", "Bairro", "Complemento",
  "UF", "CEP", "NOME_FANTASIA", "SITUACAO_CADASTRAL", "Rede", "Responsavel",
  "CargoResponsavel", "Observacoes", "DataCadastro", "UsuarioCadastro"
];

function zerarTudo() {
  ["Escolas", g.ESC_ABA_MERGES].forEach(function (nome) {
    const sh = ss.getSheetByName(nome);
    if (sh) ss.deleteSheet(sh);
  });
  ss.getSheets().forEach(function (sh) {
    if (String(sh.getName()).indexOf("BACKUP_ESCOLAS") === 0) ss.deleteSheet(sh);
  });
  try { g.PropertiesService.getScriptProperties().deleteProperty(g.ESC_PROP_ULTIMO_ID); } catch (e) {}
  const sh = ss.insertSheet("Escolas");
  sh.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]);
  try { g.CacheService.getScriptCache().remove("sisgep_escolas_lista_v2"); } catch (e) {}
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (e) {}
  return sh;
}
function linhaCrua(nome, cnpj, extras) {
  const l = new Array(CABECALHO.length).fill("");
  l[CABECALHO.indexOf("Escola (Razão Social)")] = nome;
  l[CABECALHO.indexOf("CNPJ")] = cnpj || "";
  l[CABECALHO.indexOf("SITUACAO_CADASTRAL")] = "ATIVA";
  Object.keys(extras || {}).forEach(function (k) {
    const i = CABECALHO.indexOf(k);
    if (i > -1) l[i] = extras[k];
  });
  return l;
}
function idsNaPlanilha() {
  const sh = ss.getSheetByName("Escolas");
  const hMap = g.getHeaderMapEscolas_(sh);
  const col = hMap[g.ESC_COL_ID];
  if (!col || sh.getLastRow() < 2) return [];
  return sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0] || "").trim(); });
}

/* ══════════════════════════════════════════════════════════════════════
   1. A MIGRAÇÃO — a rotina que toca as 681 linhas reais
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Migrar a base existente");

const sh0 = zerarTudo();
sh0.appendRow(linhaCrua("Escola Alfa", "11.222.333/0001-81", { "E-mail (principal)": "alfa@e.com" }));
sh0.appendRow(linhaCrua("Escola Beta", "22.333.444/0001-81", {}));
sh0.appendRow(linhaCrua("Escola Sem CNPJ", "", { "Cidade": "Cariacica" }));
sh0.appendRow(linhaCrua("", "", { "Telefone 1": "27999990000" }));   // cadastro sem nome

b.passo("1. Antes de migrar, o status acusa a base inteira sem identidade");
const st0 = g.escolaStatusIdentidade(ADM);
b.ok(st0.ok === true && st0.colunaExiste === false && st0.semId === 4,
  "o sistema sabe dizer que ninguém tem id", st0.mensagem);

b.passo("2. Migrar cria a coluna e dá id a todas as linhas");
const mig1 = g.escolaMigrarIds(ADM);
const ids1 = idsNaPlanilha();
b.ok(mig1.ok === true && mig1.criados === 4 && ids1.length === 4 && ids1.every(g.escolaIdValido_),
  "as 4 linhas receberam identidade", mig1.mensagem);

b.passo("3. INCLUSIVE a linha sem razão social");
// Sem id ela continuaria invisível para exclusão e para o lote — que é
// exatamente o defeito que esta fase existe para fechar.
b.ok(g.escolaIdValido_(ids1[3]),
  "cadastro incompleto também é escola, e também tem identidade", ids1[3] || "(vazio)");

b.passo("4. Os ids são únicos e sequenciais");
const unicos = ids1.filter(function (v, i, a) { return a.indexOf(v) === i; });
b.ok(unicos.length === 4 && ids1[0] === "ESC-000001" && ids1[3] === "ESC-000004",
  "um id por linha, sem repetição", ids1.join(" · "));

b.passo("5. E a migração fez backup antes de escrever");
b.ok(!!mig1.backup && !!ss.getSheetByName(mig1.backup),
  "a base de antes está guardada", mig1.backup || "SEM BACKUP");

b.passo("6. ⚠ RODAR DE NOVO NÃO PODE MUDAR NADA");
// Idempotência é o que torna a migração segura de repetir em produção.
const mig2 = g.escolaMigrarIds(ADM);
const ids2 = idsNaPlanilha();
b.ok(mig2.ok === true && mig2.criados === 0 && mig2.jaTinham === 4 &&
     JSON.stringify(ids1) === JSON.stringify(ids2),
  "segunda passada: zero criados, zero alterados", mig2.mensagem);

b.passo("7. E nem cria backup à toa");
b.ok(!mig2.backup, "sem escrita, sem aba nova", mig2.backup || "nenhum backup criado");

/* ══════════════════════════════════════════════════════════════════════
   2. O ID NUNCA VOLTA — a garantia que sustenta as referências
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Id excluído nunca é reaproveitado");

b.passo("8. ⚠ Excluir a última escola e cadastrar outra NÃO repete o id");
// Se repetisse, um ofício emitido para a escola apagada passaria a apontar
// para a escola nova. Errar aqui é pior que não ter id nenhum.
const antesExcl = idsNaPlanilha();
const idQueVaiSumir = antesExcl[antesExcl.length - 1];
g.excluirEscolasEmLote([idQueVaiSumir], ADM);
const nova = g.cadastrarEscola({ nomeEscola: "Escola Nova", cnpj: CNPJ_C, municipio: "Serra", uf: "ES" }, ADM);
b.ok(nova.ok === true && nova.escolaId && nova.escolaId !== idQueVaiSumir,
  "o id da escola excluída não é redistribuído",
  "excluído " + idQueVaiSumir + " · novo " + nova.escolaId);

b.passo("9. Nem se a base inteira for apagada");
// O piso fica em ScriptProperties justamente para este caso.
const todosIds = idsNaPlanilha();
g.excluirEscolasEmLote(todosIds, ADM);
b.ok(idsNaPlanilha().length === 0, "base zerada para o teste", "restaram " + idsNaPlanilha().length);
const depoisDoVazio = g.cadastrarEscola({ nomeEscola: "Escola Renascida", cnpj: CNPJ_A, municipio: "Vitória", uf: "ES" }, ADM);
b.ok(depoisDoVazio.ok === true &&
     g.escolaNumeroDoId_(depoisDoVazio.escolaId) > g.escolaNumeroDoId_(todosIds[todosIds.length - 1]),
  "o contador não volta ao começo com a base vazia",
  "último de antes " + todosIds[todosIds.length - 1] + " · novo " + depoisDoVazio.escolaId);

b.passo("10. Cadastro novo já nasce com identidade");
b.ok(g.escolaIdValido_(depoisDoVazio.escolaId),
  "não precisa migrar de novo depois de cada cadastro", depoisDoVazio.escolaId);

b.passo("11. E atualizar o cadastro não troca o id");
const idAntes = depoisDoVazio.escolaId;
g.cadastrarEscola({ nomeEscola: "Escola Renascida", cnpj: CNPJ_A, telefone: "27999991111" }, ADM);
const listaAtu = g.listarEscolasParaModulo(ADM);
const renascida = listaAtu.filter(function (x) { return x.NomeEscola === "Escola Renascida"; })[0];
b.ok(renascida && renascida.escolaId === idAntes,
  "identidade é imutável", idAntes + " → " + (renascida && renascida.escolaId));

/* ══════════════════════════════════════════════════════════════════════
   3. A LISTA ENTREGA O ID PARA A TELA
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · O id chega na tela");

b.passo("12. Toda escola listada vem com escolaId");
const lista = g.listarEscolasParaModulo(ADM);
b.ok(lista.length > 0 && lista.every(function (x) { return g.escolaIdValido_(x.escolaId); }),
  "a tela pode selecionar por identidade, não por CNPJ",
  lista.length + " escola(s), todas com id");

b.passo("13. E dá para buscar a escola pelo id");
const alvo = lista[0];
const achada = g.escolaPorId(alvo.escolaId, ADM);
b.ok(achada && String(achada.NomeEscola) === String(alvo.NomeEscola),
  "escolaPorId devolve o registro certo",
  alvo.escolaId + " → " + (achada ? achada.NomeEscola : "não achou"));

/* ══════════════════════════════════════════════════════════════════════
   4. FUSÃO — o id absorvido não pode virar ponteiro para o nada
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Fundir duplicatas sem quebrar o passado");

const shD = zerarTudo();
shD.appendRow(linhaCrua("Escola Delta", "44.555.666/0001-81", { "E-mail (principal)": "delta@e.com" }));
shD.appendRow(linhaCrua("Escola Delta", "44.555.666/0001-81", { "Bairro": "Centro", "Responsavel": "João" }));
g.escolaMigrarIds(ADM);
const idsDup = idsNaPlanilha();
const idVelho = idsDup[0];
const idNovo  = idsDup[1];

b.passo("14. ⚠ Depois de fundir, o id ABSORVIDO ainda resolve");
// Um ofício emitido antes da fusão guardou o id absorvido. Se ele deixasse de
// resolver, o histórico daquela escola sumiria — em silêncio.
const dedup = g.removerEscolasDuplicadas(ADM);
const res = g.escolaResolverIdentidade(idNovo, ADM);
b.ok(dedup.ok === true && res.ok === true && res.fundida === true && res.idAtual === idVelho,
  "o id antigo leva até a escola sobrevivente",
  idNovo + " → " + res.idAtual);

b.passo("15. O sobrevivente mantém o id mais antigo");
// É o que tem mais chance de já estar referenciado em ofício ou cobrança.
const idsPos = idsNaPlanilha();
b.ok(idsPos.length === 1 && idsPos[0] === idVelho,
  "quem sobrevive é a identidade mais velha", idsPos.join(" · "));

b.passo("16. E a fusão ficou registrada, com quem e por quê");
const shM = ss.getSheetByName(g.ESC_ABA_MERGES);
const merges = shM && shM.getLastRow() > 1 ? shM.getRange(2, 1, shM.getLastRow() - 1, 5).getValues() : [];
b.ok(merges.length === 1 && merges[0][1] === idNovo && merges[0][2] === idVelho &&
     String(merges[0][4] || "").trim() !== "",
  "data, absorvido, sobrevivente, motivo e usuário",
  merges.length ? merges[0][1] + " → " + merges[0][2] + " por " + merges[0][4] : "nada registrado");

b.passo("17. Id absorvido não é reaproveitado em cadastro novo");
const posFusao = g.cadastrarEscola({ nomeEscola: "Escola Pós-Fusão", cnpj: CNPJ_B, municipio: "Serra", uf: "ES" }, ADM);
b.ok(posFusao.escolaId !== idNovo && posFusao.escolaId !== idVelho,
  "o número absorvido saiu de circulação para sempre",
  "absorvido " + idNovo + " · novo " + posFusao.escolaId);

b.passo("18. Id que nunca foi fundido resolve para ele mesmo");
const resDireto = g.escolaResolverIdentidade(posFusao.escolaId, ADM);
b.ok(resDireto.ok === true && resDireto.fundida === false && resDireto.idAtual === posFusao.escolaId,
  "sem fusão, sem redirecionamento", posFusao.escolaId);

b.passo("19. Id inexistente não inventa resposta");
const resFalso = g.escolaResolverIdentidade("ESC-999999", ADM);
const achadaFalsa = g.escolaPorId("ESC-999999", ADM);
b.ok(achadaFalsa === null && resFalso.idAtual === "ESC-999999" && resFalso.fundida === false,
  "id que não existe devolve null, não a escola errada",
  "escolaPorId=" + String(achadaFalsa));

b.passo("20. Lixo no lugar do id não vira escola");
b.ok(g.escolaPorId("", ADM) === null && g.escolaPorId("banana", ADM) === null &&
     g.escolaIdValido_("ESC-abc") === false && g.escolaIdValido_("000001") === false,
  "só o formato ESC-NNNNNN é aceito");

/* ══════════════════════════════════════════════════════════════════════
   5. O QUE A IDENTIDADE DESTRAVA — os 2 testes vermelhos de t25
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Escola sem CNPJ deixa de ficar presa");

const shS = zerarTudo();
shS.appendRow(linhaCrua("Escola Sem Documento", "", { "Cidade": "Cariacica" }));
shS.appendRow(linhaCrua("Escola Com Documento", "11.222.333/0001-81", {}));
g.escolaMigrarIds(ADM);
const idsSem = idsNaPlanilha();

b.passo("21. Inativar escola sem CNPJ, por id");
const sit = g.atualizarSituacaoEscolasEmLote([idsSem[0]], "INATIVA", ADM);
b.ok(sit.ok === true && sit.atualizadas === 1,
  "o que era impossível por CNPJ funciona por identidade", sit.mensagem);

b.passo("22. Excluir escola sem CNPJ, por id");
const excl = g.excluirEscolasEmLote([idsSem[0]], ADM);
b.ok(excl.ok === true && excl.excluidas === 1,
  "a linha deixa de ficar presa na base para sempre", excl.mensagem);

b.passo("23. E excluir por id NÃO derruba a irmã de mesmo CNPJ");
const shI = zerarTudo();
shI.appendRow(linhaCrua("Irmã Velha", "11.222.333/0001-81", {}));
shI.appendRow(linhaCrua("Irmã Nova",  "11.222.333/0001-81", {}));
g.escolaMigrarIds(ADM);
const idsIrmas = idsNaPlanilha();
const exclIrma = g.excluirEscolasEmLote([idsIrmas[1]], ADM);
const restantes = g.listarEscolasParaModulo(ADM);
b.ok(exclIrma.ok === true && exclIrma.excluidas === 1 &&
     restantes.length === 1 && restantes[0].NomeEscola === "Irmã Velha",
  "id aponta uma linha, e só uma",
  "excluídas=" + exclIrma.excluidas + " · sobrou " + (restantes[0] && restantes[0].NomeEscola));

b.passo("24. Por CNPJ, a recusa por ambiguidade continua valendo");
const shA = zerarTudo();
shA.appendRow(linhaCrua("Ambígua A", "11.222.333/0001-81", {}));
shA.appendRow(linhaCrua("Ambígua B", "11.222.333/0001-81", {}));
g.escolaMigrarIds(ADM);
const exclAmb = g.excluirEscolasEmLote([CNPJ_A], ADM);
b.ok(exclAmb.ok === false && g.listarEscolasParaModulo(ADM).length === 2,
  "quem ainda manda CNPJ continua protegido", exclAmb.mensagem);

/* ══════════════════════════════════════════════════════════════════════
   6. PERMISSÃO E AUDITORIA
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Permissão");

b.passo("25. Migrar identidade é ação de administrador");
b.bloqueia(function () { return g.escolaMigrarIds(""); },   "migrar exige sessão");
b.bloqueia(function () { return g.escolaMigrarIds(FIN); },  "financeiro não migra");
b.bloqueia(function () { return g.escolaMigrarIds(ESC); },  "usuário de Escolas não-admin não migra");

b.passo("26. Consultar identidade exige sessão");
b.bloqueia(function () { return g.escolaStatusIdentidade(""); },        "status exige sessão");
b.bloqueia(function () { return g.escolaPorId("ESC-000001", ""); },     "buscar por id exige sessão");
b.bloqueia(function () { return g.escolaResolverIdentidade("ESC-000001", ""); }, "resolver exige sessão");

b.passo("27. E a migração entra na trilha de auditoria");
zerarTudo().appendRow(linhaCrua("Escola Trilha", "11.222.333/0001-81", {}));
const trilhaAntes = g.auditoriaConsultar({}, ADM).acoes.length;
g.escolaMigrarIds(ADM);
const trilhaDepois = g.auditoriaConsultar({}, ADM).acoes;
const registrou = trilhaDepois.length > trilhaAntes &&
  trilhaDepois.slice(0, trilhaDepois.length - trilhaAntes)
    .some(function (a) { return /IDENTIDADE/i.test(a.acao || ""); });
b.ok(registrou,
  "dá para saber quem rodou a migração e quando",
  registrou ? "registrada" : "NÃO registrada");

b.resumo();
