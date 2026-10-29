// Vitrine: destaque do momento, catálogo com filtros e os pilares de confiança.
// Os lotes vêm da consulta compartilhada (useLotes), atualizada a cada 10 s.
// Todo o filtro acontece aqui no navegador: a lista inteira já está em mãos.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useLotes } from '../lotes.jsx';
import { useSessao } from '../sessao.jsx';
import { textoParaCentavos } from '../lib/dinheiro.js';
import {
  combinaComBusca,
  encerraEm24h,
  epocaDoLote,
  escolherDestaque,
  origemDoLote,
  valorDoLote,
  valoresDistintos,
} from '../lib/lotes.js';
import DestaqueLote from '../componentes/DestaqueLote.jsx';
import FiltrosVitrine, { FILTROS_INICIAIS, SITUACOES } from '../componentes/FiltrosVitrine.jsx';
import CartaoLote from '../componentes/CartaoLote.jsx';
import PainelLance from '../componentes/PainelLance.jsx';
import Confianca from '../componentes/Confianca.jsx';
import Icone from '../componentes/Icone.jsx';
import { Carregando, Falha } from '../componentes/Estado.jsx';

const ORDENS = {
  prazo: { rotulo: 'Encerram primeiro', comparar: null }, // a API já entrega nesta ordem
  maior: { rotulo: 'Maior valor', comparar: (a, b) => valorDoLote(b) - valorDoLote(a) },
  menor: { rotulo: 'Menor valor', comparar: (a, b) => valorDoLote(a) - valorDoLote(b) },
};

function passaNaSituacao(lote, situacao) {
  if (!situacao) {
    return true;
  }
  if (situacao === 'encerra_24h') {
    return encerraEm24h(lote);
  }
  return lote.situacao === situacao;
}

function passaNoPreco(lote, minimo, maximo) {
  const valor = valorDoLote(lote);
  const de = textoParaCentavos(minimo);
  const ate = textoParaCentavos(maximo);
  return (de === null || valor >= de) && (ate === null || valor <= ate);
}

export default function Vitrine() {
  const { dados: lotes, erro, carregando, recarregar } = useLotes();
  const { usuario } = useSessao();
  const { state } = useLocation();
  const [busca, setBusca] = useState(state?.busca ?? '');
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [ordem, setOrdem] = useState('prazo');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [loteAberto, setLoteAberto] = useState(null);

  // A busca do cabeçalho chega pela navegação (state). Se mudar, aplicamos.
  useEffect(() => {
    if (state?.busca !== undefined) {
      setBusca(state.busca);
    }
  }, [state]);

  if (carregando) {
    return <Carregando texto="Carregando lotes…" />;
  }
  if (!lotes) {
    return <Falha erro={erro} aoTentar={recarregar} />;
  }

  // Primeiro, tudo menos o status: busca, época, origem e preço.
  const semStatus = lotes.filter(
    (lote) =>
      combinaComBusca(lote, busca) &&
      (!filtros.epoca || epocaDoLote(lote) === filtros.epoca) &&
      (!filtros.origem || origemDoLote(lote) === filtros.origem) &&
      passaNoPreco(lote, filtros.minimo, filtros.maximo)
  );

  // Os contadores de cada status saem desse conjunto, então acompanham os
  // outros filtros: marcar "Século XIX" atualiza o "Ao vivo (X)".
  const contagens = Object.fromEntries(
    SITUACOES.map(({ valor }) => [valor, semStatus.filter((lote) => passaNaSituacao(lote, valor)).length])
  );

  const filtrados = semStatus.filter((lote) => passaNaSituacao(lote, filtros.situacao));

  const comparar = ORDENS[ordem].comparar;
  const visiveis = comparar ? [...filtrados].sort(comparar) : filtrados;
  const destaque = escolherDestaque(lotes);

  // Leiloeiro não dá lances: sem esta função, cartões e destaque mostram "Visualizar lote".
  const abrirLance = usuario?.papel === 'leiloeiro' ? undefined : (lote) => setLoteAberto(lote.id);

  function limparTudo() {
    setFiltros(FILTROS_INICIAIS);
    setBusca('');
  }

  return (
    <>
      <h1 className="visualmente-oculto">Leilões de instrumentos musicais antigos e vintage</h1>

      {destaque && <DestaqueLote lote={destaque} aoDarLance={abrirLance} />}

      <div className="catalogo-lotes" id="catalogo">
        <FiltrosVitrine
          filtros={filtros}
          aoMudar={setFiltros}
          contagens={contagens}
          epocas={valoresDistintos(lotes, epocaDoLote)}
          origens={valoresDistintos(lotes, origemDoLote)}
          aoLimpar={() => setFiltros(FILTROS_INICIAIS)}
          aberto={filtrosAbertos}
        />

        <section className="resultados" aria-labelledby="resultados-titulo">
          <header className="resultados__barra">
            <div className="resultados__titulo">
              <h2 id="resultados-titulo">Catálogo</h2>
              <span className="resultados__contador numero" aria-live="polite">
                {visiveis.length} {visiveis.length === 1 ? 'lote' : 'lotes'}
              </span>
            </div>

            <div className="resultados__controles">
              <button
                type="button"
                className="botao botao--secundario botao--pequeno resultados__filtros"
                aria-expanded={filtrosAbertos}
                aria-controls="filtros-vitrine"
                onClick={() => setFiltrosAbertos((aberto) => !aberto)}
              >
                <Icone nome="filtro" tamanho={16} />
                Filtros
              </button>
              <label className="ordem">
                <span className="visualmente-oculto">Ordenar por</span>
                <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
                  {Object.entries(ORDENS).map(([valor, { rotulo }]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>

          {busca && (
            <p className="busca-ativa">
              Resultados para <strong>“{busca}”</strong>
              <button type="button" className="busca-ativa__limpar" onClick={() => setBusca('')} aria-label="Limpar busca">
                <Icone nome="fechar" tamanho={14} />
              </button>
            </p>
          )}

          {visiveis.length === 0 ? (
            <div className="vazio">
              <p>Nenhum lote com esses critérios.</p>
              <button type="button" className="botao botao--secundario botao--pequeno" onClick={limparTudo}>
                Ver todos os lotes
              </button>
            </div>
          ) : (
            <div className="grade-lotes">
              {visiveis.map((lote) => (
                <CartaoLote key={lote.id} lote={lote} aoDarLance={abrirLance} />
              ))}
            </div>
          )}
        </section>
      </div>

      <Confianca />

      {loteAberto !== null && <PainelLance key={loteAberto} loteId={loteAberto} aoFechar={() => setLoteAberto(null)} />}
    </>
  );
}
