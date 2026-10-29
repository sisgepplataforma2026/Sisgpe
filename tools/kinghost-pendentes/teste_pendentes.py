"""Teste do robô de pendentes com uma KingHost FALSA (nada sai da máquina).

Prova a regra (o que é pendente), a leitura das pastas em modo SÓ LEITURA e
com BODY.PEEK (não marca como lido), a pasta EMITIDOS de fora, e o nome de
pasta em UTF-7. Rodar: python3 tools/kinghost-pendentes/teste_pendentes.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import pendentes as P  # noqa: E402

falhas = []


def ok(cond, desc):
    print(("  ✓ " if cond else "  ✗ ") + desc)
    if not cond:
        falhas.append(desc)


def eml(de, para, assunto, mid, corpo="texto", reply_to_id=None, data="Mon, 05 Oct 2026 10:00:00 -0300"):
    cab = "From: %s\r\nTo: %s\r\nSubject: %s\r\nMessage-ID: %s\r\nDate: %s\r\n" % (de, para, assunto, mid, data)
    if reply_to_id:
        cab += "In-Reply-To: %s\r\nReferences: %s\r\n" % (reply_to_id, reply_to_id)
    return (cab + "\r\n" + corpo).encode()


class ImapFalso:
    def __init__(self, pastas):
        self.pastas = pastas  # {bruto: [bytes]}
        self.selecionada = None
        self.modos = []
        self.comandos = []

    def list(self):
        return "OK", [('(\\HasNoChildren%s) "/" "%s"' % (" \\Sent" if "Sent" in n else "", n)).encode() for n in self.pastas]

    def select(self, nome, readonly=False):
        self.modos.append(readonly)
        self.selecionada = nome.strip('"')
        return "OK", [b"1"]

    def uid(self, cmd, *args):
        self.comandos.append((cmd, args))
        lista = self.pastas[self.selecionada]
        if cmd == "SEARCH":
            return "OK", [" ".join(str(i + 1) for i in range(len(lista))).encode()]
        i = int(args[0]) - 1
        return "OK", [(b"1 (BODY[] {n}", lista[i]), b")"]


SEC = "Marcelha <secretaria@sindeducacao.com>"
pend = eml("Lucia <lucia@exemplo.com>", SEC, "Certificado de bolsa 2027", "<a1@x>")
resp_por_id = eml("Marcos <marcos@exemplo.com>", SEC, "Voucher 2027/1", "<a2@x>")
resp_por_assunto = eml("Rui <rui@exemplo.com>", SEC, "Bolsa 2026/2", "<a3@x>")
da_secretaria = eml(SEC, "alguem@x", "Aviso", "<a4@x>")
emitido = eml("Ze <ze@exemplo.com>", SEC, "Bolsa antiga", "<a5@x>")
outra_pasta = eml("Bia <bia@exemplo.com>", SEC, "Bolsa 2026/2 Enfermagem", "<a6@x>")
enviado1 = eml(SEC, "marcos@exemplo.com", "Re: Voucher 2027/1", "<s1@x>", reply_to_id="<a2@x>")
enviado2 = eml(SEC, "Rui <rui@exemplo.com>", "RES: Bolsa 2026/2", "<s2@x>")

imap = ImapFalso({
    "CERTIFICADO 2027-1": [pend, resp_por_id, da_secretaria],
    "CERTIFICADO 2026-2": [resp_por_assunto, outra_pasta],
    "CERTIFICADOS 2026-2 - EMITIDOS": [emitido],
    "INBOX.Sent": [enviado1, enviado2],
})

print("━━━ ROBÔ DE PENDENTES DA KINGHOST ━━━")
pastas = P.listar_pastas(imap)
alvo = [p for p in pastas if P.PASTAS.search(p["nome"]) and "EMITID" not in p["nome"].upper()]
env = [p for p in pastas if P.ENVIADOS.search(p["nome"]) or "\\Sent" in p["flags"]]
ok(sorted(p["nome"] for p in alvo) == ["CERTIFICADO 2026-2", "CERTIFICADO 2027-1"], "acha só as duas pastas, sem a EMITIDOS")
ok([p["nome"] for p in env] == ["INBOX.Sent"], "acha a pasta de enviados")

pedidos = {p["nome"]: P.mensagens_da_pasta(imap, p["bruto"]) for p in alvo}
enviados = P.mensagens_da_pasta(imap, env[0]["bruto"], so_cabecalho=True)
ok(any("HEADER.FIELDS" in str(a) for c, a in imap.comandos if c == "FETCH"), "dos enviados baixa só o cabeçalho")
ok(all(m is True for m in imap.modos), "toda pasta é aberta em modo SÓ LEITURA")
ok(all("PEEK" in str(a) for c, a in imap.comandos if c == "FETCH"), "toda leitura usa BODY.PEEK (não marca como lido)")
ok(not any(c in ("STORE", "COPY", "MOVE", "EXPUNGE") for c, a in imap.comandos), "nenhum comando que altere a caixa")

pend_lista, cont = P.separar_pendentes(pedidos, enviados, {"secretaria@sindeducacao.com"})
quem = sorted(P.endereco(P.email.message_from_bytes(p["raw"]).get("From")) for p in pend_lista)
ok(quem == ["bia@exemplo.com", "lucia@exemplo.com"], "pendentes: Lúcia e Bia — " + ", ".join(quem))
ok(cont["respondidos"] == 2, "respondidos: Marcos (por In-Reply-To) e Rui (por 'RES: mesmo assunto')")
ok(cont["nossos"] == 1, "a mensagem da própria Secretaria não conta como pedido")
ok(all(p["raw"] in (pend, outra_pasta) for p in pend_lista), "o e-mail vai inteiro, como veio")
ok(len({P.nome_arquivo(p) for p in pend_lista}) == 2, "cada pendente tem nome de arquivo próprio e estável")
ok(P.nome_arquivo(pend_lista[0]) == P.nome_arquivo(pend_lista[0]), "o nome não muda entre execuções (não duplica)")

ok(P.decodificar_utf7("Itens &AOk-nviados") == "Itens énviados", "nome de pasta em UTF-7 é decodificado")
ok(P.assunto_base("RES: Fwd: ENC: Bolsa 2026/2") == "bolsa 2026/2", "assunto sem RES/Fwd/ENC")

print("\nResumo: %d falha(s)" % len(falhas))
sys.exit(1 if falhas else 0)
