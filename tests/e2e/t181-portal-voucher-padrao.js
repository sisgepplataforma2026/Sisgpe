/**
 * TESTE — O PORTAL PÚBLICO DE BOLSAS SEGUE O PADRÃO VISUAL DO SISGEP
 *
 * "O link público está fora do padrão do SISGEP", "não pode cada módulo ter um
 * padrão diferente", "veja como é feito no módulo festa do compasso" — o
 * usuário, 16/09/2026.
 *
 * O QUE ESTAVA FORA. O portal usava família de cor própria — azul-céu
 * (#0ea5e9), violeta (#8b5cf6) e rosa (#ec4899) — num tema escuro. O Design
 * System do projeto é navy/azul/dourado, e o formulário público da Festa
 * (CompassoInscricaoPublica.html) já o segue à risca: é o modelo citado.
 *
 * O QUE NÃO FOI FEITO, de propósito: reescrever o arquivo. Ele tem 67 KB de
 * formulário que funciona e já recebeu solicitação real em produção. "Não
 * posso estragar o que funciona." Como as cores já estavam centralizadas em
 * tokens, repaginar virou trocar valor.
 *
 * O RISCO QUE A TROCA CRIOU, e que este teste guarda: o arquivo tinha 18
 * valores `rgba(255,255,255,…)` cravados, herdados do tema escuro. Sobre
 * fundo claro, fundo e borda de input em branco deixam o campo SEM CAIXA
 * VISÍVEL, e rótulo branco some. É o mesmo defeito do e-mail invisível de
 * mais cedo hoje — texto sem cor própria herdando a de fora.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.join(__dirname, "..", "..");
const portal = fs.readFileSync(path.join(RAIZ, "PortalVoucher.html"), "utf8");
const festa = fs.readFileSync(path.join(RAIZ, "CompassoInscricaoPublica.html"), "utf8");

b.fluxo("PORTAL DE BOLSAS · paleta do SISGEP");

/* Os tokens do Design System, conferidos contra o portal da Festa — que é o
   modelo, e não um valor que eu escolhi. */
const DO_SISTEMA = ["#001f4d", "#002f6c", "#1565C0", "#C9A84C"];
DO_SISTEMA.forEach(function (cor) {
  b.ok(festa.toUpperCase().indexOf(cor.toUpperCase()) > -1,
    "a Festa usa " + cor + " — é daqui que o padrão vem");
});
["#001f4d", "#002f6c", "#1565C0", "#C9A84C"].forEach(function (cor) {
  b.ok(portal.toUpperCase().indexOf(cor.toUpperCase()) > -1,
    "e o portal de Bolsas passou a usar " + cor);
});

/* A família antiga não pode voltar. */
[["#0ea5e9", "azul-céu"], ["#8b5cf6", "violeta"], ["#ec4899", "rosa"]].forEach(function (par) {
  b.ok(portal.toLowerCase().indexOf(par[0]) === -1,
    "o " + par[1] + " " + par[0] + " saiu da paleta");
});

b.passo("O claro é o padrão de quem chega pela primeira vez");
b.ok(/getSafeLocalStorageItem\('theme'\) \|\| 'light'/.test(portal),
  "sem preferência salva, abre no claro — como o formulário da Festa");
b.ok(/\[data-theme="dark"\]/.test(portal),
  "e o tema escuro continua existindo, para quem já o escolheu");

b.passo("Nenhum campo fica sem caixa visível no tema claro");
/* A varredura é sobre o CSS fora do bloco do tema escuro: lá o branco é
   legítimo. */
const cssClaro = portal.split('[data-theme="dark"]')[0];
b.ok(!/background:\s*rgba\(255,255,255,\.0[0-9]\)/.test(cssClaro),
  "nenhum fundo branco translúcido sobrou fora do tema escuro");
b.ok(!/border:\s*1px solid rgba\(255,255,255/.test(cssClaro),
  "nem borda branca translúcida");
b.ok(/\.field input::placeholder \{ color:var\(--muted\)/.test(portal),
  "o placeholder usa token, não branco cravado");
b.ok(/\.secao \{ background:var\(--blue-deep\)/.test(portal),
  "e os cards são superfície sólida — com `--surface` ficariam invisíveis no claro");

b.passo("A caixa de protocolo deixa de gritar o número");
/* Decisão do usuário na Festa em 09/09: "não é protocolo e sim uma mensagem
   simples". O formulário é usado por gente com pouca prática, e um código em
   destaque faz a pessoa achar que precisa fazer algo com ele. */
b.ok(/protNum\.style\.display = isSindicalizado \? 'none' : 'block';/.test(portal),
  "o número some para quem recebe o protocolo por e-mail");
b.ok(/protRot\.style\.display = isSindicalizado \? 'none' : 'block';/.test(portal),
  "e o rótulo 'Protocolo gerado' some junto — rótulo sem número é pior");
b.ok(/id="protocoloTitulo"/.test(portal),
  "no lugar entra uma confirmação simples");

/* A EXCEÇÃO QUE A REGRA DA FESTA NÃO PREVIA: para o não associado o
   atendimento é presencial e a mensagem manda LEVAR o protocolo à sede. Ali
   ele é acionável, e esconder seria tirar da pessoa o que ela precisa. */
b.ok(/compareça à sede/i.test(portal),
  "o caminho presencial continua pedindo o protocolo em mãos");

b.passo("A marca de erro sabe se apagar");
/* DEFEITO VISTO NO AMBIENTE PUBLICADO, não aqui: cadastro localizado, data de
   nascimento preenchida, e o campo seguia com borda vermelha. A classe
   `invalid` era adicionada quando o campo estava vazio no clique e só removida
   numa varredura que roda noutro momento.

   Marca de erro que não sabe se apagar é pior do que marca nenhuma: ensina a
   pessoa a desconfiar do vermelho, e aí o vermelho de verdade também passa
   batido. */
b.ok(/addEventListener\('input', function \(ev\)[\s\S]{0,240}classList\.remove\('invalid'\)/.test(portal),
  "digitar num campo marcado limpa a marca");
b.ok(/addEventListener\('change', function \(ev\)[\s\S]{0,240}classList\.remove\('invalid'\)/.test(portal),
  "e escolher numa data ou select também — `input` não cobre todo tipo de campo");
b.ok(/\['cpf', 'dataNascimento'\]\.forEach[\s\S]{0,160}classList\.remove\('invalid'\)/.test(portal),
  "e a busca de cadastro recomeça do zero, sem herdar erro da tentativa anterior");
/* Por delegação no document: vale para os campos de hoje e para os que
   entrarem depois, sem ninguém lembrar de ligar um a um. */
b.ok(/document\.addEventListener\('input'/.test(portal) && /document\.addEventListener\('change'/.test(portal),
  "os dois são delegados no document — campo novo já nasce coberto");

b.passo("Campos que não se aplicam não aparecem");
/* "Se for para ele mesmo (titular) não precisa da ordem do filho" e
   "situação do vínculo pode tirar" — você, 16/09/2026. */
b.ok(/tipoBeneficiario\.toUpperCase\(\) === 'TITULAR'\)/.test(
       portal.replace(/\s+/g, " ").match(/boxOrdem\.classList\.toggle[^;]+;/)[0].replace(/\s+/g," ")),
  "a ordem do filho some quando o beneficiário é o próprio titular");
b.ok(/<div class="field hidden">[\s\S]{0,700}id="situacaoVinculo"/.test(portal),
  "a situação do vínculo saiu da tela");
b.ok(/getElementById\('situacaoVinculo'\)/.test(portal),
  "mas o campo continua existindo — sete pontos do arquivo o leem, e removê-lo estouraria todos");

b.passo("O parentesco não fica preso em TITULAR");
/* Visto no seu print: tipo de beneficiário "Filho(a)" com parentesco
   "Titular". O ramo do titular gravava 'TITULAR' no campo e nada desfazia ao
   trocar para dependente — o valor errado ia junto na solicitação. */
b.ok(/String\(parentesco\.value \|\| ''\)\.toUpperCase\(\) === 'TITULAR'\)[\s\S]{0,60}parentesco\.value = '';/.test(portal),
  "ao sair de titular, o parentesco é limpo em vez de ficar com o valor velho");

b.naoTestavel("A aparência final no navegador",
  "nenhum teste daqui aplica folha de estilo; só a tela publicada responde");
b.resumo();
