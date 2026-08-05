/** TESTE PONTA A PONTA — Link de Interesse (componente compartilhado de Benefícios) */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_FIN = b.logar(g, "rogerio");   // financeiro+rh, SEM benefícios

b.fluxo("BENEFÍCIOS · Enviar Link de Interesse");

b.passo("1. Listar benefícios com formulário público");
const lista = g.beneficiosListarLinksInteresse(TOKEN);
b.ok(lista && lista.ok && lista.itens.length >= 3, "lista os benefícios que têm rota pública",
  (lista.itens || []).map(i => i.chave).join(", "));

b.passo("2. Montar link e mensagem do China Park");
const r = g.beneficiosPrepararLinkInteresse("chinapark", { nome: "Maria Souza", telefone: "(27) 99999-1234" }, TOKEN);
b.ok(r && r.ok, "monta o link", r && !r.ok ? "ERRO: " + r.mensagem : "");
b.ok(r.url && r.url.indexOf("?portal=chinapark") > 0, "URL aponta para a rota pública real do China Park", r.url);
b.ok(r.texto && r.texto.indexOf(r.url) > 0, "o link está dentro da mensagem");
b.ok(r.texto.indexOf("Maria Souza") > 0, "a mensagem chama a pessoa pelo nome");
b.ok(r.telefone === "5527999991234", "telefone normalizado para o formato do WhatsApp", r.telefone);

b.passo("3. A rota gerada é a mesma que o Code.gs atende?");
// Se alguém renomear a rota em Code.gs, o link vira link quebrado no WhatsApp
// do associado. Este teste amarra os dois lados.
const fs = require("fs");
const code = fs.readFileSync("/home/user/Sisgpe/Code.gs", "utf8");
["chinapark", "voucher", "oftalmo"].forEach(chave => {
  const rota = g.BENEF_LINKS[chave].rota.replace("?portal=", "");
  b.ok(code.indexOf('p.portal === "' + rota + '"') > 0,
    "rota '" + rota + "' existe em Code.gs", "");
});

b.passo("4. Telefone inválido não gera conversa quebrada");
const semFone = g.beneficiosPrepararLinkInteresse("chinapark", { telefone: "123" }, TOKEN);
b.ok(semFone.ok && semFone.telefone === "", "telefone curto vira vazio — a tela só oferece copiar o link");

b.passo("5. Benefício inexistente");
const nada = g.beneficiosPrepararLinkInteresse("hotel-fantasia", {}, TOKEN);
b.ok(nada && nada.ok === false, "benefício sem formulário público é recusado", nada.mensagem);

b.passo("6. Permissão");
const negado = g.beneficiosPrepararLinkInteresse("chinapark", {}, TOKEN_FIN);
b.ok(negado && negado.ok === false, "usuário sem o módulo Benefícios é negado", negado.mensagem);
const negadoLista = g.beneficiosListarLinksInteresse(TOKEN_FIN);
b.ok(negadoLista && negadoLista.ok === false, "listagem também nega", negadoLista.mensagem);

b.passo("7. Sessão inválida");
const semSessao = g.beneficiosPrepararLinkInteresse("chinapark", {}, "token-falso");
b.ok(semSessao && semSessao.ok === false, "token inválido é negado", semSessao.mensagem);

b.naoTestavel("Abertura real do WhatsApp e recebimento da mensagem", "depende do navegador e do aparelho");

b.resumo();
process.exit(0);
