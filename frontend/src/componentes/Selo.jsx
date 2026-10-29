const ROTULOS = {
  ao_vivo: 'Ao vivo',
  agendado: 'Agendado',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
  ganhando: 'Ganhando',
  superado: 'Superado',
  venceu: 'Venceu',
  perdeu: 'Não venceu',
};

export default function Selo({ tipo }) {
  return (
    <span className={`selo selo--${tipo}`}>
      {tipo === 'ao_vivo' && <span className="selo__ponto" aria-hidden="true" />}
      {ROTULOS[tipo] ?? tipo}
    </span>
  );
}
