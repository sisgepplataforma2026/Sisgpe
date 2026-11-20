/**
 * OFTALMOLOGIA — SERVIÇO ENCERRADO E CÓDIGO APAGADO (10/11/2026 → 13/11/2026).
 * 10/11: "não terá mais esse serviço" e "cuidado para não tirar qualquer coisa, ele só
 * não aparece na tela" (saiu só da tela). 13/11: o projeto bateu no limite de tamanho do
 * Apps Script e o usuário disse "pode apagar e só tenha cuidado para não cair outro
 * módulo". Este teste trava:
 *   1. os 4 arquivos do Oftalmo não existem mais e NADA no projeto os inclui;
 *   2. nenhuma tela mostra o Oftalmo (menu, card, portal, atalho, seletor de link);
 *   3. o link público antigo (?portal=oftalmo) responde com o aviso, não com erro;
 *   4. os DADOS continuam (as abas Agend_Oftalmo/Log_Agend_Oftalmo não são tocadas aqui).
 */
const fs = require("fs"), path = require("path");
const b = require("./base");
const RAIZ = path.join(__dirname, "..", "..");
const ler = f => fs.readFileSync(path.join(RAIZ, f), "utf8");

b.fluxo("OFTALMO · apagado, sem deixar rastro quebrado");
b.passo("1. Os arquivos saíram e nada os inclui");
["AgendOftalm.gs", "AgendOftalmo.html", "AgendaOftalmoPublica.html", "Scripts_AgendOftalmo.html"].forEach(f =>
  b.ok(!fs.existsSync(path.join(RAIZ, f)), f + " não existe mais"));
const projeto = fs.readdirSync(RAIZ).filter(f => /\.(gs|html)$/.test(f));
const citam = projeto.filter(f => /include\(\s*['"](AgendOftalmo|Scripts_AgendOftalmo|AgendaOftalmoPublica)['"]|createHtmlOutputFromFile\(\s*["']AgendaOftalmoPublica/.test(ler(f)));
b.igual(citam, [], "nenhum arquivo inclui ou serve as páginas apagadas");
b.passo("2. Nenhuma tela mostra o Oftalmo");
const index = ler("index.html");
b.ok(!/data-benef-sub="agendaOftalmo"|benefSubAgendaOftalmo|AgendOftalmo\b/.test(index), "sem menu, painel nem script no index");
b.ok(!/<h4>Exame oftalmológico<\/h4>/.test(index), "sem card em Benefícios");
b.ok(!/mostrarOftalmo|onclick="mostrarOftalmo/.test(ler("PortalAssociado.html")), "sem card no Portal do Associado");
b.ok(!/sisgepAplicarBeneficioRapido\(\\'Agenda de Oftalmo\\'\)/.test(ler("DespesasAdmin.html")), "sem atalho em Despesas");
b.ok(!/Agenda Oftalmo/.test(ler("Portalassociado.gs")), "sem item na prévia do portal");
b.ok(!/oftalmo\s*:\s*\{/.test(ler("BeneficiosLinkInteresse.gs")), "sem 'oftalmo' no seletor de link de interesse");
b.passo("3. O link público antigo mostra o aviso");
const code = ler("Code.gs");
b.ok(/p\.portal === "oftalmo"/.test(code) && /não é mais oferecido/.test(code), "a rota ?portal=oftalmo responde com o aviso");
b.ok(!/AgendaOftalmoPublica/.test(code.replace(/\/\*[\s\S]*?\*\//g, "")), "e não serve mais a página apagada");
b.passo("4. Os dados ficam");
b.ok(/Agend_Oftalmo/.test(ler("EscolasVinculos.gs")), "a aba Agend_Oftalmo continua prevista na migração de escolas (dado, não código)");
b.resumo();
