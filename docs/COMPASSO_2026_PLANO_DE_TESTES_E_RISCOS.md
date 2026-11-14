# COMPASSO DA VIDA 2026 — Plano de Testes e Riscos

Status: Rascunho inicial para homologação

## 1. Objetivo
Garantir que a operação de inscrições e entrada da Festa Compasso da Vida 2026 suporte com segurança até 2.000 participantes, com emissão de ingresso individual, QR Code e check-in simultâneo por 6 a 8 celulares.

## 2. Escopo obrigatório — quatro pilares
1. Inscrição
2. Validação
3. QR Code / ingresso individual
4. Check-in

Camadas transversais: IDs únicos, auditoria, segurança, reconciliação de dados, homologação e gestão de riscos.

## 3. Identidade e rastreabilidade
Cada entidade deve possuir ID técnico único e imutável e, quando útil, código amigável. Exemplos: eventoId, pessoaId, associadoId, escolaId, inscricaoId, ingressoId e checkinId. Nomes, CPF, CNPJ ou matrícula não devem ser usados como chave primária.

## 4. Regras preliminares
- Capacidade máxima: 2.000 pessoas, sujeita à confirmação final da regra do evento.
- Uma pessoa não pode possuir mais de uma inscrição válida no mesmo evento, salvo exceção administrativa expressamente autorizada.
- Exceções devem registrar motivo, usuário autorizador, data/hora e trilha de auditoria.
- Cada participante deve possuir ingresso individual.
- Cada ingresso deve possuir QR Code/token único e não previsível.
- QR utilizado, cancelado, inválido ou pertencente a outro evento não pode liberar nova entrada.
- Check-in deve ser atômico para impedir dupla utilização em leituras simultâneas.
- Homologação e produção devem permanecer segregadas.
- Funções destrutivas de teste devem ser impossíveis de executar em produção.

## 5. Relatório de auditoria das inscrições
Filtros mínimos: A–Z, escola, cidade, região, situação, categoria, duplicidade e exceções autorizadas.

O relatório deve detectar, no mínimo:
- mesmo pessoaId;
- mesmo CPF normalizado;
- mesma matrícula, quando aplicável;
- possíveis duplicidades por nome + escola para revisão humana.

Nenhuma suspeita deve ser apagada automaticamente. O operador deve resolver ou autorizar a exceção.

## 6. Registro de riscos
Cada risco deverá conter: riscoId, descrição, causa, impacto, probabilidade, criticidade (P0/P1/P2), prevenção, contingência, teste associado, resultado esperado, evidência, responsável e status.

### Riscos P0 iniciais
- inscrição duplicada;
- ultrapassar o limite de vagas por concorrência;
- ingresso/QR duplicado ou previsível;
- dupla utilização do mesmo QR;
- check-in simultâneo aceito em dois aparelhos;
- ingresso cancelado aceito;
- QR adulterado ou de outro evento aceito;
- pagamento tratado como confirmado sem confirmação real, quando aplicável;
- divergência entre contador e ingressos ativos;
- perda de dados em falha parcial;
- função de homologação/teste executada em produção;
- indisponibilidade ou lentidão crítica na portaria;
- exposição indevida de dados pessoais no QR ou interface;
- alteração do código após a versão homologada sem novo teste.

Regra de GO/NO-GO: nenhum P0 pode permanecer aberto para liberação em produção.

## 7. Simulador Compasso 2026
Disponível somente em homologação.

Deve permitir massas de 10, 50, 200, 1.000, 2.000 e 2.500 participantes e executar cenários automáticos de inscrição, validação, emissão, cancelamento, duplicidade, reconciliação e check-in.

Testes mínimos:
- 2.000 vagas aceitas e 2.001ª bloqueada;
- tentativas simultâneas nas últimas vagas;
- duplicidade de CPF/pessoaId;
- clique duplo/triplo na inscrição;
- falha durante emissão sem corromper contador;
- unicidade dos QR Codes;
- QR cancelado, inválido, adulterado e de outro evento;
- duas ou mais leituras simultâneas do mesmo QR, aceitando somente uma;
- reconciliação contador x inscrições x ingressos ativos x check-ins.

## 8. Teste físico de portaria
Executar antes do evento com 6 a 8 celulares reais simultaneamente.

Medir:
- tempo médio e percentis de validação;
- taxa de erro;
- leituras por minuto;
- comportamento com QR repetido;
- comportamento com internet degradada;
- busca manual por nome/CPF/número do ingresso;
- capacidade de recuperação após falha.

## 9. Contingência de portaria
Planejar internet principal e reserva, aparelhos/carregadores/power banks, busca manual autorizada e procedimento para indisponibilidade. Falha de internet nunca deve resultar em liberação automática de QR sem validação.

## 10. Critério de aprovação
O relatório final deve apresentar APROVADO/REPROVADO por requisito, evidências dos testes, riscos residuais e decisão GO/NO-GO. Toda falha encontrada deve virar caso de teste permanente para evitar regressão.

## 11. Auditoria inicial do código existente
O motor atual já possui limite de 2.000 vagas, LockService, numeração sequencial, Firestore, cancelamento e busca de associados. Antes da produção devem ser auditados e/ou implementados: idempotência, bloqueio de duplicidade, QR seguro, check-in atômico, trilha de auditoria, segregação rígida HML/PROD, reconciliação e confirmação real de pagamento quando houver.
