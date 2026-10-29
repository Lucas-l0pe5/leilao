// Sala do lote: tudo se atualiza sozinho a cada 1,5 s, sem recarregar a página.

import { useParams } from 'react-router';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { ajustarRelogio, formatarDataHora } from '../lib/tempo.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import { useSessao } from '../sessao.jsx';
import Selo from '../componentes/Selo.jsx';
import Contagem, { useRelogio } from '../componentes/Contagem.jsx';
import AreaDeLance, { PosicaoUsuario } from '../componentes/AreaDeLance.jsx';
import HistoricoLances from '../componentes/HistoricoLances.jsx';
import { Carregando, Falha } from '../componentes/Estado.jsx';

const INTERVALO_MS = 1500;

async function buscarSala(id) {
  const lote = await api(`/lotes/${id}`);
  ajustarRelogio(lote.hora_servidor);
  return lote;
}

function Relogio({ lote }) {
  const agora = useRelogio();

  if (lote.situacao === 'agendado') {
    return (
      <div className="relogio">
        <span className="relogio__rotulo">Começa em</span>
        <Contagem ate={lote.inicio_em} />
      </div>
    );
  }
  if (lote.situacao === 'encerrado') {
    return (
      <div className="relogio">
        <span className="relogio__rotulo">Encerrou em</span>
        <span className="relogio__data">{formatarDataHora(lote.fim_em)}</span>
      </div>
    );
  }
  const acabou = new Date(lote.fim_em).getTime() <= agora;
  return (
    <div className="relogio">
      <span className="relogio__rotulo">{acabou ? 'Encerrando…' : 'Termina em'}</span>
      <Contagem ate={lote.fim_em} />
    </div>
  );
}

export default function Sala() {
  const { id } = useParams();
  const { usuario } = useSessao();
  const { dados: lote, erro, carregando, recarregar } = useConsulta(
    () => buscarSala(id),
    `${id}-${usuario?.id ?? 'visitante'}`,
    INTERVALO_MS
  );

  if (carregando) {
    return <Carregando texto="Abrindo a sala…" />;
  }
  if (!lote) {
    return <Falha erro={erro} aoTentar={recarregar} />;
  }

  const temLance = lote.lance_atual_centavos !== null;
  const prorrogado = lote.fim_em !== lote.fim_original_em;

  return (
    <div className="sala">
      <div className="sala__item">
        <div className="sala__imagem">
          {lote.imagem_url ? <img src={lote.imagem_url} alt={lote.titulo} /> : <span>Sem imagem</span>}
        </div>
        <dl className="atributos">
          {Object.entries(lote.atributos ?? {}).map(([nome, valor]) => (
            <div key={nome}>
              <dt>{nome}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="sala__painel">
        <div className="sala__topo">
          <Selo tipo={lote.situacao} />
          {prorrogado && <span className="selo selo--prorrogado">Prorrogado</span>}
          {erro && <span className="sala__offline">Reconectando…</span>}
        </div>
        <h1 className="sala__titulo">{lote.titulo}</h1>
        <p className="texto-suave">Leiloeiro: {lote.leiloeiro_apelido}</p>

        <div className="placar">
          <div>
            <span className="placar__rotulo">{temLance ? 'Lance atual' : 'Lance inicial'}</span>
            <span key={lote.lance_atual_centavos ?? 'inicial'} className="placar__valor numero">
              {formatarCentavos(temLance ? lote.lance_atual_centavos : lote.lance_inicial_centavos)}
            </span>
            <span className="placar__lider">
              {temLance ? `Líder: ${lote.lider_apelido}` : 'Nenhum lance ainda'}
              {' · '}incremento {formatarCentavos(lote.incremento_minimo_centavos)}
            </span>
          </div>
          <Relogio lote={lote} />
        </div>

        {prorrogado && lote.situacao === 'ao_vivo' && (
          <p className="texto-suave">
            Fim original: {formatarDataHora(lote.fim_original_em)}. Lances nos últimos 2 minutos prorrogam o fim em mais 2.
          </p>
        )}

        <PosicaoUsuario posicao={lote.posicao_usuario} />

        <AreaDeLance lote={lote} aoAtualizar={recarregar} />

        <HistoricoLances lote={lote} apelidoUsuario={usuario?.apelido} />
      </div>
    </div>
  );
}
