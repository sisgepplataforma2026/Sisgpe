/**
 * FESTA 2026 · INFORMAÇÕES V2
 *
 * Protege a primeira fatia vertical da nova arquitetura de Eventos:
 * Controller administrativo → Service V2 → Repository V2 → homologação,
 * sem desmontar o fluxo legado do Compasso e sem colocar métricas internas
 * no payload da futura experiência pública.
 */
const fs = require('fs');
const path = require('path');
const { fluxo, passo, ok, resumo } = require('./base');

const RAIZ = path.resolve(__dirname, '..', '..');
const ler = arq => fs.readFileSync(path.join(RAIZ, arq), 'utf8');

const controller = ler('EventosControllerV2.gs');
const service = ler('EventosServiceV2.gs');
const repo = ler('EventosRepositoryV2.gs');
const dominio = ler('EventosDominioV2.gs');
const tela = ler('EventosAdmin.html');

fluxo('EVENTOS V2 · Informações administrativas da Festa 2026');

passo('a tela nova existe sem desmontar os fluxos atuais');
/* A tela dos dados da Festa continua existindo; o que mudou em 24/08/2026 foi
   ONDE ela mora. As seis abas viraram três submódulos (PROMPT-MESTRE §4:
   Módulo → Submódulo → Tela → Ação), e "Informações" passou a ser a tela
   "Dados da Festa 2026" dentro do submódulo Programação — que é onde o evento
   é criado e editado. O bloco de conteúdo é o mesmo. */
ok(/id="conteudo-informacoes"/.test(tela),
   'a tela administrativa de Informações continua na página');
ok(/conteudo:'informacoes'/.test(tela),
   '  alcançável como tela de um submódulo');
/* Os nomes mudaram em 26/08/2026 com a arquitetura fechada: Programação virou
   Eventos, Bingo Online virou Sorteios, e Credenciamento saiu de dentro da
   Festa. O que a guarda cobra continua o mesmo — navegação por SUBMÓDULO. */
ok(/id="sub-lista"/.test(tela) && /id="sub-festa"/.test(tela) &&
   /id="sub-credenciamento"/.test(tela) && /id="sub-sorteios"/.test(tela),
   '  e a navegação é por submódulo, não por abas de assunto',
   'aba não é tela: aba agrupa assunto, tela é fila de trabalho com ações');
ok(/id="conteudo-informacoes"/.test(tela), 'há conteúdo próprio da Festa 2026');
ok(/Calendário/.test(tela) && /Inscrições/.test(tela) && /Participantes/.test(tela) && /Credenciamento/.test(tela) && /Sorteios/.test(tela),
  'as cinco áreas já existentes continuam presentes');
ok(/listarEventosAgenda\(tokenSessao\(\)\)/.test(tela), 'o calendário legado continua usando sua API anterior');
ok(/evAbrirPainel\('compasso'/.test(tela), 'o painel atual do Compasso continua acessível');

passo('a tela cobre a Identidade e Informações Gerais aprovada');
[
  'evInfoNome','evInfoEdicao','evInfoLogo','evInfoCapa','evInfoData',
  'evInfoAbertura','evInfoInicio','evInfoEncerramento','evInfoLocal',
  'evInfoEndereco','evInfoDescricao','evInfoOrientacoes','evInfoImportantes'
].forEach(id => ok(tela.includes('id="' + id + '"'), id + ' está presente'));
ok(/eventosV2Admin_obterFesta2026\(token\)/.test(tela), 'carregamento usa o Controller V2');
ok(/eventosV2Admin_salvarInformacoesFesta2026\(token,dados\)/.test(tela), 'salvamento usa o Controller V2');
ok(/textContent=/.test(tela), 'prévia escreve textos por textContent, não por HTML arbitrário');

passo('publicar e página pública não foram liberados antes da hora');
ok(/Visualizar página pública<\/button>/.test(tela) && /type="button" disabled/.test(tela), 'ação de página pública aparece bloqueada');
ok(/Publicar evento<\/button>/.test(tela), 'ação de publicação aparece, mas não inventa fluxo');
ok(!/eventosV2Publico_/.test(controller), 'Controller não cria endpoint público V2');

passo('o Controller é uma porta administrativa estreita');
ok(/function eventosV2Admin_obterFesta2026\(tokenSessao\)/.test(controller), 'há endpoint administrativo de leitura');
ok(/function eventosV2Admin_salvarInformacoesFesta2026\(tokenSessao, dados\)/.test(controller), 'há endpoint administrativo de gravação');
ok(/eventosV2Service_listar_\(tokenSessao\)/.test(controller), 'leitura passa pelo Service protegido');
ok(/eventosV2Service_salvar_\(tokenSessao, entrada\)/.test(controller), 'gravação passa pelo Service protegido');
ok(/tipo:\s*EVENTOS_V2_TIPOS\.FESTA/.test(controller) && /ano:\s*2026/.test(controller), 'Controller fixa o escopo em Festa 2026');
ok(/estado.*preservado|status atual é preservado/i.test(controller), 'edição de informações não altera silenciosamente o ciclo de vida');

passo('o payload usa whitelist e não carrega métricas administrativas');
ok(/function eventosV2Admin_payloadInformacoes_/.test(controller), 'payload tem whitelist própria');
/* CAPACIDADE SAIU DA LISTA DE PROIBIDOS — 26/08/2026, e não foi para o teste
   passar: foi uma decisão revisada, com o motivo escrito no domínio.

   A distinção que faltava quando esta guarda nasceu: os outros nomes da lista
   são INDICADORES — mudam a cada inscrição e contam a operação do evento.
   Capacidade é PROPRIEDADE, tão estática quanto o endereço: o salão comporta
   2.000 pessoas hoje, amanhã e em dezembro.

   Sem ela no payload administrativo, o campo de lotação não teria como voltar
   preenchido para a tela, e a lotação continuaria sendo constante no código —
   com um evento de 300 lugares aceitando 2.000 inscrições.

   O que a guarda protegia continua protegido, e agora com o alvo certo: esta
   é a tela ADMINISTRATIVA, que exige sessão de administrador. A superfície
   pública é outra, e a linha abaixo cobra que ela continue existindo separada. */
const proibidos = ['vagasRestantes','totalInscritos','inscritos','aprovados','pendentes','cancelados','acompanhantes','checkins','checkIns','presencas','presenças'];
const corpoPayload = (controller.match(/function eventosV2Admin_payloadInformacoes_\(evento\) \{[\s\S]*?\n\}/) || [''])[0];
proibidos.forEach(campo => ok(!new RegExp('\\b' + campo + '\\b','i').test(corpoPayload), 'payload não inclui ' + campo));

ok(/capacidade:\s*Number\(evento\.capacidade\)/.test(corpoPayload),
   'payload administrativo INCLUI capacidade',
   'é o que permite o campo de lotação voltar preenchido para a tela');
ok(!/eventosV2Publico_/.test(controller),
   '  e continua sem qualquer endpoint público neste arquivo',
   'a separação que a nota de privacidade protege é entre superfícies, não entre campos');
ok(/sem métricas administrativas/i.test(tela), 'a própria prévia declara a separação de dados administrativos');

passo('as travas estruturais continuam em profundidade');
ok(/exigirModulo_\(tokenSessao, 'eventos', true\)/.test(service), 'Service exige administrador do módulo Eventos');
ok(/LockService\.getScriptLock\(\)/.test(service), 'gravação usa LockService');
ok(/ambiente !== 'homologacao'/.test(repo), 'Repository bloqueia qualquer ambiente diferente de homologação');
ok(/getPlanilhaId\('homologacao'\)/.test(repo), 'Repository abre explicitamente a planilha de homologação');
ok(/EVENTOS_V2_AUDITORIA/.test(repo), 'persistência mantém trilha de auditoria');
ok(/RASCUNHO/.test(dominio) && /INSCRICOES_ABERTAS/.test(dominio) && /CANCELADO/.test(dominio), 'ciclo de vida canônico permanece no domínio');

resumo();
