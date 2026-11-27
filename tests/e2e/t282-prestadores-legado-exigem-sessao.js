/**
 * PRESTADORES (funções legadas de GuiasPagamento.gs) — EXIGEM SESSÃO E MÓDULO FINANCEIRO.
 * Auditoria de 20/11/2026, P0 (segurança), 1ª família: estas 7 funções respondiam sem login
 * e GRAVAM na aba de prestadores (e-mail/telefone de quem recebe pagamento e NF). Nenhuma
 * tela as chama (CadastroPrestadores.html usa as variantes *Desp de Despesas.gs).
 * O teste prova os DOIS lados: sem sessão/sem módulo → recusa; com sessão → continua
 * funcionando como antes (nada que já funcionava parou).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");      // módulo financeiro, não administrador
const SEM = b.logar(g, "joscimar");     // escolas,sindicalizacao — sem financeiro
const CNPJ = "11.222.333/0001-81";

b.fluxo("PRESTADORES LEGADOS — sem sessão ou sem o módulo: recusa");
b.passo("1. cada função recusa");
const chamadas = {
  cadastrarNovoPrestador: t => g.cadastrarNovoPrestador({ nome: "Intruso", documento: CNPJ }, t),
  salvarPrestador: t => g.salvarPrestador({ nome: "Intruso", documento: CNPJ }, t),
  excluirPrestador: t => g.excluirPrestador(2, t),
  salvarEmailPrestadorRapido: t => g.salvarEmailPrestadorRapido(2, "intruso@exemplo.com", t),
  salvarEmailETelefonePrestadorRapido: t => g.salvarEmailETelefonePrestadorRapido(2, "intruso@exemplo.com", "27999990000", t),
  limparCachePrestadoresFixos: t => g.limparCachePrestadoresFixos(t),
  importarPrestadoresDoHistorico: t => g.importarPrestadoresDoHistorico(t),
  listarTodosPrestadores: t => g.listarTodosPrestadores({}, t),
  listarPrestadoresSemEmail: t => g.listarPrestadoresSemEmail(t),
  buscarPrestadorGuiaPagamento: t => g.buscarPrestadorGuiaPagamento("gr", t)
};
Object.keys(chamadas).forEach(n => {
  b.bloqueia(() => chamadas[n](undefined), n + ": sem sessão é recusado");
  b.bloqueia(() => chamadas[n](SEM), n + ": sem o módulo financeiro é recusado");
});

b.fluxo("PRESTADORES LEGADOS — com sessão: continua funcionando");
b.passo("2. cadastrar, editar, e-mail, excluir");
const c1 = g.cadastrarNovoPrestador({ nome: "Gráfica Boa", documento: CNPJ, emailPrestador: "g@exemplo.com", valor: "100" }, FIN);
b.ok(c1.ok, "cadastrarNovoPrestador grava com sessão do financeiro", c1.mensagem || "");
b.ok(g.cadastrarNovoPrestador({ nome: "", documento: CNPJ }, FIN).ok === false, "validação de nome continua valendo");
b.ok(g.cadastrarNovoPrestador({ nome: "X", documento: "111" }, FIN).ok === false, "validação de documento continua valendo");
const s1 = g.salvarPrestador({ nome: "Fornecedor Dois", documento: CNPJ, emailPrestador: "f2@exemplo.com", valor: "50" }, FIN);
b.ok(s1.ok, "salvarPrestador cria com sessão do financeiro", s1.mensagem || "");
const linha = Number(s1.rowIndex || s1.linha || 2);
const ed = g.salvarPrestador({ nome: "Fornecedor Dois (ed.)", documento: CNPJ, rowIndex: linha, emailPrestador: "f2@exemplo.com" }, FIN);
b.ok(ed.ok, "salvarPrestador edita pela linha", ed.mensagem || "");
b.ok(g.salvarEmailPrestadorRapido(linha, "novo@exemplo.com", FIN).ok, "e-mail rápido grava");
b.ok(g.salvarEmailPrestadorRapido(linha, "invalido", FIN).ok === false, "e-mail inválido continua recusado");
b.ok(g.salvarEmailETelefonePrestadorRapido(linha, "novo2@exemplo.com", "27999990000", FIN).ok, "e-mail e telefone rápidos gravam");
b.ok(g.limparCachePrestadoresFixos(FIN).ok, "limpar cache funciona");
b.ok(g.listarTodosPrestadores({}, FIN).ok === true, "listar prestadores continua funcionando com sessão");
b.ok(g.listarPrestadoresSemEmail(FIN).ok === true, "listar prestadores sem e-mail continua funcionando com sessão");
/* busca com termo cai em garantirAbaGuiasPagamento_, que NÃO EXISTE (achado 20/11/2026: já era assim antes da trava; o legado
   GuiasPagamento.gs perdeu essa função). Aqui só se prova que a sessão não atrapalha o caminho que funciona (termo vazio). */
b.ok(g.buscarPrestadorGuiaPagamento("", FIN).ok === true, "buscar prestador continua respondendo com sessão (termo vazio)");
b.aviso("buscarPrestadorGuiaPagamento e importarPrestadoresDoHistorico chamam garantirAbaGuiasPagamento_, que não existe (quebradas desde antes; sem chamador)", "");
b.ok(g.excluirPrestador(0, FIN).ok === false, "excluir com linha inválida continua recusado");
const ex = g.excluirPrestador(linha, ADM);
b.ok(!/sess[ãa]o|permiss|acesso ao m/i.test(String(ex.mensagem || "")), "excluirPrestador com sessão chega à regra de negócio (não é barrado)", ex.mensagem || "");
b.resumo();
