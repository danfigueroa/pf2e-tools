# Moldura do app (`src/layouts/`, componentes globais em `src/components/`)

## Navegação (`navigation.tsx`, `NAV_ITEMS`)

- **Uma lista só** alimenta a sidebar (seções JOGO / BASTIDORES DO GM / MESA), a barra de abas e a busca. Destino novo entra nela.
- `section: 'gm'` **não esconde** do jogador (o item vai para JOGO, como o Escalar Monstro); só do GM = `gmOnly: true` (o Diário
  de Campanha). Transformações é de JOGO para todos (decisão do usuário). `visibleNav` filtra.
- Os itens são `<Link>` de verdade (botão direito e Ctrl/⌘+clique). Não use `onClick` + `navigate`.

## Sidebar (`sidebar/Sidebar.tsx`)

- Cartão da mesa (nome do servidor, contas, sessão, avatares de presença → `PresenceList`), navegação com o selo "Rodada N"
  (`services/combatStatus.ts`), 3 últimas rolagens, perfil (com `LanguageToggle`, `ThemeToggle` e `TrophyLine`).
- Recolhe para um trilho de ícones (`pf2e:sidebar-collapsed`, do aparelho).
- **Filhos da coluna com `flexShrink: 0`**: sem isso, a coluna mais alta que a tela encolhia os itens e o cartão da mesa
  (`overflow: hidden`) sumia.
- Em `/mapa` o `MainLayout` some com sidebar, cabeçalho, abas e padding; o botão "Menu" do mapa abre a gaveta (`openMenu`
  via `<Outlet context>`, `useLayoutMenu`).

## Celular (`MobileChrome.tsx`)

- Cabeçalho (símbolo, mesa, sino, busca, conta) + barra de abas verde (Início, Ficha, Iniciativa, Mapa, **Mais** = a gaveta
  com a sidebar). O `MainLayout` publica `--tabbar-h` e `--sidebar-w`: **elemento preso embaixo soma `var(--tabbar-h)`**.

## Busca ⌘K (`components/CommandPalette.tsx`, chunk próprio)

Só páginas e ferramentas (decisão do usuário), sem acento, por sinônimos (`keywords`). Abrir: `openSearch()` (`pf2e:open-search`).

## Notificações (`services/notifications.ts`, `NotificationsButton`, `NotificationsList` em chunk próprio)

- Quem **registra** são triggers do banco (`mesa_events`): ficha publicada, ficha atribuída (só o dono novo, `target_user`),
  mapa ativado/revelado, combate iniciado (rodada 0→1), regra compartilhada, `handout-shared`, `trophy-unlocked`,
  `wiki-created`, `wiki-revealed`. Lista em `GET ?events=1`, ao vivo em `mesa:<mesa>:events`.
- O lido é da **conta** (`mesa_members.events_seen`, só anda para a frente). Não notifica a própria ação, nem ao GM mapa/combate.
- Item recebido é notificação **local** (`onArrival` de `gifts.ts`). Tocar leva ao lugar (`?ficha=<slug>`, `/mapa/<id>`,
  `/iniciativa`, `pf2e:show-share`). Troféus de colegas só aparecem no sino se ouro ou platina.
- `onTableEvent` entrega o `data` do evento.

## Configurações da mesa (`/mesa`, `MesaSettingsPage`, GM real sempre)

Nome, iniciar/encerrar sessão (é o que faz as rolagens contarem nas Estatísticas e nos troféus) e próxima sessão
(`mesa-settings` no `auth-handler`; `mesas.session_started_at`/`next_session_at`). O `?me` traz nome, sessão e o número de
CONTAS (`mesa_account_counts`). A mudança chega pelo `settings` do canal de eventos (`applyMesaSettings`).

## Seletor de mesa (`components/MesaSwitcher.tsx`)

`MesaMenu`, aberto pelo cartão da mesa e pelo botão da mesa no celular, com "Copiar link da mesa". O nome vem do servidor
(`mesas.name`); o de `MESAS` é só a reserva antes do `?me`. `?mesa=<id>` no link vira a escolha do aparelho e sai da URL.

## Bundle

A moldura vai no chunk principal: sem `Tooltip` do MUI (use `title`), lista do sino, busca e presença em chunks.
`TrophyToastLayer`, `RollFeedLayer` e `SharedRuleLayer` são montados uma vez no `MainLayout`.
