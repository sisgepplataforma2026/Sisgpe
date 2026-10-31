const fs = require('fs');
const path = require('path');

function read(name){return fs.readFileSync(path.join(__dirname,'..','..',name),'utf8')}
function ok(cond,msg){if(!cond)throw new Error(msg)}

const fechamento=read('BingoFechamento.gs');
const sorteio=read('BingoSorteio.gs');
const telao=read('BingoTelao.html');
const code=read('Code.gs');

ok(fechamento.includes('bingo_encerrarRodada'), 'Deve existir encerramento de rodada.');
ok(fechamento.includes('bingo_expirarManifestacoesPendentes'), 'Deve expirar manifestações vencidas.');
ok(fechamento.includes('bingo_relatorioRodada'), 'Deve gerar relatório auditável da rodada.');
ok(sorteio.includes('Existe Bingo aguardando manifestação'), 'Retomada deve bloquear Bingo ainda pendente.');
ok(telao.includes('BINGO ONLINE') && telao.includes('bingo_estadoAdmin'), 'Telão deve consumir estado oficial do servidor.');
ok(code.includes('p.painel === "bingo-telao"'), 'Code.gs deve expor rota protegida para Telão/OBS.');

console.log('OK — Bingo Online: fechamento e telão presentes.');
