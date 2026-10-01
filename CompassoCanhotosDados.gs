// ============================================================================
// 📄 ARQUIVO: CompassoCanhotosDados.gs   (a tela é CompassoCanhotos.html)
// 🏷️  COMPASSO 2026 — lista de controle e canhotos da urna do sorteio
// ============================================================================
//
// O QUE ORIGINOU
//
// 01/10/2026. Em 21/09 o ingresso da festa passou a ser o cartão com QR da
// bilheteria, e o canhoto do sorteio saiu do ingresso — ficou registrado que
// "o sorteio precisa de outro caminho, ainda não desenhado". Este é o caminho.
//
// Como o usuário descreveu a entrada: a outra plataforma lê o QR, a moça
// confere a identidade, acha o nome na relação, destaca o canhoto e a pessoa
// põe na urna. "Somente isso, nada além disso." Então este arquivo NÃO toca
// ingresso, check-in nem inscrição: só lê a planilha e devolve a lista.
//
// DE ONDE VEM A LISTA
//
// A planilha de respostas do formulário de inscrição, exportada. Ela não tem
// número de inscrição — o número do canhoto é a ORDEM DE INSCRIÇÃO pelo
// carimbo de data/hora. Ordem de chegada é estável: quem se inscreveu ontem
// não muda de número porque alguém se inscreveu hoje.
//
// O QUE A PLANILHA REAL TINHA (respostas até 01/10/2026)
//
//   - o cabeçalho colado de novo no meio das respostas (linha 286);
//   - uma linha vazia no fim, só com um espaço no nome;
//   - duas pessoas que marcaram "Não concordo com os termos".
//
// As três coisas estão tratadas abaixo e aparecem como aviso na tela — nada
// some em silêncio.
//
// LGPD
//
// A planilha traz CPF, e-mail e telefone. NADA disso sai daqui para a tela:
// o CPF só é usado para achar inscrição repetida, dentro desta função. O
// canhoto leva nome, escola, número e faixa.
//
// A leitura reaproveita `compassoImp_abrir_` e `compasso_importarMapear_`
// (EventosImportacaoTela.gs / EventosImportacaoTeste.gs), que já leram a
// planilha real do sindicato — não existe segundo jeito de ler planilha.
// ============================================================================

/**
 * Lê a planilha e devolve a lista pronta para os canhotos. NÃO GRAVA NADA.
 *
 * @param {Object} origem  { base64, nome } (anexo) ou { url } (link do Drive)
 * @param {string=} aba    nome da aba; vazio = a primeira
 * @return {Object} { ok, aba, abas[], colunas{}, participantes[], avisos[] }
 */
function compassoCanhotos_ler(origem, aba, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — canhotos do sorteio', false);
  var lido;
  try { lido = compassoImp_abrir_(origem || {}, aba); }
  catch (e) { return { ok: false, erro: e.message }; }
  var r = compassoCanhotos_montar_(lido.grid);
  r.aba = lido.nomeAba;
  r.abas = lido.abas;
  return r;
}

/**
 * A regra inteira, separada da leitura para poder ser testada sem Drive.
 * @param {Array<Array>} grid  a aba, com o cabeçalho na linha 0
 */
function compassoCanhotos_montar_(grid) {
  grid = grid || [];
  var cab = grid[0] || [];
  var m = compasso_importarMapear_(cab).mapa;
  if (m.nome === undefined)
    return { ok: false, erro: 'Não achei a coluna do nome nesta planilha. Confira se a primeira linha é o cabeçalho.' };

  var norm = cab.map(compasso_normalizarTexto_);
  var iData = compassoCanhotos_colunaQueContem_(norm, ['carimbo', 'data/hora', 'timestamp']);
  var iTermo = compassoCanhotos_colunaQueContem_(norm, ['termo']);

  var avisos = [];
  var recusados = [], semEscola = [], repetidos = [];
  var cabecalhoRepetido = 0, vazias = 0;
  var vistosCpf = {}, vistosNome = {};
  var lista = [];

  for (var i = 1; i < grid.length; i++) {
    var linha = grid[i] || [];
    var d = compasso_importarLinha_(linha, m);
    var nomeNorm = compasso_normalizarTexto_(d.nome);

    if (!nomeNorm) { if (linha.join('').trim()) vazias++; continue; }
    /* O cabeçalho colado de novo no meio das respostas — a planilha real tinha um. */
    if (nomeNorm === compasso_normalizarTexto_(cab[m.nome])) { cabecalhoRepetido++; continue; }

    if (iTermo >= 0 && compassoCanhotos_recusouTermo_(linha[iTermo])) {
      recusados.push({ linha: i + 1, nome: compassoCanhotos_nome_(d.nome) });
      continue;
    }

    var chaveNome = nomeNorm.replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');
    if ((d.cpf && vistosCpf[d.cpf]) || vistosNome[chaveNome]) {
      repetidos.push({ linha: i + 1, nome: compassoCanhotos_nome_(d.nome) });
      continue;
    }
    if (d.cpf) vistosCpf[d.cpf] = true;
    vistosNome[chaveNome] = true;

    var escola = compassoCanhotos_escola_(d.escola);
    if (!escola) semEscola.push({ linha: i + 1, nome: compassoCanhotos_nome_(d.nome) });

    lista.push({
      linha: i + 1,
      quando: iData >= 0 ? compassoCanhotos_instante_(linha[iData]) : 0,
      nome: compassoCanhotos_nome_(d.nome),
      escola: escola
    });
  }

  /* Número = ordem de inscrição. Sem carimbo (ou carimbo ilegível), vale a
     ordem da linha — que numa planilha de formulário é a mesma coisa. */
  lista.sort(function (a, b) {
    if (a.quando && b.quando && a.quando !== b.quando) return a.quando - b.quando;
    return a.linha - b.linha;
  });
  var participantes = lista.map(function (p, k) {
    return { numero: ('000' + (k + 1)).slice(-4), nome: p.nome, escola: p.escola };
  });

  if (recusados.length)
    avisos.push({ tipo: 'recusou_termo', texto: recusados.length + ' pessoa(s) marcaram "Não concordo" no termo e ficaram FORA dos canhotos.', itens: recusados });
  if (repetidos.length)
    avisos.push({ tipo: 'repetido', texto: repetidos.length + ' inscrição(ões) repetida(s) — mesmo CPF ou mesmo nome. Ficou valendo a primeira.', itens: repetidos });
  if (semEscola.length)
    avisos.push({ tipo: 'sem_escola', texto: semEscola.length + ' participante(s) sem escola. O canhoto sai com a escola em branco.', itens: semEscola });
  if (cabecalhoRepetido)
    avisos.push({ tipo: 'cabecalho', texto: 'O cabeçalho aparece repetido ' + cabecalhoRepetido + ' vez(es) no meio da planilha — ignorado.', itens: [] });
  if (vazias)
    avisos.push({ tipo: 'vazia', texto: vazias + ' linha(s) sem nome — ignorada(s).', itens: [] });

  return {
    ok: true,
    colunas: {
      nome: String(cab[m.nome] || '').trim(),
      escola: m.escola === undefined ? '' : String(cab[m.escola] || '').trim(),
      ordem: iData >= 0 ? String(cab[iData] || '').trim() : '',
      termo: iTermo >= 0 ? 'Termo de compromisso' : ''
    },
    participantes: participantes,
    avisos: avisos
  };
}

function compassoCanhotos_colunaQueContem_(norm, pedacos) {
  for (var i = 0; i < norm.length; i++)
    for (var j = 0; j < pedacos.length; j++)
      if (norm[i].indexOf(pedacos[j]) >= 0) return i;
  return -1;
}

/** "❌ Não concordo com os termos." → true. "✅ Sim, li…" → false. */
function compassoCanhotos_recusouTermo_(v) {
  var s = String(v == null ? '' : v);
  if (s.indexOf('❌') >= 0) return true;
  var n = compasso_normalizarTexto_(s).replace(/[^a-z ]/g, '').trim();
  return n.indexOf('nao concordo') >= 0 || n === 'nao';
}

function compassoCanhotos_instante_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
  var m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime();
}

/** Nome em caixa alta, sem espaço sobrando — o canhoto do modelo é assim. */
function compassoCanhotos_nome_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
}

/**
 * Escola como a pessoa digitou, sem espaço sobrando. Só quem digitou tudo em
 * minúscula ganha iniciais maiúsculas — "emef santa rita" no canhoto parece
 * erro. Caixa alta fica como está: é onde moram as siglas (EMEF, CMEI).
 */
function compassoCanhotos_escola_(s) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t || t !== t.toLowerCase()) return t;
  var minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return t.split(' ').map(function (p, i) {
    if (i > 0 && minusculas.indexOf(p) >= 0) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' ');
}

/**
 * A arte (banner e canhoto do modelo aprovado) e as fontes, como CSS.
 * Mora num .html à parte e só é lida quando a pessoa manda gerar: ~470 KB
 * não podem viajar em toda abertura do SISGEP.
 */
function compassoCanhotos_arte(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — arte dos canhotos', false);
  return HtmlService.createHtmlOutputFromFile('CompassoCanhotosArte').getContent();
}
