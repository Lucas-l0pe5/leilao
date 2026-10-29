import bcrypt from 'bcrypt';
import { pool } from './pool.js';
import { calcularHash, HASH_INICIAL } from '../lances/hash.js';

const SENHA_PADRAO = 'Leilao@2026';

// Endereço público da API, usado para montar a URL da imagem de reserva.
// Local: http://localhost:3000. Para semear o Neon, defina URL_PUBLICA_API
// com o endereço do Render antes de rodar (ver instruções).
const URL_API = (process.env.URL_PUBLICA_API || 'http://localhost:3000').replace(/\/$/, '');
const IMAGEM_PADRAO = `${URL_API}/imagens/instrumento.svg`;

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

const usuariosSeed = [
  { email: 'leiloeiro@leilao.test', papel: 'leiloeiro', apelido: 'Leiloeiro #SEED01', saldo: 0 },
  { email: 'licitante1@leilao.test', papel: 'licitante', apelido: 'Licitante #SEED02', saldo: 500000 },
  { email: 'licitante2@leilao.test', papel: 'licitante', apelido: 'Licitante #SEED03', saldo: 500000 },
];

// Valores em centavos. "quando" é o deslocamento em relação ao momento do seed
// (negativo = no passado). "lances" já vem em ordem cronológica.
const lotesSeed = [
  {
    // A) AO VIVO, com 3 lances: o líder é o licitante1; o licitante2 está "superado".
    codigo: 'seed-ao-vivo-com-lances',
    titulo: 'Violino de estudo - Alemanha',
    atributos: { Origem: 'Alemanha', Época: 'Século XIX', Material: 'Abeto e bordo' },
    lanceInicial: 50000,
    incremento: 2500,
    inicio: -2 * HORA,
    fim: 30 * DIA,
    lances: [
      { email: 'licitante1@leilao.test', valor: 50000, quando: -90 * MINUTO },
      { email: 'licitante2@leilao.test', valor: 55000, quando: -60 * MINUTO },
      { email: 'licitante1@leilao.test', valor: 60000, quando: -30 * MINUTO },
    ],
  },
  {
    // B) AO VIVO, sem lances: serve para testar o 1º lance.
    codigo: 'seed-ao-vivo-sem-lances',
    titulo: 'Violão clássico - Espanha',
    atributos: { Origem: 'Espanha', Época: 'Século XX', Material: 'Cedro e jacarandá' },
    lanceInicial: 80000,
    incremento: 5000,
    inicio: -1 * HORA,
    fim: 30 * DIA,
    lances: [],
  },
  {
    // C) AGENDADO: começa amanhã.
    codigo: 'seed-agendado',
    titulo: 'Trompete de latão - França',
    atributos: { Origem: 'França', Época: 'Século XX', Material: 'Latão' },
    lanceInicial: 30000,
    incremento: 2000,
    inicio: 1 * DIA,
    fim: 10 * DIA,
    lances: [],
  },
  {
    // D) ENCERRADO e liquidado: o vencedor é o licitante2, com comprovante.
    codigo: 'seed-encerrado',
    titulo: 'Flauta transversal - Inglaterra',
    atributos: { Origem: 'Inglaterra', Época: 'Século XIX', Material: 'Madeira' },
    lanceInicial: 20000,
    incremento: 2500,
    inicio: -5 * DIA,
    fim: -4 * DIA,
    encerrado: true,
    comprovante: 'ARR-5EED000001',
    lances: [
      { email: 'licitante2@leilao.test', valor: 20000, quando: -4 * DIA - 5 * HORA },
      { email: 'licitante1@leilao.test', valor: 22500, quando: -4 * DIA - 4 * HORA },
      { email: 'licitante2@leilao.test', valor: 25000, quando: -4 * DIA - 3 * HORA },
    ],
  },
];

const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
const cliente = await pool.connect();

try {
  await cliente.query('BEGIN');

  // 1) Usuários e carteiras (id de cada e-mail guardado em "ids").
  const ids = {};
  for (const usuario of usuariosSeed) {
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (email, senha_hash, papel, apelido)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash
       RETURNING id`,
      [usuario.email, senhaHash, usuario.papel, usuario.apelido]
    );
    ids[usuario.email] = rows[0].id;

    // DO NOTHING: rodar o seed de novo não zera saldos que já mudaram.
    await cliente.query(
      `INSERT INTO carteiras (usuario_id, saldo_total_centavos)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id) DO NOTHING`,
      [rows[0].id, usuario.saldo]
    );
  }

  // 2) Lotes: só se ainda não foram semeados.
  const { rowCount: jaSemeado } = await cliente.query(
    `SELECT 1 FROM lotes WHERE item_externo_id LIKE 'seed-%' LIMIT 1`
  );

  if (jaSemeado > 0) {
    console.log('Lotes do seed já existem; nada a fazer. Use "npm run db:reset" para recomeçar do zero.');
  } else {
    const agora = Date.now();
    const leiloeiroId = ids['leiloeiro@leilao.test'];

    for (const def of lotesSeed) {
      const inicioEm = new Date(agora + def.inicio);
      const fimEm = new Date(agora + def.fim);

      const { rows: [lote] } = await cliente.query(
        `INSERT INTO lotes
           (leiloeiro_id, fonte, item_externo_id, titulo, imagem_url, atributos,
            lance_inicial_centavos, incremento_minimo_centavos,
            inicio_em, fim_original_em, fim_em, status)
         VALUES ($1, 'reserva', $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $9, $10)
         RETURNING id`,
        [
          leiloeiroId, def.codigo, def.titulo, IMAGEM_PADRAO, JSON.stringify(def.atributos),
          def.lanceInicial, def.incremento, inicioEm, fimEm,
          def.encerrado ? 'encerrado' : 'aberto',
        ]
      );

      // Lances com a cadeia de hashes (mesma função usada pela rota de lances).
      let hashAnterior = HASH_INICIAL;
      let ultimo = null;
      for (let i = 0; i < def.lances.length; i++) {
        const l = def.lances[i];
        const usuarioId = ids[l.email];
        const criadoEm = new Date(agora + l.quando);
        const sequencia = i + 1;

        const hash = calcularHash({
          loteId: lote.id, sequencia, usuarioId,
          valorCentavos: l.valor, criadoEm, hashAnterior,
        });

        await cliente.query(
          `INSERT INTO lances
             (lote_id, sequencia, usuario_id, valor_centavos,
              chave_idempotencia, criado_em, hash_anterior, hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [lote.id, sequencia, usuarioId, l.valor, `seed-${def.codigo}-${sequencia}`, criadoEm, hashAnterior, hash]
        );

        hashAnterior = hash;
        ultimo = { usuarioId, valor: l.valor };
      }

      if (!ultimo) continue;

      // Atualiza o lote com o lance atual e o líder.
      await cliente.query(
        `UPDATE lotes SET lance_atual_centavos = $1, lider_id = $2 WHERE id = $3`,
        [ultimo.valor, ultimo.usuarioId, lote.id]
      );

      if (def.encerrado) {
        // Liquidação: debita o vencedor, credita o leiloeiro, grava o arremate.
        await cliente.query(
          `UPDATE carteiras SET saldo_total_centavos = saldo_total_centavos - $1 WHERE usuario_id = $2`,
          [ultimo.valor, ultimo.usuarioId]
        );
        await cliente.query(
          `UPDATE carteiras SET saldo_total_centavos = saldo_total_centavos + $1 WHERE usuario_id = $2`,
          [ultimo.valor, leiloeiroId]
        );
        await cliente.query(
          `INSERT INTO arremates (lote_id, vencedor_id, valor_centavos, codigo_comprovante, encerrado_em)
           VALUES ($1, $2, $3, $4, $5)`,
          [lote.id, ultimo.usuarioId, ultimo.valor, def.comprovante, fimEm]
        );
      } else {
        // Lote aberto: o valor do líder fica comprometido.
        await cliente.query(
          `UPDATE carteiras
              SET saldo_comprometido_centavos = saldo_comprometido_centavos + $1
            WHERE usuario_id = $2`,
          [ultimo.valor, ultimo.usuarioId]
        );
      }
    }

    console.log('Lotes do seed criados: 2 ao vivo, 1 agendado e 1 encerrado.');
  }

  await cliente.query('COMMIT');
  console.log('Seed aplicado: 1 leiloeiro e 2 licitantes (senha: ' + SENHA_PADRAO + ').');
} catch (erro) {
  await cliente.query('ROLLBACK');
  console.error('Erro no seed:', erro.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}