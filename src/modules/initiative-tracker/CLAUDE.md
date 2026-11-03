# Iniciativa (`/iniciativa`, `src/modules/initiative-tracker/`)

## Onde cada fatia mora (a decisão que explica o módulo)

| Fatia | Onde vive |
| --- | --- |
| Combatentes, rodada, turno, durações, defesas | `useReducer` + `localStorage` (`pf2e:initiative:v1`) + nuvem (tabela `encounters`) |
| PV, condições, aflições, persistente de **personagem** | estado da mesa, **as mesmas fatias da Ficha Virtual** |
| PV, condições, aflições, persistente de **monstro** | dentro do encontro (reducer) |

**Monstro nenhum entra no estado da mesa.** O dano do GM num PC aparece na ficha do jogador e vice-versa.

## Regras que não podem quebrar

- **Nada que lê a mesa e escreve na mesa roda num efeito.** Durações, aflições em rodadas, persistente, abaixar escudo e o
  início do turno (`party.startTurn`) acontecem no **handler** de `passTurn`/`nextTurn` — um efeito reagiria ao próprio
  `subscribeSnapshot` e amplificaria escrita. O mesmo handler limpa duração órfã. Efeito que lê o estado LOCAL e escreve só
  no mapa (`useMapSync`) pode.
- `useEncounterParty` levanta o estado compartilhado para a página (o dano em área precisa **ler** PV, temporários e
  resistência de todos antes de aplicar). Expõe `snapshot` porque o resto lê de um `ref`: sem ele o objeto tem identidade
  constante e `useCombatantViews` nunca reprocessa.
- **A ordem é o próprio array `combatants`**, reordenado só em eventos explícitos (entrar, mudar iniciativa, "Reordenar"):
  derivar no render apagaria o desempate manual. Empate PC × adversário: **o adversário age primeiro** (`kindRank`; sort estável).
- **Turno ativo é `activeId`, nunca índice.** Adiar: ao voltar, a iniciativa passa a ser **permanentemente** a da nova posição.
- **Dano** (`damage.ts` + `defenses.ts`), ordem do Player Core: multiplicador da salvaguarda → imunidade → fraqueza →
  resistência → escudo (bloqueio) → PV temporários. Resistência/fraqueza: vale a **maior** aplicável, com `all`/`physical`/
  `energy`. O que não vira número ("except cold iron") vai para `defenseNotes` (chip de aviso).
- **Queda a 0 PV é sugestão**: Morrendo `1 + Ferido` para PC, Derrotado para monstro (detecção no `applyDamage` da view).
- Catálogo de condições, modificadores e `ConditionsDialog` vêm **inteiros** do `character-viewer`. Não reescreva.
- **O app rola só os dois danos que o RAW manda cair sozinhos** (estágio de aflição e persistente do fim do turno), sempre
  com memorial e "Desfazer" (`AutoDamage`, aviso próprio no topo). Iniciativa é digitada (ou vem do feed); salvaguardas e
  testes planos são informados pelo GM.
- **Iniciativa vinda da ficha** (`useInitiativeRolls` + `initiativeRolls.ts`): rolagem com `initiative` dá `setInitiative` ao
  PC de mesmo slug, UMA vez por id (no `localStorage`), só no encontro local; até 10 min de idade.

## O encontro na nuvem (`useEncounterCloud`, `services/encounters.ts`, `encounter-store.js`)

- Um documento por (mesa, mapa); `map_key` '' = "Sem mapa". Última escrita vence; dois GMs veem o MESMO encontro.
- **Quem vence não depende de relógio**: `EncounterSync` (`pf2e:initiative:sync:<mapa>`) guarda o `updatedAt` visto e se
  houve mudança local. Nuvem vazia recebe; igual + mexido sobe; mudou + não mexido baixa; **mudou E mexido**: baixa e oferece
  "Desfazer" com a daqui. Encontro sem registro conta como mexido.
- **A marca "igual à nuvem" é gravada junto do encontro** (`saveEncounter` no hook, sem a junção de 300 ms) — um recarregar no
  meio deixaria o encontro velho marcado como sincronizado.
- Sobe com 800 ms de junção (na hora ao esconder a aba). O aviso leva só `{ map, updatedAt, by }`; quem está aberto relê.
  Edição na fila vence o aviso. Canal único, aberto no módulo e nunca fechado (`listenEncounters`).
- Servidor: forma e tamanho (256 KB, 80 combatentes), conteúdo por `sanitizeEncounter`. Mapa apagado apaga o encontro
  (trigger); `writeEncounter` recusa mapa inexistente. `appendCombatants` marca como mexido.

## Interface

- **Uma coluna só, cartão em faixa** a partir do `sm` (PV numa coluna de 240px à direita): a ordem de turnos *é* a lista.
- Dano e Cura são botões escritos **sempre habilitados** (sem número, o clique foca o campo), com `aria-label` com o nome.
  O bloco ↑↓⋮ é renderizado **uma vez** (`useMediaQuery`), nunca com dois `display: none`.
- Condição, Aflição e Persistente são três botões escritos (`CombatantActions.tsx`) que mostram a contagem e ficam **âmbar
  sólido** quando esperam o GM (`roundsLeft === 0`, `checkDue`). A contagem de condições sai de `mods.active`. Largura pelo
  conteúdo. O `⋮` fica só com a presença no encontro (adiar, derrotado, duplicar, remover).
- **Ficha do monstro dentro do cartão** (`CombatantSheet.tsx`): `fetchMonster` + `MonsterStatBlock` do Escalar Monstro.
  Buscada ao abrir, **nunca guardada no encontro**. `aonName` à parte do `name` (cópias numeradas, "(N8)"; `aonNameOf`
  resgata os antigos e exige `aonUrl`). O alvo da escala é `npc.level`, com `scaleOverrides` e `spellEdits` juntos (sem eles a
  ficha contradiz o cartão). O bloco mostra os números **publicados**; não aplique condições nele (é o mesmo componente que o
  Escalar exporta) — só o aviso quando há condição ativa.
- Busca de criatura (`AonCreatureSearch` + `src/hooks/useCreatureSearch.ts`): nome, faixa ou os dois; 20 por página e
  "Carregar mais" até `hasMore`; `total` é aproximado.

## Aflições (`afflictions.ts`, `AfflictionDialog.tsx`, `CombatantAfflictions.tsx`)

- Motor puro sobre o **grau** que o GM informa: crítico ✓ −2, ✓ −1, ✗ +1, crítico ✗ +2; **Virulento** troca a recuperação.
- **Condições do estágio são derivadas**, nunca gravadas (borda tracejada, sem botões). Na view, `stored` ≠ `conditions`: os
  setters mexem em `stored`.
- Só os estágios em rodadas descem no `nextTurn`; minuto/hora/dia têm botão de avançar. A duração máxima encerra sozinha
  quando cabe no combate (`maxRoundsLeft`; minuto = 10 rodadas).
- **O dano cai ao ENTRAR no estágio, nos dois sentidos** (mudança de número, não "piorou").
- A fórmula de dano é lida da prosa **no cliente** (`dice.ts`): vale para aflições já gravadas. Só é dano o que tem tipo ao
  lado ou a palavra `damage`.

## Dano persistente (`persistentDamage.ts`, `CombatantPersistent.tsx`, `PersistentDamageDialog.tsx`)

- Cai no **fim do turno do alvo**, rerrolado, e depois o teste plano CD 15 (10 com ajuda). **O alvo é quem está SAINDO**:
  `applyPersistent(state.activeId)` antes do `dispatch` de `nextTurn`. `checkDue` só liga depois de o dano cair.
- Estágio de aflição com persistente cria a entrada sozinho (`syncFromAffliction`, `fromAffliction`), regerada a cada troca de
  estágio, preservando `checkDue`/CD de entrada igual.

## Escudo (`useShieldCatalog.ts`, `CombatantShield.tsx`, `NpcShieldDialog.tsx`)

- PC: `shieldItem` (de `pcFromBuild`) + AON + campo `shield` da mesa. Monstro: `NpcShield` no encontro (AON ou à mão).
- Abaixa no `passTurn` para quem **entra** no turno. Bloqueio = toggle para o próximo dano (desliga sozinho); no lote, caixa
  por alvo, só dano físico. Quem aplica refaz a conta por `view.blockDamage(blockFrom)`.
- Encontro montado antes de um campo novo do PC (escudo, `rage`, `speed`): tirar e pôr o personagem de novo.

## Personagem no encontro

- `pcFromBuild` não guarda o `BuildInfo` inteiro. Fúria: `PcCombatant.rage` + `PartySlice.rage` (chip, resistência —
  no mesmo tipo vale a maior —, Desajeitado). Tamanho: `PartySlice.size`. A Iniciativa **só lê** esses campos.
- O reducer (`addCombatants`) descarta PC cujo slug já está, e NPC cujo par `companionOf/companionId` já está.
- Monstro digitado à mão escolhe o tamanho (`CREATURE_SIZES`), no mesmo formato da AON.

## Companheiros de combate (a Animated Armor do Nathaniel)

Criaturas da AON que entram com o personagem — **não** são os `pets`/`familiars` do Pathbuilder.
- Configuração do personagem no campo `companions` (`companions.ts`, até 6, `{ id, name, token? }`), editada no
  `CompanionsCard` (fim do Inventário). Nome exato da AON (a busca oferece os parecidos).
- Ao adicionar um PC (`addWithCompanions`): relê a ficha com `loadCharacter(slug, true)` (**forçado**), busca cada criatura,
  `npcFromCreature` + `tokenImage`, `tokenFit`, `companionOf`, `companionId`. Não achou = aviso; o PC entra igual. Nível base.
- `refreshCompanions` ao abrir a página e no "Atualizar": atualiza token/enquadramento dos que já estão (estado local); só
  sobrescreve o token se a ficha tem um.
- **Token de `tokens/` é permanente**: `setTokenImage` nunca apaga URL de lá. Imagem nova zera o enquadramento; o `fit:<id>` do
  mapa vale por cima do `tokenFit`.

## Ligação com o mapa

`useMapSync`, encontro por mapa (`encounterStorage.ts`), `EncounterMapPicker`: ver `src/modules/battle-map/CLAUDE.md`.
