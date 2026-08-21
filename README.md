# Bot Almaz

Automação 100% em cima do Playwright:
1. Login no Gamma (formulário web comum).
2. O app RemoteApp (UAU XT) é acessado no modo **HTML5**, que roda dentro
   de um `<canvas>` (`#JWTS_myCanvas`) na própria página — sem diálogo
   nativo do Chrome nem processo desktop separado.
3. Como o conteúdo do canvas é só uma imagem (stream), a interação com o
   UAU XT é feita por **clique em coordenada fixa** dentro do canvas,
   seguido de digitação via teclado (`page.keyboard.type`).

## Como rodar

```bash
npm install
npx playwright install chromium   # baixa o navegador que o Playwright usa
cp .env.example .env              # se ainda não existir; já veio preenchido pra você
npm start
```

## Variáveis de ambiente (`.env`)

| Variável | O que é |
|---|---|
| `GAMMA_URL` | URL do portal Gamma |
| `GAMMA_USER` / `GAMMA_PASSWORD` | Login do Gamma (formulário web) |
| `UAU_USER` / `UAU_PASSWORD` | Login do UAU XT (dentro do canvas) |

## Estrutura

```
bot-almaz/
├── src/
│   ├── browser.js   → Playwright: login no Gamma
│   ├── uau.js        → Playwright: cliques por coordenada no canvas do UAU XT
│   └── index.js      → orquestra os dois em sequência
├── assets/icons/     → prints de referência (não usados mais pelo código;
│                        mantidos como documentação visual das telas)
├── .env
├── .env.example
├── package.json
└── README.md
```

## Como as coordenadas do canvas foram descobertas

Gravado com `npx playwright codegen <url>`, clicando manualmente no fluxo
completo dentro do canvas. Como o canvas não é DOM, o codegen só grava a
posição X/Y do clique, não captura a digitação de texto — por isso o
texto que cada clique deve digitar depois foi anotado manualmente e vive
como comentário em `src/uau.js`.

**Importante:** essas coordenadas só continuam válidas enquanto o
viewport do navegador for o mesmo usado na gravação (`1280x720`, fixado
em `browser.js`). Se um dia o layout do UAU XT mudar ou o viewport for
alterado, as coordenadas em `uau.js` precisam ser regravadas.

## Limitações conhecidas / decisões já tomadas, não reabrir

- **Rodar em servidor**: fase futura, não resolver agora.
- **Timings fixos** (`wait(...)` em `uau.js`, 25s/30s/5s): são estimativas
  do usuário observando o app real, não medições precisas. Se o bot
  falhar por timing, considerar aumentar o tempo fixo daquele passo
  específico (não dá pra trocar por "espera de elemento" porque o
  conteúdo é um canvas/imagem, sem DOM pra esperar).
- **nut.js foi removido do projeto** (branch de decisão fechada): a
  primeira versão usava `nut.js` + reconhecimento de imagem (OpenCV) pra
  lidar com um diálogo nativo do Chrome que aparecia no modo "RemoteApp".
  Descobrimos que o modo **HTML5** (que já vem marcado por padrão no
  Gamma) evita esse diálogo inteiramente e renderiza tudo num canvas
  dentro da própria página — então a automação inteira roda em cima do
  Playwright, sem depender de automação nativa do SO. Isso também
  elimina a exigência de Node ≤ 20 que o `opencv4nodejs` impunha.
- **Credenciais**: estão no `.env`, que já está no `.gitignore`. Nunca
  suba esse arquivo pra um repositório Git público ou compartilhado.

## Próximos passos (fora do escopo inicial)

O usuário mencionou que tem "muito mais coisa" — quando estiver pronto
pra detalhar, dá pra ir encaixando como novos passos dentro de
`runUauXtFlow()` em `src/uau.js`.
