// ================================
// ARQUIVO: RHSeedColaboradores.gs
// MÓDULO: RH — Seed único dos colaboradores reais do modelo de holerite
//
// Origem dos dados: modelo de holerite real do sindicato ("Folha de
// Pagamento SINDEDUCAÇÃO 13.2025 1ª parcela") enviado pelo usuário —
// matrícula/cargo/CBO/centro de custo/filial/admissão/salário-base de
// cada um dos 7 colaboradores extraídos diretamente do documento.
// CPF não é gravado: o modelo só trazia um valor-placeholder
// (999.999.999,00), não um CPF real, e o cadastro do SISGEP não tem
// coluna de CPF para colaborador de RH.
//
// EXECUÇÃO — o editor de código deste projeto tem se mostrado
// inconfiável na prática (dropdown "Executar função" trava/esvazia em
// projetos grandes), e uma primeira tentativa de contornar isso com
// onOpen()/menu na planilha partiu de uma suposição errada: este
// script é standalone, não está vinculado à planilha de produção que o
// usuário abre no Sheets, então onOpen() nunca dispararia ali mesmo.
//
// Por isso o seed é exposto pela própria interface web do SISGEP (que
// já está comprovadamente funcionando para o usuário): botão "Importar
// os 7 do modelo" na aba Colaboradores do RHAdmin.html, chamando
// seedColaboradoresRH_ModeloFolha2025_publico(tokenSessao) por
// google.script.run — mesmo transporte que todo o resto do módulo já
// usa, sem depender de editor, menu ou trigger nenhum.
//
// A função-núcleo original continua existindo (idempotente por
// matrícula) e pode ser chamada de qualquer contexto interno futuro.
// ================================

// Público — exige administrador (mesmo critério de excluirColaboradorRH:
// grava dado sensível de RH em lote). Chamado pelo botão "Importar os 7
// do modelo" em RHAdmin.html.
function seedColaboradoresRH_ModeloFolha2025_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    return seedColaboradoresRH_ModeloFolha2025_();
  } catch (e) {
    return { ok: false, mensagem: "Erro ao importar colaboradores: " + e.message };
  }
}

function seedColaboradoresRH_ModeloFolha2025_() {
  var sh = rh_garantirColaboradores_();
  var mapa = rh_mapaCabecalho_(sh);

  var existentes = listarColaboradoresRH_interno_();
  var porMatricula = {};
  existentes.forEach(function (c) { if (c.matricula) porMatricula[String(c.matricula)] = true; });

  var funcionarios = [
    { matricula: "37", nome: "AGATHA SILVA DA VITORIA", cargo: "AUXILIAR ADMINISTRATIVO I", cbo: "411005", centroCusto: "4", filial: "1", admissao: "2025-09-17", salario: 911.83 },
    { matricula: "36", nome: "ALEXANDRE GONCALVES DA SILVA", cargo: "AUXILIAR ADMINISTRATIVO", cbo: "411005", centroCusto: "1", filial: "1", admissao: "2025-05-16", salario: 2060.46 },
    { matricula: "6", nome: "CELISMAR GOMES FERREIRA", cargo: "AUXILIAR DE SERVICOS GERAIS", cbo: "514320", centroCusto: "2", filial: "1", admissao: "2019-07-03", salario: 1645.90 },
    { matricula: "3", nome: "FABIANA NUNES TONONI", cargo: "AGENTE HOMOLOGADOR", cbo: "411010", centroCusto: "3", filial: "1", admissao: "2011-02-02", salario: 2274.05 },
    { matricula: "35", nome: "FRANK BARBOSA MARTINS", cargo: "AUXILIAR ADMINISTRATIVO", cbo: "411005", centroCusto: "1", filial: "1", admissao: "2025-05-16", salario: 2060.46 },
    { matricula: "2", nome: "KARLA GABRIELA SIPOLATI BEZERRA", cargo: "ADVOGADO(A)", cbo: "241005", centroCusto: "4", filial: "1", admissao: "2008-12-01", salario: 3435.80 },
    { matricula: "8", nome: "MARCELHA ALINE PINTO GOMES", cargo: "GERENTE ADMINISTRATIVO", cbo: "142105", centroCusto: "1", filial: "1", admissao: "2019-01-23", salario: 2804.26 }
  ];

  var quem = "SISGEP (seed inicial)";
  var agora = new Date();
  var inseridos = [], ignorados = [];

  funcionarios.forEach(function (f) {
    if (porMatricula[f.matricula]) { ignorados.push(f.nome + " (matrícula " + f.matricula + " já cadastrada)"); return; }

    var campos = {
      NOME: f.nome, CARGO: f.cargo, SETOR: "Administrativo", STATUS: "Ativo",
      VENCIMENTO: "", SALARIO: f.salario, BENEFICIOS: 0, DESCONTOS: 0, DEPENDENTES: 0,
      ANIVERSARIO: "", EMAIL: "",
      MATRICULA: f.matricula, CBO: f.cbo, CENTRO_CUSTO: f.centroCusto, FILIAL: f.filial, ADMISSAO: f.admissao
    };

    var novoId = rh_gerarId_("COL");
    var novaLinha = sh.getLastRow() + 1;
    sh.getRange(novaLinha, mapa["ID"] || 1).setValue(novoId);
    Object.keys(campos).forEach(function (chave) {
      if (mapa[chave]) sh.getRange(novaLinha, mapa[chave]).setValue(campos[chave]);
    });
    if (mapa["CRIADO_POR"]) sh.getRange(novaLinha, mapa["CRIADO_POR"]).setValue(quem);
    if (mapa["CRIADO_EM"]) sh.getRange(novaLinha, mapa["CRIADO_EM"]).setValue(agora);
    if (mapa["ATUALIZADO_POR"]) sh.getRange(novaLinha, mapa["ATUALIZADO_POR"]).setValue(quem);
    if (mapa["ATUALIZADO_EM"]) sh.getRange(novaLinha, mapa["ATUALIZADO_EM"]).setValue(agora);
    inseridos.push(f.nome + " (" + novoId + ")");
  });

  Logger.log("[RH] Seed colaboradores do modelo — inseridos: " + (inseridos.join(", ") || "nenhum") + " | ignorados: " + (ignorados.join(", ") || "nenhum"));
  return { ok: true, inseridos: inseridos, ignorados: ignorados };
}

// ================================
// Atualização por MATRÍCULA — salário e CPF dos 7 colaboradores reais,
// a partir dos documentos "Extrato Mensal" (competência 06/2026) da
// contabilidade (IMPACTO CONSULTORIA), enviados pelo usuário. Diferente
// do seed acima, esta função NUNCA insere linha nova: só localiza a
// matrícula já existente e atualiza SALARIO/CPF. Se uma matrícula não
// for encontrada, é reportada em "naoEncontrados" e nada é gravado
// para ela — nunca cria colaborador novo por aqui.
// ================================

// Público — exige administrador (grava dado sensível de RH em lote).
function atualizarColaboradoresRH_ExtratoJunho2026_publico(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    return atualizarColaboradoresRH_ExtratoJunho2026_();
  } catch (e) {
    return { ok: false, mensagem: "Erro ao atualizar colaboradores: " + e.message };
  }
}

function atualizarColaboradoresRH_ExtratoJunho2026_() {
  var sh = rh_garantirColaboradores_();
  var mapa = rh_mapaCabecalho_(sh);

  var dados = [
    { matricula: "37", salario: 962.89, cpf: "191.355.007-94" },
    { matricula: "36", salario: 2175.85, cpf: "017.402.447-96" },
    { matricula: "6", salario: 1760.50, cpf: "925.578.486-20" },
    { matricula: "3", salario: 2401.40, cpf: "073.080.527-10" },
    { matricula: "35", salario: 2175.85, cpf: "089.384.197-89" },
    { matricula: "2", salario: 3628.20, cpf: "102.849.547-13" },
    { matricula: "8", salario: 2961.30, cpf: "080.297.397-37" }
  ];

  var colMatricula = mapa["MATRICULA"];
  if (!colMatricula) return { ok: false, mensagem: "Coluna MATRICULA não encontrada na planilha de Colaboradores." };

  var ultimaLinha = sh.getLastRow();
  var porMatricula = {};
  if (ultimaLinha > 1) {
    var valores = sh.getRange(2, colMatricula, ultimaLinha - 1, 1).getValues();
    valores.forEach(function (linha, i) {
      var m = String(linha[0] || "").trim();
      if (m) porMatricula[m] = i + 2;
    });
  }

  var quem = "SISGEP (atualização Extrato 06/2026)";
  var agora = new Date();
  var atualizados = [], naoEncontrados = [];

  dados.forEach(function (d) {
    var linha = porMatricula[d.matricula];
    if (!linha) { naoEncontrados.push("Matrícula " + d.matricula); return; }

    if (mapa["SALARIO"]) sh.getRange(linha, mapa["SALARIO"]).setValue(d.salario);
    if (mapa["CPF"]) sh.getRange(linha, mapa["CPF"]).setValue(d.cpf);
    if (mapa["ATUALIZADO_POR"]) sh.getRange(linha, mapa["ATUALIZADO_POR"]).setValue(quem);
    if (mapa["ATUALIZADO_EM"]) sh.getRange(linha, mapa["ATUALIZADO_EM"]).setValue(agora);
    atualizados.push("Matrícula " + d.matricula + " (salário R$ " + d.salario.toFixed(2) + ", CPF " + d.cpf + ")");
  });

  Logger.log("[RH] Atualização Extrato 06/2026 — atualizados: " + (atualizados.join(", ") || "nenhum") + " | não encontrados: " + (naoEncontrados.join(", ") || "nenhum"));
  return { ok: true, atualizados: atualizados, naoEncontrados: naoEncontrados };
}
