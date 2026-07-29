// ============================================================================
// ARQUIVO: PortalAssociado.gs
// Portal do Associado - "Meu SindEducação"
// ============================================================================

/**
 * Rota principal do Portal do Associado
 * Chamada via: ?portal=associado&cpf=12345678900
 */
// O roteamento público permanece exclusivamente no Code.gs.

/**
 * Serve o portal do associado
 */
function servirPortalAssociado_(params) {
  // Compatibilidade com chamadas antigas: usa o único fluxo oficial do portal.
  return servirPortalAssociado(params || {});
}

/**
 * Busca associado na aba Associados pelo CPF.
 */
function buscarAssociadoPorCPF_(cpfLimpo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Associados");
    var dados = sheet.getDataRange().getValues();
    
    // Pula cabeçalho (linha 1) e busca pelo CPF (coluna C = índice 2)
    for (var i = 1; i < dados.length; i++) {
      var cpfPlanilha = String(dados[i][2]).replace(/\D/g, ''); // Coluna C
      
      if (cpfPlanilha === cpfLimpo) {
        return {
          encontrado: true,
          linha: i + 1,
          nomeFantasia: dados[i][0] || "",           // Coluna A
          nome: dados[i][1] || "",                   // Coluna B
          cpf: dados[i][2] || "",                    // Coluna C
          filiado: dados[i][3] || "N",               // Coluna D
          logradouro: dados[i][4] || "",             // Coluna E
          numero: dados[i][5] || "",                 // Coluna F
          bairro: dados[i][6] || "",                 // Coluna G
          cidade: dados[i][7] || "",                 // Coluna H
          cep: dados[i][8] || "",                    // Coluna I
          celular: dados[i][9] || "",                // Coluna J
          celular2: dados[i][10] || "",              // Coluna K
          email: dados[i][11] || "",                 // Coluna L
          dataUltimaAtualizacao: dados[i][12] || ""  // Coluna M (se existir)
        };
      }
    }
    
    return { encontrado: false };
    
  } catch (e) {
    Logger.log("Erro ao buscar associado: " + e.toString());
    return { encontrado: false, erro: e.toString() };
  }
}

/**
 * Verifica se o cadastro precisa ser atualizado (mais de 90 dias)
 */
function verificarSePrecisaAtualizar_(dados) {
  if (!dados.dataUltimaAtualizacao) return true;
  
  try {
    var dataUltima = new Date(dados.dataUltimaAtualizacao);
    var hoje = new Date();
    var diferencaDias = Math.floor((hoje - dataUltima) / (1000 * 60 * 60 * 24));
    
    return diferencaDias > 90;
  } catch (e) {
    return true; // Se der erro, pede para atualizar
  }
}

/**
 * Salva solicitação de atualização cadastral
 * Cria registro na aba "Solicitacoes_Atualizacao" (crie esta aba!)
 */
function salvarSolicitacaoAtualizacao(dadosFormulario) {
  try {
    dadosFormulario = dadosFormulario || {};
    if (Number(dadosFormulario.linha) < 1 || String(dadosFormulario.cpf || "").replace(/\D/g, "") === "00000000000") {
      return { sucesso: false, mensagem: "Modo de demonstração: nenhuma informação foi gravada." };
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Tenta pegar aba de solicitações, ou cria se não existir
    var sheet = ss.getSheetByName("Solicitacoes_Atualizacao");
    if (!sheet) {
      sheet = ss.insertSheet("Solicitacoes_Atualizacao");
      // Cria cabeçalhos
      sheet.appendRow([
        "Data Solicitação",
        "CPF",
        "Nome",
        "Linha na Planilha",
        "Novo Logradouro",
        "Novo Número",
        "Novo Bairro",
        "Nova Cidade",
        "Novo CEP",
        "Novo Celular",
        "Novo Celular2",
        "Novo Email",
        "URL Nova Foto",
        "Status",
        "Data Aprovação"
      ]);
    }
    
    // Salva solicitação
    var novaLinha = [
      new Date(),
      dadosFormulario.cpf,
      dadosFormulario.nome,
      dadosFormulario.linha,
      dadosFormulario.logradouro,
      dadosFormulario.numero,
      dadosFormulario.bairro,
      dadosFormulario.cidade,
      dadosFormulario.cep,
      dadosFormulario.celular,
      dadosFormulario.celular2,
      dadosFormulario.email,
      dadosFormulario.fotoUrl || "",
      "Pendente",
      ""
    ];
    
    sheet.appendRow(novaLinha);
    
    // Notifica SOFIA (opcional - se tiver integração)
    try {
      notificarSofiaNovaSolicitacao_(dadosFormulario.nome);
    } catch (e) {
      Logger.log("Não foi possível notificar SOFIA: " + e);
    }
    
    return { 
      sucesso: true, 
      mensagem: "Solicitação enviada! O SindEducação analisará em até 48h." 
    };
    
  } catch (e) {
    Logger.log("Erro ao salvar solicitação: " + e.toString());
    return { 
      sucesso: false, 
      mensagem: "Erro ao enviar solicitação: " + e.toString() 
    };
  }
}

/**
 * Aprova solicitação de atualização (usado pelo painel admin)
 */
function aprovarAtualizacaoCadastro(idSolicitacao) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetSolicitacoes = ss.getSheetByName("Solicitacoes_Atualizacao");
    var sheetAssociados = ss.getSheetByName("Associados");
    
    // Busca solicitação (supondo que ID seja o número da linha)
    var solicitacao = sheetSolicitacoes.getRange(idSolicitacao, 1, 1, 15).getValues()[0];
    
    var cpf = solicitacao[1];
    var linhaAssociado = solicitacao[3];
    
    // Atualiza planilha de Associados
    sheetAssociados.getRange(linhaAssociado, 5).setValue(solicitacao[4]); // Logradouro
    sheetAssociados.getRange(linhaAssociado, 6).setValue(solicitacao[5]); // Número
    sheetAssociados.getRange(linhaAssociado, 7).setValue(solicitacao[6]); // Bairro
    sheetAssociados.getRange(linhaAssociado, 8).setValue(solicitacao[7]); // Cidade
    sheetAssociados.getRange(linhaAssociado, 9).setValue(solicitacao[8]); // CEP
    sheetAssociados.getRange(linhaAssociado, 10).setValue(solicitacao[9]); // Celular
    sheetAssociados.getRange(linhaAssociado, 11).setValue(solicitacao[10]); // Celular2
    sheetAssociados.getRange(linhaAssociado, 12).setValue(solicitacao[11]); // Email
    
    // Atualiza data da última atualização
    var colDataAtualizacao = 13; // Coluna M
    sheetAssociados.getRange(linhaAssociado, colDataAtualizacao).setValue(new Date());
    
    // Marca solicitação como aprovada
    sheetSolicitacoes.getRange(idSolicitacao, 14).setValue("Aprovado");
    sheetSolicitacoes.getRange(idSolicitacao, 15).setValue(new Date());
    
    return { sucesso: true, mensagem: "Cadastro atualizado com sucesso!" };
    
  } catch (e) {
    return { sucesso: false, mensagem: "Erro ao aprovar: " + e.toString() };
  }
}

/**
 * Notifica SOFIA sobre nova solicitação
 */
function notificarSofiaNovaSolicitacao_(nomeAssociado) {
  // Aqui você pode integrar com seu sistema de notificações
  // Por enquanto, apenas loga
  Logger.log("SOFIA: Nova solicitação de atualização de " + nomeAssociado);
}

/**
 * Gera QR Code para credencial (usando API pública)
 */
function gerarQRCodeParaCredencial(cpf, nome) {
  try {
    var dadosValidacao = Utilities.base64Encode(JSON.stringify({
      cpf: cpf,
      nome: nome,
      data: new Date().toISOString(),
      validador: "SindEducacao-ES"
    }));
    
    var qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(dadosValidacao);
    
    return qrCodeUrl;
  } catch (e) {
    return "";
  }
}
/**
 * Função chamada pelo Code.gs quando detecta ?portal=associado
 */
function servirPortalAssociado(params) {
  params = params || {};
  var modoDemo = String(params.demo || "") === "1";
  if (modoDemo) return servirPortalAssociadoDemo_();
  var cpf = String(params.cpf || "").replace(/\D/g, '');
  
  // Demonstração segura: não consulta nem altera dados reais.
  var dados = modoDemo ? {
    encontrado: true, linha: -1, nomeFantasia: "ESCOLA EXEMPLO",
    nome: "Associado Demonstração", cpf: "000.000.000-00", filiado: "S",
    logradouro: "Avenida Exemplo", numero: "100", bairro: "Centro",
    cidade: "Vitória", cep: "29000-000", celular: "(27) 99999-0000",
    celular2: "", email: "associado.exemplo@sindeducacao.com", dataUltimaAtualizacao: new Date()
  } : buscarAssociadoPorCPF_(cpf);
  
  if (!dados.encontrado) {
    return HtmlService.createHtmlOutput(
      "<div style='font-family:Plus Jakarta Sans, sans-serif; text-align:center; padding:40px; background:#08101f; color:#fff;'>" +
      "<h2 style='color:#ef4444;'>Associado não encontrado</h2>" +
      "<p>Verifique o link ou entre em contato com o SindEducação.</p>" +
      "</div>"
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 2. Verifica se precisa atualizar (lógica dos 90 dias)
  var precisaAtualizar = verificarSePrecisaAtualizar_(dados);

  // 3. Renderiza o HTML
  var template = HtmlService.createTemplateFromFile("PortalAssociado");
  template.nome = dados.nome;
  template.nomeFantasia = dados.nomeFantasia;
  template.cpf = dados.cpf;
  template.filiado = dados.filiado;
  template.celular = dados.celular;
  template.email = dados.email;
  template.logradouro = dados.logradouro;
  template.numero = dados.numero;
  template.bairro = dados.bairro;
  template.cidade = dados.cidade;
  template.cep = dados.cep;
  template.linha = dados.linha;
  template.precisaAtualizar = precisaAtualizar;
  template.modoDemo = modoDemo;
  template.scriptUrl = ScriptApp.getService().getUrl();
  template.bannerDemo = modoDemo ? '<div style="background:#f59e0b;color:#08101f;text-align:center;padding:10px 16px;font-weight:800;font-size:13px;">MODO DE DEMONSTRAÇÃO — dados fictícios, nenhuma alteração será gravada</div>' : "";

  return template.evaluate()
    .setTitle("Meu SindEducação")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function servirPortalAssociadoDemo_() {
  var html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portal do Associado — SindEducação ES</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#14213d;font-family:Inter,Arial,sans-serif}.app{min-height:100vh;display:grid;grid-template-columns:238px 1fr}.side{background:linear-gradient(180deg,#07152d,#100944);color:#cbd4e8;padding:20px 15px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}.brand{display:flex;align-items:center;gap:10px;color:#fff;font-weight:800;font-size:16px;padding:4px 8px 24px}.brandmark{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#1fb5e9,#7545e7);display:grid;place-items:center;font-size:21px}.brand small{display:block;font-size:9px;color:#9aa9c7;font-weight:500;margin-top:3px}.navtitle{font-size:9px;letter-spacing:1.2px;color:#7181a2;margin:17px 10px 7px}.nav a{display:flex;align-items:center;gap:11px;color:#cbd4e8;text-decoration:none;padding:10px 11px;border-radius:8px;font-size:13px;margin:2px 0}.nav a:hover,.nav a.active{background:linear-gradient(90deg,#4b35c8,#7a34df);color:#fff}.nav .ico{width:18px;text-align:center}.store{margin-top:auto;background:#1b1a55;border:1px solid #393587;border-radius:12px;padding:13px;font-size:11px;line-height:1.5}.store b{color:#fff}.shell{min-width:0}.top{height:70px;background:#0a1020;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 27px;position:sticky;top:0;z-index:10}.top h1{font-size:17px;margin:0}.top p{font-size:10px;color:#8994aa;margin:4px 0 0}.profile{display:flex;align-items:center;gap:12px}.bell{width:36px;height:36px;border:1px solid #30384a;border-radius:10px;display:grid;place-items:center}.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#e3b84c,#7245df);display:grid;place-items:center;font-weight:800}.who{font-size:12px}.who span{display:block;color:#8d98ae;font-size:10px;margin-top:2px}.demo{background:#fff3cf;color:#765700;border-bottom:1px solid #ead28b;padding:8px 27px;font-size:11px}.content{padding:20px 24px 30px;display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px;max-width:1440px;margin:auto}.maincol,.rightcol{display:flex;flex-direction:column;gap:15px}.card{background:#fff;border:1px solid #e0e7f1;border-radius:13px;box-shadow:0 3px 13px rgba(24,50,92,.05)}.welcome{padding:20px}.hello{display:flex;gap:15px;align-items:center}.photo{width:66px;height:66px;border-radius:50%;background:linear-gradient(145deg,#1a4579,#8150e7);display:grid;place-items:center;color:#fff;font-size:24px;border:4px solid #eef2ff}.hello h2{font-size:21px;margin:0 0 4px;color:#18213b}.hello p{margin:0;color:#65718a;font-size:12px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:17px}.stat{border:1px solid #e5e9f2;border-radius:10px;padding:11px;display:flex;gap:9px;align-items:center}.stat i{font-style:normal;width:30px;height:30px;border-radius:8px;background:#f0eaff;color:#6f3fe0;display:grid;place-items:center}.stat small{display:block;color:#8490a8;font-size:9px}.stat b{font-size:11px}.notice{margin-top:13px;padding:10px 12px;border-radius:9px;background:#f6efff;color:#5d39b6;display:flex;align-items:center;justify-content:space-between;font-size:11px}.btn{border:0;border-radius:8px;background:linear-gradient(90deg,#4c3acb,#8137df);color:#fff;padding:9px 13px;font-weight:700;font-size:10px;cursor:pointer}.section{padding:16px}.sectionhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.sectionhead h3{margin:0;font-size:14px}.sectionhead a{font-size:10px;color:#7140d6}.quick{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}.quick button{background:#fff;border:1px solid #e6eaf2;border-radius:10px;padding:13px 6px;min-height:93px;color:#28334d;cursor:pointer}.quick button:hover{border-color:#7650de;transform:translateY(-1px)}.quick em{display:block;font-style:normal;font-size:20px;margin-bottom:8px}.quick b{display:block;font-size:10px}.quick small{display:block;font-size:8px;color:#8a94aa;margin-top:4px}.activity{list-style:none;padding:0;margin:0}.activity li{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #edf0f5;font-size:10px}.activity li:first-child{border-top:0}.ok{width:22px;height:22px;border-radius:50%;background:#e1f8ed;color:#10a963;display:grid;place-items:center}.activity span{color:#7c879d}.tag{background:#e8f8ee;color:#15844c;padding:4px 7px;border-radius:8px;font-size:8px}.credential{padding:15px}.cred{background:linear-gradient(135deg,#10255f,#5d22c8 72%,#a335dd);border-radius:13px;color:#fff;padding:18px;min-height:182px;position:relative;overflow:hidden}.cred:after{content:'';position:absolute;width:170px;height:170px;border:30px solid rgba(255,255,255,.06);border-radius:50%;right:-75px;top:-70px}.credlogo{font-size:12px;font-weight:800}.credname{font-size:15px;font-weight:800;margin-top:31px}.credmeta{display:flex;justify-content:space-between;align-items:end;margin-top:19px;font-size:9px}.qr{width:57px;height:57px;background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0/12px 12px;border:5px solid #fff;border-radius:4px}.credactions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}.ghost{border:1px solid #dfe4ee;background:#fff;border-radius:7px;padding:8px 4px;font-size:9px;color:#40506c;cursor:pointer}.benefits{padding:15px}.benefitgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.benefit{min-height:104px;border-radius:10px;padding:12px;color:#fff;display:flex;flex-direction:column;justify-content:end;font-size:10px;background:linear-gradient(155deg,#1976a9,#22b08d)}.benefit:nth-child(2){background:linear-gradient(155deg,#ef9b35,#d84c69)}.benefit:nth-child(3){background:linear-gradient(155deg,#315cbd,#6542d4)}.benefit:nth-child(4){background:linear-gradient(155deg,#7450c4,#d43d9a)}.benefit b{font-size:11px}.support{padding:15px}.supportrow{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #edf0f4;padding:11px 0;font-size:10px}.supportrow:first-of-type{border-top:0}.supportrow button{border:0;border-radius:7px;padding:8px 10px;background:#643cdf;color:#fff;font-size:9px}.supportrow .whats{background:#13ae69}.foot{text-align:center;color:#8d98ac;font-size:9px;padding:3px}.mobilebar{display:none}
@media(max-width:1100px){.content{grid-template-columns:1fr}.rightcol{display:grid;grid-template-columns:1fr 1fr}.quick{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.app{grid-template-columns:1fr}.side{display:none}.top{height:62px;padding:0 15px}.top h1{font-size:15px}.who{display:none}.content{padding:12px 10px 76px}.stats{grid-template-columns:1fr 1fr}.quick{grid-template-columns:repeat(2,1fr)}.rightcol{display:flex}.hello{align-items:flex-start}.photo{width:52px;height:52px}.notice{gap:9px}.mobilebar{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;bottom:0;left:0;right:0;background:#0b1530;padding:8px 4px;z-index:20}.mobilebar a{color:#c8d1e4;text-align:center;text-decoration:none;font-size:9px}.mobilebar b{display:block;font-size:17px;margin-bottom:2px}.content{grid-template-columns:1fr}}@media(max-width:430px){.stats{grid-template-columns:1fr}.credactions{grid-template-columns:1fr}.top p{display:none}}

/* Refinamento visual Portal SISGEP */
:root{--navy:#08142b;--purple:#6938dc;--line:#e3e9f2;--muted:#748099}
body{letter-spacing:-.01em}.app{grid-template-columns:248px minmax(0,1fr)}.side{padding:21px 16px;background:linear-gradient(180deg,#07142b 0%,#11094a 100%);box-shadow:6px 0 24px rgba(16,25,60,.08)}.brand{font-size:15px;line-height:1.08;padding:3px 7px 25px}.brandmark{flex:0 0 40px;width:40px;height:40px;box-shadow:0 8px 20px rgba(76,79,235,.28)}.brand small{line-height:1.25;margin-top:5px}.nav a{min-height:39px;font-size:12.5px;padding:10px 12px;transition:.18s ease}.nav a:hover{transform:translateX(2px)}.nav a.active{box-shadow:0 7px 18px rgba(100,48,223,.28)}.navtitle{margin-top:16px}.store{box-shadow:inset 0 1px rgba(255,255,255,.05)}
.top{height:74px;padding:0 30px;box-shadow:0 1px rgba(255,255,255,.04)}.top h1{font-size:18px;letter-spacing:-.02em}.top p{font-size:10.5px}.bell,.avatar{box-shadow:0 5px 14px rgba(0,0,0,.18)}.demo{padding:9px 30px;font-size:11px}
.content{padding:22px 26px 34px;grid-template-columns:minmax(610px,1fr) 324px;gap:20px;max-width:1480px}.maincol,.rightcol{gap:17px}.card{border-color:var(--line);border-radius:15px;box-shadow:0 8px 24px rgba(27,46,82,.055);overflow:hidden}.welcome{padding:21px}.photo{width:68px;height:68px;box-shadow:0 8px 18px rgba(91,62,207,.2)}.hello h2{font-size:21px}.hello p{font-size:12.5px}.stats{gap:11px;margin-top:18px}.stat{min-height:58px;padding:11px 12px;background:#fff}.stat i{width:32px;height:32px}.stat small{font-size:9.5px;margin-bottom:2px}.stat b{font-size:11.5px}.notice{margin-top:14px;padding:11px 13px;line-height:1.35}.btn{padding:9px 15px;box-shadow:0 6px 14px rgba(103,54,215,.2)}
.section,.credential,.benefits,.support{padding:17px}.sectionhead{margin-bottom:14px}.sectionhead h3{font-size:14.5px}.quick{gap:10px}.quick button{min-height:98px;padding:14px 7px;transition:.18s ease;box-shadow:0 2px 8px rgba(29,48,80,.025)}.quick button:hover{box-shadow:0 8px 18px rgba(71,53,145,.1)}.quick em{font-size:21px}.quick b{font-size:10.5px}.quick small{font-size:8.5px;line-height:1.25}.activity li{min-height:47px;font-size:10.5px;padding:9px 2px}.tag{font-weight:700}
.cred{min-height:190px;padding:19px;box-shadow:0 12px 25px rgba(57,31,145,.18)}.credlogo{font-size:12.5px}.credname{font-size:15.5px;line-height:1.35}.qr{width:59px;height:59px}.credactions{gap:8px;margin-top:11px}.ghost{min-height:34px;transition:.18s ease}.ghost:hover{border-color:#7143d6;color:#5e34bd}.benefitgrid{gap:10px}.benefit{min-height:108px;padding:13px;position:relative;overflow:hidden;box-shadow:inset 0 -30px 45px rgba(0,0,0,.09)}.benefit:before{content:'';position:absolute;width:75px;height:75px;border:15px solid rgba(255,255,255,.09);border-radius:50%;right:-29px;top:-31px}.benefit b,.benefit span{position:relative}.benefit b{font-size:11.5px;margin-bottom:2px}.supportrow{min-height:53px}.supportrow button{font-weight:700}.foot{padding:5px 0 1px}
@media(max-width:1180px){.content{grid-template-columns:1fr}.rightcol{display:grid;grid-template-columns:1fr 1fr;align-items:start}.support{grid-column:1/-1}}@media(max-width:820px){.app{grid-template-columns:1fr}.side{display:none}.rightcol{display:flex}.content{padding:14px 11px 78px}.top{height:64px;padding:0 16px}.demo{padding:8px 16px}.mobilebar{display:grid}.stats{grid-template-columns:1fr 1fr}.quick{grid-template-columns:repeat(3,1fr)}}@media(max-width:560px){.quick{grid-template-columns:repeat(2,1fr)}.welcome{padding:17px}.hello h2{font-size:18px}.notice{align-items:flex-start;flex-direction:column}.notice .btn{width:100%}.benefitgrid{grid-template-columns:1fr 1fr}}@media(max-width:390px){.stats,.benefitgrid{grid-template-columns:1fr}.quick{grid-template-columns:1fr 1fr}.top h1{font-size:14px}.profile{gap:7px}.bell{display:none}}

/* Tema escuro oficial SISGEP */
:root{--sis-bg:#071426;--sis-panel:#0d192c;--sis-panel-2:#111f36;--sis-border:#20304c;--sis-text:#f5f7ff;--sis-muted:#9aa9c7;--sis-purple:#7339ee;--sis-blue:#2f66f3}
html{background:var(--sis-bg)}body{background:var(--sis-bg);color:var(--sis-text);font-family:"Poppins","Segoe UI",Arial,sans-serif;font-weight:400;letter-spacing:-.018em}.shell{background:var(--sis-bg)}.side{background:linear-gradient(180deg,#061326 0%,#07172c 58%,#11164a 100%);border-right:1px solid #1a2942}.brand{color:#fff}.brand small,.top p,.navtitle{color:#7486a5}.nav a{color:#c9d3e7;font-weight:500}.nav a.active{background:linear-gradient(100deg,#315ff2,#7c34ed);box-shadow:0 8px 22px rgba(89,53,229,.3)}.store{background:#172448;border-color:#2a4070;color:#9bb0d3}.store b{color:#fff}
.top{background:#080f1f;border-bottom:1px solid #1a2840}.top h1{font-weight:700;color:#fff}.who{color:#fff}.who span{color:#8f9db7}.bell{background:#111b2e;border-color:#2a354a}.demo{background:#15213a;color:#f3c34f;border-color:#3e3a28}
.content{background:var(--sis-bg)}.card{background:var(--sis-panel);border-color:var(--sis-border);box-shadow:0 10px 28px rgba(0,0,0,.16)}.hello h2,.sectionhead h3{color:#fff;font-weight:700}.hello p,.stat small,.quick small,.activity span,.foot{color:var(--sis-muted)}.photo{background:linear-gradient(145deg,#2865f1,#7840ed);border-color:#253759}.stats{color:#fff}.stat{background:var(--sis-panel-2);border-color:#243653}.stat i{background:#252052;color:#a98cff}.stat b{color:#fff;font-weight:600}.notice{background:linear-gradient(90deg,#182a4f,#29204f);color:#d6dcf2;border:1px solid #2d3e64}.btn{background:linear-gradient(90deg,var(--sis-blue),var(--sis-purple));font-family:inherit}
.sectionhead a{color:#8d75ff}.quick button{background:#101d32;border-color:#223451;color:#edf2ff;font-family:inherit}.quick button:hover{background:#13243e;border-color:#6848dc;box-shadow:0 10px 24px rgba(0,0,0,.2)}.quick b{font-weight:600}.activity li{border-color:#1d2d47}.ok{background:#10392f;color:#17d879}.tag{background:#10392f;color:#19dc7d}.credential,.benefits,.support{background:var(--sis-panel)}.cred{background:linear-gradient(135deg,#17377d 0%,#4930b7 52%,#852fd8 100%)}.ghost{background:#111f35;border-color:#263a59;color:#cbd6eb;font-family:inherit}.ghost:hover{background:#182944;border-color:#7550e5;color:#fff}.benefit{font-family:inherit}.supportrow{border-color:#1d2d47;color:#d9e1f0}.supportrow button{font-family:inherit;background:linear-gradient(90deg,#315ff2,#7c34ed)}.supportrow .whats{background:#13a968}.mobilebar{background:#080f1f;border-top:1px solid #23324b}.mobilebar a{color:#aab7cf}.mobilebar a:first-child{color:#a87cff}
@media(max-width:820px){.top{background:#080f1f}.content{background:var(--sis-bg)}.card{box-shadow:0 7px 20px rgba(0,0,0,.19)}}
/* Credencial institucional inspirada na carteira oficial */
.credential{padding:17px}.cred-institucional{min-height:265px;padding:16px 17px 13px;background:linear-gradient(145deg,#031735 0%,#062653 58%,#081b3c 100%);border:1px solid #27436e;position:relative;overflow:hidden}.cred-institucional:before{content:'';position:absolute;inset:0;background:repeating-radial-gradient(ellipse at 120% 80%,transparent 0 14px,rgba(45,111,210,.09) 15px 16px);pointer-events:none}.cred-head,.cred-body,.cred-footer,.cred-title{position:relative;z-index:1}.cred-head{display:flex;align-items:center;justify-content:space-between}.credlogo{display:flex;align-items:center;gap:7px;font-size:12px;line-height:1}.credlogo span:last-child{font-weight:400}.credlogo b{font-style:italic;color:#4bc6ff}.credlogo small{display:block;font-size:6px;letter-spacing:1.5px;margin-top:4px;color:#dfe9ff}.mini-logo{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#27b6df,#e8408d);font-size:16px}.anos{width:47px;height:47px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#102446 48%,#c99935 51%,#f7d06a 59%,#6e4813 62%);font-size:19px;font-weight:800;color:#f8d36b;line-height:.8}.anos small{font-size:6px;color:#fff}.cred-title{font-size:9px;letter-spacing:1.2px;margin:8px 0 7px 62px}.cred-title b{display:block;font-size:16px;letter-spacing:.5px}.cred-body{display:grid;grid-template-columns:58px 1fr 57px;gap:10px;align-items:center}.cred-photo{width:58px;height:72px;border:3px solid #fff;border-radius:7px;background:linear-gradient(145deg,#2964ee,#7240e8);display:grid;place-items:center;font-size:19px;font-weight:700}.cred-info{min-width:0}.credname{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid #e43e88;padding-bottom:4px;margin-bottom:4px}.cred-field{display:flex;align-items:center;gap:6px;font-size:7px;margin:3px 0}.cred-field span{color:#b7c5dc;min-width:43px}.cred-field b{font-size:8px}.status-ativo{background:#39a64d;color:#fff;padding:2px 8px;border-radius:8px}.cred-institucional .qr{width:57px;height:57px;border-width:4px}.cred-footer{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px;border-top:1px solid #27436e;margin-top:10px;padding-top:8px;font-size:6.5px;color:#b8c6dc}.cred-footer span+span{border-left:1px solid #52698c;padding-left:8px}.cred-footer b{font-size:8px;color:#fff;line-height:1.6}.credactions{margin-top:9px}
@media(max-width:390px){.cred-body{grid-template-columns:52px 1fr 52px;gap:7px}.cred-photo{width:52px;height:66px}.cred-institucional .qr{width:52px;height:52px}.cred-title{margin-left:57px}.credname{font-size:10px}.cred-footer{grid-template-columns:1fr 1fr}.cred-footer span:last-child{display:none}}

/* Logomarca oficial SindEducação-ES */
.brand-official{height:70px;padding:9px 12px;margin:0 0 18px;background:#fff;border-radius:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(0,0,0,.18)}.brand-official img{display:block;width:100%;height:100%;max-width:188px;object-fit:contain}.credlogo-official{width:128px;height:34px;padding:4px 7px;background:rgba(255,255,255,.96);border-radius:7px;display:flex;align-items:center;justify-content:center}.credlogo-official img{display:block;width:100%;height:100%;object-fit:contain}.cred-head{min-height:38px}.anos{flex:0 0 47px}@media(max-width:820px){.brand-official{height:62px}}@media(max-width:390px){.credlogo-official{width:112px;height:31px}}

/* Home pessoal do associado */
.content{grid-template-columns:minmax(620px,1fr) 372px}.profile-progress{margin-top:14px;padding:12px 13px;background:#101d32;border:1px solid #253855;border-radius:10px}.progress-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:8px}.progress-head span{display:flex;flex-direction:column;gap:2px}.progress-head b{font-size:11px;color:#fff}.progress-head small{font-size:8.5px;color:#8f9eb8}.progress-head strong{font-size:17px;color:#ad8cff}.progress-track{height:7px;background:#24324a;border-radius:9px;overflow:hidden}.progress-track i{display:block;width:92%;height:100%;background:linear-gradient(90deg,#2f66f3,#8138eb);border-radius:9px}.renewal{padding:14px 15px;align-items:center;background:linear-gradient(105deg,#152d58,#30215c);border-color:#514083}.renewal>div{display:grid;grid-template-columns:34px 1fr;column-gap:10px}.renewal .renew-icon{grid-row:1/3;width:34px;height:34px;border-radius:10px;background:#493092;display:grid;place-items:center;font-size:17px}.renewal b{font-size:13px;color:#fff}.renewal small{font-size:9px;color:#c5cce0;line-height:1.35;margin-top:3px}.btn-primary{min-width:158px;font-size:9.5px}
.situation{padding:17px}.updated{font-size:8px;color:#8f9eb8}.situation-list{display:flex;flex-direction:column}.situation-list>div{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1d2d47;font-size:10px}.situation-list span{color:#b7c3d8}.situation-list b{font-size:9px}.good{color:#19d87b}.warn{color:#f3ad2f}.last-update{display:block;color:#7f8da7;font-size:8px;margin-top:10px}
.timeline li{grid-template-columns:38px 24px 1fr auto;position:relative;min-height:54px}.timeline li:before{content:'';position:absolute;left:49px;top:34px;bottom:-20px;width:1px;background:#29405f}.timeline li:last-child:before{display:none}.timeline time{font-size:13px;font-weight:700;color:#e9efff;text-align:center;line-height:1}.timeline time small{display:block;font-size:7px;color:#7f8da8;margin-top:3px}.timeline-dot{width:21px;height:21px;border-radius:50%;background:#10392f;color:#18d879;display:grid;place-items:center;font-size:10px;z-index:1}.tag-new{background:#1c3262;color:#55a0ff}
.sofia-live{padding:17px}.online{font-size:8px;color:#20d47c}.online i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#20d47c;box-shadow:0 0 10px #20d47c;margin-right:4px}.sofia-status{display:flex;align-items:center;gap:10px;padding:9px 0 12px}.sofia-orb{width:40px;height:40px;border-radius:13px;background:radial-gradient(circle at 40% 30%,#55b5ff,#5834df 60%,#12195b);display:grid;place-items:center;font-size:20px;box-shadow:0 0 20px rgba(84,77,239,.35)}.sofia-status b{display:block;font-size:15px;color:#fff}.sofia-status small{font-size:8.5px;color:#8f9eb8}.response-time{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #1d2d47;font-size:9px;color:#9ba9c1}.response-time b{color:#fff}.sofia-button{width:100%;border:0;border-radius:9px;padding:11px;background:linear-gradient(90deg,#2f66f3,#7c36eb);color:#fff;font-family:inherit;font-weight:700;font-size:10px;margin-bottom:8px}.credential .sectionhead h3:after{content:' — destaque';font-size:8px;color:#8574bd;font-weight:400}.cred-institucional{min-height:286px}.cred-body{grid-template-columns:64px 1fr 62px}.cred-photo{width:64px;height:80px}.cred-institucional .qr{width:62px;height:62px}
@media(max-width:1180px){.content{grid-template-columns:1fr}.rightcol{grid-template-columns:1fr 1fr}.situation{grid-column:1/-1}}@media(max-width:820px){.content{grid-template-columns:1fr}.rightcol{display:flex}.renewal{align-items:stretch}.btn-primary{width:100%;margin-top:10px}.timeline li{grid-template-columns:34px 22px 1fr}.timeline .tag{display:none}}@media(max-width:560px){.renewal{flex-direction:column}.renewal>div{margin-bottom:10px}.profile-progress{margin-top:12px}.cred-institucional{min-height:276px}}
</style></head><body>
<div class="app"><aside class="side"><div class="brand brand-official"><img src="https://lh3.googleusercontent.com/d/1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7" alt="SindEducação-ES"></div><nav class="nav"><a class="active" href="#"><span class="ico">⌂</span>Início</a><div class="navtitle">MINHA CONTA</div><a href="#"><span class="ico">▣</span>Minha Credencial</a><a href="#"><span class="ico">✎</span>Meu Cadastro</a><a href="#"><span class="ico">◉</span>Minha Foto</a><a href="#"><span class="ico">♙</span>Dependentes</a><div class="navtitle">BENEFÍCIOS</div><a href="#"><span class="ico">♡</span>Convênios</a><a href="#"><span class="ico">♕</span>Vouchers</a><a href="#"><span class="ico">▦</span>Agenda Oftalmo</a><a href="#"><span class="ico">☆</span>Meus Benefícios</a><div class="navtitle">DOCUMENTOS</div><a href="#"><span class="ico">□</span>Meus Documentos</a><a href="#"><span class="ico">◷</span>Histórico</a><a href="#"><span class="ico">▤</span>CCT 2026/2027</a><div class="navtitle">SUPORTE</div><a href="#"><span class="ico">☏</span>Fale Conosco</a><a href="#"><span class="ico">✦</span>Conversar com a SOFIA</a></nav><div class="store"><b>Portal SindEducação</b><br>Seus direitos, benefícios e documentos em um só lugar.</div></aside>
<div class="shell"><header class="top"><div><h1>Portal do Associado</h1><p>Seus benefícios, sua credencial e muito mais, em um só lugar.</p></div><div class="profile"><div class="bell">🔔</div><div class="avatar">AD</div><div class="who"><b>Associado Demonstração</b><span>Associado ativo</span></div></div></header><div class="demo">⚠️ Modo demonstração — nenhum dado real é exibido e nenhuma alteração será gravada.</div>
<main class="content"><div class="maincol"><section class="card welcome"><div class="hello"><div class="photo">AD</div><div><h2>Olá, Associado! 👋</h2><p>Bem-vindo ao seu Portal do Associado.</p></div></div><div class="stats"><div class="stat"><i>♙</i><div><small>Associado desde</small><b>2010</b></div></div><div class="stat"><i>▣</i><div><small>Matrícula</small><b>0004521</b></div></div><div class="stat"><i>✓</i><div><small>Situação</small><b>Ativo</b></div></div><div class="stat"><i>▦</i><div><small>Validade</small><b>31/12/2026</b></div></div></div><div class="profile-progress"><div class="progress-head"><span><b>Cadastro</b><small>Última atualização: 18/02/2026</small></span><strong>92%</strong></div><div class="progress-track"><i></i></div></div><div class="notice renewal"><div><span class="renew-icon">🎉</span><b>Renove sua Credencial 2027</b><small>Confirme seus dados, atualize sua foto e garanta acesso a todos os benefícios.</small></div><button class="btn btn-primary" onclick="demo()">Atualizar Cadastro Agora</button></div></section>
<section class="card section"><div class="sectionhead"><h3>Acesso rápido</h3></div><div class="quick"><button onclick="demo()"><em>▣</em><b>Minha Credencial</b><small>Visualize sua credencial</small></button><button onclick="demo()"><em>✎</em><b>Meu Cadastro</b><small>Mantenha seus dados em dia</small></button><button onclick="demo()"><em>🎁</em><b>Meus Vouchers</b><small>Acesse e utilize</small></button><button onclick="demo()"><em>♡</em><b>Convênios</b><small>Parceiros para você</small></button><button onclick="demo()"><em>▦</em><b>Agenda Oftalmo</b><small>Agende sua consulta</small></button><button onclick="demo()"><em>✦</em><b>Falar com a SOFIA</b><small>Atendimento inteligente</small></button></div></section>
<section class="card section"><div class="sectionhead"><h3>Últimas atividades</h3><a>Ver todas →</a></div><ul class="activity timeline"><li><time>15<small>JUL</small></time><div class="timeline-dot">✓</div><div><b>Credencial aprovada</b><br><span>Sua credencial digital está ativa.</span></div><div class="tag">Concluído</div></li><li><time>14<small>JUL</small></time><div class="timeline-dot">✓</div><div><b>Telefone atualizado</b><br><span>Contato confirmado no cadastro.</span></div><div class="tag">Concluído</div></li><li><time>12<small>JUL</small></time><div class="timeline-dot">✓</div><div><b>Novo benefício disponível</b><br><span>Confira as novas condições para associados.</span></div><div class="tag tag-new">Novo</div></li><li><time>10<small>JUL</small></time><div class="timeline-dot">✓</div><div><b>Voucher emitido</b><br><span>Documento disponível em Meus Vouchers.</span></div><div class="tag">Concluído</div></li></ul></section><div class="foot">© 2026 SindEducação ES — Todos os direitos reservados.</div></div>
<aside class="rightcol"><section class="card situation"><div class="sectionhead"><h3>🎯 Minha Situação</h3><span class="updated">Atualizado hoje</span></div><div class="situation-list"><div><span>Cadastro</span><b class="good">● Atualizado</b></div><div><span>Credencial</span><b class="good">● Ativa</b></div><div><span>Benefícios</span><b class="good">● Liberados</b></div><div><span>Documentação</span><b class="good">● Completa</b></div><div><span>Minha foto</span><b class="warn">● Atualizar</b></div></div><small class="last-update">Última atualização: 15/07/2026</small></section><section class="card credential"><div class="sectionhead"><h3>Minha Credencial</h3><a>Ver detalhes</a></div><div class="cred cred-institucional"><div class="cred-head"><div class="credlogo credlogo-official"><img src="https://lh3.googleusercontent.com/d/1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7" alt="SindEducação-ES"></div><div class="anos">38<small>ANOS</small></div></div><div class="cred-title">CARTEIRA DO <b>ASSOCIADO</b></div><div class="cred-body"><div class="cred-photo">AD</div><div class="cred-info"><div class="credname">ASSOCIADO DEMONSTRAÇÃO</div><div class="cred-field"><span>MATRÍCULA</span><b>0004521</b></div><div class="cred-field"><span>CATEGORIA</span><b>ASSOCIADO</b></div><div class="cred-field"><span>SITUAÇÃO</span><b class="status-ativo">ATIVO</b></div></div><div class="qr"></div></div><div class="cred-footer"><span>CARTEIRA Nº<br><b>SDE-2026-000358</b></span><span>EMITIDA EM<br><b>15/07/2026</b></span><span>VALIDADE<br><b>15/07/2027</b></span></div></div><div class="credactions"><button class="ghost" onclick="demo()">▣ Ver digital</button><button class="ghost" onclick="demo()">⇩ Baixar PDF</button><button class="ghost" onclick="demo()">↗ Compartilhar</button></div></section>
<section class="card benefits"><div class="sectionhead"><h3>Meus Benefícios</h3><a>Ver todos</a></div><div class="benefitgrid"><div class="benefit"><b>Parque China</b><span>Condições especiais</span></div><div class="benefit"><b>Guriri Beach</b><span>Desconto para associados</span></div><div class="benefit"><b>ASSEFAZ</b><span>Planos de saúde</span></div><div class="benefit"><b>Carteirinha e Vouchers</b><span>Acesso digital</span></div></div></section>
<section class="card support sofia-live"><div class="sectionhead"><h3>Meu Atendimento</h3><span class="online"><i></i> Online agora</span></div><div class="sofia-status"><div class="sofia-orb">✦</div><div><b>SOFIA</b><small>Assistente inteligente do SindEducação</small></div></div><div class="response-time"><span>Tempo médio de resposta</span><b>2 minutos</b></div><button class="sofia-button" onclick="demo()">Conversar com a SOFIA</button><div class="supportrow"><span>☎ <b>WhatsApp</b><br>Fale com nossa equipe</span><button class="whats" onclick="demo()">Iniciar conversa</button></div></section></aside></main></div></div>
<nav class="mobilebar"><a href="#"><b>⌂</b>Início</a><a href="#"><b>▣</b>Credencial</a><a href="#"><b>♡</b>Benefícios</a><a href="#"><b>□</b>Documentos</a><a href="#"><b>✦</b>SOFIA</a></nav>
<script>function demo(){alert('Recurso disponível após a autenticação segura do associado.');}</script></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle("Portal do Associado — Demonstração").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag("viewport","width=device-width, initial-scale=1");
}

function sisgepDiagnosticoIdBase_(){ var ss=SpreadsheetApp.getActiveSpreadsheet(); console.log("BASE_ID="+(ss?ss.getId():"SEM_BASE")); return ss?ss.getId():""; }
