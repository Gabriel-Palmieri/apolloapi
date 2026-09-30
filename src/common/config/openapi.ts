import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { addResponseSchemas } from './response-schemas.js';

const previousMethodNames: Record<string, Record<string, string>> = {
  ProductsController: {
    read: 'list',
    readIncludingInactive: 'all',
    readOne: 'one',
    readAvailability: 'availability',
  },
  OrdersController: { read: 'list', readOne: 'one' },
  TransactionsController: {
    read: 'list',
    readConflicts: 'conflicts',
    readOne: 'one',
  },
  AuthController: {
    requestPasswordReset: 'recover',
    resetPassword: 'reset',
    readProfile: 'me',
    updateProfile: 'update',
  },
  ProfilesController: { read: 'list' },
};

export function createOpenApi(app: INestApplication) {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Apollo Rigor API')
      .setVersion('1.0')
      .setDescription(
        'Vendas e locações avulsas. Valores em centavos; datas YYYY-MM-DD. Checkout exclusivamente simulado. Auth intermediado pelo NestJS/Supabase.',
      )
      .addBearerAuth()
      .build(),
    {
      operationIdFactory: (controller, method) =>
        `${controller}_${previousMethodNames[controller]?.[method] ?? method}`,
    },
  );
  for (const path of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const operation = path?.[method];
      if (!operation) continue;
      operation.responses ??= {};
      for (const [code, description] of Object.entries({
        400: 'Entrada inválida',
        401: 'Sessão ausente ou inválida',
        403: 'Sem permissão',
        404: 'Recurso não encontrado',
        409: 'Estado ou estoque incompatível',
        429: 'Limite de requisições',
      }))
        operation.responses[code] ??= { description };
    }
  }
  addResponseSchemas(document);
  return document;
}
