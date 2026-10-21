const fs = require("fs");
const path = require("path");
const b = require("./base");

const raiz = path.resolve(__dirname, "..", "..");
const html = fs.readFileSync(path.join(raiz, "OficiosFormulario.html"), "utf8");
const scripts = fs.readFileSync(path.join(raiz, "OficiosScripts.html"), "utf8");
const css = fs.readFileSync(path.join(raiz, "OficiosStyles.html"), "utf8");

b.fluxo("DOCUMENTOS · Card compacto e endereço completo da escola");
b.ok(/id="btnToggleEdicaoEscola"[^>]*>✏️\s*<span>Editar<\/span>/.test(html), "ação Editar tem rótulo visível");
b.ok(/id="btnSincronizarCnpjSmart"[^>]*>🔄\s*<span>Atualizar<\/span>/.test(html), "ação Atualizar tem rótulo visível");
b.ok(/id="btnRemoverEscolaSelecionada"/.test(html) && />🗑️\s*<span>Remover<\/span>/.test(html), "ação Remover tem rótulo e escopo seguro");
b.ok(html.includes("Nenhum ofício enviado para esta escola ainda."), "estado vazio do histórico está em português");
b.ok(["escolaStatOficios", "escolaStatConfirmados", "escolaStatUltimo"].every(id => html.includes(`id="${id}"`)), "IDs antigos das estatísticas foram preservados");
b.ok(["logradouroEscola", "numeroEscola", "complementoEscola", "bairroEscola", "cidadeEscola", "ufEscola", "cepEscola"].every(id => html.includes(`id="${id}"`)), "edição contém todos os campos estruturados do endereço");
b.igual((scripts.match(/^\s*function normalizarEscola\s*\(/gm) || []).length, 1, "normalizador duplicado foi consolidado");
const renderRecentes = scripts.slice(scripts.indexOf("function renderRecentes"), scripts.indexOf("function selecionarEscola"));
b.igual((renderRecentes.match(/box\.innerHTML\s*=\s*lista\.map/g) || []).length, 1, "render de escolas recentes não faz atribuição morta");
b.ok(scripts.includes('setText("escolaHistoricoResumo",resumoHistorico)'), "resumo compacto é calculado pelo frontend");
b.ok(css.indexOf("Card compacto da escola selecionada") < css.lastIndexOf("</style>"), "CSS do card está dentro da tag style");
b.igual((html.match(/include\('SofiaDocumentos'\)/g) || []).length, 0, "fragmento de Ofícios não inclui a SOFIA pela segunda vez");

const r = b.subir({});
const g = r.g;
b.seedUsuarios(g);
const token = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let sh = ss.getSheetByName("Escolas");
if (sh) ss.deleteSheet(sh);
sh = ss.insertSheet("Escolas");
const cab = ["EscolaID", "Escola (Razão Social)", "CNPJ", "E-mail (principal)", "Endereço", "Número", "Complemento", "Bairro", "Cidade", "UF", "CEP"];
sh.getRange(1, 1, 1, cab.length).setValues([cab]);

const salvo = g.salvarEscolaOficio({
  id: "ESC-CARD-1", nome: "ESCOLA CARD", cnpj: "11.222.333/0001-81", email: "secretaria@escolacard.com",
  logradouro: "Rua das Flores", numero: "120", complemento: "Sala 2", bairro: "Centro",
  cidade: "Vitória", uf: "es", cep: "29000-000"
}, token);
b.ok(salvo && salvo.ok, "backend aceita o endereço estruturado");
const linha = sh.getRange(2, 1, 1, cab.length).getValues()[0];
const valor = nome => linha[cab.indexOf(nome)];
b.igual(valor("Endereço"), "Rua das Flores", "salva logradouro na coluna existente");
b.igual(valor("Número"), "120", "salva número");
b.igual(valor("Complemento"), "Sala 2", "salva complemento");
b.igual(valor("Bairro"), "Centro", "salva bairro");
b.igual(valor("Cidade"), "Vitória", "salva cidade");
b.igual(valor("UF"), "ES", "normaliza e salva UF");
b.igual(valor("CEP"), "29000-000", "salva CEP");

b.resumo();
