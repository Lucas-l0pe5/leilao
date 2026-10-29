// Destaque do topo da vitrine: o lote mais disputado do momento.
// Busca o detalhe do lote (que traz o total de lances e a hora do servidor)
// e se atualiza a cada 10 s, sem recarregar a página.

import { Link } from 'react-router';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { ajustarRelogio } from '../lib/tempo.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import { numeroLote, temLance, valorDoLote } from '../lib/lotes.js';
import Selo from './Selo.jsx';
import Icone from './Icone.jsx';
import { ContagemDetalhada } from './Contagem.jsx';

async function buscarDetalhe(id) {
  const lote = await api(`/lotes/${id}`);
  ajustarRelogio(lote.hora_servidor);
  return lote;
}

export default function DestaqueLote({ lote: resumo, aoDarLance }) {
  const { dados: detalhe } = useConsulta(() => buscarDetalhe(resumo.id), resumo.id, 10000);

  // Enquanto o detalhe não chega, o resumo da lista já basta para desenhar.
  const lote = detalhe ?? resumo;
  const aoVivo = lote.situacao === 'ao_vivo';
  const valor = valorDoLote(lote);
  const atributos = Object.entries(lote.atributos ?? {});

  return (
    <section className="destaque" aria-labelledby="destaque-titulo">
      <div className="destaque__imagem">
        {lote.imagem_url ? <img src={lote.imagem_url} alt={lote.titulo} /> : <Icone nome="musica" tamanho={48} />}
        <span className="destaque__etiqueta">{numeroLote(lote.id)} · Destaque</span>
      </div>

      <div className="destaque__painel">
        <div className="destaque__topo">
          <p className="sobrelinha">Lote em destaque</p>
          <Selo tipo={lote.situacao} />
        </div>

        <h2 id="destaque-titulo" className="destaque__titulo">
          {lote.titulo}
        </h2>

        {atributos.length > 0 && (
          <dl className="ficha">
            {atributos.map(([nome, valorAtributo]) => (
              <div key={nome}>
                <dt>{nome}</dt>
                <dd>{valorAtributo}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="destaque__placar">
          <div className="destaque__lance">
            <span className="rotulo">{temLance(lote) ? 'Lance atual' : 'Lance inicial'}</span>
            <span key={valor} className="destaque__valor numero">
              {formatarCentavos(valor)}
            </span>
            <span className="destaque__legenda">
              {detalhe ? `${detalhe.total_lances} ${detalhe.total_lances === 1 ? 'lance' : 'lances'}` : '…'}
              {temLance(lote) && ` · líder ${lote.lider_apelido}`}
            </span>
          </div>

          <div className="destaque__tempo">
            <span className="rotulo">{aoVivo ? 'Encerra em' : 'Abre em'}</span>
            <ContagemDetalhada ate={aoVivo ? lote.fim_em : lote.inicio_em} />
          </div>
        </div>

        <div className="destaque__acoes">
          {aoVivo && aoDarLance ? (
            <>
              <button type="button" className="botao botao--primario botao--grande" onClick={() => aoDarLance(lote)}>
                <Icone nome="martelo" tamanho={18} />
                Dar lance agora
              </button>
              <Link to={`/lotes/${lote.id}`} className="botao botao--secundario botao--grande">
                Ver sala do lote
              </Link>
            </>
          ) : (
            <Link to={`/lotes/${lote.id}`} className="botao botao--secundario botao--grande">
              Visualizar lote
            </Link>
          )}
        </div>

        <Link to={`/lotes/${lote.id}/auditoria`} className="destaque__auditoria">
          <Icone nome="escudo" tamanho={16} />
          Histórico de lances auditável, sem login
        </Link>
      </div>
    </section>
  );
}
