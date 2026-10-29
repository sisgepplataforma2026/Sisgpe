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


# Concluído = a resposta levou o VOUCHER anexado (usuário, 29/10/2026: "tem
# que conferir se foi enviado o voucher em anexo, assim dar como concluído").
# Um "recebemos, aguarde" não conclui nada. O voucher sai sempre em PDF, no
# modelo já aprovado; então a prova é um PDF anexado à resposta. O
# BODYSTRUCTURE diz isso sem baixar o arquivo.
CAB_ENVIADO = "(BODYSTRUCTURE BODY.PEEK[HEADER.FIELDS (TO CC SUBJECT DATE IN-REPLY-TO REFERENCES)])"


def tem_pdf_anexo(estrutura):
    e = estrutura.decode("latin-1", "replace") if isinstance(estrutura, bytes) else str(estrutura or "")
    return bool(re.search(r'"application"\s+"(pdf|x-pdf|octet-stream)"[^)]*\.pdf"|"application"\s+"pdf"'
                          r'|"(file)?name\*?"\s+"[^"]*\.pdf"', e, re.I))


# Pedidos 2026/2 e 2027/1 só existem de 2026 para cá; respostas, idem.
ENVIADOS_DESDE = "01-Jan-2026"
LOTE = 200   # mensagens por FETCH: uma ida ao servidor por lote, não por e-mail


def mensagens_da_pasta(imap, bruto, so_cabecalho=False, item=None, com_uid=False, desde=None):
    """desde: "01-Jan-2026" limita a busca (a pasta de Enviados tem anos)."""
    tipo, _ = imap.select('"' + bruto + '"', readonly=True)
    if tipo != "OK":
        return []
    tipo, dados = imap.uid("SEARCH", None, "SINCE", desde) if desde else imap.uid("SEARCH", None, "ALL")
    uids = (dados[0] or b"").split() if tipo == "OK" else []
    # Enviados: só os cabeçalhos que dizem a quem se respondeu — sem
    # baixar anexo de cada e-mail que a Secretaria já mandou.
    pedido = item or (CAB_ENVIADO if so_cabecalho else "(BODY.PEEK[])")
    saida = []
    for i in range(0, len(uids), LOTE):
        lote = b",".join(u if isinstance(u, bytes) else str(u).encode() for u in uids[i:i + LOTE])
        tipo, partes = imap.uid("FETCH", lote, pedido)
        if tipo != "OK":
            continue
        # Cada mensagem vem como (prefixo, literal) e, às vezes, um resto
        # solto depois. O BODYSTRUCTURE pode estar no prefixo ou no resto.
        atual = None
        for x in list(partes or []) + [None]:
            if isinstance(x, tuple) or x is None:
                if atual:
                    _fechar(atual, saida, so_cabecalho, com_uid)
                atual = {"meta": x[0], "raw": x[1]} if isinstance(x, tuple) and len(x) >= 2 else None
            elif isinstance(x, bytes) and atual:
                atual["meta"] += b" " + x
    return saida


def _fechar(m, saida, so_cabecalho, com_uid):
    uid = (re.search(rb"UID (\d+)", m["meta"]) or [None, None])[1]
    if so_cabecalho:
        saida.append((m["raw"], tem_pdf_anexo(m["meta"])))
    else:
        saida.append((uid, m["raw"]) if com_uid else m["raw"])


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


def data_de(msg):
    try:
        d = email.utils.parsedate_to_datetime(str(msg.get("Date", "") or ""))
        return d.timestamp() if d else None
    except Exception:
        return None


def ids_referenciados(msg):
    ids = set()
    for cab in ("In-Reply-To", "References"):
        for i in re.findall(r"<[^>]+>", str(msg.get(cab, "") or "")):
            ids.add(i.strip().lower())
    return ids


def separar_pendentes(pedidos_brutos, enviados_brutos, nossos):
    """pedidos_brutos: {nome_da_pasta: [bytes | (uid, bytes)]}.
    enviados_brutos: [(bytes, levou_pdf)] — bytes sozinho conta como SEM anexo.
    Devolve (pendentes, contagem)."""
    concluido_id, concluido_par = set(), set()      # resposta COM o voucher
    pdf_para = {}                                   # endereço → datas em que recebeu PDF
    respondido_id, respondido_par = set(), set()    # qualquer resposta
    for item in enviados_brutos:
        raw, levou_pdf = item if isinstance(item, tuple) else (item, False)
        m = email.message_from_bytes(raw, policy=email.policy.compat32)
        ids = ids_referenciados(m)
        base = assunto_base(m.get("Subject"))
        pares = set()
        for campo in ("To", "Cc"):
            for _, end in email.utils.getaddresses([str(m.get(campo, "") or "")]):
                if end:
                    pares.add((end.strip().lower(), base))
        respondido_id |= ids
        respondido_par |= pares
        if levou_pdf:
            concluido_id |= ids
            concluido_par |= pares
            # Voucher mandado num e-mail NOVO, com outro assunto, também
            # conclui: PDF para o mesmo endereço depois da data do pedido.
            quando = data_de(m)
            for end, _ in pares:
                pdf_para.setdefault(end, []).append(quando)
    pendentes, cont = [], {"lidos": 0, "nossos": 0, "respondidos": 0, "pendentes": 0, "sem_voucher": 0}
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
            par = (de, assunto_base(m.get("Subject")))
            pedido_em = data_de(m)
            pdf_depois = any(d is None or pedido_em is None or d >= pedido_em for d in pdf_para.get(de, []))
            if (mid and mid in concluido_id) or par in concluido_par or pdf_depois:
                cont["respondidos"] += 1
                continue
            if (mid and mid in respondido_id) or par in respondido_par:
                cont["sem_voucher"] += 1    # respondido, mas sem o voucher: segue pendente
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


def ja_enviados(token, pasta_id, com_id=False):
    nomes, pagina = ({} if com_id else set()), ""
    while True:
        q = urllib.parse.quote("'%s' in parents and trashed = false" % pasta_id)
        r = drive(token, "GET", "https://www.googleapis.com/drive/v3/files?q=" + q +
                  "&fields=nextPageToken,files(id,name)&pageSize=1000" + ("&pageToken=" + pagina if pagina else ""))
        for f in r.get("files", []):
            if com_id:
                nomes[f["name"]] = f["id"]
            else:
                nomes.add(f["name"])
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
    # Na KingHost a pasta é "INBOX.CERTIFICADO 2027-1"; a etiqueta no Gmail
    # é só "CERTIFICADO 2027-1" (o leitor procura por esse nome).
    nome = re.split(r"[./]", p["pasta"])[-1]
    pasta = re.sub(r"[^A-Za-z0-9-]+", "-", nome).strip("-")
    return "%s__%s.eml" % (pasta, p["chave"])


# ── PRINCIPAL ────────────────────────────────────────────────────────────

def main():
    senha = os.environ.get("KINGHOST_SECRETARIA_SENHA", "")
    if not senha:
        print("Sem o segredo KINGHOST_SECRETARIA_SENHA: nada a fazer (o robô só roda quando ele existir).")
        return 0
    servidor = os.environ.get("KINGHOST_IMAP", "imap.kinghost.net")
    print("Conectando a %s…" % servidor)
    # Sem tempo-limite, uma conexão parada trava o job até o fim do prazo.
    imap = imaplib.IMAP4_SSL(servidor, 993, timeout=60)
    print("Conectado. Entrando na caixa…")
    imap.login(CAIXA, senha)
    print("Login feito (só leitura).")
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
        env.extend(mensagens_da_pasta(imap, p["bruto"], so_cabecalho=True, desde=ENVIADOS_DESDE))
    print("  enviados: %d mensagem(ns)" % len(env))
    pendentes, cont = separar_pendentes(pedidos, env, {CAIXA, CONTA_LEITOR})
    print("Lidos: %(lidos)d · da própria Secretaria: %(nossos)d · concluídos (voucher anexado): "
          "%(respondidos)d · pendentes: %(pendentes)d (destes, %(sem_voucher)d tiveram resposta sem o voucher)" % cont)

    if os.environ.get("SO_CONFERIR") == "1":
        imap.logout()
        print("Modo conferir: nada foi enviado ao Drive.")
        return 0
    token = token_google()
    pid = pasta_drive(token)
    existentes = ja_enviados(token, pid, com_id=True)
    # O que deixou de ser pendente (a regra ficou mais precisa, ou o voucher
    # saiu depois) sai da pasta — vai para a lixeira, só arquivo nosso.
    agora = {nome_arquivo(p) for p in pendentes}
    tirados = 0
    for nome, fid in existentes.items():
        if nome.endswith(".eml") and nome not in agora:
            drive(token, "PATCH", "https://www.googleapis.com/drive/v3/files/" + fid, json.dumps({"trashed": True}).encode())
            tirados += 1
    if tirados:
        print("Tirados da pasta (não são mais pendentes): %d" % tirados)
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
