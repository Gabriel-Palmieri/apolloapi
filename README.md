# Apollo Rigor — API

Backend NestJS + Prisma 7 + PostgreSQL/Supabase para vendas e locações avulsas.
Supabase Auth cuida das credenciais; NestJS intermedia as sessões e aplica permissões.
Checkout é **simulado**: nenhuma cobrança ou integração financeira é realizada.

## Preparação

Use Node.js **22.22.3 ou superior compatível com NestJS 12** (o ambiente local 22.20 executou os checks, mas o CLI reporta requisito superior).

1. Instale dependências: `npm ci`.
2. Configure `.env` usando `.env.example`.
3. Gere o cliente e compile: `npm run build`.
4. Aplique migrations: `npm run db:deploy`.
5. Execute: `npm run start:dev`.

No Windows/PowerShell, use `npm.cmd` se a política de execução bloquear `npm.ps1`.

A aplicação valida variáveis ao iniciar, sem imprimir os valores:

- `DATABASE_URL`: conexão da aplicação; `DIRECT_URL`: Prisma CLI.
- Para este setup, ambas podem usar **Session pooler, porta 5432**, disponível em Supabase → Connect.
- Encode a senha na URI; não use URL HTTP ou chave de API como conexão PostgreSQL.
- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: projeto e chave publicável do Auth.
- `FRONTEND_URL`: origem exata permitida pelo CORS, padrão do exemplo `http://localhost:5173`.
- `PORT`: 3000 por padrão.

Não é necessária chave `service_role` nem JWT secret para os fluxos implementados.
O `.env` é ignorado pelo Git. A referência de configuração não contém credenciais.

## Supabase Auth

Habilite autenticação por e-mail/senha e confirmação de e-mail. Configure no painel:

- Site URL igual a `FRONTEND_URL`.
- Redirects permitidos: `FRONTEND_URL/auth/callback` e `FRONTEND_URL/auth/reset-password`.
- Configure envio de e-mails/SMTP se necessário para testar usuários fora das restrições do provedor de e-mail padrão.

O frontend em ../apolorigor está integrado aos endpoints de autenticação e trata os callbacks de confirmação/recuperação. A entrega de e-mails e os redirects do ambiente ainda precisam de homologação real.

Fluxo:

1. `POST /api/auth/register` com `name, email, password`.
2. Confirmar o e-mail pelo link do Supabase.
3. `POST /api/auth/login` com `email, password`.
4. Usar `Authorization: Bearer <accessToken>`.
5. Renovar por `POST /api/auth/refresh` com `refreshToken`; substituir os tokens armazenados pelo retorno.
6. Encerrar por `POST /api/auth/logout`.
7. Recuperação: `POST /api/auth/recover` com `email`; após o callback do link, enviar o access token recebido para `POST /api/auth/reset-password`, com `password`.

Cada chamada usa uma instância Supabase sem sessão persistida compartilhada. A API valida o token com `getUser`.
O perfil local é criado/reconciliado no primeiro login ou acesso autenticado. Falha de banco após cadastro não exige recriar a conta.

O logout revoga a renovação da sessão no Supabase e bloqueia o access token apresentado por digest até expirar. Outros access tokens já emitidos não são todos bloqueados localmente; o cliente deve descartar seus tokens. Não há armazenamento de senhas ou refresh tokens no banco comercial.

Para administrador: faça cadastro, confirme e entre ao menos uma vez; então:
`npm run admin:promote -- <authUserId>`
Esse script só promove um perfil existente. Cadastro e edição de perfil nunca aceitam role.

## API e contratos

- Base: `http://localhost:3000/api`
- Liveness: `GET /api/health`
- Swagger: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- IDs UUID; valores em **centavos inteiros**; datas operacionais `YYYY-MM-DD`; timestamps ISO UTC.
- Dia operacional calculado em `America/Sao_Paulo`.
- Listagens retornam arrays paginados: `?page=1&limit=20`, limite máximo 100.
- Campos desconhecidos e null em campos opcionais de DTO são recusados. Omitir campos opcionais.
- Erros: 400 entrada inválida; 401 sessão inválida; 403 papel insuficiente; 404 recurso ausente ou alheio; 409 estado/estoque incompatível; 429 excesso de requisições.
- Checkout também é permitido após conclusão da entrega/devolução para quitar uma simulação pendente.

| Rotas                                              | Acesso                | Comportamento                                  |
| -------------------------------------------------- | --------------------- | ---------------------------------------------- |
| GET /products, /products/:id                       | Público               | Apenas produtos ativos                         |
| GET /products/:id/variants/:variantId/availability | Público               | Exige startDate/endDate                        |
| POST /products, PATCH /products/:id                | Admin                 | Cadastro e edição de catálogo                  |
| DELETE /products/:id                               | Admin                 | Desativa; preserva histórico                   |
| GET /products/admin/all                            | Admin                 | Inclui inativos                                |
| GET /profiles                                      | Admin                 | Clientes cadastrados, para operação direta     |
| GET/PATCH /auth/me                                 | Autenticado           | Perfil próprio                                 |
| POST /orders                                       | Autenticado           | Solicitação de uma unidade                     |
| GET /orders, /orders/:id                           | Cliente dono ou admin | Pedido, histórico e transação vinculada        |
| POST /orders/:id/review, /approve, /reject         | Admin                 | Recusa exige reason                            |
| POST /transactions                                 | Admin                 | Rascunho direto para profileId existente       |
| GET /transactions, /transactions/:id               | Cliente dono ou admin | Operações próprias ou todas para admin         |
| PATCH /transactions/:id                            | Admin                 | Apenas rascunhos                               |
| POST /transactions/:id/confirm, /cancel            | Admin                 | Compromete/libera estoque                      |
| POST /transactions/:id/pickup, /return, /deliver   | Admin                 | Operação física; return aceita damageNotes     |
| POST /transactions/:id/checkout                    | Somente dono          | Pagamento integral fictício, sem valor no body |
| GET /transactions/conflicts                        | Admin                 | Atrasos e reservas em conflito                 |

Produtos aceitam categoria, coleção, tecido, cor e linha como texto, sem migrations para novo nome de coleção.
PATCH de variantes faz **upsert por tamanho**: variantes omitidas são preservadas. Renomear/remover tamanho não faz parte da primeira versão. Quantidade não pode ficar abaixo das reservas.

Exemplo de produto:

```json
{
  "name": "Terno Oxford",
  "category": "Terno",
  "rentalPriceCents": 25000,
  "salePriceCents": 90000,
  "variants": [{ "size": "M", "quantity": 2 }]
}
```

Exemplo de pedido:

```json
{
  "variantId": "<uuid>",
  "type": "RENTAL",
  "startDate": "2026-10-15",
  "endDate": "2026-10-17",
  "notes": "Locação avulsa"
}
```

Venda usa `type: SALE` e omite datas. Preço do pedido vem do catálogo no servidor.
O protocolo é `AR-` seguido de 16 caracteres hexadecimais; é uma referência legível, não uma credencial de acesso.

## Regras comerciais

### Provador virtual com Fal.ai

- Configure `FAL_KEY` no `.env` local e nas variáveis de ambiente do Render para habilitar a rota.
- `POST /api/virtual-fitting/:productId` recebe `photo`, `garment` e `consent=true` em `multipart/form-data`. As imagens devem ser JPG, PNG ou WebP e ter até 10 MB cada; limite de 3 gerações por minuto.
- A API valida que o produto está ativo e é um Terno, envia as duas imagens à Fal.ai e usa o FASHN v1.6. A chave permanece somente no servidor.
- O usuário precisa consentir antes do envio. Os uploads passam pelo armazenamento temporário público da Fal.ai, que informa que os links de upload ficam acessíveis por até uma hora. O front não persiste as imagens.
- A geração é cobrada pelo provedor; confira os valores atuais no [modelo FASHN v1.6](https://fal.ai/models/fal-ai/fashn/tryon/v1.6) antes de liberar o fluxo em produção.

### Solicitações de pacotes de casamento

- `POST /api/wedding-packages` recebe solicitação pública com casal, evento, contato, modelo de referência e até 30 participantes.
- `GET /api/wedding-packages` lista solicitações paginadas e exige perfil ADMIN.
- Solicitação salva em `WeddingPackage` e `WeddingPackageParticipant`; não cria contrato, reserva de estoque, transação ou pagamento.
- Execute `npm run db:deploy` para aplicar a migration antes de usar essas rotas.

- Pedido: NEW → UNDER_REVIEW → APPROVED/REJECTED; pode aprovar/recusar diretamente de NEW.
- Aprovação cria exatamente um DRAFT; repetir não duplica. Rascunho não reserva.
- Confirmação: RENTAL reserva por período; SALE baixa quantidade física.
- Administrador pode negociar o valor do rascunho. A confirmação fixa valor, variante e datas.
- Disponibilidade conta o **pico simultâneo**, com datas inclusivas.
- Venda e redução manual de estoque preservam todas as reservas futuras.
- Retirada só ocorre dentro do período contratado. Sem retirada, um período vencido não representa posse física; cancele e crie novo rascunho se precisar reagendar.
- Atraso após retirada bloqueia a unidade até devolver e aparece em /transactions/conflicts.
- Cancelamento antes de retirada/entrega libera reserva ou recompõe venda uma vez.
- Devolução conclui locação; entrega conclui venda; ações repetidas não duplicam efeitos.
- Pagamento PENDING → PAID é integral e simulado. Não bloqueia retirada/entrega.
- Cancelamento marca pagamento existente como CANCELLED ou REFUNDED. Rascunho cancelado não cria pagamento.
- Transações serializáveis com repetição limitada tratam concorrência. Após conflitos persistentes, a API retorna 409.
- Tabelas comerciais têm RLS sem políticas de acesso direto; o servidor usa a conexão PostgreSQL e verifica dono/papel em cada rota. Não expor a conexão do banco ao frontend.

Fora desta versão: contratação e acompanhamento individual de pacotes, portal do casamento conectado, ajustes de costura, sugestões de tamanho, pagamentos reais/parciais, devolução de venda após entrega, notificações e dashboard avançado. O recebimento de solicitações de pacotes e participantes já está disponível.

## Validação

```text
npm test
npm run test:e2e
npm run build
npm run lint
npm run db:validate
```

Integração PostgreSQL:

- Defina explicitamente `TEST_DATABASE_URL`; nunca há fallback automático para a conexão da aplicação.
- Execute `npm run build` e `npm run test:integration`.
- Os testes criam `apollo_test_<uuid>`, aplicam a migration nesse schema e removem somente esse schema ao final.
- Cobrem disputa pela última unidade, aprovação repetida, limites inclusivos, baixa de venda, cancelamento/checkout repetidos, devolução, atraso e acesso ao recurso alheio.

A integração Auth real depende da chave publicável e das configurações de e-mail/redirect do projeto. Testes HTTP usam o Auth substituído; não comprovam entrega de e-mail.

O frontend usa esta API em produção; respostas HTTP substitutas ficam restritas aos testes automatizados. A homologação com banco e serviços reais continua pendente.

## Dependências

A instalação auditada apontou avisos altos em dependências transitivas do Prisma CLI (`deepmerge-ts` e `mysql2`). Não foi aplicado `npm audit fix --force`, pois a solução sugerida fazia downgrade incompatível para Prisma 6. Esses avisos não foram removidos; acompanhar atualização compatível do Prisma. O driver utilizado pela aplicação é PostgreSQL.

## Contratos corrigidos em 06/10/2026

- Fotos de produto: URLs HTTPS ou imagens locais em /produtos/, incluindo subpastas de nomes simples (como feminino). Caminhos de travessia, esquemas incompatíveis e arquivos locais fora desse diretório são recusados.
- eventDate de solicitações de casamento: omitir para data a definir; quando informado, usar YYYY-MM-DD válido, hoje ou depois no dia comercial de São Paulo. null explícito, timestamps e dias inexistentes são recusados. Criação e listagem retornam eventDate em YYYY-MM-DD.
- Após npm run build, execute npm run test:contracts. Os testes usam o runner nativo do Node, verificam DTOs e HTTP do Nest com persistência substituída e não acessam banco ou serviços externos.

### Limpeza de campos opcionais do catálogo

Em PATCH /products/:id, collection, fabric, color, line e photoUrl aceitam null para remover o valor salvo. Omitir um campo preserva seu valor. Strings vazias continuam inválidas; os campos obrigatórios continuam recusando null. Na criação, os opcionais devem ser omitidos quando não preenchidos. Esta mudança deve ser implantada junto do frontend que envia null ao limpar o formulário.

O comando npm run test:contracts, após npm run build, verifica estes contratos sem usar banco real. Os testes de DTO/HTTP com dependências substituídas não comprovam a integração PostgreSQL.
### Relatório de conflitos — terceira etapa

GET /transactions/conflicts carrega as locações confirmadas com a quantidade da variante em uma única chamada findMany. As reservas são agrupadas por variante e avaliadas pela mesma função occupancy usada na disponibilidade. O relatório não faz mais uma busca de variante e de reservas para cada operação. Pagamentos e demais dados do produto não são carregados para esse cálculo.

Os testes de contrato verificam equivalência com StockService, limites inclusivos, atrasos, reservas sem retirada, capacidade e variantes independentes. Um cenário controlado com 1.200 reservas verifica uma única chamada de listagem, e falhas de leitura continuam propagadas como erro. Isso não mede quantidade de SQLs internos do Prisma nem latência de banco real. O cálculo ainda percorre as reservas de cada variante por intervalo; medições com volume real e otimizações adicionais de CPU permanecem possíveis.

### Paginação da gestão — quarta etapa

Novos endpoints preservam os arrays retornados pelas rotas anteriores:

| Endpoint | Acesso | Filtros |
| --- | --- | --- |
| GET /products/admin/page | Admin | page, limit, q (nome/cor/categoria), state (all/active/inactive) |
| GET /orders/page | Autenticado; cliente limitado aos próprios pedidos | page, limit, status (NEW/UNDER_REVIEW/APPROVED/REJECTED) |
| GET /transactions/page | Autenticado; cliente limitado às próprias operações | page, limit, q (modelo/cliente) |
| GET /wedding-packages/page | Admin | page, limit |
| GET /orders/summary | Autenticado; cliente limitado aos próprios pedidos | Sem filtros; contagens por status |

Rotas paginadas retornam items, total, page, pages e limit. Catálogo e pedidos incluem summary global, independente do filtro da página. Page e limit são inteiros positivos; limit vai até 100 (padrão 20), busca até 120 caracteres. Página além do fim é ajustada à última existente; lista vazia retorna página 1 de 1 e total 0. A ordenação por createdAt e id evita ambiguidade de datas iguais. Contagens e itens usam uma transação RepeatableRead. Pedidos/operacões mantêm profileId no escopo do cliente, inclusive contagens.

Implantar estes endpoints antes do frontend paginado. npm run test:contracts verifica rotas, validação e AuthGuard reais, com autenticação e persistência substituídas. Isso não comprova isolamento ou desempenho do PostgreSQL real. Dashboard, agenda e seletores ainda podem consumir listas completas via rotas anteriores; agregações específicas e medições com volume real continuam pendentes.
