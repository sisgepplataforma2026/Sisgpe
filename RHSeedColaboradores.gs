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
// EXECUÇÃO — função de uso único, sem sessão (mesmo padrão de
// instalarTriggerAniversariosRH em RHAniversarios.gs): rode
// seedColaboradoresRH_ModeloFolha2025_() uma vez pelo editor do Apps
// Script. É seguro rodar mais de uma vez — cada colaborador só é
// inserido se a matrícula ainda não existir no cadastro.
//
// ATALHO — a lista de funções do editor às vezes trava/some em
// projetos grandes. Por isso este arquivo também instala um item de
// menu (onOpen), pra rodar o seed direto pela interface da planilha
// sem depender do dropdown "Executar função" do editor de código:
// abra a planilha do SISGEP, recarregue a página (F5) e procure o
// menu "🧪 RH — Ferramentas" na barra superior.
//
// Não existia nenhum onOpen() no projeto até este arquivo — se algum
// outro módulo criar um onOpen() próprio no futuro, uma das duas
// definições vai vencer silenciosamente (Apps Script só executa uma);
// nesse caso, mover este addItem para dentro do onOpen() único do
// projeto em vez de manter dois.
// ================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧪 RH — Ferramentas')
    .addItem('Rodar seed de colaboradores (modelo holerite)', 'seedColaboradoresRH_ModeloFolha2025_menu_')
    .addToUi();
}

// Wrapper para uso via menu: chamado por clique na planilha (não pelo
// editor), então mostra o resultado num alerta em vez de só retornar
// um objeto — quem clicou o menu não vê o valor de retorno de outra
// forma.
function seedColaboradoresRH_ModeloFolha2025_menu_() {
  var r = seedColaboradoresRH_ModeloFolha2025_();
  var ui = SpreadsheetApp.getUi();
  var msg = "Inseridos:\n" + (r.inseridos.length ? r.inseridos.join("\n") : "nenhum (todos já cadastrados)") +
    "\n\nIgnorados (matrícula já existia):\n" + (r.ignorados.length ? r.ignorados.join("\n") : "nenhum");
  ui.alert("Seed de colaboradores do RH", msg, ui.ButtonSet.OK);
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
