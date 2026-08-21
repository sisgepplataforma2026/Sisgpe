/**
 * A PORTA DE ENTRADA: SIMPLES PARA O ASSOCIADO, FECHADA PARA QUEM VARRE
 *
 * O QUE ORIGINOU
 *
 * 21/08/2026. O usuário descreveu como quer a inscrição: "a gente encaminha um
 * link pra ele... vai encaminhar na nossa lista de transmissão, vai colocar no
 * site, e nesse link ele vai fazer a inscrição onde coloca o nome dele, escola,
 * CPF, identidade, qual é a cidade, tem um termo de ciência".
 *
 * E o requisito que governa tudo: "que seja simples porque nem todo associado
 * tem tanta habilidade com informática. Agora que seja simples, mas que seja
 * confiável."
 *
 * AS DUAS COISAS QUE BRIGAM ENTRE SI, E COMO FICARAM
 *
 * SIMPLES quer dizer que a pessoa digita o CPF e o resto nasce preenchido —
 * sete campos viram um. CONFIÁVEL quer dizer que esse mesmo mecanismo não pode
 * virar uma porta para colher a base: o link vai para lista de transmissão e
 * para o site, então `compasso_inscricaoPreencher` é um endpoint público que
 * responde dados de uma pessoa a partir de um CPF.
 *
 * A solução tem duas camadas, e o teste guarda as duas:
 *
 *   1. TETO de consultas por navegador. Não impede um ataque decidido — não há
 *      IP no Apps Script — mas encarece varrer 8.000 CPFs.
 *
 *   2. E-MAIL E TELEFONE VOLTAM MASCARADOS. É a que realmente importa, porque
 *      tira o VALOR do que se colheria. E o valor real nunca sai do servidor:
 *      se a pessoa não mexer no campo, o próprio servidor usa o do cadastro.
 *
 * O CPF É CONFERIDO COM DÍGITO VERIFICADOR
 *
 * Numa tela pública, validar só o tamanho deixa passar erro de digitação que
 * só aparece na portaria — quando já não dá para corrigir. O teste EXECUTA a
 * função contra CPFs válidos e inválidos conhecidos.
 *
 * MUTAÇÕES MATADAS (21/08/2026)
 *
 *   1. validar CPF só pelo tamanho ............................. 3 falhas
 *   2. aceitar CPF de dígitos repetidos ........................ 1 falha
 *   3. devolver e-mail e telefone SEM máscara .................. 2 falhas
 *   4. a máscara virar dado gravado ............................ 1 falha
 *   5. tirar o teto de consultas ............................... 1 falha
 *   6. aceitar inscrição sem o termo ........................... 1 falha
 *   7. deixar inscrever duas vezes com o mesmo CPF ............ 3 falhas
 *  7b. parar de gravar o índice de unicidade ................. 3 falhas
 *   8. não devolver a vaga quando a gravação falha ............. 1 falha
 *   9. voltar a ler a planilha por getActiveSpreadsheet ....... 2 falhas
 *  10. a tela destruir o valor mascarado ...................... 1 falha
 *
 * O QUE A MUTAÇÃO CORRIGIU NO PRÓPRIO TESTE
 *
 * A mutação 7 SOBREVIVEU na primeira rodada — justo a trava que o usuário
 * pediu nominalmente ("que não tenha duplicidade"). A asserção procurava as
 * strings 'inscricaoUnicaEventos' e 'Já existe uma inscrição' no corpo da
 * função; trocando a condição do `if` por `false`, os textos continuavam lá e
 * o teste continuava verde.
 *
 * Agora a duplicidade é EXECUTADA contra um banco de mentira: inscreve o mesmo
 * CPF duas vezes e exige que a segunda seja recusada E que nada seja gravado.
 * Isso matou a 7 e revelou a 7b, que eu não tinha previsto.
 */
const fs = require("fs");
const path = require("path");
const { fluxo, passo, ok, igual, aviso, resumo } = require("./base");

const RAIZ = path.resolve(__dirname, "..", "..");
const ler = a => fs.readFileSync(path.join(RAIZ, a), "utf8");
const semComentario = s => s
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const insc = semComentario(ler("EventosInscricaoPublica.gs"));
const tela = ler("CompassoInscricaoPublica.html");
const code = semComentario(ler("Code.gs"));

function corpoDe(codigo, nome) {
  const re = new RegExp("^function\\s+" + nome + "\\s*\\(([^)]*)\\)\\s*\\{", "m");
  const m = re.exec(codigo);
  if (!m) throw new Error(nome + " não encontrada");
  let prof = 1, i = m.index + m[0].length;
  while (i < codigo.length && prof > 0) {
    const c = codigo[i];
    if (c === "{") prof++; else if (c === "}") prof--;
    i++;
  }
  return codigo.slice(m.index + m[0].length, i - 1);
}
/** Roda uma função do .gs de verdade, com as dependências injetadas. */
function rodar(nome, args, deps) {
  deps = deps || {};
  const nomes = Object.keys(deps);
  return new Function(...args.nomes, ...nomes, corpoDe(insc, nome))(
    ...args.valores, ...nomes.map(n => deps[n]));
}

fluxo("INSCRIÇÃO PÚBLICA · Simples para o associado, fechada para quem varre");

/* ─── 1. o CPF é conferido de verdade ─── */
passo("dígito verificador, não só tamanho");

const cpfValido = v => rodar("compasso_cpfValido_", { nomes: ["cpf"], valores: [v] });

/* CPFs válidos conhecidos (dígitos verificadores corretos). */
[["111.444.777-35", true],
 ["529.982.247-25", true],
 ["111.444.777-30", false],   // último dígito trocado
 ["529.982.247-20", false],
 ["12345678901",    false],
 ["111",            false],
 ["",               false]].forEach(([v, esperado]) => {
  igual(cpfValido(v), esperado,
        "CPF " + (v || "(vazio)") + " → " + (esperado ? "aceita" : "recusa"));
});

igual(cpfValido("111.111.111-11"), false,
      "CPF de dígitos repetidos → recusa",
      "passa na conta do dígito verificador, mas não existe");

/* ─── 2. A TRAVA: o preenchimento não pode virar colheita ─── */
passo("o que volta para uma página pública");

/* A marca vem do PRÓPRIO arquivo, não escrita à mão aqui: se ela mudar no
   .gs, o teste acompanha em vez de passar a medir um caractere que não existe
   mais. */
const MARCA = eval((insc.match(/COMPASSO_MARCA_MASCARA = ('[^']*')/) || [])[1] || "'\u2022'");

const mascararEmail = v => rodar("compasso_mascararEmail_",
      { nomes: ["email"], valores: [v] }, { COMPASSO_MARCA_MASCARA: MARCA });
const mascararTel   = v => rodar("compasso_mascararTelefone_",
      { nomes: ["tel"], valores: [v] }, { COMPASSO_MARCA_MASCARA: MARCA });

const mEmail = mascararEmail("mariaaparecida@gmail.com");
ok(mEmail.indexOf("mariaaparecida") < 0 && mEmail.indexOf("@gmail.com") > 0,
   "o e-mail volta mascarado, mas reconhecível: " + mEmail,
   "quem varre não leva contato; quem é dona reconhece o próprio");

const mTel = mascararTel("(27) 99876-5432");
ok(mTel.indexOf("98765") < 0 && mTel.indexOf("5432") > 0 && mTel.indexOf("27") > 0,
   "e o telefone também: " + mTel);

igual(mascararEmail("semarroba"), "", "texto que não é e-mail volta vazio");
igual(mascararTel("123"), "", "número curto demais volta vazio");

const preencher = corpoDe(insc, "compasso_inscricaoPreencher");
ok(/compasso_mascararEmail_/.test(preencher) && /compasso_mascararTelefone_/.test(preencher),
   "o endpoint público só devolve valores mascarados",
   "é a trava que tira o VALOR do que se colheria");

ok(!/email:\s*busca\.email/.test(preencher) && !/whatsapp:\s*busca\.whatsapp/.test(preencher),
   "e nunca o valor cru do cadastro");

ok(/compasso_podeConsultar_/.test(preencher),
   "há teto de consultas por navegador",
   "não impede ataque decidido — não há IP no Apps Script — mas encarece varrer 8.000");

/* ─── 3. a máscara nunca vira dado gravado ─── */
passo("o que a máscara faz quando volta");

const valorMascarado = (dig, cad) =>
  rodar("compasso_valorMascarado_", { nomes: ["digitado", "doCadastro"], valores: [dig, cad] },
        { COMPASSO_MARCA_MASCARA: MARCA });

igual(valorMascarado("m" + MARCA + MARCA + MARCA + "a@gmail.com", "mariaaparecida@gmail.com"),
      "mariaaparecida@gmail.com",
      "campo não tocado → grava o valor REAL do cadastro",
      "a máscara é para os olhos da pessoa, nunca para o banco");

igual(valorMascarado("outro@email.com", "mariaaparecida@gmail.com"),
      "outro@email.com",
      "campo corrigido pela pessoa → grava o que ela digitou");

const inscrever = corpoDe(insc, "compasso_inscrever");
ok(/compasso_valorMascarado_\(dados\.email/.test(inscrever) &&
   /compasso_valorMascarado_\(dados\.whatsapp/.test(inscrever),
   "e a inscrição resolve a máscara ANTES de validar",
   "senão 'm••••a@gmail.com' levaria erro de e-mail inválido num campo que estava certo");

/* ─── 4. o que a inscrição recusa ─── */
passo("as recusas do servidor");

ok(/if \(!dados\.termoAceito\)/.test(inscrever),
   "sem o termo aceito, recusa");

ok(/termoVersao: cfg\.termoVersao/.test(inscrever) &&
   /termoHash: compasso_hash_\(cfg\.termo\)/.test(inscrever),
   "e grava a VERSÃO e o HASH do texto aceito",
   "se alguém contestar depois, prova qual redação leu");

ok(/!email && !whats/.test(inscrever),
   "recusa quem não deixa e-mail nem WhatsApp",
   "seria um registro sem como ser entregue — a pessoa só descobriria na festa");

ok(/if \(!cfg\.aberta\)/.test(inscrever),
   "e respeita o período e as vagas");

const criar = corpoDe(insc, "compasso_criarInscricaoAssociado_publica_");

/* A DUPLICIDADE É EXECUTADA, não lida. A primeira versão desta asserção
   procurava as strings 'inscricaoUnicaEventos' e 'Já existe uma inscrição' no
   corpo — e a mutação passou por cima dela: trocando a condição do if por
   `false`, os textos continuavam lá e o teste continuava verde. A trava que o
   usuário pediu nominalmente ("que não tenha duplicidade") não pode depender
   de eu ter lido o código direito. */
function mundoDeInscricao() {
  const banco = { inscricoesEventos: {}, inscricaoUnicaEventos: {}, reservasEventos: {} };
  const EMISSAO_CFG = { EVENTO_ID: "festa-compasso-2026", LIMITE_VAGAS: 2000 };
  let reservadas = 0;
  return {
    banco,
    deps: {
      EMISSAO_CFG,
      COMPASSO_STATUS: { RECEBIDA: "RECEBIDA" },
      LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
      Utilities: { getUuid: () => "uuid-" + Math.random().toString(36).slice(2) },
      fs_get_: (col, id) => banco[col][id] || null,
      fs_set_: (col, id, obj) => { banco[col][id] = obj; },
      compasso_inscricaoChave_: (pid, cpf) => "chave:" + cpf,
      compasso_hash_: t => "hash:" + t,
      compasso_auditar_: () => {},
      compasso_lerReservaVagas_: () => ({ limite: 2000, reservadas: reservadas }),
      compasso_reservarVagaInscricao_: () => {
        if (reservadas >= 2000) return { ok: false, erro: "Vagas de inscrição esgotadas." };
        reservadas++;
        return { ok: true, reserva: { limite: 2000, reservadas: reservadas } };
      }
    }
  };
}

function inscreverNoMundo(mundo, cpf) {
  const nomes = Object.keys(mundo.deps);
  return new Function("payload", ...nomes, criar)(
    { nome: "Maria Silva", cpf: cpf, escola: "EEEFM Centro", cidade: "Vitória",
      email: "m@x.com", whatsapp: "27999999999", origem: "INSCRICAO_PUBLICA",
      situacaoAssociado: "ASSOCIADO", termoVersao: "2026.1",
      termoHash: "h", termoAceitoEm: new Date() },
    ...nomes.map(n => mundo.deps[n]));
}

const m1 = mundoDeInscricao();
const primeira = inscreverNoMundo(m1, "11144477735");
ok(primeira && primeira.ok, "a primeira inscrição passa");

const segunda = inscreverNoMundo(m1, "11144477735");
igual(segunda.ok, false,
      "e a SEGUNDA com o mesmo CPF é recusada",
      "é a trava de duplicidade que o usuário pediu nominalmente");
ok(/Já existe uma inscrição com este CPF/.test(segunda.erro || ""),
   "com mensagem que a pessoa entende: " + (segunda.erro || "").slice(0, 60));

/* E a vaga não pode ser consumida duas vezes pela mesma pessoa. */
igual(Object.keys(m1.banco.inscricoesEventos).length, 1,
      "e a segunda tentativa não gravou inscrição nenhuma",
      "recusar sem gravar é o que impede a mesma pessoa comer duas das 2.000");

/* CPF diferente entra normalmente — a trava é de duplicidade, não de bloqueio. */
const outra = inscreverNoMundo(m1, "52998224725");
ok(outra && outra.ok, "outro CPF continua entrando normalmente");

ok(/LockService\.getScriptLock/.test(criar),
   "tudo sob LockService");

ok(/rr\.reservadas = Math\.max\(0, Number\(rr\.reservadas \|\| 0\) - 1\)/.test(criar),
   "falha de gravação DEVOLVE a vaga",
   "sem isso, uma das 2.000 sumiria para sempre e ninguém saberia por quê");

/* ─── 5. lê a planilha do ambiente certo ─── */
passo("de onde vêm os 8.000");

const busca = corpoDe(insc, "compasso_buscarAssociado_");
ok(/SpreadsheetApp\.openById\(getPlanilhaId\(\)\)/.test(busca),
   "a busca usa getPlanilhaId()",
   "buscarAssociadoPorCPF_ usa getActiveSpreadsheet, que num web app não " +
   "garante a planilha do ambiente — homologação leria a base real");

ok(!/getActiveSpreadsheet/.test(insc),
   "e getActiveSpreadsheet não aparece neste arquivo");

ok(/filiado:/.test(busca),
   "a busca devolve FILIADO",
   "é o dado que gera o selo ✅ / ⚠️ / ❌ na tela de gestão");

/* ─── 6. não recusa quem não é associado ─── */
passo("a decisão do usuário sobre quem não está na base");

ok(/NAO_ENCONTRADO/.test(insc) && !/erro.*n[ãa]o.*associad/i.test(inscrever),
   "quem não está na base é SINALIZADO, não recusado",
   "palavras do usuário: 'não recuse num primeiro momento, que é até uma " +
   "oportunidade de quem não é associado'");

/* ─── 7. a rota é pública ─── */
passo("o link que vai na lista de transmissão");

ok(/p\.page === "compasso-inscricao"/.test(code),
   "a rota ?page=compasso-inscricao existe");

const doGet = code.slice(code.indexOf("function doGet"),
                         code.indexOf('p.page === "compasso-inscricao"'));
igual(["getSessaoUsuario", "exigirModulo_", "exigirSessao"].filter(p => doGet.indexOf(p) >= 0), [],
      "e nada exige sessão antes dela",
      "o associado não tem conta no SISGEP");

/* As funções desta tela são públicas DE PROPÓSITO — é o oposto do t76, e a
   diferença é intencional. O que elas não podem é devolver dado cru. */
const expostas = (insc.match(/^function\s+([A-Za-z0-9_]+)/gm) || [])
  .map(m => m.replace(/^function\s+/, "")).filter(n => !/_$/.test(n));
igual(expostas.sort(),
      ["compasso_inscrever", "compasso_inscricaoEstado", "compasso_inscricaoPreencher"],
      "exatamente três funções públicas, e são as que a tela precisa",
      "qualquer quarta função aqui é endpoint anônimo novo — tem de ser deliberado");

/* ─── 8. a tela ─── */
passo("o que a pessoa vê");

ok(/Digite o CPF e o restante do formulário será preenchido/.test(tela),
   "a tela diz que o CPF preenche o resto");

ok(/Escondemos parte do seu e-mail por segurança/.test(tela),
   "e explica a máscara",
   "sem explicar, a pessoa acha que está errado e apaga");

ok(/indexOf\('\\u2022'\) >= 0\) return;/.test(tela),
   "a máscara de telefone da tela não destrói o valor mascarado",
   "mascaraTel() joga fora o que não é dígito e apagaria '(27) •••••-1234'");

ok(/\(opcional\)/.test(tela) && /rg/i.test(tela),
   "o RG está lá e é opcional",
   "decisão do usuário — ele não está na base, então é sempre digitado");

resumo();
