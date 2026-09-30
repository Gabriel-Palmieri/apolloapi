# Provador Virtual — Iniciação Científica FIAP

MVP apresentado no evento **Next**: um estande de alfaiataria onde o cliente
tira uma foto, escolhe uma peça direto numa vitrine e recebe, em segundos,
uma imagem de si mesmo vestindo o look escolhido (gerada pela Fal.ai, com o
modelo FASHN v1.6), acompanhada de uma justificativa curta — um texto fixo,
já cadastrado em cada peça do estoque, sem depender de nenhuma IA para isso.

O único ponto de IA generativa do projeto é a geração da imagem em si.

Fluxo pensado para durar menos de 30 segundos por pessoa: **foto → escolha
da peça na vitrine → resultado**, sem formulário.

## Arquitetura

```
frontend/  → React + Vite + TailwindCSS (câmera, vitrine, resultado)
backend/   → Node.js + Express (orquestra o storage e a Fal.ai)
```

## Pré-requisitos

- **Node.js 20+** e npm instalados (`node -v` para conferir)
- Uma **chave de API da Fal.ai** → [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)
- Fotos reais das peças do estoque (paletós, blazers, camisas) — pode manter
  URLs externas (como as do Unsplash já usadas no mock) ou trocar por fotos
  salvas em `backend/public/pecas/`, com nomes batendo com o `estoque.json`

---

## 1. Instalação

Clone/abra o projeto e instale as dependências de cada parte separadamente:

```bash
# Backend
cd backend
npm install

# Frontend (em outro terminal, a partir da raiz do projeto)
cd frontend
npm install
```

---

## 2. Configuração do `.env`

### Backend — `backend/.env`

Copie o exemplo e preencha:

```bash
cd backend
cp .env.example .env
```

Edite `backend/.env` com a sua chave:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não (padrão `3001`) | Porta em que o backend sobe |
| `FRONTEND_ORIGIN` | Sim | URL do frontend, para liberar o CORS (ex: `http://localhost:5173`) |
| `FAL_KEY` | **Sim** | Chave da API da Fal.ai (usada pelo modelo FASHN v1.6 de virtual try-on) |
| `BACKEND_BASE_URL` | Sim | URL pública do próprio backend, usada para montar os links das fotos das peças quando elas são locais (ex: `http://localhost:3001`) |

Exemplo preenchido:

```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173

FAL_KEY=sua_chave_fal_aqui

BACKEND_BASE_URL=http://localhost:3001
```

### Frontend — `frontend/.env`

```bash
cd frontend
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | Não | URL do backend. Em dev, o proxy do Vite já resolve `/api`, então só é necessário se o front acessar o backend por outro domínio/IP (ex: no estande, via ngrok) |

---

## 3. Rodando o projeto localmente

Abra **dois terminais**.

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

Deve aparecer: `Backend do Provador Virtual rodando em http://localhost:3001`

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Deve aparecer algo como: `Local: http://localhost:5173/`

Abra `http://localhost:5173` no navegador (Chrome recomendado, para a câmera).

### Testando o backend sem o frontend

Primeiro confira o estoque disponível:

```bash
curl http://localhost:3001/api/estoque
```

Depois teste o try-on, usando um `id` retornado acima:

```bash
curl -F "foto=@caminho/para/foto-teste.jpg" \
     -F "id_peca=P001" \
     http://localhost:3001/api/provador
```

---

## 4. Expondo o estande na rede local (tablet/outro computador)

O acesso à câmera (`getUserMedia`) só funciona sem HTTPS em `localhost`. Se o
dispositivo que vai rodar no estande (tablet, notebook diferente) acessar a
aplicação por IP ou domínio, você precisa de HTTPS — é aí que entra o ngrok.

### Passo a passo com ngrok

1. **Instale o ngrok** (uma vez): [ngrok.com/download](https://ngrok.com/download), ou via
   ```bash
   npm install -g ngrok
   ```
2. **Crie uma conta gratuita** em [ngrok.com](https://ngrok.com) e configure o token:
   ```bash
   ngrok config add-authtoken SEU_TOKEN_AQUI
   ```
3. **Com o backend e o frontend já rodando** (`npm run dev` nos dois), abra um
   **terceiro terminal** e exponha o frontend (porta `5173`):
   ```bash
   ngrok http 5173
   ```
4. O ngrok vai mostrar uma URL pública HTTPS, algo como:
   ```
   Forwarding   https://a1b2-200-100-50-10.ngrok-free.app -> http://localhost:5173
   ```
   É esse link `https://...ngrok-free.app` que você abre no tablet ou outro
   computador da rede do estande.
5. **Atualize o CORS do backend** para aceitar essa URL: edite
   `backend/.env` e ajuste `FRONTEND_ORIGIN` para a URL do ngrok, depois
   reinicie o backend:
   ```env
   FRONTEND_ORIGIN=https://a1b2-200-100-50-10.ngrok-free.app
   ```

> **Dica para o dia do evento:** a URL gratuita do ngrok muda toda vez que
> você reinicia o túnel. Se possível, deixe o ngrok e os dois servidores
> rodando continuamente durante a apresentação para não precisar reconfigurar
> o `FRONTEND_ORIGIN` no meio do evento. Um plano `ngrok` pago permite fixar
> um subdomínio.

### Alternativa: expor só o frontend, backend continua local

Se o tablet e o computador com o backend estiverem na **mesma rede Wi-Fi**, às
vezes só o frontend precisa de HTTPS (para a câmera) — o backend pode
continuar sendo acessado pelo IP local da máquina (ex: `http://192.168.0.15:3001`),
desde que essa URL esteja em `VITE_API_URL` no `frontend/.env` e liberada em
`FRONTEND_ORIGIN` no backend.

---

## 5. Sobre o modelo de IA usado (FASHN v1.6, via Fal.ai)

O projeto usa o **FASHN v1.6**, rodando na Fal.ai (`fal-ai/fashn/tryon/v1.6`),
para gerar a imagem final. Foi escolhido depois de comparar as opções de
virtual try-on disponíveis hoje: ele preserva melhor estampas e detalhes da
peça, detecta sozinho a categoria da roupa (topo, calça, peça única) sem
precisar de máscara manual, e continua saindo do mesmo SDK e da mesma cobrança
por uso (por token/geração) da Fal.ai — então trocar de modelo no futuro é só
editar a string do endpoint em `falVton.service.js`, sem reescrever a
integração.

Se quiser comparar com outras opções antes do evento, vale reler o estudo
comparativo: [fal.ai/learn/tools/best-virtual-try-on-apis-2026](https://fal.ai/learn/tools/best-virtual-try-on-apis-2026).

---

## 6. Checklist antes de ir para o estande

- [ ] Fotos reais (ou URLs) de todas as peças em `estoque.json`
- [ ] `estoque.json` revisado, com a justificativa de cada peça já escrita
- [ ] Chave `FAL_KEY` testada com créditos suficientes
- [ ] Teste completo do fluxo em uma rede parecida com a do local do evento
- [ ] Túnel ngrok testado com o dispositivo real que será usado no estande
- [ ] Um "look" de exemplo pré-gerado como plano B, caso a internet do evento falhe

---

## Estrutura do projeto

```
provador-virtual/
├── backend/
│   ├── .env.example
│   ├── public/pecas/           # fotos locais das peças (opcional, hoje usamos URLs)
│   └── src/
│       ├── server.js
│       ├── config/env.js
│       ├── data/estoque.json   # inclui a justificativa fixa de cada peça
│       ├── routes/{provador,estoque}.routes.js
│       ├── controllers/{provador,estoque}.controller.js
│       ├── services/{estoque,falVton}.service.js
│       └── middlewares/{upload,errorHandler}.js
└── frontend/
    ├── .env.example
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        ├── components/{CameraCapture,VitrineDePecas,TelaProcessando,TelaResultado}.jsx
        └── services/api.js
```
