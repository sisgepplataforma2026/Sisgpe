/**
 * TESTE — ESCOLAS (Base de Escolas, Cadastrar/Editar, Captação Receita)
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * Escolas é um dos dois lugares do SISGEP com dado real: 681 cadastros. E era
 * o único módulo com dado real e ZERO teste próprio — as 19 funções que a tela
 * CadastroEscolas.html chama nunca tinham sido executadas fora do navegador.
 *
 * O foco não é "a função responde". É o que acontece com a linha da planilha
 * depois que ela responde. Três operações desta tela apagam dado:
 * excluir em lote, remover duplicadas e — sem avisar — recadastrar.
 *
 * Ordem: teste primeiro, diagnóstico depois (REGRA Nº -1).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");   // administrador
const ESC = b.logar(g, "joscimar");    // tem "escolas", não é admin
const FIN = b.logar(g, "rogerio");     // financeiro/rh — NÃO tem escolas

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* CNPJs com dígito verificador válido — o cadastro recusa inválido. */
const CNPJ_A = "11222333000181";
const CNPJ_B = "22333444000181";
const CNPJ_C = "33444555000181";
const CNPJ_D = "44555666000181";

/* ─── monta a aba Escolas com o cabeçalho REAL que Escolas.gs procura ─── */
const CABECALHO = [
  "Unidade", "Escola (Razão Social)", "CNPJ", "E-mail (principal)", "E-mails (todos)",
  "Telefone 1", "Telefone 2", "Cidade", "Endereço", "Número", "Bairro", "Complemento",
  "UF", "CEP", "NOME_FANTASIA", "SITUACAO_CADASTRAL", "Rede", "Responsavel",
  "CargoResponsavel", "Observacoes", "DataCadastro", "UsuarioCadastro"
];
function zerarBase() {
  let sh = ss.getSheetByName("Escolas");
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet("Escolas");
  sh.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]);
  try { g.CacheService.getScriptCache().remove("sisgep_escolas_lista_v2"); } catch (e) {}
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (e) {}
  return sh;
}
function col(nome) { return CABECALHO.indexOf(nome) + 1; }
function lerLinhas() {
  const sh = ss.getSheetByName("Escolas");
  const n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, CABECALHO.length).getValues();
}
function acharPorNome(nome) {
  return lerLinhas().filter(r => String(r[col("Escola (Razão Social)") - 1]).trim() === nome);
}
/* As duas operações destrutivas criam a aba de backup com nome carimbado em
 * segundos. Duas chamadas dentro do mesmo segundo colidem — o que é um achado
 * por si só (passo 20b), mas atrapalharia todos os outros passos se ficasse no
 * caminho. Aqui a colisão sai da frente; lá ela é medida de propósito. */
function limparBackups() {
  ss.getSheets().forEach(sh => {
    if (String(sh.getName()).indexOf("BACKUP_ESCOLAS") === 0) ss.deleteSheet(sh);
  });
}

zerarBase(); limparBackups();

/* ══════════════════════════════════════════════════════════════════════
   1. CADASTRAR — a aba "Cadastrar / Editar"
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Cadastrar uma escola");

b.passo("1. Cadastro básico grava a linha");
const c1 = g.cadastrarEscola({
  nomeEscola: "Escola Municipal Alfa", cnpj: CNPJ_A, municipio: "Vitória", uf: "es",
  email: "alfa@escola.com", telefone: "27999990001", responsavel: "Maria",
  cargoResponsavel: "Diretora", situacao: "ativa"
}, ADM);
b.ok(c1.ok === true && c1.atualizado === false, "cadastrou como registro novo",
  c1.mensagem);

b.passo("2. E gravou nos campos certos, com CNPJ formatado e UF em maiúscula");
const linhaA = acharPorNome("Escola Municipal Alfa")[0] || [];
b.ok(linhaA[col("CNPJ") - 1] === "11.222.333/0001-81" &&
     linhaA[col("UF") - 1] === "ES" &&
     linhaA[col("SITUACAO_CADASTRAL") - 1] === "ATIVA" &&
     linhaA[col("E-mail (principal)") - 1] === "alfa@escola.com",
  "CNPJ formatado, UF e situação normalizadas",
  linhaA[col("CNPJ") - 1] + " · " + linhaA[col("UF") - 1] + " · " + linhaA[col("SITUACAO_CADASTRAL") - 1]);

b.passo("3. E carimbou data e autor do cadastro");
b.ok(String(linhaA[col("DataCadastro") - 1] || "").trim() !== "",
  "DataCadastro preenchida", String(linhaA[col("DataCadastro") - 1]));
b.ok(String(linhaA[col("UsuarioCadastro") - 1] || "").trim() !== "",
  "UsuarioCadastro preenchida", String(linhaA[col("UsuarioCadastro") - 1]));

b.passo("4. CNPJ com dígito verificador errado é recusado");
const cInv = g.cadastrarEscola({ nomeEscola: "Escola Falsa", cnpj: "11111111111111" }, ADM);
b.ok(cInv.ok === false && /d[íi]gito|inv[áa]lid/i.test(cInv.mensagem || ""),
  "não grava CNPJ inventado", cInv.mensagem);

b.passo("5. Escola sem nome é recusada");
const cSemNome = g.cadastrarEscola({ cnpj: CNPJ_B, municipio: "Serra" }, ADM);
b.ok(cSemNome.ok === false, "nome é obrigatório", cSemNome.mensagem);

b.passo("6. Nada disso sujou a base");
b.ok(lerLinhas().length === 1, "só a escola válida entrou", lerLinhas().length + " linha(s)");

/* ══════════════════════════════════════════════════════════════════════
   2. RECADASTRAR — o mesmo formulário, o mesmo CNPJ
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Recadastrar o mesmo CNPJ");

b.passo("7. Mesmo CNPJ não cria linha nova — atualiza a existente");
const c2 = g.cadastrarEscola({
  nomeEscola: "Escola Municipal Alfa (novo nome)", cnpj: CNPJ_A,
  municipio: "Vitória", uf: "ES", email: "alfa@escola.com",
  telefone: "27999990001", responsavel: "Maria", cargoResponsavel: "Diretora",
  situacao: "ATIVA"
}, ADM);
b.ok(c2.ok === true && c2.atualizado === true && lerLinhas().length === 1,
  "o CNPJ é a chave — não duplica",
  c2.mensagem + " · " + lerLinhas().length + " linha(s)");

b.passo("8. ⚠ O QUE MAIS IMPORTA AQUI: campo não enviado é APAGADO");
// O formulário reenvia a linha inteira. Todo campo que o usuário não digitou
// vai como "" e SOBRESCREVE o que estava gravado. Quem abre o cadastro para
// corrigir só o telefone perde endereço, CEP e observações sem ser avisado.
zerarBase(); limparBackups();
g.cadastrarEscola({
  nomeEscola: "Escola Beta", cnpj: CNPJ_B, municipio: "Serra", uf: "ES",
  endereco: "Rua das Flores", numero: "100", bairro: "Centro", cep: "29100-000",
  observacoes: "Escola conveniada desde 2019", email: "beta@escola.com"
}, ADM);
const betaAntes = acharPorNome("Escola Beta")[0];
// agora o usuário reabre e salva mexendo só no telefone
g.cadastrarEscola({
  nomeEscola: "Escola Beta", cnpj: CNPJ_B, telefone: "27999998888"
}, ADM);
const betaDepois = acharPorNome("Escola Beta")[0];
const perdidos = ["Endereço", "Número", "Bairro", "CEP", "Observacoes", "Cidade", "E-mail (principal)"]
  .filter(c => String(betaAntes[col(c) - 1] || "").trim() !== "" &&
               String(betaDepois[col(c) - 1] || "").trim() === "");
b.ok(perdidos.length === 0,
  "salvar de novo NÃO pode apagar campo que já estava gravado",
  perdidos.length ? "APAGOU: " + perdidos.join(", ") : "nada se perdeu");

b.passo("9. E a atualização não registra quem alterou");
b.ok(String(betaDepois[col("UsuarioCadastro") - 1] || "").trim() !== "" &&
     String(betaDepois[col("DataCadastro") - 1] || "").trim() !== "",
  "dá para saber quem mexeu por último",
  "usuário=" + betaDepois[col("UsuarioCadastro") - 1] + " · data=" + betaDepois[col("DataCadastro") - 1]);

/* ══════════════════════════════════════════════════════════════════════
   3. LISTAR — a aba "Base de Escolas"
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · A lista que a tela desenha");

zerarBase(); limparBackups();
g.cadastrarEscola({ nomeEscola: "Escola Alfa", cnpj: CNPJ_A, municipio: "Vitória", uf: "ES", email: "a@e.com" }, ADM);
g.cadastrarEscola({ nomeEscola: "Escola Beta", cnpj: CNPJ_B, municipio: "Serra",   uf: "ES", email: "b@e.com" }, ADM);

b.passo("10. listarEscolasParaModulo devolve o que foi cadastrado");
const lista = g.listarEscolasParaModulo(ADM);
b.ok(Array.isArray(lista) && lista.length === 2,
  "as duas escolas aparecem", (lista || []).length + " item(ns)");

b.passo("11. Com os campos que a tabela da tela usa");
const alfa = (lista || []).filter(x => x.NomeEscola === "Escola Alfa")[0] || {};
b.ok(alfa.CNPJ === "11.222.333/0001-81" && alfa.Municipio === "Vitória" &&
     alfa.UF === "ES" && alfa.Situacao === "ATIVA" && alfa.Email === "a@e.com",
  "nome, CNPJ, município, UF, situação e e-mail chegam preenchidos",
  JSON.stringify({ c: alfa.CNPJ, m: alfa.Municipio, s: alfa.Situacao }));

b.passo("12. Cadastrar de novo invalida o cache — a lista não fica velha");
g.cadastrarEscola({ nomeEscola: "Escola Gama", cnpj: CNPJ_C, municipio: "Vila Velha", uf: "ES" }, ADM);
const lista2 = g.listarEscolasParaModulo(ADM);
b.ok(lista2.length === 3, "a escola nova aparece sem esperar o cache expirar",
  lista2.length + " item(ns)");

/* ══════════════════════════════════════════════════════════════════════
   4. AÇÕES EM MASSA — situação
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Mudar situação em lote");

b.passo("13. Marcar duas como INATIVA");
const sit = g.atualizarSituacaoEscolasEmLote([CNPJ_A, CNPJ_B], "INATIVA", ADM);
b.ok(sit.ok === true && sit.atualizadas === 2, "as duas mudaram", sit.mensagem);

b.passo("14. E a terceira ficou intacta");
const gama = g.listarEscolasParaModulo(ADM).filter(x => x.NomeEscola === "Escola Gama")[0];
b.ok(gama && gama.Situacao === "ATIVA", "quem não foi selecionada não muda", gama && gama.Situacao);

b.passo("15. Situação fora do catálogo é recusada");
const sitRuim = g.atualizarSituacaoEscolasEmLote([CNPJ_A], "ARQUIVADA", ADM);
b.ok(sitRuim.ok === false, "só ATIVA / INATIVA / PENDENTE", sitRuim.mensagem);

b.passo("16. Lista vazia é recusada");
b.ok(g.atualizarSituacaoEscolasEmLote([], "ATIVA", ADM).ok === false,
  "não roda em lote sem seleção");

/* ══════════════════════════════════════════════════════════════════════
   5. EXCLUSÃO EM LOTE — a operação que não tem volta
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Excluir em lote");

b.passo("17. Excluir uma escola tira a linha");
const antesExcl = lerLinhas().length;
const excl = g.excluirEscolasEmLote([CNPJ_C], ADM);
b.ok(excl.ok === true && excl.excluidas === 1 && lerLinhas().length === antesExcl - 1,
  "saiu uma linha", excl.mensagem);

b.passo("18. E gerou backup antes de excluir");
const shBackup = excl.backup ? ss.getSheetByName(excl.backup) : null;
b.ok(!!shBackup && shBackup.getLastRow() === antesExcl + 1,
  "a aba de backup tem a base inteira de antes",
  excl.backup + " · " + (shBackup ? shBackup.getLastRow() : 0) + " linha(s)");

b.passo("19. ⚠ Escola SEM CNPJ não pode ser excluída pela tela");
// A tela seleciona por CNPJ e o backend casa por CNPJ. Cadastro sem CNPJ é
// permitido (passo 5 só exige o nome) — então o sistema cria registro que
// depois não consegue apagar nem mudar de situação em lote.
zerarBase(); limparBackups();
g.cadastrarEscola({ nomeEscola: "Escola Sem Documento", municipio: "Cariacica", uf: "ES" }, ADM);
const semCnpj = g.excluirEscolasEmLote([""], ADM);
const aindaLa = acharPorNome("Escola Sem Documento").length;
// Por CNPJ isto é impossível por definição — não há CNPJ para apontar. O que
// se cobra aqui é que a recusa seja HONESTA: nada apagado e mensagem clara,
// em vez de "0 excluídas" fingindo sucesso.
// O caminho que funciona é por escolaId, provado em t26 (passos 21 e 22).
b.ok(semCnpj.ok === false && aindaLa === 1,
  "seleção sem CNPJ é recusada sem apagar nada",
  semCnpj.mensagem);
b.ok(g.atualizarSituacaoEscolasEmLote([""], "INATIVA", ADM).ok === false,
  "e o lote de situação recusa igual",
  "a escola sem CNPJ se resolve por escolaId — ver t26");

b.passo("20. ⚠ Selecionar UMA linha não pode apagar as OUTRAS do mesmo CNPJ");
// Matriz e filial compartilham raiz de CNPJ; e a própria base tem duplicatas
// (existe uma tela só para achá-las). Se a exclusão casa por CNPJ e apaga
// TODAS as linhas que batem, marcar uma duplicata para excluir leva a outra
// junto — inclusive a que estava correta.
const shDup = zerarBase();
limparBackups();
shDup.appendRow(["", "Escola Dupla — cadastro velho", "11.222.333/0001-81", "velho@e.com", "", "", "", "Vitória", "", "", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
shDup.appendRow(["", "Escola Dupla — cadastro novo",  "11.222.333/0001-81", "novo@e.com",  "", "", "", "Vitória", "", "", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
const exclDup = g.excluirEscolasEmLote([CNPJ_A], ADM);
b.ok(exclDup.excluidas !== 2 && lerLinhas().length === 2,
  "marcar um CNPJ ambíguo NÃO apaga as duas linhas",
  "excluidas=" + exclDup.excluidas + " · restaram " + lerLinhas().length + " de 2");

b.passo("20a. E o usuário fica sabendo POR QUE nada foi excluído");
b.ok(exclDup.ok === false && Array.isArray(exclDup.ambiguos) && exclDup.ambiguos.length === 1 &&
     exclDup.ambiguos[0].quantidade === 2 && /[Dd]uplicad/.test(exclDup.mensagem || ""),
  "a recusa diz qual CNPJ, quantas linhas e para onde ir",
  exclDup.mensagem);

b.passo("20b. ⚠ Duas exclusões no mesmo segundo: a segunda falha");
// O nome da aba de backup é carimbado só até o segundo. Duas operações
// seguidas colidem, e a segunda morre com a exceção crua do Sheets na tela.
zerarBase(); limparBackups();
const shSeg = ss.getSheetByName("Escolas");
shSeg.appendRow(["", "Escola Um",  "11.222.333/0001-81", "", "", "", "", "Vitória", "", "", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
shSeg.appendRow(["", "Escola Dois", "22.333.444/0001-81", "", "", "", "", "Serra",   "", "", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
g.excluirEscolasEmLote([CNPJ_A], ADM);
const segunda = g.excluirEscolasEmLote([CNPJ_B], ADM);
b.ok(segunda.ok === true,
  "dá para excluir duas vezes seguidas",
  segunda.ok ? "ok" : segunda.mensagem);

/* ══════════════════════════════════════════════════════════════════════
   6. DUPLICADAS
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Analisar e remover duplicadas");

zerarBase(); limparBackups();
const shD = ss.getSheetByName("Escolas");
shD.appendRow(["", "Escola Delta", "44.555.666/0001-81", "delta@e.com", "", "", "", "Serra", "Rua A", "10", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
shD.appendRow(["", "Escola Delta", "44.555.666/0001-81", "",            "", "", "", "Serra", "",      "",   "Centro", "", "ES", "29160-000", "", "ATIVA", "", "João", "", "", "", ""]);
shD.appendRow(["", "Escola Épsilon", "", "eps@e.com", "", "", "", "Linhares", "", "", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
shD.appendRow(["", "Escola Épsilon", "", "",          "", "", "", "Linhares", "", "", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);

b.passo("21. A análise acha os dois grupos — por CNPJ e por nome+município+UF");
const an = g.analisarEscolasDuplicadas(ADM);
b.ok(an.ok === true && an.grupos === 2 && an.duplicadas === 2,
  "2 grupos, 2 linhas sobrando", "grupos=" + an.grupos + " duplicadas=" + an.duplicadas);

b.passo("22. E indica qual linha manter (a mais completa)");
const grupoCnpj = (an.detalhes || []).filter(d => d.chave.indexOf("CNPJ::") === 0)[0];
b.ok(!!grupoCnpj && grupoCnpj.quantidade === 2 && !!grupoCnpj.manterLinha,
  "aponta a linha vencedora do grupo",
  grupoCnpj ? "manter linha " + grupoCnpj.manterLinha : "não achou o grupo");

b.passo("23. Remover funde as duas em uma, sem perder campo preenchido");
const rem = g.removerEscolasDuplicadas(ADM);
const delta = acharPorNome("Escola Delta");
const fundida = delta[0] || [];
b.ok(rem.ok === true && delta.length === 1 &&
     String(fundida[col("E-mail (principal)") - 1]) === "delta@e.com" &&
     String(fundida[col("Bairro") - 1]) === "Centro" &&
     String(fundida[col("Responsavel") - 1]) === "João",
  "o e-mail da primeira e o bairro/responsável da segunda sobrevivem juntos",
  "e-mail=" + fundida[col("E-mail (principal)") - 1] + " bairro=" + fundida[col("Bairro") - 1]);

b.passo("24. E fez backup antes de reescrever a aba inteira");
b.ok(!!rem.backup && !!ss.getSheetByName(rem.backup),
  "a base de antes está guardada", rem.backup || "SEM BACKUP");

b.passo("25. ⚠ Linha SEM nome não pode sumir calada");
// removerEscolasDuplicadas reescreve a aba do zero a partir de um mapa
// indexado pelo nome. Linha com nome em branco nunca entra no mapa — e some
// na reescrita, sem entrar na contagem de "removidas".
zerarBase(); limparBackups();
const shN = ss.getSheetByName("Escolas");
shN.appendRow(["", "Escola Zeta", "55.666.777/0001-81", "zeta@e.com", "", "", "", "Aracruz", "", "", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
shN.appendRow(["UNID-99", "", "22.333.444/0001-81", "sem-nome@e.com", "", "27999997777", "", "Colatina", "Rua B", "50", "", "", "ES", "", "", "ATIVA", "", "", "", "", "", ""]);
const antesN = lerLinhas().length;
const remN = g.removerEscolasDuplicadas(ADM);
const depoisN = lerLinhas().length;
b.ok(depoisN === antesN,
  "deduplicar não apaga linha que não é duplicata",
  "antes=" + antesN + " depois=" + depoisN + " · removidas informadas=" + remN.removidas);

/* ══════════════════════════════════════════════════════════════════════
   7. CAPTAÇÃO RECEITA — a terceira aba
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Captação Receita");

b.passo("26. O filtro nasce com o padrão do sistema");
const cfg0 = g.escolasReceitaObterConfig(ADM);
b.ok(cfg0.ok === true && cfg0.uf === "ES" && String(cfg0.cnaeCsv || "").indexOf("85") > -1,
  "UF alvo e CNAEs de educação", cfg0.uf + " · " + String(cfg0.cnaeCsv).slice(0, 40));

b.passo("27. Salvar o filtro persiste");
const cfgSalvo = g.escolasReceitaSalvarConfig("MG", "8513,8520", ADM);
const cfg1 = g.escolasReceitaObterConfig(ADM);
// O backend normaliza o CSV (reinsere espaço depois da vírgula) — comparação
// tem que ser sobre os códigos, não sobre a pontuação.
const cnaes = String(cfg1.cnaeCsv || "").split(",").map(s => s.trim()).filter(Boolean);
b.ok(cfgSalvo.ok === true && cfg1.uf === "MG" &&
     cnaes.length === 2 && cnaes[0] === "8513" && cnaes[1] === "8520",
  "o que foi salvo é o que volta", cfg1.uf + " · " + cfg1.cnaeCsv);
g.escolasReceitaSalvarConfig("ES", "", ADM);   // devolve ao padrão

b.passo("28. Criar as abas do módulo é idempotente");
const abas1 = g.criarAbasModuloReceita(ADM);
const abas2 = g.criarAbasModuloReceita(ADM);
b.ok(abas1.ok === true && abas2.ok === true &&
     !!ss.getSheetByName("EXTRACAO_CNPJ_OFICIAL") && !!ss.getSheetByName("RECEITA_COMPARACAO"),
  "rodar duas vezes não quebra nem duplica aba", abas2.mensagem);

b.passo("29. Comparar com a extração vazia não explode");
const proc = g.processarExtracaoOficialReceita(ADM);
b.ok(proc && typeof proc.ok === "boolean",
  "responde com resultado estruturado, não com exceção",
  JSON.stringify(proc).slice(0, 100));

b.naoTestavel("Consulta à BrasilAPI (CNPJ real)",
  "UrlFetch é só registrado no emulador — a captação de verdade só o ambiente real prova");

/* ══════════════════════════════════════════════════════════════════════
   8. PERMISSÃO — quem pode o quê
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · Permissão");

b.passo("30. Sem token, nada abre");
b.bloqueia(() => g.listarEscolasParaModulo(""),                          "listar exige sessão");
b.bloqueia(() => g.cadastrarEscola({ nomeEscola: "X" }, ""),             "cadastrar exige sessão");
b.bloqueia(() => g.atualizarSituacaoEscolasEmLote([CNPJ_A], "ATIVA", ""), "situação em lote exige sessão");
b.bloqueia(() => g.excluirEscolasEmLote([CNPJ_A], ""),                   "excluir exige sessão");
b.bloqueia(() => g.analisarEscolasDuplicadas(""),                        "analisar duplicadas exige sessão");
b.bloqueia(() => g.removerEscolasDuplicadas(""),                         "remover duplicadas exige sessão");
b.bloqueia(() => g.escolasReceitaSalvarConfig("ES", "85", ""),           "salvar filtro exige sessão");
b.bloqueia(() => g.criarAbasModuloReceita(""),                           "criar abas exige sessão");
b.bloqueia(() => g.executarPipelineReceita(""),                          "pipeline exige sessão");
b.bloqueia(() => g.consultarCnpjEscola(CNPJ_A, ""),                      "consultar CNPJ exige sessão");
b.bloqueia(() => g.sincronizarEscolaPorCnpj(CNPJ_A, false, ""),          "sincronizar exige sessão");
b.bloqueia(() => g.escolasEnviarEmailMassa(["a@e.com"], "a", "b", ""),   "e-mail em massa exige sessão");
b.bloqueia(() => g.importarEscolasDeAba(""),                             "importar exige sessão");

b.passo("31. Quem não tem o módulo Escolas não entra");
b.bloqueia(() => g.listarEscolasParaModulo(FIN),        "financeiro não lista escolas");
b.bloqueia(() => g.cadastrarEscola({ nomeEscola: "X" }, FIN), "financeiro não cadastra escola");
b.bloqueia(() => g.excluirEscolasEmLote([CNPJ_A], FIN), "financeiro não exclui escola");

b.passo("32. Quem tem Escolas mas não é admin: opera, mas não destrói");
zerarBase(); limparBackups();
const cEsc = g.cadastrarEscola({ nomeEscola: "Escola do Joscimar", cnpj: CNPJ_D, municipio: "Serra", uf: "ES" }, ESC);
b.ok(cEsc.ok === true, "o usuário de Escolas cadastra normalmente", cEsc.mensagem);
b.bloqueia(() => g.excluirEscolasEmLote([CNPJ_D], ESC),  "exclusão em lote é só de administrador");
b.bloqueia(() => g.removerEscolasDuplicadas(ESC),        "remover duplicadas é só de administrador");

/* ══════════════════════════════════════════════════════════════════════
   9. AUDITORIA — o que fica registrado
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("ESCOLAS · O que a trilha registra");

b.passo("33. Excluir 681 escolas é ação crítica — tem que estar na trilha");
zerarBase(); limparBackups();
g.cadastrarEscola({ nomeEscola: "Escola Ômega", cnpj: CNPJ_A, municipio: "Vitória", uf: "ES" }, ADM);
const trilhaAntes = g.auditoriaConsultar({}, ADM).acoes.length;
g.excluirEscolasEmLote([CNPJ_A], ADM);
const novas = g.auditoriaConsultar({}, ADM).acoes.slice(0, g.auditoriaConsultar({}, ADM).acoes.length - trilhaAntes);
const temExclusao = novas.some(a => /EXCLUIR/i.test(a.acao || "") &&
                                    /escola/i.test((a.modulo || "") + (a.submodulo || "")));
b.ok(temExclusao,
  "a exclusão em massa de escolas entra na trilha de auditoria",
  temExclusao ? "registrada" : "NÃO registrada — não há como saber depois quem apagou");

b.passo("34. E o cadastro/alteração também");
const t2Antes = g.auditoriaConsultar({}, ADM).acoes.length;
g.cadastrarEscola({ nomeEscola: "Escola Psi", cnpj: CNPJ_B, municipio: "Serra", uf: "ES" }, ADM);
const t2Depois = g.auditoriaConsultar({}, ADM).acoes.length;
b.ok(t2Depois > t2Antes,
  "cadastrar/alterar escola deixa rastro",
  t2Depois > t2Antes ? "registrado" : "nada foi registrado");

b.resumo();
