import { useEffect, useState } from 'react';

export default function BotaoCopiar({ texto, rotulo = 'Copiar link' }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) {
      return;
    }
    const id = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(id);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      window.prompt('Copie o link:', texto);
    }
  }

  return (
    <button type="button" className="botao botao--secundario botao--pequeno" onClick={copiar}>
      {copiado ? 'Link copiado' : rotulo}
    </button>
  );
}
