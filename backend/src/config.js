const obrigatorias = ['DATABASE_URL', 'JWT_SECRET'];

for (const nome of obrigatorias) {
  if (!process.env[nome]) {
    throw new Error(`Variável de ambiente ausente: ${nome}`);
  }
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const PORT = process.env.PORT || 3000;