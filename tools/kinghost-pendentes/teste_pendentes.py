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


def eml(de, para, assunto, mid, corpo="texto", reply_to_id=None, data="Mon, 05 Oct 2026 10:00:00 -0300", pdf=False):
    cab = "From: %s\r\nTo: %s\r\nSubject: %s\r\nMessage-ID: %s\r\nDate: %s\r\n" % (de, para, assunto, mid, data)
    if pdf:
        corpo += "\r\n--x\r\nContent-Type: application/pdf; name=Voucher.pdf\r\n\r\nJVBERi0=\r\n--x--"
    if reply_to_id:
        cab += "In-Reply-To: %s\r\nReferences: %s\r\n" % (reply_to_id, reply_to_id)
    return (cab + "\r\n" + corpo).encode()


class ImapFalso:
    def __init__(self, pastas):
        self.pastas = pastas  # {bruto: [bytes]}
        self.selecionada = None
        self.modos = []
        self.comandos = []
        self.buscas = []

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
            self.buscas.append(args)
            return "OK", [" ".join(str(i + 1) for i in range(len(lista))).encode()]
        saida = []
        for u in (args[0].decode() if isinstance(args[0], bytes) else str(args[0])).split(","):
            i = int(u) - 1
            cab = b"%d (UID %d BODY[] {n}" % (i + 1, i + 1)
            resto = b")"
            if "BODYSTRUCTURE" in str(args[1]):
                est = (b'(("text" "plain" NIL NIL NIL "7bit" 10 1)("application" "pdf" ("name" "Voucher.pdf") NIL NIL "base64" 900) "mixed")'
                       if b"application/pdf" in lista[i] else b'("text" "plain" NIL NIL NIL "7bit" 10 1)')
                if i % 2:   # metade das vezes o servidor manda a estrutura DEPOIS do cabeçalho
                    cab = b"%d (UID %d BODY[HEADER.FIELDS] {n}" % (i + 1, i + 1)
                    resto = b" BODYSTRUCTURE " + est + b")"
                else:
                    cab = b"%d (UID %d BODYSTRUCTURE " % (i + 1, i + 1) + est + b" BODY[HEADER.FIELDS] {n}"
            saida += [(cab, lista[i]), resto]
        return "OK", saida


SEC = "Marcelha <secretaria@sindeducacao.com>"
pend = eml("Lucia <lucia@exemplo.com>", SEC, "Certificado de bolsa 2027", "<a1@x>")
resp_por_id = eml("Marcos <marcos@exemplo.com>", SEC, "Voucher 2027/1", "<a2@x>")
resp_por_assunto = eml("Rui <rui@exemplo.com>", SEC, "Bolsa 2026/2", "<a3@x>")
da_secretaria = eml(SEC, "alguem@x", "Aviso", "<a4@x>")
emitido = eml("Ze <ze@exemplo.com>", SEC, "Bolsa antiga", "<a5@x>")
outra_pasta = eml("Bia <bia@exemplo.com>", SEC, "Bolsa 2026/2 Enfermagem", "<a6@x>")
enviado1 = eml(SEC, "marcos@exemplo.com", "Re: Voucher 2027/1", "<s1@x>", reply_to_id="<a2@x>", pdf=True)
enviado2 = eml(SEC, "Rui <rui@exemplo.com>", "RES: Bolsa 2026/2", "<s2@x>", pdf=True)
# Caso do usuário: a Secretaria respondeu pedindo o contracheque que falta.
# Isso é resposta, mas NÃO conclui — o pedido segue pendente.
falta_doc = eml("Carla <carla@exemplo.com>", SEC, "Voucher 2027/1 Direito", "<a7@x>")
enviado3 = eml(SEC, "carla@exemplo.com", "Re: Voucher 2027/1 Direito", "<s3@x>", reply_to_id="<a7@x>",
               corpo="Falta o contracheque.")
# Voucher mandado num e-mail NOVO, com outro assunto, depois do pedido: conclui.
novo_assunto = eml("Edu <edu@exemplo.com>", SEC, "Bolsa 2027/1 Medicina", "<a9@x>", data="Mon, 05 Oct 2026 10:00:00 -0300")
enviado5 = eml(SEC, "edu@exemplo.com", "Seu certificado", "<s5@x>", pdf=True, data="Tue, 06 Oct 2026 09:00:00 -0300")
# ...mas um PDF mandado ANTES do pedido não conclui o pedido novo.
antigo_pdf = eml(SEC, "fabi@exemplo.com", "Certificado 2026/1", "<s6@x>", pdf=True, data="Mon, 02 Feb 2026 09:00:00 -0300")
pedido_fabi = eml("Fabi <fabi@exemplo.com>", SEC, "Voucher 2027/1", "<a10@x>", data="Mon, 05 Oct 2026 10:00:00 -0300")
# A resposta-padrão da Secretaria a todo pedido (texto real, 29/10/2026):
# orienta e lista os documentos — NÃO leva voucher, não conclui.
padrao = eml("Davi <davi@exemplo.com>", SEC, "Voucher bolsa 2026/2", "<a8@x>")
enviado4 = eml(SEC, "davi@exemplo.com", "RE: Voucher bolsa 2026/2", "<s4@x>", reply_to_id="<a8@x>",
               corpo="Encaminhamos abaixo as informações necessárias para o processo de solicitação do voucher "
                     "de bolsa de estudos: Último contracheque, CNH ou RG, Nome do curso.")

imap = ImapFalso({
    "CERTIFICADO 2027-1": [pend, resp_por_id, da_secretaria, falta_doc],
    "CERTIFICADO 2026-2": [resp_por_assunto, outra_pasta, padrao, novo_assunto, pedido_fabi],
    "CERTIFICADOS 2026-2 - EMITIDOS": [emitido],
    "INBOX.Sent": [enviado1, enviado2, enviado3, enviado4, enviado5, antigo_pdf],
})

print("━━━ ROBÔ DE PENDENTES DA KINGHOST ━━━")
pastas = P.listar_pastas(imap)
alvo = [p for p in pastas if P.PASTAS.search(p["nome"]) and "EMITID" not in p["nome"].upper()]
env = [p for p in pastas if P.ENVIADOS.search(p["nome"]) or "\\Sent" in p["flags"]]
ok(sorted(p["nome"] for p in alvo) == ["CERTIFICADO 2026-2", "CERTIFICADO 2027-1"], "acha só as duas pastas, sem a EMITIDOS")
ok([p["nome"] for p in env] == ["INBOX.Sent"], "acha a pasta de enviados")

pedidos = {p["nome"]: P.mensagens_da_pasta(imap, p["bruto"]) for p in alvo}
enviados = P.mensagens_da_pasta(imap, env[0]["bruto"], so_cabecalho=True, desde=P.ENVIADOS_DESDE)
ok(any("HEADER.FIELDS" in str(a) and "BODYSTRUCTURE" in str(a) for c, a in imap.comandos if c == "FETCH"),
   "dos enviados baixa só o cabeçalho e a estrutura (sem o PDF)")
ok(len([1 for c, a in imap.comandos if c == "FETCH"]) == 3, "um FETCH por pasta (em lote), não um por e-mail")
ok(any("SINCE" in a for a in imap.buscas), "nos enviados, só de 2026 para cá")
ok(all(m is True for m in imap.modos), "toda pasta é aberta em modo SÓ LEITURA")
ok(all("PEEK" in str(a) for c, a in imap.comandos if c == "FETCH"), "toda leitura usa BODY.PEEK (não marca como lido)")
ok(not any(c in ("STORE", "COPY", "MOVE", "EXPUNGE") for c, a in imap.comandos), "nenhum comando que altere a caixa")

pend_lista, cont = P.separar_pendentes(pedidos, enviados, {"secretaria@sindeducacao.com"})
quem = sorted(P.endereco(P.email.message_from_bytes(p["raw"]).get("From")) for p in pend_lista)
ok(quem == ["bia@exemplo.com", "carla@exemplo.com", "davi@exemplo.com", "fabi@exemplo.com", "lucia@exemplo.com"],
   "pendentes: Bia, Carla, Davi, Fabi e Lúcia — " + ", ".join(quem))
ok("edu@exemplo.com" not in quem, "Edu: voucher em e-mail novo, com outro assunto, depois do pedido — concluído")
ok("fabi@exemplo.com" in quem, "Fabi: o PDF que ela recebeu foi ANTES deste pedido — segue pendente")
ok(cont["respondidos"] == 3, "concluídos (voucher em PDF): Marcos (In-Reply-To), Rui ('RES: mesmo assunto') e Edu (e-mail novo)")
ok(cont["sem_voucher"] == 2, "Carla (pedimos o contracheque) e Davi (só a resposta-padrão com a lista de documentos): continuam PENDENTES")
ok(P.tem_pdf_anexo(b'("application" "pdf" ("name" "V.pdf"))') and not P.tem_pdf_anexo(b'("text" "plain")'),
   "sabe dizer se a resposta levou PDF")
ok(P.tem_pdf_anexo(b'("application" "octet-stream" ("name" "Voucher 2027.pdf"))'), "PDF mandado como 'octet-stream' também conta")
ok(not P.tem_pdf_anexo(b'("image" "png" ("name" "assinatura.png"))'), "imagem da assinatura não conta como voucher")
ok(cont["nossos"] == 1, "a mensagem da própria Secretaria não conta como pedido")
ok(all(p["raw"] in (pend, outra_pasta, falta_doc, padrao, pedido_fabi) for p in pend_lista), "o e-mail vai inteiro, como veio")
ok(len({P.nome_arquivo(p) for p in pend_lista}) == 5, "cada pendente tem nome de arquivo próprio e estável")
ok(P.nome_arquivo(pend_lista[0]) == P.nome_arquivo(pend_lista[0]), "o nome não muda entre execuções (não duplica)")

# Como o main faz: cabeçalhos de tudo, .eml inteiro só dos pendentes.
imap.comandos.clear()
cab = {p["nome"]: P.mensagens_da_pasta(imap, p["bruto"], item=P.CAB_PEDIDO, com_uid=True) for p in alvo}
ok(all("HEADER.FIELDS" in str(a) for c, a in imap.comandos if c == "FETCH"), "das pastas de pedido, primeiro só o cabeçalho")
pend2, _ = P.separar_pendentes(cab, enviados, {"secretaria@sindeducacao.com"})
bruto_de = {p["nome"]: p["bruto"] for p in alvo}
imap.comandos.clear()
inteiros = [P.mensagem_inteira(imap, bruto_de[p["pasta"]], p["uid"]) for p in pend2]
ok(sorted(inteiros) == sorted([pend, outra_pasta, falta_doc, padrao, pedido_fabi]), "o .eml inteiro vem só dos pendentes, pelo uid certo")
ok(len([1 for c, a in imap.comandos if c == "FETCH"]) == 5, "anexos baixados só 5 vezes (os 5 pendentes)")

arq = P.nome_arquivo({"pasta": "INBOX.CERTIFICADO 2027-1", "chave": "abc"})
ok(arq == "CERTIFICADO-2027-1__abc.eml", "o prefixo INBOX. da KingHost sai do nome — " + arq)

ok(P.decodificar_utf7("Itens &AOk-nviados") == "Itens énviados", "nome de pasta em UTF-7 é decodificado")
ok(P.assunto_base("RES: Fwd: ENC: Bolsa 2026/2") == "bolsa 2026/2", "assunto sem RES/Fwd/ENC")

print("\nResumo: %d falha(s)" % len(falhas))
sys.exit(1 if falhas else 0)
