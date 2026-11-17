/**
 * Rin Tin Tin Pet — API de agendamento usando Google Planilhas.
 *
 * COMO INSTALAR (resumo — o passo a passo completo está no README do projeto):
 * 1. Crie uma planilha nova no Google Planilhas (na conta da dona).
 * 2. Extensões > Apps Script. Apague o que tiver e cole este arquivo.
 * 3. Selecione a função `configurarPlanilha` e clique em Executar (autorize).
 * 4. Selecione `criarAdmin`, ajuste usuário/senha lá embaixo e execute.
 * 5. Implantar > Nova implantação > App da Web
 *      Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL /exec e coloque em VITE_API_URL no Vercel/Cloudflare.
 */

const ABAS = {
  agendamentos: 'Agendamentos',
  servicos: 'Servicos',
  config: 'Config',
  admins: 'Admins',
  sessoes: 'Sessoes',
};

const CAB = {
  Agendamentos: ['ID', 'Criado em', 'Data', 'Hora', 'Serviço', 'Pet', 'Porte', 'Tutor', 'Telefone', 'Observações', 'Status'],
  Servicos: ['ID', 'Nome', 'Descrição', 'Duração (min)', 'Preço', 'Ativo'],
  Config: ['Chave', 'Valor', 'Explicação'],
  Admins: ['Usuario', 'Nome', 'Salt', 'Hash', 'Ativo'],
  Sessoes: ['Token', 'Usuario', 'Expira'],
};

const STATUS_VALIDOS = ['Pendente', 'Confirmado', 'Concluído', 'Cancelado'];
const SESSAO_HORAS = 12;
const TZ = 'America/Sao_Paulo';

/* ============================== ENTRADA ============================== */

function doGet(e) {
  return responder({ ok: true, nome: 'API Rin Tin Tin', dica: 'Use POST com {action}' });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const acoes = {
      config: acaoConfig,
      disponibilidade: acaoDisponibilidade,
      agendar: acaoAgendar,
      buscar: acaoBuscar,
      login: acaoLogin,
      logout: acaoLogout,
      listar: acaoListar,
      status: acaoStatus,
    };
    const fn = acoes[req.action];
    if (!fn) throw erro('Ação inválida.');
    return responder(Object.assign({ ok: true }, fn(req)));
  } catch (err) {
    return responder({ ok: false, erro: err.publico ? err.message : 'Erro no servidor. Tente de novo.' });
  }
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function erro(msg) {
  const e = new Error(msg);
  e.publico = true;
  return e;
}

/* ============================== AÇÕES PÚBLICAS ============================== */

function acaoConfig() {
  const c = lerConfig();
  return {
    servicos: lerServicos(),
    horarios: {
      abre: c.abre, fecha: c.fecha, intervalo: c.intervalo_min,
      diasFechados: c.dias_fechados, antecedencia: c.dias_antecedencia,
    },
    contato: { whatsapp: c.whatsapp, endereco: c.endereco, instagram: c.instagram },
  };
}

function acaoDisponibilidade(req) {
  const data = validarData(req.data);
  const c = lerConfig();
  const ocupados = contarPorHora(data);
  const agora = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const horarios = gerarHorarios(c).map(function (hora) {
    const passou = (data + ' ' + hora) <= agora;
    return { hora: hora, livre: !passou && (ocupados[hora] || 0) < c.vagas_por_horario };
  });
  return { data: data, fechado: diaFechado(data, c), horarios: horarios };
}

function acaoAgendar(req) {
  const nome = texto(req.nome, 'Nome', 80);
  const telefone = soDigitos(req.telefone);
  if (telefone.length < 10 || telefone.length > 11) throw erro('Telefone inválido. Use DDD + número.');
  const pet = texto(req.pet, 'Nome do pet', 40);
  const porte = texto(req.porte, 'Porte', 20);
  const obs = String(req.obs || '').slice(0, 300);
  const data = validarData(req.data);
  const hora = String(req.hora || '');
  const servico = lerServicos().filter(function (s) { return s.id === req.servico; })[0];
  if (!servico) throw erro('Escolha um serviço.');

  const c = lerConfig();
  if (diaFechado(data, c)) throw erro('Não abrimos nesse dia.');
  if (gerarHorarios(c).indexOf(hora) === -1) throw erro('Horário inválido.');
  const agora = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  if ((data + ' ' + hora) <= agora) throw erro('Esse horário já passou.');

  // Trava para duas pessoas não pegarem a última vaga ao mesmo tempo.
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ocupados = contarPorHora(data);
    if ((ocupados[hora] || 0) >= c.vagas_por_horario) throw erro('Esse horário acabou de ser preenchido. Escolha outro.');
    const id = 'A' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const criado = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    aba(ABAS.agendamentos).appendRow([id, criado, data, hora, servico.nome, pet, porte, nome, telefone, obs, 'Pendente']);
    SpreadsheetApp.flush();
    avisarDona(c, { id: id, data: data, hora: hora, servico: servico.nome, pet: pet, nome: nome, telefone: telefone });
    return { agendamento: { id: id, data: data, hora: hora, servico: servico.nome, pet: pet, status: 'Pendente' } };
  } finally {
    lock.releaseLock();
  }
}

/** Recupera pelo telefone + nome do pet. Devolve só data, hora, serviço e status. */
function acaoBuscar(req) {
  const telefone = soDigitos(req.telefone);
  const pet = normalizar(req.pet);
  if (telefone.length < 10 || !pet) throw erro('Informe o telefone e o nome do pet.');
  limitarTentativas('busca_' + telefone, 10, 600);
  const hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const lista = lerAgendamentos().filter(function (a) {
    return a.telefone === telefone && normalizar(a.pet) === pet && a.data >= hoje && a.status !== 'Cancelado';
  }).map(function (a) {
    return { id: a.id, data: a.data, hora: a.hora, servico: a.servico, pet: a.pet, status: a.status };
  });
  return { agendamentos: lista };
}

/* ============================== AÇÕES DA DONA ============================== */

function acaoLogin(req) {
  const usuario = normalizar(req.usuario);
  const senha = String(req.senha || '');
  limitarTentativas('login_' + usuario, 5, 900);
  const linhas = aba(ABAS.admins).getDataRange().getValues().slice(1);
  const admin = linhas.filter(function (l) { return normalizar(l[0]) === usuario && l[4] !== false; })[0];
  if (!admin || gerarHash(admin[2], senha) !== admin[3]) throw erro('Usuário ou senha incorretos.');
  CacheService.getScriptCache().remove('login_' + usuario);
  const token = Utilities.getUuid() + Utilities.getUuid();
  const expira = Date.now() + SESSAO_HORAS * 3600 * 1000;
  aba(ABAS.sessoes).appendRow([token, usuario, expira]);
  limparSessoesVencidas();
  return { token: token, nome: admin[1] || usuario };
}

function acaoLogout(req) {
  const sh = aba(ABAS.sessoes);
  const v = sh.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (v[i][0] === req.token) sh.deleteRow(i + 1);
  return {};
}

function acaoListar(req) {
  exigirSessao(req.token);
  const de = req.de ? validarData(req.de, true) : '0000-00-00';
  const ate = req.ate ? validarData(req.ate, true) : '9999-12-31';
  const lista = lerAgendamentos()
    .filter(function (a) { return a.data >= de && a.data <= ate; })
    .sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); });
  return { agendamentos: lista };
}

function acaoStatus(req) {
  exigirSessao(req.token);
  if (STATUS_VALIDOS.indexOf(req.status) === -1) throw erro('Status inválido.');
  const sh = aba(ABAS.agendamentos);
  const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === req.id) {
      sh.getRange(i + 2, 11).setValue(req.status);
      return { id: req.id, status: req.status };
    }
  }
  throw erro('Agendamento não encontrado.');
}

/* ============================== LEITURA ============================== */

function lerAgendamentos() {
  const v = aba(ABAS.agendamentos).getDataRange().getDisplayValues().slice(1);
  return v.filter(function (l) { return l[0]; }).map(function (l) {
    return {
      id: l[0], criadoEm: l[1], data: l[2], hora: l[3], servico: l[4], pet: l[5],
      porte: l[6], tutor: l[7], telefone: soDigitos(l[8]), obs: l[9], status: l[10] || 'Pendente',
    };
  });
}

function contarPorHora(data) {
  const cont = {};
  lerAgendamentos().forEach(function (a) {
    if (a.data === data && a.status !== 'Cancelado') cont[a.hora] = (cont[a.hora] || 0) + 1;
  });
  return cont;
}

function lerServicos() {
  return aba(ABAS.servicos).getDataRange().getDisplayValues().slice(1)
    .filter(function (l) { return l[0] && String(l[5]).toUpperCase() !== 'FALSE' && l[5] !== 'Não'; })
    .map(function (l) {
      return { id: l[0], nome: l[1], descricao: l[2], duracao: Number(l[3]) || 60, preco: l[4] };
    });
}

function lerConfig() {
  const cache = CacheService.getScriptCache();
  const salvo = cache.get('config');
  if (salvo) return JSON.parse(salvo);
  const mapa = {};
  aba(ABAS.config).getDataRange().getDisplayValues().slice(1).forEach(function (l) { mapa[l[0]] = l[1]; });
  const c = {
    abre: mapa.abre || '08:00',
    fecha: mapa.fecha || '18:00',
    intervalo_min: Number(mapa.intervalo_min) || 60,
    vagas_por_horario: Number(mapa.vagas_por_horario) || 1,
    dias_fechados: String(mapa.dias_fechados || '0').split(',').map(function (x) { return Number(x.trim()); }).filter(function (x) { return !isNaN(x); }),
    dias_antecedencia: Number(mapa.dias_antecedencia) || 30,
    email_aviso: mapa.email_aviso || '',
    whatsapp: mapa.whatsapp || '',
    endereco: mapa.endereco || '',
    instagram: mapa.instagram || '',
  };
  cache.put('config', JSON.stringify(c), 120);
  return c;
}

/* ============================== AJUDANTES ============================== */

function aba(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw erro('Planilha não configurada. Rode configurarPlanilha().');
  return sh;
}

function gerarHorarios(c) {
  const lista = [];
  const [ha, ma] = c.abre.split(':').map(Number);
  const [hf, mf] = c.fecha.split(':').map(Number);
  for (let m = ha * 60 + ma; m + c.intervalo_min <= hf * 60 + mf; m += c.intervalo_min) {
    lista.push(('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2));
  }
  return lista;
}

function diaFechado(data, c) {
  const p = data.split('-').map(Number);
  const dia = new Date(p[0], p[1] - 1, p[2]).getDay();
  return c.dias_fechados.indexOf(dia) !== -1;
}

function validarData(data, livre) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) throw erro('Data inválida.');
  if (livre) return data;
  const hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const limite = Utilities.formatDate(new Date(Date.now() + lerConfig().dias_antecedencia * 86400000), TZ, 'yyyy-MM-dd');
  if (data < hoje) throw erro('Essa data já passou.');
  if (data > limite) throw erro('Ainda não abrimos agenda para essa data.');
  return data;
}

function exigirSessao(token) {
  if (!token) throw erro('Faça login de novo.');
  const v = aba(ABAS.sessoes).getDataRange().getValues().slice(1);
  const s = v.filter(function (l) { return l[0] === token; })[0];
  if (!s || Number(s[2]) < Date.now()) throw erro('Sessão expirada. Faça login de novo.');
  return s[1];
}

function limparSessoesVencidas() {
  const sh = aba(ABAS.sessoes);
  const v = sh.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (Number(v[i][2]) < Date.now()) sh.deleteRow(i + 1);
}

function limitarTentativas(chave, max, segundos) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(chave) || 0);
  if (n >= max) throw erro('Muitas tentativas. Espere alguns minutos e tente de novo.');
  cache.put(chave, String(n + 1), segundos);
}

function gerarHash(salt, senha) {
  let h = salt + ':' + senha;
  for (let i = 0; i < 2000; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function avisarDona(c, a) {
  if (!c.email_aviso) return;
  try {
    MailApp.sendEmail(c.email_aviso,
      '🐶 Novo agendamento: ' + a.pet + ' — ' + a.data.split('-').reverse().join('/') + ' ' + a.hora,
      'Serviço: ' + a.servico + '\nPet: ' + a.pet + '\nTutor: ' + a.nome + '\nWhatsApp: ' + a.telefone + '\nID: ' + a.id);
  } catch (e) { /* aviso por e-mail é opcional */ }
}

function texto(v, campo, max) {
  const s = String(v || '').trim();
  if (!s) throw erro('Preencha: ' + campo + '.');
  return s.slice(0, max);
}
function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }
function normalizar(v) {
  return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* ============================== INSTALAÇÃO (rodar à mão) ============================== */

/** Cria as abas, cabeçalhos e valores de exemplo. Pode rodar de novo sem apagar dados. */
function configurarPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(CAB).forEach(function (nome) {
    let sh = ss.getSheetByName(nome);
    if (!sh) sh = ss.insertSheet(nome);
    if (sh.getLastRow() === 0) {
      sh.appendRow(CAB[nome]);
      sh.getRange(1, 1, 1, CAB[nome].length).setFontWeight('bold').setBackground('#e0f4ef');
      sh.setFrozenRows(1);
    }
  });
  // Datas, horas e telefone como texto puro (evita o Google converter sozinho).
  aba(ABAS.agendamentos).getRange('A:K').setNumberFormat('@');

  const sv = aba(ABAS.servicos);
  if (sv.getLastRow() === 1) {
    sv.getRange('A:F').setNumberFormat('@');
    [
      ['banho', 'Banho', 'Banho completo com secagem, perfume e lacinho.', '60', 'a partir de R$ 50', 'Sim'],
      ['banho-tosa', 'Banho + tosa', 'Banho completo com tosa higiênica ou na tesoura.', '90', 'a partir de R$ 80', 'Sim'],
      ['creche', 'Creche (diária)', 'Seu pet passa o dia brincando com supervisão.', '60', 'R$ 70 a diária', 'Sim'],
      ['hotel', 'Hotel (pernoite)', 'Hospedagem com carinho, passeios e fotos para você.', '60', 'R$ 110 a diária', 'Sim'],
    ].forEach(function (l) { sv.appendRow(l); });
  }

  const cf = aba(ABAS.config);
  if (cf.getLastRow() === 1) {
    cf.getRange('A:C').setNumberFormat('@');
    [
      ['abre', '08:00', 'Primeiro horário do dia'],
      ['fecha', '18:00', 'Último atendimento termina até esse horário'],
      ['intervalo_min', '60', 'Minutos entre um horário e outro'],
      ['vagas_por_horario', '2', 'Quantos pets dá pra atender no mesmo horário'],
      ['dias_fechados', '0', 'Dias sem atendimento: 0=domingo, 1=segunda ... 6=sábado. Ex: 0,1'],
      ['dias_antecedencia', '30', 'Até quantos dias pra frente aceita agendamento'],
      ['email_aviso', '', 'E-mail que recebe aviso de novo agendamento (deixe vazio para não avisar)'],
      ['whatsapp', '5511999999999', 'WhatsApp com DDI+DDD, só números'],
      ['endereco', 'Rua Exemplo, 123', 'Endereço que aparece no site'],
      ['instagram', 'rintintinhotelcreche', 'Usuário do Instagram'],
    ].forEach(function (l) { cf.appendRow(l); });
  }
  CacheService.getScriptCache().remove('config');
  const padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && padrao.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(padrao);
}

/**
 * Cria (ou troca a senha de) um usuário da dona.
 * Edite as 3 linhas abaixo, execute, e depois APAGUE a senha daqui.
 */
function criarAdmin() {
  const USUARIO = 'dona';
  const NOME = 'Rin Tin Tin';
  const SENHA = 'troque-esta-senha';

  if (SENHA.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
  const sh = aba(ABAS.admins);
  const salt = Utilities.getUuid();
  const hash = gerarHash(salt, SENHA);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (normalizar(v[i][0]) === normalizar(USUARIO)) {
      sh.getRange(i + 1, 1, 1, 5).setValues([[USUARIO, NOME, salt, hash, true]]);
      return Logger.log('Senha atualizada para ' + USUARIO);
    }
  }
  sh.appendRow([USUARIO, NOME, salt, hash, true]);
  Logger.log('Admin criado: ' + USUARIO);
}
