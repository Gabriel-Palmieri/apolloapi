import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { Test } from '@nestjs/testing';
import { ProductsController } from '../dist/modules/products/products.controller.js';
import { ProductsService } from '../dist/modules/products/products.service.js';
import { OrdersController } from '../dist/modules/orders/orders.controller.js';
import { OrdersService } from '../dist/modules/orders/orders.service.js';
import { TransactionsController } from '../dist/modules/transactions/transactions.controller.js';
import { TransactionsService } from '../dist/modules/transactions/transactions.service.js';
import { AuthController } from '../dist/modules/auth/auth.controller.js';
import { ProfilesController } from '../dist/modules/auth/profiles.controller.js';
import { AuthService } from '../dist/modules/auth/auth.service.js';
import { VirtualFittingController } from '../dist/modules/virtual-fitting/virtual-fitting.controller.js';
import { VirtualFittingService } from '../dist/modules/virtual-fitting/virtual-fitting.service.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';
import { createOpenApi } from '../dist/common/config/openapi.js';
const module = await Test.createTestingModule({
  controllers: [
    ProductsController,
    OrdersController,
    TransactionsController,
    AuthController,
    ProfilesController,
    VirtualFittingController,
  ],
  providers: [
    ProductsService,
    OrdersService,
    TransactionsService,
    AuthService,
    PrismaService,
    VirtualFittingService,
  ].map((provide) => ({ provide, useValue: {} })),
}).compile();
const app = module.createNestApplication();
app.setGlobalPrefix('api');
try {
  const document = createOpenApi(app);
  if (!document.components.schemas.CreateProductDto?.properties?.variants)
    throw new Error('DTO metadata missing. Run npm run build first.');
  if (!document.paths['/api/transactions/{id}/checkout'])
    throw new Error('Checkout contract missing.');
  await writeFile('openapi.json', JSON.stringify(document, null, 2) + '\n');
  console.log(
    'OpenAPI exportado: ' + Object.keys(document.paths).length + ' rotas.',
  );
} finally {
  await app.close();
}
