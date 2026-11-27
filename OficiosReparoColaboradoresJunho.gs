/**
 * REPARO PONTUAL — `Colaborador(es)` vazio nos ofícios 215–234 de junho/2026 (27/11/2026). CÓDIGO NOVO, DESCARTÁVEL.
 *
 * Causa (provada na planilha de produção, aba Controle): as linhas desses ofícios foram gravadas SEM Escola, e-mails e
 * Colaborador(es); por isso o reenvio com seleção de pessoas dizia "Os nomes deste ofício não estão no Registro".
 * Os nomes vêm dos próprios PDFs dos ofícios (lidos em 27/11/2026). O usuário autorizou: "Faça".
 *
 * COMO USAR (editor do Apps Script de PRODUÇÃO, depois Execuções → Registro):
 *   1. executar `oficiosReparoColaboradoresJunhoConferirSISGEP`  — SÓ LÊ; diz o que faria em cada ofício;
 *   2. conferido, executar `oficiosReparoColaboradoresJunhoAplicarSISGEP` — grava.
 * REGRAS DE SEGURANÇA: só preenche célula `Colaborador(es)` que esteja VAZIA; nunca sobrescreve; confere o TIPO do ofício;
 * se o número aparecer em mais de uma linha, preenche só a primeira (a que o reenvio usa) e avisa; não toca em nenhuma outra
 * coluna, aba ou função. O log mostra números e quantidades, nunca os nomes.
 * Pode ser apagado depois de rodado (os nomes ficam na planilha).
 */
var OFR_REPARO_JUNHO_ = [
  ["215/2026", "Filiação", ["JOSIANE ALVES BARROSO DOS SANTOS"]],
  ["216/2026", "Filiação", ["GABRIELA DA SILVA DIAS OLIVEIRA"]],
  ["220/2026", "Filiação", ["HERYKA SOARES DA SILVA", "MARIA EDUARDA GORETE ALVES", "TATIANE CORREA LOUREIRO"]],
  ["221/2026", "Filiação", ["RAPHAEL GUERRA DE OLIVEIRA ALVES"]],
  ["222/2026", "Filiação", ["DAVI BARCELLOS COSTABEBER"]],
  ["223/2026", "Filiação", ["CLEBER PAIZANTE DA ROCHA", "SABRINA SACHL DOS SANTOS FERREIRA"]],
  ["224/2026", "Filiação", ["SIARA ARAUJO RIBEI"]],
  ["225/2026", "Desfiliação", ["LARISSA SILVA MORAES", "JANITA ELISA DA SILVA AYRES", "SOLANGE MARTINS DE LIMA SANTOS"]],
  ["226/2026", "Filiação", ["BARBARA GUIMARÃES SILVA PIRES"]],
  ["227/2026", "Filiação", ["RAMON MUNIZ NASCIMENTO"]],
  ["228/2026", "Filiação", ["MIRIA CARDOSOCORDEIRO"]],
  ["229/2026", "Filiação", ["MANOEL LEANDROGAMA DE JESUS"]],
  ["231/2026", "Filiação", ["PRISCILA DE SOUZA NASCIMENTO RAMOS"]],
  ["232/2026", "Filiação", ["MYLLENA SANTOS DA SILVA", "CAMILA SILVA DOS SANTOS"]],
  ["233/2026", "Filiação", ["DAVI RODRIGUES DO NASCIMENTO"]],
  ["234/2026", "Desfiliação", ["ELEIDE BORTOLOZZO CAVALIERE MAULAZ"]]
];

function ofrReparoJunho_(aplicar) {
  var L = [], ok = 0, pulou = 0, problema = 0;
  L.push("═══ REPARO Colaborador(es) — ofícios de junho/2026 — " + (aplicar ? "APLICANDO" : "CONFERINDO (nada é gravado)") + " ═══");
  var lock = LockService.getScriptLock();
  if (aplicar && !lock.tryLock(20000)) { L.push("Outra execução está em andamento. Tente de novo."); Logger.log(L.join("\n")); return L; }
  try {
    var ss = SpreadsheetApp.openById(typeof getPlanilhaId === "function" ? getPlanilhaId() : PLANILHA_ID);
    var sh = ss.getSheetByName(PLANILHA_REGISTRO);
    if (!sh || sh.getLastRow() < 2) { L.push("ERRO: aba do Registro vazia ou ausente."); Logger.log(L.join("\n")); return L; }
    var hm = getHeaderMap_(sh);
    var cNum = hm["Número do Ofício"], cTipo = hm["Tipo"] || hm["TIPO"], cCol = hm["Colaborador(es)"];
    if (!cNum || !cCol) { L.push("ERRO: não achei a coluna 'Número do Ofício' ou 'Colaborador(es)'. Nada foi feito."); Logger.log(L.join("\n")); return L; }
    var dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    OFR_REPARO_JUNHO_.forEach(function (it) {
      var num = it[0], tipoEsperado = it[1], nomes = it[2];
      var linhas = [];
      for (var i = 0; i < dados.length; i++) if (String(dados[i][cNum - 1] || "").trim() === num) linhas.push(i);
      if (!linhas.length) { L.push(num + ": ✖ NÃO ENCONTRADO no Registro — não mexi."); problema++; return; }
      var i0 = linhas[0], aviso = linhas.length > 1 ? " (⚠ número em " + linhas.length + " linhas; só a primeira é preenchida)" : "";
      var tipoLinha = cTipo ? String(dados[i0][cTipo - 1] || "").trim() : "";
      var semAcento = function (x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); };
      if (cTipo && tipoLinha && semAcento(tipoLinha) !== semAcento(tipoEsperado)) {
        L.push(num + ": ✖ TIPO DIFERENTE (" + tipoLinha + " ≠ " + tipoEsperado + ") — não mexi." + aviso); problema++; return;
      }
      if (String(dados[i0][cCol - 1] || "").trim() !== "") { L.push(num + ": já tem Colaborador(es) — não mexi." + aviso); pulou++; return; }
      var texto = nomes.map(function (n, k) { return (k + 1) + ". " + n; }).join("\n");
      if (aplicar) { sh.getRange(i0 + 2, cCol).setValue(texto); L.push(num + ": ✔ preenchido com " + nomes.length + " nome(s) (linha " + (i0 + 2) + ")." + aviso); }
      else L.push(num + ": ▶ preencheria " + nomes.length + " nome(s) na linha " + (i0 + 2) + "." + aviso);
      ok++;
    });
    if (aplicar) { try { SpreadsheetApp.flush(); } catch (eF) {} try { ofDest_cacheRegistro_ = null; } catch (eC) {} }
  } finally { if (aplicar) { try { lock.releaseLock(); } catch (eL) {} } }
  L.push("— " + (aplicar ? "preenchidos: " : "a preencher: ") + ok + " · já tinham: " + pulou + " · problemas: " + problema + " (de " + OFR_REPARO_JUNHO_.length + ") —");
  Logger.log(L.join("\n"));
  return L;
}

/* TRAVA: só roda no EDITOR, pelo dono do projeto. De uma tela (google.script.run) quem dispara é o visitante — vazio ou outra
   pessoa —, e então recusa. Sem isto, qualquer sessão poderia chamar uma função de escrita direto.
   27/11/2026: quando a trava recusava, NADA aparecia no Registro e parecia que a função "não fez nada". Agora ela SEMPRE escreve o
   motivo (com o e-mail mascarado), para o usuário ver por que recusou. */
function ofrReparoMascara_(e) { e = String(e || ""); return e ? e.slice(0, 3) + "***@" + (e.split("@")[1] || "?") : "(vazio)"; }
function ofrReparoDonoNoEditor_() {
  var ativo = "", efetivo = "";
  try { ativo = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e1) {}
  try { efetivo = String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e2) {}
  var ok = !!ativo && ativo === efetivo;
  Logger.log("Reparo Colaborador(es): quem executa = " + ofrReparoMascara_(ativo) + " · conta do projeto = " + ofrReparoMascara_(efetivo) + " → " + (ok ? "liberado" : "RECUSADO"));
  return ok;
}
function ofrReparoRecusa_() {
  var msg = "Sem permissão: só roda no editor do Apps Script, pelo dono do projeto. Veja a linha acima no Registro: 'quem executa' precisa ser igual a 'conta do projeto'.";
  Logger.log(msg);
  return { erro: true, mensagem: msg };
}
function oficiosReparoColaboradoresJunhoConferirSISGEP() {
  if (!ofrReparoDonoNoEditor_()) return ofrReparoRecusa_();
  return ofrReparoJunho_(false);
}
function oficiosReparoColaboradoresJunhoAplicarSISGEP() {
  if (!ofrReparoDonoNoEditor_()) return ofrReparoRecusa_();
  return ofrReparoJunho_(true);
}
