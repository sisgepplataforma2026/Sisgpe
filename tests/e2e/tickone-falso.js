/**
 * TICKONE FALSO (14/11/2026) — um servidor local que imita o painel do TickOne visto no
 * reconhecimento: login (username/password → cookie), tabela de ingressos (Cliente, CPF, Telefone,
 * Código, Tipo, Escola, Cidade, Ações com WhatsApp/e-mail/editar/Reemitir/Excluir), tabela de
 * check-in, grade de lugares (livre = emerald, ocupado = rose), pop-up de emissão e o pop-up
 * "Confirmar" da exclusão. Registra TODA chamada para o teste provar o que o robô tocou.
 * Dados FICTÍCIOS. NÃO PROVA que o TickOne de verdade se comporta assim.
 */
const http = require("http");
const ROTULO = { pago: "Pago", cortesia: "Cortesia", convite: "Convite", associado: "Associado", acompanhante: "Acompanhante Associado" };
const fmtCpf = c => String(c).replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

async function iniciar(linhasIniciais, checkins) {
  const st = { linhas: linhasIniciais.map((l, i) => ({ id: i + 1, ...l, cpf: fmtCpf(l.cpf) })), checkins: checkins || [], chamadas: [], seq: linhasIniciais.length, ocupados: new Set(), pedidosEmissao: [] };
  const TOTAL = 40;
  st.linhas.forEach((_, i) => st.ocupados.add(i + 1));
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), logado = /sid=ok/.test(req.headers.cookie || ""), acao = u.searchParams.get("action");
    const corpo = cb => { let d = ""; req.on("data", c => d += c); req.on("end", () => cb(d)); };
    if (req.method === "POST" && acao === "admin_login") {
      corpo(d => { const ok = /username=teste/.test(d) && /password=senha-certa/.test(d); res.writeHead(302, { Location: "/index.php?page=admin", ...(ok ? { "Set-Cookie": "sid=ok; Path=/" } : {}) }); res.end(); }); return;
    }
    if (req.method === "POST" && acao === "emitir") {
      corpo(d => {
        const j = JSON.parse(d); st.pedidosEmissao.push(j); st.chamadas.push("emitir");
        if (!j.nome || !j.cpf || !ROTULO[j.tipo]) { res.statusCode = 400; res.end("erro"); return; }
        st.seq++; st.ocupados.add(Number(j.seat));
        st.linhas.push({ id: st.seq, nome: j.nome, cpf: fmtCpf(j.cpf), tel: j.telefone || "", cod: "TK-" + String(st.seq).padStart(4, "0"), tipo: ROTULO[j.tipo], escola: j.escola || "", cidade: j.cidade || "" });
        res.end("ok");
      }); return;
    }
    if (req.method === "POST" && acao === "excluir") { st.chamadas.push("excluir:" + u.searchParams.get("id")); st.linhas = st.linhas.filter(l => String(l.id) !== u.searchParams.get("id")); res.end("ok"); return; }
    if (acao) { st.chamadas.push(acao); res.end("ok"); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!logado) { res.end('<form method="post" action="/index.php?action=admin_login"><input name="username"><input type="password" name="password"><button type="submit">Entrar</button></form>'); return; }
    const livre = "seat-fluid bg-slate-850 border border-slate-700/80 text-emerald-400 hover:x", ocup = "seat-fluid bg-rose-500/20 text-rose-400 border border-rose-500/40";
    const seats = Array.from({ length: TOTAL }, (_, i) => i + 1).map(n => `<button class="${st.ocupados.has(n) ? ocup : livre}" onclick="abrirPopUpAssentoAdmin(${n})">${n}</button>`).join("");
    res.end('<h1>Gestão</h1><table><thead><tr><th></th><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Código</th><th>Tipo</th><th>Escola</th><th>Cidade</th><th>Ações</th></tr></thead><tbody>' +
      st.linhas.map(l => `<tr><td></td><td>${l.nome}</td><td>${l.cpf}</td><td>${l.tel}</td><td>${l.cod}</td><td>${l.tipo}</td><td>${l.escola}</td><td>${l.cidade}</td><td><button title="Enviar o ingresso (PDF) pelo WhatsApp (já enviado 0x)" onclick="fetch('/index.php?action=whats')">w</button><button title="Enviar o ingresso por e-mail" onclick="fetch('/index.php?action=email')">e</button><button title="Editar" onclick="fetch('/index.php?action=editar')">ed</button><a title="Reemitir (PDF)" href="index.php?page=ticket&ref=REF-${l.cod}">p</a><button title="Excluir ingresso" onclick="excluirVendaUnica(${l.id})">x</button></td></tr>`).join("") + '</tbody></table>' +
      '<table><thead><tr><th>Cliente</th><th>CPF</th><th>Ingresso</th><th>Horário Check-in</th><th>Ação</th></tr></thead><tbody>' + st.checkins.map(c => `<tr><td>${c.nome}</td><td>${fmtCpf(c.cpf)}</td><td>${c.cod}</td><td>19:40</td><td></td></tr>`).join("") + '</tbody></table>' + seats +
      '<div id="pop" style="display:none"><select id="popup-tipo-ingresso">' + Object.keys(ROTULO).map(k => `<option value="${k}">${ROTULO[k]}</option>`).join("") + '</select>' +
      '<input id="popup-buyer-nome"><input id="popup-buyer-email"><input id="popup-buyer-cpf"><input id="popup-buyer-telefone"><input id="popup-buyer-cidade"><textarea id="popup-buyer-observacao"></textarea>' +
      '<button onclick="fetch(\'/index.php?action=salvar\')">Salvar Dados</button><button onclick="fetch(\'/index.php?action=excluir-popup\')">Excluir</button><button id="emit" onclick="emitir()">Emitir Ingresso</button></div>' +
      '<div id="m" style="display:none"><button id="custom-confirm-yes-btn" type="submit" onclick="var a=window.alvo;fetch(\'/index.php?action=excluir&id=\'+a,{method:\'POST\'}).then(function(){location.reload()})">Confirmar</button></div>' +
      '<script>var seat=0;function excluirVendaUnica(id){window.alvo=id;document.getElementById("m").style.display="block"}' +
      'function abrirPopUpAssentoAdmin(n){seat=n;["popup-buyer-nome","popup-buyer-email","popup-buyer-cpf","popup-buyer-telefone","popup-buyer-cidade","popup-buyer-observacao"].forEach(function(i){document.getElementById(i).value=""});document.getElementById("pop").style.display="block"}' +
      'function emitir(){var v=function(i){return document.getElementById(i).value};fetch("/index.php?action=emitir",{method:"POST",body:JSON.stringify({seat:seat,tipo:v("popup-tipo-ingresso"),nome:v("popup-buyer-nome"),email:v("popup-buyer-email"),cpf:v("popup-buyer-cpf"),telefone:v("popup-buyer-telefone"),cidade:v("popup-buyer-cidade"),escola:v("popup-buyer-observacao")})}).then(function(r){if(r.ok)location.reload()})}<\/script>');
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  st.url = "http://127.0.0.1:" + srv.address().port + "/index.php?page=admin&evt_id=17";
  st.fechar = () => srv.close();
  return st;
}
module.exports = { iniciar };
