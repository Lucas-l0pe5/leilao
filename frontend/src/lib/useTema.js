import { useState } from 'react';

const CHAVE = 'leilao.tema';

export function useTema() {
  // O script do index.html já colocou 'claro' ou 'escuro' no <html> antes
  // de o React existir. Aqui só lemos esse valor como ponto de partida.
  const [tema, setTema] = useState(() => document.documentElement.dataset.tema || 'claro');

  function alternar() {
    const novo = tema === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    setTema(novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Navegador bloqueou o armazenamento: o tema vale só nesta visita.
    }
  }

  return { tema, alternar };
}
