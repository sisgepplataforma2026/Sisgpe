# ARQUITETURA DE SUBMÓDULOS — Portal Administrativo SISGEP

> Entregável do item **7.6** do `PROMPT-MESTRE.md` ("Definir todos os
> submódulos necessários") e do item **25** (mapa de submódulos, telas e ações).
>
> **O prompt mestre não lista os submódulos do SISGEP.** Ele define o que é um
> submódulo (§4), dá seis exemplos genéricos — Pagamentos, Despesas, Processos
> Jurídicos, Filiações, Eleições, Fiscalizações — e manda definir o resto. Este
> documento é essa definição.

## O padrão que o §4 estabelece

O único exemplo completo do prompt mestre é este:

```
Financeiro
└── Pagamentos
    ├── Aguardando lançamento
    ├── Lançados no banco
    ├── Aguardando compensação
    ├── Pagos
    └── Cancelados
```

**As telas são os ESTADOS do processo. As ações são as transições entre eles.**

Isso não é detalhe de nomenclatura — é o que decide se o sistema serve a quem
opera. A equipe do sindicato não trabalha por assunto ("quero ver pagamentos"),
trabalha por fila ("o que está esperando a minha decisão hoje"). Uma tela por
estado responde essa pergunta; uma aba por assunto obriga a pessoa a filtrar
mentalmente.

É também a razão pela qual **aba não é tela**. Aba agrupa assunto dentro de um
formulário; tela é uma fila de trabalho com ações próprias.

## Legenda

| Marca | Significado |
|---|---|
| ✅ | existe e tem teste executável |
| 🟡 | existe, sem teste |
| 🔧 | existe mas precisa reorganizar |
| ⭕ | não existe — proposta |

---

# ATENDIMENTO AO ASSOCIADO

## Sindicalização
*Ciclo de vida do associado, da ficha à desfiliação.*

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Filiações** ✅ | Aguardando assinatura · Assinadas · Matriculadas · Rejeitadas | Enviar OTP · Aprovar · Rejeitar · Gerar PDF |
| **Carteirinhas** ✅ | Solicitadas · Aprovadas · Emitidas · Revogadas | Aprovar foto · Emitir · Revogar |
| **Atualização Cadastral** 🟡 | Pendentes · Aprovadas · Devolvidas | Aprovar · Devolver para correção |
| **Base de Associados** ⭕ | Filiados · Não filiados · Sem matrícula · Sem e-mail | Consultar · Corrigir · Desfiliar · Gerar matrícula |
| **Desfiliações** ⭕ | Solicitadas · Em análise · Efetivadas | Analisar carta · Efetivar · Recusar |

> **Base de Associados** hoje não tem tela nenhuma: são ~8.000 pessoas
> alcançáveis só por dentro de outros fluxos. É a lacuna mais séria deste
> módulo — o §6 lista "Cadastro de Associados" como área própria.

## Benefícios
*Concessão e controle dos convênios.*

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Solicitações** 🔧 | Novas · Em análise · Aprovadas · Recusadas · Concluídas | Aprovar · Recusar · Enviar link |
| **China Park** ✅ | Pendentes · Aprovadas · Hóspedes pendentes · Check-in hoje · Check-out hoje · Encerradas | Aprovar · Distribuir suítes · Check-in · Check-out · No-show |
| **Guriri e Assefaz** 🟡 | Pendentes · Aprovadas · Encerradas | Aprovar · Recusar |
| **Oftalmologia** 🟡 | Aguardando agenda · Agendadas · Realizadas · Faltas | Agendar · Confirmar · Registrar falta |
| **Vouchers e Bolsas** 🟡 | Solicitados · Emitidos · Utilizados · Vencidos | Emitir · Cancelar |
| **Convênios** ⭕ | Vigentes · A vencer · Encerrados | Cadastrar · Renovar · Encerrar |

> **Convênios** é área do §6 e não existe: os benefícios estão no sistema, mas
> o *contrato* com cada parceiro (vigência, condições, contato, reajuste) não
> está em lugar nenhum. Sem ele ninguém sabe quando o China Park vence.

## Documentos
*Produção documental do sindicato.*

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Ofícios** 🔧 | Rascunho · Aguardando assinatura · Assinados · Enviados · Respondidos | Emitir · Assinar · Enviar · Registrar resposta |
| **Recibos** 🔧 | Em aberto · Emitidos · Cancelados | Gerar · Cancelar |
| **Certidões** 🔧 | Solicitadas · Emitidas | Emitir |
| **Protocolo** ⭕ | Entrados · Distribuídos · Respondidos · Arquivados | Protocolar · Distribuir · Arquivar |

> Hoje os três primeiros são **abas** dentro de um formulário. Viram telas.
> **Protocolo** não existe: documento que CHEGA ao sindicato não tem registro
> de entrada — só o que sai é controlado.

---

# RELACIONAMENTO

## Escolas
*Relacionamento com os estabelecimentos de ensino.*

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Cadastro** 🟡 | Ativas · Sem contato · Sem CNPJ · Inativas | Cadastrar · Atualizar · Inativar |
| **Visitas** 🟡 | Agenda do dia · Agendadas · Realizadas · Não realizadas | Agendar · Check-in · Registrar resultado |
| **Relação Nominal** 🟡 | Não enviada · Recebida · Conferida · Com pendência | Cobrar · Conferir · Aceitar |
| **Fiscalização** ⭕ | Denúncias · Em apuração · Notificadas · Regularizadas | Registrar · Notificar · Conferir piso · Encerrar |

> **Fiscalização Sindical** é área do §6, não existe, e já tem a base pronta:
> os 31 pisos da CCT estruturados em `NegociacaoColetiva.gs`. É o submódulo de
> maior retorno imediato — dá dente à cobrança e usa dado que já existe.

## Comunicação

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Caixa de E-mails** 🟡 | Não lidos · Aguardando resposta · Respondidos · Arquivados | Responder · Classificar · Encaminhar |
| **Painel do Dia** 🟡 | (visão consolidada) | — |
| **Campanhas** ⭕ | Rascunho · Agendadas · Enviadas | Criar · Agendar · Enviar |

## Eventos

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Programação** 🟡 | Planejados · Abertos · Encerrados | Criar · Abrir inscrições · Encerrar |
| **Inscrições** 🟡 | Confirmadas · Lista de espera · Canceladas | Confirmar · Cancelar |
| **Check-in** 🟡 | Aguardando · Presentes · Ausentes | Registrar presença |

---

# ADMINISTRAÇÃO

## Financeiro
*O exemplo literal do §4 — este módulo é o modelo dos demais.*

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Pagamentos** 🔧 | Aguardando lançamento · Lançados no banco · Aguardando compensação · Pagos · Cancelados | Lançar no banco · Confirmar · Cancelar · Reabrir · Anexar comprovante |
| **Despesas** ✅ | Registradas · Aprovadas · Enviadas à contabilidade · Estornadas | Registrar · Aprovar · Enviar · Estornar |
| **Receitas** 🟡 | A receber · Recebidas · Em atraso | Cadastrar · Baixar |
| **Mensalidade Sindical** 🟡 | Aguardando · Confirmadas · +30 dias | Cobrar · Confirmar |
| **Taxas (CCT 57 e 58)** 🟡 | A recolher · Recolhidas · Em atraso | Cobrar · Baixar |
| **Conciliação** ✅ | Não conciliadas · Conciliadas · Divergentes | Conciliar · Desfazer |
| **Prestadores** 🟡 | Ativos · Sem documento · Inativos | Cadastrar · Inativar |
| **Patrimônio** 🟡 | Em uso · Em manutenção · Baixados | Cadastrar · Baixar |
| **Auditoria de Valores** 🟡 | Todas as alterações · Acima do limite | Consultar |
| **Fluxo de Caixa** ⭕ | Projetado · Realizado | Consultar · Exportar |

> **Pagamentos** hoje não é submódulo próprio: está misturado a Despesas. O §4
> usa exatamente esse par como exemplo do que separar. Separar é o ajuste mais
> fiel ao prompt mestre que este sistema pode receber.

## RH

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Colaboradores** 🟡 | Ativos · Afastados · Desligados | Admitir · Afastar · Desligar |
| **Folha de Pagamento** 🟡 | Em aberto · Fechada · Paga | Calcular · Fechar · Gerar holerite |
| **Ponto e Férias** ⭕ | Férias a vencer · Em gozo · Vencidas | Programar · Registrar |
| **Documentos do RH** 🟡 | Emitidos | Emitir |

## Jurídico

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Processos** 🟡 | Em andamento · Com prazo aberto · Prazo vencido · Encerrados | Cadastrar · Movimentar · Encerrar |
| **Prazos e Audiências** 🟡 | Hoje · Semana · Vencidos | Cumprir · Adiar |
| **Pareceres e Minutas** 🟡 | Solicitados · Emitidos | Solicitar · Emitir |
| **Atendimento ao Associado** ⭕ | Aguardando · Em análise · Respondidos | Registrar · Responder |

---

# INSTITUCIONAL

## Governança ✅

| Submódulo | Telas | Ações |
|---|---|---|
| **Composição** ✅ | Diretoria · Conselho Fiscal · Delegados | Consultar |
| **Mandato** ✅ | Vigente · Calendário eleitoral | Consultar |
| **Conselho Fiscal** ✅ | Reuniões do ano · Pendências | Registrar reunião |
| **Reuniões da Diretoria** ⭕ | Convocadas · Realizadas · Atas pendentes | Convocar · Lavrar ata |

## Assembleias ✅

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Convocação** ✅ | Em preparo · Convocadas | Conferir edital · Registrar |
| **Realização** ✅ | A instalar · Instaladas · Sem quórum | Instalar · Deliberar |
| **Acervo** ✅ | Encerradas · Atas pendentes | Consultar · Anexar ata |
| **Protocolos de associados** ✅ | No prazo · Vencendo · Vencidos | Protocolar · Acompanhar |

## Negociação Coletiva ✅

| Submódulo | Telas | Ações |
|---|---|---|
| **CCT Vigente** ✅ | Cláusulas · Pisos · Vigência | Consultar · Conferir piso |
| **Campanha Salarial** ⭕ | Pauta · Rodadas · Acordo | Montar pauta · Registrar rodada |
| **Histórico de CCTs** ⭕ | Por ano | Consultar |

## Eleições ⭕
*Título IV do Estatuto, arts. 74 a 126 — o maior corpo de regra do Estatuto,
inteiramente ausente do sistema.*

| Submódulo | Telas (estados) | Ações |
|---|---|---|
| **Convocação** ⭕ | Edital em preparo · Publicado | Conferir prazo (art. 79) · Publicar |
| **Comissão Eleitoral** ⭕ | Composta | Nomear |
| **Chapas** ⭕ | Em registro · Registradas · Impugnadas · Deferidas | Registrar · Impugnar · Julgar |
| **Votação** ⭕ | Mesas · Em votação · Apurada | Abrir · Encerrar · Apurar |
| **Posse** ⭕ | A empossar · Empossada | Lavrar ata |

---

# SISTEMA

## Configurações

| Submódulo | Telas | Ações |
|---|---|---|
| **Ambiente** 🟡 | Produção/Homologação | Trocar |
| **Usuários e Acesso** 🟡 | Ativos · Inativos · Sem módulo definido | Criar · Definir módulos · Inativar |
| **Auditoria** 🔧 | Portal do Associado · *(disperso)* | Consultar |
| **Trilha Única** ⭕ | Todas as ações · Por módulo · Por usuário | Consultar · Exportar |
| **Saúde do Sistema** ⭕ | Triggers · Última execução · Falhas | Reinstalar · Testar |

> **Trilha Única** e **Saúde do Sistema** são as duas propostas mais
> importantes deste documento inteiro. Hoje a auditoria vive em 6 abas com
> nomes diferentes (§15 inalcançável) e os 9 triggers falham em silêncio — a
> cobrança das escolas depende de um deles.

---

# Resumo

| | Quantidade |
|---|---|
| Submódulos com teste executável ✅ | 14 |
| Existem sem teste 🟡 | 27 |
| Existem e precisam reorganizar 🔧 | 7 |
| **Propostos, não existem** ⭕ | **21** |
| **Total** | **69** |

## As cinco propostas que eu faria primeiro

1. **Financeiro › Pagamentos** separado de Despesas — é o exemplo literal do §4
2. **Configurações › Trilha Única** — destrava o §15 e o §18 do prompt mestre
3. **Escolas › Fiscalização** — base pronta (os 31 pisos da CCT)
4. **Sindicalização › Base de Associados** — 8.000 pessoas sem tela própria
5. **Configurações › Saúde do Sistema** — 9 triggers sem monitoramento

## Regra de implementação

**Nenhum item ⭕ vira botão de menu antes de a tela existir.** Botão que abre
tela vazia faz o sistema parecer pronto e não estar — é o erro que a REGRA
Nº -1 do `CLAUDE.md` existe para impedir. Este documento é o mapa; o menu só
recebe o que já funciona.
