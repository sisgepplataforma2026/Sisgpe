/**
 * TESTE — O DEPENDENTE PUXA A ESCOLA DO TITULAR (VoucherEscolaDoTitular.gs)
 *
 * Pedido do usuário (24/11/2026): "todos os dependentes devem puxar a escola do
 * titular para emissão do voucher", com uma OPÇÃO de troca (titular numa
 * faculdade, filho num colégio da mesma rede), digitar com aviso quando a
 * escola do titular não é achada, "mesma rede" só AVISA e os já emitidos só
 * são LISTADOS.
 *
 * PROVA: a regra no servidor — o único ponto por onde passam a tela da
 * Secretaria e o lote. NÃO PROVA: a tela (precisa abrir o portal) nem o
 * cadastro real de Escolas (usa duas linhas de teste).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const shEsc = ss.getSheetByName("Escolas") || ss.insertSheet("Escolas");
shEsc.clear();
shEsc.getRange(1, 1, 1, 6).setValues([["Escola (Razão Social)", "CNPJ", "Cidade", "UF", "EscolaID", "E-mail (principal)"]]);
shEsc.getRange(2, 1, 3, 6).setValues([
  ["FACULDADE REDE ALFA LTDA", "11222333000144", "VITORIA", "ES", "ESC-001", "rh@alfa.com"],
  ["COLEGIO REDE ALFA LTDA", "11222333000225", "VITORIA", "ES", "ESC-002", "col@alfa.com"],
  ["COLEGIO OUTRA REDE LTDA", "99888777000166", "SERRA", "ES", "ESC-003", "col@outra.com"]
]);
let shA = ss.getSheetByName("Associados");
if (!shA) shA = ss.insertSheet("Associados");
shA.clear();
shA.getRange(1, 1, 1, 4).setValues([["CPF", "Nome", "Email", "ESCOLA"]]);
shA.getRange(2, 1, 3, 4).setValues([
  [11144477735, "TITULAR FACULDADE", "t1@x.com", "FACULDADE REDE ALFA LTDA"],   // CPF como NÚMERO: perde o zero? (aqui tem 11)
  ["52998224725", "TITULAR SEM ESCOLA", "t2@x.com", ""],
  ["39053344705", "TITULAR NOME ESTRANHO", "t3@x.com", "UNIVERSIDADE DE NADA"]
]);

function criar(extra) {
  return g.voucherCriarSolicitacao(Object.assign({ situacaoSindical: "ASSOCIADO",
    cpf: "11144477735", nome: "TITULAR FACULDADE", email: "t1@x.com", modalidade: "ENSINO_FUNDAMENTAL",
    curso: "6 ANO", periodo: "2027", regime: "ANUAL", tipoBeneficiario: "FILHO", ordemFilho: "1",
    beneficiario: "FILHA UM", aprovar: true
  }, extra || {}), TOKEN);
}
function linha(proto) {
  const sh = ss.getSheetByName("Voucher_Solicitacoes");
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(c => String(c || "").trim());
  const l = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().filter(r => String(r[cab.indexOf("NUMERO_PROTOCOLO")]).trim() === proto)[0];
  const o = {}; cab.forEach((c, i) => { o[c] = l ? l[i] : ""; }); return o;
}
function historico(proto) {
  const sh = ss.getSheetByName("Voucher_Historico");
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().map(r => r.join(" | ")).filter(t => t.indexOf(proto) > -1);
}

b.fluxo("BOLSAS · a escola do dependente vem do titular");

b.passo("1. O resolvedor acha a escola do titular e diz de onde veio");
const t = g.voucherEscolaDoTitular_("11144477735");
b.ok(t.achou && t.origem === "CADASTRO", "achou pelo cadastro de Associados", JSON.stringify(t));
b.igual(t.cnpj, "11222333000144", "com o CNPJ do cadastro de Escolas");
b.igual(t.escolaId, "ESC-001", "e o ID da escola");
b.ok(!g.voucherEscolaDoTitular_("52998224725").achou, "titular sem escola no cadastro: não acha");
const estranho = g.voucherEscolaDoTitular_("39053344705");
b.ok(!estranho.achou && /não casou/.test(estranho.aviso), "nome que não casa com nenhuma escola: não acha, e explica", estranho.aviso);

b.passo("2. DEPENDENTE: a escola digitada é substituída pela do titular — COM aviso");
const r2 = criar({ escola: "ESCOLA DIGITADA ERRADA", cnpjEscola: "00000000000000" });
b.ok(r2.ok, "a solicitação foi criada", r2.mensagem);
const l2 = linha(r2.protocolo);
b.igual(l2.ESCOLA_SELECIONADA, "FACULDADE REDE ALFA LTDA", "gravou a escola do TITULAR");
b.igual(String(l2.CNPJ_ESCOLA), "11222333000144", "com o CNPJ dele, não o digitado");
b.ok(r2.escolaAplicada && r2.escolaAplicada.origem === "DO_TITULAR" && /substituída/.test(r2.escolaAplicada.aviso),
  "a resposta diz que substituiu e de onde veio", JSON.stringify(r2.escolaAplicada));
b.ok(historico(r2.protocolo).some(t => /ESCOLA_DEPENDENTE/.test(t) && /mesma do titular/.test(t)), "e o histórico ganhou a linha ESCOLA_DEPENDENTE");

b.passo("3. TITULAR como beneficiário: nada muda, a escola é a digitada");
const r3 = criar({ tipoBeneficiario: "TITULAR", beneficiario: "", ordemFilho: "", escola: "COLEGIO OUTRA REDE LTDA", cnpjEscola: "99888777000166", modalidade: "GRADUACAO", curso: "Direito", regime: "SEMESTRAL", periodo: "2027/1" });
b.ok(r3.ok, "criou", r3.mensagem);
b.igual(linha(r3.protocolo).ESCOLA_SELECIONADA, "COLEGIO OUTRA REDE LTDA", "a escola do titular é a que ele digitou");
b.ok(!r3.escolaAplicada, "e não há 'escola aplicada' para o titular");

b.passo("4. A OPÇÃO DE TROCA: exige motivo, grava a escolhida e AVISA se a raiz do CNPJ é outra");
const semMotivo = criar({ escolaDiferenteDoTitular: true, escola: "COLEGIO REDE ALFA LTDA", cnpjEscola: "11222333000225", beneficiario: "FILHA DOIS", ordemFilho: "2" });
b.ok(!semMotivo.ok && /motivo/i.test(semMotivo.mensagem), "sem motivo, recusa", semMotivo.mensagem);
const mesmaRede = criar({ escolaDiferenteDoTitular: true, motivoEscolaDiferente: "MESMA_REDE", escola: "COLEGIO REDE ALFA LTDA", cnpjEscola: "11222333000225", escolaId: "ESC-002", beneficiario: "FILHA DOIS", ordemFilho: "2" });
b.ok(mesmaRede.ok, "com motivo, cria", mesmaRede.mensagem);
b.igual(linha(mesmaRede.protocolo).ESCOLA_SELECIONADA, "COLEGIO REDE ALFA LTDA", "gravou a escola ESCOLHIDA");
b.ok(mesmaRede.escolaAplicada.origem === "TROCADA" && !mesmaRede.escolaAplicada.aviso, "mesma raiz de CNPJ: troca sem aviso");
const outraRede = criar({ escolaDiferenteDoTitular: true, motivoEscolaDiferente: "OUTRO", escola: "COLEGIO OUTRA REDE LTDA", cnpjEscola: "99888777000166", beneficiario: "FILHO TRES", ordemFilho: "3" });
b.ok(outraRede.ok, "raiz diferente NÃO bloqueia — só avisa", outraRede.mensagem);
b.ok(/mesma rede/i.test(outraRede.escolaAplicada.aviso), "e o aviso fala de rede", outraRede.escolaAplicada.aviso);
b.ok(historico(outraRede.protocolo).some(t => /DIFERENTE da do titular/.test(t) && /OUTRO/.test(t)), "o histórico guarda o motivo");

b.passo("4b. A troca é BUSCA NO CADASTRO: escola que não existe é recusada, e valem os dados do cadastro");
const inventada = criar({ escolaDiferenteDoTitular: true, motivoEscolaDiferente: "MESMA_REDE", escola: "ESCOLA INVENTADA XYZ", cnpjEscola: "12345678000195", beneficiario: "FILHA INVENTADA", ordemFilho: "2" });
b.ok(!inventada.ok && /cadastro de escolas/.test(inventada.mensagem) && /não foi encontrada/.test(inventada.mensagem), "escola fora das 679: recusa", inventada.mensagem);
const porId = criar({ escolaDiferenteDoTitular: true, motivoEscolaDiferente: "MESMA_REDE", escola: "nome digitado errado", cnpjEscola: "11222333000225", escolaId: "ESC-002", beneficiario: "FILHA DO CADASTRO", ordemFilho: "2", periodo: "2029" });
b.ok(porId.ok, "achada pelo ID/CNPJ, mesmo com o nome digitado errado", porId.mensagem);
b.igual(linha(porId.protocolo).ESCOLA_SELECIONADA, "COLEGIO REDE ALFA LTDA", "grava o NOME DO CADASTRO, não o digitado");
b.igual(String(linha(porId.protocolo).CNPJ_ESCOLA), "11222333000225", "e o CNPJ do cadastro");

b.passo("5. Titular SEM escola achada: deixa digitar, com aviso; sem escola nenhuma, CRIA e avisa (como sempre foi)");
const sem = g.voucherCriarSolicitacao({ situacaoSindical: "ASSOCIADO", cpf: "52998224725", nome: "TITULAR SEM ESCOLA", email: "t2@x.com", modalidade: "ENSINO_FUNDAMENTAL", curso: "6 ANO", periodo: "2027", regime: "ANUAL", tipoBeneficiario: "FILHO", ordemFilho: "1", beneficiario: "FILHA X", aprovar: true }, TOKEN);
b.ok(sem.ok && sem.escolaAplicada.origem === "SEM_ESCOLA" && /Preencha a escola/.test(sem.escolaAplicada.aviso), "sem escola nenhuma: cria, e avisa que falta preencher antes de emitir", JSON.stringify(sem.escolaAplicada));
b.ok(historico(sem.protocolo).some(t => /ESCOLA_DEPENDENTE/.test(t) && /em branco/.test(t)), "e o histórico registra");
const digitada = g.voucherCriarSolicitacao({ situacaoSindical: "ASSOCIADO", cpf: "52998224725", nome: "TITULAR SEM ESCOLA", email: "t2@x.com", modalidade: "ENSINO_FUNDAMENTAL", curso: "6 ANO", periodo: "2027", regime: "ANUAL", tipoBeneficiario: "FILHO", ordemFilho: "1", beneficiario: "FILHA Y", escola: "COLEGIO REDE ALFA LTDA", cnpjEscola: "11222333000225", aprovar: true }, TOKEN);
b.ok(digitada.ok && digitada.escolaAplicada.origem === "DIGITADA_SEM_CADASTRO" && /não foi encontrada/.test(digitada.escolaAplicada.aviso), "com escola digitada: cria e avisa", JSON.stringify(digitada.escolaAplicada));

b.passo("6. Pelo PEDIDO EM LOTE a regra vale igual, por beneficiário");
const lote = g.voucherCriarSolicitacoesEmLote({
  comuns: { situacaoSindical: "ASSOCIADO", cpf: "11144477735", nome: "TITULAR FACULDADE", email: "t1@x.com", periodo: "2028", escola: "ESCOLA COMUM DIGITADA", regime: "ANUAL", modalidade: "ENSINO_MEDIO", curso: "1 ANO" },
  beneficiarios: [{ tipoBeneficiario: "FILHO", beneficiario: "LOTE A", ordemFilho: "1" }, { tipoBeneficiario: "FILHO", beneficiario: "LOTE B", ordemFilho: "2", escolaDiferenteDoTitular: true, motivoEscolaDiferente: "MESMA_REDE", escola: "COLEGIO REDE ALFA LTDA", cnpjEscola: "11222333000225" }]
}, TOKEN);
b.ok(lote.criados === 2, "criou os 2", lote.mensagem);
b.igual(lote.resultados[0].escolaAplicada && lote.resultados[0].escolaAplicada.origem, "DO_TITULAR", "o 1º veio do titular");
b.igual(lote.resultados[1].escolaAplicada && lote.resultados[1].escolaAplicada.origem, "TROCADA", "o 2º usou a opção de troca");

b.passo("7. A LISTA dos já emitidos com escola diferente é de LEITURA — não altera nada");
const antes = JSON.stringify(ss.getSheetByName("Voucher_Solicitacoes").getDataRange().getValues());
const lista = g.voucherListarDependentesComEscolaDiferente(TOKEN);
b.ok(lista.ok && lista.total >= 2, "lista os dependentes de escola diferente do TITULAR (cadastro)", "total " + lista.total);
b.ok(!lista.itens.some(i => i.dependente === "FILHA UM"), "o dependente que usou a escola do titular NÃO entra na lista");
b.ok(lista.itens.some(i => i.dependente === "FILHO TRES" && i.mesmaRaizCnpj === false), "FILHO TRES (outra rede) marcado como raiz de CNPJ DIFERENTE");
b.ok(lista.itens.some(i => i.dependente === "FILHA DOIS" && i.mesmaRaizCnpj === true), "FILHA DOIS (mesma rede) marcada como mesma raiz de CNPJ");
b.igual(JSON.stringify(ss.getSheetByName("Voucher_Solicitacoes").getDataRange().getValues()), antes, "e a planilha ficou IDÊNTICA");
b.resumo();
