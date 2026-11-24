/**
 * O CARTÃO PÚBLICO DO INGRESSO (16/11/2026): ?page=ingresso-festa&c=<código>, aberto pelo link da mensagem de WhatsApp.
 * Decisões do usuário: opção A (lilás, estilo do modelo dele), página no link, SÓ O PRIMEIRO NOME, logo do sindicato.
 * Rota REAL (Code.gs doGet) com a base do TickOne, a pasta de PDFs e o cadastro da festa FALSOS; dados FICTÍCIOS.
 * NÃO PROVA: a aparência no celular de verdade (o desenho foi conferido à parte, no Chromium) nem o Drive real.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const agora = new Date().toISOString();
g.cingLerBase_ = () => ({ lidoEm: agora, evento: "x", total: 2, linhas: [
  { nome: "ADNA DE JESUS VIEIRA SILVA", cpf: "52998224725", tel: "(27) 99825-8820", codigo: "RYUR-4SGS", tipo: "Associado", escola: "Doctum Escola Secreta", cidade: "Guarapari", ref: "R1", zap: 0 },
  { nome: "Sem Pdf Fictício", cpf: "11144477735", tel: "(27) 99999-0002", codigo: "ABCD-1234", tipo: "Associado", escola: "E", cidade: "Vitória", ref: "R2", zap: 0 },
  { nome: "<script>alert(1)</script> Mal", cpf: "39053344705", tel: "(27) 99999-0003", codigo: "XSS0-0001", tipo: "Associado", escola: "E", cidade: "Vitória", ref: "R3", zap: 0 }] });
g.cingPdfs_ = () => ({ "adna de jesus vieira silva": "https://drive.google.com/file/d/1VkuX-g-NzsOJ4JXBHadmN-S4g0fx9P30/view", "<script>alert(1)</script> mal": "https://drive.google.com/file/d/ZZZ/view" });
const DATA = g.compasso_dadosDaFesta_().data;
g.compasso_dadosDaFesta_ = () => ({ data: DATA, horaInicio: "20h", horaAbertura: "19h30", local: "Espaço Patrick Ribeiro", endereco: "Av. Roza Helena Schorling Albuquerque, S/N – Goiabeiras, Vitória/ES, 29109-350.", referencia: "Ao lado do Aeroporto de Vitória" });
const pagina = (c) => { const r = g.doGet({ parameter: { page: "ingresso-festa", c } }); return String(r.getContent ? r.getContent() : r); };
b.fluxo("CARTÃO · ingresso com PDF");
const h = pagina("ryur-4sgs");
b.ok(/Olá, Adna! 🎉/.test(h), "diz 'Olá, Adna!' — SÓ o primeiro nome, com a inicial maiúscula (o código vale em minúsculas também)");
b.ok(!/Jesus|Vieira|Silva/.test(h) && !/529\.982|52998224725|99825|Doctum|Guarapari/.test(h), "NÃO mostra sobrenome, CPF, telefone, escola nem cidade");
b.ok(/Festa No Compasso da Vida 2026/.test(h) && /Sábado, 19 de dezembro de 2026/.test(h) && /Horário:<\/b> 20h/.test(h) && /Abertura dos portões:<\/b> 19h30/.test(h) && /Espaço Patrick Ribeiro/.test(h) && /29109-350/.test(h) && /\(Ao lado do Aeroporto de Vitória\)/.test(h), "traz data, horário, portões, local, endereço e referência do cadastro da festa");
b.ok(/Na entrada, apresente:/.test(h) && /documento oficial com foto/.test(h) && /Importante:/.test(h) && /noite especial de celebração/.test(h) && /SindEducação-ES/.test(h), "traz 'Na entrada, apresente', 'Importante' e o fecho");
b.ok(/src="data:image\/webp;base64,[A-Za-z0-9+\/=]{1000,}"/.test(h), "traz o logo do sindicato");
b.ok(/href="https:\/\/drive\.google\.com\/uc\?export=download&amp;id=1VkuX-g-NzsOJ4JXBHadmN-S4g0fx9P30"/.test(h) && /Baixar meu ingresso \(PDF\)/.test(h) && /href="https:\/\/drive\.google\.com\/file\/d\/1VkuX-g-NzsOJ4JXBHadmN-S4g0fx9P30\/view"/.test(h), "botão 'Baixar meu ingresso (PDF)' (download direto) e 'Abrir o PDF na tela'");
b.ok(/name="viewport"/.test(h), "tem a declaração de celular (viewport)");
b.fluxo("CARTÃO · casos de borda");
const sp = pagina("ABCD-1234");
b.ok(/Olá, Sem! 🎉/.test(sp) && /ainda está sendo preparado/.test(sp) && !/Baixar meu ingresso/.test(sp), "ingresso sem PDF na pasta: o cartão aparece e avisa que o PDF está sendo preparado (sem botão quebrado)");
const nf = pagina("ZZZZ-9999");
b.ok(/Ingresso não encontrado/.test(nf) && !/Olá,/.test(nf) && !/Festa No Compasso/.test(nf), "código que não existe: 'Ingresso não encontrado', sem dado nenhum");
b.ok(/Ingresso não encontrado/.test(pagina("")) && /Ingresso não encontrado/.test(pagina("<script>")) && /Ingresso não encontrado/.test(pagina("a".repeat(500))), "código vazio, com marcação ou enorme: 'não encontrado'");
const xs = pagina("XSS0-0001");
b.ok(!/<script>alert\(1\)<\/script>/.test(xs) && /&lt;script&gt;alert\(1\)&lt;\/script&gt;/.test(xs), "nome com marcação é escapado (não executa)");
g.cingLerBase_ = () => { throw new Error("Drive fora do ar"); };
b.ok(/Ingresso não encontrado/.test(pagina("RYUR-4SGS")), "se a base do robô falhar, a pessoa vê 'não encontrado', não um erro técnico");
b.fluxo("CARTÃO · o link da mensagem de WhatsApp");
b.resumo();
