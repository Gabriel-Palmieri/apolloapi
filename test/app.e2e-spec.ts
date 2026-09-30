import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { ProductsController } from '../src/modules/products/products.controller.js';
import { ProductsService } from '../src/modules/products/products.service.js';
import { TransactionsController } from '../src/modules/transactions/transactions.controller.js';
import { TransactionsService } from '../src/modules/transactions/transactions.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import { AuthGuard } from '../src/common/guards/auth.guard.js';
import { configureApp } from '../src/common/config/configure-app.js';

describe('HTTP: validação e permissões', () => {
  let app: INestApplication;
  const create = vi.fn().mockResolvedValue({ id: 'created' });
  const confirm = vi.fn().mockResolvedValue({ status: 'CONFIRMED' });
  const id = '11111111-1111-4111-8111-111111111111';
  const product = {
    name: 'Terno',
    category: 'Terno',
    rentalPriceCents: 10000,
    salePriceCents: 50000,
    variants: [{ size: 'M', quantity: 1 }],
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProductsController, TransactionsController, AuthController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            FRONTEND_URL: 'http://localhost:5173',
          }),
        },
        { provide: ProductsService, useValue: { create, read: () => [] } },
        { provide: TransactionsService, useValue: { confirm } },
        {
          provide: AuthService,
          useValue: {
            authenticate: async (token: string) => {
              if (!['admin', 'client'].includes(token))
                throw new UnauthorizedException();
              return { id, role: token === 'admin' ? 'ADMIN' : 'CLIENT' };
            },
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => app.close());
  it('catálogo público não exige sessão', () =>
    request(app.getHttpServer()).get('/api/products').expect(200).expect([]));
  it('criação exige sessão', () =>
    request(app.getHttpServer())
      .post('/api/products')
      .send(product)
      .expect(401));
  it('cliente não cria produto', () =>
    request(app.getHttpServer())
      .post('/api/products')
      .auth('client', { type: 'bearer' })
      .send(product)
      .expect(403));
  it('admin cria produto válido', () =>
    request(app.getHttpServer())
      .post('/api/products')
      .auth('admin', { type: 'bearer' })
      .send(product)
      .expect(201));
  it('recusa quantidade negativa', () =>
    request(app.getHttpServer())
      .post('/api/products')
      .auth('admin', { type: 'bearer' })
      .send({ ...product, variants: [{ size: 'M', quantity: -1 }] })
      .expect(400));
  it('recusa campos extras', () =>
    request(app.getHttpServer())
      .post('/api/products')
      .auth('admin', { type: 'bearer' })
      .send({ ...product, active: true })
      .expect(400));
  it('recusa null em campo opcional', () =>
    request(app.getHttpServer())
      .post('/api/products')
      .auth('admin', { type: 'bearer' })
      .send({ ...product, photoUrl: null })
      .expect(400));
  it('limita paginação', () =>
    request(app.getHttpServer()).get('/api/products?limit=9999').expect(400));
  it('cliente não confirma operação', () =>
    request(app.getHttpServer())
      .post('/api/transactions/' + id + '/confirm')
      .auth('client', { type: 'bearer' })
      .expect(403));
  it('admin confirma com identificador válido', () =>
    request(app.getHttpServer())
      .post('/api/transactions/' + id + '/confirm')
      .auth('admin', { type: 'bearer' })
      .expect(201));
  it('recusa identificador inválido', () =>
    request(app.getHttpServer())
      .post('/api/transactions/not-uuid/confirm')
      .auth('admin', { type: 'bearer' })
      .expect(400));
  it('perfil não permite alterar role', () =>
    request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth('client', { type: 'bearer' })
      .send({ role: 'ADMIN' })
      .expect(400));
});
