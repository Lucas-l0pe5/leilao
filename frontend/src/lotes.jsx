// Lista de lotes compartilhada: a faixa "ao vivo", a busca do cabeçalho e a
// vitrine leem a mesma consulta, em vez de cada uma chamar a API por conta própria.

import { createContext, useContext } from 'react';
import { api } from './lib/api.js';
import { useConsulta } from './lib/useConsulta.js';

const ContextoLotes = createContext(null);

export function ProvedorLotes({ children }) {
  const consulta = useConsulta(() => api('/lotes'), 'lotes', 10000);
  return <ContextoLotes.Provider value={consulta}>{children}</ContextoLotes.Provider>;
}

// Devolve { dados, erro, carregando, recarregar }, como o useConsulta.
export function useLotes() {
  return useContext(ContextoLotes);
}
