import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
const text = { type: 'string' } as const;
const uuid = { type: 'string', format: 'uuid' } as const;
const cents = { type: 'integer', minimum: 0, example: 10000 } as const;
const timestamp = {
  type: 'string',
  format: 'date-time',
  nullable: true,
} as const;
const day = {
  type: 'string',
  format: 'date',
  nullable: true,
  example: '2026-10-15',
} as const;
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });
const object = (properties: SchemaObject['properties']): SchemaObject => ({
  type: 'object',
  properties,
});
const list = (name: string): SchemaObject => ({
  type: 'array',
  items: ref(name),
});
export function addResponseSchemas(document: OpenAPIObject) {
  const schemas: Record<string, SchemaObject> = {
    Profile: object({
      id: uuid,
      authUserId: uuid,
      name: text,
      email: { type: 'string', format: 'email' },
      phone: { ...text, nullable: true },
      document: { ...text, nullable: true },
      role: { type: 'string', enum: ['CLIENT', 'ADMIN'] },
      createdAt: timestamp,
    }),
    Variant: object({
      id: uuid,
      productId: uuid,
      size: text,
      quantity: { type: 'integer', minimum: 0 },
    }),
    Product: object({
      id: uuid,
      name: text,
      category: text,
      collection: text,
      fabric: text,
      color: text,
      line: text,
      photoUrl: text,
      rentalPriceCents: cents,
      salePriceCents: cents,
      active: { type: 'boolean' },
      createdAt: timestamp,
      variants: list('Variant'),
    }),
    Payment: object({
      id: uuid,
      transactionId: uuid,
      amountCents: cents,
      simulated: { type: 'boolean', enum: [true] },
      status: {
        type: 'string',
        enum: ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'],
      },
      paidAt: timestamp,
      updatedAt: timestamp,
    }),
    Transaction: object({
      id: uuid,
      orderId: { ...uuid, nullable: true },
      profileId: uuid,
      variantId: uuid,
      type: { type: 'string', enum: ['SALE', 'RENTAL'] },
      status: {
        type: 'string',
        enum: ['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      },
      priceCents: cents,
      startDate: day,
      endDate: day,
      confirmedAt: timestamp,
      pickedUpAt: timestamp,
      completedAt: timestamp,
      cancelledAt: timestamp,
      damageNotes: { ...text, nullable: true },
      createdAt: timestamp,
      payment: { allOf: [ref('Payment')], nullable: true },
      variant: {
        allOf: [ref('Variant')],
        properties: { product: ref('Product') },
      },
    }),
    OrderHistory: object({
      id: uuid,
      orderId: uuid,
      status: text,
      note: text,
      createdAt: timestamp,
    }),
    Order: object({
      id: uuid,
      protocol: text,
      profileId: uuid,
      variantId: uuid,
      type: { type: 'string', enum: ['SALE', 'RENTAL'] },
      status: {
        type: 'string',
        enum: ['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      },
      startDate: day,
      endDate: day,
      quotedPriceCents: cents,
      notes: text,
      rejectionReason: { ...text, nullable: true },
      customerName: text,
      customerEmail: text,
      customerPhone: text,
      customerDocument: text,
      createdAt: timestamp,
      history: list('OrderHistory'),
      transaction: { allOf: [ref('Transaction')], nullable: true },
      variant: ref('Variant'),
    }),
    Session: object({
      accessToken: text,
      refreshToken: text,
      expiresAt: { type: 'integer' },
      expiresIn: { type: 'integer' },
      tokenType: { type: 'string', enum: ['Bearer'] },
      user: ref('Profile'),
    }),
    Message: object({ message: text }),
    Availability: object({
      quantity: { type: 'integer' },
      reserved: { type: 'integer' },
      available: { type: 'integer' },
      hasConflict: { type: 'boolean' },
    }),
    ConflictReport: object({
      overdue: { type: 'array', items: uuid },
      conflicts: {
        type: 'array',
        items: object({
          transactionId: uuid,
          overdueTransactionIds: { type: 'array', items: uuid },
        }),
      },
    }),
  };
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...schemas };
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const operation = item?.[method];
      if (!operation) continue;
      let name = 'Message';
      let array = false;
      if (path.includes('/products')) {
        name = path.endsWith('/availability') ? 'Availability' : 'Product';
        array =
          method === 'get' &&
          (path.endsWith('/products') || path.endsWith('/admin/all'));
      }
      if (path.includes('/orders')) {
        name = 'Order';
        array = method === 'get' && path.endsWith('/orders');
      }
      if (path.includes('/transactions')) {
        name = path.endsWith('/checkout')
          ? 'Payment'
          : path.endsWith('/conflicts')
            ? 'ConflictReport'
            : 'Transaction';
        array = method === 'get' && path.endsWith('/transactions');
      }
      if (path.endsWith('/auth/me')) name = 'Profile';
      if (path.endsWith('/profiles')) {
        name = 'Profile';
        array = true;
      }
      if (path.endsWith('/auth/login') || path.endsWith('/auth/refresh'))
        name = 'Session';
      const schema = path.endsWith('/auth/register')
        ? object({
            message: text,
            session: { allOf: [ref('Session')], nullable: true },
          })
        : array
          ? list(name)
          : ref(name);
      const code = method === 'post' ? '201' : '200';
      operation.responses[code] = {
        description: 'Operação concluída',
        content: { 'application/json': { schema } },
      };
      if (path.endsWith('/health'))
        operation.responses[code] = {
          description: 'API ativa',
          content: { 'text/plain': { schema: { type: 'string' } } },
        };
      if (
        (path.includes('/auth/') &&
          !path.endsWith('/auth/me') &&
          !path.endsWith('/logout') &&
          !path.endsWith('/reset-password')) ||
        (method === 'get' &&
          path.includes('/products') &&
          !path.endsWith('/admin/all')) ||
        path.endsWith('/health')
      )
        operation.security = [];
    }
  }
}
