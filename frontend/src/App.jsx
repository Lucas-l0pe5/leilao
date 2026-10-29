import { Route, Routes } from 'react-router';
import Cabecalho from './componentes/Cabecalho.jsx';
import Protegida from './componentes/Protegida.jsx';
import Vitrine from './paginas/Vitrine.jsx';
import Sala from './paginas/Sala.jsx';
import Entrar from './paginas/Entrar.jsx';
import Carteira from './paginas/Carteira.jsx';
import Meus from './paginas/Meus.jsx';
import Painel from './paginas/Painel.jsx';
import Comprovante from './paginas/Comprovante.jsx';
import Auditoria from './paginas/Auditoria.jsx';
import NaoEncontrado from './paginas/NaoEncontrado.jsx';

export default function App() {
  return (
    <>
      <Cabecalho />
      <main className="pagina">
        <Routes>
          <Route path="/" element={<Vitrine />} />
          <Route path="/lotes/:id" element={<Sala />} />
          <Route path="/lotes/:id/auditoria" element={<Auditoria />} />
          <Route path="/comprovante/:codigo" element={<Comprovante />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route
            path="/carteira"
            element={
              <Protegida>
                <Carteira />
              </Protegida>
            }
          />
          <Route
            path="/meus"
            element={
              <Protegida papel="licitante">
                <Meus />
              </Protegida>
            }
          />
          <Route
            path="/painel"
            element={
              <Protegida papel="leiloeiro">
                <Painel />
              </Protegida>
            }
          />
          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </main>
    </>
  );
}
