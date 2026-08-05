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

b.passo("2b. A mensagem diz tudo que precisa dizer");
[["Recebemos", "reconhece o pedido que a pessoa já fez"],
 ["Importante:", "traz o aviso destacado"],
 ["não confirma a reserva", "deixa claro que o formulário não garante vaga"],
 ["Secretaria do SindEducação-ES", "diz quem analisa"],
 ["e/ou WhatsApp", "diz por onde a resposta chega"],
 ["Prazo de resposta", "responde a pergunta seguinte antes de ela ser feita"]
].forEach(function (par) {
  b.ok(r.texto.indexOf(par[0]) > 0, par[1]);
});

b.passo("2b-2. A mensagem não expõe a instância interna de aprovação");
// Decisão do usuário: o solicitante não precisa saber quem decide dentro do
// sindicato. Se alguém reintroduzir, este teste acusa.
b.ok(r.texto.indexOf("Presidência") === -1 && r.texto.indexOf("Presidente") === -1,
  "não cita a Presidência ao solicitante");

b.passo("2c. Ordem do texto — o aviso vem antes da promessa de retorno");
// Invertido, a pessoa lê "vamos te avisar" e entende que já está reservado.
b.ok(r.texto.indexOf("Importante:") < r.texto.indexOf("você será informado"),
  "o 'Importante' aparece antes do 'você será informado'");

b.passo("2d. Sem nome informado, a saudação não quebra");
const semNome = g.beneficiosPrepararLinkInteresse("chinapark", {}, TOKEN);
b.ok(semNome.ok && semNome.texto.indexOf("Olá!") > 0 && semNome.texto.indexOf("undefined") === -1,
  "vira 'Olá!' sem sobrar espaço nem 'undefined'");

b.passo("2e. Os três benefícios têm o texto completo");
["chinapark", "voucher", "oftalmo"].forEach(function (chave) {
  const t = g.beneficiosPrepararLinkInteresse(chave, {}, TOKEN);
  const completo = t.ok && ["Recebemos", "Importante:", "Prazo de resposta"]
    .every(function (p) { return t.texto.indexOf(p) > 0; });
  b.ok(completo, "'" + chave + "' tem abertura, aviso e prazo");
});
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
