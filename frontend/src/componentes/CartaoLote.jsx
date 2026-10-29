// Cartão de um lote na vitrine. O cartão inteiro leva à sala (link "esticado"
// sobre o cartão), e o botão "Dar lance" abre o painel lateral sem sair da página.

import { Link } from 'react-router';
import Selo from './Selo.jsx';
import Contagem from './Contagem.jsx';
import Icone from './Icone.jsx';
import { formatarCentavos } from '../lib/dinheiro.js';
import { formatarDataHora } from '../lib/tempo.js';
import { arrematado, numeroLote, procedencia, temLance, valorDoLote } from '../lib/lotes.js';

const UMA_HORA_MS = 60 * 60 * 1000;

function Prazo({ lote }) {
  if (lote.situacao === 'ao_vivo') {
    return (
      <>
        <dt>Termina em</dt>
        <dd className="lote__prazo">
          <Icone nome="relogio" tamanho={14} />
          <Contagem ate={lote.fim_em} limiteUrgenteMs={UMA_HORA_MS} />
        </dd>
      </>
    );
  }
  if (lote.situacao === 'agendado') {
    return (
      <>
        <dt>Abre em</dt>
        <dd className="lote__prazo">
          <Icone nome="relogio" tamanho={14} />
          <Contagem ate={lote.inicio_em} limiteUrgenteMs={0} />
        </dd>
      </>
    );
  }
  return (
    <>
      <dt>Encerrou</dt>
      <dd className="lote__prazo">{formatarDataHora(lote.fim_em)}</dd>
    </>
  );
}

function rotuloDoValor(lote) {
  if (arrematado(lote)) {
    return 'Arrematado por';
  }
  if (lote.situacao === 'encerrado') {
    return 'Sem lances';
  }
  return temLance(lote) ? 'Lance atual' : 'Lance inicial';
}

function legendaDoValor(lote) {
  if (arrematado(lote)) {
    return `Vencedor: ${lote.lider_apelido}`;
  }
  if (temLance(lote)) {
    return `Líder: ${lote.lider_apelido}`;
  }
  return lote.situacao === 'encerrado' ? 'Encerrado sem arremate' : 'Nenhum lance ainda';
}

export default function CartaoLote({ lote, aoDarLance }) {
  const origem = procedencia(lote);
  const vendido = arrematado(lote);
  const valor = valorDoLote(lote);

  return (
    <article className={`lote lote--${lote.situacao}`}>
      <div className="lote__imagem">
        {lote.imagem_url ? (
          <img src={lote.imagem_url} alt="" loading="lazy" />
        ) : (
          <Icone nome="musica" tamanho={32} className="lote__sem-imagem" />
        )}
        <span className="lote__numero">{numeroLote(lote.id)}</span>
        <span className="lote__selo">
          <Selo tipo={lote.situacao} />
        </span>
        {vendido && <span className="carimbo">Vendido</span>}
      </div>

      <div className="lote__corpo">
        {origem && <p className="lote__procedencia">{origem}</p>}
        <h3 className="lote__titulo">
          <Link to={`/lotes/${lote.id}`} className="lote__link">
            {lote.titulo}
          </Link>
        </h3>

        <dl className="lote__lance">
          <div>
            <dt>{rotuloDoValor(lote)}</dt>
            <dd key={valor} className={vendido ? 'lote__valor lote__valor--vendido numero' : 'lote__valor numero'}>
              {formatarCentavos(valor)}
            </dd>
            <dd className="lote__legenda">{legendaDoValor(lote)}</dd>
          </div>
          <div className="lote__tempo">
            <Prazo lote={lote} />
          </div>
        </dl>

        {lote.situacao === 'ao_vivo' && aoDarLance && (
          <button type="button" className="botao botao--primario botao--largo lote__acao" onClick={() => aoDarLance(lote)}>
            <Icone nome="martelo" tamanho={16} />
            Dar lance rápido
          </button>
        )}
      </div>
    </article>
  );
}
