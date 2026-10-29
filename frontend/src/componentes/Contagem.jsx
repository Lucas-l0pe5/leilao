import { useEffect, useState } from 'react';
import { agoraServidor, formatarRestante } from '../lib/tempo.js';

const JANELA_ANTI_SNIPING_MS = 2 * 60 * 1000;

export function useRelogio(intervaloMs = 1000) {
  const [agora, setAgora] = useState(agoraServidor);

  useEffect(() => {
    const id = setInterval(() => setAgora(agoraServidor()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);

  return agora;
}

// Contagem em uma linha: "02:14:09" ou "3d 04h 12min".
// limiteUrgenteMs: abaixo disso o texto fica vermelho (padrão: os 2 min do anti-sniping).
export default function Contagem({ ate, limiteUrgenteMs = JANELA_ANTI_SNIPING_MS }) {
  const agora = useRelogio();
  const restante = new Date(ate).getTime() - agora;
  const urgente = restante > 0 && restante <= limiteUrgenteMs;

  return (
    <time className={urgente ? 'contagem contagem--urgente' : 'contagem'} dateTime={ate}>
      {formatarRestante(restante)}
    </time>
  );
}

// Contagem em blocos (dias, horas, minutos, segundos), para o destaque.
export function ContagemDetalhada({ ate, limiteUrgenteMs = 60 * 60 * 1000 }) {
  const agora = useRelogio();
  const restante = Math.max(0, new Date(ate).getTime() - agora);
  const total = Math.floor(restante / 1000);
  const dois = (n) => String(n).padStart(2, '0');

  const partes = [
    { rotulo: 'dias', valor: Math.floor(total / 86400) },
    { rotulo: 'horas', valor: Math.floor((total % 86400) / 3600) },
    { rotulo: 'min', valor: Math.floor((total % 3600) / 60) },
    { rotulo: 'seg', valor: total % 60 },
  ].filter((parte, indice) => indice > 0 || parte.valor > 0);

  const urgente = restante > 0 && restante <= limiteUrgenteMs;

  return (
    <time
      className={urgente ? 'cronometro cronometro--urgente' : 'cronometro'}
      dateTime={ate}
      aria-label={`Termina em ${formatarRestante(restante)}`}
    >
      {partes.map((parte) => (
        <span key={parte.rotulo} className="cronometro__bloco">
          <span className="cronometro__valor">{dois(parte.valor)}</span>
          <span className="cronometro__rotulo">{parte.rotulo}</span>
        </span>
      ))}
    </time>
  );
}
