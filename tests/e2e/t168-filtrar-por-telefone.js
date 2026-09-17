/**
 * TESTE — PROCURAR PELO TELEFONE, DO JEITO QUE A PESSOA DIGITA
 *
 * O QUE ORIGINOU, 14/09/2026. Descrevendo a operação da fila, ele listou o
 * que a tela precisa ter:
 *
 *   "Lá deveria ter filtro para eu filtrar por nome, por escola, por cidade,
 *    filtrar por telefone."
 *
 * Nome, escola e cidade já filtravam. Telefone, não — e é justamente o que se
 * tem na mão quando a pessoa LIGA perguntando do ingresso dela. O e-mail e o
 * número do ingresso entraram pelo mesmo motivo.
 *
 * O PROBLEMA QUE UM `indexOf` SIMPLES NÃO RESOLVE. O telefone está gravado
 * como "27999161454" e a secretaria digita "(27) 99916-1454", ou "99916-1454",
 * ou cola de algum lugar com o 55 na frente. Comparar texto com texto acha
 * zero. Por isso há uma segunda comparação, só de dígitos.
 *
 * E O RISCO DELA, que este teste vigia: juntar todos os dígitos da linha num
 * bolo só faria o fim do CPF colar no começo do telefone e casar com uma
 * busca que não existe em campo nenhum. Cada campo entra separado por espaço.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA: a caixa de busca da tela. Aqui se prova o
 * filtro do servidor, que é onde a decisão acontece.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ADM = b.logar(g, "wanderson");

/* ─── Firestore em memória (mesmo padrão do t165) ────────────────────────── */
const BANCO = new Map();
const chave = (col, id) => col + "/" + id;
const clonar = o => JSON.parse(JSON.stringify(o));

g.fs_set_ = (col, id, obj) => { BANCO.set(chave(col, id), clonar(obj)); return { ok: true }; };
g.fs_get_ = (col, id) => { const v = BANCO.get(chave(col, id)); return v ? clonar(v) : null; };
g.fs_list_ = (col) => {
  const out = [];
  BANCO.forEach((v, k) => { if (k.indexOf(col + "/") === 0) out.push(clonar(v)); });
  return out;
};
g.fs_queryEquals_ = (col, campo, valor) =>
  g.fs_list_(col).filter(d => String(d[campo]) === String(valor));

const EV = g.EMISSAO_CFG.EVENTO_ID;

function inscrever(id, dados) {
  g.fs_set_("inscricoesEventos", id, Object.assign({
    inscricaoId: id, eventoId: EV, status: "", criadoEm: new Date().toISOString()
  }, dados));
}

BANCO.clear();
inscrever("INS-1", { nome: "MARCELHA ALINE PINTO GOMES", cpf: "08029739737",
                     escola: "Favi", cidade: "Vitória",
                     whatsapp: "27999161454", email: "secretaria@sindeducacao.com",
                     numeroIngresso: "FCV-2026-000002", ingressoId: "ING-2" });
inscrever("INS-2", { nome: "WANDERSON NASCIMENTO CASTELO", cpf: "08538104780",
                     escola: "UVV - Vila Velha", cidade: "VITÓRIA",
                     whatsapp: "27999451089", email: "wandersoncastelo39@gmail.com" });

const achar = termo =>
  g.compasso_validacaoListar_interno_({ busca: termo }).map(x => x.nome);

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O telefone acha a pessoa, digitado de qualquer jeito");

passo("do jeito que está gravado");
igual(achar("27999161454").length, 1, "acha uma");
igual(achar("27999161454")[0], "MARCELHA ALINE PINTO GOMES", "e é a certa");

passo("e do jeito que a tela mostra, com parêntese e traço");
igual(achar("(27) 99916-1454")[0], "MARCELHA ALINE PINTO GOMES",
      "'(27) 99916-1454' encontra quem está gravado como 27999161454");

passo("só o final do número também serve");
igual(achar("99916-1454")[0], "MARCELHA ALINE PINTO GOMES",
      "é como quem atende anota o retorno de uma ligação");

passo("e o número do outro acha o outro, não os dois");
igual(achar("99945-1089").length, 1, "um resultado");
igual(achar("99945-1089")[0], "WANDERSON NASCIMENTO CASTELO", "o dono do número");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que mais entrou junto");

igual(achar("secretaria@sindeducacao.com")[0], "MARCELHA ALINE PINTO GOMES",
      "e-mail — é por ele que se procura quando a inscrição veio por e-mail");
igual(achar("FCV-2026-000002")[0], "MARCELHA ALINE PINTO GOMES",
      "número do ingresso — a pessoa liga com o número na mão");
igual(achar("080.297.397-37")[0], "MARCELHA ALINE PINTO GOMES",
      "CPF pontuado, que antes desta mudança também não achava");

passo("e o que já funcionava continua funcionando");
igual(achar("marcelha")[0], "MARCELHA ALINE PINTO GOMES", "nome, sem caixa alta");
igual(achar("favi")[0], "MARCELHA ALINE PINTO GOMES", "escola");
igual(achar("vitória").length, 2, "cidade acha as duas");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A busca por dígitos não inventa resultado");

/* O CPF da Marcelha termina em 737 e o WhatsApp começa com 279. Se os campos
   fossem colados num bolo só, "737279" acharia a linha — e esse número não
   existe em campo nenhum. */
passo("dígito do fim de um campo não cola no começo do outro");
igual(achar("737279").length, 0,
      "não acha nada, porque esse número não é de ninguém");

passo("e uma busca curta demais não liga a comparação por dígito");
/* Com dois dígitos, "27" casaria com os dois telefones e os dois CPFs — a
   base inteira. Por isso a comparação por dígito só entra a partir de três.
   "(27)" prova a trava: como texto não existe em campo nenhum (ninguém grava
   parêntese), só o caminho dos dígitos poderia encontrá-lo — e ele está
   desligado nesse tamanho.
   Nota do que NÃO mudou: procurar por "2" continua achando gente, porque a
   comparação de TEXTO sempre foi por pedaço e já era assim antes desta
   mudança. A trava é da comparação nova, não da antiga. */
igual(achar("(27)").length, 0,
      "'(27)' não acha ninguém — dois dígitos não acionam a busca numérica");
igual(achar("(27) 99916").length, 1,
      "mas com dígitos suficientes o parêntese deixa de atrapalhar");

passo("quem não existe continua não existindo");
igual(achar("27988887777").length, 0, "telefone de ninguém");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("A caixa de busca da tela",
  "aqui se prova o filtro do servidor. Que a palavra digitada chega nele, e " +
  "que o rótulo do campo diz que dá para procurar por telefone, só o " +
  "navegador responde.");

resumo();
