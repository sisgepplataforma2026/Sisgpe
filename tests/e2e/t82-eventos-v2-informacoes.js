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
ok(/id="sub-programacao"/.test(tela) && /id="sub-festa"/.test(tela) && /id="sub-bingo"/.test(tela),
   '  e a navegação é por submódulo, não por seis abas de assunto',
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
const proibidos = ['capacidade','vagasRestantes','totalInscritos','inscritos','aprovados','pendentes','cancelados','acompanhantes','checkins','checkIns','presencas','presenças'];
const corpoPayload = (controller.match(/function eventosV2Admin_payloadInformacoes_\(evento\) \{[\s\S]*?\n\}/) || [''])[0];
proibidos.forEach(campo => ok(!new RegExp('\\b' + campo + '\\b','i').test(corpoPayload), 'payload não inclui ' + campo));
ok(/sem métricas administrativas/i.test(tela), 'a própria prévia declara a separação de dados administrativos');

passo('as travas estruturais continuam em profundidade');
ok(/exigirModulo_\(tokenSessao, 'eventos', true\)/.test(service), 'Service exige administrador do módulo Eventos');
ok(/LockService\.getScriptLock\(\)/.test(service), 'gravação usa LockService');
ok(/ambiente !== 'homologacao'/.test(repo), 'Repository bloqueia qualquer ambiente diferente de homologação');
ok(/getPlanilhaId\('homologacao'\)/.test(repo), 'Repository abre explicitamente a planilha de homologação');
ok(/EVENTOS_V2_AUDITORIA/.test(repo), 'persistência mantém trilha de auditoria');
ok(/RASCUNHO/.test(dominio) && /INSCRICOES_ABERTAS/.test(dominio) && /CANCELADO/.test(dominio), 'ciclo de vida canônico permanece no domínio');

resumo();
