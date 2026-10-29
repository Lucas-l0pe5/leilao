// Busca dados na API e, se pedido, repete a busca a cada intervalo (polling).

import { useCallback, useEffect, useRef, useState } from 'react';

export function useConsulta(buscar, chave, intervaloMs = 0) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });
  const buscarAtual = useRef(buscar);

  useEffect(() => {
    buscarAtual.current = buscar;
  });

  useEffect(() => {
    let cancelado = false;
    let temporizador = null;

    setEstado({ dados: null, erro: null, carregando: true });

    async function ciclo(primeiraVez) {
      const abaEscondida = document.visibilityState === 'hidden';

      if (primeiraVez || !abaEscondida) {
        try {
          const dados = await buscarAtual.current();
          if (!cancelado) {
            setEstado({ dados, erro: null, carregando: false });
          }
        } catch (erro) {
          if (!cancelado) {
            setEstado((anterior) => ({ ...anterior, erro, carregando: false }));
          }
        }
      }

      if (!cancelado && intervaloMs > 0) {
        temporizador = setTimeout(() => ciclo(false), intervaloMs);
      }
    }

    ciclo(true);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [chave, intervaloMs]);

  const recarregar = useCallback(async () => {
    try {
      const dados = await buscarAtual.current();
      setEstado({ dados, erro: null, carregando: false });
    } catch (erro) {
      setEstado((anterior) => ({ ...anterior, erro, carregando: false }));
    }
  }, []);

  return { ...estado, recarregar };
}
