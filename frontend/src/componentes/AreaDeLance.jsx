// O que a pessoa pode fazer no lote, conforme quem ela é.
// Usado pela sala do lote e pelo painel lateral de lance rápido.

import { Link } from 'react-router';
import FormLance from './FormLance.jsx';

const POSICOES = {
  ganhando: { tipo: 'sucesso', titulo: 'Você está ganhando', texto: 'Seu lance é o maior. O valor fica comprometido na sua carteira.' },
  superado: { tipo: 'erro', titulo: 'Você foi superado', texto: 'Outro licitante deu um lance maior. Seu valor voltou para o saldo disponível.' },
  venceu: { tipo: 'sucesso', titulo: 'Você venceu este lote', texto: 'O comprovante está em Meus lances.' },
  perdeu: { tipo: 'neutro', titulo: 'Lote encerrado', texto: 'Outro licitante arrematou este lote.' },
};

// Faixa colorida "ganhando / superado / venceu / perdeu".
export function PosicaoUsuario({ posicao }) {
  const destaque = POSICOES[posicao];
  if (!destaque) {
    return null;
  }
  return (
    <div key={posicao} className={`posicao posicao--${destaque.tipo}`} role="status">
      <strong>{destaque.titulo}</strong>
      <span>{destaque.texto}</span>
    </div>
  );
}

export default function AreaDeLance({ lote, aoAtualizar }) {
  const posicao = lote.posicao_usuario;

  if (lote.situacao === 'encerrado') {
    return null;
  }
  if (posicao === 'visitante') {
    return (
      <div className="aviso aviso--neutro">
        <p>Entre como licitante para dar lances.</p>
        <Link to="/entrar" state={{ de: `/lotes/${lote.id}` }}>
          Entrar ou criar conta
        </Link>
      </div>
    );
  }
  if (posicao === 'leiloeiro') {
    return <p className="aviso aviso--neutro">Leiloeiros acompanham a sala, mas não dão lances.</p>;
  }
  if (lote.situacao === 'agendado') {
    return <p className="aviso aviso--neutro">Os lances abrem no horário de início.</p>;
  }
  return <FormLance lote={lote} aoAtualizar={aoAtualizar} />;
}
