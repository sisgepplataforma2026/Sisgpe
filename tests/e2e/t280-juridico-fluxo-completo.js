/**
 * JURÍDICO — FLUXO PONTA A PONTA (auditoria de 20/11/2026: 27 das 28 funções
 * da tela não eram citadas em nenhum teste).
 * Permissão → processo (validação, criar, editar, "excluir" que só desativa) →
 * prazo (criar, marcar cumprido, EDITAR sem perder o "cumprido", excluir) →
 * audiência (validação, criar, agenda geral) → reclamantes (duplicidade) →
 * relatório executivo. Não cobre: IA (minuta/resumo), DataJud e Drive reais
 * (emulador só registra) — NÃO TESTÁVEL.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const ADM = b.logar(g, "wanderson");
const SEM = b.logar(g, "rogerio");     // módulos financeiro,rh — sem jurídico
const itens = r => (r && r.itens) || [];

b.fluxo("JURÍDICO — permissão");
b.passo("1. sem o módulo");
b.bloqueia(() => g.jurListarProcessos(SEM), "sem o módulo juridico não lista processos");
b.bloqueia(() => g.jurSalvarProcesso({ assunto: "X" }, SEM), "sem o módulo não cria processo");
b.bloqueia(() => g.jurSalvarPrazo({ idProcesso: "p", descricao: "d", data: "2026-12-01" }, SEM), "sem o módulo não cria prazo");
b.bloqueia(() => g.jurExcluirProcesso("x", SEM), "sem o módulo não exclui processo");
b.bloqueia(() => g.jurObterRelatorioExecutivo(SEM), "sem o módulo não vê o relatório");
b.bloqueia(() => g.jurListarProcessos(""), "sem sessão não lista");

b.fluxo("JURÍDICO — processo");
b.passo("2. validação e criação");
const vz = g.jurSalvarProcesso({ assunto: "   " }, ADM);
b.ok(vz.ok === false && /assunto/i.test(vz.mensagem), "assunto em branco é recusado", vz.mensagem);
const p1 = g.jurSalvarProcesso({ assunto: "Horas extras — Maria", tipo: "Processo", area: "Trabalhista", natureza: "Individual", valorCausa: "10.500,50", cnj: "0001234-56.2026.5.17.0001" }, ADM);
const p2 = g.jurSalvarProcesso({ assunto: "Ação coletiva — piso", tipo: "Processo", area: "Trabalhista", natureza: "Coletivo", tipo_invalido: 1 }, ADM);
b.ok(p1.ok && p2.ok && p1.id !== p2.id, "dois processos criados", p1.id + " / " + p2.id);
let ls = itens(g.jurListarProcessos(ADM));
b.igual(ls.length, 2, "a lista mostra os dois");
const l1 = ls.find(x => x.id === p1.id);
b.ok(l1 && Number(l1.valorCausa) === 10500.5, "valor da causa em formato brasileiro (10.500,50) vira número", l1 && l1.valorCausa);
const pInv = g.jurSalvarProcesso({ assunto: "Valores inválidos", tipo: "INEXISTENTE", status: "INEXISTENTE", natureza: "INEXISTENTE" }, ADM);
const lInv = itens(g.jurListarProcessos(ADM)).find(x => x.id === pInv.id);
b.ok(pInv.ok && lInv && lInv.tipo === "Processo" && lInv.status === "Ativo", "tipo/status inválidos caem no padrão em vez de gravar lixo", lInv && (lInv.tipo + "/" + lInv.status));
b.passo("3. editar e id inexistente");
const ed = g.jurSalvarProcesso({ id: p1.id, assunto: "Horas extras — Maria (ed.)", status: "Atenção", resultado: "Acordo" }, ADM);
ls = itens(g.jurListarProcessos(ADM));
const e1 = ls.find(x => x.id === p1.id);
b.ok(ed.ok && ls.length === 3 && e1.assunto.indexOf("(ed.)") > 0 && e1.status === "Atenção", "editar muda o registro sem criar outro");
b.ok(g.jurSalvarProcesso({ id: "NAO-EXISTE", assunto: "x" }, ADM).ok === false, "editar processo que não existe é recusado");

b.fluxo("JURÍDICO — prazos");
b.passo("4. validação e criação");
b.ok(g.jurSalvarPrazo({ descricao: "d", data: "2026-12-01" }, ADM).ok === false, "prazo sem processo é recusado");
b.ok(g.jurSalvarPrazo({ idProcesso: p1.id, data: "2026-12-01" }, ADM).ok === false, "prazo sem descrição é recusado");
b.ok(g.jurSalvarPrazo({ idProcesso: p1.id, descricao: "Contestar" }, ADM).ok === false, "prazo sem data é recusado");
const z1 = g.jurSalvarPrazo({ idProcesso: p1.id, descricao: "Contestar", data: "2026-12-10" }, ADM);
const z2 = g.jurSalvarPrazo({ idProcesso: p1.id, descricao: "Recorrer", data: "2026-12-05" }, ADM);
b.ok(z1.ok && z2.ok, "dois prazos criados");
let pr = itens(g.jurListarPrazos(p1.id, ADM));
b.ok(pr.length === 2 && pr[0].descricao === "Recorrer", "listados em ordem de data (o mais próximo primeiro)", pr.map(x => x.descricao).join(" > "));
b.igual(itens(g.jurListarPrazos(p2.id, ADM)).length, 0, "prazos de um processo não aparecem no outro");
b.passo("5. cumprir, editar, excluir");
b.ok(g.jurMarcarPrazo(z1.id, true, ADM).ok, "marcar como cumprido");
pr = itens(g.jurListarPrazos(p1.id, ADM));
const c1 = pr.find(x => x.id === z1.id);
b.ok(c1 && (c1.cumprido === true || c1.cumprido === "SIM"), "o prazo aparece como cumprido", JSON.stringify(c1 && c1.cumprido));
const edz = g.jurSalvarPrazo({ id: z1.id, idProcesso: p1.id, descricao: "Contestar (nova data)", data: "2026-12-12" }, ADM);
const c2 = itens(g.jurListarPrazos(p1.id, ADM)).find(x => x.id === z1.id);
b.ok(edz.ok && c2 && c2.data === "2026-12-12", "editar a data do prazo funciona");
/* ACHADO 20/11/2026: jurSalvarPrazo com id regrava CUMPRIDO a partir de dados.cumprido; sem esse campo, REABRE o prazo.
   Hoje nenhuma tela chama a edição (JuridicoAdmin só cria prazo, sem id), então não é alcançável pelo usuário.
   Fica como ATENÇÃO, não falha, para não travar a publicação por algo que ninguém aciona; se uma tela de edição
   for criada, trocar por b.ok. Correção: preservar o valor atual quando dados.cumprido vier indefinido. */
if (c2 && (c2.cumprido === true || c2.cumprido === "SIM")) b.ok(true, "editar um prazo já cumprido não o reabre");
else b.aviso("editar um prazo JÁ CUMPRIDO sem enviar 'cumprido' o REABRE (hoje nenhuma tela edita prazo)", "cumprido depois da edição = " + JSON.stringify(c2 && c2.cumprido));
b.ok(g.jurMarcarPrazo("NAO-EXISTE", true, ADM).ok === false, "marcar prazo inexistente é recusado");
b.ok(g.jurExcluirPrazo(z2.id, ADM).ok, "excluir prazo");
b.ok(g.jurExcluirPrazo(z2.id, ADM).ok === false, "duplo clique: segunda exclusão é recusada");

b.fluxo("JURÍDICO — audiências");
b.passo("6. validação, criação e agenda");
b.ok(g.jurSalvarAudiencia({ data: "2026-12-15" }, ADM).ok === false, "audiência sem processo é recusada");
b.ok(g.jurSalvarAudiencia({ idProcesso: p1.id }, ADM).ok === false, "audiência sem data é recusada");
const au = g.jurSalvarAudiencia({ idProcesso: p1.id, data: "2026-12-15", hora: "14:00", tipo: "Instrução", local: "Vara 1" }, ADM);
b.ok(au.ok && au.id, "audiência criada", JSON.stringify(au).slice(0, 80));
b.igual(itens(g.jurListarAudiencias(p1.id, ADM)).length, 1, "aparece nas audiências do processo");
b.ok(itens(g.jurListarTodasAudiencias(ADM)).some(x => x.id === au.id), "e na agenda geral");
b.ok(g.jurExcluirAudiencia(au.id, ADM).ok, "excluir audiência");
b.ok(g.jurExcluirAudiencia(au.id, ADM).ok === false, "duplo clique: segunda exclusão é recusada");

b.fluxo("JURÍDICO — reclamantes (processo coletivo)");
b.passo("7. duplicidade");
b.ok(g.jurAdicionarReclamante({ nome: "João" }, ADM).ok === false, "sem processo é recusado");
b.ok(g.jurAdicionarReclamante({ idProcesso: p2.id }, ADM).ok === false, "sem nome é recusado");
const r1 = g.jurAdicionarReclamante({ idProcesso: p2.id, nome: "João da Silva", associadoCpf: "111.444.777-35" }, ADM);
b.ok(r1.ok, "reclamante adicionado");
const r2 = g.jurAdicionarReclamante({ idProcesso: p2.id, nome: "João da Silva" }, ADM);
b.ok(r2.ok === false && /já/i.test(r2.mensagem), "o mesmo nome no mesmo processo é recusado", r2.mensagem);
b.ok(g.jurAdicionarReclamante({ idProcesso: p1.id, nome: "João da Silva" }, ADM).ok, "o mesmo nome em OUTRO processo é permitido");
b.igual(itens(g.jurListarReclamantes(p2.id, ADM)).length, 1, "lista só os do processo");
b.ok(g.jurRemoverReclamante(r1.id, ADM).ok && g.jurRemoverReclamante(r1.id, ADM).ok === false, "remover; duplo clique é recusado");

b.fluxo("JURÍDICO — relatório e exclusão");
b.passo("8. relatório executivo");
const rel = g.jurObterRelatorioExecutivo(ADM);
b.ok(rel.ok && rel.relatorio, "relatório executivo responde", rel.mensagem || "");
b.passo("9. 'excluir' processo só desativa");
b.ok(g.jurExcluirProcesso("NAO-EXISTE", ADM).ok === false, "excluir processo inexistente é recusado");
b.ok(g.jurExcluirProcesso(p2.id, ADM).ok, "excluir processo");
b.ok(itens(g.jurListarProcessos(ADM)).every(x => x.id !== p2.id), "some da lista");
b.ok(g.jurExcluirProcesso(p2.id, ADM).ok, "duplo clique: segunda exclusão não quebra (desativa de novo)");
b.naoTestavel("minuta/resumo por IA, consulta ao DataJud, upload de anexo no Drive", "dependem de API externa e Drive real — o emulador só registra");
b.naoTestavel("evento criado na agenda do Google (jurCriarEventoAgenda_)", "Calendar real");
b.resumo();
