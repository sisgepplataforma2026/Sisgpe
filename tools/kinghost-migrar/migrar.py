"""
CÓPIA DE TODA A CAIXA secretaria@ DA KINGHOST PARA O GMAIL DA SECRETARIA — 12/11/2026.

O usuário: "tem que copiar todos os e-mails", "e todas as pastas também",
"tudo no King deve aparecer no SISGEP — é o mesmo e-mail".

O SISGEP lê o Gmail da Secretaria (sindeducacaosecretaria@gmail.com), que só
recebe cópia do que chegou depois de 21/10/2026. As pastas em que a Marcela
guarda os arquivos (ABRIR, FICHAS DE SINDICALIZAÇÃO, OFÍCIOS…) só existiam na
KingHost. Aqui:

  1. lê TODAS as pastas pelo IMAP, SÓ LEITURA (EXAMINE + BODY.PEEK: não marca
     nada como lido, não apaga, não move);
  2. cada e-mail vai, como o .eml original, para lotes de 100 numa pasta do
     Drive compartilhada com a conta da Secretaria. A descrição do arquivo diz
     a pasta de destino, se é enviado, se estava não lido e o Message-ID;
  3. o leitor (LeitorSecretaria.gs, leitorMigracaoKingHost_) põe no Gmail, na
     pasta de mesmo nome, e não duplica o que já está lá.

Para onde vai cada pasta:
  - Caixa de entrada → pasta "CAIXA DE ENTRADA ANTIGA (KINGHOST)" (fora da
    caixa de entrada do Gmail: senão o robô trataria e-mail antigo como novo;
    o que chegou depois de 21/10 já está lá e não duplica);
  - Enviados → Itens enviados;
  - as outras → pasta de mesmo nome (subpasta "A.B" vira "A/B");
  - Lixeira, Spam e Rascunhos ficam de fora.

Retoma de onde parou: o estado (último UID copiado de cada pasta) fica num
arquivo na própria pasta do Drive. No máximo LOTES_NA_FILA lotes esperando o
leitor; os que ele termina ("… OK") vão para a lixeira do Drive.
O log mostra nomes de PASTA e CONTAGENS — nunca remetente, endereço ou assunto.
"""
import email
import email.policy
import imaplib
import json
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "kinghost-pendentes"))
import pendentes as P  # noqa: E402

PASTA_DRIVE = "SISGEP — Migração KingHost (temporário)"
ESTADO = "estado-migracao.json"
POR_LOTE = 100
LOTES_NA_FILA = 20
ROTULO_ENTRADA = "CAIXA DE ENTRADA ANTIGA (KINGHOST)"
FORA = re.compile(r"(^|[./])(trash|lixeira|lixo|junk|spam|drafts?|rascunhos?)$", re.I)
FLAGS_FORA = ("\\Trash", "\\Junk", "\\Drafts", "\\Noselect")


def destino(p):
    """(nome da pasta no Gmail, é enviado?) — ou None se fica de fora."""
    nome, flags = p["nome"], p.get("flags", "")
    if any(f in flags for f in FLAGS_FORA) or FORA.search(nome):
        return None
    if P.ENVIADOS.search(nome) or "\\Sent" in flags:
        return ("", True)
    if nome.upper() == "INBOX":
        return (ROTULO_ENTRADA, False)
    partes = [x for x in re.split(r"[./]", nome) if x]
    if partes and partes[0].upper() == "INBOX":
        partes = partes[1:]
    if partes and re.match(r"drafts?$", partes[0], re.I):
        partes[0] = "RASCUNHOS"   # subpasta criada dentro de Rascunhos
    return ("/".join(partes).strip() or ROTULO_ENTRADA, False)


def contar(imap, bruto):
    tipo, d = imap.select('"' + bruto + '"', readonly=True)
    if tipo != "OK":
        return None, None
    n = int((d[0] or b"0").decode() or 0) if d else 0
    tipo, v = imap.response("UIDVALIDITY")
    uv = (v[0].decode() if v and v[0] else "") if tipo == "OK" else ""
    return n, uv


def tamanho(imap, n):
    """Soma do tamanho (bytes) da pasta já selecionada — só RFC822.SIZE."""
    if not n:
        return 0
    tipo, partes = imap.fetch("1:*", "(RFC822.SIZE)")
    total = 0
    for x in partes or []:
        t = x[0] if isinstance(x, tuple) else x
        m = re.search(rb"RFC822\.SIZE (\d+)", t if isinstance(t, bytes) else str(t).encode())
        if m:
            total += int(m.group(1))
    return total


def uids_depois(imap, ultimo):
    tipo, dados = imap.uid("SEARCH", None, "UID", "%d:*" % (int(ultimo) + 1))
    us = [int(u) for u in (dados[0] or b"").split()] if tipo == "OK" else []
    return sorted(u for u in us if u > int(ultimo))   # "N:*" devolve o último mesmo se for menor


def baixar(imap, uid):
    tipo, partes = imap.uid("FETCH", str(uid), "(FLAGS BODY.PEEK[])")
    for x in partes or []:
        if isinstance(x, tuple) and len(x) >= 2:
            return x[1], (b"\\Seen" in x[0])
    return None, True


def descricao(raw, pasta, enviado, lido):
    m = email.message_from_bytes(raw[:65536], policy=email.policy.compat32)
    mid = str(m.get("Message-ID", "") or "").strip()
    return json.dumps({"r": pasta, "s": bool(enviado), "u": not lido, "m": mid}, ensure_ascii=False)


# ── DRIVE ─────────────────────────────────────────────────────────────────

def _q(s):
    return urllib.parse.quote(s)


def listar(token, q, campos="files(id,name)"):
    out, pagina = [], ""
    while True:
        r = P.drive(token, "GET", "https://www.googleapis.com/drive/v3/files?q=" + _q(q) + "&fields=nextPageToken," + campos +
                    "&pageSize=1000" + ("&pageToken=" + pagina if pagina else ""))
        out += r.get("files", [])
        pagina = r.get("nextPageToken")
        if not pagina:
            return out


def pasta(token, nome, pai=None, compartilhar=None):
    q = "name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" % nome.replace("'", "\\'")
    if pai:
        q += " and '%s' in parents" % pai
    achou = listar(token, q)
    if achou:
        return achou[0]["id"]
    meta = {"name": nome, "mimeType": "application/vnd.google-apps.folder"}
    if pai:
        meta["parents"] = [pai]
    nova = P.drive(token, "POST", "https://www.googleapis.com/drive/v3/files", json.dumps(meta).encode())
    if compartilhar:
        P.drive(token, "POST", "https://www.googleapis.com/drive/v3/files/%s/permissions?sendNotificationEmail=false" % nova["id"],
                json.dumps({"type": "user", "role": "writer", "emailAddress": compartilhar}).encode())
    return nova["id"]


def renomear(token, fid, nome):
    P.drive(token, "PATCH", "https://www.googleapis.com/drive/v3/files/" + fid, json.dumps({"name": nome}).encode())


def subir(token, pai, nome, raw, desc):
    limite = "sisgepmigracao"
    meta = json.dumps({"name": nome, "parents": [pai], "mimeType": "message/rfc822", "description": desc}).encode()
    corpo = (b"--" + limite.encode() + b"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta +
             b"\r\n--" + limite.encode() + b"\r\nContent-Type: message/rfc822\r\n\r\n" + raw +
             b"\r\n--" + limite.encode() + b"--")
    P.drive(token, "POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            corpo, "multipart/related; boundary=" + limite)


def ler_estado(token, pid):
    f = listar(token, "name = '%s' and '%s' in parents and trashed = false" % (ESTADO, pid))
    if not f:
        return None, {"pastas": {}, "lote": 0}
    req = P.urllib.request.Request("https://www.googleapis.com/drive/v3/files/%s?alt=media" % f[0]["id"],
                                   headers={"Authorization": "Bearer " + token})
    with P.urllib.request.urlopen(req) as r:
        return f[0]["id"], json.loads(r.read().decode())


def gravar_estado(token, pid, fid, estado):
    corpo = json.dumps(estado).encode()
    if fid:
        P.drive(token, "PATCH", "https://www.googleapis.com/upload/drive/v3/files/%s?uploadType=media" % fid, corpo)
        return fid
    limite = "sisgepestado"
    meta = json.dumps({"name": ESTADO, "parents": [pid]}).encode()
    pacote = (b"--" + limite.encode() + b"\r\nContent-Type: application/json\r\n\r\n" + meta + b"\r\n--" + limite.encode() +
              b"\r\nContent-Type: application/json\r\n\r\n" + corpo + b"\r\n--" + limite.encode() + b"--")
    return P.drive(token, "POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                   pacote, "multipart/related; boundary=" + limite)["id"]


# ── PRINCIPAL ─────────────────────────────────────────────────────────────

def levantar(imap):
    """Todas as pastas, com destino e quantidade — nada é copiado."""
    linhas, total, bytes_ = [], 0, 0
    for p in P.listar_pastas(imap):
        d = destino(p)
        n, _ = contar(imap, p["bruto"])
        tam = 0
        if d is not None and n and os.environ.get("MEDIR_TAMANHO") == "1":
            try:
                tam = tamanho(imap, n)
            except Exception:
                tam = 0
        if d is None:
            linhas.append((p["nome"], n, "fica de fora", 0))
            continue
        total += n or 0
        bytes_ += tam
        linhas.append((p["nome"], n, "Itens enviados" if d[1] else "pasta \"%s\"" % d[0], tam))
    levantar.bytes = bytes_
    return linhas, total


def migrar(con, tk, pid, estado, salvar, limite_tempo=None, relogio=None):
    """Copia o que ainda não foi copiado, até encher a fila de lotes ou o tempo.
    con: {"imap": conexão, "conectar": função}; tk(): token Google válido."""
    import time
    relogio = relogio or time.time
    t0 = relogio()
    lotes = listar(tk(), "'%s' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false" % pid)
    # Lotes que o leitor terminou: para a lixeira do Drive (arquivo nosso).
    for l in lotes:
        if l["name"].endswith(" OK"):
            P.drive(tk(), "PATCH", "https://www.googleapis.com/drive/v3/files/" + l["id"], json.dumps({"trashed": True}).encode())
    na_fila = len([l for l in lotes if not l["name"].endswith(" OK")])
    cont = {"copiados": 0, "pastas": 0}
    # O lote nasce "enchendo-…" e só vira "lote-…" (o que o leitor pega)
    # quando está completo: o leitor nunca termina um lote ainda recebendo
    # e-mail. Sobra de rodada interrompida: entrega como está.
    for l in lotes:
        if l["name"].startswith("enchendo-"):
            renomear(tk(), l["id"], l["name"][len("enchendo-"):])
    lote = {"id": None, "nome": "", "n": 0}

    def fechar():
        if lote["id"]:
            renomear(tk(), lote["id"], lote["nome"])
            lote["id"] = None

    def parar(motivo):
        fechar()
        salvar(estado)
        return cont, motivo
    for p in P.listar_pastas(con["imap"]):
        d = destino(p)
        if d is None:
            continue
        n, uv = contar(con["imap"], p["bruto"])
        if n is None:
            continue
        st = estado["pastas"].get(p["bruto"]) or {}
        if st.get("uv") != uv:
            st = {"uv": uv, "ultimo": 0}
        for uid in uids_depois(con["imap"], st["ultimo"]):
            if limite_tempo and relogio() - t0 > limite_tempo:
                return parar("tempo")
            if lote["id"] is None or lote["n"] >= POR_LOTE:
                fechar()
                if na_fila >= LOTES_NA_FILA:
                    return parar("fila cheia")
                estado["lote"] += 1
                lote["nome"] = "lote-%06d" % estado["lote"]
                lote["id"] = pasta(tk(), "enchendo-" + lote["nome"], pai=pid)
                lote["n"] = 0
                na_fila += 1
            try:
                raw, lido = baixar(con["imap"], uid)
            except (imaplib.IMAP4.abort, OSError):
                # A KingHost derruba conexão longa: reconecta e tenta de novo.
                try:
                    con["imap"].logout()
                except Exception:
                    pass
                con["imap"] = con["conectar"]()
                contar(con["imap"], p["bruto"])
                raw, lido = baixar(con["imap"], uid)
            if raw:
                subir(tk(), lote["id"], "%06d-%s.eml" % (lote["n"], uid), raw, descricao(raw, d[0], d[1], lido))
                lote["n"] += 1
                cont["copiados"] += 1
            st["ultimo"] = uid
            estado["pastas"][p["bruto"]] = st
            if cont["copiados"] and cont["copiados"] % 100 == 0:
                salvar(estado)
        cont["pastas"] += 1
    return parar("tudo copiado")


def main():
    import time
    senha = os.environ.get("KINGHOST_SECRETARIA_SENHA", "")
    if not senha:
        print("Sem o segredo KINGHOST_SECRETARIA_SENHA: nada a fazer.")
        return 0
    servidor = os.environ.get("KINGHOST_IMAP", "imap.kinghost.net")

    def conectar():
        c = imaplib.IMAP4_SSL(servidor, 993, timeout=120)
        c.login(P.CAIXA, senha)
        return c
    con = {"imap": conectar(), "conectar": conectar}
    print("Conectado à KingHost (só leitura).")
    linhas, total = levantar(con["imap"])
    print("PASTAS DA secretaria@ NA KINGHOST:")
    for nome, n, para, tam in linhas:
        print("  %-45s %6s e-mail(s) %9.1f MB → %s" % (nome, n if n is not None else "?", tam / 1048576.0, para))
    print("Total a copiar: %d e-mail(s), %.2f GB." % (total, getattr(levantar, "bytes", 0) / 1073741824.0))
    if os.environ.get("SO_CONFERIR") == "1":
        con["imap"].logout()
        print("Modo conferir: nada foi copiado.")
        return 0
    tok = {"v": None, "t": 0}

    def tk():
        if not tok["v"] or time.time() - tok["t"] > 2400:
            tok["v"], tok["t"] = P.token_google(), time.time()
        return tok["v"]
    pid = pasta(tk(), PASTA_DRIVE, compartilhar=P.CONTA_LEITOR)
    fid, estado = ler_estado(tk(), pid)
    caixa = {"fid": fid}

    def salvar(e):
        caixa["fid"] = gravar_estado(tk(), pid, caixa["fid"], e)
    cont, motivo = migrar(con, tk, pid, estado, salvar, limite_tempo=float(os.environ.get("LIMITE_S", "19800")))
    try:
        con["imap"].logout()
    except Exception:
        pass
    print("Copiados para o Drive nesta rodada: %d · parou por: %s · lotes criados até hoje: %d" % (cont["copiados"], motivo, estado["lote"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
