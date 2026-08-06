# NOTAS DE CAMPO — PROMPT MESTRE

> Observações técnicas mantidas **fora** do texto normativo, de propósito.
> `PROMPT-MESTRE.md` é o que o usuário escreveu, literal. Aqui fica o que eu
> verifiquei no código e o que diverge.

---

## 1. O que mudou da v1 (05/08) para a v2 (06/08)

A v1 está preservada em `PROMPT-MESTRE-v1-2026-08-05.md`.

### Seções inteiramente novas

| Seção | O que traz |
|---|---|
| **DIRETRIZ OFICIAL DE DASHBOARDS** | Três níveis (Geral, Módulo, Processo). Regra central: *"o dashboard deve mostrar o que o usuário precisa fazer agora"*. Cards e alertas **clicáveis**. "Evite dashboards decorativos." |
| **ARQUITETURA GERAL RECOMENDADA** | Lista oficial de **18 módulos**, nomeados. A v1 tinha só 34 áreas genéricas. |
| **MISSÃO E ESTRUTURA DOS MÓDULOS** | Missão + submódulos de cada um dos 17. **Isto responde o que a v1 não respondia**: a v1 mandava *definir* os submódulos; a v2 os *define*. |
| **ÍNDICE DE MATURIDADE** | Notas 0–10 em 14 dimensões, com justificativa. |
| **TEMPO ECONOMIZADO** | Tempo atual × tempo com SISGEP, com a fórmula de registro quando não há evidência: *"Estimativa pendente de medição operacional."* |

### Mudanças de conteúdo

- **Análise por módulo: de 25 para 36 itens.** Novos: *Evidências no código*, *O que não pertence*, *Dashboard atual × recomendado*, *Tempo economizado*.
- **China Park ganhou fluxo explícito**, incluindo **"consulta à Presidência"** entre a análise interna e a aprovação. E a regra: *"Não simular disponibilidade automática de hotel."*
- **Exigência de motor comum de benefícios** (solicitações, aprovações, anexos, notificações, histórico) — não existia na v1.
- **Exigência de serviço comum de comunicação** (e-mail, WhatsApp, modelos, assinaturas, rastreamento) para todos os módulos.
- **Escolas passa a ser "cadastro mestre institucional e CRM"**, com regra dura: *uma única entidade Escola; os demais módulos guardam `escolaId`*.
- **Financeiro ganha Bancos, Diretoria, Contabilidade, Fluxo de Caixa e Prestação de Contas** como submódulos próprios, e a regra de que Conciliação pertence a Bancos.

### Sobre a "consulta à Presidência" no China Park

Há uma tensão aparente com uma instrução anterior do usuário (05/08): *"Tira a parte do presidente"*. **Não são a mesma coisa.**

- A instrução de 05/08 era sobre a **mensagem enviada ao associado** — que não deve mencionar a Presidência. Há teste travando isso (`t3-link-interesse`).
- A v2 descreve o **fluxo interno** — a análise passa pela Presidência antes de aprovar.

Fluxo interno pode passar pela Presidência sem que a mensagem ao associado diga isso. Está mantido como está.

---

## 2. Divergências entre a v2 e o que já foi construído

Registradas porque **construí alguns módulos antes de esta versão existir**. Não são erros do sistema nem do documento — são decisões a tomar.

| Construído | Onde a v2 o coloca | Situação |
|---|---|---|
| **Negociação Coletiva** — módulo próprio, 30 verificações | Submódulo de **Jurídico** (item 10) | Divergente. A CCT é instrumento jurídico; a v2 tem razão na hierarquia. |
| **Assembleias Gerais** — módulo próprio, 55 verificações | **Eventos** (item 13: "eventos, assembleias, reuniões") e as deliberações em **Governança** (item 15: Reuniões, Deliberações, Pautas, Atas) | Divergente e dividido em dois. |
| **Governança e Mandatos** — módulo próprio, 32 verificações | **Governança e Diretoria** (item 15) | ✅ Confere. Falta acrescentar Verbas de Diretoria, Eleições, Editais, Projetos. |
| **Base de Associados** — 33 verificações, sem tela | Sindicalização tem *Situação Sindical* e *Histórico Sindical*; Escolas tem *Associados Vinculados* | Nome diferente, função equivalente. Cabe renomear. |
| **Atualização Cadastral** — posta como submódulo de Sindicalização no menu | **Módulo próprio** (item 4), com a nota *"Não confundir com filiação"* | Divergente. A v2 é mais clara. |
| **Patrimônio** — posto sob Financeiro no menu | **Módulo próprio** (item 11), com Inventário, Termos, Manutenção, Seguros | Divergente. |
| **Relatórios** — rebaixado a submódulo de Documentos | **Relatórios e BI**, módulo próprio (item 14) | Divergente — mas por um bom motivo: o que existe hoje é só relatório de ofício. O módulo da v2 ainda não existe. |
| **Auditoria** — proposta como submódulo de Configurações | **Auditoria e Compliance**, módulo próprio (item 16) | Divergente. A v2 é mais ambiciosa: inclui LGPD, Consentimentos, Retenção e Descarte, Incidentes. |

### Módulos da v2 que não existem de forma alguma

`Auditoria e Compliance` · `Relatórios e BI` · `Segurança e Integrações` ·
`Patrimônio` como módulo · `Atualização Cadastral` como módulo

---

## 3. Fatos do sistema que o documento pressupõe e não se confirmam

- **Firebase não existe.** O sistema é Google Sheets, ponta a ponta. As
  coleções que a v2 lista (`associados`, `escolas`, `despesas`…) são o alvo,
  não o presente. Sem banco, a auditoria unificada do item 16 não tem onde
  apoiar.
- **WhatsApp não existe** como canal do sistema. A Central de Comunicação
  manda e-mail (Gmail). O item 12 e o motor comum de benefícios pressupõem
  WhatsApp.
- **Portal das Escolas não existe** como portal. Escolas interagem por e-mail
  e pelo formulário de relação nominal.
- **Portal Público é outro projeto Apps Script**, em repositório separado.

## 4. Acesso que eu tenho

Só o repositório GitHub. Não tenho o projeto Apps Script, a planilha de
produção nem o Drive de trabalho — o conector do Drive lê documentos (foi
assim que li o Estatuto e a Ata de Posse), mas **não lê código-fonte de
projeto Apps Script**. Toda afirmação sobre o que está no ar depende de o
usuário confirmar.
