// Painel do leiloeiro: buscar um item no catálogo e publicar um lote com ele.

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { formatarCentavos, textoParaCentavos } from '../lib/dinheiro.js';
import { Girador } from './Estado.jsx';
import { paraCampoDataHora } from '../lib/tempo.js';
import { rotuloEmPortugues, traduzirBusca } from '../lib/catalogoMet.js';
import CampoDinheiro from './CampoDinheiro.jsx';
import CampoDataHora, { horaValida } from './CampoDataHora.jsx';

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

const LIMITE_CENTAVOS = 100000000; // o mesmo limite do back-end: R$ 1.000.000,00

// Mensagem de erro de um campo de valor, ou null. "tocado" liga a regra de
// campo vazio só depois que a pessoa saiu do campo ou tentou publicar.
function validarValor(texto, tocado) {
  const centavos = textoParaCentavos(texto);
  if (texto !== '' && centavos === null) {
    return 'Valor inválido. Use o formato 500,00.';
  }
  if (centavos > LIMITE_CENTAVOS) {
    return `O máximo é ${formatarCentavos(LIMITE_CENTAVOS)}.`;
  }
  if (tocado && (texto === '' || centavos === 0)) {
    return 'Digite um valor maior que zero.';
  }
  return null;
}

// Erros dos horários: formato da hora digitada e as mesmas regras que o
// back-end confere ao criar o lote (fim depois do início e no futuro).
function validarHorarios(inicio, fim) {
  const erroDeFormato = (valor, nome) => {
    const [dia, hora = ''] = valor.split('T');
    if (!dia) return `Escolha a data de ${nome}.`;
    if (!horaValida(hora)) return 'Digite o horário no formato HH:mm (ex.: 14:37).';
    return null;
  };
  const erros = { inicio: erroDeFormato(inicio, 'início'), fim: erroDeFormato(fim, 'fim') };

  // Só compara as datas quando as duas estão completas.
  if (!erros.inicio && !erros.fim) {
    const dataFim = new Date(fim);
    if (dataFim <= new Date(inicio)) {
      erros.fim = 'O fim precisa ser depois do início.';
    } else if (dataFim <= new Date()) {
      erros.fim = 'O fim precisa estar no futuro.';
    }
  }
  return erros;
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
  // Quais campos de valor já foram "tocados" (saiu do campo ou tentou publicar).
  const [tocados, setTocados] = useState({ lanceInicial: false, incremento: false });

  const erroLance = validarValor(form.lanceInicial, tocados.lanceInicial);
  const erroIncremento = validarValor(form.incremento, tocados.incremento);
  const errosHorario = validarHorarios(form.inicio, form.fim);
  const hoje = paraCampoDataHora(new Date()).slice(0, 10);

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

  // Versão para componentes que já entregam o valor pronto (não o evento).
  function definir(campo) {
    return (valor) => setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function tocar(campo) {
    return () => setTocados((anterior) => ({ ...anterior, [campo]: true }));
  }

  async function publicar(evento) {
    evento.preventDefault();
    const lanceInicial = textoParaCentavos(form.lanceInicial);
    const incremento = textoParaCentavos(form.incremento);

    setTocados({ lanceInicial: true, incremento: true });
    const horarios = validarHorarios(form.inicio, form.fim);
    if (validarValor(form.lanceInicial, true) || validarValor(form.incremento, true) || horarios.inicio || horarios.fim) {
      // Os campos com problema já ficam com a borda vermelha e a mensagem embaixo.
      setRetorno({ tipo: 'erro', texto: 'Confira os campos destacados em vermelho.' });
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
      setTocados({ lanceInicial: false, incremento: false });
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
              <CampoDinheiro
                rotulo="Lance inicial (R$)"
                valor={form.lanceInicial}
                aoMudar={definir('lanceInicial')}
                erro={erroLance}
                placeholder="500,00"
                onBlur={tocar('lanceInicial')}
                ajuda={<span className="campo__ajuda numero">{formatarCentavos(textoParaCentavos(form.lanceInicial))}</span>}
              />
              <CampoDinheiro
                rotulo="Incremento mínimo (R$)"
                valor={form.incremento}
                aoMudar={definir('incremento')}
                erro={erroIncremento}
                placeholder="25,00"
                onBlur={tocar('incremento')}
                ajuda={<span className="campo__ajuda numero">{formatarCentavos(textoParaCentavos(form.incremento))}</span>}
              />
              <CampoDataHora rotulo="Início" valor={form.inicio} aoMudar={definir('inicio')} erro={errosHorario.inicio} />
              <CampoDataHora rotulo="Fim" valor={form.fim} aoMudar={definir('fim')} erro={errosHorario.fim} min={hoje} />
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
