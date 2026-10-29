"""
PEDIDOS DE VOUCHER SEM RESPOSTA NAS PASTAS DA KINGHOST — 29/10/2026.

O usuário: "tem que buscar os 2026/2 e 2027/1 que estão sem responder
(pendentes)" e, depois, "preciso que faça e não que dê trabalho".

Os pedidos antigos estão nas pastas "CERTIFICADO 2026-2" e "CERTIFICADO
2027-1" da caixa secretaria@ na KingHost, onde a Marcela os separa à mão. O
redirecionamento para o Gmail da Secretaria só copia o que chegou depois de
21/10, e a importação do Gmail só aceita POP (que não enxerga pastas). Então
isto entra direto pelo IMAP:

  1. lê as duas pastas (nunca as "…EMITIDOS") e a pasta de Enviados;
  2. PENDENTE = mensagem de quem pediu que nenhum e-mail enviado responde —
     nem por In-Reply-To/References, nem por "Re: mesmo assunto" para o
     mesmo endereço;
  3. deixa cada pendente, inteiro (o .eml original), numa pasta temporária do
     Drive compartilhada com a conta da Secretaria. O leitor
     (LeitorSecretaria.gs) põe no Gmail dela e daí segue o caminho normal.

SÓ LÊ a KingHost: abre as pastas em modo leitura (EXAMINE) e busca com
BODY.PEEK, que não marca nada como lido. Não apaga, não move, não responde.
O log mostra só CONTAGENS — nem nome, nem endereço, nem assunto.
Segredo KINGHOST_SECRETARIA_SENHA criado pelo usuário em 29/10/2026.
"""
import email
import email.policy
import email.utils
import hashlib
import imaplib
import json
import os
import re
import sys
import urllib.parse
import urllib.request

CAIXA = "secretaria@sindeducacao.com"
CONTA_LEITOR = "sindeducacaosecretaria@gmail.com"
NOME_PASTA_DRIVE = "SISGEP — Pendentes KingHost (temporário)"
PASTAS = re.compile(r"CERTIFICADO\s*(2026\s*[-/]?\s*2|2027\s*[-/]?\s*1)", re.I)
ENVIADOS = re.compile(r"(^|[./])(sent|enviad|itens enviados)", re.I)


# ── IMAP ─────────────────────────────────────────────────────────────────

def decodificar_utf7(nome):
    """Nome de pasta IMAP vem em UTF-7 modificado (RFC 3501)."""
    def troca(m):
        trecho = m.group(1)
        if not trecho:
            return "&"
        b = trecho.replace(",", "/")
        b += "=" * (-len(b) % 4)
        import base64
        return base64.b64decode(b).decode("utf-16-be")
    return re.sub(r"&([^-]*)-", troca, nome)


def listar_pastas(imap):
    tipo, linhas = imap.list()
    pastas = []
    for linha in linhas or []:
        s = linha.decode("utf-8", "replace") if isinstance(linha, bytes) else str(linha)
        m = re.match(r'\((?P<flags>[^)]*)\) (?P<sep>"[^"]*"|NIL) (?P<nome>.+)$', s)
        if not m:
            continue
        bruto = m.group("nome").strip()
        if bruto.startswith('"') and bruto.endswith('"'):
            bruto = bruto[1:-1]
        pastas.append({"bruto": bruto, "nome": decodificar_utf7(bruto), "flags": m.group("flags")})
    return pastas


CAB_PEDIDO = "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)])"


def mensagem_inteira(imap, bruto, uid):
    """Baixa o .eml inteiro (com anexos) de UMA mensagem — só dos pendentes."""
    imap.select('"' + bruto + '"', readonly=True)
    tipo, partes = imap.uid("FETCH", uid, "(BODY.PEEK[])")
    for p in partes or []:
        if isinstance(p, tuple) and len(p) >= 2:
            return p[1]
    return None


def mensagens_da_pasta(imap, bruto, so_cabecalho=False, item=None, com_uid=False):
    tipo, _ = imap.select('"' + bruto + '"', readonly=True)
    if tipo != "OK":
        return []
    tipo, dados = imap.uid("SEARCH", None, "ALL")
    uids = (dados[0] or b"").split() if tipo == "OK" else []
    saida = []
    for uid in uids:
        # Enviados: só os cabeçalhos que dizem a quem se respondeu — sem
        # baixar anexo de cada e-mail que a Secretaria já mandou.
        pedido = item or ("(BODY.PEEK[HEADER.FIELDS (TO CC SUBJECT IN-REPLY-TO REFERENCES)])"
                          if so_cabecalho else "(BODY.PEEK[])")
        tipo, partes = imap.uid("FETCH", uid, pedido)
        if tipo != "OK":
            continue
        for p in partes:
            if isinstance(p, tuple) and len(p) >= 2:
                saida.append((uid, p[1]) if com_uid else p[1])
    return saida


# ── A REGRA: o que é pendente ────────────────────────────────────────────

def endereco(valor):
    return (email.utils.parseaddr(valor or "")[1] or "").strip().lower()


def assunto_base(s):
    s = str(s or "").strip()
    while True:
        novo = re.sub(r"^\s*(re|res|fw|fwd|enc|tr)\s*:\s*", "", s, flags=re.I)
        if novo == s:
            return re.sub(r"\s+", " ", s).lower()
        s = novo


def ids_referenciados(msg):
    ids = set()
    for cab in ("In-Reply-To", "References"):
        for i in re.findall(r"<[^>]+>", str(msg.get(cab, "") or "")):
            ids.add(i.strip().lower())
    return ids


def separar_pendentes(pedidos_brutos, enviados_brutos, nossos):
    """pedidos_brutos: {nome_da_pasta: [bytes]}. Devolve (pendentes, contagem)."""
    respondidos_id = set()
    respondidos_par = set()
    for raw in enviados_brutos:
        m = email.message_from_bytes(raw, policy=email.policy.compat32)
        respondidos_id |= ids_referenciados(m)
        base = assunto_base(m.get("Subject"))
        for campo in ("To", "Cc"):
            for _, end in email.utils.getaddresses([str(m.get(campo, "") or "")]):
                if end:
                    respondidos_par.add((end.strip().lower(), base))
    pendentes, cont = [], {"lidos": 0, "nossos": 0, "respondidos": 0, "pendentes": 0}
    for pasta, lista in pedidos_brutos.items():
        for item in lista:
            uid, raw = item if isinstance(item, tuple) else (None, item)
            cont["lidos"] += 1
            m = email.message_from_bytes(raw, policy=email.policy.compat32)
            de = endereco(m.get("From"))
            if not de or de in nossos:
                cont["nossos"] += 1
                continue
            mid = str(m.get("Message-ID", "") or "").strip().lower()
            if (mid and mid in respondidos_id) or (de, assunto_base(m.get("Subject"))) in respondidos_par:
                cont["respondidos"] += 1
                continue
            chave = hashlib.sha1((mid or (de + "|" + str(m.get("Date")) + "|" + str(m.get("Subject")))).encode()).hexdigest()[:20]
            pendentes.append({"pasta": pasta, "chave": chave, "raw": raw, "uid": uid})
            cont["pendentes"] += 1
    return pendentes, cont


# ── DRIVE (credencial do deploy: escopo drive.file) ──────────────────────

def token_google():
    rc = json.loads(os.environ["CLASPRC_JSON"])
    toks = rc.get("tokens") or {}
    t = toks.get("default") or (list(toks.values())[0] if toks else rc.get("token", {}))
    corpo = urllib.parse.urlencode({
        "client_id": t.get("client_id", ""), "client_secret": t.get("client_secret", ""),
        "refresh_token": t.get("refresh_token", ""), "grant_type": "refresh_token"}).encode()
    r = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", corpo))
    if "access_token" not in r:
        raise SystemExit("Falha ao renovar o token Google: " + str(r.get("error")))
    return r["access_token"]


def drive(token, metodo, url, corpo=None, tipo="application/json"):
    req = urllib.request.Request(url, data=corpo, method=metodo,
                                 headers={"Authorization": "Bearer " + token, "Content-Type": tipo})
    with urllib.request.urlopen(req) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else {}


def pasta_drive(token):
    q = urllib.parse.quote("name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                           % NOME_PASTA_DRIVE.replace("'", "\\'"))
    achou = drive(token, "GET", "https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id)")
    if achou.get("files"):
        return achou["files"][0]["id"]
    nova = drive(token, "POST", "https://www.googleapis.com/drive/v3/files",
                 json.dumps({"name": NOME_PASTA_DRIVE, "mimeType": "application/vnd.google-apps.folder"}).encode())
    drive(token, "POST", "https://www.googleapis.com/drive/v3/files/%s/permissions?sendNotificationEmail=false" % nova["id"],
          json.dumps({"type": "user", "role": "reader", "emailAddress": CONTA_LEITOR}).encode())
    return nova["id"]


def ja_enviados(token, pasta_id):
    nomes, pagina = set(), ""
    while True:
        q = urllib.parse.quote("'%s' in parents and trashed = false" % pasta_id)
        r = drive(token, "GET", "https://www.googleapis.com/drive/v3/files?q=" + q +
                  "&fields=nextPageToken,files(name)&pageSize=1000" + ("&pageToken=" + pagina if pagina else ""))
        nomes |= {f["name"] for f in r.get("files", [])}
        pagina = r.get("nextPageToken")
        if not pagina:
            return nomes


def subir(token, pasta_id, nome, raw):
    limite = "sisgepfronteira"
    meta = json.dumps({"name": nome, "parents": [pasta_id], "mimeType": "message/rfc822"}).encode()
    corpo = (b"--" + limite.encode() + b"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta +
             b"\r\n--" + limite.encode() + b"\r\nContent-Type: message/rfc822\r\n\r\n" + raw +
             b"\r\n--" + limite.encode() + b"--")
    drive(token, "POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          corpo, "multipart/related; boundary=" + limite)


def nome_arquivo(p):
    pasta = re.sub(r"[^A-Za-z0-9-]+", "-", p["pasta"]).strip("-")
    return "%s__%s.eml" % (pasta, p["chave"])


# ── PRINCIPAL ────────────────────────────────────────────────────────────

def main():
    senha = os.environ.get("KINGHOST_SECRETARIA_SENHA", "")
    if not senha:
        print("Sem o segredo KINGHOST_SECRETARIA_SENHA: nada a fazer (o robô só roda quando ele existir).")
        return 0
    imap = imaplib.IMAP4_SSL(os.environ.get("KINGHOST_IMAP", "imap.kinghost.net"), 993)
    imap.login(CAIXA, senha)
    pastas = listar_pastas(imap)
    alvo = [p for p in pastas if PASTAS.search(p["nome"]) and not re.search(r"EMITID", p["nome"], re.I)]
    enviados = [p for p in pastas if ENVIADOS.search(p["nome"]) or "\\Sent" in p["flags"]]
    print("Pastas de pedido: %s · pastas de enviados: %s" % (
        ", ".join(p["nome"] for p in alvo) or "NENHUMA", ", ".join(p["nome"] for p in enviados) or "NENHUMA"))
    if not alvo:
        print("Nenhuma pasta CERTIFICADO 2026-2 / 2027-1 encontrada. Nomes vistos: " +
              ", ".join(p["nome"] for p in pastas))
        return 0
    # Primeiro só os CABEÇALHOS: decidir o que é pendente não pede anexo.
    bruto_de = {p["nome"]: p["bruto"] for p in alvo}
    pedidos = {}
    for p in alvo:
        pedidos[p["nome"]] = mensagens_da_pasta(imap, p["bruto"], item=CAB_PEDIDO, com_uid=True)
        print("  %s: %d mensagem(ns)" % (p["nome"], len(pedidos[p["nome"]])))
    env = []
    for p in enviados:
        env.extend(mensagens_da_pasta(imap, p["bruto"], so_cabecalho=True))
    print("  enviados: %d mensagem(ns)" % len(env))
    pendentes, cont = separar_pendentes(pedidos, env, {CAIXA, CONTA_LEITOR})
    print("Lidos: %(lidos)d · da própria Secretaria: %(nossos)d · já respondidos: %(respondidos)d · "
          "pendentes: %(pendentes)d" % cont)

    if os.environ.get("SO_CONFERIR") == "1":
        imap.logout()
        print("Modo conferir: nada foi enviado ao Drive.")
        return 0
    token = token_google()
    pid = pasta_drive(token)
    existentes = ja_enviados(token, pid)
    novos = 0
    for p in pendentes:
        nome = nome_arquivo(p)
        if nome in existentes:
            continue
        raw = mensagem_inteira(imap, bruto_de[p["pasta"]], p["uid"])
        if not raw:
            continue
        subir(token, pid, nome, raw)
        novos += 1
        if novos % 10 == 0:
            print("  entregues até agora: %d" % novos)
    imap.logout()
    print("Entregues ao leitor agora: %d (já estavam lá: %d)." % (novos, len(pendentes) - novos))
    return 0


if __name__ == "__main__":
    sys.exit(main())
