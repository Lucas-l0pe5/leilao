// Só mostra a página para quem está logado (e, se pedido, com o papel certo).

import { Navigate, useLocation } from 'react-router';
import { useSessao } from '../sessao.jsx';
import { Carregando } from './Estado.jsx';

export default function Protegida({ papel, children }) {
  const { usuario, pronto } = useSessao();
  const local = useLocation();

  if (!pronto) {
    return <Carregando />;
  }
  if (!usuario) {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }
  if (papel && usuario.papel !== papel) {
    return <Navigate to="/" replace />;
  }
  return children;
}
