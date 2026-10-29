import { Link, NavLink, useNavigate } from 'react-router';
import { useSessao } from '../sessao.jsx';
import FaixaAoVivo from './FaixaAoVivo.jsx';
import BuscaGlobal from './BuscaGlobal.jsx';

function classeLink({ isActive }) {
  return isActive ? 'nav__link nav__link--ativo' : 'nav__link';
}

export default function Cabecalho() {
  const { usuario, sair } = useSessao();
  const navegar = useNavigate();

  function aoSair() {
    sair();
    navegar('/');
  }

  return (
    <header className="cabecalho">
      <FaixaAoVivo />

      <div className="cabecalho__conteudo">
        <Link to="/" className="marca">
          <span className="marca__nome">Ressonância</span>
          <span className="marca__sub">Leilões de instrumentos</span>
        </Link>

        <BuscaGlobal />

        <nav className="nav" aria-label="Principal">
          <NavLink to="/" end className={classeLink}>
            Vitrine
          </NavLink>
          {usuario?.papel === 'leiloeiro' && (
            <NavLink to="/painel" className={classeLink}>
              Painel
            </NavLink>
          )}
          {usuario?.papel === 'licitante' && (
            <NavLink to="/meus" className={classeLink}>
              Meus lances
            </NavLink>
          )}
          {usuario && (
            <NavLink to="/carteira" className={classeLink}>
              Carteira
            </NavLink>
          )}
        </nav>

        <div className="cabecalho__conta">
          {usuario ? (
            <>
              <span className="cabecalho__usuario" title={usuario.email}>
                <span className="cabecalho__papel">{usuario.papel === 'leiloeiro' ? 'Leiloeiro' : 'Licitante'}</span>
                <span className="cabecalho__apelido">{usuario.apelido}</span>
              </span>
              <button type="button" className="botao botao--fantasma botao--pequeno" onClick={aoSair}>
                Sair
              </button>
            </>
          ) : (
            <Link to="/entrar" className="botao botao--primario botao--pequeno">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
