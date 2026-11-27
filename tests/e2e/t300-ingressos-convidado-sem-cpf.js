/**
 * INGRESSOS · CONVIDADO e ACOMPANHANTE SEM CPF (usuário, 27/11/2026: "tira a obrigação do CPF para convidado e acompanhante").
 * Prova (conferência no servidor, base FALSA, dados FICTÍCIOS): convite/acompanhante sem CPF são aceitos só com o nome; CPF informado
 * e inválido continua barrando; cortesia e pago continuam exigindo CPF; nome repetido na lista ou já existente na base vai para
 * "conferir" (sem CPF não há como saber se é a mesma pessoa). NÃO PROVA: o TickOne de verdade aceitar emitir sem CPF (teste manual).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const agora = new Date().toISOString();
g.cingLerBase_ = () => ({ lidoEm: agora, evento: "x", total: 1, linhas: [
  { nome: "Maria Exemplo da Silva", cpf: "52998224725", tel: "", codigo: "AAAA-0001", tipo: "Convite", escola: "", cidade: "", ref: "R1", zap: 0 }] });
g.cingPdfs_ = () => ({});
b.fluxo("INGRESSOS · convite e acompanhante sem CPF");
const r = g.compassoIngressos_conferir([
  { nome: "Pessoa Nova Um", categoria: "Convite", telefone: "(27) 99999-1111" },
  { nome: "Pessoa Nova Dois", categoria: "Acompanhante Associado" },
  { nome: "Pessoa Cpf Ruim", categoria: "Convite", cpf: "111.111.111-11" },
  { nome: "Pessoa Cortesia", categoria: "Cortesia" },
  { nome: "Pessoa Paga", categoria: "Pago" },
  { nome: "Pessoa Nova Um", categoria: "Convite" },
  { nome: "maria exemplo da silva", categoria: "Convite" }
], TOKEN);
b.ok(r.ok, "conferiu", r.mensagem);
const s = (i) => r.resultados[i];
b.igual(s(0).situacao, "novo", "convite só com nome (e telefone): novo");
b.igual(s(1).situacao, "novo", "acompanhante só com nome: novo");
b.ok(s(2).situacao === "conferir" && /CPF informado é inválido/.test(s(2).motivos.join(" ")), "CPF informado e inválido continua barrando", s(2).motivos.join(" | "));
b.ok(s(3).situacao === "conferir" && /CPF/.test(s(3).motivos.join(" ")), "cortesia sem CPF continua exigindo", s(3).motivos.join(" | "));
b.ok(s(4).situacao === "conferir" && /CPF/.test(s(4).motivos.join(" ")), "pago sem CPF continua exigindo", s(4).motivos.join(" | "));
b.ok(s(5).situacao === "conferir" && /Nome repetido/.test(s(5).motivos.join(" ")), "nome repetido na lista, sem CPF: conferir", s(5).motivos.join(" | "));
b.ok(s(6).situacao === "conferir" && /já existe ingresso com este nome/i.test(s(6).motivos.join(" ")) && !/outro CPF/.test(s(6).motivos.join(" ")), "nome que já está na base: conferir, sem falar de 'outro CPF'", s(6).motivos.join(" | "));
b.ok(s(0).avisos.length === 0 && s(1).avisos.length === 1, "sem telefone vira só um aviso, não bloqueia", JSON.stringify(s(1).avisos));
b.resumo();
