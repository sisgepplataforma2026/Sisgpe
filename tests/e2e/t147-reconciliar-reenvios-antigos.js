/**
 * TESTE — RECONCILIAR OS REENVIOS FEITOS ANTES DA MARCAÇÃO EXISTIR
 *
 * O QUE ORIGINOU, 04/09/2026. A marcação de reenvio entrou em produção na
 * versão 695, às 13h14. O usuário perguntou: "se já foi reenviado ele
 * atualiza?". Não atualizava — ofício reenviado antes disso continuou como
 * FALHA_ENTREGA, e reenviar de novo só para limpar a lista faria a escola
 * receber duas vezes.
 *
 * O dado já existia: todo reenvio grava no LOG_SISTEMA com o sufixo
 * "(REENVIO)". Esta rotina usa isso para acertar o status.
 *
 * O QUE ESTE TESTE PROTEGE, e é o mais importante: que a SIMULAÇÃO não
 * escreva nada. Ela mexe na coluna que decide o que aparece como falha, numa
 * base de centenas de ofícios — rodar às cegas é o que não se desfaz.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
reg.getRange(1, 1, 1, 3).setValues([["Número do Ofício", "Escola", "Status"]]);
reg.getRange(2, 1, 4, 3).setValues([
  ["144/2026", "FAESA", "FALHA_ENTREGA"],   // reenviado antes → deve ajustar
  ["168/2026", "FAESA", "FALHA_ENTREGA"],   // reenviado antes → deve ajustar
  ["172/2026", "FAESA", "FALHA_ENTREGA"],   // NUNCA reenviado → não tocar
  ["250/2026", "FAESA", "CONFIRMADO"]       // reenviado, mas já resolvido
]);

const log = ss.insertSheet("LOG_SISTEMA");
log.getRange(1, 1, 1, 9).setValues([[
  "DATA_HORA","USUARIO","NUMERO","TIPO","ESCOLA","CNPJ","EMAIL_DESTINO","CODIGO","SISTEMA_VERSAO"
]]);
log.getRange(2, 1, 4, 9).setValues([
  [new Date(), "wanderson", "144/2026 (REENVIO)", "Filiação", "FAESA", "", "", "", ""],
  [new Date(), "wanderson", "168/2026 (REENVIO - ENDERECO SUBSTITUIDO)", "Filiação", "FAESA", "", "", "", ""],
  [new Date(), "wanderson", "250/2026 (REENVIO)", "Filiação", "FAESA", "", "", "", ""],
  [new Date(), "wanderson", "999/2026", "Filiação", "FAESA", "", "", "", ""]  // emissão, não reenvio
]);

function status(numero) {
  const d = reg.getRange(2, 1, reg.getLastRow() - 1, reg.getLastColumn()).getValues();
  for (const l of d) if (String(l[0]).trim() === numero) return String(l[2]).trim();
  return null;
}
function colunas() {
  return reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0].map(String);
}

fluxo("RECONCILIAÇÃO · simular não escreve — é a trava que torna isto seguro");
passo("simulação");

const colunasAntes = colunas().join("|");
const sim = g.reconciliarReenviosOficios(true, TOKEN);

ok(sim && sim.ok, "a simulação responde", sim && sim.mensagem);
igual(sim.simulado, true, "e diz que foi simulação");
igual(sim.ajustados, 0, "NADA foi escrito");
igual(status("144/2026"), "FALHA_ENTREGA", "o 144 continua como estava");
igual(status("168/2026"), "FALHA_ENTREGA", "e o 168 também");
igual(colunas().join("|"), colunasAntes,
      "e a estrutura da planilha não mudou — nem a coluna nova foi criada",
      "simular que altera estrutura já não é simulação");

igual(sim.ajustar.length, 2,
      "mas ela DIZ quais dois seriam ajustados");
ok(sim.ajustar.map(a => a.numero).indexOf("144/2026") > -1, "o 144 está na lista");
ok(sim.ajustar.map(a => a.numero).indexOf("168/2026") > -1, "e o 168");
ok(sim.ajustar.map(a => a.numero).indexOf("172/2026") === -1,
   "o 172 NÃO — ele nunca foi reenviado",
   "o log é a única fonte; sem registro, para o sistema não aconteceu");
ok(sim.ajustar.map(a => a.numero).indexOf("250/2026") === -1,
   "nem o 250 — já está CONFIRMADO, nada a corrigir");

ok(String(sim.mensagem).indexOf("SIMULAÇÃO") > -1,
   "e a mensagem começa dizendo que nada foi escrito");

passo("aplicação");

const apl = g.reconciliarReenviosOficios(false, TOKEN);

igual(apl.ajustados, 2, "dois ofícios ajustados");
igual(status("144/2026"), "ENVIADO", "o 144 saiu da caixa de falha");
igual(status("168/2026"), "ENVIADO", "e o 168 também");
igual(status("172/2026"), "FALHA_ENTREGA",
      "o 172 continua como falha — e tem que continuar",
      "ele nunca foi reenviado; mexer nele esconderia trabalho por fazer");
igual(status("250/2026"), "CONFIRMADO", "e o 250 não foi tocado");

ok(colunas().indexOf("JA_FALHOU") > -1,
   "a coluna JA_FALHOU nasceu na aplicação, não na simulação");

passo("a memória da falha sobreviveu");

g.ofDest_cacheHistorico_ = null;
const hm = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0].map(String);
const iJa = hm.indexOf("JA_FALHOU");
const d144 = reg.getRange(2, 1, reg.getLastRow() - 1, reg.getLastColumn()).getValues()
  .filter(l => String(l[0]).trim() === "144/2026")[0];
igual(String(d144[iJa]).trim(), "SIM",
      "o 144 guarda que JÁ FALHOU, mesmo com status ENVIADO",
      "sem isso, o endereço morto perderia a reputação e voltaria a ser sugerido");

passo("rodar de novo não faz nada");

const denovo = g.reconciliarReenviosOficios(false, TOKEN);
igual(denovo.ajustados, 0,
      "a segunda passada não ajusta ninguém — é idempotente",
      "quem já está ENVIADO não entra na conta");

passo("a porta");

/* A primeira versão fechou com `exigirModulo_`, que exige token. Ferramenta de
   manutenção que só roda do editor ficaria sem porta de entrada nenhuma — foi
   o usuário quem percebeu, procurando-a no seletor do editor. */
ok(/exigirAdminOuSessao_/.test(String(g.reconciliarReenviosOficios)),
   "aceita sessão OU administrador — roda do editor e da tela",
   "com token só, ela não rodaria em lugar nenhum");

b.bloqueia(function () {
  g.reconciliarReenviosOficios(true, "token-que-nao-existe");
}, "e continua recusando token inválido");

resumo();

/* ── acrescentado depois do pedido "tudo automatizado" ─────────────────── */
fluxo("RECONCILIAÇÃO · acontece sozinha, no gatilho que já cuida do status");
passo("o gatilho reconcilia");

/* Volta o cenário ao estado de antes: reenviado no log, falha na planilha. */
reg.getRange(2, 3).setValue("FALHA_ENTREGA");   // 144
reg.getRange(3, 3).setValue("FALHA_ENTREGA");   // 168

igual(status("144/2026"), "FALHA_ENTREGA", "o 144 voltou a aparecer como falha");

g.verificarFalhasEntregaOficios();

igual(status("144/2026"), "ENVIADO",
      "o gatilho reconciliou sozinho — ninguém precisou lembrar de rodar nada");
igual(status("168/2026"), "ENVIADO", "e o 168 também");
igual(status("172/2026"), "FALHA_ENTREGA",
      "e o que nunca foi reenviado continua como falha",
      "automatizar não pode virar esconder trabalho por fazer");

passo("não é em silêncio");

const logSis = ss.getSheetByName("LOG_SISTEMA");
const linhasLog = logSis.getRange(2, 1, logSis.getLastRow() - 1, 9).getValues();
const registro = linhasLog.filter(l => String(l[3]) === "OFICIOS_REENVIO_RECONCILIADO");
ok(registro.length >= 1,
   "o ajuste automático fica gravado no log de sistema",
   "imposição em silêncio é o que a REGRA Nº 0.6 proíbe");
ok(String(registro[0][7]).indexOf("144/2026") > -1,
   "e diz QUAIS ofícios foram ajustados",
   String(registro[0][7]));

passo("a ordem dentro do gatilho");

const fonteGatilho = String(g.verificarFalhasEntregaOficios).replace(/\s+/g, " ");
const semCom = fonteGatilho.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
ok(semCom.indexOf("oficio_reconciliarReenvios_") < semCom.indexOf("MON_OFICIOS_getSS_"),
   "reconcilia ANTES de verificar bounce",
   "o ofício reconciliado vira ENVIADO, e só assim é examinado na MESMA execução");

/* O que importa não é a distância em caracteres, e sim que o tratamento de
   erro FECHE antes de a função seguir para a obrigação dela. */
const trechoEntre = semCom.slice(
  semCom.indexOf("oficio_reconciliarReenvios_"),
  semCom.indexOf("MON_OFICIOS_getSS_"));
ok(/catch\s*\(/.test(trechoEntre),
   "e a reconciliação vai em try próprio, fechado antes do resto",
   "falhar nela não pode impedir a verificação de bounce, que é a obrigação");

resumo();
