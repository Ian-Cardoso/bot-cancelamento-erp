# Bot Almaz

Automação em cima do Playwright, processando um lote de cotas por execução:
1. Lê a planilha do SharePoint (via Microsoft Graph API) e filtra as
   linhas com `Status = Normal` — cada uma tem `empresa`, `obra` e
   `num_ven` (coluna "Venda" na planilha).
2. Login no Gamma + UAU XT feito **uma única vez** (`loginUau()` em
   `src/uau.js`) — o UAU não pode ser deslogado no meio do lote sem
   perder o estado, então a mesma sessão é reaproveitada pra todas as
   cotas.
3. Para cada linha pendente, em sequência:
   - Autentica na API REST do UAU e busca as parcelas recebidas daquela
     venda, calculando `valor_pago` (regra de negócio em `src/uauApi.js`).
   - Roda `processarCota(page, { obra, numVenda, valorPago })` — clique em
     coordenada fixa dentro do canvas (`#JWTS_myCanvas`), seguido de
     digitação via teclado (`page.keyboard.type`), incluindo o
     `valor_pago` calculado.
   - Grava `Status = Cancelado` de volta na planilha só depois do
     `processarCota` terminar sem erro.
   - Se uma cota falhar, o erro é logado e o loop segue pra próxima —
     uma cota travada não derruba o lote inteiro.

## Como rodar

```bash
npm install
npx playwright install chromium   # baixa o navegador que o Playwright usa
cp .env.example .env              # se ainda não existir; já veio preenchido pra você
npm run preview                   # conferir quais cotas seriam canceladas e por qual valor, sem tocar no UAU
npm start
```

## Variáveis de ambiente (`.env`)

| Variável | O que é |
|---|---|
| `GAMMA_URL` | URL do portal Gamma |
| `GAMMA_USER` / `GAMMA_PASSWORD` | Login do Gamma (formulário web) |
| `UAU_USER` / `UAU_PASSWORD` | Login do UAU XT (dentro do canvas) |
| `SP_TENANT_ID` / `SP_CLIENT_ID` / `SP_CLIENT_SECRET` | App Registration no Azure AD (permissão de aplicativo `Sites.Read.All` ou `Files.Read.All`, com consentimento de admin) usado pra autenticar no Microsoft Graph |
| `SP_FILE_SHARE_URL` | Link "Copiar link" da planilha no SharePoint (o próprio `https://.../doc.aspx?sourcedoc={...}` funciona) — resolvido via API `/shares` do Graph |
| `SP_SHEET_NAME` | Nome da aba da planilha que tem as colunas `Empresa`, `Obra`, `Venda`, `Status` |
| `UAU_API_BASE_URL` | Base da API REST do UAU (`.../uauAPI/api/v1`) |
| `UAU_API_INTEGRATION_TOKEN` | Valor fixo do header `X-INTEGRATION-Authorization` |
| `UAU_API_LOGIN` / `UAU_API_SENHA` | Credenciais do `POST /Autenticador/AutenticarUsuario` |

## Estrutura

```
bot-almaz/
├── src/
│   ├── sharepoint.js → Microsoft Graph API: lê a planilha e grava o Status de volta
│   ├── uauApi.js      → API REST do UAU: autentica e calcula valor_pago
│   ├── browser.js     → Playwright: login no Gamma
│   ├── uau.js          → Playwright: loginUau() (uma vez) + processarCota() (por linha)
│   └── index.js        → orquestra tudo: lê planilha → loga → loop de cotas
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

**Ponto de reinício entre cotas:** depois que `processarCota()` termina
uma cota (último clique em `(1021, 12)`), o UAU volta pro mesmo estado de
tela que existia logo após `clickCanvas(page, 96, 262)` em `loginUau()`
— por isso `processarCota()` pode ser chamado de novo direto, começando
em `clickCanvas(page, 137, 108)`, sem precisar relogar. Se esse
comportamento mudar (ex: layout do UAU for alterado), esse ponto de
corte entre `loginUau()` e `processarCota()` precisa ser revalidado.

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

## Regra de negócio (`src/uauApi.js`)

`BuscarParcelasRecebidas` retorna `[{ Recebidas: [...] }]` (serialização
de DataSet do .NET) — o array de parcelas de verdade é `Recebidas`, cujo
item `[0]` é uma linha de schema (tipo `"System.Decimal, mscorlib, ..."`)
e deve ser descartado. Para os itens restantes (`calcularValorFinalDeParcelas()`):

1. **`valor_pago`**: soma `ValorConf_Rec + VlCorrecaoConf_Rec` de
   **todas** as parcelas (o cliente pode ter pago várias) → `valorTotal`,
   só depois divide por 2 → `valorFinal` (= `valor_pago` usado no canvas).
2. **`jurosMulta`**: soma `VlJurosParcConf_Rec + VlMulta_Rec` de todas as
   parcelas → `jurosMultaTotal` (sem dividir por 2) — vai no campo "Juros
   e multa" do canvas.

## Próximos passos (fora do escopo inicial)

- O usuário mencionou que tem "muito mais coisa" — quando estiver pronto
  pra detalhar, dá pra ir encaixando como novos passos dentro de
  `processarCota()` em `src/uau.js`.
