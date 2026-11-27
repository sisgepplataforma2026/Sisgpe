/**
 * INGRESSOS · LISTA COLADA DO WHATSAPP (27/11/2026) — CompassoIngressosLista.gs. Dados FICTÍCIOS.
 * Prova o que o interpretador faz com texto do jeito que o Zap traz; NÃO prova a tela (t302) nem o TickOne.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
b.fluxo("LISTA DO WHATSAPP · interpretação");
const P = g.cingListaParse_;
let r = P("Ademir Carlos Pin 27 99913-9936\nAmanda Soares Chagas - 27997423466\n3. Pedro Teste (27) 3333-4444");
b.igual(r.itens.length, 3, "três pessoas, uma por linha");
b.igual(r.itens[0].nome, "Ademir Carlos Pin", "nome limpo");
b.igual(r.itens[0].telefone, "(27) 99913-9936", "telefone com espaço e hífen");
b.igual(r.itens[1].telefone, "(27) 99742-3466", "telefone corrido, sem máscara");
b.igual(r.itens[2].nome, "Pedro Teste", "numeração '3.' sai do nome");
b.igual(r.itens[2].telefone, "(27) 3333-4444", "fixo de 10 dígitos");
r = P("Zenair: Zenaide Borges, Claudimar Matheus e Lucas Jureveth  27999154910");
b.igual(r.itens.length, 3, "um telefone para um grupo: três pessoas");
b.ok(r.itens.every(x => x.telefone === "(27) 99915-4910" && x.grupo === "Zenair"), "todos com o mesmo telefone; 'Zenair' é o grupo, não vira ingresso");
r = P("Juliana Simão (sem telefone)\nTiago Orletti");
b.ok(r.itens.length === 2 && r.itens.every(x => !x.telefone), "sem telefone continua na lista (não é descartado)");
r = P("Laelio Binda\nRaquel de Oliveira\n27988411579");
b.ok(r.itens.length === 2 && r.itens.every(x => x.telefone === "(27) 98841-1579"), "linha só com telefone vale para os nomes sem telefone logo acima");
r = P("+55 27 99999-0001 Maria Exemplo");
b.ok(r.itens[0].nome === "Maria Exemplo" && r.itens[0].telefone === "(27) 99999-0001", "telefone com +55 e antes do nome");
r = P("\n\n   \n12345\n");
b.ok(r.itens.length === 0, "texto sem nome não inventa pessoa");
b.passo("função da tela");
const c = g.compassoIngressos_organizarTexto("Ana Silva 27999990000\nBeto Souza", "Acompanhante Associado", TOKEN);
b.ok(c.ok && c.total === 2 && c.semTelefone === 1 && c.itens[0].categoria === "acompanhante", "devolve a categoria escolhida e conta quem está sem telefone", c.mensagem);
b.ok(g.compassoIngressos_organizarTexto("   ", "convite", TOKEN).ok === false, "texto vazio: pede para colar");
b.ok(g.compassoIngressos_organizarTexto("Ana Silva", "xyz", TOKEN).itens[0].categoria === "convite", "categoria desconhecida cai em Convite");
b.resumo();
