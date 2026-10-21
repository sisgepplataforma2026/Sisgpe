/**
 * PEDIDOS DE VOUCHER POR E-MAIL — a IA lê, o sistema confere, a pessoa valida.
 *
 * Pedido do usuário em 13/10/2026: automatizar o pedido de voucher que hoje
 * chega por e-mail na secretaria@ e é transcrito à mão. Regras fechadas na
 * mesma conversa:
 *   - documentos: último contracheque + RG ou CNH + nome do curso + semestre
 *   - filho até 24 anos (identidade, certidão ou CNH), sem IR
 *   - enteado até 24 anos, só com comprovante de dependente no IR
 *   - cônjuge: certidão de casamento
 *   - "último contracheque" = o mais recente: mês atual ou anterior
 *   - associado = está na relação; a secretaria pode confirmar à mão
 *   - não associado → orientação para a sede (texto do sindicato)
 *   - NADA sai sem clique de gente
 *
 * A CAIXA E A IA SÃO SIMULADAS AQUI. O que este arquivo prova é o que o
 * sistema FAZ com a leitura: o estado, a resposta, a solicitação, a emissão,
 * o envio na mesma conversa, a trava de homologação e quem pode ver o quê.
 *
 * O QUE ELE NÃO PROVA, e continua "não testado" pela REGRA Nº -1:
 *   - se a IA de verdade lê bem um contracheque escaneado (só no ar);
 *   - a importação POP da secretaria@ chegando ao Gmail do sistema;
 *   - o PDF de verdade e a entrega do e-mail;
 *   - a tela no navegador.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_SEM = b.logar(g, "rogerio");   // financeiro + rh, sem benefícios
g.setupVoucherModuleFase1();
g.PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", "chave-de-teste");

/* Uma usuária da Secretaria, com Benefícios, sem ser administradora. */
(function () {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  const aba = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
  aba.appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha", "secretaria@sindeducacao.com",
                 "USUARIO", "ATIVO", "NAO", "beneficios"]);
})();
const TOKEN_SEC = b.logar(g, "marcelha");

/* ── a relação de associados ── */
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const shA = ss.getSheetByName("Associados") || ss.insertSheet("Associados");
shA.appendRow(["CPF", "Nome", "Filiado", "E-mail", "Celular", "Nome fantasia"]);
const CPF_ANA = "11144477735";      // filiada
const CPF_BIA = "52998224725";      // filiada
const CPF_NAO = "39053344705";      // na base, NÃO filiada
const CPF_FORA = "15350946056";     // fora da base
const CPF_CAIO = "86288366757";     // filiado (enteado)
const CPF_DANI = "71428793860";     // filiada (filho 26)
shA.appendRow([CPF_ANA, "ANA MARIA SOUZA", "SIM", "ana@exemplo.com", "27999990001", "COLEGIO ALFA"]);
shA.appendRow([CPF_BIA, "BEATRIZ LIMA COSTA", "SIM", "bia@exemplo.com", "27999990002", "ESCOLA BETA"]);
shA.appendRow([CPF_NAO, "NAIR NOGUEIRA", "NAO", "nair@exemplo.com", "27999990003", "ESCOLA GAMA"]);
shA.appendRow([CPF_CAIO, "CAIO PEREIRA DIAS", "SIM", "caio@exemplo.com", "27999990004", "ESCOLA DELTA"]);
shA.appendRow([CPF_DANI, "DANIELA ROCHA", "SIM", "dani@exemplo.com", "27999990005", "ESCOLA EPSILON"]);

const SIM = require("./vpe-simulador").instalar(g, amb);
const { tocadas, chamadasIA, EXTRACOES, novaThread, responder, CC, RG, base } = SIM;
/* Um ciclo do LEITOR (na conta da Secretaria: copia para a ponte e envia a
   fila) e depois a leitura do SISGEP (que só enxerga a ponte). */
const ler = () => { SIM.ciclo(); return g.voucherPedidosLerAgora(TOKEN); };
const saida = () => g.vpeLinhas_(SIM.aba("Saida"));
const painel = (caixa, tk) => g.voucherPedidosPainel(caixa || "SECRETARIA", tk || TOKEN);
const pedidoDa = (th) => g.vpeLinhas_().find(r => r.THREAD_ID === th.id);
const pdf = SIM.pdf, jpg = SIM.jpg;

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PEDIDOS POR E-MAIL · 1. Ler a caixa e separar");

EXTRACOES.ANA = base({ titular: { nome: "Ana Maria Souza", cpf: "", telefone: "" },
  anexos: [CC("ANA MARIA SOUZA", CPF_ANA, "09/2026", "COLEGIO ALFA LTDA"), RG(2, "ANA MARIA SOUZA", CPF_ANA, "3.111.222")] });
const thAna = novaThread("Voucher 2027/1", "Ana Souza <ana@exemplo.com>",
  "Bom dia, quero o voucher de Pedagogia para 2027/1. Seguem os documentos. CASO:ANA",
  [pdf("contracheque.pdf"), jpg("rg.jpg")]);

EXTRACOES.BIA = base({ titular: { nome: "Beatriz Lima Costa", cpf: CPF_BIA, telefone: "" },
  curso: "Enfermagem", area: "SAUDE", anexos: [RG(1, "BEATRIZ LIMA COSTA", CPF_BIA)] });
const thBia = novaThread("Bolsa de estudos", "bia@exemplo.com",
  "Olá, gostaria do certificado de bolsa para Enfermagem 2027/1. Meu CPF é 529.982.247-25. CASO:BIA",
  [jpg("identidade.jpg")]);

EXTRACOES.VELHO = base({ titular: { nome: "Ana Maria Souza", cpf: CPF_ANA },
  periodo: "2026/2", curso: "Letras",
  anexos: [CC("ANA MARIA SOUZA", CPF_ANA, "07/2026", "COLEGIO ALFA LTDA"), RG(2, "ANA MARIA SOUZA", CPF_ANA)] });

EXTRACOES.NAIR = base({ titular: { nome: "Nair Nogueira", cpf: CPF_NAO },
  anexos: [CC("NAIR NOGUEIRA", CPF_NAO, "09/2026", "ESCOLA GAMA"), RG(2, "NAIR NOGUEIRA", CPF_NAO)] });
const thNair = novaThread("voucher", "nair@exemplo.com", "Quero voucher de bolsa. CASO:NAIR",
  [pdf("cc.pdf"), pdf("rg.pdf")]);

EXTRACOES.FORA = base({ titular: { nome: "Fulano Fora", cpf: CPF_FORA },
  anexos: [CC("FULANO FORA", CPF_FORA, "09/2026", "ESCOLA Z"), RG(2, "FULANO FORA", CPF_FORA)] });
const thFora = novaThread("Pedido de voucher", "fulano@exemplo.com", "Preciso do voucher da faculdade. CASO:FORA",
  [pdf("cc.pdf"), pdf("rg.pdf")]);

EXTRACOES.CPFDIF = base({ titular: { nome: "Ana Maria Souza", cpf: CPF_BIA },
  anexos: [CC("ANA MARIA SOUZA", CPF_ANA, "09/2026", "COLEGIO ALFA"), RG(2, "ANA MARIA SOUZA", CPF_ANA)] });
const thCpf = novaThread("voucher", "ana@exemplo.com",
  "Voucher, CPF 529.982.247-25. CASO:CPFDIF", [pdf("cc.pdf"), pdf("rg.pdf")]);

EXTRACOES.ENTEADO = base({ titular: { nome: "Caio Pereira Dias", cpf: CPF_CAIO },
  beneficiario: { tipo: "ENTEADO", nome: "Lucas Prado", data_nascimento: "10/03/2008" },
  curso: "Direito", area: "HUMANAS",
  anexos: [CC("CAIO PEREIRA DIAS", CPF_CAIO, "10/2026", "ESCOLA DELTA"), RG(2, "CAIO PEREIRA DIAS", CPF_CAIO),
           RG(3, "LUCAS PRADO", "", "999", "10/03/2008")] });
const thEnteado = novaThread("Voucher para enteado", "caio@exemplo.com",
  "Voucher de Direito 2027/1 para meu enteado Lucas. CASO:ENTEADO",
  [pdf("cc.pdf"), pdf("rg.pdf"), pdf("rg-lucas.pdf")]);

EXTRACOES.FILHO26 = base({ titular: { nome: "Daniela Rocha", cpf: CPF_DANI },
  beneficiario: { tipo: "FILHO", nome: "Pedro Rocha", data_nascimento: "" },
  anexos: [CC("DANIELA ROCHA", CPF_DANI, "09/2026", "ESCOLA EPSILON"), RG(2, "DANIELA ROCHA", CPF_DANI),
           { indice: 3, tipo: "CERTIDAO_NASCIMENTO", nome_pessoa: "PEDRO ROCHA", data_nascimento: "01/01/2000", legivel: true }] });
const thFilho = novaThread("Bolsa filho", "dani@exemplo.com", "Voucher pro meu filho Pedro. CASO:FILHO26",
  [pdf("cc.pdf"), pdf("rg.pdf"), pdf("certidao.pdf")]);

const thAdm = novaThread("Reunião de diretoria", "presidente@exemplo.com",
  "Pauta da reunião de quinta: prestação de contas e assembleia.", []);
const thFin = novaThread("Voucher", "x@exemplo.com", "Quero voucher. CASO:FIN", [],
  "financeiro@sindeducacao.com");
EXTRACOES.FIN = base({ titular: { nome: "X", cpf: CPF_BIA } });
const thFalha = novaThread("voucher", "y@exemplo.com", "Voucher por favor. CASO:FALHA", []);

b.passo("1. O leitor da Secretaria separa pedido de e-mail administrativo");
const r1 = ler();
b.ok(r1.ok, "o SISGEP leu a ponte", r1.mensagem);
const entrada = g.vpeLinhas_(SIM.aba("Entrada"));
const vistos = g.vpeLinhas_(SIM.aba("Vistos"));
b.ok(!entrada.some(r => r.THREAD_ID === thAdm.id), "a reunião de diretoria NÃO foi copiada para a ponte");
b.ok(vistos.some(r => r.THREAD_ID === thAdm.id), "o leitor guardou só o identificador dela, para não reler");
const ponteTexto = JSON.stringify(entrada) + JSON.stringify(vistos);
b.ok(!/Reuni[aã]o de diretoria|presidente@exemplo|presta[cç][aã]o de contas/.test(ponteTexto),
  "nem o assunto, nem o remetente, nem o texto do e-mail administrativo chegam à ponte");
b.ok(!pedidoDa(thAdm), "e o SISGEP nem sabe que ele existe");
b.ok(!entrada.some(r => r.THREAD_ID === thFin.id) && !pedidoDa(thFin),
  "e-mail mandado ao financeiro@ não passa pelo leitor da Secretaria");
b.ok(/to:secretaria@sindeducacao\.com/.test(SIM.consultas[0] || ""), "o leitor busca só o que foi para a secretaria@",
  SIM.consultas[0]);
b.ok(!chamadasIA.some(c => !c.caso), "e não se gastou chamada de IA com e-mail que não é pedido");
b.igual(tocadas.length, 0, "nenhum e-mail foi marcado como lido ou arquivado");
b.igual(SIM.tentativasSisgep, [], "o SISGEP não tocou em caixa de e-mail nenhuma");
b.ok(chamadasIA.find(c => c.caso === "ANA").anexos === 2, "os dois anexos da Ana chegaram à IA pela ponte");
b.ok(JSON.parse(entrada.find(r => r.THREAD_ID === thAna.id).ANEXOS_JSON).every(a => a.fileId),
  "os anexos foram guardados no Drive pelo leitor");

b.passo("1b. Cada pedido tem ID próprio, mesmo lidos no mesmo segundo");
/* Math.random travado: com o gerador antigo (segundo + 3 dígitos), todos os
   pedidos lidos no mesmo segundo nasceriam com o MESMO ID. */
const randomOriginal = Math.random;
Math.random = () => 0.5;
const thColA = novaThread("voucher A", "colisao-a@exemplo.com", "Voucher. CASO:COLA", []);
const thColB = novaThread("voucher B", "colisao-b@exemplo.com", "Voucher. CASO:COLB", []);
EXTRACOES.COLA = base({ titular: { nome: "Col A", cpf: "" } });
EXTRACOES.COLB = base({ titular: { nome: "Col B", cpf: "" } });
try { ler(); } finally { Math.random = randomOriginal; }
const ids = g.vpeLinhas_().map(r => r.ID_PEDIDO);
b.igual(new Set(ids).size, ids.length, "nenhum ID de pedido repetido (" + ids.length + " pedidos)");
b.ok(pedidoDa(thColA).ID_PEDIDO !== pedidoDa(thColB).ID_PEDIDO, "dois e-mails lidos juntos, dois IDs");

b.passo("2. Cada pedido no seu estado");
b.igual(pedidoDa(thAna).ESTADO, "PRONTO", "Ana: filiada, contracheque de 09/2026, RG → PRONTO");
b.igual(pedidoDa(thBia).ESTADO, "FALTA_DOC", "Bia: sem contracheque → FALTA DOCUMENTO");
b.igual(pedidoDa(thNair).ESTADO, "NAO_ENCONTRADO", "Nair: está na base mas NÃO filiada → não encontrada");
b.igual(pedidoDa(thFora).ESTADO, "NAO_ENCONTRADO", "Fulano: CPF fora da relação → não encontrado");
b.igual(pedidoDa(thCpf).ESTADO, "PRECISA_VOCE", "CPF do e-mail ≠ CPF do documento → precisa de você");
b.igual(pedidoDa(thEnteado).ESTADO, "FALTA_DOC", "enteado sem comprovante de IR → falta documento");
b.igual(pedidoDa(thFilho).ESTADO, "PRECISA_VOCE", "filho com 26 anos → precisa de você");
b.igual(pedidoDa(thFalha).ESTADO, "PRECISA_VOCE", "falha da IA não some: vira 'precisa de você'");
b.ok(String(pedidoDa(thFalha).ERRO).indexOf("sobrecarga") > -1, "com o erro guardado", pedidoDa(thFalha).ERRO);

b.passo("3. O que a conferência diz, em palavras");
const pAna = g.voucherPedidosDetalhe(pedidoDa(thAna).ID_PEDIDO, TOKEN);
b.igual(pAna.campos.cpf.valor, CPF_ANA, "Ana: CPF lido do documento");
b.igual(pAna.campos.cpf.origem, "lido no documento anexo", "com a origem à vista");
b.igual(pAna.campos.nome.origem, "cadastro de associados", "o nome vem do cadastro");
b.igual(pAna.campos.escola.valor, "COLEGIO ALFA LTDA", "a escola vem do contracheque");
b.igual(pAna.percentual && pAna.percentual.valor, 70, "percentual de Humanas pela regra da CCT");
b.igual(pAna.campos.rg.valor, "3.111.222", "o RG lido vai para o certificado");

const pEnt = g.voucherPedidosDetalhe(pedidoDa(thEnteado).ID_PEDIDO, TOKEN);
b.ok(pEnt.pendencias.some(p => /Imposto de Renda/.test(p.texto)), "enteado: a pendência cita o IR");
b.ok(/Imposto de Renda/.test(pEnt.respostaSugerida), "e a resposta sugerida pede o comprovante");

const pFil = g.voucherPedidosDetalhe(pedidoDa(thFilho).ID_PEDIDO, TOKEN);
b.ok(pFil.pendencias.some(p => /26 anos/.test(p.texto) && /24/.test(p.texto)), "filho: diz a idade e o limite",
  JSON.stringify(pFil.pendencias));

const pFora = g.voucherPedidosDetalhe(pedidoDa(thFora).ID_PEDIDO, TOKEN);
const txtSede = pFora.respostaSugerida;
b.ok(/9h às 10h e das 15h às 16h/.test(txtSede), "não associado: a resposta traz o horário da sede");
b.ok(/15 \(quinze\) dias úteis/.test(txtSede), "o prazo de 15 dias úteis");
b.ok(/associar/.test(txtSede), "e o convite para se associar");
const pNair = g.voucherPedidosDetalhe(pedidoDa(thNair).ID_PEDIDO, TOKEN);
b.ok(pNair.pendencias.some(p => /NÃO filiado/.test(p.texto)), "Nair: diz que está na base como NÃO filiada");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PEDIDOS POR E-MAIL · 2. Quem vê o quê");

b.passo("4. Sem o módulo Benefícios, nada");
b.bloqueia(() => g.voucherPedidosPainel("SECRETARIA", TOKEN_SEM), "o painel nega quem não tem Benefícios");
b.bloqueia(() => g.voucherPedidosValidarEnviar(pedidoDa(thAna).ID_PEDIDO, {}, {}, TOKEN_SEM),
  "validar nega quem não tem Benefícios");
b.bloqueia(() => g.voucherPedidosAnexo(pedidoDa(thAna).ID_PEDIDO, 1, TOKEN_SEM), "o anexo também");
b.bloqueia(() => g.voucherPedidosSalvarCampos(pedidoDa(thAna).ID_PEDIDO, { curso: "X" }, TOKEN_SEM), "editar campo também");
b.bloqueia(() => g.voucherPedidosResponder(pedidoDa(thBia).ID_PEDIDO, "COMPLEMENTO", "texto qualquer com mais de vinte letras", TOKEN_SEM),
  "responder também");
b.bloqueia(() => g.voucherPedidosLerAgora(TOKEN_SEM), "e ler a caixa também");
/* A recusa tem de vir ANTES de qualquer gravação. Mais adiante a criação da
   solicitação também exige o módulo — e por isso uma porta sem trava ainda
   "recusaria", mas depois de já ter gravado o que veio da tela. */
const dadosAntes = pedidoDa(thAna).DADOS_JSON;
g.voucherPedidosValidarEnviar(pedidoDa(thAna).ID_PEDIDO, { curso: "CURSO INVASOR" }, {}, TOKEN_SEM);
b.igual(pedidoDa(thAna).DADOS_JSON, dadosAntes, "a tentativa sem permissão não grava nada no pedido");

b.passo("5. A conta logada decide a caixa");
const pnSec = painel("FINANCEIRO", TOKEN_SEC);
b.igual(pnSec.caixa, "SECRETARIA", "a Secretaria pede o Financeiro e recebe a própria caixa");
b.igual(pnSec.caixas, ["SECRETARIA"], "e só enxerga a dela");
b.ok(!pnSec.itens.some(i => i.remetente === "x@exemplo.com"), "o pedido que chegou no financeiro@ não aparece para ela");
/* Um pedido de OUTRA caixa, posto direto na aba — a trava por caixa
   continua valendo para quando houver um leitor do Financeiro. */
const regFin = g.vpeGravar_({ ID_PEDIDO: "PED_OUTRA_CAIXA", THREAD_ID: "T_FIN", CAIXA: "FINANCEIRO",
  ESTADO: "PRONTO", REMETENTE_EMAIL: "x@exemplo.com", RECEBIDO_EM: new Date() });
const pnFin = painel("FINANCEIRO", TOKEN);
b.ok(pnFin.itens.some(i => i.id === "PED_OUTRA_CAIXA"), "o administrador alterna e vê a outra caixa");
b.bloqueia(() => g.voucherPedidosDetalhe(regFin.ID_PEDIDO, TOKEN_SEC).ok === false
  ? { ok: false, mensagem: "acesso: " + g.voucherPedidosDetalhe(regFin.ID_PEDIDO, TOKEN_SEC).mensagem } : {},
  "a Secretaria não abre pedido de outra caixa pelo ID");

b.passo("6. Os cards contam o que está na fila");
const pn = painel("SECRETARIA", TOKEN_SEC);
b.igual(pn.contagens.PRONTO, 1, "1 pronto para validar");
b.igual(pn.contagens.FALTA_DOC, 2, "2 com falta de documento");
b.igual(pn.contagens.NAO_ENCONTRADO, 2, "2 não encontrados");
b.igual(pn.contagens.PRECISA_VOCE, 5, "5 precisam de você (3 + os 2 do teste de ID, sem CPF)");
b.igual(pn.periodosAbertos, ["2026/2", "2027/1"], "semestres abertos em out/2026: 2026/2 e 2027/1");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PEDIDOS POR E-MAIL · 3. Validar e enviar");

b.passo("7. O pronto vira solicitação, certificado e resposta na mesma conversa");
const antes = amb.outbox.length;
const v1 = g.voucherPedidosValidarEnviar(pedidoDa(thAna).ID_PEDIDO, {}, {}, TOKEN_SEC);
b.ok(v1.ok, "validou", v1.mensagem);
b.ok(!amb.outbox.slice(antes).some(m => m.via === "reply"), "o SISGEP NÃO enviou nada: a resposta foi para a fila");
const filaAna = saida().filter(r => r.THREAD_ID === thAna.id);
b.igual(filaAna.length && filaAna[0].STATUS, "PENDENTE", "na fila da ponte, pendente");
b.ok(/em até 15 minutos/.test(v1.mensagem), "e a tela diz quando sai", v1.mensagem);
SIM.ciclo();
const prot = v1.protocolo;
const sol = (g.listarSolicitacoesCertBolsa(TOKEN) || []).find(x => x.protocolo === prot);
b.ok(sol, "a solicitação existe no módulo Voucher");
b.igual(sol && sol.status, "EMITIDO", "e já está EMITIDA");
const enviado = amb.outbox.slice(antes).find(m => m.via === "reply");
b.ok(enviado, "o leitor respondeu NA conversa da Ana");
b.igual(saida().filter(r => r.THREAD_ID === thAna.id)[0].STATUS, "ENVIADO", "e a fila marcou ENVIADO");
const itemAna = painel("SECRETARIA", TOKEN_SEC).itens.find(i => i.id === pedidoDa(thAna).ID_PEDIDO);
b.igual(itemAna && itemAna.envio && itemAna.envio.status, "ENVIADO", "o painel mostra que a resposta saiu");
b.igual(enviado && enviado.to, "ana@exemplo.com", "para quem pediu");
b.igual(enviado && enviado.from, "secretaria@sindeducacao.com", "saindo como a Secretaria (alias)");
b.ok(enviado && enviado.attachments && enviado.attachments.length === 1, "com o PDF anexo");
b.ok(enviado && /Marcelha/.test(enviado.htmlBody), "assinada pela Secretaria");
b.igual(pedidoDa(thAna).ESTADO, "CONCLUIDO", "o pedido sai da fila");
b.igual(pedidoDa(thAna).PROTOCOLO, prot, "amarrado ao protocolo");
const linhaSol = g.voucherLinhaPorProtocolo_(ss, g.VOUCHER_ABA_SOLICITACOES, prot);
b.igual(linhaSol.CANAL_ENTRADA, "EMAIL", "canal de entrada: EMAIL");
b.ok(/Pedido por e-mail/.test(linhaSol.OBSERVACOES), "a observação diz de onde veio");
b.ok(String(linhaSol.LINK_CONTRACHEQUE || "").length > 0, "o contracheque do e-mail foi guardado na solicitação");

b.passo("8. Clicar de novo não emite outro");
const v1b = g.voucherPedidosValidarEnviar(pedidoDa(thAna).ID_PEDIDO, {}, {}, TOKEN_SEC);
b.igual(v1b.ok, false, "pedido concluído recusa segunda validação");

b.passo("9. Um 'obrigado' depois não reabre o pedido");
responder(thAna, "ana@exemplo.com", "Muito obrigada!\n\nEm 10/10 SindEducação escreveu:\n> voucher em anexo");
const iaAntes = chamadasIA.length;
ler();
b.igual(pedidoDa(thAna).ESTADO, "CONCLUIDO", "continua concluído");
b.igual(chamadasIA.length, iaAntes, "e não chamou a IA para um agradecimento");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PEDIDOS POR E-MAIL · 4. Falta documento — o vai e volta");

b.passo("10. Pedir complemento responde na conversa e espera");
const pBia = g.voucherPedidosDetalhe(pedidoDa(thBia).ID_PEDIDO, TOKEN_SEC);
b.ok(/último contracheque/.test(pBia.respostaSugerida), "a resposta sugerida pede o contracheque");
b.ok(!/RG ou CNH/.test(pBia.respostaSugerida.split("Documentos necessários")[0]),
  "e não pede o que ela já mandou");
const c1 = g.voucherPedidosResponder(pedidoDa(thBia).ID_PEDIDO, "COMPLEMENTO", pBia.respostaSugerida, TOKEN_SEC);
b.ok(c1.ok, "pôs na fila", c1.mensagem);
SIM.ciclo();
b.ok(amb.outbox.some(m => m.via === "reply" && m.to === "bia@exemplo.com" && /contracheque/.test(m.htmlBody)),
  "e o leitor enviou o pedido de complemento à Bia");
b.igual(pedidoDa(thBia).ESTADO, "AGUARDANDO", "e o pedido fica aguardando a associada");

b.passo("11. Ela responde com o contracheque: o pedido é relido inteiro");
EXTRACOES.BIA = base({ titular: { nome: "Beatriz Lima Costa", cpf: CPF_BIA }, curso: "Enfermagem", area: "SAUDE",
  anexos: [RG(1, "BEATRIZ LIMA COSTA", CPF_BIA), Object.assign(CC("BEATRIZ LIMA COSTA", CPF_BIA, "09/2026", "ESCOLA BETA"), { indice: 2 })] });
responder(thBia, "bia@exemplo.com", "Segue o contracheque. CASO:BIA", [pdf("contracheque-set.pdf")]);
ler();
b.igual(pedidoDa(thBia).ESTADO, "PRONTO", "agora está PRONTO");
b.igual(chamadasIA[chamadasIA.length - 1].anexos, 2, "a releitura juntou os anexos das duas mensagens");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PEDIDOS POR E-MAIL · 5. Contracheque antigo, duplicidade e não associado");

b.passo("12. Contracheque de julho: você decide, com justificativa");
const thVelho = novaThread("voucher 2026/2", "ana@exemplo.com", "Voucher de Letras 2026/2. CASO:VELHO",
  [pdf("cc-julho.pdf"), pdf("rg.pdf")]);
ler();
b.igual(pedidoDa(thVelho).ESTADO, "FALTA_DOC", "contracheque de 07/2026 → falta documento");
const pVelho = g.voucherPedidosDetalhe(pedidoDa(thVelho).ID_PEDIDO, TOKEN_SEC);
b.ok(pVelho.pendencias.some(p => p.tipo === "AVISO" && /07\/2026/.test(p.texto)), "o aviso diz o mês do contracheque");
const semConf = g.voucherPedidosValidarEnviar(pedidoDa(thVelho).ID_PEDIDO, {}, {}, TOKEN_SEC);
b.igual(semConf.precisaConfirmar, true, "validar sem confirmar pede confirmação");
const semJust = g.voucherPedidosValidarEnviar(pedidoDa(thVelho).ID_PEDIDO, {}, { forcar: true }, TOKEN_SEC);
b.igual(semJust.ok, false, "confirmar sem justificativa não passa");
const comJust = g.voucherPedidosValidarEnviar(pedidoDa(thVelho).ID_PEDIDO, {},
  { forcar: true, justificativa: "escola atrasou o contracheque de setembro" }, TOKEN_SEC);
b.ok(comJust.ok, "com justificativa, emite", comJust.mensagem);
const lVelho = g.voucherLinhaPorProtocolo_(ss, g.VOUCHER_ABA_SOLICITACOES, comJust.protocolo);
b.ok(/escola atrasou/.test(lVelho.OBSERVACOES), "e a justificativa fica na solicitação");

b.passo("13. Mesmo semestre de novo: a trava de duplicidade do Voucher vale aqui também");
const thDup = novaThread("voucher de novo", "ana@exemplo.com", "Outro voucher 2026/2. CASO:VELHO2",
  [pdf("cc.pdf"), pdf("rg.pdf")]);
EXTRACOES.VELHO2 = Object.assign({}, EXTRACOES.VELHO, { anexos: [CC("ANA MARIA SOUZA", CPF_ANA, "10/2026", "COLEGIO ALFA"), RG(2, "ANA MARIA SOUZA", CPF_ANA)] });
ler();
const dup = g.voucherPedidosValidarEnviar(pedidoDa(thDup).ID_PEDIDO, {}, {}, TOKEN_SEC);
b.igual(dup.ok, false, "não cria a segunda");
b.igual(dup.duplicado, true, "recusada como duplicata");
b.ok(String(pedidoDa(thDup).ERRO).length > 0, "e o motivo fica no pedido", pedidoDa(thDup).ERRO);

b.passo("14. Não associado: validar é recusado; encaminhar à sede, não");
const naoVal = g.voucherPedidosValidarEnviar(pedidoDa(thFora).ID_PEDIDO, {}, { forcar: true, justificativa: "xxxxx" }, TOKEN_SEC);
b.igual(naoVal.ok, false, "não emite para quem não está na relação");
const sede = g.voucherPedidosResponder(pedidoDa(thFora).ID_PEDIDO, "SEDE", txtSede, TOKEN_SEC);
b.ok(sede.ok, "encaminhou à sede", sede.mensagem);
SIM.ciclo();
b.ok(amb.outbox.some(m => m.via === "reply" && m.to === "fulano@exemplo.com" && /9h às 10h/.test(m.htmlBody)),
  "e a orientação para a sede saiu para o Fulano");
b.igual(pedidoDa(thFora).ESTADO, "CONCLUIDO", "e o pedido sai da fila");
b.igual(pedidoDa(thFora).ACAO, "ENCAMINHADO_SEDE", "com a ação registrada");

b.passo("15. Acabou de se filiar: a secretaria confirma e segue");
const conf = g.voucherPedidosConfirmarAssociado(pedidoDa(thNair).ID_PEDIDO, TOKEN_SEC);
b.ok(conf.ok, "confirmou", conf.mensagem);
b.igual(pedidoDa(thNair).ESTADO, "PRONTO", "e o pedido vira PRONTO");
b.ok(/secretaria@sindeducacao.com/.test(pedidoDa(thNair).ASSOCIADO_CONFIRMADO_POR), "com quem confirmou gravado");

b.passo("16. Edição de campo mostra que foi editado");
const ed = g.voucherPedidosSalvarCampos(pedidoDa(thNair).ID_PEDIDO, { curso: "Psicologia" }, TOKEN_SEC);
b.igual(ed.campos.curso.valor, "Psicologia", "o curso editado vale");
b.ok(/editado por/.test(ed.campos.curso.origem), "e a origem diz que foi editado", ed.campos.curso.origem);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PEDIDOS POR E-MAIL · 6. Homologação e gatilho");

b.passo("17. Em homologação, só se responde para a Secretaria");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual(true);
const envAntes = amb.outbox.length;
const hml = g.voucherPedidosResponder(pedidoDa(thEnteado).ID_PEDIDO, "COMPLEMENTO",
  "Olá! Falta o comprovante de dependente no Imposto de Renda do enteado.", TOKEN_SEC);
b.igual(hml.ok, false, "resposta para associado real é bloqueada");
b.ok(/\[HML\]/.test(hml.mensagem), "com a mensagem de homologação", hml.mensagem);
b.igual(amb.outbox.length, envAntes, "e nada saiu");
b.ok(!saida().some(r => r.THREAD_ID === thEnteado.id), "nem entrou na fila");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "producao");
g.getAmbienteAtual(true);

b.passo("17b. Sem ponte, o SISGEP avisa e não lê nada");
g.PropertiesService.getScriptProperties().setProperty("VOUCHER_PEDIDOS_PONTE_ID", "DESLIGADA");
const semPonte = g.voucherPedidosLerAgora(TOKEN);
b.igual(semPonte.ok, false, "a leitura recusa");
b.ok(/ponte/i.test(semPonte.mensagem), "dizendo que falta a ponte", semPonte.mensagem);
b.igual(painel("SECRETARIA", TOKEN_SEC).ponteConfigurada, false, "e o painel mostra o aviso");
g.PropertiesService.getScriptProperties().setProperty("VOUCHER_PEDIDOS_PONTE_ID", SIM.PONTE_ID);
b.ok(g.VPE_PONTE_ID_PADRAO.length > 30, "sem propriedade nenhuma, vale a ponte criada em 21/10 na conta da Secretaria");

b.passo("18. O gatilho instala uma vez só");
b.bloqueia(() => g.instalarGatilhoVoucherPedidosEmail(TOKEN_SEC), "quem não é administrador não instala gatilho");
const t1 = g.instalarGatilhoVoucherPedidosEmail(TOKEN);
b.ok(/instalado/i.test(t1), "instala", t1);
b.igual(amb.triggers.filter(t => t.fn === "voucherPedidosLerCaixaAgendado").length, 1, "um gatilho, de 15 em 15 minutos");
b.igual((amb.triggers.find(t => t.fn === "voucherPedidosLerCaixaAgendado") || { detalhe: {} }).detalhe.minutos, 15, "a cada 15 minutos");

b.passo("19. O leitor não responde fora de um pedido, nem anexa o que não é PDF");
/* A fila é escrita pela conta do SISGEP. Se ela pudesse mandar qualquer
   coisa, quem tem acesso à ponte usaria a conta da Secretaria para escrever
   a qualquer pessoa. O leitor só responde em conversa que ele mesmo copiou
   como pedido, e só como reply — para quem escreveu. */
const envioAntes = amb.outbox.length;
const filaCrua = SIM.aba("Saida");
g.vpeGravar_({ ID: "ENV_INVASOR", THREAD_ID: thAdm.id, MENSAGEM_ID: thAdm.msgs[0].getId(),
  HTML: "<p>oi</p>", STATUS: "PENDENTE", CRIADO_EM: new Date() }, filaCrua);
const naoPdf = g.DriveApp.createFile(g.Utilities.newBlob("x", "text/plain", "planilha.txt"));
g.vpeGravar_({ ID: "ENV_NAO_PDF", THREAD_ID: thNair.id, MENSAGEM_ID: pedidoDa(thNair).ULTIMA_MENSAGEM_ID,
  HTML: "<p>oi</p>", ANEXOS_FILE_IDS: naoPdf.getId(), STATUS: "PENDENTE", CRIADO_EM: new Date() }, filaCrua);
SIM.ciclo();
b.igual(saida().find(r => r.ID === "ENV_INVASOR").STATUS, "RECUSADO", "resposta numa conversa que não é pedido: recusada");
b.igual(saida().find(r => r.ID === "ENV_NAO_PDF").STATUS, "ERRO", "anexo que não é PDF: não sai");
b.igual(amb.outbox.length, envioAntes, "e nenhum dos dois saiu");

b.passo("20. O leitor não vai no deploy do SISGEP");
/* No push do SISGEP ele rodaria na conta do Financeiro e leria a caixa
   errada. Duas travas, como nos fixtures de produção. */
const fsT = require("fs"), pathT = require("path");
const pastaLeitor = pathT.resolve(__dirname, "..", "..", "leitor-secretaria");
b.igual(fsT.readdirSync(pastaLeitor).filter(f => /\.(gs|html)$|^appsscript\.json$/.test(f)), [],
  "nenhum .gs, .html ou appsscript.json na pasta do leitor (só .txt)");
b.ok(/^leitor-secretaria\/\*\*$/m.test(fsT.readFileSync(pathT.resolve(__dirname, "..", "..", ".claspignore"), "utf8")),
  "e a pasta está no .claspignore");

b.passo("21. Nenhum e-mail foi mexido na caixa, e o SISGEP nunca abriu uma");
b.igual(tocadas.length, 0, "nem lido, nem arquivado");
b.igual(SIM.tentativasSisgep, [], "nenhuma chamada do SISGEP ao GmailApp");

b.naoTestavel("a IA real lendo contracheque escaneado", "a IA está simulada aqui — testar no ar com pedidos reais");
b.naoTestavel("o leitor rodando na conta da Secretaria e saindo como secretaria@",
  "projeto Apps Script separado — instalar com o README de leitor-secretaria/ e testar no ar");
b.naoTestavel("o PDF de verdade anexado e a entrega do e-mail", "o emulador registra a chamada, não entrega");
b.naoTestavel("a tela no navegador", "o painel é HTML — roteiro manual");
b.resumo();
