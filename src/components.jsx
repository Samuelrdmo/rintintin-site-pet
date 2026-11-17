import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api, MODO_DEMO } from './lib/api'
import { dataLonga } from './lib/util'

/* Config da planilha (serviços, horários, contato), carregada uma vez. */
let configPromise = null
export function useConfig() {
  const [config, setConfig] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    configPromise ??= api('config').catch((e) => { configPromise = null; throw e })
    configPromise.then(setConfig).catch((e) => setErro(e.message))
  }, [])
  return { config, erro }
}

export function Layout() {
  const { config } = useConfig()
  return (
    <>
      {MODO_DEMO && <div className="faixa-demo">Modo demonstração: os agendamentos ficam só neste navegador.</div>}
      <header className="header">
        <div className="container">
          <Link to="/" className="marca" aria-label="Rin Tin Tin Pet, início">
            <img src="/logo.png" alt="" />
            <strong>Rin Tin Tin</strong>
          </Link>
          <nav className="nav">
            <NavLink to="/meu-agendamento" className="so-desktop">Meu agendamento</NavLink>
            <Link to="/agendar" className="btn btn-primario">Agendar</Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          <div>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Rin Tin Tin Pet</strong>
            <div className="small">Hotel, creche, banho e tosa. {config?.contato?.endereco}</div>
          </div>
          <div className="small" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {config?.contato?.instagram && <a href={`https://instagram.com/${config.contato.instagram}`} target="_blank" rel="noreferrer">@{config.contato.instagram}</a>}
            <Link to="/meu-agendamento">Meu agendamento</Link>
            <Link to="/admin">Área da equipe</Link>
          </div>
        </div>
      </footer>
    </>
  )
}

export function Ticket({ ag }) {
  return (
    <div className="ticket">
      <span className={`status st-${ag.status}`}>{ag.status === 'Pendente' ? 'Aguardando confirmação' : ag.status}</span>
      <div className="data-grande" style={{ marginTop: 12 }}>{dataLonga(ag.data)}</div>
      <div className="display display-md c-verde">às {ag.hora}</div>
      <dl>
        <dt>Serviço</dt><dd>{ag.servico}</dd>
        <dt>Pet</dt><dd>{ag.pet}</dd>
      </dl>
    </div>
  )
}

export function Carregando({ texto = 'Carregando...' }) {
  return <p className="vazio" role="status">🐾 {texto}</p>
}
