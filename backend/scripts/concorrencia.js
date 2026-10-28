// Teste de concorrência dos lances.
// Uso (com o servidor ligado em outro terminal):  node scripts/concorrencia.js
// Opcional: API_URL=https://... node scripts/concorrencia.js
const BASE = process.env.API_URL ?? 'http://localhost:3000';
const QUANTIDADE = 20;
const SENHA = 'Leilao@2026';
const LANCE_INICIAL = 10000;
const INCREMENTO = 500;
const execId = Date.now();

async function chamar(metodo, caminho, { corpo, token, chave } = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (chave) cabecalhos['Idempotency-Key'] = chave;

  const resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json().catch(() => ({}));
  return { status: resposta.status, dados };
}

function exigirSucesso(resposta, rotulo) {
  if (resposta.status >= 400) {
    throw new Error(`${rotulo} falhou (HTTP ${resposta.status}): ${JSON.stringify(resposta.dados)}`);
  }
  return resposta.dados;
}

function contarPor(respostas, campo) {
  const contagem = {};
  for (const r of respostas) {
    const rotulo = campo === 'status' ? r.status : `${r.status} ${r.dados.codigo ?? 'ok'}`;
    contagem[rotulo] = (contagem[rotulo] ?? 0) + 1;
  }
  return contagem;
}

const resultados = [];
function conferir(nome, passou, detalhe) {
  resultados.push(passou);
  console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}  ${detalhe}`);
}

async function main() {
  console.log(`API: ${BASE}\n`);

  // 1. Leiloeiro cria um lote ao vivo
  const login = exigirSucesso(
    await chamar('POST', '/auth/login', {
      corpo: { email: 'leiloeiro@leilao.test', senha: SENHA },
    }),
    'Login do leiloeiro'
  );
  const lote = exigirSucesso(
    await chamar('POST', '/leiloeiro/lotes', {
      token: login.token,
      corpo: {
        fonte: 'reserva',
        item_externo_id: `concorrencia-${execId}`,
        titulo: 'Lote do teste de concorrência',
        imagem_url: null,
        atributos: { Teste: 'concorrencia' },
        lance_inicial_centavos: LANCE_INICIAL,
        incremento_minimo_centavos: INCREMENTO,
        inicio_em: new Date(Date.now() - 60 * 1000).toISOString(),
        fim_em: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    }),
    'Criação do lote'
  );
  console.log(`Lote de teste criado: id ${lote.id}\n`);

  // 2. Cria 20 licitantes, cada um com R$ 1.000,00
  const usuarios = [];
  for (let i = 0; i < QUANTIDADE; i++) {
    const email = `concorrencia-${execId}-${i}@leilao.test`;
    exigirSucesso(
      await chamar('POST', '/auth/cadastro', {
        corpo: { email, senha: SENHA, papel: 'licitante' },
      }),
      `Cadastro ${i}`
    );
    const entrada = exigirSucesso(
      await chamar('POST', '/auth/login', { corpo: { email, senha: SENHA } }),
      `Login ${i}`
    );
    exigirSucesso(
      await chamar('POST', '/carteira/deposito', {
        token: entrada.token,
        corpo: { valor_centavos: 100000 },
      }),
      `Depósito ${i}`
    );
    usuarios.push({ token: entrada.token });
  }
  console.log(`${QUANTIDADE} licitantes criados e com saldo.\n`);

  // 3. Teste A: 20 licitantes dão o MESMO lance ao mesmo tempo
  const respostasA = await Promise.all(
    usuarios.map((u, i) =>
      chamar('POST', `/lotes/${lote.id}/lances`, {
        token: u.token,
        chave: `teste-a-${execId}-${i}`,
        corpo: { valor_centavos: LANCE_INICIAL },
      })
    )
  );
  const aceitosA = respostasA.filter((r) => r.status === 201).length;
  console.log('Respostas do teste A:', contarPor(respostasA, 'codigo'));
  conferir('A. Lances iguais e simultâneos: só um aceito', aceitosA === 1, `(aceitos: ${aceitosA})`);

  const indiceVencedorA = respostasA.findIndex((r) => r.status === 201);

  // 4. Teste B: um licitante reenvia a MESMA requisição 20 vezes ao mesmo tempo
  const indiceB = (indiceVencedorA + 1) % QUANTIDADE;
  const valorB = LANCE_INICIAL + INCREMENTO;
  const chaveB = `teste-b-${execId}`;
  const respostasB = await Promise.all(
    Array.from({ length: QUANTIDADE }, () =>
      chamar('POST', `/lotes/${lote.id}/lances`, {
        token: usuarios[indiceB].token,
        chave: chaveB,
        corpo: { valor_centavos: valorB },
      })
    )
  );
  const criadosB = respostasB.filter((r) => r.status === 201).length;
  const repetidosB = respostasB.filter((r) => r.status === 200 && r.dados.repetido === true).length;
  console.log('Respostas do teste B:', contarPor(respostasB, 'codigo'));
  conferir(
    'B. Mesma requisição 20 vezes: um lance só',
    criadosB === 1 && repetidosB === QUANTIDADE - 1,
    `(criados: ${criadosB}, repetidos: ${repetidosB})`
  );

  // 5. Teste C: o saldo comprometido bate com o lance líder
  const carteiras = await Promise.all(
    usuarios.map((u) => chamar('GET', '/carteira', { token: u.token }))
  );
  const comprometidos = carteiras.map((c) => c.dados.comprometido);
  const soma = comprometidos.reduce((total, valor) => total + valor, 0);
  const comValor = comprometidos.filter((valor) => valor > 0).length;
  conferir(
    'C. Só o líder tem saldo comprometido, e é o valor do lance',
    soma === valorB && comValor === 1 && comprometidos[indiceB] === valorB,
    `(soma: ${soma}, esperado: ${valorB}, carteiras com valor comprometido: ${comValor})`
  );

  console.log(resultados.every(Boolean) ? '\nTUDO CERTO' : '\nHÁ FALHAS');
  process.exit(resultados.every(Boolean) ? 0 : 1);
}

main().catch((erro) => {
  console.error('Erro no script:', erro.message);
  process.exit(1);
});