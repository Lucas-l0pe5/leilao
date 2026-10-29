// Telas de "carregando" e de "deu erro", reaproveitadas por todas as páginas.

import { useEffect, useState } from 'react';

// Girador pequeno, para dentro de botões ("Verificando…").
export function Girador() {
  return <span className="girador" aria-hidden="true" />;
}

export function Carregando({ texto = 'Carregando…' }) {
  const [demorando, setDemorando] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDemorando(true), 3000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="estado" role="status">
      <span className="estado__girando" aria-hidden="true" />
      <p>{texto}</p>
      {demorando && (
        <p className="estado__dica">
          O servidor gratuito pode estar acordando. A primeira resposta leva até 1 minuto.
        </p>
      )}
    </div>
  );
}

export function Falha({ erro, aoTentar }) {
  return (
    <div className="estado estado--erro" role="alert">
      <p>{erro?.message ?? 'Algo deu errado.'}</p>
      {aoTentar && (
        <button type="button" className="botao botao--secundario" onClick={aoTentar}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}
