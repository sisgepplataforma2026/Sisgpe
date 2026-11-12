"""Teste da cópia completa com KingHost e Drive FALSOS (nada sai da máquina).
Rodar: python3 tools/kinghost-migrar/teste_migrar.py"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import migrar as M  # noqa: E402

falhas = []


def ok(c, d):
    print(("  ✓ " if c else "  ✗ ") + d)
    if not c:
        falhas.append(d)


def eml(n, pasta):
    return ("From: A <a@x>\r\nSubject: S%d\r\nMessage-ID: <%s-%d@x>\r\nDate: Mon, 05 Oct 2026 10:00:00 -0300\r\n\r\ncorpo" % (n, pasta, n)).encode()


class Imap:
    def __init__(self, pastas, flags):
        self.p, self.f, self.sel, self.modos, self.itens = pastas, flags, None, [], []

    def list(self):
        return "OK", [('(%s) "." "%s"' % (self.f.get(n, "\\HasNoChildren"), n)).encode() for n in self.p]

    def select(self, nome, readonly=False):
        self.modos.append(readonly)
        self.sel = nome.strip('"')
        return "OK", [str(len(self.p[self.sel])).encode()]

    def response(self, k):
        return "OK", [b"77"]

    def uid(self, cmd, *a):
        lista = self.p[self.sel]
        if cmd == "SEARCH":
            ini = int(a[2].split(":")[0])
            us = [i + 1 for i in range(len(lista)) if i + 1 >= ini] or ([len(lista)] if lista else [])
            return "OK", [" ".join(map(str, us)).encode()]
        self.itens.append(a[1])
        u = int(a[0])
        lido = b"\\Seen" if u % 2 else b""
        return "OK", [(b"1 (UID %d FLAGS (%s) BODY[] {9}" % (u, lido), lista[u - 1]), b")"]


pastas = {"INBOX": [eml(i, "in") for i in range(3)], "INBOX.Sent": [eml(i, "se") for i in range(2)],
          "INBOX.Trash": [eml(0, "tr")], "INBOX.Drafts": [eml(0, "dr")], "INBOX.Spam": [eml(0, "sp")],
          "INBOX.FICHAS DE SINDICALIZA&AMcAww-O": [eml(i, "fi") for i in range(150)],
          "INBOX.OFICIOS.2025": [eml(0, "of")]}
flags = {"INBOX.Sent": "\\HasNoChildren \\Sent", "INBOX.Trash": "\\HasNoChildren \\Trash"}

print("━━━ CÓPIA DA KINGHOST · destino de cada pasta")
im = Imap(pastas, flags)
linhas, total = M.levantar(im)
dest = {n: d for n, _, d, _t in linhas}
ok(dest["INBOX"] == 'pasta "CAIXA DE ENTRADA ANTIGA (KINGHOST)"', "caixa de entrada → pasta própria, fora da entrada do Gmail")
ok(dest["INBOX.Sent"] == "Itens enviados", "enviados → Itens enviados")
ok(dest["INBOX.FICHAS DE SINDICALIZAÇÃO"] == 'pasta "FICHAS DE SINDICALIZAÇÃO"', "pasta com acento (UTF-7) → mesmo nome")
ok(dest["INBOX.OFICIOS.2025"] == 'pasta "OFICIOS/2025"', "subpasta → A/B")
ok(M.destino({"nome": "INBOX.Drafts.CERTIFICADOS", "flags": ""}) == ("RASCUNHOS/CERTIFICADOS", False), "subpasta de Rascunhos → RASCUNHOS/…")
ok(all(dest[x] == "fica de fora" for x in ["INBOX.Trash", "INBOX.Drafts", "INBOX.Spam"]), "lixeira, rascunhos e spam ficam de fora")
ok(total == 3 + 2 + 150 + 1, "total a copiar: %d" % total)
ok(all(im.modos), "toda pasta aberta em SÓ LEITURA")

print("━━━ CÓPIA DA KINGHOST · lotes no Drive e retomada")
drive = {"pastas": {}, "arqs": []}


def f_listar(tok, q, campos=None):
    return [{"id": k, "name": v} for k, v in drive["pastas"].items() if not v.startswith("__")]


def f_pasta(tok, nome, pai=None, compartilhar=None):
    k = "id%d" % (len(drive["pastas"]) + 1)
    drive["pastas"][k] = nome
    return k


def f_subir(tok, pai, nome, raw, desc):
    drive["arqs"].append((pai, nome, json.loads(desc)))


nomes_vistos = []


def f_renomear(tok, fid, nome):
    drive["pastas"][fid] = nome
    nomes_vistos.append(nome)


M.listar, M.pasta, M.subir, M.renomear = f_listar, f_pasta, f_subir, f_renomear
M.LOTES_NA_FILA = 1   # uma rodada enche a fila com 1 lote
estado = {"pastas": {}, "lote": 0}
salvos = []
con = {"imap": Imap(pastas, flags), "conectar": lambda: Imap(pastas, flags)}
cont, motivo = M.migrar(con, lambda: "tok", "raiz", estado, lambda e: salvos.append(json.dumps(e)))
ok(cont["copiados"] == 100 and motivo == "fila cheia", "fila cheia: para em 1 lote de 100 (%d, %s)" % (cont["copiados"], motivo))
ok(all("PEEK" in str(x) for x in con["imap"].itens), "busca com BODY.PEEK (não marca como lido)")
ok(all(n.startswith("lote-") for n in drive["pastas"].values()), "lote só ganha o nome que o leitor pega quando está completo")
ok(drive["arqs"] and list(drive["pastas"].values())[0] == "lote-000001" and nomes_vistos == ["lote-000001"], "nasce 'enchendo-', fecha como 'lote-000001'")
d0 = drive["arqs"][0][2]
ok(d0["r"] == "CAIXA DE ENTRADA ANTIGA (KINGHOST)" and d0["m"] == "<in-0@x>" and "u" in d0, "descrição: pasta, Message-ID, lido/não lido")
ok(any(a[2]["s"] for a in drive["arqs"]), "os enviados vão marcados como enviados")
ok(not any(a[2]["m"].startswith(("<tr", "<dr", "<sp")) for a in drive["arqs"]), "nada da lixeira, rascunhos ou spam")
# o leitor termina o lote: vira OK; a próxima rodada apaga e continua de onde parou
for k in list(drive["pastas"]):
    drive["pastas"][k] += " OK"
lixo = []
M.P.drive = lambda tok, met, url, corpo=None, tipo=None: lixo.append(url) or {}
M.LOTES_NA_FILA = 50
n0 = len(drive["arqs"])
cont2, motivo2 = M.migrar({"imap": Imap(pastas, flags), "conectar": None}, lambda: "tok", "raiz", json.loads(salvos[-1]), lambda e: salvos.append(json.dumps(e)))
ok(len(lixo) >= 1, "lote terminado pelo leitor vai para a lixeira do Drive")
mids = [a[2]["m"] for a in drive["arqs"]]
ok(len(mids) == len(set(mids)), "retomou sem repetir nenhum e-mail")
ok(len(drive["arqs"]) == total and motivo2 == "tudo copiado", "no fim, todos copiados: %d de %d" % (len(drive["arqs"]), total))

print("━━━ CÓPIA DA KINGHOST · conexão que cai")


class Cai(Imap):
    def uid(self, cmd, *a):
        if cmd == "FETCH" and not getattr(self, "caiu", False):
            self.caiu = True
            raise M.imaplib.IMAP4.abort("EOF")
        return Imap.uid(self, cmd, *a)


drive["arqs"] = []
cont3, _ = M.migrar({"imap": Cai({"INBOX": pastas["INBOX"]}, {}), "conectar": lambda: Imap({"INBOX": pastas["INBOX"]}, {})},
                    lambda: "tok", "raiz", {"pastas": {}, "lote": 0}, lambda e: None)
ok(cont3["copiados"] == 3, "reconecta e continua (%d)" % cont3["copiados"])

print("\n%d falha(s)" % len(falhas))
sys.exit(1 if falhas else 0)
