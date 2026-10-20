/**
 * FORJA · GERENCIADOR v1.0.0 (out/2026)
 * Problema que resolve: a FORJA_CENTRAL tinha 11 abas desconexas. Aqui a planilha é só o banco
 * (6 abas de dados) e tudo se opera pelo app: clientes, agenda, pitches, conteúdo e categorias.
 * Como o dono percebe: abre o app, vê o que vence hoje e o próximo passo de cada casa. Não abre a planilha.
 *
 * Banco: Google Sheets (container-bound). API: doGet (app) + doPost (JSON text/plain) + forjaRpc (google.script.run).
 * Resposta sempre { status: "success"|"error", message: "...", data: ... }.
 * Segurança: código do dono guardado só como hash SHA-256 (Script Properties). Token HMAC de 12 h.
 * Primeira vez: menu FORJA APP > 1 Preparar sistema, 2 Definir meu código, 3 Mostrar endereço.
 */

var VERSAO = '1.0.0';
var TOKEN_HORAS = 12;

var ESQUEMA = {
  CLIENTES: { id: 'id', cols: ['id','codigo','nome','contato','whatsapp','tipo','porte','cidade','origem','dor','estagio','responsavel','vazamento_mes','ultima_interacao','proxima_acao','data_proxima','plano','status_impl','inicio','semanas','p_produto','p_custo','p_gente','p_conduta','p_rotina','cmv_base','cmv_atual','economia_mes','valor_rx','autorizada_case','motivo','notas','criado_em','atualizado_em'], req: [] },
  ATIVIDADES: { id: 'id', cols: ['id','cliente_id','tipo','data','hora','status','resumo','valor','prazo','criado_em','atualizado_em'], req: ['cliente_id','tipo','data'] },
  PITCHES: { id: 'id', cols: ['id','titulo','categoria','etapa','ordem','texto','ativo'], req: ['titulo','texto'] },
  CONTEUDO: { id: 'id', cols: ['id','data','hora','tipo','linha','peca','status','gate','conversas','salvamentos','compartilhamentos','obs'], req: ['data','peca'] },
  CATEGORIAS: { id: 'id', cols: ['id','lista','valor','ordem'], req: ['lista','valor'] },
  CONFIG: { id: 'chave', cols: ['chave','valor'], req: ['chave'] }
};
var PREFIXO = { CLIENTES: 'cli', ATIVIDADES: 'atv', PITCHES: 'pit', CONTEUDO: 'con', CATEGORIAS: 'cat', CONFIG: 'cfg' };
var DATAS = { CLIENTES: ['ultima_interacao','data_proxima','inicio'], ATIVIDADES: ['data','prazo'], CONTEUDO: ['data'] };

var CATEGORIAS_PADRAO = {
  origem: ['Comentário','DM de story','DM direta','Indicação','Visita de bairro','Outra'],
  tipo: ['Restaurante regional','Buffet com locação','Lanchonete','Restaurante','Marmitaria','Outro'],
  porte: ['Pequeno','Médio','Grande'],
  dor: ['Porção','Recebimento','Rendimento','Perda','Compra','Outra'],
  estagio: ['Novo','Contatado','Conversa','Qualificado','Raio-X agendado','Raio-X pago','Relatório entregue','Proposta','Fechado','Perdido','Adiado'],
  responsavel: ['Gabriel','Agente'],
  plano: ['Start','Forja OS','Sob medida'],
  status_impl: ['Planejada','Ativa','Pausada','Concluída'],
  autorizada: ['Sim','Não','Pendente'],
  atv_tipo: ['Contato','Conversa','Visita','Raio-X','Relatório','Proposta','Fechamento','RDO','Tarefa'],
  atv_status: ['Planejada','Feita','Cancelada'],
  pit_categoria: ['Abertura','Qualificação','Raio-X','Proposta','Objeção','Fechamento','Follow-up'],
  cont_tipo: ['feed','carrossel','story','reel','Tkt','Yt Shorts'],
  cont_linha: ['Número','Opinião','Bastidor','Story','Reel'],
  cont_status: ['Rascunho','Aguarda gate','Aprovado','Pronto para envio','Enviado'],
  cont_gate: ['APROVADO','AJUSTAR','BLOQUEADO','—']
};

var CONFIG_PADRAO = {
  horas_semana: '20', teto_implantacoes: '2', h_raiox: '10', h_implantacao: '6', h_conteudo: '4', h_comercial: '4', h_gestao: '2',
  cap_faisca: '0.85', cap_brasa: '1',
  preco_raiox: '497', preco_raiox_cheio: '597', preco_start: '1990', preco_forjaos: '4900', preco_mensal: '297', fator_garantia: '2',
  prazo_relatorio_h: '48', alerta_relatorio_h: '12', lead_faisca_d: '2', lead_brasa_d: '5', rdo_brasa_d: '7',
  cmv_faisca_pt: '2', fila_faisca_d: '14', fila_brasa_d: '5', whatsapp_gabriel: '', nome_exibicao: 'Gabriel'
};

/* Pitches iniciais: método do projeto (comercial-plano-anual / garantia / kit de vendas). Valores entre [colchetes] o app preenche. */
var PITCHES_PADRAO = [
  ['Abertura pelo problema do dono','Abertura','Novo',1,'Oi, {nome}. Sou o Gabriel, da Forja. Eu trabalho com padrão de cozinha: porção, recebimento, perda e custo. Posso te fazer uma pergunta sobre {casa}? Quando o prato mais vendido sai de dois cozinheiros diferentes, ele sai igual?'],
  ['Retomada sem pressão','Follow-up','Contatado',1,'{nome}, passando aqui sem pressa. Na última conversa você falou de {dor}. Se fizer sentido, te mostro em 10 minutos como eu enxergo isso numa cozinha de {tipo}.'],
  ['Qualificação: 4 perguntas','Qualificação','Conversa',1,'Quatro perguntas rápidas, {nome}: 1) quem pesa a proteína do prato mais vendido? 2) quem confere a nota na entrega? 3) a perda do dia fica anotada? 4) você sabe seu CMV da última semana? As respostas me dizem por onde começar.'],
  ['Convite para o Raio-X','Raio-X','Qualificado',1,'{nome}, o jeito de eu te mostrar o número é o Raio-X: eu janto dentro da cozinha de {casa}, vejo porção, recebimento e perda, e em 48 horas te entrego o relatório. Custa R$ {valor_rx}. Se eu não achar vazamento que justifique, te devolvo.'],
  ['Confirmação da visita','Raio-X','Raio-X agendado',1,'Combinado, {nome}. Visita em {data_proxima}. Preciso de uma coisa: que ninguém mude nada antes. Quero ver a cozinha como ela é numa terça comum.'],
  ['Pós-visita: relatório em 48 h','Raio-X','Raio-X pago',1,'{nome}, a visita foi hoje. O relatório sai em até 48 horas. Te mando o resumo antes de qualquer proposta.'],
  ['Entrega do relatório','Raio-X','Relatório entregue',1,'{nome}, o relatório de {casa} está pronto. A casa já faz bem [CAMPO A PREENCHER]. O vazamento que eu medi é R$ {vazamento} por mês. Posso te mostrar na mesa amanhã?'],
  ['Pitch em 5 passos · 1 número dele','Proposta','Proposta',1,'1) Abra pelo número dele: "O Raio-X achou R$ {vazamento} por mês saindo pela porção e pela compra. Em um ano, isso é R$ [vazamento × 12]."'],
  ['Pitch em 5 passos · 2 o que já faz bem','Proposta','Proposta',2,'2) Mostre o que a casa já faz bem: "A sua equipe já [CAMPO A PREENCHER]. Falta o resto seguir o mesmo padrão."'],
  ['Pitch em 5 passos · 3 o ano, não o preço','Proposta','Proposta',3,'3) Mostre o ano: "Mês 1 e 2 a gente instala. Do mês 3 em diante eu estou na sua cozinha toda semana e você vê tudo no celular."'],
  ['Pitch em 5 passos · 4 parcela e comparação','Proposta','Proposta',4,'4) Fale a parcela, depois compare: "São R$ [parcela] por mês, fixo, o ano inteiro. Separado sairia R$ [avulso]."'],
  ['Pitch em 5 passos · 5 fechar pela saída','Proposta','Proposta',5,'5) Feche pela saída: "Se o Raio-X não achasse R$ 1.000 por mês, você saía sem multa. Achou. Começamos essa semana?"'],
  ['Objeção: está caro','Objeção','',1,'A conta é por dia, {nome}. A parcela dá cerca de R$ 33 por dia e o vazamento medido em {casa} foi R$ {vazamento} por mês. Se eu estiver errado no número, a gente para.'],
  ['Objeção: deixa eu pensar','Objeção','',2,'Faz sentido pensar. Só te peço uma coisa: enquanto isso, a cozinha segue operando sem padrão. Posso te mandar a conta por escrito hoje e a gente volta a falar em [data]?'],
  ['Objeção: preciso falar com o sócio','Objeção','',3,'Traz ele. Eu mostro na tela onde está vazando. Quando o sócio vê o número, a conversa muda.'],
  ['Objeção: já tenho planilha','Objeção','',4,'Ótimo. Qual o CMV dela na última semana? Se está dentro da meta, o Raio-X confirma. Se não está, a gente acha onde.'],
  ['Objeção: já tentei consultoria','Objeção','',5,'Consultoria que entrega relatório e some, eu entendo a desconfiança. Aqui eu instalo e fico: volto toda semana, e o que não roda na cozinha eu refaço.'],
  ['Fechamento: próximos passos','Fechamento','Fechado',1,'Fechado, {nome}. Próximos passos: 1) assino a proposta com você hoje; 2) combino com o seu cozinheiro o dia da primeira visita; 3) na semana 1 eu monto as fichas dos pratos que mais vendem.'],
  ['Reativar lead parado','Follow-up','Adiado',1,'{nome}, faz um tempo. Estou fechando a agenda do mês e lembrei de {casa}. Ainda faz sentido olhar {dor}? Se não for a hora, me diga e eu paro de te cutucar.']
];

/* Calendário de conteúdo atual (importado da aba CONTEUDO da FORJA_CENTRAL, out/2026). */
var CONTEUDO_PADRAO = [
['2026-10-19','09:00','story','Story','S01','Aguarda gate',''],['2026-10-20','12:00','feed','Número','F10-dobrar-pedidos','Aguarda gate',''],['2026-10-21','09:00','story','Story','S02','Aguarda gate',''],
['2026-10-22','12:00','reel','Reel','R1-capa-porcao (Reel 1)','Rascunho','Reel: aguarda gravação do vídeo'],['2026-10-22','09:00','story','Story','S03','Aguarda gate',''],['2026-10-23','12:00','feed','Opinião','F11-trafego-sem-padrao','Aguarda gate',''],
['2026-10-26','09:00','story','Story','S04','Aguarda gate',''],['2026-10-27','12:00','feed','Número','F12-recebimento-6-4','Aguarda gate',''],['2026-10-28','09:00','story','Story','S05','Aguarda gate',''],
['2026-10-30','12:00','feed','Bastidor','F13-um-dia-de-raio-x','Aguarda gate',''],['2026-10-30','09:00','story','Story','S06','Aguarda gate',''],['2026-11-02','09:00','story','Story','S07','Aguarda gate',''],
['2026-11-03','12:00','carrossel','Número','C-os-5-ralos','Aguarda gate',''],['2026-11-03','09:00','story','Story','S08','Aguarda gate',''],['2026-11-05','12:00','reel','Reel','R3-capa-primeira-hora (Reel 3)','Rascunho','Reel: aguarda gravação do vídeo'],
['2026-11-05','09:00','story','Story','S09','Aguarda gate',''],['2026-11-06','12:00','feed','Opinião','F15-pesar-a-porcao','Aguarda gate',''],['2026-11-09','09:00','story','Story','S10','Aguarda gate',''],
['2026-11-10','12:00','feed','Número','F16-10-gramas','Aguarda gate',''],['2026-11-11','09:00','story','Story','S11','Aguarda gate',''],['2026-11-12','12:00','reel','Reel','R4-capa-limao (Reel 4)','Rascunho','Reel: aguarda gravação do vídeo'],
['2026-11-12','09:00','story','Story','S12','Aguarda gate',''],['2026-11-13','12:00','feed','Bastidor','F17-seis-telas','Aguarda gate','']
];

/* ============ ENTRADAS ============ */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate().setTitle('Forja · Gerenciador')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var corpo = {};
  try { corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return saida_(erro_('JSON inválido.')); }
  return saida_(rotear_(corpo));
}

/** Chamada pelo app hospedado no Apps Script (google.script.run). Retorna string JSON. */
function forjaRpc(texto) {
  var corpo = {};
  try { corpo = JSON.parse(texto || '{}'); } catch (err) { return JSON.stringify(erro_('JSON inválido.')); }
  return JSON.stringify(rotear_(corpo));
}

function saida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function ok_(data, message) { return { status: 'success', message: message || 'Ok.', data: data === undefined ? null : data }; }
function erro_(message) { return { status: 'error', message: message, data: null }; }

function rotear_(c) {
  try {
    var acao = String(c.acao || '');
    if (acao === 'ping') return ok_({ versao: VERSAO, preparado: !!prop_('FORJA_HASH'), hora: new Date().toISOString() }, 'Servidor no ar.');
    if (acao === 'login') return login_(c);
    var quem = validarToken_(c.token);
    if (!quem) return { status: 'error', message: 'Sessão expirada. Entre de novo.', data: null, codigo: 'SESSAO' };
    if (acao === 'dados') return ok_(lerTudo_(), 'Dados carregados.');
    if (acao === 'salvar') return salvar_(c.tabela, c.registro);
    if (acao === 'salvarLote') return salvarLote_(c.tabela, c.registros);
    if (acao === 'excluir') return excluir_(c.tabela, c.id);
    return erro_('Ação desconhecida: ' + acao);
  } catch (err) {
    return erro_('Falha no servidor: ' + (err && err.message ? err.message : err));
  }
}

/* ============ AUTENTICAÇÃO ============ */

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function hash_(txt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(txt), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}
function assinar_(txt) {
  var seg = prop_('FORJA_SEGREDO') || '';
  var raw = Utilities.computeHmacSha256Signature(txt, seg);
  return Utilities.base64EncodeWebSafe(raw);
}
function login_(c) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('tentativas') || 0);
  if (n >= 8) return erro_('Muitas tentativas. Espere 10 minutos.');
  var h = prop_('FORJA_HASH');
  if (!h) return erro_('Sistema não preparado. No menu da planilha: FORJA APP > 2 Definir meu código.');
  if (hash_(String(c.codigo || '').trim()) !== h) {
    cache.put('tentativas', String(n + 1), 600);
    return erro_('Código incorreto.');
  }
  cache.remove('tentativas');
  var exp = Date.now() + TOKEN_HORAS * 3600 * 1000;
  var carga = 'dono.' + exp;
  return ok_({ token: carga + '.' + assinar_(carga), expira: exp, versao: VERSAO }, 'Bem-vindo.');
}
function validarToken_(token) {
  if (!token) return null;
  var p = String(token).split('.');
  if (p.length < 3) return null;
  var carga = p[0] + '.' + p[1];
  if (assinar_(carga) !== p.slice(2).join('.')) return null;
  if (Number(p[1]) < Date.now()) return null;
  return p[0];
}

/* ============ PLANILHA ============ */

function ss_() { return SpreadsheetApp.getActive(); }
function aba_(nome) {
  var a = ss_().getSheetByName(nome);
  if (!a) throw new Error('Aba ' + nome + ' não existe. Rode FORJA APP > 1 Preparar sistema.');
  return a;
}

/** Lê uma aba inteira de uma vez (bloco) e devolve array de objetos. */
function lerAba_(nome) {
  var cols = ESQUEMA[nome].cols;
  var a = aba_(nome);
  var ult = a.getLastRow();
  if (ult < 2) return [];
  var vals = a.getRange(2, 1, ult - 1, cols.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][0] && !vals[i][1]) continue;
    var o = {};
    for (var j = 0; j < cols.length; j++) o[cols[j]] = vals[i][j];
    out.push(o);
  }
  return out;
}
function lerTudo_() {
  var r = { versao: VERSAO, hoje: hoje_() };
  Object.keys(ESQUEMA).forEach(function (n) { r[n] = lerAba_(n); });
  return r;
}
function hoje_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function agora_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"); }

function limpar_(v) {
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (s.length > 5000) s = s.substring(0, 5000);
  if (/^[=+@]/.test(s) || /^-[^0-9.,]/.test(s)) s = "'" + s; // evita fórmula injetada
  return s;
}
function validar_(tabela, reg) {
  var esq = ESQUEMA[tabela];
  for (var i = 0; i < esq.req.length; i++) {
    if (!String(reg[esq.req[i]] === undefined ? '' : reg[esq.req[i]]).trim()) return 'Campo obrigatório: ' + esq.req[i];
  }
  if (tabela === 'CLIENTES' && !String(reg.codigo || '').trim() && !String(reg.nome || '').trim() && !String(reg.contato || '').trim()) return 'Informe o nome da casa, o dono ou o código.';
  var d = DATAS[tabela] || [];
  for (var k = 0; k < d.length; k++) {
    var v = String(reg[d[k]] || '');
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Data inválida em ' + d[k] + ' (use AAAA-MM-DD).';
  }
  return '';
}

function salvar_(tabela, reg) {
  if (!ESQUEMA[tabela]) return erro_('Tabela inválida.');
  if (!reg || typeof reg !== 'object') return erro_('Registro vazio.');
  var msg = validar_(tabela, reg);
  if (msg) return erro_(msg);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return erro_('Sistema ocupado. Tente de novo.');
  try {
    var salvo = gravar_(tabela, reg);
    if (tabela === 'ATIVIDADES' && salvo.cliente_id) tocarCliente_(salvo);
    return ok_(salvo, 'Salvo.');
  } finally { lock.releaseLock(); }
}

function salvarLote_(tabela, regs) {
  if (!ESQUEMA[tabela]) return erro_('Tabela inválida.');
  if (!regs || !regs.length) return erro_('Nada para salvar.');
  if (regs.length > 300) return erro_('Lote grande demais (máx. 300).');
  for (var i = 0; i < regs.length; i++) { var m = validar_(tabela, regs[i]); if (m) return erro_(m); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return erro_('Sistema ocupado. Tente de novo.');
  try {
    var out = regs.map(function (r) { return gravar_(tabela, r); });
    return ok_(out, out.length + ' registros salvos.');
  } finally { lock.releaseLock(); }
}

/** Grava (insere ou atualiza) sem usar getActiveSheet em laço: lê a coluna de ids uma vez. */
function gravar_(tabela, reg) {
  var esq = ESQUEMA[tabela], cols = esq.cols, a = aba_(tabela);
  var idc = esq.id;
  var obj = {};
  cols.forEach(function (c) { obj[c] = limpar_(reg[c]); });
  var agora = agora_();
  if (!obj[idc]) obj[idc] = PREFIXO[tabela] + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
  if (tabela === 'CLIENTES') {
    if (!reg.id) obj.codigo = obj.codigo || proximoCodigo_(a);
    else if (codigoDuplicado_(a, obj.codigo, obj.id)) throw new Error('Já existe outro cliente com o código ' + obj.codigo + '.');
    if (!reg.id && codigoDuplicado_(a, obj.codigo, '')) throw new Error('Já existe cliente com o código ' + obj.codigo + '.');
  }
  var ult = a.getLastRow();
  var linha = -1, anterior = null;
  if (ult >= 2) {
    var ids = a.getRange(2, 1, ult - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === obj[idc]) { linha = i + 2; break; }
  }
  if (cols.indexOf('atualizado_em') >= 0) obj.atualizado_em = agora;
  if (linha > 0) {
    if (cols.indexOf('criado_em') >= 0) {
      var ci = cols.indexOf('criado_em') + 1;
      obj.criado_em = String(a.getRange(linha, ci).getDisplayValue()) || agora;
    }
  } else if (cols.indexOf('criado_em') >= 0) obj.criado_em = agora;
  var linhaVals = [cols.map(function (c) { return obj[c]; })];
  if (linha < 0) { linha = ult + 1; if (linha < 2) linha = 2; }
  var rg = a.getRange(linha, 1, 1, cols.length);
  rg.setNumberFormat('@');
  rg.setValues(linhaVals);
  return obj;
}

function proximoCodigo_(a) {
  var ult = a.getLastRow(), max = 0;
  if (ult >= 2) {
    var cods = a.getRange(2, 2, ult - 1, 1).getValues();
    cods.forEach(function (r) { var m = /^C-(\d+)$/.exec(String(r[0])); if (m) max = Math.max(max, Number(m[1])); });
  }
  return 'C-' + ('000' + (max + 1)).slice(-3);
}
function codigoDuplicado_(a, cod, idAtual) {
  var ult = a.getLastRow();
  if (ult < 2 || !cod) return false;
  var v = a.getRange(2, 1, ult - 1, 2).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][1]) === cod && String(v[i][0]) !== idAtual) return true;
  return false;
}

/** Atividade feita atualiza "última interação" do cliente. */
function tocarCliente_(atv) {
  if (atv.status !== 'Feita') return;
  var a = aba_('CLIENTES'), cols = ESQUEMA.CLIENTES.cols;
  var ult = a.getLastRow(); if (ult < 2) return;
  var ids = a.getRange(2, 1, ult - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === atv.cliente_id) {
    var cel = a.getRange(i + 2, cols.indexOf('ultima_interacao') + 1);
    var atual = String(cel.getDisplayValue());
    if (!atual || atual < atv.data) { cel.setNumberFormat('@'); cel.setValue(atv.data); }
    return;
  }
}

function excluir_(tabela, id) {
  if (!ESQUEMA[tabela] || !id) return erro_('Pedido inválido.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return erro_('Sistema ocupado. Tente de novo.');
  try {
    var n = apagarLinhas_(tabela, ESQUEMA[tabela].id, String(id));
    var extra = 0;
    if (tabela === 'CLIENTES') extra = apagarLinhas_('ATIVIDADES', 'cliente_id', String(id));
    if (!n) return erro_('Registro não encontrado.');
    return ok_({ apagados: n, em_cascata: extra }, extra ? 'Excluído com ' + extra + ' atividade(s).' : 'Excluído.');
  } finally { lock.releaseLock(); }
}
function apagarLinhas_(tabela, campo, valor) {
  var a = aba_(tabela), cols = ESQUEMA[tabela].cols, ult = a.getLastRow();
  if (ult < 2) return 0;
  var col = cols.indexOf(campo) + 1;
  var v = a.getRange(2, col, ult - 1, 1).getValues();
  var n = 0;
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === valor) { a.deleteRow(i + 2); n++; }
  return n;
}

/* ============ MENU E PREPARAÇÃO ============ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FORJA APP')
    .addItem('1 · Preparar sistema', 'forjaPreparar')
    .addItem('2 · Definir meu código de acesso', 'forjaDefinirCodigo')
    .addItem('3 · Mostrar endereço do app', 'forjaEndereco')
    .addSeparator()
    .addItem('Importar dados da FORJA_CENTRAL antiga (leads)', 'forjaImportarLeadsAntigos')
    .addItem('Auditar', 'forjaAuditar')
    .addToUi();
}

function escreverCabecalho_(a, cols) {
  var r = a.getRange(1, 1, 1, cols.length);
  r.setValues([cols]).setBackground('#14100E').setFontColor('#F2F0ED').setFontWeight('bold').setFontFamily('IBM Plex Mono');
  a.setFrozenRows(1);
  a.getRange(2, 1, a.getMaxRows() - 1, cols.length).setNumberFormat('@');
}

function forjaPreparar() {
  var ui = SpreadsheetApp.getUi();
  var planilha = ss_();
  Object.keys(ESQUEMA).forEach(function (n) {
    var a = planilha.getSheetByName(n) || planilha.insertSheet(n);
    if (a.getLastRow() === 0) escreverCabecalho_(a, ESQUEMA[n].cols);
  });
  if (!prop_('FORJA_SEGREDO')) PropertiesService.getScriptProperties().setProperty('FORJA_SEGREDO', Utilities.getUuid() + Utilities.getUuid());
  // categorias padrão (só se a aba estiver vazia)
  var cat = planilha.getSheetByName('CATEGORIAS');
  if (cat.getLastRow() < 2) {
    var linhas = [];
    Object.keys(CATEGORIAS_PADRAO).forEach(function (lista) {
      CATEGORIAS_PADRAO[lista].forEach(function (v, i) { linhas.push(['cat_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10), lista, v, String(i + 1)]); });
    });
    cat.getRange(2, 1, linhas.length, 4).setNumberFormat('@').setValues(linhas);
  }
  var cfg = planilha.getSheetByName('CONFIG');
  if (cfg.getLastRow() < 2) {
    var cl = Object.keys(CONFIG_PADRAO).map(function (k) { return [k, CONFIG_PADRAO[k]]; });
    cfg.getRange(2, 1, cl.length, 2).setNumberFormat('@').setValues(cl);
  }
  var pit = planilha.getSheetByName('PITCHES');
  if (pit.getLastRow() < 2) {
    var pl = PITCHES_PADRAO.map(function (p) { return ['pit_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10), p[0], p[1], p[2], String(p[3]), p[4], 'Sim']; });
    pit.getRange(2, 1, pl.length, 7).setNumberFormat('@').setValues(pl);
  }
  var con = planilha.getSheetByName('CONTEUDO');
  if (con.getLastRow() < 2) {
    var cn = CONTEUDO_PADRAO.map(function (c) { return ['con_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10), c[0], c[1], c[2], c[3], c[4], c[5], '—', '', '', '', c[6]]; });
    con.getRange(2, 1, cn.length, 12).setNumberFormat('@').setValues(cn);
  }
  leiaMe_();
  ui.alert('Sistema preparado', 'Abas criadas: CLIENTES, ATIVIDADES, PITCHES, CONTEUDO, CATEGORIAS, CONFIG.\nPróximo passo: menu FORJA APP > 2 Definir meu código de acesso.', ui.ButtonSet.OK);
}

function leiaMe_() {
  var planilha = ss_();
  var a = planilha.getSheetByName('LEIA-ME') || planilha.insertSheet('LEIA-ME', 0);
  a.clear();
  var t = [
    ['FORJA · GERENCIADOR v' + VERSAO],
    ['Esta planilha é só o banco de dados. Tudo se opera pelo app.'],
    [''],
    ['Não edite as abas à mão. Se editar: mantenha a linha 1 e a coluna id; datas AAAA-MM-DD.'],
    ['CLIENTES: uma linha por casa (lead e cliente na mesma linha; o estágio muda).'],
    ['ATIVIDADES: contatos, visitas, Raio-X, propostas e tarefas, planejadas ou feitas.'],
    ['PITCHES: biblioteca de roteiros por etapa, em ordem.'],
    ['CONTEUDO: calendário de posts e métricas.'],
    ['CATEGORIAS: as listas (estágios, origens, tipos...). Edite pelo app, em Config.'],
    ['CONFIG: preços, prazos e limites. Edite pelo app.'],
    [''],
    ['Código de acesso: guardado só como hash. Para trocar, use o menu FORJA APP.']
  ];
  a.getRange(1, 1, t.length, 1).setValues(t);
  a.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  a.setColumnWidth(1, 700);
}

function forjaDefinirCodigo() {
  var ui = SpreadsheetApp.getUi();
  if (!prop_('FORJA_SEGREDO')) { ui.alert('Rode primeiro: 1 · Preparar sistema.'); return; }
  var r = ui.prompt('Código de acesso do app', 'Mínimo 6 caracteres. Só você deve saber.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var cod = String(r.getResponseText()).trim();
  if (cod.length < 6) { ui.alert('Muito curto. Use pelo menos 6 caracteres.'); return; }
  PropertiesService.getScriptProperties().setProperty('FORJA_HASH', hash_(cod));
  ui.alert('Código definido. Guarde-o: não dá para recuperar, só trocar.');
}

function forjaEndereco() {
  var ui = SpreadsheetApp.getUi();
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  ui.alert('Endereço do app', url || 'Ainda não publicado. Implantar > Nova implantação > App da Web.', ui.ButtonSet.OK);
}

/** Opcional: traz os leads da aba LEADS da FORJA_CENTRAL antiga, se ela estiver NESTA planilha. */
function forjaImportarLeadsAntigos() {
  var ui = SpreadsheetApp.getUi();
  var antiga = ss_().getSheetByName('LEADS');
  if (!antiga) { ui.alert('Não há aba LEADS nesta planilha. Se quiser importar, copie a aba LEADS da FORJA_CENTRAL para cá primeiro.'); return; }
  var vals = antiga.getDataRange().getDisplayValues();
  var h = -1;
  for (var i = 0; i < vals.length; i++) if (vals[i].indexOf('Casa (código)') >= 0) { h = i; break; }
  if (h < 0) { ui.alert('Cabeçalho "Casa (código)" não encontrado.'); return; }
  var cab = vals[h], regs = [];
  function col(n) { return cab.indexOf(n); }
  for (var j = h + 1; j < vals.length; j++) {
    var casa = String(vals[j][0]).trim();
    if (!casa || /^EX-/.test(casa)) continue;
    var data = function (n) { var v = col(n) >= 0 ? vals[j][col(n)] : ''; var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); return m ? m[3] + '-' + m[2] + '-' + m[1] : (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''); };
    var tx = function (n) { return col(n) >= 0 ? String(vals[j][col(n)]) : ''; };
    regs.push({ nome: casa, tipo: tx('Tipo da casa'), porte: tx('Porte'), cidade: tx('Bairro / cidade'), origem: tx('Origem'), dor: tx('Dor declarada'), estagio: tx('Estágio') || 'Novo', responsavel: tx('Responsável') || 'Gabriel', ultima_interacao: data('Última interação'), proxima_acao: tx('Próxima ação'), data_proxima: data('Data da próxima ação'), motivo: tx('Motivo de perda ou adiamento'), codigo: '' });
  }
  var existentes = lerAba_('CLIENTES').map(function (c) { return c.nome; });
  var novos = regs.filter(function (r) { return existentes.indexOf(r.nome) < 0; });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { novos.forEach(function (r) { gravar_('CLIENTES', r); }); } finally { lock.releaseLock(); }
  ui.alert('Importação', novos.length + ' lead(s) importado(s); ' + (regs.length - novos.length) + ' já existiam.', ui.ButtonSet.OK);
}

function forjaAuditar() {
  var ui = SpreadsheetApp.getUi(), linhas = [];
  Object.keys(ESQUEMA).forEach(function (n) {
    var a = ss_().getSheetByName(n);
    if (!a) { linhas.push(n + ': FALTA'); return; }
    var cab = a.getRange(1, 1, 1, ESQUEMA[n].cols.length).getValues()[0].join('|');
    var esperado = ESQUEMA[n].cols.join('|');
    linhas.push(n + ': ' + (cab === esperado ? 'ok' : 'CABEÇALHO DIFERENTE') + ' · ' + Math.max(0, a.getLastRow() - 1) + ' linhas');
  });
  linhas.push('Código definido: ' + (prop_('FORJA_HASH') ? 'sim' : 'NÃO'));
  linhas.push('Versão: ' + VERSAO);
  ui.alert('Auditoria', linhas.join('\n'), ui.ButtonSet.OK);
}
