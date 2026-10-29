// Comprovante público de arremate: qualquer pessoa com o link vê, sem login.

import { Link, useParams } from 'react-router';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import { formatarDataHora } from '../lib/tempo.js';
import BotaoCopiar from '../componentes/BotaoCopiar.jsx';
import { Carregando, Falha } from '../componentes/Estado.jsx';

export default function Comprovante() {
  const { codigo } = useParams();
  const { dados: c, erro, carregando, recarregar } = useConsulta(() => api(`/comprovantes/${codigo}`), codigo);

  if (carregando) {
    return <Carregando texto="Buscando comprovante…" />;
  }
  if (!c) {
    return <Falha erro={erro} aoTentar={erro?.status === 0 ? recarregar : null} />;
  }

  return (
    <div className="estreita">
      <article className="comprovante">
        <header className="comprovante__cabecalho">
          <span className="campo__rotulo">Comprovante de arremate</span>
          <span className="comprovante__codigo numero">{c.codigo_comprovante}</span>
        </header>

        <div className="comprovante__item">
          {c.imagem_url && <img src={c.imagem_url} alt="" />}
          <h1>{c.titulo}</h1>
        </div>

        <dl className="comprovante__dados">
          <div>
            <dt>Valor arrematado</dt>
            <dd className="numero comprovante__valor">{formatarCentavos(c.valor_centavos)}</dd>
          </div>
          <div>
            <dt>Vencedor</dt>
            <dd>{c.vencedor_apelido}</dd>
          </div>
          <div>
            <dt>Leiloeiro</dt>
            <dd>{c.leiloeiro_apelido}</dd>
          </div>
          <div>
            <dt>Encerrado em</dt>
            <dd>{formatarDataHora(c.encerrado_em)}</dd>
          </div>
          <div>
            <dt>Lances no lote</dt>
            <dd className="numero">{c.total_lances}</dd>
          </div>
        </dl>

        <footer className="comprovante__rodape">
          <BotaoCopiar texto={window.location.href} />
          <Link to={`/lotes/${c.lote_id}/auditoria`} className="link-seta">
            Conferir a auditoria do lote
          </Link>
        </footer>
      </article>
    </div>
  );
}
