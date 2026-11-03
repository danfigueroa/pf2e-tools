# Serviços do cliente (`src/services/`)

Lado servidor de cada um: `api/CLAUDE.md`. Banco e canais: `supabase/CLAUDE.md`.

## Supabase no cliente (`supabase.ts`)

- Chave publicável + a sessão de quem entrou. **O navegador não escreve nada no banco**; entrar numa mesa é o servidor.
- O SDK é `import()` num chunk próprio: **nunca o importe estaticamente**.
- `listenMesaChannel` é o único jeito de ouvir um canal. A cada SUBSCRIBED (inclusive reconexão), releia o que pode ter perdido.
- Canal aberto no módulo e nunca fechado quando o StrictMode sai e entra no mesmo tópico em seguida (senão volta o canal
  que estava saindo e o aparelho para de ouvir) — ou feche com folga (o `mapLive` espera 3 s).

## Auth (`auth.ts`)

- Estado, `useRole`, `canEditSheet`, e o wrapper de `fetch` (`installApiAuth`) que põe o JWT e o `lang` em **todo** `/api/*`.
- Entrar, sair e resgatar convite recarregam a página. 403 de papel volta como `pf2e:forbidden` (aviso na tela); 401 relê o
  login. Sessão anônima antiga é descartada no boot. Sem Supabase: modo `local`, com todas as permissões.
- O `load()` adota o idioma da conta e recarrega uma vez (trava em `sessionStorage`).

## Estado compartilhado da mesa (`tableState.ts` + `components/useSharedState.ts`)

PV, slots, foco, pontos míticos, condições… são **da mesa, não do navegador**. Ler é de qualquer membro; escrever, do dono e do GM.
- **Uma linha por fatia** (`hp`, `slots`, `conditions`, …, `pet:<kind>:<slug>#<i>`): dois jogadores editando fatias
  diferentes não se atropelam; na mesma fatia a última escrita vence. **Campo novo = `FIELD_RE` + migration do CHECK**,
  senão o POST volta "Campo inválido" e o estado fica só no `localStorage`.
- Chave entregue aos hooks: `"<slug>/<campo>"` (o serviço corta no primeiro `/`). Slug = nome normalizado (`charId.ts`),
  sem nível (level-up não pode orfanar o estado). `noCharKey` (slug vazio) não vai à rede.
- Os hooks de cima (`useHpTracker`, `useSpellSlots`, `useConditions`…) não sabem da rede: a UI só vê a API deles.
- Escrita com debounce de 600 ms e dedupe de in-flight; o `localStorage` é cache (primeira pintura e offline).
- **Tempo real** (`startRealtime`/`applyRemote`), aplicado como snapshot parcial, com três travas obrigatórias: nunca
  atropela escrita local na fila (`pending`), ignora o eco (`by` = esta sessão), descarta o mais velho que `lastSeen`. Releia
  os personagens abertos a cada SUBSCRIBED e ao voltar de mais de 10 s com a aba oculta; a releitura sobrepõe o que está na fila.
- Sem canal: sob demanda (abrir e "Atualizar").
- `subscribeField`: duas instâncias da mesma fatia neste aparelho se enxergam (a poção no Inventário aparece no `HpTracker`).
- `onStateChange` avisa toda fatia mudada (daqui ou de fora), antes da comparação com o cache — o mapa usa.
- **`maxHp` nunca entra nas deps da carga**: `null` = "ninguém mexeu" e o clamp é no render.
- **Reset é coletivo** ("Novo dia" zera a mesa inteira): todo reset novo pede confirmação.
- Ficha de outra pessoa: `useSharedState` não escreve nada (nem a subida do cache antigo).
- A migração do `localStorage` antigo (`legacy`, `legacyCharKey`/`legacyPetKey`) só roda na mesa legada.

## Feed de rolagens (`rolls.ts`, `src/dice/tableRoll.ts`, `components/RollFeed.tsx`)

- A rolagem chega **sorteada** (`TableRoll`) com o memorial; quem recebe só apresenta. A soma tem de fechar (`d20 + mod =
  total`; dados + fixo = total da parcela) nos **dois** sanitizadores, senão não vai à mesa. Campo novo no `TableRoll` = os
  dois sanitizadores + caso no `check-rolls`. Tetos atuais: `sub` 160, `note` 500, 8 parcelas, `rays` até 6, 8 KB.
- `RollFeedLayer` é montado **uma vez** no `MainLayout`. Cada id aparece uma vez por aparelho; o que já estava no feed ao
  abrir conta como visto, menos o que saiu deste aparelho (`isOwnRoll`).
- Com o canal aberto não há poll. Sem canal: 1,5 s com a aba visível, rajada de 1 s por 5 s depois de rolar, nada oculta.
  `onFeedActivity` avisa quem quer saber que a mesa rolou algo (mapa, histórico).
- O cartão fica 30 s e fecha **só pelo ×** (cartão inteiro clicável fechava com toque perdido). `zIndex` 1250.

## Regra compartilhada com a mesa (`tableShare.ts`, `components/SharedRuleLayer.tsx`, `SharedRuleCard.tsx`)

- Ícone no drawer de descrição manda a **referência** (tipo, nome, rank, CD/ataque), nunca o texto. Anda no feed
  (`share-add`, tabela `shares`, evento `share`, mesmo `rev`). Sem histórico na interface (decisão do usuário).
- Antes de buscar na API, o cartão lê os pacotes de quem compartilhou (`share.slug`: estático e `readSheetDescriptions`,
  só GET), teto de 4 s, o primeiro que trouxer vence.
- O cartão desenha o mesmo `DescriptionContent` do drawer, é `React.lazy` e é baixado ocioso (`prefetchCard`). **Não importe
  `DescriptionContent` estaticamente fora da ficha.** Um por vez, fica até o ×; quem compartilhou não vê o próprio.
- O botão só aparece depois de a descrição carregar. O tipo `handout` é o "Mostrar à mesa" do diário/wiki (`HandoutCard`,
  lê `?reveal=`); só o servidor o cria.

## Descrições (`descriptions.ts`)

- Cache em memória na frente do `localStorage` (sem ela, cada render refazia `JSON.parse`). Chave em português
  `pf2e:<versão>:<tipo>:<nome>`; em inglês `pf2e:<versão>:en:<tipo>:<nome>` (não mude a do português).
- `seedEntries` põe os pacotes no mesmo cache que as abas e o drawer leem. Abrir a ficha publicada chama
  `loadSheetDescriptionsBoth` (rede de segurança: completa os dois idiomas).
- `readRaw` descarta entrada de nome incompatível (`namesCompatible`) de qualquer fonte, sem subir a versão.
- Quem desenha a partir do cache precisa **assiná-lo** (`useDescriptionCacheVersion`) — seções `memo` não repintam sozinhas.
- **Correções de tradução** (`translationFixes.ts`): camada por (tipo, nome) aplicada **na leitura** (`applyFix` em `readCache`
  e no retorno das buscas), porque o texto chega por quatro caminhos. `applyFix` lembra o original (`originals`) para o
  desfazer devolver a tradução. Lista em `pf2e:fixes:v1`, relida uma vez por sessão e a cada reconexão; a releitura troca a
  lista local pela do servidor (só sobrevive o que chegou durante o pedido). Em inglês, `applyFix` devolve o original.

## Presença (`presence.ts`, `components/PresenceList.tsx`)

- Presence do Realtime em `mesa:<mesa>:presence`; chave = a conta (duas abas = uma linha). Anuncia `who`, a ficha aberta
  (`announceSheet`) e a página. Nome opcional do aparelho (`pf2e:device-name`, global). É presença, não estado: nada vai ao banco.
- A lista é `React.lazy` (`PresenceSlot`), baixada só quando há alguém.

## Outros

- `mesa.ts`: `currentMesa` (constante do boot; `main.tsx` importa antes de tudo), `mesaKey`, `switchMesa`.
- `images.ts`: `ImageFolder` define a vida da imagem (ver `src/modules/battle-map/CLAUDE.md`); `shrinkImage` reduz antes de
  subir (Safari devolve PNG ao pedir WebP → cai para JPEG; `createImageBitmap` com fallback para `<img>` + `decode()`). Erro
  de envio sempre com motivo (`ImageError`/`imageErrorText`). Sem Supabase, IndexedDB (`idb:<chave>`).
- `gifts.ts`, `notes.ts`, `sheets.ts`, `sheetPreparation.ts`, `sheetNotices.ts`: ver `src/modules/character-viewer/CLAUDE.md`.
- `notifications.ts`, `combatStatus.ts`: ver `src/layouts/CLAUDE.md`. `encounters.ts`: Iniciativa. `maps.ts`, `mapLive.ts`: Mapa.
