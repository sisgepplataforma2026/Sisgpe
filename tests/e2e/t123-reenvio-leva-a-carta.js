/**
 * t123 — MÓDULO 03 · O REENVIO TEM DE LEVAR O OFÍCIO **E** A CARTA
 *
 * Pedido do usuário em 01/09/2026, com o caso real junto: *"tem escolas
 * reclamando que não estão recebendo os ofícios, e quando reenvio não está
 * anexando os dois arquivos (ofício gerado e a carta)"*.
 *
 * O QUE ACONTECIA
 *
 * O reenvio reconstrói o pacote a partir do `ANEXOS_JSON` da linha da fila —
 * e ali a carta está, o `t55` prova isso na emissão. Mas quando a linha da
 * fila **não existe mais** (ofício antigo, emitido antes da fila; ou linha já
 * limpa), o reenvio montava só o PDF do ofício.
 *
 * E o corpo do e-mail de oposição e de desfiliação AFIRMA a carta em anexo.
 * Então a escola recebia uma ordem para não descontar sem a prova de que
 * alguém se opôs — exatamente o dano que o `t55` foi escrito para impedir na
 * emissão, reaparecendo no reenvio.
 *
 * Havia resgate para a FICHA (coluna `Link Ficha`). Para a carta, nenhum:
 * não existe coluna "Link Carta" no Controle.
 *
 * POR QUE DAVA PARA CONSERTAR
 *
 * O arquivo continua no Drive. A emissão o salva na subpasta do ano com nome
 * determinístico — `Fichas_<TIPO>_<ESCOLA>_<DATA>.pdf` (`Oficios.gs:795-812`).
 * Escola e data estão no próprio nome do arquivo, então dá para achar.
 *
 * A TRAVA QUE ESTE TESTE MAIS GUARDA
 *
 * Só entra arquivo cujo nome contenha o token da escola, normalizado
 * EXATAMENTE como a emissão normaliza. **Anexar a carta da escola errada
 * seria pior que não anexar nenhuma** — mandaria documento de um terceiro
 * para quem não deveria vê-lo. É o passo 4.
 */

const b = require("./base");
const { g } = b.subir({});

b.fluxo("MÓDULO 03 · o token da escola é o que separa uma carta da outra");

b.passo("1. normaliza igual à emissão");
/* Se as duas normalizações divergirem, o resgate não acha nada — e falha em
   silêncio, que é o pior jeito de falhar aqui. */
b.igual(g.tokenEscolaArquivo_("Multivix Cariacica - Ensino, Pesquisa e Extensão Ltda"),
  "MULTIVIX_CARIACICA_ENSINO_PESQUISA_E_EXTENSAO",
  "maiúscula, sem acento, sem pontuação, espaços viram _ e corta em 45");
b.igual(g.tokenEscolaArquivo_("Escola da Ilha Ltda"), "ESCOLA_DA_ILHA_LTDA", "caso simples");
b.igual(g.tokenEscolaArquivo_(""), "ESCOLA", "vazio cai no genérico");

b.passo("2. o token bate com o nome que a emissão dá ao arquivo");
/* A emissão monta "Fichas_<TIPO>_<ESCOLA>_<DATA>.pdf" com a MESMA expressão.
   Este passo liga as duas pontas: o que se procura é o que foi gravado. */
const nomeGravado = "Fichas_OPOSICAO_FUNDACAO_DE_ASSISTENCIA_E_EDUCACAO_FAESA_07-05-2026.pdf";
const token = g.tokenEscolaArquivo_("Fundação de Assistência e Educação - FAESA");
b.ok(nomeGravado.indexOf(token) >= 0,
  "o token achado no nome do arquivo real", token);

b.passo("3. A TRAVA — carta de outra escola NÃO casa");
/* O risco de um resgate por busca é anexar o documento de um terceiro. */
const tokenFaesa = g.tokenEscolaArquivo_("Fundação de Assistência e Educação - FAESA");
const deOutra = "Fichas_OPOSICAO_ESCOLA_DA_ILHA_LTDA_07-05-2026.pdf";
b.ok(deOutra.indexOf(tokenFaesa) === -1,
  "o arquivo da Escola da Ilha não casa com o token da FAESA",
  "anexar carta de outra escola seria pior que não anexar nenhuma");

b.passo("4. e escolas de nome parecido não se confundem");
const t1 = g.tokenEscolaArquivo_("Multivix Cariacica");
const t2 = g.tokenEscolaArquivo_("Multivix Cachoeiro");
b.ok(t1 !== t2, "Cariacica e Cachoeiro geram tokens diferentes", t1 + " ≠ " + t2);
b.ok(("Fichas_FILIACAO_" + t2 + "_01-09-2026.pdf").indexOf(t1) === -1,
  "e o arquivo de uma não casa com o token da outra");

b.fluxo("MÓDULO 03 · o reenvio sabe se reconstruiu o pacote original");

b.passo("5. a reconstrução passou a REPORTAR, não só devolver a lista");
/* Antes devolvia só a lista, e a lista nunca vinha vazia porque o PDF do
   ofício era acrescentado antes da busca. Quem chamava não tinha como
   distinguir "reconstruí tudo" de "só achei o ofício" — e o
   `if (!anexos.length)` do reenvio era código morto. */
const fonteObter = String(g.obterAnexosOriginaisFilaOficio_).replace(/\s+/g, " ");
b.ok(/return \{ blobs:/.test(fonteObter),
  "devolve { blobs, reconstruido, achadosNaFila }");
b.ok(/reconstruido = true/.test(fonteObter),
  "e marca reconstruido só quando achou a lista na fila");

b.passo("6. o reenvio só vai ao Drive quando NÃO reconstruiu");
/* Buscar no Drive em todo reenvio seria lento e desnecessário: quando a fila
   tem a lista, ela é a verdade — inclusive sobre quais arquivos eram. */
/* MUDOU DE LUGAR EM 03/09/2026, e a asserção seguiu junto. O ajuntamento de
   anexos saiu de dentro do `reenviarOficio` e virou `reunirAnexosReenvioOficio_`,
   compartilhada com a PRÉVIA do modal — se fossem duas cópias, a prévia
   mentiria no dia em que divergissem. A regra medida aqui é a mesma de antes:
   o resgate no Drive é exceção, e só roda quando a fila não reconstruiu. */
const fonteReuniao = String(g.reunirAnexosReenvioOficio_).replace(/\s+/g, " ");
b.ok(/if \(!pacote\.reconstruido\) \{ try \{ recuperarAnexosDaPastaDrive_/.test(fonteReuniao),
  "o resgate é o caminho de exceção, não o normal");
b.ok(/dataEnvio/.test(fonteReuniao),
  "e leva a data do envio, que é o que identifica o lote daquele dia");
b.ok(String(g.reenviarOficio).indexOf("reunirAnexosReenvioOficio_") > -1,
  "e o envio passou a chamar a função compartilhada",
  "a prévia do modal chama a MESMA — prévia que mente é pior que não ter prévia");

b.passo("7. o resgate procura em TODAS as pastas de ano");
/* Ofício de 2025 reenviado em 2026 tem o arquivo na pasta de 2025. Olhar só
   a do ano corrente não acharia nada, e falharia calado. */
const fonteResgate = String(g.recuperarAnexosDaPastaDrive_).replace(/\s+/g, " ");
b.ok(/getFolders\(\)/.test(fonteResgate),
  "varre as subpastas, não só a raiz do tipo");
b.ok(/\^Fichas\?_/.test(fonteResgate),
  "e só considera arquivo de ficha/carta, não o PDF do ofício nem outros");

b.passo("8. a resposta ao operador diz de onde vieram os anexos");
/* "Anexos: 1" num tipo que promete carta é o sinal de que algo faltou. Antes
   a mensagem não distinguia origem nenhuma. */
const fonteReenvio = String(g.reenviarOficio).replace(/\s+/g, " ");
b.ok(/pacote original da fila/.test(fonteReenvio) &&
     /recuperados do Drive/.test(fonteReenvio),
  "a mensagem separa pacote da fila de resgate no Drive",
  "quem reenvia precisa saber se foi o pacote original ou uma reconstrução");

b.naoTestavel(
  "o resgate encontrando o arquivo real no Drive",
  "o emulador registra DriveApp, não navega em pasta de verdade. O que se " +
  "prova aqui é a REGRA de casamento — o token da escola, o filtro de nome e " +
  "a busca em todas as pastas de ano. Conferir no ar reenviando um ofício " +
  "antigo de oposição e vendo se a carta vai junto"
);
b.naoTestavel(
  "quantos ofícios antigos estão sem ANEXOS_JSON na fila",
  "é o tamanho real do problema, e só a planilha de produção responde"
);

b.resumo();
