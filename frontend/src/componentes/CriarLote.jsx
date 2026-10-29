// Painel do leiloeiro: buscar um item no catálogo e publicar um lote com ele.

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatarCentavos, textoParaCentavos } from '../lib/dinheiro.js';
import { paraCampoDataHora } from '../lib/tempo.js';

const UMA_HORA = 60 * 60 * 1000;

function horariosPadrao() {
  const inicio = new Date();
  inicio.setSeconds(0, 0);
  const fim = new Date(inicio.getTime() + 24 * UMA_HORA);
  return { inicio: paraCampoDataHora(inicio), fim: paraCampoDataHora(fim) };
}

export default function CriarLote({ aoCriar }) {
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState({ carregando: true, itens: [], aviso: null, erro: null });
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(() => ({ titulo: '', lanceInicial: '', incremento: '', ...horariosPadrao() }));
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState(null);

  async function buscar(texto) {
    setBusca((anterior) => ({ ...anterior, carregando: true, erro: null }));
    try {
      const resposta = await api(`/catalogo/itens?q=${encodeURIComponent(texto)}`);
      setBusca({ carregando: false, itens: resposta.itens, aviso: resposta.aviso ?? null, erro: null });
    } catch (erro) {
      setBusca({ carregando: false, itens: [], aviso: null, erro: erro.message });
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
          placeholder="Buscar no catálogo (ex.: violin, guitar, flute)"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label="Buscar item no catálogo"
        />
        <button type="submit" className="botao botao--secundario" disabled={busca.carregando}>
          {busca.carregando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {busca.aviso && <p className="aviso aviso--alerta">{busca.aviso}</p>}
      {busca.erro && <p className="aviso aviso--erro">{busca.erro}</p>}

      {!busca.carregando && busca.itens.length === 0 && !busca.erro && (
        <p className="texto-suave">Nenhum item encontrado para esta busca.</p>
      )}

      <ul className="catalogo" aria-busy={busca.carregando}>
        {busca.itens.map((opcao) => {
          const ativo = item?.item_externo_id === opcao.item_externo_id && item?.fonte === opcao.fonte;
          return (
            <li key={`${opcao.fonte}-${opcao.item_externo_id}`}>
              <button
                type="button"
                className={ativo ? 'catalogo__item catalogo__item--ativo' : 'catalogo__item'}
                onClick={() => escolher(opcao)}
                aria-pressed={ativo}
              >
                <img src={opcao.imagem_url} alt="" loading="lazy" />
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
