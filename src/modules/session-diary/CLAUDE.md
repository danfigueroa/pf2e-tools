# Estatísticas da Mesa (`/historico`, `src/modules/session-diary/` + `services/diary.ts`)

Antes "Diário da Sessão" (`/diario`, redireciona) e "Histórico de Rolagens"; código e endpoint (`?diary=`) mantêm o nome
antigo. O banco guarda toda rolagem (`rolls`); aqui só se agrupa.

- **Só conta o que foi rolado com a sessão INICIADA** (decisão do usuário: fora dela os jogadores testam a ficha).
  `rolls.in_session` é marcado pelo banco na inserção (trigger `rolls_in_session`, pela `mesas.session_started_at`), e
  `diary_days`/`diary_rolls`/`diary_summary` filtram na fonte. A página avisa disso, com atalho para `/mesa` ao GM.
- **Dia de jogo = 6h às 6h de Brasília** (`diary_day` no banco = `diaryDayOf` no cliente = fallback em memória).
- Endpoints (no `roll-handler`): `?diary=days`, `?diary=<YYYY-MM-DD>` (até 3000, em ordem), `?diary=summary` (resumo por dia
  × pessoa, `DaySummary` com `hist` das 20 faces; o cliente soma com `mergePeople` — o histórico da mesa **não baixa rolagens**).
- **A conta existe TRÊS vezes**: `summarize` (`stats.ts`), o SQL `diary_summary` e `summarizeRolls` (`roll-store.js`). Mudou uma,
  mude as outras; `check-rolls` confere JS × TS, `check-diary` confere SQL × TS. O servidor remonta as chaves em `summaryMark`
  (o `jsonb` reordena).
- **Contas** (`stats.ts`, puras): por personagem (slug; sem slug, o nome livre normalizado); cada raio do Blazing Bolt conta
  como um teste; ✦ é um por rolagem; **"dano rolado", nunca "dano causado"** (soma o dano do acerto; persistente fora).
  Só `check.d20` conta (o descartado da fortuna não).
- **Destaques** (`awards.ts`, lista declarativa `AWARDS`): **empate não elege ninguém** (o cartão diz quem empatou). Médias
  exigem `MIN_CHECKS` (8 na sessão, 20 na mesa); melhor/pior noite exige 10. "Presença" e "Karma" foram descartados.
- **Textos para quem joga** (pedido do usuário): sem jargão ("20 naturais", "qui-quadrado"). "O d20 é justo?"
  (`fairness.ts`): qui-quadrado de 19 g.l. (≥30,1 suspeito, ≥36,2 viciado), só com 100+ testes, sem mostrar a conta.
- Duas visões (Todas as sessões / Uma sessão); abre na sessão quando há rolagem hoje. O dia de hoje relê a cada rolagem
  (`onFeedActivity`, junção de 1,2 s).
- Animação sem biblioteca: `useInView` (um `IntersectionObserver` compartilhado), `useAnimatedNumber`, só
  `transform`/`opacity` (`reveal`, `grow`), ranking por FLIP (`Leaderboard`), troféu que troca de dono brilha. Lista desenha 50
  por vez. Usa a `HistoryRow` de `components/RollFeed.tsx` ("Últimas rolagens").
