import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Ticket } from '../components'
import { esquecerAgendamento, guardarAgendamento, lerAgendamentoGuardado, mascaraTelefone } from '../lib/util'

export default function MeuAgendamento() {
  const [guardado, setGuardado] = useState(() => lerAgendamentoGuardado())
  const [telefone, setTelefone] = useState('')
  const [pet, setPet] = useState('')
  const [resultado, setResultado] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')

  async function buscar(e) {
    e.preventDefault()
    setErro(''); setBuscando(true); setResultado(null)
    try {
      const r = await api('buscar', { telefone, pet })
      setResultado(r.agendamentos)
      if (r.agendamentos[0]) { guardarAgendamento(r.agendamentos[0]) }
    } catch (err) {
      setErro(err.message)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="container pagina">
      <div className="painel" style={{ maxWidth: 520 }}>
        <span className="script">Consulte o seu</span>
        <h1 className="display display-lg c-verde">Agendamento</h1>

        {guardado && !resultado && (
          <>
            <p className="muted">Este é o último agendamento feito neste aparelho:</p>
            <Ticket ag={guardado} />
            <button className="btn btn-fantasma" onClick={() => { esquecerAgendamento(); setGuardado(null) }}>
              Não é esse? Buscar outro
            </button>
          </>
        )}

        {(!guardado || resultado) && (
          <>
            <p className="muted">Informe o WhatsApp e o nome do pet usados no agendamento.</p>
            <form onSubmit={buscar} className="card" style={{ marginTop: 16 }}>
              <div className="campo">
                <label htmlFor="tel">WhatsApp</label>
                <input id="tel" required inputMode="tel" placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} />
              </div>
              <div className="campo">
                <label htmlFor="pet">Nome do pet</label>
                <input id="pet" required value={pet} onChange={(e) => setPet(e.target.value)} />
              </div>
              {erro && <div className="alerta alerta-erro" role="alert">{erro}</div>}
              <button className="btn btn-primario btn-bloco" disabled={buscando}>{buscando ? 'Buscando...' : 'Buscar'}</button>
            </form>

            {resultado && (resultado.length ? (
              <div style={{ marginTop: 24 }}>
                <p className="muted">{resultado.length > 1 ? `Encontramos ${resultado.length} agendamentos:` : 'Encontramos:'}</p>
                {resultado.map((a) => <Ticket key={a.id} ag={a} />)}
              </div>
            ) : (
              <div className="vazio">
                Não achamos agendamentos futuros com esses dados.<br />
                <Link to="/agendar" className="btn btn-primario" style={{ marginTop: 16 }}>Fazer um agendamento</Link>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
