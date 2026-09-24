/** TESTE PONTA A PONTA — segunda etapa do China Park: coleta de hóspedes */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_FIN = b.logar(g, "rogerio");           // sem módulo Benefícios

// Datas do formulário são datas civis (AAAA-MM-DD), não instantes UTC.
// Usar toISOString() aqui fazia o teste mudar de dia conforme o fuso do runner.
const dataCivil = d => {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};
const dias = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dataCivil(d);
};

function criarReserva(cpf, pessoas, diasEntrada, diasSaida) {
  const r = g.solicitarReservaParqueChina({
    nomeSolicitante: "Maria Aparecida Souza", cpf: cpf,
    telefone: "(27) 99999-1234", email: "maria@exemplo.com", escola: "Escola Modelo",
    chaleSolicitado: "QUALQUER_DISPONIVEL",
    dataEntrada: dias(diasEntrada === undefined ? 10 : diasEntrada),
    dataSaida: dias(diasSaida === undefined ? 12 : diasSaida),
    tipoReserva: "FIM_DE_SEMANA", quantidadePessoas: String(pessoas), solicitouColchaoExtra: "NAO"
  });
  if (!r.ok) throw new Error("falhou criar reserva: " + r.mensagem + " " + JSON.stringify(r.erros || []));
  return r.idReserva;
}

b.fluxo("CHINA PARK · 2ª etapa — solicitante informa os hóspedes");

const ID = criarReserva("111.444.777-35", 4);

b.passo("1. Link só sai depois da aprovação");
const cedo = g.pcHospedesPrepararLink(ID, TOKEN);
b.ok(cedo && cedo.ok === false, "reserva PENDENTE não gera link de hóspedes", cedo.mensagem);

g.aprovarReservaParqueChina(ID, { suiteDefinida: "501" }, TOKEN);

b.passo("2. Gerar o link com a reserva aprovada");
const link = g.pcHospedesPrepararLink(ID, TOKEN);
b.ok(link && link.ok, "gera o link", link && !link.ok ? "ERRO: " + link.mensagem : "");
b.ok(link.url && link.url.indexOf("?portal=chinapark-hospedes&t=") > 0, "URL usa a rota nova", link.url);
b.ok(link.url.indexOf(ID) === -1, "o ID da reserva NÃO aparece na URL — o token substitui");
b.ok(link.texto.indexOf("501") > 0 && link.texto.indexOf(ID) > 0, "a mensagem traz chalé e protocolo");

const T = link.url.split("&t=")[1];

b.passo("3. A rota existe em Code.gs");
const code = require("fs").readFileSync(require("path").resolve(__dirname, "..", "..", "Code.gs"), "utf8");
b.ok(code.indexOf('p.portal === "chinapark-hospedes"') > 0, "Code.gs atende a rota chinapark-hospedes");

b.passo("4. O solicitante abre o link (sem login)");
const tela = g.pcHospedesCarregar(T);
b.ok(tela && tela.ok, "carrega a reserva pelo token", tela && !tela.ok ? "ERRO: " + tela.mensagem : "");
b.ok(tela.protocolo === ID && tela.chale === "501", "mostra protocolo e chalé certos");
b.ok(tela.vagasAcompanhantes === 3, "4 pessoas = titular + 3 acompanhantes", "vagas: " + tela.vagasAcompanhantes);
b.ok(typeof tela.valorTotal === "undefined" && typeof tela.cpf === "undefined",
  "a tela pública NÃO recebe valor nem CPF");

b.passo("5. Token de outra reserva não abre esta");
const ID2 = criarReserva("529.982.247-25", 2);
g.aprovarReservaParqueChina(ID2, { suiteDefinida: "502" }, TOKEN);
const T2 = g.pcHospedesPrepararLink(ID2, TOKEN).url.split("&t=")[1];
b.ok(T !== T2, "cada reserva tem token próprio");
b.ok(g.pcHospedesCarregar(T2).protocolo === ID2, "o token da segunda abre a segunda, não a primeira");

b.passo("6. Token inventado");
const falso = g.pcHospedesCarregar("token-que-eu-inventei-agora");
b.ok(falso && falso.ok === false, "token inválido é recusado", falso.mensagem);

b.passo("7. Gravar a lista de hóspedes");
const salvo = g.pcHospedesSalvar(T, { acompanhantes: ["João Pedro Souza", "Ana Clara Souza"], aceiteTermo: true });
b.ok(salvo && salvo.ok && salvo.total === 2, "grava 2 acompanhantes",
  salvo && !salvo.ok ? "ERRO: " + salvo.mensagem : salvo.mensagem);

const dep = g.mapearLinhaParaObjetoParqueChina_(g.buscarReservaParqueChinaPorId_(ID).valores);
b.ok(dep.dependente1 === "João Pedro Souza" && dep.dependente2 === "Ana Clara Souza",
  "os nomes caem nas colunas de dependente que o ofício de autorização lê",
  dep.dependente1 + " / " + dep.dependente2);

b.passo("8. Reenviar corrige a lista, sem duplicar");
const corrigido = g.pcHospedesSalvar(T, { acompanhantes: ["João Pedro Souza Filho"], aceiteTermo: true });
const dep2 = g.mapearLinhaParaObjetoParqueChina_(g.buscarReservaParqueChinaPorId_(ID).valores);
b.ok(corrigido.ok && dep2.dependente1 === "João Pedro Souza Filho" && !dep2.dependente2,
  "lista nova substitui a anterior por inteiro", dep2.dependente1 + " | resto: " + (dep2.dependente2 || "(vazio)"));

b.passo("9. Mais acompanhantes do que a reserva comporta");
const demais = g.pcHospedesSalvar(T, { acompanhantes: ["Um Nome", "Dois Nome", "Tres Nome", "Quatro Nome"], aceiteTermo: true });
b.ok(demais && demais.ok === false, "recusa acima da quantidade de pessoas da reserva", demais.mensagem);

b.passo("10. Nome incompleto");
const curto = g.pcHospedesSalvar(T, { acompanhantes: ["Zé"], aceiteTermo: true });
b.ok(curto && curto.ok === false, "exige nome e sobrenome", curto.mensagem);

b.passo("10b. Termo é obrigatório");
const semTermo = g.pcHospedesSalvar(T, { acompanhantes: ["Fulano De Tal"] });
b.ok(semTermo && semTermo.ok === false, "sem aceitar o termo não grava", semTermo.mensagem);

b.passo("10c. Prazo — confirmação até 24h antes da entrada");
b.ok(tela.prazoVencido === false, "reserva para daqui a 10 dias está dentro do prazo");
b.ok(!!tela.prazoLimite && tela.horasAntecedencia === 24, "a tela recebe o limite e as horas", tela.prazoLimite);
b.ok(!!tela.termo && tela.termo.indexOf("não será devolvido") > 0, "a tela recebe o texto do termo");

// Reserva que entra AMANHÃ: o limite (24h antes) já passou.
const ID3 = criarReserva("111.444.777-35", 2, 1, 3);
g.aprovarReservaParqueChina(ID3, { suiteDefinida: "503" }, TOKEN);
const T3 = g.pcHospedesPrepararLink(ID3, TOKEN).url.split("&t=")[1];
const tela3 = g.pcHospedesCarregar(T3);
b.ok(tela3.ok && tela3.prazoVencido === true, "entrada amanhã: prazo já vencido", "limite era " + tela3.prazoLimite);
const tarde = g.pcHospedesSalvar(T3, { acompanhantes: ["Fulano De Tal"], aceiteTermo: true });
b.ok(tarde && tarde.ok === false && tarde.prazoVencido === true,
  "depois do prazo o link não grava mais", tarde.mensagem);

b.passo("11. Auditoria");
const aud = g.SpreadsheetApp.openById(g.PLANILHA_ID).getSheetByName("HistoricoParqueChina");
const linhas = aud ? aud.getRange(2, 1, aud.getLastRow() - 1, aud.getLastColumn()).getValues() : [];
const evt = linhas.filter(l => l.join("|").indexOf("HOSPEDES_INFORMADOS") >= 0);
b.ok(evt.length >= 2, "cada envio da lista vira um evento na trilha", evt.length + " eventos");
const aceites = linhas.filter(l => l.join("|").indexOf("TERMO_ACEITO") >= 0);
b.ok(aceites.length >= 2, "o aceite do termo também vira evento, com o texto aceito",
  aceites.length + " aceites registrados");

b.passo("12. Cancelar a reserva fecha o link");
g.cancelarReservaParqueChina(ID, "teste", TOKEN);
const depoisCancelar = g.pcHospedesSalvar(T, { acompanhantes: ["Outro Nome"], aceiteTermo: true });
b.ok(depoisCancelar && depoisCancelar.ok === false, "reserva cancelada não aceita mais hóspedes", depoisCancelar.mensagem);

b.passo("13. Permissão para gerar o link");
const negado = g.pcHospedesPrepararLink(ID2, TOKEN_FIN);
b.ok(negado && negado.ok === false, "quem não tem o módulo Benefícios não gera link", negado.mensagem);

b.naoTestavel("PDF do ofício de autorização com os nomes coletados", "depende de template do Google Docs");

b.resumo();
