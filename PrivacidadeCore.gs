// ============================================================================
// 🔒 ARQUIVO: PrivacidadeCore.gs
// 🏷️  SISGEP — máscara de contato e teto de consulta em rota pública
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026. O SISGEP tem telas públicas onde a pessoa digita o CPF e o
// formulário nasce preenchido. É o que torna a inscrição simples — e é
// exatamente o que, sem cuidado, transforma a tela numa porta para colher a
// base de 8.000 associados: um endpoint que devolve nome, e-mail e telefone a
// partir de um CPF.
//
// O buraco foi fechado no Compasso pela manhã. À tarde, a análise do módulo
// mostrou que `bingo_inscricaoPreencher` tinha o MESMO defeito, aberto. Duas
// telas públicas, o mesmo risco, e a correção existindo em uma só.
//
// Este arquivo é a resposta a isso: UMA implementação da regra, para as duas
// telas e para as que vierem. Se um dia a máscara mudar — e vai, quando
// alguém achar que mostra demais ou de menos —, muda aqui.
//
// AS DUAS CAMADAS, E QUAL DELAS IMPORTA
//
//   1. TETO DE CONSULTAS por navegador. Não impede um ataque decidido: o
//      Apps Script não expõe IP, e quem quiser limpa o cookie. Encarece
//      varrer 8.000 CPFs, e só.
//
//   2. MÁSCARA no e-mail e no telefone. É a que realmente vale, porque tira
//      o VALOR do que se colheria. E o valor real nunca sai do servidor: se
//      a pessoa não mexer no campo, o próprio servidor usa o do cadastro
//      (ver `priv_valorMascarado_`).
//
// A ordem importa na leitura: quem for mexer aqui precisa saber que mexer na
// 1 é ajuste, e mexer na 2 é abrir o cofre.
// ============================================================================

/** O caractere da máscara. Um só, em todo o sistema. */
var PRIV_MARCA = '•';

/** Teto por navegador e janela, em segundos. */
var PRIV_TETO_CONSULTAS = 12;
var PRIV_JANELA_SEG = 600;

/**
 * m••••a@gmail.com — reconhecível por quem é dono, inútil para quem varre.
 *
 * O domínio fica inteiro de propósito: é o que permite a pessoa perceber que
 * o cadastro tem o e-mail antigo do trabalho, e trocar.
 */
function priv_mascararEmail_(email) {
  email = String(email || '').trim();
  var at = email.indexOf('@');
  if (at < 1) return '';
  var user = email.slice(0, at), dom = email.slice(at);
  var visivel = user.length <= 2 ? user.charAt(0)
              : user.charAt(0) + priv_repetir_(PRIV_MARCA, Math.min(4, user.length - 2)) +
                user.charAt(user.length - 1);
  return visivel + dom;
}

/** (27) •••••-5432 — o DDD e os 4 últimos bastam para reconhecer o próprio. */
function priv_mascararTelefone_(tel) {
  var d = String(tel || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  return '(' + d.slice(0, 2) + ') ' + priv_repetir_(PRIV_MARCA, 5) + '-' + d.slice(-4);
}

/**
 * Decide o que gravar: o que a pessoa digitou, ou o valor real do cadastro.
 *
 * Se o texto ainda contém a marca, ela não mexeu no campo — e o que vale é o
 * cadastro. É esta função que faz a máscara não virar dado: sem ela, quem
 * deixasse o campo como veio gravaria "m••••a@gmail.com" como e-mail, e o
 * ingresso não chegaria em ninguém.
 */
function priv_valorMascarado_(digitado, doCadastro) {
  var v = String(digitado || '');
  if (v.indexOf(PRIV_MARCA) >= 0) return String(doCadastro || '');
  return v.trim();
}

/**
 * Teto de consultas por navegador. Devolve false quando estourou.
 *
 * @param {string} escopo  separa as contagens por tela ('compasso', 'bingo'),
 *                         para uma inscrição não gastar a cota da outra.
 */
function priv_podeConsultar_(escopo) {
  try {
    var cache = CacheService.getScriptCache();
    var chave = 'priv_' + String(escopo || 'geral') + '_' +
                (Session.getTemporaryActiveUserKey() || 'anon');
    var n = Number(cache.get(chave) || 0) + 1;
    cache.put(chave, String(n), PRIV_JANELA_SEG);
    return n <= PRIV_TETO_CONSULTAS;
  } catch (e) {
    /* Cache indisponível não pode impedir alguém de se inscrever. A máscara,
       que é a trava principal, continua valendo. */
    return true;
  }
}

/** A mensagem que a tela mostra quando o teto estoura. Uma só, em todo lugar. */
function priv_mensagemTeto_() {
  return 'Muitas consultas seguidas. Aguarde alguns minutos e tente de novo — ' +
         'ou preencha os campos à mão.';
}

/* `String.prototype.repeat` existe no runtime V8, mas não no Rhino. Este
   projeto ainda tem arquivos que rodaram em Rhino, e uma função de segurança
   não é lugar para descobrir incompatibilidade de runtime. */
function priv_repetir_(s, n) {
  var out = '';
  for (var i = 0; i < n; i++) out += s;
  return out;
}
