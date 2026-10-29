import { Link } from 'react-router';

export default function NaoEncontrado() {
  return (
    <div className="estado">
      <h1 className="titulo-pagina">Página não encontrada</h1>
      <Link to="/" className="botao botao--secundario">
        Voltar para a vitrine
      </Link>
    </div>
  );
}
