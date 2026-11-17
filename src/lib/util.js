const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function paraData(isoStr) {
  const [a, m, d] = isoStr.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** "quinta, 20 de nov" */
export function dataLonga(isoStr) {
  const d = paraData(isoStr)
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}
export const diaSemanaCurto = (d) => DIAS[d.getDay()].slice(0, 3)
export const mesCurto = (d) => MESES[d.getMonth()]

export function mascaraTelefone(v) {
  const n = String(v || '').replace(/\D/g, '').slice(0, 11)
  if (n.length <= 2) return n.length ? `(${n}` : ''
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

/* ===== Cache do último agendamento no navegador ===== */
const CHAVE = 'rtt_meu_agendamento'

export function guardarAgendamento(ag) {
  try {
    // Expira um dia depois do atendimento.
    const expira = paraData(ag.data).getTime() + 2 * 86400000
    localStorage.setItem(CHAVE, JSON.stringify({ ...ag, expira }))
  } catch { /* navegador sem storage: segue sem cache */ }
}

export function lerAgendamentoGuardado() {
  try {
    const ag = JSON.parse(localStorage.getItem(CHAVE))
    if (!ag) return null
    if (ag.expira < Date.now()) { localStorage.removeItem(CHAVE); return null }
    return ag
  } catch { return null }
}

export function esquecerAgendamento() {
  try { localStorage.removeItem(CHAVE) } catch { /* ignora */ }
}

export function linkWhatsApp(numero, texto) {
  return `https://wa.me/${String(numero || '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}
