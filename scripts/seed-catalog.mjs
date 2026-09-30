import 'dotenv/config';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Configure DIRECT_URL ou DATABASE_URL no .env antes de executar o seed.');
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const marker = '[seed-demo]';
const dayOffset = (days) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};
const products = [
  { name: 'Terno Casamento Marfim', category: 'Terno', collection: 'Noivos Premium', fabric: 'Lã Fria', color: 'Marfim', line: 'Premium', photoUrl: '/produtos/terno-casamento-marfim.jpg', rentalPriceCents: 45000, salePriceCents: 189000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }] },
  { name: 'Smoking Black Tie', category: 'Terno', collection: 'Black Tie', fabric: 'Lã Fria', color: 'Preto', line: 'Premium', photoUrl: '/produtos/smoking-black-tie.jpg', rentalPriceCents: 55000, salePriceCents: 229000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }] },
  { name: 'Gravata Seda Bordô', category: 'Gravata', collection: 'Clássica', fabric: 'Seda', color: 'Bordô', line: 'Premium', photoUrl: '/produtos/gravata-seda-bordo.jpg', rentalPriceCents: 5000, salePriceCents: 18900, variants: [{ size: 'Único', quantity: 6 }] },
  { name: 'Terno Preto Classico', category: 'Terno', collection: 'Black Tie', fabric: 'La Fria', color: 'Preto', line: 'Premium', photoUrl: '/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.17.jpeg', rentalPriceCents: 50000, salePriceCents: 215000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }, { size: 'GG', quantity: 1 }] },
  { name: 'Terno Grafite Tres Pecas', category: 'Terno', collection: 'Classica', fabric: 'La Fria', color: 'Grafite', line: 'Premium', photoUrl: '/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.17%20(1).jpeg', rentalPriceCents: 48000, salePriceCents: 205000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }, { size: 'GG', quantity: 1 }] },
  { name: 'Terno Azul Royal', category: 'Terno', collection: 'Noivos Premium', fabric: 'La Fria', color: 'Azul royal', line: 'Premium', photoUrl: '/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.16.jpeg', rentalPriceCents: 52000, salePriceCents: 219000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }, { size: 'GG', quantity: 1 }] },
  { name: 'Terno Cinza Mescla', category: 'Terno', collection: 'Classica', fabric: 'La Fria', color: 'Cinza', line: 'Padronizada', photoUrl: '/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.16%20(3).jpeg', rentalPriceCents: 45000, salePriceCents: 189000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }, { size: 'GG', quantity: 1 }] },
  { name: 'Terno Creme Gravata Terracota', category: 'Terno', collection: 'Noivos Premium', fabric: 'Linho', color: 'Creme', line: 'Premium', photoUrl: '/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.16%20(2).jpeg', rentalPriceCents: 50000, salePriceCents: 209000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }] },
  { name: 'Terno Bege Classico', category: 'Terno', collection: 'Classica', fabric: 'Linho', color: 'Bege', line: 'Padronizada', photoUrl: '/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.16%20(1).jpeg', rentalPriceCents: 47000, salePriceCents: 195000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }] },
  { name: 'Terno Off White', category: 'Terno', collection: 'Noivos Premium', fabric: 'Linho', color: 'Off white', line: 'Premium', photoUrl: '/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.15.jpeg', rentalPriceCents: 52000, salePriceCents: 219000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }] },
  { name: 'Conjunto Padrinho Azul Royal', category: 'Terno', collection: 'Noivos Premium', fabric: 'Poliester', color: 'Azul royal', line: 'Padronizada', photoUrl: '/produtos/conjunto-padrinho-royal.jpg', rentalPriceCents: 42000, salePriceCents: 175000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 2 }, { size: 'GG', quantity: 1 }] },
  { name: 'Camisa Social Verde', category: 'Camisa', collection: 'Classica', fabric: 'Algodao', color: 'Verde', line: 'Padronizada', photoUrl: '/produtos/camisa-social-verde.webp', rentalPriceCents: 8000, salePriceCents: 29900, variants: [{ size: 'P', quantity: 2 }, { size: 'M', quantity: 3 }, { size: 'G', quantity: 3 }, { size: 'GG', quantity: 2 }] },
  { name: 'Sapato Social Verniz', category: 'Sapato', collection: 'Black Tie', fabric: 'Couro', color: 'Preto', line: 'Premium', photoUrl: '/produtos/sapato-social-verniz.webp', rentalPriceCents: 12000, salePriceCents: 49900, variants: [{ size: '38', quantity: 1 }, { size: '39', quantity: 1 }, { size: '40', quantity: 2 }, { size: '41', quantity: 2 }, { size: '42', quantity: 2 }, { size: '43', quantity: 1 }, { size: '44', quantity: 1 }] },
  { name: 'Terno Palazzo Classic', category: 'Terno', collection: 'Classica', fabric: 'La Fria', color: 'Cinza xadrez', line: 'Premium', photoUrl: '/produtos/terno-palazzo-classic.jpg', rentalPriceCents: 49000, salePriceCents: 199000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }] },
  { name: 'Terno Cinza Oxford', category: 'Terno', collection: 'Classica', fabric: 'La Fria', color: 'Cinza claro', line: 'Padronizada', photoUrl: '/produtos/terno-cinza-oxford.webp', rentalPriceCents: 44000, salePriceCents: 185000, variants: [{ size: 'P', quantity: 1 }, { size: 'M', quantity: 2 }, { size: 'G', quantity: 1 }] },
];

try {
  const catalogOnly = process.argv.includes('--catalog-only');
  const profiles = catalogOnly ? [] : await db.profile.findMany({ orderBy: { createdAt: 'asc' } });
  if (!profiles.length && !catalogOnly) {
    throw new Error('Nenhum perfil cadastrado. Crie uma conta pelo app, confirme o e-mail, faça login e rode o seed novamente.');
  }
  const client = profiles.find((profile) => profile.role === 'CLIENT') ?? profiles[0];
  const catalog = new Map();

  for (const { variants, ...data } of products) {
    const old = await db.product.findFirst({ where: { name: data.name }, select: { id: true } });
    const product = old
      ? await db.product.update({ where: { id: old.id }, data })
      : await db.product.create({ data });
    for (const variant of variants) {
      await db.variant.upsert({
        where: { productId_size: { productId: product.id, size: variant.size } },
        create: { ...variant, productId: product.id },
        update: { quantity: variant.quantity },
      });
    }
    catalog.set(data.name, await db.product.findUnique({ where: { id: product.id }, include: { variants: true } }));
  }

  if (!catalogOnly && client) {
  // Demo requests are tied to an actual Supabase profile; reruns update by protocol.
  const featured = catalog.get('Terno Casamento Marfim');
  const featuredVariant = featured.variants.find((variant) => variant.size === 'M');
  const demoOrders = [
    { protocol: 'AR-SEED0000000001', status: 'NEW', type: 'RENTAL', startDate: 45, endDate: 47, note: 'Pedido demonstrativo novo.' },
    { protocol: 'AR-SEED0000000002', status: 'UNDER_REVIEW', type: 'SALE', startDate: null, endDate: null, note: 'Pedido demonstrativo em análise.' },
    { protocol: 'AR-SEED0000000003', status: 'REJECTED', type: 'RENTAL', startDate: 60, endDate: 61, note: 'Pedido demonstrativo recusado.' },
  ];
  for (const sample of demoOrders) {
    const data = {
      profileId: client.id, variantId: featuredVariant.id, type: sample.type, status: sample.status,
      startDate: sample.startDate === null ? null : dayOffset(sample.startDate),
      endDate: sample.endDate === null ? null : dayOffset(sample.endDate),
      quotedPriceCents: sample.type === 'SALE' ? featured.salePriceCents : featured.rentalPriceCents,
      customerName: client.name, customerEmail: client.email, customerPhone: client.phone,
      customerDocument: client.document, notes: `${marker} ${sample.note}`,
      rejectionReason: sample.status === 'REJECTED' ? 'Indisponibilidade demonstrativa.' : null,
    };
    const old = await db.order.findUnique({ where: { protocol: sample.protocol }, select: { id: true } });
    const order = old
      ? await db.order.update({ where: { id: old.id }, data })
      : await db.order.create({ data: { ...data, protocol: sample.protocol } });
    const historyNote = `${marker} Estado: ${sample.status}.`;
    if (!(await db.orderHistory.findFirst({ where: { orderId: order.id, note: historyNote } }))) {
      await db.orderHistory.create({ data: { orderId: order.id, status: sample.status, note: historyNote } });
    }
  }

  const rentalProduct = catalog.get('Smoking Black Tie');
  const rentalVariant = rentalProduct.variants.find((variant) => variant.size === 'G');
  const rentalMarker = `${marker} locação confirmada`;
  const rentalData = {
    profileId: client.id, variantId: rentalVariant.id, type: 'RENTAL', status: 'CONFIRMED',
    priceCents: rentalProduct.rentalPriceCents, startDate: dayOffset(75),
    endDate: dayOffset(77), confirmedAt: new Date(), damageNotes: rentalMarker,
  };
  const oldRental = await db.transaction.findFirst({ where: { profileId: client.id, damageNotes: rentalMarker }, select: { id: true } });
  const rental = oldRental
    ? await db.transaction.update({ where: { id: oldRental.id }, data: rentalData })
    : await db.transaction.create({ data: rentalData });
  await db.payment.upsert({
    where: { transactionId: rental.id },
    create: { transactionId: rental.id, amountCents: rental.priceCents, simulated: true },
    update: { amountCents: rental.priceCents },
  });

  const tie = catalog.get('Gravata Seda Bordô');
  const draftMarker = `${marker} rascunho`;
  const draftData = { profileId: client.id, variantId: tie.variants[0].id, type: 'SALE', status: 'DRAFT', priceCents: tie.salePriceCents, startDate: null, endDate: null, damageNotes: draftMarker };
  const oldDraft = await db.transaction.findFirst({ where: { profileId: client.id, damageNotes: draftMarker }, select: { id: true } });
  if (oldDraft) await db.transaction.update({ where: { id: oldDraft.id }, data: draftData });
  else await db.transaction.create({ data: draftData });

  console.log(`${products.length} produtos, ${demoOrders.length} pedidos, histórico e 2 transações de demonstração processados para ${client.email}.`);
  } else if (catalogOnly) {
    console.log('Modo catálogo: pedidos e transações não foram alterados.');
  }
  console.log(`${products.length} produtos processados no catálogo.`);
} finally {
  await db.$disconnect();
}
