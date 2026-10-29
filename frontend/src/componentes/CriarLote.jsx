// Painel do leiloeiro: buscar um item no catálogo e publicar um lote com ele.

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { formatarCentavos, textoParaCentavos } from '../lib/dinheiro.js';
import { Girador } from './Estado.jsx';
import { paraCampoDataHora } from '../lib/tempo.js';
import { rotuloEmPortugues, traduzirBusca } from '../lib/catalogoMet.js';

const UMA_HORA = 60 * 60 * 1000;
const ESQUELETOS = 8;
// Se o Met falhar (o servidor gratuito acorda devagar e o Met tem limite de
// requisições), tentamos de novo sozinhos, uma vez, antes de ficar na reserva.
const ESPERA_NOVA_TENTATIVA_MS = 2000;

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

// Miniatura do catálogo: um esqueleto brilha no lugar até a imagem chegar.
function ImagemCatalogo({ src }) {
  const [carregada, setCarregada] = useState(false);
  return (
    <span className={carregada ? 'catalogo__imagem' : 'catalogo__imagem esqueleto'}>
      <img
        src={src}
        alt=""
        loading="lazy"
        className={carregada ? 'catalogo__foto catalogo__foto--pronta' : 'catalogo__foto'}
        onLoad={() => setCarregada(true)}
        onError={() => setCarregada(true)}
      />
    </span>
  );
}

function horariosPadrao() {
  const inicio = new Date();
  inicio.setSeconds(0, 0);
  const fim = new Date(inicio.getTime() + 24 * UMA_HORA);
  return { inicio: paraCampoDataHora(inicio), fim: paraCampoDataHora(fim) };
}

export default function CriarLote({ aoCriar }) {
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState({ carregando: true, itens: [], fonte: null, aviso: null, erro: null, termoMet: null });
  // Número da busca mais recente. Se a pessoa buscar de novo antes da anterior
  // terminar (ou durante a nova tentativa no Met), só a última resposta vale.
  const ultimaBusca = useRef(0);
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(() => ({ titulo: '', lanceInicial: '', incremento: '', ...horariosPadrao() }));
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState(null);

  async function consultar(termoMet) {
    return api(`/catalogo/itens?q=${encodeURIComponent(termoMet)}`);
  }

  // Traduz o termo para o inglês do Met e busca. Se a resposta vier da reserva
  // (o Met falhou), espera um pouco e tenta o Met mais uma vez.
  async function buscar(texto) {
    const minha = ++ultimaBusca.current;
    const vencida = () => minha !== ultimaBusca.current;
    const { termo: termoMet, traduzido } = traduzirBusca(texto);
    setBusca((anterior) => ({ ...anterior, carregando: true, erro: null }));
    try {
      let resposta = await consultar(termoMet);
      if (resposta.fonte === 'reserva' && !vencida()) {
        await esperar(ESPERA_NOVA_TENTATIVA_MS);
        resposta = await consultar(termoMet);
      }
      if (vencida()) {
        return;
      }
      setBusca({
        carregando: false,
        itens: resposta.itens,
        fonte: resposta.fonte,
        aviso: resposta.aviso ?? null,
        erro: null,
        termoMet: traduzido ? termoMet : null,
      });
    } catch (erro) {
      if (vencida()) {
        return;
      }
      setBusca({ carregando: false, itens: [], fonte: null, aviso: null, erro: erro.message, termoMet: null });
    }
  }

  useEffect(() => {
    buscar('');
  }, []);

  function escolher(escolhido) {
    setItem(escolhido);
    setRetorno(null);
    setForm((anterior) => ({ ...anterior, titulo: escolhido.titulo }));
  }

  function alterar(campo) {
    return (evento) => setForm((anterior) => ({ ...anterior, [campo]: evento.target.value }));
  }

  async function publicar(evento) {
    evento.preventDefault();
    const lanceInicial = textoParaCentavos(form.lanceInicial);
    const incremento = textoParaCentavos(form.incremento);

    if (!lanceInicial || !incremento) {
      setRetorno({ tipo: 'erro', texto: 'Preencha o lance inicial e o incremento mínimo, por exemplo 500,00.' });
      return;
    }

    setEnviando(true);
    setRetorno(null);
    try {
      const lote = await api('/leiloeiro/lotes', {
        metodo: 'POST',
        corpo: {
          fonte: item.fonte,
          item_externo_id: item.item_externo_id,
          titulo: form.titulo.trim(),
          imagem_url: item.imagem_url,
          atributos: item.atributos,
          lance_inicial_centavos: lanceInicial,
          incremento_minimo_centavos: incremento,
          inicio_em: new Date(form.inicio).toISOString(),
          fim_em: new Date(form.fim).toISOString(),
        },
      });
      setRetorno({ tipo: 'sucesso', texto: `Lote #${lote.id} publicado (${lote.situacao === 'ao_vivo' ? 'ao vivo' : 'agendado'}).` });
      setItem(null);
      setForm({ titulo: '', lanceInicial: '', incremento: '', ...horariosPadrao() });
      aoCriar?.();
    } catch (erro) {
      setRetorno({ tipo: 'erro', texto: erro.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="bloco">
      <header className="bloco__cabecalho">
        <h2>Novo lote</h2>
        <p>Escolha um instrumento do catálogo e defina as regras do leilão.</p>
      </header>

      <form
        className="busca"
        onSubmit={(e) => {
          e.preventDefault();
          buscar(termo);
        }}
      >
        <input
          type="search"
          placeholder="Buscar no catálogo (ex.: violino, violão, flauta)"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label="Buscar item no catálogo"
        />
        <button type="submit" className="botao botao--secundario" disabled={busca.carregando}>
          {busca.carregando && <Girador />}
          {busca.carregando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {!busca.carregando && busca.fonte === 'met' && (
        <p className="catalogo__fonte">
          Catálogo do Metropolitan Museum
          {busca.termoMet && <> · buscando por “{busca.termoMet}”, o termo em inglês</>}
        </p>
      )}

      {!busca.carregando && busca.fonte === 'reserva' && (
        <div className="aviso aviso--alerta">
          <p>{busca.aviso ?? 'Catálogo do Met indisponível. Exibindo o catálogo reserva.'}</p>
          <button type="button" className="link-botao" onClick={() => buscar(termo)}>
            Tentar o Met de novo
          </button>
        </div>
      )}
      {busca.erro && <p className="aviso aviso--erro">{busca.erro}</p>}

      {!busca.carregando && busca.itens.length === 0 && !busca.erro && (
        <p className="texto-suave">Nenhum item encontrado para esta busca.</p>
      )}

      <ul className="catalogo" aria-busy={busca.carregando}>
        {busca.carregando &&
          Array.from({ length: ESQUELETOS }, (_, indice) => (
            <li key={`esqueleto-${indice}`} aria-hidden="true">
              <span className="catalogo__item catalogo__item--esqueleto">
                <span className="catalogo__imagem esqueleto" />
                <span className="esqueleto esqueleto--linha" />
                <span className="esqueleto esqueleto--linha esqueleto--curta" />
              </span>
            </li>
          ))}
        {!busca.carregando && busca.itens.map((opcao) => {
          const ativo = item?.item_externo_id === opcao.item_externo_id && item?.fonte === opcao.fonte;
          return (
            <li key={`${opcao.fonte}-${opcao.item_externo_id}`}>
              <button
                type="button"
                className={ativo ? 'catalogo__item catalogo__item--ativo' : 'catalogo__item'}
                onClick={() => escolher(opcao)}
                aria-pressed={ativo}
              >
                <ImagemCatalogo src={opcao.imagem_url} />
                {rotuloEmPortugues(opcao.titulo) && (
                  <span className="catalogo__rotulo">{rotuloEmPortugues(opcao.titulo)}</span>
                )}
                <span>{opcao.titulo}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {item && (
        <form className="form-lote" onSubmit={publicar}>
          <div className="form-lote__previa">
            <img src={item.imagem_url} alt="" />
            <dl className="atributos">
              {Object.entries(item.atributos).map(([nome, valor]) => (
                <div key={nome}>
                  <dt>{nome}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="form-lote__campos">
            <label className="campo">
              <span className="campo__rotulo">Título do lote</span>
              <input value={form.titulo} onChange={alterar('titulo')} maxLength={200} required />
            </label>

            <div className="grade-2">
              <label className="campo">
                <span className="campo__rotulo">Lance inicial (R$)</span>
                <input inputMode="decimal" placeholder="500,00" value={form.lanceInicial} onChange={alterar('lanceInicial')} />
                <span className="campo__ajuda numero">{formatarCentavos(textoParaCentavos(form.lanceInicial))}</span>
              </label>
              <label className="campo">
                <span className="campo__rotulo">Incremento mínimo (R$)</span>
                <input inputMode="decimal" placeholder="25,00" value={form.incremento} onChange={alterar('incremento')} />
                <span className="campo__ajuda numero">{formatarCentavos(textoParaCentavos(form.incremento))}</span>
              </label>
              <label className="campo">
                <span className="campo__rotulo">Início</span>
                <input type="datetime-local" value={form.inicio} onChange={alterar('inicio')} required />
              </label>
              <label className="campo">
                <span className="campo__rotulo">Fim</span>
                <input type="datetime-local" value={form.fim} onChange={alterar('fim')} required />
              </label>
            </div>

            <button type="submit" className="botao botao--primario" disabled={enviando}>
              {enviando ? 'Publicando…' : 'Publicar lote'}
            </button>
          </div>
        </form>
      )}

      {retorno && (
        <p key={retorno.texto} className={`aviso aviso--${retorno.tipo}`} role="status">
          {retorno.texto}
        </p>
      )}
    </section>
  );
}
