const fs = require('fs');
const path = require('path');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', '..', name), 'utf8');
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cfg = read('BingoConfig.gs');
const cart = read('BingoCartelas.gs');
const sort = read('BingoSorteio.gs');
const val = read('BingoValidacao.gs');
const links = read('BingoLinks.gs');
const parts = read('BingoParticipantes.gs');
const rt = read('BingoRealtime.gs');
const admin = read('BingoAdmin.html');
const assoc = read('BingoAssociado.html');
const code = read('Code.gs');
const rules = read('firebase/firestore.rules');

ok(cfg.includes("bingo_publicarEstadoRodada_"), 'Rodada deve publicar estado realtime.');
ok(cart.includes('combinacaoHash'), 'Cartela deve controlar combinação única.');
ok(sort.includes('LockService.getScriptLock'), 'Sorteio deve usar lock.');
ok(val.includes('AGUARDANDO_MANIFESTACAO'), 'Validação deve tratar manifestação.');
ok(links.includes('tokenHash'), 'Link deve persistir apenas hash do token.');
ok(!links.includes('cpf:'), 'Estado público não deve devolver CPF.');
ok(parts.includes("evento_participantes") && parts.includes("ingressos"), 'Participantes devem vir do Evento com fallback atual.');
ok(parts.includes('bingo_firestoreBatchSet_'), 'Geração para muitos participantes deve usar lote.');
ok(rt.includes('FIREBASE_WEB_CONFIG'), 'Realtime deve usar configuração Web fora do código.');
ok(rt.includes('sorteiosJson'), 'Estado realtime deve permitir reconstrução após reconexão.');
ok(admin.includes('Gerar cartelas para todos'), 'Painel deve gerar cartelas automaticamente para o Evento.');
ok(assoc.includes('onSnapshot'), 'Cartela deve usar listener Firestore.');
ok(assoc.includes('firebasejs/12.17.0'), 'Cartela deve usar SDK Firebase modular atual.');
ok(code.includes('p.bingo'), 'Code.gs deve possuir rota pública do Bingo.');
ok(code.includes('p.painel === "bingo"'), 'Code.gs deve possuir painel administrativo do Bingo.');
ok(rules.includes('allow list, create, update, delete: if false'), 'Coleção pública não pode permitir listagem/escrita pelo cliente.');

console.log('OK — Bingo Online: estrutura crítica presente.');
