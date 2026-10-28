import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { JWT_SECRET } from '../config.js';
import { exigirLogin, exigirPapel } from '../middleware/autenticacao.js';

const rotas = Router();

function gerarApelido(papel) {
  const codigo = crypto.randomBytes(3).toString('hex').toUpperCase();
  const prefixo = papel === 'leiloeiro' ? 'Leiloeiro' : 'Licitante';
  return `${prefixo} #${codigo}`;
}

function gerarToken(usuario) {
  return jwt.sign({ papel: usuario.papel }, JWT_SECRET, {
    subject: String(usuario.id),
    expiresIn: '8h',
  });
}

rotas.post('/cadastro', async (req, res) => {
  const { email, senha, papel } = req.body ?? {};

  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }
  if (typeof senha !== 'string' || senha.length < 8) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres.' });
  }
  if (!['leiloeiro', 'licitante'].includes(papel)) {
    return res.status(400).json({ erro: 'O papel deve ser "leiloeiro" ou "licitante".' });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (email, senha_hash, papel, apelido)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, papel, apelido`,
      [email.trim().toLowerCase(), senhaHash, papel, gerarApelido(papel)]
    );
    const usuario = rows[0];
    await cliente.query('INSERT INTO carteiras (usuario_id) VALUES ($1)', [usuario.id]);
    await cliente.query('COMMIT');
    return res.status(201).json({ usuario, token: gerarToken(usuario) });
  } catch (erro) {
    await cliente.query('ROLLBACK');
    if (erro.code === '23505' && erro.constraint === 'usuarios_email_key') {
      return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
    }
    throw erro;
  } finally {
    cliente.release();
  }
});

rotas.post('/login', async (req, res) => {
  const { email, senha } = req.body ?? {};

  if (typeof email !== 'string' || typeof senha !== 'string') {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  const { rows } = await pool.query(
    'SELECT id, email, senha_hash, papel, apelido FROM usuarios WHERE email = $1',
    [email.trim().toLowerCase()]
  );
  const usuario = rows[0];
  const senhaConfere = usuario ? await bcrypt.compare(senha, usuario.senha_hash) : false;

  if (!senhaConfere) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }

  const { senha_hash, ...publico } = usuario;
  return res.json({ usuario: publico, token: gerarToken(usuario) });
});

rotas.get('/eu', exigirLogin, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, papel, apelido FROM usuarios WHERE id = $1',
    [req.usuario.id]
  );
  if (!rows[0]) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' });
  }
  return res.json({ usuario: rows[0] });
});

export default rotas;