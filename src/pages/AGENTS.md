# Início (`HomePage.tsx` = casca no chunk principal; `home/live.tsx` + `home/party.ts` = chunk vivo)

A Início mostra a mesa VIVA, com **uma tela por papel**, sem herói de marketing nem prévia das ferramentas.

- **GM**: `GmHero` (próxima sessão em faixa escura: data, "em N dias", nível comum do grupo, quantos online, Começar combate,
  Editar data → `/mesa`; com sessão iniciada, "Sessão em andamento" + "Encerrar"; sem nenhuma, "Marcar sessão") e
  `PrepareList` (encontro, mapa, Diário, cada um com o estado de agora).
- **Jogador**: `PlayerCard` (PV, condições, última rolagem, "Abrir minha ficha"; sem ficha, o convite para publicar) +
  `PlayerSession`.
- Para os dois: `QuickAccess` (cada atalho com uma linha viva; o GM ganha Fichas, Diário, Escalar Monstro e Convidar),
  `GroupSection` (online = alguém com a ficha aberta ou o dono no app), `LastSessionSection` (o jogador vê o troféu e as
  rolagens DELE; leitura única `readLastSession`) e `TrophyShowcase`. **Toda parte tem estado vazio.**
- **Durante o combate** (`combat.round > 0`, `useCombatStatus`): GM vê `GmCombat`, jogador vê `PlayerCombat`; atalhos ganham
  "AO VIVO" e a última sessão vira "Rolagens ao vivo".
- **Fora, de propósito**: "Próximo turno" e lembretes de fim de turno (passar turno escreve durações, aflições e persistente
  — fica na Iniciativa), botões de rolagem rápida e **qualquer "Rolar dado"** fora do mapa e da ficha (decisão do usuário).
- **Não prometa na tela o que não existe** (o design dizia que a Início avisaria a vez; o que há é "Rodada N · vez de X").
- `?ficha=<slug>` em `/ficha-virtual` abre aquela ficha publicada e sai da URL — é como o grupo e o sino levam à ficha.
- Celular: personagem e sessão em pilha, atalhos em grade 2×2.
