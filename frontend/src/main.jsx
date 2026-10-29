import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ProvedorSessao } from './sessao.jsx';
import { ProvedorLotes } from './lotes.jsx';
import App from './App.jsx';
import './estilos.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ProvedorSessao>
        <ProvedorLotes>
          <App />
        </ProvedorLotes>
      </ProvedorSessao>
    </BrowserRouter>
  </StrictMode>
);
