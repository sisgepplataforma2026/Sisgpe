/**
 * O SCRIPT ID DA HOMOLOGAÇÃO É UM SÓ, NO REPOSITÓRIO INTEIRO
 *
 * O QUE ORIGINOU — E POR QUE MERECE UM TESTE PRÓPRIO
 *
 * O mesmo defeito aconteceu DUAS VEZES em 20/08/2026, com um dia de
 * depuração entre uma e outra:
 *
 *   1ª  os workflows de deploy traziam o ID com "l" minúsculo na posição 41,
 *       onde o projeto real tem "I" maiúsculo. Corrigido no commit 5e30919.
 *
 *   2ª  scripts/deploy-documentos-security-hml.js nasceu com o MESMO erro,
 *       na MESMA posição. Nunca implantou uma vez sequer; o erro ficou
 *       registrado em .ci/security-documentos-hml-deploy-error.json.
 *
 * POR QUE ELE VOLTA. "I" (U+0049) e "l" (U+006C) são desenhados igual em
 * quase toda fonte de tela. Conferir a olho não funciona — nem uma vez, nem
 * na décima. E a resposta da API não ajuda: "Request contains an invalid
 * argument", sem dizer que o problema é o ID.
 *
 * O QUE ESTE TESTE FAZ. Varre o repositório atrás de qualquer coisa com
 * forma de Script ID e exige que todas sejam byte a byte iguais à
 * referência. Máquina comparando bytes é o único método que funciona aqui.
 *
 * O VALOR DE REFERÊNCIA vem do workflow que implanta de verdade
 * (deploy-homologacao.yml), não de digitação minha.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");

/* Forma de um Script ID do Apps Script: prefixo estável deste projeto
   seguido de caracteres do alfabeto de ID. Amplo de propósito — a graça é
   pegar o ERRADO também, não só o certo. */
const FORMA = /1S_[A-Za-z0-9_-]{45,60}/g;

/** Arquivos de texto do repositório, sem entrar em node_modules nem .git. */
function varrer(dir, achados) {
  achados = achados || [];
  for (const nome of fs.readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".git") continue;
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) { varrer(p, achados); continue; }
    if (!/\.(gs|html|js|yml|yaml|json|md)$/.test(nome)) continue;
    if (st.size > 2 * 1024 * 1024) continue;
    achados.push(p);
  }
  return achados;
}

fluxo("DEPLOY · Um único Script ID de homologação em todo o repositório");

const arquivos = varrer(RAIZ);

/* ─── a referência sai do workflow que funciona ─── */
passo("referência");
const wf = fs.readFileSync(
  path.join(RAIZ, ".github/workflows/deploy-homologacao.yml"), "utf8");
const REFERENCIA = (wf.match(FORMA) || [])[0] || "";

ok(REFERENCIA.length > 40,
   "o workflow de deploy tem um Script ID de onde tirar a referência",
   REFERENCIA || "(não achado — o workflow mudou de forma?)");

ok(REFERENCIA.charAt(41) === "I",
   "e na posição 41 ele tem \"I\" maiúsculo, não \"l\" minúsculo",
   "posição 41 = \"" + REFERENCIA.charAt(41) + "\" (U+" +
   REFERENCIA.charCodeAt(41).toString(16).toUpperCase().padStart(4, "0") + ")");

/* ─── todas as ocorrências têm de bater ─── */
passo("varredura");
const divergentes = [];
let totalOcorrencias = 0;

arquivos.forEach(function (p) {
  const txt = fs.readFileSync(p, "utf8");
  const achados = txt.match(FORMA);
  if (!achados) return;
  achados.forEach(function (id) {
    totalOcorrencias++;
    if (id === REFERENCIA) return;
    /* Onde diverge? Dizer a posição e o código do caractere é o que
       transforma isto em conserto de trinta segundos. */
    let onde = -1;
    for (let i = 0; i < Math.max(id.length, REFERENCIA.length); i++) {
      if (id[i] !== REFERENCIA[i]) { onde = i; break; }
    }
    divergentes.push({
      arquivo: path.relative(RAIZ, p),
      id: id,
      posicao: onde,
      achou: id[onde],
      esperava: REFERENCIA[onde]
    });
  });
});

ok(totalOcorrencias > 0,
   "a varredura achou Script IDs para conferir",
   totalOcorrencias + " ocorrências em " + arquivos.length + " arquivos");

/* .ci/*-error.json guarda o registro de uma falha PASSADA. O ID errado ali
   dentro é a prova do que aconteceu, não um alvo vivo — apagar seria apagar
   a evidência. Fica de fora da exigência, e o teste diz que ficou. */
const vivos = divergentes.filter(function (d) { return !/^\.ci\//.test(d.arquivo); });
const registros = divergentes.filter(function (d) { return /^\.ci\//.test(d.arquivo); });

igual(vivos.map(function (d) {
  return d.arquivo + " (posição " + d.posicao + ": achou \"" + d.achou +
         "\", esperava \"" + d.esperava + "\")";
}), [], "nenhum arquivo vivo traz um Script ID diferente da referência");

if (registros.length) {
  ok(true, "registros de falha em .ci/ ficam como estão",
     registros.length + " ocorrência(s) — é a evidência do erro passado, " +
     "não um alvo de deploy");
}

/* ─── o deploymentId, SÓ no ferramental de deploy ───────────────────────
   Diferente do scriptId, um deploymentId NÃO é único no repositório: o
   sistema aponta legitimamente para outros web apps publicados. Medido:
   AKfycbzgPBSS… aparece em Visitas.gs, BeneficiosAdmin.html e
   Parquechinaadmin.html — é a URL do web app de Visitas de campo
   (Visitas.gs:1654), outro aplicativo, e tem de continuar diferente.

   A primeira versão desta asserção varria o repositório inteiro e reprovava
   nesses três. Um teste que acusa o comportamento correto não protege nada:
   ou é desligado, ou ensina a ignorar vermelho. Escopo certo é o ferramental
   que implanta na homologação — ali, sim, o valor é um só. */
passo("deploymentId do ferramental de deploy");
const FORMA_DEP = /AKfycb[A-Za-z0-9_-]{60,90}/g;
const refDep = (wf.match(FORMA_DEP) || [])[0] || "";
const WF_PRODUCAO = ".github/workflows/deploy-producao.yml";
const DEP_PRODUCAO =
  "AKfycbzgPBSSF3D2OimoEJ-qMfDNp_Dsmc95THSNdUvFgqoX7NXWcmn7ZDMzF9L-OyUbEMw_ew";
const depDivergentes = [];
let totalDepProducao = 0;

arquivos.forEach(function (p) {
  const rel = path.relative(RAIZ, p);
  if (!/^(\.github\/workflows|scripts)\//.test(rel)) return;
  const achados = fs.readFileSync(p, "utf8").match(FORMA_DEP);
  if (!achados) return;
  achados.forEach(function (d) {
    if (rel === WF_PRODUCAO) {
      totalDepProducao++;
      if (d !== DEP_PRODUCAO) depDivergentes.push(rel + ": " + d);
      return;
    }
    if (d !== refDep) depDivergentes.push(rel + ": " + d);
  });
});

ok(refDep.length > 50, "o workflow tem um deploymentId de referência",
   refDep ? refDep.slice(0, 24) + "…" : "(não achado)");
ok(totalDepProducao === 1,
   "o workflow de Produção traz exatamente o deploymentId aprovado",
   totalDepProducao + " ocorrência(s)");
igual(depDivergentes, [],
      "cada workflow usa somente o deploymentId aprovado para seu ambiente");

resumo();
