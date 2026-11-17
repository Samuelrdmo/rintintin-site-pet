import { useCallback, useEffect, useState } from 'react'
import { api, iso, MODO_DEMO } from '../lib/api'
import { Carregando } from '../components'
import { dataLonga, linkWhatsApp, mascaraTelefone } from '../lib/util'

const CHAVE = 'rtt_admin'
const STATUS = ['Pendente', 'Confirmado', 'Concluído', 'Cancelado']

const lerSessao = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) } catch { return null } }

function periodo(filtro) {
  const hoje = new Date()
  const mais = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d) }
  switch (filtro) {
    case 'hoje': return { de: iso(hoje), ate: iso(hoje) }
    case 'amanha': return { de: mais(1), ate: mais(1) }
    case 'semana': return { de: iso(hoje), ate: mais(7) }
    case 'passados': return { de: mais(-60), ate: mais(-1) }
    default: return { de: iso(hoje), ate: '' }
  }
}

export default function Admin() {
  const [sessao, setSessao] = useState(lerSessao)
  const sair = useCallback(() => {
    const s = lerSessao()
    if (s) api('logout', { token: s.token }).catch(() => {})
    localStorage.removeItem(CHAVE)
    setSessao(null)
  }, [])

  if (!sessao) return <Login onEntrar={(s) => { localStorage.setItem(CHAVE, JSON.stringify(s)); setSessao(s) }} />
  return <Painel sessao={sessao} onSair={sair} />
}

function Login({ onEntrar }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro(''); setEntrando(true)
    try {
      const r = await api('login', { usuario, senha })
      onEntrar({ token: r.token, nome: r.nome })
    } catch (err) {
      setErro(err.message)
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="container">
      <form className="card login-box" onSubmit={entrar}>
        <img src="/logo.png" alt="" style={{ width: 88, margin: '0 auto 8px', borderRadius: '50%' }} />
        <h1 className="display display-md c-verde" style={{ textAlign: 'center' }}>Área da equipe</h1>
        <p className="muted small" style={{ textAlign: 'center' }}>Entre para ver os agendamentos.</p>
        {MODO_DEMO && <div className="alerta alerta-info small">Demo: usuário <b>demo</b> e senha <b>demo1234</b></div>}
        <div className="campo">
          <label htmlFor="u">Usuário</label>
          <input id="u" required value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" />
        </div>
        <div className="campo">
          <label htmlFor="s">Senha</label>
          <input id="s" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
        </div>
        {erro && <div className="alerta alerta-erro" role="alert">{erro}</div>}
        <button className="btn btn-primario btn-bloco" disabled={entrando}>{entrando ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  )
}

function Painel({ sessao, onSair }) {
  const [filtro, setFiltro] = useState('semana')
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const r = await api('listar', { token: sessao.token, ...periodo(filtro) })
      setLista(r.agendamentos)
    } catch (err) {
      if (/login|Sessão/.test(err.message)) return onSair()
      setErro(err.message)
    }
  }, [filtro, sessao.token, onSair])

  useEffect(() => { setLista(null); carregar() }, [carregar])

  async function mudarStatus(id, status) {
    const antes = lista
    setLista(lista.map((a) => (a.id === id ? { ...a, status } : a)))
    try {
      await api('status', { token: sessao.token, id, status })
    } catch (err) {
      setLista(antes); setErro(err.message)
    }
  }

  const porDia = (lista ?? []).reduce((acc, a) => ({ ...acc, [a.data]: [...(acc[a.data] ?? []), a] }), {})
  const conta = (st) => (lista ?? []).filter((a) => a.status === st).length

  return (
    <div className="container pagina">
      <div className="admin-topo">
        <div>
          <span className="script">Olá,</span>
          <h1 className="display display-lg c-verde">{sessao.nome}</h1>
        </div>
        <div className="filtros">
          <button className="btn btn-fantasma" onClick={carregar}>↻ Atualizar</button>
          <button className="btn btn-secundario" onClick={onSair}>Sair</button>
        </div>
      </div>

      <div className="filtros" style={{ marginBottom: 24 }}>
        {[['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['semana', 'Próximos 7 dias'], ['todos', 'Todos os próximos'], ['passados', 'Anteriores']].map(([k, r]) => (
          <button key={k} className={`chip ${filtro === k ? 'sel' : ''}`} onClick={() => setFiltro(k)} aria-pressed={filtro === k}>{r}</button>
        ))}
      </div>

      {erro && <div className="alerta alerta-erro" role="alert">{erro}</div>}

      {lista && (
        <div className="resumo">
          <div className="card"><span className="muted small">Total</span><b>{lista.length}</b></div>
          <div className="card"><span className="muted small">Aguardando</span><b style={{ color: 'var(--alerta)' }}>{conta('Pendente')}</b></div>
          <div className="card"><span className="muted small">Confirmados</span><b style={{ color: 'var(--verde-texto)' }}>{conta('Confirmado')}</b></div>
          <div className="card"><span className="muted small">Concluídos</span><b>{conta('Concluído')}</b></div>
        </div>
      )}

      {!lista ? <Carregando texto="Buscando agendamentos..." /> : lista.length === 0 ? (
        <div className="vazio card">Nenhum agendamento nesse período 🐾</div>
      ) : Object.entries(porDia).map(([dia, itens]) => (
        <div key={dia} className="lista-dia">
          <h3 className="cap">{dataLonga(dia)}</h3>
          {itens.map((a) => (
            <div key={a.id} className="item-ag" style={a.status === 'Cancelado' ? { opacity: 0.55 } : undefined}>
              <div className="hora-g">{a.hora}</div>
              <div className="info">
                <strong>{a.pet}</strong> <span className="muted small">({a.porte})</span>
                <div>{a.servico} · {a.tutor} · <a href={linkWhatsApp('55' + a.telefone, `Olá, ${a.tutor}! Aqui é da Rin Tin Tin sobre o agendamento do(a) ${a.pet}.`)} target="_blank" rel="noreferrer">{mascaraTelefone(a.telefone)}</a></div>
                {a.obs && <div>📝 {a.obs}</div>}
              </div>
              <div className="lado">
                <select value={a.status} onChange={(e) => mudarStatus(a.id, e.target.value)} aria-label={`Status de ${a.pet}`} className={`st-${a.status}`}>
                  {STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
