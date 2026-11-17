import { Link } from 'react-router-dom'
import { useConfig } from '../components'

const ICONES = { banho: '🛁', 'banho-tosa': '✂️', creche: '🎾', hotel: '🌙' }

export default function Home() {
  const { config } = useConfig()
  const servicos = config?.servicos ?? []

  return (
    <>
      <section className="hero">
        <div className="container">
          <div>
            <span className="script">Cuidado com carinho para o seu</span>
            <h1 className="display display-xl">
              <span className="c-verde">Melhor amigo</span><br />
              <span className="c-rosa">cheirosinho e feliz</span>
            </h1>
            <p className="lead">
              Banho, tosa, creche e hotel com todo o capricho da Rin Tin Tin.
              Agende online em menos de um minuto, sem precisar esperar resposta no WhatsApp.
            </p>
            <div className="hero-acoes">
              <Link to="/agendar" className="btn btn-primario">Agendar agora</Link>
              <a href="#servicos" className="btn btn-secundario">Ver serviços</a>
            </div>
          </div>
          <div className="hero-arte" aria-hidden="true">
            <div className="circulo" />
            <div className="circulo-2" />
            <div className="foto"><img src="/img/shihtzu.jpg" alt="" /></div>
            <img className="selo" src="/logo.png" alt="" />
            <div className="tag">⏰ Agenda aberta</div>
          </div>
        </div>
      </section>

      <section className="secao" id="servicos" style={{ background: 'var(--papel)' }}>
        <div className="container">
          <div className="secao-titulo">
            <span className="script">Saiba mais sobre o nosso</span>
            <h2 className="display display-lg c-verde">Atendimento</h2>
          </div>
          <div className="grade-servicos">
            {servicos.map((s, i) => (
              <article key={s.id} className="card card-servico">
                <div className={`icone-bolha ${i % 2 ? 'bolha-rosa' : 'bolha-verde'}`}>{ICONES[s.id] ?? '🐾'}</div>
                <h3>{s.nome}</h3>
                <p>{s.descricao}</p>
                <span className="preco">{s.preco}</span>
                <Link to={`/agendar?servico=${s.id}`} className="btn btn-fantasma" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
                  Agendar {s.nome.toLowerCase()} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="secao">
        <div className="container">
          <div className="secao-titulo">
            <span className="script">É bem simples</span>
            <h2 className="display display-lg c-rosa">Como agendar</h2>
          </div>
          <div className="passos">
            <div className="passo"><h3>Escolha o serviço</h3><p>Banho, tosa, creche ou hotel.</p></div>
            <div className="passo"><h3>Marque dia e horário</h3><p>Você só vê os horários livres.</p></div>
            <div className="passo"><h3>Pronto!</h3><p>A gente confirma e cuida do resto com carinho.</p></div>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="faixa-verde">
          <div>
            <span className="script" style={{ color: 'var(--ink)' }}>Seu peludo merece</span>
            <h2 className="display display-lg">um dia de princesa 🎀</h2>
            <p style={{ margin: '16px 0 24px', maxWidth: 440 }}>Reserve agora e receba seu pet de volta lindo, cheiroso e de lacinho.</p>
            <Link to="/agendar" className="btn btn-primario">Quero agendar</Link>
          </div>
          <div className="foto-mini"><img src="/img/yorkie.jpg" alt="Yorkshire de roupão rosa depois do banho" /></div>
        </div>
      </section>
    </>
  )
}
