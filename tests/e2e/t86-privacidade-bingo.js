/**
 * O CPF NÃO PODE SER CHAVE DE UMA LISTA DE CONTATOS
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. De manhã, o `compasso_inscricaoPreencher` foi fechado: rota
 * pública que devolvia nome, e-mail e telefone a partir de um CPF. À tarde, a
 * análise do módulo Eventos mostrou que `bingo_inscricaoPreencher` tinha o
 * MESMO defeito, ainda aberto.
 *
 * Duas telas públicas, o mesmo risco, e a correção existindo em uma só. Com
 * uma lista de CPFs — que não é difícil de obter — alguém montava a lista de
 * contatos dos 8.000 associados pelo link público do bingo.
 *
 * POR QUE UMA CAMADA COMUM, E NÃO COPIAR A CORREÇÃO
 *
 * Decisão do usuário. Regra de segurança duplicada é regra que diverge: a
 * primeira vez que alguém ajustar a máscara, ajusta num arquivo só, e a outra
 * tela silenciosamente passa a mostrar mais. `PrivacidadeCore.gs` é a única
 * implementação; Compasso e Bingo delegam.
 *
 * A ARMADILHA QUE ESTE TESTE EXISTE PARA GUARDAR
 *
 * Mascarar é a parte fácil. O difícil é o caminho de volta: quem não mexe no
 * campo manda a MÁSCARA de volta ao servidor, e ela não pode virar dado
 * gravado. E a máscara engana as validações de um jeito traiçoeiro:
 *
 *   - "m••••a@gmail.com" PASSA num teste de e-mail comum, porque • não é @
 *     nem espaço. O brinde iria para um endereço inexistente e ninguém
 *     perceberia até o dia do sorteio;
 *   - "(27) •••••-5432" vira "275432" ao tirar não-dígitos, e a pessoa
 *     receberia "informe o WhatsApp com DDD" sobre um número que não digitou.
 *
 * Por isso as asserções centrais aqui EXECUTAM `bingo_inscrever` com a
 * máscara vinda de volta, e conferem o que foi GRAVADO.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. o preencher voltar a devolver contato cru ............... 2 falhas
 *   2. a máscara virar dado gravado ............................ 2 falhas
 *   3. o teto de consultas sumir ............................... 1 falha
 *   4. o Compasso parar de delegar (voltar a ter cópia) ........ 1 falha
 *   5. mascarado sem cadastro gravar o pontinho ................ 1 falha
 *   6. a tela do bingo destruir o valor mascarado .............. 1 falha
 *   7. o escopo do teto sumir (bingo gastar a cota do compasso)  1 falha
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");

const core = ler("PrivacidadeCore.gs");
const bingo = ler("BingoInscricao.gs");
const compasso = ler("EventosInscricaoPublica.gs");
const telaBingo = ler("BingoInscricaoPublica.html");

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada em " + codigo.slice(0, 40));
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return { args: m[1].split(",").map(s => s.trim()).filter(Boolean),
           corpo: codigo.slice(m.index + m[0].length, i - 1) };
}
const fn = (codigo, nome, deps) => {
  const a = corpoDe(codigo, nome);
  const nomes = Object.keys(deps || {});
  return (...vals) => new Function(...a.args, ...nomes, a.corpo)(
    ...vals, ...nomes.map(n => (deps || {})[n]));
};

/* A marca vem do próprio arquivo: se ela mudar, o teste acompanha em vez de
   passar a medir um caractere que não existe mais. */
const MARCA = eval((core.match(/var PRIV_MARCA = ('[^']*')/) || [])[1] || "'•'");
const repetir = fn(core, "priv_repetir_", {});
const mascararEmail = fn(core, "priv_mascararEmail_", { PRIV_MARCA: MARCA, priv_repetir_: repetir });
const mascararTel = fn(core, "priv_mascararTelefone_", { PRIV_MARCA: MARCA, priv_repetir_: repetir });
const valorMascarado = fn(core, "priv_valorMascarado_", { PRIV_MARCA: MARCA });

const EMAIL_REAL = "mariaaparecida@gmail.com";
const TEL_REAL = "27998765432";
const CPF = "52998224725";

fluxo("PRIVACIDADE · o CPF não abre a lista de contatos");

/* ─────────────────────────────────────────────────────────────────────────
   1. A CAMADA COMUM
   ───────────────────────────────────────────────────────────────────────*/
passo("máscara: reconhecível por quem é dono, inútil para quem varre");

const mEmail = mascararEmail(EMAIL_REAL);
ok(mEmail.indexOf("mariaaparecida") < 0, "o e-mail sai mascarado: " + mEmail);
ok(mEmail.indexOf("@gmail.com") > 0,
   "  com o domínio inteiro",
   "é o que permite a pessoa notar que o cadastro tem o e-mail antigo do trabalho");
igual(mEmail.charAt(0), "m", "  e a primeira letra, para reconhecer o próprio");

const mTel = mascararTel(TEL_REAL);
ok(mTel.indexOf("98765") < 0, "o telefone também: " + mTel);
ok(mTel.indexOf("5432") > 0 && mTel.indexOf("27") > 0, "  DDD e 4 últimos ficam");

igual(mascararEmail(""), "", "vazio não vira máscara");
igual(mascararTel("123"), "", "telefone curto demais não vira máscara");

passo("o caminho de volta: a máscara não pode virar dado");

igual(valorMascarado(mEmail, EMAIL_REAL), EMAIL_REAL,
      "campo não tocado → grava o valor REAL do cadastro",
      "sem isto, o convite iria para 'm••••a@gmail.com'");
igual(valorMascarado("outro@email.com", EMAIL_REAL), "outro@email.com",
      "campo alterado → grava o que a pessoa digitou");
igual(valorMascarado(mTel, TEL_REAL), TEL_REAL, "o mesmo vale para o telefone");

/* ─────────────────────────────────────────────────────────────────────────
   2. O BINGO — o buraco que estava aberto
   ───────────────────────────────────────────────────────────────────────*/
passo("bingo_inscricaoPreencher, executado");

let consultas = 0;
function preencher(tetoOk) {
  consultas++;
  return fn(bingo, "bingo_inscricaoPreencher", {
    priv_podeConsultar_: () => tetoOk !== false,
    priv_mensagemTeto_: () => "Muitas consultas seguidas.",
    priv_mascararEmail_: mascararEmail,
    priv_mascararTelefone_: mascararTel,
    buscarAssociadoPorCPF_: () => ({
      encontrado: true, nome: "MARIA APARECIDA", email: EMAIL_REAL,
      cidade: "Vitória", celular: TEL_REAL
    })
  })(CPF);
}

const p = preencher();
igual(p.ok, true, "acha a pessoa pelo CPF");
igual(p.nome, "MARIA APARECIDA",
      "e devolve o NOME inteiro",
      "sem ele a tela não confirma que achou a pessoa certa; nome sem contato não abborda ninguém");

/* MUTAÇÃO 1: a asserção central deste arquivo. */
ok(p.email.indexOf(MARCA) >= 0 && p.email.indexOf("mariaaparecida") < 0,
   "o e-mail volta MASCARADO: " + p.email,
   "era isto que estava aberto: com uma lista de CPFs, se montava a lista de contatos");
ok(p.whatsapp.indexOf(MARCA) >= 0 && p.whatsapp.indexOf("98765") < 0,
   "e o telefone também: " + p.whatsapp);
igual(p.mascarado, true,
      "avisa a tela que veio mascarado",
      "campo com pontinho e sem explicação parece defeito — a pessoa apaga e redigita");

/* MUTAÇÃO 3 */
const bloqueado = preencher(false);
igual(bloqueado.ok, false, "estourando o teto, recusa");
ok(String(bloqueado.erro || "").length > 0,
   "  e diz por quê, em vez de devolver vazio",
   "silêncio faz a pessoa achar que o CPF dela não está na base");

/* ─────────────────────────────────────────────────────────────────────────
   3. A GRAVAÇÃO — onde a máscara viraria dado
   ───────────────────────────────────────────────────────────────────────*/
passo("bingo_inscrever com a máscara voltando");

/* Vai até o FIM: o que importa é o que foi GRAVADO, não se a validação
   reclamou. Na primeira rodada de mutação este mock parava em
   `bingo_inscricaoFechada_`, e por isso a mutação mais grave do arquivo
   sobreviveu — trocar só o e-mail pelo mascarado não recusa campo nenhum
   ("m••••a@gmail.com" passa no teste de e-mail), então medir "nenhum campo
   recusado" não provava nada. Agora se mede o documento. */
function inscrever(dados, achaCadastro) {
  let gravado = null;
  const deps = {
    PRIV_MARCA: MARCA,
    priv_valorMascarado_: valorMascarado,
    buscarAssociadoPorCPF_: () => achaCadastro === false
      ? { encontrado: false }
      : { encontrado: true, email: EMAIL_REAL, celular: TEL_REAL },
    bingo_cpfValido_: c => String(c).length === 11,
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    fs_get_: () => null,
    fs_set_: (col, id, doc) => { if (!gravado) gravado = doc; },
    bingo_colecao_: c => c,
    bingo_configPadrao_: () => ({ limiteInscritos: 300 }),
    bingo_inscricaoFechada_: () => "",
    bingo_inscritoPorCpf_: () => null,
    bingo_contarInscritos_: () => 0,
    bingo_uuid_: p => p + "-1",
    bingo_agoraIso_: () => "2026-08-21T12:00:00Z",
    bingo_hash_: v => "hash(" + v + ")",
    bingo_mascararCpf_: c => "***." + String(c).slice(3, 6) + ".***-**",
    BINGO_LIMITE_INSCRITOS_PADRAO: 300,
    BINGO_TERMO_VERSAO: "1",
    BINGO_TERMO_TEXTO: "termo",
    bingo_inscricaoResposta_: () => ({ ok: true, jaInscrito: true }),
    bingo_cartelaGerar_: () => ({ numeros: [] }),
    bingo_enviarEmailInscricao_: () => {},
    Logger: { log: () => {} }
  };
  const a = corpoDe(bingo, "bingo_inscrever");
  const nomes = Object.keys(deps);
  let r = null, erro = null;
  try {
    r = new Function(...a.args, ...nomes, a.corpo)(dados, ...nomes.map(n => deps[n]));
  } catch (e) { erro = e.message; }
  return { r, gravado, erro };
}

/* Chega até a validação e para na config: o que interessa é o que aconteceu
   com email/whatsapp ANTES disso. Se a máscara sobreviver à validação, a
   função devolve o erro de campo — e é isso que se mede. */
const comMascara = inscrever({
  eventoId: "E1", cpf: CPF, nome: "MARIA APARECIDA", email: mEmail,
  escola: "EEEFM CENTRAL", cidade: "Vitória", whatsapp: mTel, aceiteTermo: true
});

/* MUTAÇÃO 2 — a asserção mais importante deste arquivo.
 *
 * Mede o que foi GRAVADO. Não adianta medir "nenhum campo recusado":
 * "m••••a@gmail.com" passa no teste de e-mail, porque • não é @ nem espaço.
 * Um teste que parasse na validação daria verde com a máscara indo para o
 * banco — e o convite do sorteio nunca chegaria em ninguém. */
ok(!!comMascara.gravado, "a inscrição chega a ser gravada");
igual(comMascara.gravado.email, EMAIL_REAL,
      "GRAVA o e-mail REAL, não a máscara",
      "com a máscara no banco, o convite iria para um endereço que não existe");
igual(comMascara.gravado.whatsapp, TEL_REAL,
      "e o WhatsApp real",
      "'(27) •••••-5432' viraria '275432' ao tirar os pontos");
ok(String(comMascara.gravado.email).indexOf(MARCA) < 0 &&
   String(comMascara.gravado.whatsapp).indexOf(MARCA) < 0,
   "nenhuma marca de máscara sobrevive até o banco");

/* MUTAÇÃO 5: mascarado sem cadastro por trás não pode gravar pontinho. */
const semCadastro = inscrever({
  eventoId: "E1", cpf: CPF, nome: "MARIA APARECIDA", email: mEmail,
  escola: "X", cidade: "Vitória", whatsapp: mTel, aceiteTermo: true
}, false);
igual(semCadastro.r.campo, "email",
      "máscara sem cadastro por trás é RECUSADA no campo, não gravada",
      "gravar 'm••••a@gmail.com' seria pior que recusar");

/* Sem máscara nenhuma, o caminho normal continua. */
const semMascara = inscrever({
  eventoId: "E1", cpf: CPF, nome: "MARIA APARECIDA", email: "outro@email.com",
  escola: "X", cidade: "Vitória", whatsapp: "27999998888", aceiteTermo: true
});
igual(semMascara.r.campo, undefined, "quem digita tudo à mão passa igual");

/* ─────────────────────────────────────────────────────────────────────────
   4. UMA IMPLEMENTAÇÃO SÓ
   ───────────────────────────────────────────────────────────────────────*/
passo("Compasso e Bingo usam a mesma regra");

/* MUTAÇÃO 4: se o Compasso voltar a ter cópia própria, a regra diverge. */
const corpoMascEmail = corpoDe(compasso, "compasso_mascararEmail_").corpo;
ok(/priv_mascararEmail_/.test(corpoMascEmail),
   "compasso_mascararEmail_ DELEGA para a camada comum");
ok(corpoMascEmail.indexOf("indexOf('@')") < 0,
   "  e não reimplementa a máscara",
   "duas cópias da mesma regra é como ela diverge sem ninguém notar");

["compasso_mascararTelefone_", "compasso_valorMascarado_", "compasso_podeConsultar_"]
  .forEach(f => {
    ok(/priv_/.test(corpoDe(compasso, f).corpo), f + " também delega");
  });

/* O Compasso não declara marca NENHUMA — nem própria, nem apelido.
 *
 * Apelido (`var COMPASSO_MARCA_MASCARA = PRIV_MARCA`) parecia inofensivo e
 * quebrou a suíte inteira em 21/08/2026: no Apps Script os arquivos são
 * avaliados em ordem, "E" vem antes de "P", e a constante do PrivacidadeCore
 * ainda não existia quando o EventosInscricaoPublica carregava. Quem precisa
 * do valor chama a função, que roda depois de tudo estar carregado. */
ok(!/var COMPASSO_MARCA_MASCARA/.test(compasso),
   "o Compasso não declara marca própria nem apelido",
   "apelido para constante de outro arquivo depende da ordem de carregamento");
ok(!/var COMPASSO_TETO_CONSULTAS/.test(compasso),
   "  nem o teto");

/* MUTAÇÃO 7: escopo separado por tela. */
const corpoTeto = corpoDe(core, "priv_podeConsultar_").corpo;
ok(/escopo/.test(corpoTeto),
   "o teto separa a contagem por tela",
   "sem escopo, quem consulta no bingo gasta a cota da inscrição da festa");
ok(/priv_podeConsultar_\('bingo'\)/.test(bingo), "o bingo passa seu escopo");
ok(/priv_podeConsultar_\('compasso'\)/.test(compasso), "e o compasso o dele");

/* ─────────────────────────────────────────────────────────────────────────
   5. A TELA
   ───────────────────────────────────────────────────────────────────────*/
passo("a tela do bingo não estraga o valor mascarado");

/* MUTAÇÃO 6: a máscara de telefone da tela tira não-dígitos — aplicada sobre
   "(27) •••••-5432" produziria "(27) 5432". */
ok(/!a\.mascarado && el\('whatsapp'\)\.value/.test(telaBingo),
   "a máscara de telefone só roda quando o valor NÃO veio mascarado");
ok(/parcialmente ocultos/.test(telaBingo),
   "e a tela explica o pontinho para quem está preenchendo",
   "sem explicação, a pessoa apaga tudo e redigita — perdendo a facilidade");

resumo();
