const obrigatorias = ['DATABASE_URL', 'JWT_SECRET'];

for (const nome of obrigatorias) {
  if (!process.env[nome]) {
    throw new Error(`Variável de ambiente ausente: ${nome}`);
  }
}

const TAMANHO_MINIMO_SEGREDO = 32;

if (process.env.JWT_SECRET.length < TAMANHO_MINIMO_SEGREDO) {
  throw new Error(`JWT_SECRET precisa ter pelo menos ${TAMANHO_MINIMO_SEGREDO} caracteres.`);
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const PORT = process.env.PORT || 3000;