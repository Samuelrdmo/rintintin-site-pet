// Fala com a planilha (Google Apps Script). Sem VITE_API_URL, roda em
// "modo demonstração" guardando tudo no navegador — ótimo para apresentar ao cliente.

const API_URL = import.meta.env.VITE_API_URL || ''
export const MODO_DEMO = !API_URL

export async function api(action, dados = {}) {
  if (MODO_DEMO) return demo(action, dados)
  let res
  try {
    // Sem header Content-Type de propósito: assim o navegador não faz "preflight"
    // e o Apps Script aceita a chamada sem erro de CORS.
    res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, ...dados }) })
  } catch {
    throw new Error('Sem conexão. Confira sua internet e tente de novo.')
  }
  const json = await res.json().catch(() => ({ ok: false, erro: 'Resposta inválida do servidor.' }))
  if (!json.ok) throw new Error(json.erro || 'Algo deu errado.')
  return json
}

/* ======================= MODO DEMONSTRAÇÃO ======================= */

const CONFIG_DEMO = {
  servicos: [
    { id: 'banho', nome: 'Banho', descricao: 'Banho completo com secagem, perfume e lacinho.', duracao: 60, preco: 'a partir de R$ 50' },
    { id: 'banho-tosa', nome: 'Banho + tosa', descricao: 'Banho completo com tosa higiênica ou na tesoura.', duracao: 90, preco: 'a partir de R$ 80' },
    { id: 'creche', nome: 'Creche (diária)', descricao: 'Seu pet passa o dia brincando com supervisão.', duracao: 60, preco: 'R$ 70 a diária' },
    { id: 'hotel', nome: 'Hotel (pernoite)', descricao: 'Hospedagem com carinho, passeios e fotos para você.', duracao: 60, preco: 'R$ 110 a diária' },
  ],
  horarios: { abre: '08:00', fecha: '18:00', intervalo: 60, diasFechados: [0], antecedencia: 30 },
  contato: { whatsapp: '5511999999999', endereco: 'Rua Exemplo, 123', instagram: 'rintintinhotelcreche' },
}
const VAGAS = 2
const CHAVE = 'rtt_demo_agendamentos'

function lerDemo() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE))
    if (Array.isArray(salvo)) return salvo
  } catch { /* ignora */ }
  const inicial = exemplosDemo()
  localStorage.setItem(CHAVE, JSON.stringify(inicial))
  return inicial
}
function salvarDemo(lista) { localStorage.setItem(CHAVE, JSON.stringify(lista)) }

function exemplosDemo() {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); if (x.getDay() === 0) x.setDate(x.getDate() + 1); return iso(x) }
  return [
    { id: 'A1B2C3D4', data: d(1), hora: '09:00', servico: 'Banho + tosa', pet: 'Mel', porte: 'Pequeno', tutor: 'Juliana', telefone: '11987654321', obs: 'Tem medo de secador', status: 'Confirmado' },
    { id: 'A5F6E7D8', data: d(1), hora: '10:00', servico: 'Banho', pet: 'Thor', porte: 'Grande', tutor: 'Carlos', telefone: '11912345678', obs: '', status: 'Pendente' },
    { id: 'A9C8B7A6', data: d(2), hora: '14:00', servico: 'Creche (diária)', pet: 'Pipoca', porte: 'Médio', tutor: 'Fernanda', telefone: '11955554444', obs: '', status: 'Pendente' },
  ]
}

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function gerarHorarios({ abre, fecha, intervalo }) {
  const [ha, ma] = abre.split(':').map(Number)
  const [hf, mf] = fecha.split(':').map(Number)
  const lista = []
  for (let m = ha * 60 + ma; m + intervalo <= hf * 60 + mf; m += intervalo) {
    lista.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return lista
}

const normalizar = (v) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const espera = () => new Promise((r) => setTimeout(r, 450))

async function demo(action, d) {
  await espera()
  const lista = lerDemo()
  const agora = new Date()
  const agoraStr = `${iso(agora)} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
  const ocupadosEm = (data) => lista.filter((a) => a.data === data && a.status !== 'Cancelado')
    .reduce((acc, a) => ({ ...acc, [a.hora]: (acc[a.hora] || 0) + 1 }), {})

  switch (action) {
    case 'config':
      return { ok: true, ...CONFIG_DEMO }
    case 'disponibilidade': {
      const occ = ocupadosEm(d.data)
      const horarios = gerarHorarios(CONFIG_DEMO.horarios).map((hora) => ({
        hora, livre: `${d.data} ${hora}` > agoraStr && (occ[hora] || 0) < VAGAS,
      }))
      return { ok: true, data: d.data, horarios }
    }
    case 'agendar': {
      const tel = String(d.telefone || '').replace(/\D/g, '')
      if (!d.nome || !d.pet || !d.servico || !d.data || !d.hora) throw new Error('Preencha todos os campos.')
      if (tel.length < 10) throw new Error('Telefone inválido. Use DDD + número.')
      if ((ocupadosEm(d.data)[d.hora] || 0) >= VAGAS) throw new Error('Esse horário acabou de ser preenchido. Escolha outro.')
      const servico = CONFIG_DEMO.servicos.find((s) => s.id === d.servico)
      const novo = { id: 'A' + Math.random().toString(16).slice(2, 10).toUpperCase(), data: d.data, hora: d.hora, servico: servico.nome, pet: d.pet, porte: d.porte, tutor: d.nome, telefone: tel, obs: d.obs || '', status: 'Pendente' }
      salvarDemo([...lista, novo])
      return { ok: true, agendamento: { id: novo.id, data: novo.data, hora: novo.hora, servico: novo.servico, pet: novo.pet, status: novo.status } }
    }
    case 'buscar': {
      const tel = String(d.telefone || '').replace(/\D/g, '')
      const hoje = iso(new Date())
      return {
        ok: true,
        agendamentos: lista.filter((a) => a.telefone === tel && normalizar(a.pet) === normalizar(d.pet) && a.data >= hoje && a.status !== 'Cancelado')
          .map(({ id, data, hora, servico, pet, status }) => ({ id, data, hora, servico, pet, status })),
      }
    }
    case 'login':
      if (normalizar(d.usuario) === 'demo' && d.senha === 'demo1234') return { ok: true, token: 'demo-token', nome: 'Rin Tin Tin (demo)' }
      throw new Error('Usuário ou senha incorretos. Na demo use: demo / demo1234')
    case 'logout':
      return { ok: true }
    case 'listar': {
      if (d.token !== 'demo-token') throw new Error('Sessão expirada. Faça login de novo.')
      const de = d.de || '0000', ate = d.ate || '9999'
      return { ok: true, agendamentos: lista.filter((a) => a.data >= de && a.data <= ate).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)) }
    }
    case 'status': {
      if (d.token !== 'demo-token') throw new Error('Sessão expirada. Faça login de novo.')
      salvarDemo(lista.map((a) => (a.id === d.id ? { ...a, status: d.status } : a)))
      return { ok: true, id: d.id, status: d.status }
    }
    default:
      throw new Error('Ação inválida.')
  }
}
