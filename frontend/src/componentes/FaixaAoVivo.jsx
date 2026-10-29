// Faixa fina no topo: o lote ao vivo que encerra primeiro, com contagem.
// Some sozinha quando não há nenhum lote ao vivo.

import { Link } from 'react-router';
import { useLotes } from '../lotes.jsx';
import { proximoAEncerrar } from '../lib/lotes.js';
import Contagem from './Contagem.jsx';

export default function FaixaAoVivo() {
  const { dados: lotes } = useLotes();
  const lote = proximoAEncerrar(lotes ?? []);

  if (!lote) {
    return null;
  }

  return (
    <div className="faixa">
      <Link to={`/lotes/${lote.id}`} className="faixa__conteudo">
        <span className="faixa__ao-vivo">
          <span className="faixa__ponto" aria-hidden="true" />
          Leilão ao vivo
        </span>
        <span className="faixa__titulo">{lote.titulo}</span>
        <span className="faixa__tempo">
          encerra em <Contagem ate={lote.fim_em} limiteUrgenteMs={60 * 60 * 1000} />
        </span>
      </Link>
    </div>
  );
}
