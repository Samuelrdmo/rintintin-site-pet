import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, gerarHorarios, iso } from '../lib/api'
import { Carregando, Ticket, useConfig } from '../components'
import { diaSemanaCurto, guardarAgendamento, linkWhatsApp, mascaraTelefone, mesCurto, dataLonga } from '../lib/util'

const PORTES = ['Pequeno', 'Médio', 'Grande']

export default function Agendar() {
  const { config, erro: erroConfig } = useConfig()
  const [params] = useSearchParams()
  const [etapa, setEtapa] = useState(1)
  const [servico, setServico] = useState(params.get('servico') || '')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [horarios, setHorarios] = useState(null)
  const [form, setForm] = useState({ nome: '', telefone: '', pet: '', porte: 'Pequeno', obs: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(null)

  const dias = useMemo(() => {
    if (!config) return []
    const total = Math.min(config.horarios.antecedencia, 30)
    const ultimo = gerarHorarios(config.horarios).at(-1) || '00:00'
    const agora = new Date()
    const agoraHM = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
    return Array.from({ length: total + 1 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i)
      const encerrouHoje = i === 0 && agoraHM >= ultimo
      return { d, iso: iso(d), fechado: encerrouHoje || config.horarios.diasFechados.includes(d.getDay()) }
    }).filter((x, i) => !(i === 0 && x.fechado))
  }, [config])

  // Seleciona automaticamente o primeiro dia aberto.
  useEffect(() => {
    if (!data && dias.length) setData(dias.find((x) => !x.fechado)?.iso || '')
  }, [dias, data])

  useEffect(() => {
    if (!data || etapa !== 2) return
    let ativo = true
    setHorarios(null); setHora('')
    api('disponibilidade', { data })
      .then((r) => ativo && setHorarios(r.horarios))
      .catch((e) => ativo && setErro(e.message))
    return () => { ativo = false }
  }, [data, etapa])

  if (erroConfig) return <div className="container pagina"><div className="alerta alerta-erro">{erroConfig}</div></div>
  if (!config) return <Carregando />

  const servicoSel = config.servicos.find((s) => s.id === servico)
  const muda = (campo) => (e) => setForm({ ...form, [campo]: campo === 'telefone' ? mascaraTelefone(e.target.value) : e.target.value })

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    if (form.telefone.replace(/\D/g, '').length < 10) return setErro('Informe o WhatsApp com DDD.')
    setEnviando(true)
    try {
      const r = await api('agendar', { ...form, servico, data, hora })
      guardarAgendamento(r.agendamento)
      setFeito(r.agendamento)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setErro(err.message)
      if (/preenchido|passou/.test(err.message)) { setEtapa(2) }
    } finally {
      setEnviando(false)
    }
  }

  if (feito) {
    const msg = `Olá! Acabei de agendar ${feito.servico} para o(a) ${feito.pet} em ${dataLonga(feito.data)} às ${feito.hora}. (cód. ${feito.id})`
    return (
      <div className="container pagina confirmado">
        <div className="check" aria-hidden="true">🐶</div>
        <span className="script">Prontinho!</span>
        <h1 className="display display-lg c-verde">Agendamento concluído</h1>
        <Ticket ag={feito} />
        <p className="muted small" style={{ maxWidth: 420, margin: '0 auto 24px' }}>
          Guardamos esse agendamento neste aparelho. Se perder, é só ir em
          <b> Meu agendamento</b> e informar seu telefone e o nome do pet.
        </p>
        <div className="hero-acoes" style={{ justifyContent: 'center' }}>
          {config.contato?.whatsapp && <a className="btn btn-primario" href={linkWhatsApp(config.contato.whatsapp, msg)} target="_blank" rel="noreferrer">Avisar no WhatsApp</a>}
          <Link to="/" className="btn btn-secundario">Voltar ao início</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container pagina">
      <div className="painel">
        <span className="script">Vamos marcar o</span>
        <h1 className="display display-lg c-verde">Seu agendamento</h1>
        <div className="etapas" aria-label={`Etapa ${etapa} de 3`}>
          {[1, 2, 3].map((n) => <div key={n} className={`etapa ${etapa >= n ? 'ativa' : ''}`} />)}
        </div>
        {erro && <div className="alerta alerta-erro" role="alert">{erro}</div>}

        {etapa === 1 && (
          <>
            <h2 className="display display-md">Qual serviço?</h2>
            <div className="opcoes" style={{ marginTop: 16 }}>
              {config.servicos.map((s) => (
                <button type="button" key={s.id} className={`opcao ${servico === s.id ? 'sel' : ''}`} onClick={() => setServico(s.id)} aria-pressed={servico === s.id}>
                  <div>
                    <strong>{s.nome}</strong>
                    <span className="muted small">{s.descricao}</span><br />
                    <span className="preco">{s.preco}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="acoes-form">
              <span />
              <button className="btn btn-primario" disabled={!servico} onClick={() => { setErro(''); setEtapa(2) }}>Continuar</button>
            </div>
          </>
        )}

        {etapa === 2 && (
          <>
            <h2 className="display display-md">Que dia?</h2>
            <div className="dias" style={{ marginTop: 16 }}>
              {dias.map(({ d, iso: di, fechado }) => (
                <button type="button" key={di} className={`dia ${data === di ? 'sel' : ''}`} disabled={fechado} onClick={() => setData(di)} aria-pressed={data === di} aria-label={dataLonga(di)}>
                  <small>{diaSemanaCurto(d)}</small><b>{d.getDate()}</b><small>{mesCurto(d)}</small>
                </button>
              ))}
            </div>
            <h2 className="display display-md" style={{ marginTop: 24 }}>Que horas?</h2>
            <div style={{ marginTop: 16 }}>
              {!horarios ? <Carregando texto="Vendo horários livres..." /> : (
                horarios.some((h) => h.livre) ? (
                  <div className="horas">
                    {horarios.map((h) => (
                      <button type="button" key={h.hora} className={`hora ${hora === h.hora ? 'sel' : ''}`} disabled={!h.livre} onClick={() => setHora(h.hora)} aria-pressed={hora === h.hora}>
                        {h.hora}
                      </button>
                    ))}
                  </div>
                ) : <div className="alerta alerta-info">Sem horários livres nesse dia. Escolha outro dia 💛</div>
              )}
            </div>
            <div className="acoes-form">
              <button className="btn btn-fantasma" onClick={() => setEtapa(1)}>← Voltar</button>
              <button className="btn btn-primario" disabled={!hora} onClick={() => { setErro(''); setEtapa(3) }}>Continuar</button>
            </div>
          </>
        )}

        {etapa === 3 && (
          <form onSubmit={enviar}>
            <div className="alerta alerta-info">{servicoSel?.nome} · {dataLonga(data)} às {hora}</div>
            <div className="linha-2">
              <div className="campo">
                <label htmlFor="pet">Nome do pet</label>
                <input id="pet" required value={form.pet} onChange={muda('pet')} autoComplete="off" />
              </div>
              <div className="campo">
                <label htmlFor="porte">Porte</label>
                <select id="porte" value={form.porte} onChange={muda('porte')}>
                  {PORTES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="linha-2">
              <div className="campo">
                <label htmlFor="nome">Seu nome</label>
                <input id="nome" required value={form.nome} onChange={muda('nome')} autoComplete="name" />
              </div>
              <div className="campo">
                <label htmlFor="tel">WhatsApp</label>
                <input id="tel" required inputMode="tel" placeholder="(11) 99999-9999" value={form.telefone} onChange={muda('telefone')} autoComplete="tel" />
                <span className="ajuda">Com ele você recupera o agendamento depois.</span>
              </div>
            </div>
            <div className="campo">
              <label htmlFor="obs">Alguma observação? (opcional)</label>
              <textarea id="obs" rows={3} maxLength={300} value={form.obs} onChange={muda('obs')} placeholder="Ex.: tem medo de secador, alergia a algum produto..." />
            </div>
            <div className="acoes-form">
              <button type="button" className="btn btn-fantasma" onClick={() => setEtapa(2)}>← Voltar</button>
              <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Agendando...' : 'Confirmar agendamento'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
