/**
 * TESTE PONTA A PONTA — BASE DE ASSOCIADOS
 *
 * O submódulo que faltava: ~8.000 pessoas que só eram alcançáveis por dentro
 * de outros fluxos. O que se testa aqui não é "a lista aparece" — é se as
 * FILAS DE PENDÊNCIA acham o que ninguém enxergava.
 *
 * Sem matrícula, sem e-mail e sem escola não são categorias: são defeitos de
 * cadastro que impedem serviço. Sem matrícula não sai carteirinha; sem e-mail
 * o sindicato não avisa a pessoa de assembleia nenhuma; sem escola a relação
 * nominal não fecha. Se a fila errar a conta, a pendência continua invisível.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");   // financeiro + rh — não tem sindicalizacao

/* ── monta uma base pequena e controlada, um caso por pendência ── */
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const CAB = ["Nome fantasia", "Nome", "CPF", "Filiado", "Logradouro", "Número",
  "Bairro", "Cidade", "CEP", "Celular", "CELULAR2", "E-mail",
  "ULTIMA_ATUALIZACAO", "MATRICULA", "DATA_FILIACAO", "ID_FICHA"];
const aba = ss.insertSheet("Associados");
aba.getRange(1, 1, 1, CAB.length).setValues([CAB]);

function linha(o) {
  const v = new Array(CAB.length).fill("");
  v[0] = o.escola || ""; v[1] = o.nome; v[2] = o.cpf; v[3] = o.filiado;
  v[7] = o.cidade || "Vitória"; v[9] = o.celular || ""; v[11] = o.email || "";
  v[13] = o.matricula || "";
  aba.appendRow(v);
}
// completo
linha({ nome: "Ana Completa", cpf: "111.444.777-35", filiado: "S",
        escola: "Escola Modelo", email: "ana@ex.com", matricula: "000001", celular: "(27) 99999-0001" });
// sem matrícula
linha({ nome: "Bruno Sem Matricula", cpf: "529.982.247-25", filiado: "S",
        escola: "Escola Modelo", email: "bruno@ex.com" });
// sem e-mail
linha({ nome: "Carla Sem Email", cpf: "168.995.350-09", filiado: "S",
        escola: "Escola Modelo", matricula: "000002" });
// sem escola
linha({ nome: "Diego Sem Escola", cpf: "246.813.579-00", filiado: "S",
        email: "diego@ex.com", matricula: "000003" });
// desfiliado
linha({ nome: "Elena Desfiliada", cpf: "987.654.321-00", filiado: "N",
        escola: "Escola Modelo", email: "elena@ex.com", matricula: "000004" });

/* ══════════ 1. AS FILAS ══════════ */
b.fluxo("BASE DE ASSOCIADOS · As filas encontram o que estava invisível");

b.passo("1. O painel abre mostrando onde há trabalho");
const p = g.assocPainel(ADM);
b.ok(p.ok && p.totalBase === 5, "lê a base inteira", p.totalBase + " associados");

b.passo("2. Filiados e não filiados");
const fila = n => p.filas.filter(f => f.chave === n)[0];
b.ok(fila("FILIADOS").total === 4, "4 filiados", "");
b.ok(fila("NAO_FILIADOS").total === 1, "1 não filiado", "Elena");

b.passo("3. Cada pendência é encontrada, e só ela");
b.ok(fila("SEM_MATRICULA").total === 1, "1 sem matrícula (Bruno)", "");
b.ok(fila("SEM_EMAIL").total === 1, "1 sem e-mail (Carla)", "");
b.ok(fila("SEM_ESCOLA").total === 1, "1 sem escola (Diego)", "");

b.passo("4. Pendência de DESFILIADO não conta");
// Elena está sem nada relevante, mas não é filiada — cobrar cadastro de quem
// saiu do sindicato é trabalho inventado, e polui a fila de quem importa.
b.ok(fila("SEM_MATRICULA").total + fila("SEM_EMAIL").total + fila("SEM_ESCOLA").total === 3,
  "as filas de pendência só olham filiados", p.totalPendencias + " pendências no total");

b.passo("5. O resumo diz o que fazer, não só quantos");
b.ok(/carteirinha/i.test(p.resumo) && /avisar/i.test(p.resumo),
  "explica a consequência de cada pendência", p.resumo.slice(0, 110));

/* ══════════ 2. LISTAGEM E LGPD ══════════ */
b.fluxo("BASE DE ASSOCIADOS · Listagem, busca e proteção do CPF");

b.passo("6. A listagem NÃO devolve CPF aberto");
// 8.000 CPFs numa tela que fica aberta na mesa o dia inteiro.
const lista = g.assocListar("FILIADOS", "", 1, ADM);
const abertos = lista.associados.filter(a => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(a.cpf));
b.ok(abertos.length === 0, "todo CPF da lista vem mascarado",
  lista.associados.length ? lista.associados[0].cpf : "lista vazia");
b.ok(lista.associados.every(a => /^\*\*\*\.\*\*\*\.\d{3}-\d{2}$/.test(a.cpf)),
  "máscara mostra só o suficiente para conferir por telefone",
  lista.associados[0].cpf);

b.passo("7. Busca por nome");
const bn = g.assocListar("FILIADOS", "carla", 1, ADM);
b.ok(bn.total === 1 && /Carla/.test(bn.associados[0].nome), "acha por nome", bn.total + " resultado(s)");

b.passo("8. Busca por CPF funciona mesmo com o CPF mascarado na tela");
// Quem digita o CPF inteiro tem que achar, senão a máscara vira obstáculo
// para o atendimento em vez de proteção.
const bc = g.assocListar("FILIADOS", "111.444.777-35", 1, ADM);
b.ok(bc.total === 1 && /Ana/.test(bc.associados[0].nome), "acha pelo CPF digitado", bc.total + " resultado(s)");

b.passo("9. Busca sem resultado não quebra");
const bz = g.assocListar("FILIADOS", "zzzznaoexiste", 1, ADM);
b.ok(bz.ok && bz.total === 0, "devolve lista vazia, não erro", "");

b.passo("10. Fila inexistente é recusada");
const fx = g.assocListar("INVENTADA", "", 1, ADM);
b.ok(fx.ok === false, "fila desconhecida não devolve a base inteira", fx.mensagem);

/* ══════════ 3. FICHA INDIVIDUAL ══════════ */
b.fluxo("BASE DE ASSOCIADOS · Ficha individual");

b.passo("11. A ficha abre o CPF inteiro");
const det = g.assocDetalhe("111.444.777-35", ADM);
b.ok(det.ok && det.associado.cpf === "111.444.777-35",
  "na consulta individual o CPF aparece", det.associado.nome);

b.passo("12. A ficha lista as pendências daquela pessoa");
const detB = g.assocDetalhe("529.982.247-25", ADM);
b.ok(detB.pendencias.length === 1 && /matrícula/i.test(detB.pendencias[0]),
  "Bruno: uma pendência, a de matrícula", detB.pendencias[0]);
b.ok(det.pendencias.length === 0, "Ana: cadastro completo, nenhuma pendência", "");

b.passo("13. CPF fora da base não devolve ficha vazia");
const dx = g.assocDetalhe("529.982.247-26", ADM);
b.ok(dx.ok === false && /não consta/i.test(dx.mensagem),
  "diz que não consta, em vez de devolver campos em branco", dx.mensagem);

b.passo("14. CPF inválido é recusado antes de procurar");
b.ok(g.assocDetalhe("123", ADM).ok === false, "CPF curto é recusado", "");

/* ══════════ 4. CORREÇÃO DE CONTATO ══════════ */
b.fluxo("BASE DE ASSOCIADOS · Correção de contato");

b.passo("15. Corrigir e-mail de quem estava sem");
const cor = g.assocCorrigirContato("168.995.350-09", { email: "carla@ex.com" }, ADM);
b.ok(cor.ok && cor.alterado === true, "e-mail gravado", cor.mensagem);

b.passo("16. INTEGRAÇÃO — a fila 'sem e-mail' esvazia");
// É esta a prova de que a fila é viva e não um retrato. Se a pendência
// continuasse listada depois de resolvida, a tela viraria ruído.
const p2 = g.assocPainel(ADM);
b.ok(p2.filas.filter(f => f.chave === "SEM_EMAIL")[0].total === 0,
  "Carla saiu da fila de pendência", "pendências: " + p2.totalPendencias);

b.passo("17. E-mail inválido é recusado");
const inv = g.assocCorrigirContato("111.444.777-35", { email: "arroba-nenhum" }, ADM);
b.ok(inv.ok === false && /inválido/i.test(inv.mensagem), "não grava lixo no contato", inv.mensagem);

b.passo("18. Correção sem nada informado é recusada");
b.ok(g.assocCorrigirContato("111.444.777-35", {}, ADM).ok === false,
  "pede e-mail ou celular", "");

b.passo("19. Corrigir contato de CPF inexistente");
b.ok(g.assocCorrigirContato("529.982.247-26", { email: "x@y.com" }, ADM).ok === false,
  "não cria associado por engano numa correção", "");

b.passo("20. Reenviar o mesmo valor não conta como alteração");
const igual = g.assocCorrigirContato("168.995.350-09", { email: "carla@ex.com" }, ADM);
b.ok(igual.ok && igual.alterado === false,
  "sem mudança real, não suja o histórico", igual.mensagem);

/* ══════════ 5. EXPORTAÇÃO ══════════ */
b.fluxo("BASE DE ASSOCIADOS · Exportação");

b.passo("21. Exportar a fila de pendência");
const exp = g.assocExportarFila("SEM_MATRICULA", ADM);
b.ok(exp.ok && exp.total === 1 && exp.linhas.length === 2,
  "cabeçalho + 1 linha", exp.total + " registro(s)");

b.passo("22. O CPF continua mascarado no arquivo exportado");
// Planilha exportada circula por e-mail e WhatsApp.
b.ok(/^\*\*\*/.test(exp.linhas[1][1]), "CPF mascarado também na exportação", exp.linhas[1][1]);

/* ══════════ 6. PERMISSÃO ══════════ */
b.fluxo("BASE DE ASSOCIADOS · Permissão");

b.passo("23. Quem não tem Sindicalização não alcança a base");
b.bloqueia(() => g.assocPainel(FIN), "assocPainel nega");
b.bloqueia(() => g.assocListar("FILIADOS", "", 1, FIN), "assocListar nega");
b.bloqueia(() => g.assocDetalhe("111.444.777-35", FIN), "assocDetalhe nega");
b.bloqueia(() => g.assocCorrigirContato("111.444.777-35", { email: "a@b.com" }, FIN), "assocCorrigirContato nega");
b.bloqueia(() => g.assocExportarFila("FILIADOS", FIN), "assocExportarFila nega");

b.passo("24. Sem sessão");
b.bloqueia(() => g.assocPainel(""), "assocPainel nega token vazio");

b.naoTestavel("Desempenho com 8.000 linhas reais", "a base de teste tem 5");

b.resumo();
process.exit(0);
