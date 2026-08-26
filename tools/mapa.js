#!/usr/bin/env node
/**
 * SISGEP — gerador do mapa do projeto.
 * Varre os .gs/.html da raiz e escreve docs/MAPA.md + docs/mapa.json.
 * Sem dependencias: roda com o Node que ja existe no ambiente.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = process.argv[2] || process.cwd();
const SAIDA = path.join(RAIZ, 'docs');

const arquivos = fs.readdirSync(RAIZ);
const GS = arquivos.filter(f => f.endsWith('.gs')).sort();
const HTML = arquivos.filter(f => f.endsWith('.html')).sort();

// ---------- 1. definicoes do servidor ----------
const defs = new Map();          // fn -> [arquivo]
const porArquivo = new Map();    // arquivo -> [fn]
const dupNoMesmoArquivo = [];
for (const f of GS) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const vistos = new Set();
  const lista = [];
  for (const m of txt.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)) {
    const nome = m[1];
    if (vistos.has(nome)) dupNoMesmoArquivo.push({ arquivo: f, fn: nome });
    vistos.add(nome);
    lista.push(nome);
    if (!defs.has(nome)) defs.set(nome, []);
    defs.get(nome).push(f);
  }
  porArquivo.set(f, lista);
}

// ---------- 2. chamadas cliente -> servidor ----------
function fimDaChamada(txt, i) {           // i aponta para '('
  let prof = 0, aspa = null;
  for (; i < txt.length; i++) {
    const c = txt[i];
    if (aspa) { if (c === '\\') { i++; continue; } if (c === aspa) aspa = null; continue; }
    if (c === '"' || c === "'" || c === '`') { aspa = c; continue; }
    if (c === '(') prof++;
    else if (c === ')') { prof--; if (prof === 0) return i + 1; }
  }
  return -1;
}
const chamadas = new Map();     // fn -> Set(html)
for (const f of HTML) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  let idx = 0;
  while ((idx = txt.indexOf('google.script.run', idx)) !== -1) {
    let i = idx + 'google.script.run'.length;
    for (;;) {
      while (i < txt.length && /\s/.test(txt[i])) i++;
      if (txt[i] !== '.') break;
      i++;
      while (i < txt.length && /\s/.test(txt[i])) i++;
      const m = /^([A-Za-z_$][\w$]*)/.exec(txt.slice(i, i + 80));
      if (!m) break;
      const nome = m[1];
      i += nome.length;
      while (i < txt.length && /\s/.test(txt[i])) i++;
      if (txt[i] !== '(') break;
      if (/^with[A-Z]/.test(nome)) {          // withSuccessHandler / withFailureHandler
        const fim = fimDaChamada(txt, i);
        if (fim < 0) break;
        i = fim;
        continue;
      }
      if (!chamadas.has(nome)) chamadas.set(nome, new Set());
      chamadas.get(nome).add(f);
      break;
    }
    idx += 'google.script.run'.length;
  }
}

// ---------- 3. planilhas: aba -> arquivos que leem/gravam ----------
const abas = new Map();   // aba -> {arquivos:Set, grava:Set}
const ESCRITA = /(setValue|setValues|appendRow|deleteRow|insertRow|clearContent|setBackground|getRange\([^)]*\)\.set)/;
for (const f of GS) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const linhas = txt.split('\n');
  linhas.forEach((linha, n) => {
    for (const m of linha.matchAll(/getSheetByName\(\s*["']([^"']+)["']/g)) {
      const aba = m[1];
      if (!abas.has(aba)) abas.set(aba, { arquivos: new Set(), grava: new Set() });
      abas.get(aba).arquivos.add(f);
      const janela = linhas.slice(n, n + 25).join('\n');
      if (ESCRITA.test(janela)) abas.get(aba).grava.add(f);
    }
  });
}

// ---------- 4. include() entre HTML ----------
const includes = new Map();  // html -> Set(html incluido)
for (const f of HTML) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const alvos = new Set();
  for (const m of txt.matchAll(/include\(\s*["']([^"']+)["']/g)) alvos.add(m[1] + '.html');
  if (alvos.size) includes.set(f, alvos);
}

// ---------- 5. saude ----------
const chamadasOrfas = [...chamadas.keys()].filter(c => !defs.has(c)).sort();
const globaisDuplicados = [...defs].filter(([, a]) => new Set(a).size > 1)
  .map(([n, a]) => ({ fn: n, arquivos: [...new Set(a)] }))
  .sort((a, b) => a.fn.localeCompare(b.fn));

// ---------- 6. modulos ----------
const MODULOS = [
  ['Ofícios',            /oficio/i],
  ['Parque China',       /parquechina|china/i],
  ['Financeiro/Despesas',/despesa|comprovante|contabil|nf\b/i],
  ['Financeiro/Guias',   /guia|mensalidade|taxaassistencial|cct|receita/i],
  ['Recibos',            /recibo/i],
  ['Sindicalização',     /sindicaliza|ficha|aprovacaocadastro/i],
  ['Escolas',            /escola|prestador/i],
  ['Vouchers',           /voucher|certificado/i],
  ['Eventos',            /evento/i],
  ['Central de E-mail',  /email|comunicac/i],
  ['IA Sofia',           /^ia|iacore|chatia|sofia|memoria|cockpit/i],
  ['Portal do Associado',/portal|associado|carteirinha/i],
  ['Visitas',            /visita/i],
  ['Benefícios/Saúde',   /beneficio|oftalm|agend/i],
  ['Relatórios',         /relatorio|dashboard/i],
  ['Núcleo/Infra',       /^(code|utils|sessao|login|sistemaconfig|helpers|index|teste|diagnostico|prevencao)/i],
];
function moduloDe(f) {
  for (const [nome, re] of MODULOS) if (re.test(f)) return nome;
  return 'Outros';
}
const porModulo = new Map();
for (const f of [...GS, ...HTML]) {
  const m = moduloDe(f);
  if (!porModulo.has(m)) porModulo.set(m, []);
  porModulo.get(m).push(f);
}

// ---------- escrita ----------
fs.mkdirSync(SAIDA, { recursive: true });
const tam = f => fs.statSync(path.join(RAIZ, f)).size;
const kb = f => Math.round(tam(f) / 1024) + 'k';

const L = [];
L.push('# MAPA DO SISGEP');
L.push('');
L.push('> Gerado por `node tools/mapa.js`. Não edite à mão — rode o gerador depois de mexer no código.');
L.push('> Serve para localizar o arquivo certo **sem abrir o repositório inteiro**.');
L.push('');
L.push(`Apps Script V8 · ${GS.length} arquivos \`.gs\` (servidor) · ${HTML.length} arquivos \`.html\` (telas e fragmentos) · ${defs.size} funções de servidor.`);
L.push('Tudo na raiz: o Apps Script não tem pastas. Todos os `.gs` compartilham **um único escopo global**.');
L.push('');
L.push('## Como usar');
L.push('');
L.push('1. Ache o módulo na tabela abaixo → já reduz a busca a poucos arquivos.');
L.push('2. Para um botão da tela: procure a função em **Chamadas cliente → servidor**; ela diz o `.html` de origem e o `.gs` que a define.');
L.push('3. Para um dado gravado: procure a aba em **Planilhas**.');
L.push('4. Só então abra o arquivo — de preferência com `sed -n` na faixa de linhas, não inteiro.');
L.push('');
L.push('## Módulos');
L.push('');
L.push('| Módulo | Servidor (.gs) | Telas (.html) |');
L.push('|---|---|---|');
for (const [nome, fs_] of [...porModulo].sort((a, b) => b[1].length - a[1].length)) {
  const g = fs_.filter(f => f.endsWith('.gs')).map(f => `\`${f}\` ${kb(f)}`).join('<br>') || '—';
  const h = fs_.filter(f => f.endsWith('.html')).map(f => `\`${f}\` ${kb(f)}`).join('<br>') || '—';
  L.push(`| **${nome}** | ${g} | ${h} |`);
}
L.push('');
L.push('## Entradas do sistema');
L.push('');
L.push('`Code.gs` concentra o roteamento web:');
L.push('');
L.push('| Rota | Destino |');
L.push('|---|---|');
L.push('| `doGet` sem parâmetro | `Login.html` → `index.html` (precisa de sessão) |');
L.push('| `?portal=associado` | `servirPortalAssociado` (público) |');
L.push('| `?ficha=sindicalizacao` | `Fichasindicalizacao.html` (público, QR das visitas) |');
L.push('| `?painel=emissao` | `EventoPainel.html` (exige sessão) |');
L.push('| `?track=open&id=` | pixel de leitura de e-mail |');
L.push('| `?recuperar=` | recuperação de senha |');
L.push('| `doPost acao=loginDireto` | autentica e serve `index.html` |');
L.push('');
L.push('## Chamadas cliente → servidor');
L.push('');
L.push(`${chamadas.size} funções de servidor são chamadas por \`google.script.run\`. Esta é a fronteira frontend/backend.`);
L.push('');
L.push('| Função | Chamada em (.html) | Definida em (.gs) |');
L.push('|---|---|---|');
for (const nome of [...chamadas.keys()].sort()) {
  const orig = [...chamadas.get(nome)].map(x => `\`${x}\``).join(', ');
  const d = defs.get(nome);
  const dest = d ? [...new Set(d)].map(x => `\`${x}\``).join(', ') : '**❌ não existe**';
  L.push(`| \`${nome}\` | ${orig} | ${dest} |`);
}
L.push('');
L.push('## Planilhas (camada de dados)');
L.push('');
L.push('Planilha principal: `1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E`.');
L.push('');
L.push('| Aba | Grava | Só lê |');
L.push('|---|---|---|');
for (const [aba, o] of [...abas].sort((a, b) => b[1].arquivos.size - a[1].arquivos.size)) {
  const grava = [...o.grava].map(x => `\`${x}\``).join(', ') || '—';
  const le = [...o.arquivos].filter(x => !o.grava.has(x)).map(x => `\`${x}\``).join(', ') || '—';
  L.push(`| **${aba}** | ${grava} | ${le} |`);
}
L.push('');
L.push('## Fragmentos incluídos (include)');
L.push('');
L.push('| Arquivo | Inclui |');
L.push('|---|---|');
for (const [f, alvos] of [...includes].sort()) {
  L.push(`| \`${f}\` | ${[...alvos].map(x => `\`${x}\``).join(', ')} |`);
}
L.push('');
L.push('## Saúde do código');
L.push('');
L.push(`### Chamadas sem função no servidor (${chamadasOrfas.length})`);
L.push('');
L.push('A tela chama, o servidor não tem — falha em runtime.');
L.push('');
if (chamadasOrfas.length) {
  L.push('| Função | Chamada em |');
  L.push('|---|---|');
  for (const c of chamadasOrfas) L.push(`| \`${c}\` | ${[...chamadas.get(c)].map(x => `\`${x}\``).join(', ')} |`);
} else L.push('Nenhuma.');
L.push('');
L.push(`### Nomes globais duplicados (${globaisDuplicados.length + dupNoMesmoArquivo.length})`);
L.push('');
L.push('Todos os `.gs` dividem um escopo global só. Com o nome repetido, **uma definição apaga a outra** e qual delas vence depende da ordem de carga do projeto.');
L.push('');
L.push('| Função | Definida em |');
L.push('|---|---|');
for (const d of globaisDuplicados) L.push(`| \`${d.fn}\` | ${d.arquivos.map(x => `\`${x}\``).join(' , ')} |`);
for (const d of dupNoMesmoArquivo) L.push(`| \`${d.fn}\` | \`${d.arquivo}\` (duas vezes **no mesmo arquivo**) |`);
L.push('');

fs.writeFileSync(path.join(SAIDA, 'MAPA.md'), L.join('\n'));
if (process.argv.includes('--json')) fs.writeFileSync(path.join(SAIDA, 'mapa.json'), JSON.stringify({
  gerado: new Date().toISOString().slice(0, 10),
  arquivos: { gs: GS.length, html: HTML.length },
  funcoes: defs.size,
  porArquivo: [...porArquivo],
  chamadas: [...chamadas].map(([k, v]) => [k, [...v]]),
  defs: [...defs],
  abas: [...abas].map(([k, v]) => [k, { arquivos: [...v.arquivos], grava: [...v.grava] }]),
  chamadasOrfas,
  globaisDuplicados,
  dupNoMesmoArquivo,
}));

console.log(`MAPA.md: ${fs.statSync(path.join(SAIDA, 'MAPA.md')).size} bytes`);
console.log(`chamadas cliente->servidor: ${chamadas.size} | orfas: ${chamadasOrfas.length} | globais duplicados: ${globaisDuplicados.length + dupNoMesmoArquivo.length} | abas: ${abas.size}`);
