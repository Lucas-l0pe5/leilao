import { Link } from 'react-router';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import { formatarDataHora } from '../lib/tempo.js';
import Selo from '../componentes/Selo.jsx';
import BotaoCopiar from '../componentes/BotaoCopiar.jsx';
import { Carregando, Falha } from '../componentes/Estado.jsx';

async function buscarTudo() {
  const [lances, arremates] = await Promise.all([api('/meus/lances'), api('/meus/arremates')]);
  return { lances, arremates };
}

export default function Meus() {
  const { dados, erro, carregando, recarregar } = useConsulta(buscarTudo, 'meus', 5000);

  if (carregando) {
    return <Carregando />;
  }
  if (!dados) {
    return <Falha erro={erro} aoTentar={recarregar} />;
  }

  const { lances, arremates } = dados;

  return (
    <div className="estreita">
      <h1 className="titulo-pagina">Meus lances</h1>

      <section className="bloco">
        <header className="bloco__cabecalho">
          <h2>Arremates</h2>
          <p>Lotes que você venceu. O comprovante é público e mostra só apelidos.</p>
        </header>
        {arremates.length === 0 ? (
          <p className="texto-suave">Você ainda não arrematou nenhum lote.</p>
        ) : (
          <ul className="lista">
            {arremates.map((a) => (
              <li key={a.codigo_comprovante} className="lista__linha">
                {a.imagem_url && <img className="lista__miniatura" src={a.imagem_url} alt="" />}
                <div className="lista__texto">
                  <strong>{a.titulo}</strong>
                  <span className="texto-suave">
                    <span className="numero">{a.codigo_comprovante}</span> · {formatarDataHora(a.encerrado_em)}
                  </span>
                </div>
                <span className="numero lista__valor">{formatarCentavos(a.valor_centavos)}</span>
                <div className="lista__acoes">
                  <Link to={`/comprovante/${a.codigo_comprovante}`} className="botao botao--secundario botao--pequeno">
                    Comprovante
                  </Link>
                  <BotaoCopiar texto={`${window.location.origin}/comprovante/${a.codigo_comprovante}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bloco">
        <header className="bloco__cabecalho">
          <h2>Lotes em que dei lance</h2>
        </header>
        {lances.length === 0 ? (
          <p className="texto-suave">
            Nenhum lance ainda. <Link to="/">Ver a vitrine</Link>
          </p>
        ) : (
          <ul className="lista">
            {lances.map((l) => (
              <li key={l.lote_id} className="lista__linha">
                {l.imagem_url && <img className="lista__miniatura" src={l.imagem_url} alt="" />}
                <div className="lista__texto">
                  <Link to={`/lotes/${l.lote_id}`}>
                    <strong>{l.titulo}</strong>
                  </Link>
                  <span className="texto-suave">
                    Meu maior lance: <span className="numero">{formatarCentavos(l.meu_maior_lance_centavos)}</span>
                    {' · '}atual: <span className="numero">{formatarCentavos(l.lance_atual_centavos)}</span>
                  </span>
                </div>
                <Selo tipo={l.posicao} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
