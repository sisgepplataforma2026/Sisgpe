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

/* O caminho SEM token existe para o editor do Apps Script, onde não há sessão
 * do SISGEP para apresentar. Quem segura esse caminho é a identidade Google de
 * quem executa, cruzada com a aba USUARIOS. Os três passos abaixo cobram
 * justamente que ela segure — sem eles, o caminho do editor seria um bypass
 * de autorização alcançável por google.script.run de qualquer tela. */

b.passo("25b. ⚠ Sem token e SEM e-mail identificado: recusa");
// É o cenário do navegador anônimo chamando google.script.run. No app
// publicado "executar como eu / qualquer pessoa", getActiveUser() vem vazio.
g.__usuarioAtivoEmail = "";
b.bloqueia(function () { return g.escolaMigrarIds(); },
  "sem identidade, não migra — falha fechado");

b.passo("25c. ⚠ Sem token, com e-mail identificado que não é dono nem admin: recusa");
// Cenário do visitante identificado chamando google.script.run. Nem ser dono
// do projeto, nem administrador cadastrado — não passa.
g.__usuarioAtivoEmail = "rogerio@sindeducacao.com";
b.bloqueia(function () { return g.escolaMigrarIds(); },
  "ter conta Google não basta — tem que ser dono do projeto ou administrador");

b.passo("25d. Sem token e com e-mail de administrador ATIVO: migra");
zerarTudo().appendRow(linhaCrua("Escola Do Editor", "11.222.333/0001-81", {}));
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";
const migEditor = g.escolaMigrarIds();
b.ok(migEditor.ok === true && migEditor.criados === 1 && idsNaPlanilha()[0] === "ESC-000001",
  "o caminho do editor faz o mesmo trabalho do caminho da tela",
  migEditor.mensagem);

b.passo("25f. ⚠ O DONO do projeto migra — é o caso real do editor");
// A conta Google que roda o editor deste projeto é pessoal (@gmail.com); a aba
// de usuários guarda os institucionais (@sindeducacao.com). Nunca vão casar.
// Exigir que casassem obrigaria a criar conta de login no SISGEP só para rodar
// uma migração — conta de acesso a base com 8.000 pessoas não se cria como
// efeito colateral de tarefa técnica.
zerarTudo().appendRow(linhaCrua("Escola Do Dono", "22.333.444/0001-81", {}));
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;   // no editor, ativo === efetivo
const migDono = g.escolaMigrarIds();
b.ok(migDono.ok === true && migDono.criados === 1,
  "quem é dono do projeto Apps Script pode migrar sem estar na aba USUARIOS",
  migDono.mensagem);

b.passo("25g. E quem NÃO é dono continua barrado, mesmo identificado");
g.__usuarioAtivoEmail = "estranho@outrodominio.com";
b.bloqueia(function () { return g.escolaMigrarIds(); },
  "ser identificado não basta — tem que ser o dono ou administrador");
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";

b.passo("25e. E fica registrado QUEM rodou pelo editor");
// Autossuficiente de propósito: faz a própria migração e confere a trilha logo
// depois. A versão anterior lia "a última linha da trilha" e quebrou quando
// passos novos entraram na frente — assertiva que depende da ordem dos vizinhos
// não mede o que promete.
zerarTudo().appendRow(linhaCrua("Escola Da Trilha", "33.444.555/0001-81", {}));
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";
g.escolaMigrarIds();
const ultimas = g.auditoriaConsultar({ acao: "MIGRAR_IDENTIDADE" }, ADM).acoes;
b.ok(ultimas.length > 0 && /wanderson@sindeducacao\.com/i.test(ultimas[0].usuario || ""),
  "o e-mail da conta Google vai para a trilha",
  ultimas.length ? ultimas[0].usuario : "nada registrado");
g.__usuarioAtivoEmail = "";

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

/* ══════════════════════════════════════════════════════════════════════
   7. DIAGNÓSTICO DE COLUNAS — só leitura
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Diagnóstico de colunas");

const shDiag = zerarTudo();
// Acrescenta a coluna duplicada que existe na planilha real, para medir
// exatamente o caso que motivou a função.
shDiag.getRange(1, CABECALHO.length + 1).setValue("RAZAO_SOCIAL");
shDiag.appendRow(linhaCrua("Escola Alfa", "11.222.333/0001-81", { "Cidade": "Vitória" }).concat(["Escola Alfa"]));
shDiag.appendRow(linhaCrua("Escola Beta", "22.333.444/0001-81", {}).concat(["BETA EDUCACIONAL LTDA"]));
shDiag.appendRow(linhaCrua("Escola Gama", "", {}).concat([""]));
g.escolaMigrarIds(ADM);

b.passo("28. Conta o preenchimento de cada coluna");
const diag = g.escolaDiagnosticoColunas(ADM);
const porNome = {};
(diag.colunas || []).forEach(c => { porNome[c.nome] = c; });
b.ok(diag.ok === true && diag.total === 3 &&
     porNome["CNPJ"].preenchidas === 2 && porNome["CNPJ"].vazias === 1,
  "diz quantas linhas cada coluna tem preenchida",
  "CNPJ: " + porNome["CNPJ"].preenchidas + " de " + diag.total);

b.passo("29. E traz amostra do que há dentro — é o que revela coluna com lixo");
b.ok(Array.isArray(porNome["Cidade"].amostra) && porNome["Cidade"].amostra[0] === "Vitória",
  "amostra do conteúdo real da coluna", JSON.stringify(porNome["Cidade"].amostra));

b.passo("30. ⚠ Mede a duplicidade entre as DUAS colunas de razão social");
// Decisão do usuário em 11/08/2026: "Sempre razão social". Antes de consolidar
// é preciso saber em quantas linhas as duas divergem — consolidar às cegas
// escolheria o valor errado em quem diverge.
b.ok(!!diag.duplicidade && diag.duplicidade.iguais === 1 && diag.duplicidade.diferentes === 1 &&
     diag.duplicidade.exemplos.length === 1 &&
     diag.duplicidade.exemplos[0].razaoSocial === "BETA EDUCACIONAL LTDA",
  "separa iguais, diferentes e mostra exemplo das que divergem",
  diag.duplicidade ? ("iguais=" + diag.duplicidade.iguais + " diferentes=" + diag.duplicidade.diferentes) : "não mediu");

b.passo("31. ⚠ E NÃO escreve nada na planilha");
// Diagnóstico que altera dado não é diagnóstico. Comparação byte a byte da aba
// antes e depois.
const antesDiag = JSON.stringify(shDiag.getRange(1, 1, shDiag.getLastRow(), shDiag.getLastColumn()).getValues());
g.escolaDiagnosticoColunas(ADM);
g.escolaDiagnosticoColunas(ADM);
const depoisDiag = JSON.stringify(shDiag.getRange(1, 1, shDiag.getLastRow(), shDiag.getLastColumn()).getValues());
b.ok(antesDiag === depoisDiag, "rodar o diagnóstico não muda uma célula sequer",
  antesDiag === depoisDiag ? "aba idêntica" : "A ABA MUDOU");

b.passo("32. E exige permissão como as demais");
b.bloqueia(function () { return g.escolaDiagnosticoColunas(""); }, "diagnóstico exige sessão");
b.bloqueia(function () { return g.escolaDiagnosticoColunas(FIN); }, "financeiro não diagnostica");

/* ══════════════════════════════════════════════════════════════════════
   8. VALIDADOR LINHA A LINHA
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Validador de conteúdo por coluna");

b.passo("33. Reconhece o que cada conteúdo PARECE ser");
const tipos = [
  ["(27) 2127-1111",       "TELEFONE"],
  ["contato@escola.com",   "EMAIL"],
  ["29190062",             "CEP"],
  ["29.190-062",           "CEP"],
  ["11.222.333/0001-81",   "CNPJ"],
  ["8511200",              "CNAE"],
  ["ES",                   "UF"],
  ["ATIVA",                "SITUACAO"],
  ["ESC-000042",           "ESCOLAID"],
  ["Colégio Alfa",         "TEXTO"],
  ["",                     "VAZIO"]
];
const errosTipo = tipos.filter(([v, esp]) => g.escolaTipoAparente_(v) !== esp)
  .map(([v, esp]) => v + " deu " + g.escolaTipoAparente_(v) + ", esperava " + esp);
b.ok(errosTipo.length === 0 && g.escolaTipoAparente_(new Date()) === "DATA",
  "telefone, e-mail, CEP, CNPJ, CNAE, UF, situação, id e data",
  errosTipo.length ? errosTipo.join(" | ") : "11 formatos reconhecidos");

b.passo("33b. ⚠ CPF na coluna de documento NÃO é dado fora do lugar");
// Escola de pessoa física guarda CPF na coluna CNPJ, e isso é correto — o
// cadastro já aceita. Enquanto o validador não sabia disso, ele acusava as
// três escolas de PF como problema, e eu cheguei a reportá-las ao usuário.
const shCpf = zerarTudo();
shCpf.getRange(1, 1, 1, 2).setValues([["Escola (Razão Social)", "CNPJ"]]);
shCpf.appendRow(["Creche da Dona Maria", "111.444.777-35"]);   // CPF sintético válido
shCpf.appendRow(["Colégio Beta",         "11.222.333/0001-81"]);
const valCpf = g.escolaValidarColunas(ADM);
const colDoc = (valCpf.colunas || []).filter(c => c.nome === "CNPJ")[0] || {};
b.ok(g.escolaTipoAparente_("111.444.777-35") === "CPF" && colDoc.trocadas === 0,
  "CPF válido é reconhecido e aceito na coluna do documento",
  "trocadas=" + colDoc.trocadas);

b.passo("33c. ⚠ Mas número de 11 dígitos qualquer NÃO vira CPF");
// Sem exigir dígito verificador, todo celular escrito sem pontuação viraria
// "CPF" — e o validador deixaria de acusar telefone fora do lugar.
b.ok(g.escolaTipoAparente_("27999999999") !== "CPF" &&
     g.escolaTipoAparente_("111.444.777-00") !== "CPF",
  "exige dígito verificador válido",
  "27999999999 → " + g.escolaTipoAparente_("27999999999"));

b.passo("34. ⚠ Telefone de 10 dígitos NÃO pode ser lido como CEP");
// "(27) 3256-6107" sem pontuação vira 10 dígitos; CEP tem 8. Confundir os dois
// faria o validador aprovar telefone dentro da coluna CEP — justamente o tipo
// de troca que ele existe para achar.
b.ok(g.escolaTipoAparente_("(27) 3256-6107") === "TELEFONE" &&
     g.escolaTipoAparente_("2732566107") !== "CEP",
  "os dois formatos não se confundem",
  "2732566107 → " + g.escolaTipoAparente_("2732566107"));

b.passo("35. Acha dado fora do lugar numa base quebrada igual à real");
const shV = zerarTudo();
const CAB_V = ["Escola (Razão Social)", "CNPJ", "Telefone 1", "UF", "CEP",
               "SITUACAO_CADASTRAL", "RAZAO_SOCIAL"];
shV.getRange(1, 1, 1, CAB_V.length).setValues([CAB_V]);
// linha sadia
shV.appendRow(["Colégio Alfa", "11.222.333/0001-81", "(27) 3333-1111", "ES", "29100-000", "ATIVA", ""]);
// quebradas do mesmo jeito que a planilha real: telefone na razão social,
// e-mail na UF, data na situação
shV.appendRow(["Colégio Beta", "22.333.444/0001-81", "(27) 3333-2222", "beta@e.com", "29100-000", new Date(2026,3,2), "(27) 2127-1111"]);
shV.appendRow(["Colégio Gama", "33.444.555/0001-81", "(27) 3333-3333", "gama@e.com", "29100-000", new Date(2026,3,2), "(27) 2122-4148"]);
const val = g.escolaValidarColunas(ADM);
b.ok(val.ok === true && val.total === 3 && val.linhasSadias === 1 && val.linhasComProblema === 2,
  "separa linha sadia de linha com dado trocado",
  "sadias=" + val.linhasSadias + " problema=" + val.linhasComProblema);

b.passo("36. E diz, por coluna, o que foi encontrado no lugar errado");
const cv = {}; (val.colunas || []).forEach(c => { cv[c.nome] = c; });
b.ok(cv["UF"].trocadas === 2 && cv["UF"].tiposEncontrados.EMAIL === 2 &&
     cv["SITUACAO_CADASTRAL"].trocadas === 2 && cv["SITUACAO_CADASTRAL"].tiposEncontrados.DATA === 2 &&
     cv["RAZAO_SOCIAL"].trocadas === 2 && cv["RAZAO_SOCIAL"].tiposEncontrados.TELEFONE === 2,
  "UF com e-mail, situação com data, razão social com telefone",
  "UF→" + JSON.stringify(cv["UF"].tiposEncontrados) +
  " SIT→" + JSON.stringify(cv["SITUACAO_CADASTRAL"].tiposEncontrados));

b.passo("37. ⚠ E agrupa por PADRÃO de quebra — é assim que a correção se faz");
// Duas linhas quebradas igual quebraram pelo mesmo motivo. Corrigir por padrão
// é o que separa uma migração dirigida de 679 decisões manuais.
b.ok(val.padroes.length === 1 && val.padroes[0].linhas === 2,
  "as duas linhas quebradas caem num padrão só",
  val.padroes.length + " padrão(ões) · " + (val.padroes[0] ? val.padroes[0].linhas + " linha(s)" : ""));

b.passo("38. Coluna correta não é acusada");
b.ok(cv["CNPJ"].trocadas === 0 && cv["Telefone 1"].trocadas === 0 &&
     cv["Escola (Razão Social)"].trocadas === 0,
  "sem falso positivo em CNPJ, telefone e nome",
  "CNPJ=" + cv["CNPJ"].trocadas + " Tel=" + cv["Telefone 1"].trocadas);

b.passo("39. ⚠ E NÃO escreve nada");
const antesVal = JSON.stringify(shV.getRange(1, 1, shV.getLastRow(), shV.getLastColumn()).getValues());
g.escolaValidarColunas(ADM);
b.ok(antesVal === JSON.stringify(shV.getRange(1, 1, shV.getLastRow(), shV.getLastColumn()).getValues()),
  "validar não muda uma célula sequer");

b.passo("40. E exige permissão");
b.bloqueia(function () { return g.escolaValidarColunas(""); },  "validação exige sessão");
b.bloqueia(function () { return g.escolaValidarColunas(FIN); }, "financeiro não valida");

/* ══════════════════════════════════════════════════════════════════════
   9. COMPARAÇÃO DOS DESLOCADOS — o que decide apagar × mover
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Deslocado é cópia ou é único?");

const shC = zerarTudo();
const CAB_C = ["Escola (Razão Social)", "E-mail (principal)", "Telefone 1", "Telefone 2",
               "ULTIMA_VERIFICACAO", "RAZAO_SOCIAL", "NOME_FANTASIA",
               "CNAE_PRINCIPAL", "SITUACAO_CADASTRAL"];
shC.getRange(1, 1, 1, CAB_C.length).setValues([CAB_C]);
// 1 — CÓPIA: o telefone deslocado é o mesmo do lugar certo, só que formatado
//     diferente. Tem que ser reconhecido como cópia, não como divergência.
shC.appendRow(["Escola Cópia", "a@e.com", "(27) 3256-6107", "", "2732566107", "", "", "", ""]);
// 2 — RECUPERÁVEL: a coluna certa está vazia; o dado só existe no lugar errado.
shC.appendRow(["Escola Recupera", "b@e.com", "", "", "(27) 9999-1111", "", "", "", ""]);
// 3 — DIVERGENTE: as duas têm conteúdo e são telefones diferentes.
shC.appendRow(["Escola Diverge", "c@e.com", "(27) 3333-1111", "", "(27) 8888-2222", "", "", "", ""]);

const cmp = g.escolaCompararDeslocados(ADM);
const parTel = (cmp.pares || []).filter(p => p.origem === "ULTIMA_VERIFICACAO")[0] || {};

b.passo("41. ⚠ Telefone igual escrito diferente conta como CÓPIA, não divergência");
// "(27) 3256-6107" e "2732566107" são o mesmo telefone. Comparar texto cru
// classificaria como divergente e mandaria uma decisão humana desnecessária
// para a fila — 268 vezes.
b.ok(parTel.copia === 1, "compara por dígitos, não por pontuação",
  "cópia=" + parTel.copia + " divergente=" + parTel.divergente);

b.passo("42. ⚠ Coluna certa vazia = RECUPERÁVEL, nunca apagar");
// Se este passo falhar e a migração apagar, o telefone dessa escola some e
// não há de onde tirar de volta a não ser do backup.
b.ok(parTel.recuperavel === 1 && parTel.exemplosRecuperavel[0].valor === "(27) 9999-1111",
  "dado que só existe no lugar errado é marcado para MOVER",
  "recuperável=" + parTel.recuperavel);

b.passo("43. E telefone diferente nos dois lados vai para decisão humana");
b.ok(parTel.divergente === 1 &&
     parTel.exemplosDivergente[0].naColunaErrada === "(27) 8888-2222" &&
     parTel.exemplosDivergente[0].naColunaCerta === "(27) 3333-1111",
  "mostra os dois valores lado a lado, sem escolher",
  parTel.exemplosDivergente.length ? JSON.stringify(parTel.exemplosDivergente[0]) : "nenhum");

b.passo("44. E-mail com maiúscula e espaço também é reconhecido como cópia");
zerarTudo();
const shE = ss.getSheetByName("Escolas");
shE.getRange(1, 1, 1, CAB_C.length).setValues([CAB_C]);
shE.appendRow(["Escola Mail", " Contato@Escola.COM ", "", "", "", "", "contato@escola.com", "", ""]);
const cmpE = g.escolaCompararDeslocados(ADM);
const parMail = (cmpE.pares || []).filter(p => p.origem === "NOME_FANTASIA")[0] || {};
b.ok(parMail.copia === 1 && parMail.divergente === 0,
  "caixa e espaço não fazem e-mail diferente",
  "cópia=" + parMail.copia + " divergente=" + parMail.divergente);

b.passo("45. Valor legítimo na própria coluna não entra na conta");
// RAZAO_SOCIAL com razão social de verdade não é deslocamento — é o uso
// correto da coluna. Contar isso como problema inflaria o número e mandaria
// corrigir o que está certo.
zerarTudo();
const shL = ss.getSheetByName("Escolas");
shL.getRange(1, 1, 1, CAB_C.length).setValues([CAB_C]);
shL.appendRow(["Escola Certa", "d@e.com", "(27) 3333-9999", "", "", "BETA EDUCACIONAL LTDA", "", "", ""]);
const cmpL = g.escolaCompararDeslocados(ADM);
const parRaz = (cmpL.pares || []).filter(p => p.origem === "RAZAO_SOCIAL")[0] || {};
b.ok(parRaz.copia === 0 && parRaz.recuperavel === 0 && parRaz.divergente === 0,
  "razão social dentro de RAZAO_SOCIAL não é deslocamento",
  "cópia=" + parRaz.copia + " rec=" + parRaz.recuperavel + " div=" + parRaz.divergente);

b.passo("46. ⚠ E NÃO escreve nada");
const antesCmp = JSON.stringify(shL.getRange(1, 1, shL.getLastRow(), shL.getLastColumn()).getValues());
g.escolaCompararDeslocados(ADM);
b.ok(antesCmp === JSON.stringify(shL.getRange(1, 1, shL.getLastRow(), shL.getLastColumn()).getValues()),
  "comparar não muda uma célula sequer");

b.passo("47. E exige permissão");
b.bloqueia(function () { return g.escolaCompararDeslocados(""); },  "comparação exige sessão");
b.bloqueia(function () { return g.escolaCompararDeslocados(FIN); }, "financeiro não compara");

/* ══════════════════════════════════════════════════════════════════════
   10. SANEAMENTO — a migração que escreve
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("IDENTIDADE · Saneamento da base");

const CAB_S = ["Escola (Razão Social)", "CNPJ", "Telefone 1", "UF",
               "ULTIMA_VERIFICACAO", "RAZAO_SOCIAL", "NOME_FANTASIA",
               "CNAE_PRINCIPAL", "SITUACAO_CADASTRAL", "EMAIL_EXTERNO"];
function montarBaseSuja() {
  // Aba montada do zero, e NÃO por cima da que zerarTudo() cria.
  // zerarTudo escreve o cabeçalho de 22 colunas; escrever CAB_S (10) por cima
  // deixava as colunas 11–22 com os nomes antigos, e a aba passava a ter
  // NOME_FANTASIA e SITUACAO_CADASTRAL DUPLICADOS. cab.indexOf pegava a
  // primeira ocorrência e getHeaderMapEscolas_ a última — o saneamento lia uma
  // coluna e o cadastro escrevia noutra. Dois passos falharam por isso, e a
  // causa era o teste, não a função.
  let sh = ss.getSheetByName("Escolas");
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet("Escolas");
  limparBackupsSan();
  try { g.CacheService.getScriptCache().remove("sisgep_escolas_lista_v2"); } catch (e) {}
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (e) {}
  sh.getRange(1, 1, 1, CAB_S.length).setValues([CAB_S]);
  // A linha quebrada do padrão dominante da base real.
  sh.appendRow(["Escola Suja", "11.222.333/0001-81", "(27) 3333-1111", "",
                "(31) 3515-7500",          // telefone na coluna de data
                "(27) 2127-1111",          // telefone na razão social
                "contato@x.com.br",        // e-mail no nome fantasia
                "ATIVA",                   // situação no CNAE
                new Date(2026, 3, 2),      // data na situação
                "oficial@x.com.br"]);
  // Linha sadia: nada dela pode se mexer.
  sh.appendRow(["Escola Limpa", "22.333.444/0001-81", "(27) 4444-2222", "ES",
                new Date(2026, 2, 9), "RAZAO LTDA", "Fantasia X", "8511200", "ATIVA", "b@x.com"]);
  return sh;
}
function limparBackupsSan() {
  ss.getSheets().forEach(sh => {
    if (String(sh.getName()).indexOf("BACKUP_ESCOLAS") === 0) ss.deleteSheet(sh);
  });
}
function lerAba() {
  const sh = ss.getSheetByName("Escolas");
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const cab = v[0].map(String);
  return { cab, linha: n => { const o = {}; cab.forEach((c, i) => o[c] = v[n][i]); return o; } };
}

b.passo("48. ⚠ Sem a prévia, NÃO roda");
// Esta é a única função desta série que escreve, e escreve em 679 linhas.
// A trava é de ESTADO, não de argumento: o botão Executar do editor chama a
// função SEM ARGUMENTOS, então exigir uma palavra digitada tornava a migração
// impossível de rodar pelo único caminho que existe hoje.
montarBaseSuja();
try { g.PropertiesService.getScriptProperties().deleteProperty(g.ESC_PROP_CONSENTIMENTO); } catch (e) {}
// Sem token, como o editor chama. A identidade do dono passa a permissão —
// que é checada ANTES da trava de mão, e é assim que tem que ser: quem não
// pode nem chega a ver a trava.
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
g.Logger.clear();
const semConf = g.escolaSanearReceita();
b.ok(semConf.ok === false && /pr[ée]via|preparar/i.test(semConf.mensagem || ""),
  "escrever em massa exige a prévia antes", (semConf.mensagem || "").split("\n")[0]);

b.passo("48b. ⚠ E a recusa APARECE no log — não morre calada");
// A primeira versão recusava sem logar. O usuário via "Execução concluída" e
// nada mais, e não tinha como saber por que a migração não rodou.
b.ok(/pr[ée]via|preparar/i.test(g.Logger.getLog() || ""),
  "quem executa entende por que nada aconteceu");

b.passo("48c. A prévia libera, e ela mesma não escreve nada");
const antesPrev = JSON.stringify(lerAba());
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;   // no editor não há token
g.Logger.clear();
const prep = g.escolaSanearPreparar();
const logPrev = g.Logger.getLog() || "";
b.ok(prep.ok === true && prep.preparado === true &&
     antesPrev === JSON.stringify(lerAba()),
  "preparar mostra o mapa e não toca na planilha",
  "válido por " + prep.validoPorMinutos + " min");

b.passo("48c2. ⚠ E o que ela IMPRIME é o plano do saneamento");
// Não basta a simulação bater com a aplicação: é preciso que a PRÉVIA use a
// simulação. Enquanto isto não era cobrado, trocar preparar de volta por
// escolaCompararDeslocados passava incólume — e era exatamente o defeito que
// mandava o usuário aprovar "→ Telefone 1" e acontecer "→ TELEFONE_RECEITA".
b.ok(/PRÉVIA DO SANEAMENTO/.test(logPrev) && /TELEFONE_RECEITA/.test(logPrev),
  "o log da prévia fala das colunas que o saneamento realmente usa",
  /PRÉVIA DO SANEAMENTO/.test(logPrev) ? "plano correto" : "está descrevendo outra operação");

b.passo("48d. ⚠ A prévia PREVÊ exatamente o que a aplicação faz");
// A primeira versão da prévia chamava escolaCompararDeslocados, que responde
// outra pergunta: dizia "ULTIMA_VERIFICACAO → Telefone 1" enquanto o
// saneamento move para TELEFONE_RECEITA. O usuário aprovaria uma coisa e
// aconteceria outra — e consentimento sobre relatório errado não é
// consentimento. Aqui se cobra que os dois números batam.
const simulado = g.escolaSanearReceita("", "", true);
const aplicado = g.escolaSanearAplicar();
b.ok(simulado.movidos === aplicado.movidos &&
     simulado.situacoesRestauradas === aplicado.situacoesRestauradas &&
     JSON.stringify(simulado.porRegra) === JSON.stringify(aplicado.porRegra),
  "prévia e aplicação dão o MESMO resultado, regra por regra",
  "prévia=" + simulado.movidos + " aplicado=" + aplicado.movidos);

b.passo("48e. E a prévia não cria aba de backup");
b.ok(simulado.simulacao === true && !simulado.backup && !!aplicado.backup,
  "backup só existe quando escreve de verdade",
  "prévia=" + (simulado.backup || "nenhum") + " · aplicação=" + aplicado.backup);

// Recompõe o cenário sujo para os passos seguintes.
montarBaseSuja();
g.escolaSanearPreparar();

b.passo("49. Depois da prévia, move cada valor para a coluna do tipo dele");
const san = g.escolaSanearAplicar();
const t1 = lerAba().linha(1);
b.ok(san.ok === true &&
     String(t1["TELEFONE_RECEITA"]).indexOf("(31) 3515-7500") > -1 &&
     String(t1["TELEFONE_RECEITA"]).indexOf("(27) 2127-1111") > -1 &&
     String(t1["EMAILS_RECEITA"]) === "contato@x.com.br" &&
     String(t1["SITUACAO_RECEITA"]) === "ATIVA",
  "telefones, e-mails e situação da Receita em colunas próprias",
  "TEL_REC=" + t1["TELEFONE_RECEITA"] + " · SIT_REC=" + t1["SITUACAO_RECEITA"]);

b.passo("50. ⚠ Os DOIS telefones sobrevivem — nenhum sobrescreve o outro");
// Escola tem mais de um telefone. Se o segundo movido sobrescrevesse o
// primeiro, a migração perderia dado calada.
b.ok(String(t1["TELEFONE_RECEITA"]).indexOf("|") > -1,
  "valores múltiplos ficam lado a lado", String(t1["TELEFONE_RECEITA"]));

b.passo("51. ⚠ A situação operacional é restaurada na coluna certa");
// Era o defeito visível na tela: SITUACAO_CADASTRAL tinha data, e o card do
// ofício mostrava "02/04/2026" onde devia dizer ATIVA.
b.ok(String(t1["SITUACAO_CADASTRAL"]) === "ATIVA" && san.situacoesRestauradas === 1,
  "SITUACAO_CADASTRAL volta a conter situação",
  "situação=" + t1["SITUACAO_CADASTRAL"]);

b.passo("52. E a data da consulta não se perde");
b.ok(t1["DATA_CONSULTA_RECEITA"] instanceof Date,
  "vai para DATA_CONSULTA_RECEITA, preservada como data",
  String(t1["DATA_CONSULTA_RECEITA"]));

b.passo("53. ⚠ A linha SADIA não é tocada");
// Toda migração em massa tem que provar que não mexe em quem está certo.
const t2 = lerAba().linha(2);
b.ok(String(t2["RAZAO_SOCIAL"]) === "RAZAO LTDA" &&
     String(t2["NOME_FANTASIA"]) === "Fantasia X" &&
     String(t2["CNAE_PRINCIPAL"]) === "8511200" &&
     String(t2["SITUACAO_CADASTRAL"]) === "ATIVA" &&
     t2["ULTIMA_VERIFICACAO"] instanceof Date,
  "razão social, fantasia, CNAE, situação e data continuam onde estavam",
  "fantasia=" + t2["NOME_FANTASIA"] + " cnae=" + t2["CNAE_PRINCIPAL"]);

b.passo("54. ⚠ NOME_FANTASIA continua servindo ao cadastro");
// A tentação era renomear a coluna. Ela é COL_FANTASIA — renomear faria o
// campo fantasia da tela cair no vazio, em silêncio.
const salvouFant = g.cadastrarEscola({
  nomeEscola: "Escola Suja", cnpj: "11.222.333/0001-81", fantasia: "Apelido Novo"
}, ADM);
b.ok(salvouFant.ok === true && String(lerAba().linha(1)["NOME_FANTASIA"]) === "Apelido Novo",
  "o cadastro ainda escreve fantasia na coluna certa",
  String(lerAba().linha(1)["NOME_FANTASIA"]));

b.passo("54b. ⚠ O consentimento é de USO ÚNICO");
// Preparar uma vez e aplicar duas seria uma trava de mentira: a segunda
// aplicação rodaria sem ninguém ter olhado nada.
const segundaSemPreparar = g.escolaSanearAplicar();
b.ok(segundaSemPreparar.ok === false,
  "aplicar consome a liberação — a próxima exige prévia de novo",
  (segundaSemPreparar.mensagem || "").split("\n")[0]);

b.passo("54c. ⚠ E a liberação EXPIRA");
// Sem prazo, uma prévia rodada de manhã autorizaria uma aplicação à noite —
// sobre uma base que mudou no meio. A liberação vale 15 minutos.
montarBaseSuja();
g.escolaSanearPreparar();
g.PropertiesService.getScriptProperties().setProperty(
  g.ESC_PROP_CONSENTIMENTO, String(new Date().getTime() - 20 * 60 * 1000));  // 20 min atrás
const expirado = g.escolaSanearAplicar();
b.ok(expirado.ok === false && /pr[ée]via|preparar/i.test(expirado.mensagem || ""),
  "prévia de 20 minutos atrás não autoriza mais",
  (expirado.mensagem || "").split("\n")[0]);

b.passo("55. ⚠ Rodar de novo não muda mais nada");
montarBaseSuja();
g.escolaSanearPreparar();
g.escolaSanearAplicar();
const depois1 = JSON.stringify(lerAba());
g.escolaSanearPreparar();
const san2 = g.escolaSanearAplicar();
b.ok(san2.movidos === 0 && depois1 === JSON.stringify(lerAba()),
  "idempotente: a segunda passada move zero",
  "movidos na 2ª = " + san2.movidos);

b.passo("56. E fez backup antes de escrever");
b.ok(!!san.backup && !!ss.getSheetByName(san.backup),
  "dá para desfazer", san.backup);

b.passo("57. E entra na trilha de auditoria");
const trSan = g.auditoriaConsultar({ acao: "SANEAR_BASE" }, ADM).acoes;
b.ok(trSan.length >= 1 && /Saneamento/i.test(trSan[0].justificativa || ""),
  "quem saneou, quando, e quanto mexeu",
  trSan.length ? trSan[0].justificativa.slice(0, 60) : "nada");

b.passo("58. E exige permissão");
// Sem identidade nenhuma — nem token, nem conta Google. É o cenário do
// visitante anônimo chamando google.script.run.
g.__usuarioAtivoEmail = "";
b.bloqueia(function () { return g.escolaSanearReceita("", "SANEAR"); },  "sanear exige sessão");
b.bloqueia(function () { return g.escolaSanearReceita(FIN, "SANEAR"); }, "financeiro não saneia");
b.bloqueia(function () { return g.escolaSanearReceita(ESC, "SANEAR"); }, "não-admin não saneia");

b.resumo();
