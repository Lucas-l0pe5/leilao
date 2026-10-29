// Lista de lances do lote, do mais novo para o mais antigo.
// Os nomes já chegam como apelidos públicos ("Licitante #A1B2"), nunca e-mails.

import { Link } from 'react-router';
import { formatarCentavos } from '../lib/dinheiro.js';
import { formatarHora } from '../lib/tempo.js';

export default function HistoricoLances({ lote, apelidoUsuario, titulo = 'Histórico de lances' }) {
  return (
    <section className="historico">
      <header className="historico__cabecalho">
        <h2>{titulo}</h2>
        <span className="texto-suave">{lote.total_lances} no total</span>
      </header>

      {lote.historico.length === 0 ? (
        <p className="texto-suave">Seja o primeiro a dar um lance.</p>
      ) : (
        <ol className="historico__lista" aria-live="polite">
          {lote.historico.map((lance, indice) => (
            <li key={lance.sequencia} className={indice === 0 ? 'historico__linha historico__linha--topo' : 'historico__linha'}>
              <span className="historico__seq numero">#{lance.sequencia}</span>
              <span className="historico__quem">
                {lance.apelido}
                {lance.apelido === apelidoUsuario && <span className="historico__voce"> (você)</span>}
              </span>
              <span className="historico__valor numero">{formatarCentavos(lance.valor_centavos)}</span>
              <time className="historico__hora numero" dateTime={lance.criado_em}>
                {formatarHora(lance.criado_em)}
              </time>
            </li>
          ))}
        </ol>
      )}

      <Link to={`/lotes/${lote.id}/auditoria`} className="link-seta">
        Auditar este histórico
      </Link>
    </section>
  );
}
