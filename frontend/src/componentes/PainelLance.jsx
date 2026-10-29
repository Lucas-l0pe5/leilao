// Painel lateral de lance rápido: abre por cima da vitrine, sem trocar de página.
// Atualiza a cada 1,5 s (como a sala), fecha com Esc, clique fora ou no X,
// prende o foco do teclado dentro dele e devolve o foco ao botão que o abriu.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { ajustarRelogio } from '../lib/tempo.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import { numeroLote, procedencia, temLance, valorDoLote } from '../lib/lotes.js';
import { useSessao } from '../sessao.jsx';
import Selo from './Selo.jsx';
import Icone from './Icone.jsx';
import Contagem from './Contagem.jsx';
import AreaDeLance, { PosicaoUsuario } from './AreaDeLance.jsx';
import HistoricoLances from './HistoricoLances.jsx';
import { Carregando, Falha } from './Estado.jsx';

const DURACAO_SAIDA_MS = 220;
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function buscarLote(id) {
  const lote = await api(`/lotes/${id}`);
  ajustarRelogio(lote.hora_servidor);
  return lote;
}

export default function PainelLance({ loteId, aoFechar }) {
  const { usuario } = useSessao();
  const [saindo, setSaindo] = useState(false);
  const painel = useRef(null);
  const { dados: lote, erro, carregando, recarregar } = useConsulta(
    () => buscarLote(loteId),
    `${loteId}-${usuario?.id ?? 'visitante'}`,
    1500
  );

  // Fechar = tocar a animação de saída e só depois desmontar.
  function fechar() {
    if (saindo) {
      return;
    }
    setSaindo(true);
    setTimeout(aoFechar, DURACAO_SAIDA_MS);
  }

  // A versão mais recente de "fechar", para o ouvinte de teclado abaixo.
  const fecharAtual = useRef(fechar);
  fecharAtual.current = fechar;

  // Ao abrir: trava a rolagem da página, foca o X e passa a ouvir o teclado.
  // O ouvinte fica no documento (e não no painel) porque o foco pode sair do
  // painel sem querer: um botão que fica desativado durante o envio perde o foco.
  useEffect(() => {
    const focoAnterior = document.activeElement;
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    painel.current?.querySelector('.gaveta__fechar')?.focus();

    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        fecharAtual.current();
        return;
      }
      // Prende o Tab dentro do painel: do último volta ao primeiro e vice-versa.
      if (evento.key === 'Tab' && painel.current) {
        const itens = painel.current.querySelectorAll(FOCAVEIS);
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        const dentro = painel.current.contains(document.activeElement);
        if (!dentro || (evento.shiftKey && document.activeElement === primeiro)) {
          evento.preventDefault();
          (evento.shiftKey ? ultimo : primeiro).focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primeiro.focus();
        }
      }
    }
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagemAnterior;
      focoAnterior?.focus?.();
    };
  }, []);

  return (
    <div className={saindo ? 'gaveta gaveta--saindo' : 'gaveta'}>
      <div className="gaveta__fundo" onClick={fechar} aria-hidden="true" />

      <div ref={painel} className="gaveta__painel" role="dialog" aria-modal="true" aria-labelledby="gaveta-titulo">
        <header className="gaveta__cabecalho">
          <span className="gaveta__numero">{numeroLote(loteId)}</span>
          {lote && <Selo tipo={lote.situacao} />}
          {erro && lote && <span className="sala__offline">Reconectando…</span>}
          <button type="button" className="gaveta__fechar" onClick={fechar} aria-label="Fechar painel de lance">
            <Icone nome="fechar" />
          </button>
        </header>

        <div className="gaveta__corpo">
          {carregando && <Carregando texto="Abrindo o lote…" />}
          {!carregando && !lote && <Falha erro={erro} aoTentar={recarregar} />}

          {lote && (
            <>
              <div className="gaveta__lote">
                <div className="gaveta__miniatura">{lote.imagem_url && <img src={lote.imagem_url} alt="" />}</div>
                <div>
                  {procedencia(lote) && <p className="lote__procedencia">{procedencia(lote)}</p>}
                  <h2 id="gaveta-titulo" className="gaveta__titulo">
                    {lote.titulo}
                  </h2>
                </div>
              </div>

              <div className="gaveta__placar">
                <div>
                  <span className="rotulo">{temLance(lote) ? 'Lance atual' : 'Lance inicial'}</span>
                  <span key={valorDoLote(lote)} className="gaveta__valor numero">
                    {formatarCentavos(valorDoLote(lote))}
                  </span>
                  <span className="texto-suave">
                    {lote.total_lances} {lote.total_lances === 1 ? 'lance' : 'lances'}
                    {temLance(lote) && ` · líder ${lote.lider_apelido}`}
                  </span>
                </div>
                {lote.situacao === 'ao_vivo' && (
                  <div className="gaveta__tempo">
                    <span className="rotulo">Termina em</span>
                    <Contagem ate={lote.fim_em} />
                  </div>
                )}
              </div>

              <PosicaoUsuario posicao={lote.posicao_usuario} />
              <AreaDeLance lote={lote} aoAtualizar={recarregar} />
              <HistoricoLances lote={lote} apelidoUsuario={usuario?.apelido} titulo="Lances ao vivo" />
            </>
          )}
        </div>

        <footer className="gaveta__rodape">
          <Link to={`/lotes/${loteId}`} className="link-seta">
            Abrir a sala completa do lote
          </Link>
        </footer>
      </div>
    </div>
  );
}
