/**
 * t111 — MÓDULO 02 · SOFIA · O QUE SAI DAQUI PARA A ANTHROPIC
 *
 * Auditoria do Módulo 02, 31/08/2026. Esta é a pergunta de LGPD do módulo, e
 * é a que um relatório de IA alegou ter respondido sem ter lido uma linha do
 * código. Aqui ela é respondida por execução.
 *
 * O QUE FOI APURADO, sem alarme e sem eufemismo:
 *
 * 1. O CHAT (chatSISGEP → api.anthropic.com)
 *    Quando alguém pergunta por uma pessoa ("buscar", "associado", um nome),
 *    o contexto monta `associadoBuscado` e ele ENTRA no system prompt.
 *    Vão: nome, escola, status da mensalidade, dias sem confirmação, número e
 *    data do ofício, e observações truncadas em 100 caracteres. No máximo 5
 *    pessoas por pergunta.
 *    NÃO vão: CPF, telefone, endereço, e-mail pessoal — embora a planilha de
 *    origem (Mensalidade_Controle) TENHA a coluna de CPF, na posição 2.
 *    Isso é contenção deliberada, e é ela que este teste guarda.
 *
 * 2. O OCR (analisar*IA)
 *    O reconhecimento roda DENTRO do Google (Drive.Files.insert com ocr:true)
 *    e o arquivo temporário é apagado num `finally` — isto está certo. Mas o
 *    TEXTO EXTRAÍDO segue inteiro para a Anthropic, e o formulário de
 *    sindicalização tem Identificação, Endereço Residencial e Contatos.
 *    Isso é a FUNÇÃO, não um defeito: sem mandar o documento não há o que
 *    extrair. O que a LGPD pede aí não é código, é base legal e contrato de
 *    operador — decisão de gestão, não de engenharia. Fica declarado.
 *
 * POR QUE O QUE VAI JÁ É SENSÍVEL
 *
 * Nome + escola + status "DESFILIADO" é filiação sindical de pessoa
 * identificada. A LGPD (Lei 13.709, art. 5º, II) lista filiação a sindicato
 * como DADO PESSOAL SENSÍVEL, na mesma linha de convicção religiosa e opinião
 * política. Não é o CPF que torna isso sensível — é o vínculo.
 *
 * Este teste não julga se deve ir. Ele fixa o que vai HOJE, para que
 * qualquer ampliação seja uma decisão e não um acidente.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");

const CPF_NA_BASE = "52998224725";
const CPF_FORMATADO = "529.982.247-25";

/* A base de origem tem CPF na coluna 2 — de propósito neste teste, para que
   "o CPF não aparece no prompt" signifique alguma coisa. Se a planilha não
   tivesse o dado, o teste passaria por ausência e não por contenção. */
(function seedMensalidade() {
  const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
  let aba = ss.getSheetByName(g.ABA_MENSALIDADE);
  if (!aba) aba = ss.insertSheet(g.ABA_MENSALIDADE);
  const cab = ["NOME", "CPF", "ESCOLA", "FILIADO", "NUMERO_OFICIO",
               "DATA_OFICIO", "STATUS", "DATA_ULTIMA_COB", "OBSERVACOES"];
  aba.getRange(1, 1, 1, cab.length).setValues([cab]);
  aba.getRange(2, 1, 1, cab.length).setValues([[
    "JOANA PEREIRA DOS SANTOS", CPF_FORMATADO, "Escola Municipal Teste", "S",
    "OF-2026-000123", "10/08/2026", "PENDENTE_30D", "", "Contato por WhatsApp"
  ]]);
})();

b.fluxo("MÓDULO 02 · SOFIA — o que sai para a API externa");

b.passo("1. a base de origem tem CPF (senão o teste não prova nada)");
const daBase = g.listarMensalidadeStatus({ nome: "JOANA" });
b.ok(
  daBase && daBase.ok && daBase.itens && daBase.itens.length === 1,
  "a pessoa está na base e é encontrável pelo nome",
  JSON.stringify((daBase.itens || []).map(i => i.nome))
);

b.passo("1b. ACHADO — a extração do nome quebra na frase natural");
/* extrairTermoNome_ devolve TUDO que vem depois do primeiro padrão que casar,
   inclusive outras palavras-gatilho. "buscar associado Fulano" — que é como
   uma pessoa pergunta — vira o termo "associado fulano" e não acha ninguém.
   Só "buscar Fulano" funciona. Achado da auditoria do Módulo 02; a correção
   depende de aprovação, então aqui fica registrado, não corrigido. */
const termoNatural = g.extrairTermoNome_("buscar associado joana pereira");
const termoSimples = g.extrairTermoNome_("buscar joana pereira");
b.ok(termoSimples === "joana pereira", "a forma simples extrai o nome certo", termoSimples);
if (termoNatural === "joana pereira") {
  b.ok(true, "a forma natural também extrai o nome certo", termoNatural);
} else {
  b.aviso(
    "a forma natural 'buscar associado Fulano' NÃO extrai o nome",
    "devolveu " + JSON.stringify(termoNatural) + " — a busca não encontra ninguém, " +
    "e a SOFIA responde que não localizou registros"
  );
}

b.passo("2. o prompt que iria para a Anthropic");
/* Usa a frase que FUNCIONA — o objetivo deste passo é medir o que sai quando
   a busca acontece, não repetir o defeito do passo anterior. */
const PERGUNTA = "buscar joana pereira";
const contexto = g.coletarContextoSISGEP_(PERGUNTA, "Geral");
const prompt = g.montarSystemPrompt_(contexto, PERGUNTA);

b.ok(
  prompt.indexOf("JOANA PEREIRA") >= 0,
  "o nome da pessoa VAI no prompt — é assim que a busca funciona",
  "encontrado no system prompt"
);

b.passo("3. a contenção: o CPF fica para trás");
/* GUARDA DE REGRESSÃO. O mapeamento de `associadoBuscado` escolhe campo a
   campo, e CPF não está na lista. Se alguém acrescentar `cpf: i.cpf` num
   refactor bem-intencionado, o dado passa a sair do sindicato sem que
   ninguém decida isso — e é este teste que avisa. */
b.ok(
  prompt.indexOf(CPF_NA_BASE) === -1 && prompt.indexOf(CPF_FORMATADO) === -1,
  "o CPF NÃO vai no prompt, embora esteja na base",
  prompt.indexOf(CPF_NA_BASE) >= 0 || prompt.indexOf(CPF_FORMATADO) >= 0
    ? "CPF ENCONTRADO no prompt — dado pessoal saindo para a API externa"
    : "contido"
);

b.passo("4. o que efetivamente vai, campo a campo");
const vai = ["escola", "status", "ofício"].filter(function (rotulo) {
  return prompt.toLowerCase().indexOf(rotulo) >= 0;
});
b.ok(vai.length >= 2, "vão escola, status e ofício junto do nome", vai.join(", "));

b.ok(
  prompt.indexOf("Contato por WhatsApp") >= 0,
  "as observações também vão — texto livre, truncado em 100 caracteres",
  "é o campo de conteúdo imprevisível do conjunto: guarda o que alguém digitou"
);

b.passo("5. o teto de pessoas por pergunta");
b.ok(
  /slice\(0,\s*5\)/.test(String(g.coletarContextoSISGEP_)),
  "o contexto limita a 5 pessoas por pergunta",
  "slice(0, 5) no mapeamento de associadoBuscado"
);

/* ─── o que este harness não alcança ─── */
b.naoTestavel(
  "o conteúdo real enviado à Anthropic",
  "o emulador registra UrlFetchApp, não executa. O que se prova aqui é o " +
  "PROMPT MONTADO, que é o que seria enviado"
);
b.naoTestavel(
  "base legal e contrato de operador para o envio a terceiro",
  "o OCR fica no Google, mas o texto extraído do formulário de sindicalização " +
  "— com Identificação, Endereço e Contatos — vai inteiro para a Anthropic. " +
  "Isso é a função da tela, não um defeito de código: o que a LGPD pede aí é " +
  "decisão de gestão (base legal, aviso ao titular, contrato), não asserção"
);

b.resumo();
