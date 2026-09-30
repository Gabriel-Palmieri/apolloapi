import 'dotenv/config';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Configure DIRECT_URL ou DATABASE_URL no .env.');

// Valores e quantidades demonstrativos; imagens ilustrativas geradas por IA.
const products = [
  { name: 'Vestido Longo Feminino Esmeralda', category: 'Vestido', collection: 'Festa Feminina', fabric: 'Cetim', color: 'Verde esmeralda', line: 'Premium', rentalPriceCents: 35000, salePriceCents: 129000 },
  { name: 'Vestido Longo Feminino Marsala', category: 'Vestido', collection: 'Madrinhas', fabric: 'Chiffon', color: 'Marsala', line: 'Premium', rentalPriceCents: 32000, salePriceCents: 119000 },
  { name: 'Vestido Midi Feminino Rose', category: 'Vestido', collection: 'Festa Feminina', fabric: 'Crepe', color: 'Rosé', line: 'Padronizada', rentalPriceCents: 22000, salePriceCents: 79900 },
  { name: 'Vestido Longo Feminino Azul Serenity', category: 'Vestido', collection: 'Madrinhas', fabric: 'Chiffon', color: 'Azul serenity', line: 'Premium', rentalPriceCents: 34000, salePriceCents: 125000 },
  { name: 'Vestido de Noiva Renda Off White', category: 'Vestido', collection: 'Noivas Premium', fabric: 'Renda', color: 'Off white', line: 'Premium', rentalPriceCents: 95000, salePriceCents: 389000 },
  { name: 'Macacao Feminino Preto Alfaiataria', category: 'Macacão', collection: 'Alfaiataria Feminina', fabric: 'Crepe', color: 'Preto', line: 'Premium', rentalPriceCents: 25000, salePriceCents: 89900 },
  { name: 'Conjunto Feminino Blazer e Calca Bege', category: 'Conjunto Feminino', collection: 'Alfaiataria Feminina', fabric: 'Linho', color: 'Bege', line: 'Premium', rentalPriceCents: 30000, salePriceCents: 109000 },
  { name: 'Blazer Feminino Branco', category: 'Blazer Feminino', collection: 'Alfaiataria Feminina', fabric: 'Crepe', color: 'Branco', line: 'Padronizada', rentalPriceCents: 15000, salePriceCents: 59900 },
  { name: 'Saia Midi Feminina Plissada Champagne', category: 'Saia', collection: 'Festa Feminina', fabric: 'Cetim', color: 'Champagne', line: 'Padronizada', rentalPriceCents: 10000, salePriceCents: 35900 },
  { name: 'Blusa Feminina Acetinada Perola', category: 'Blusa', collection: 'Alfaiataria Feminina', fabric: 'Cetim', color: 'Pérola', line: 'Padronizada', rentalPriceCents: 7000, salePriceCents: 24900 },
];
const photoFiles = ["vestido-esmeralda","vestido-marsala","vestido-rose","vestido-serenity","vestido-noiva","macacao-preto","conjunto-bege","blazer-branco","saia-champagne","blusa-perola"].map((name) => `/produtos/feminino/${name}.png`);
const imageOrigin = process.env.CATALOG_IMAGE_ORIGIN?.trim();
if (imageOrigin && !/^https?:\/\/[^/]+\/?$/.test(imageOrigin)) {
  throw new Error('CATALOG_IMAGE_ORIGIN deve ser a origem HTTP(S) da API, sem /api ou outros caminhos.');
}
products.forEach((product, index) => {
  product.photoUrl = imageOrigin ? new URL(photoFiles[index], imageOrigin).href : photoFiles[index];
});

const variants = [
  { size: 'P', quantity: 1 },
  { size: 'M', quantity: 2 },
  { size: 'G', quantity: 2 },
  { size: 'GG', quantity: 1 },
];
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  // Só grava URLs públicas depois de confirmar que o deploy serve as imagens.
  if (imageOrigin) {
    for (const product of products) {
      const response = await fetch(product.photoUrl, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
        console.error(`Imagem ainda indisponível: ${product.photoUrl}`);
        throw new Error('Publique as imagens na API antes de atualizar o catálogo.');
      }
    }
  }
  const created = await db.$transaction(async (tx) => {
    // Serializa execuções deste seed para evitar duplicação por nome.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72409130)`;
    let count = 0;
    for (const data of products) {
      const existing = await tx.product.findFirst({ where: { name: data.name }, select: { id: true } });
      if (existing) {
        // Corrige apenas a categoria antiga deste modelo; preserva edições do catálogo.
        if (data.name === 'Vestido de Noiva Renda Off White') {
          const corrected = await tx.product.updateMany({
            where: { id: existing.id, category: 'Vestido de Noiva' },
            data: { category: 'Vestido' },
          });
          if (corrected.count) console.log('Categoria do vestido de noiva corrigida: Vestido de Noiva → Vestido.');
        }
        await tx.product.updateMany({
          where: { id: existing.id, OR: [
            { photoUrl: null }, { photoUrl: '' },
            ...(imageOrigin ? [{ photoUrl: new URL(data.photoUrl).pathname }] : []),
          ] },
          data: { photoUrl: data.photoUrl },
        });
        continue;
      }
      await tx.product.create({ data: { ...data, variants: { create: variants } } });
      count++;
    }
    return count;
  }, { timeout: 60000 });
  const saved = await db.product.findMany({
    where: { name: { in: products.map(({ name }) => name) } },
    include: { variants: true },
    orderBy: { name: 'asc' },
  });
  console.log(`${created} produtos femininos criados; ${saved.length} encontrados no banco.`);
  console.table(saved.map((product) => ({
    produto: product.name,
    ativo: product.active,
    categoria: product.category,
    foto: product.photoUrl,
    tamanhos: product.variants.map(({ size }) => size).join(', '),
    estoque: product.variants.reduce((sum, { quantity }) => sum + quantity, 0),
  })));
} catch {
  console.error('Falha ao cadastrar/verificar catálogo feminino. Confira a conexão e as migrations do banco.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
