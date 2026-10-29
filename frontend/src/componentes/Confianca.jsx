// Os três pilares de confiança da casa. Cada um descreve uma regra que o
// sistema realmente cumpre (nada de promessa que o back-end não garante).

import Icone from './Icone.jsx';

const PILARES = [
  {
    icone: 'corrente',
    titulo: 'Histórico à prova de adulteração',
    texto:
      'Cada lance é encadeado ao anterior por um código (hash). Qualquer pessoa pode auditar o histórico de um lote, sem login, e ver se algo foi alterado.',
  },
  {
    icone: 'carteira',
    titulo: 'Lance com saldo garantido',
    texto:
      'Ao dar um lance, o valor fica reservado na sua carteira. Se alguém cobrir, ele volta na hora para o saldo disponível. Ninguém dá lance sem fundos.',
  },
  {
    icone: 'relogio',
    titulo: 'Relógio justo, sem lance de última hora',
    texto:
      'O horário oficial é o do servidor. Um lance nos últimos 2 minutos prorroga o fim em mais 2, para todos terem a chance de responder.',
  },
];

export default function Confianca() {
  return (
    <section className="confianca" aria-labelledby="confianca-titulo">
      <div className="confianca__cabecalho">
        <p className="sobrelinha">Por que confiar</p>
        <h2 id="confianca-titulo">Regras claras em cada martelada</h2>
      </div>
      <ul className="confianca__pilares">
        {PILARES.map((pilar) => (
          <li key={pilar.titulo} className="pilar">
            <span className="pilar__icone">
              <Icone nome={pilar.icone} tamanho={22} />
            </span>
            <h3 className="pilar__titulo">{pilar.titulo}</h3>
            <p className="pilar__texto">{pilar.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
