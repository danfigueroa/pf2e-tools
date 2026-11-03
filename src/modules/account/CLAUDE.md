# Conta e tela de entrada (`LoginPage.tsx`, `LoginLayout.tsx`, `onboarding/`, `components/AuthGate.tsx`)

- `AuthGate`: login → convite → app. Toda a tela de entrada é um chunk lazy (`LoginPage`).
- Formulário num painel de pergaminho (desktop: logo empilhado no topo; celular: logo horizontal no cabeçalho verde). Tem os
  seletores de idioma e tema.
- **Vitrine "Conheça o Covil"**: seis cenas animadas **desenhadas em código** (decisão do usuário: nada de captura de tela),
  com dados fictícios e **sem rede** — a tela é pública. Cena nova = um arquivo em `onboarding/scenes/` + entrada em `SCENES`.
  - Cada cena é um loop de passos (`useSceneClock`, um `setTimeout` por passo; o movimento é CSS) e reusa o que existe
    (`DiceTray`, `pulseAnimation`, `floatUp`…).
  - **Só a cena da vez monta**; quem marca o tempo é a barra de progresso (fim dela = próxima cena), parada com o mouse em
    cima; a cena para com a aba oculta ou fora da tela. Movimento reduzido: quadro final, troca só pelos botões.
- Sucesso espera o "Bem-vindo!" (`beforeReload` de `signIn`/`register`) antes de recarregar; erro treme o painel (`SHAKE`) e
  devolve o foco à senha.
- Convite: `/convite/<código>` abre "Criar conta" com o código preenchido; quem já tem conta entra e o convite vale sozinho.
  O código fica em `localStorage` (`pf2e:invite`). Troca de senha pelo menu da conta (`updateUser`).
