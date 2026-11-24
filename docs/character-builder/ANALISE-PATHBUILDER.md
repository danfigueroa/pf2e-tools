# Análise do Pathbuilder 2e

Levantamento feito em 2026-11-24 no app web (`pathbuilder2e.com/app.html`, versão **Feylines 112.0**, conta logada,
Remaster ligado), criando um personagem de teste (Humano Guerreiro/Mago nível 1, não salvo). Complementado pelos 10 JSONs
do elenco (`public/characters/*.json`) e pelo que a Ficha Virtual já consome.

**Legenda da decisão**

| Marca | Significado |
| --- | --- |
| ✅ Adotar | O Criador faz igual (ou melhor) |
| 🔧 Adaptar | Faz, mas do jeito da plataforma (mesa, papéis, banco, i18n, celular) |
| ♻️ Já existe | Outro módulo do Covil já cobre; o Criador só integra |
| ⏳ Depois | Entra numa fase posterior do roadmap |
| ⛔ Fora | Não se aplica à plataforma |

---

## 1. Estrutura geral da tela

O Pathbuilder tem três áreas:

1. **Coluna do plano (esquerda)** — Ancestralidade, Background, Classe no topo; depois um bloco por nível (1 a 20) com
   os "slots" de escolha daquele nível: botões de engrenagem com contador (`4 Set Abilities`, `3 Skill Training`,
   `1 Class Skill`, `1 Skill Increase`, `4 Ability Boosts`), cartões "Not Selected" (Heritage, Ancestry Feat, Class Feat,
   Skill Feat, General Feat, escolhas de classe como `Weapon Mastery Group`, `Combat Flexibility`, `Arcane School`,
   `Arcane Thesis`) e a lista de características automáticas do nível (Reactive Strike, Bravery, Weapon Specialization…),
   inclusive talentos concedidos ("Free Feat: Shield Block", "Free Feat: Hobnobber" do background).
   O botão **Hide Plan** recolhe a coluna. O plano vai até o 20 mesmo com o personagem no 1: os níveis futuros podem ser
   pré-planejados.
2. **Cabeçalho de status** — Nível, XP, Nome; Tamanho, Velocidade, os seis modificadores; CA (escudo gráfico), barra de
   PV, escudo, Fortitude/Reflexo/Vontade com selo de proficiência (U/T/E/M/L) e botão de rolar; Pontos de Heroísmo;
   botão **Rest**; **Add Condition**, **Add Custom Buff**.
3. **Coluna de perícias + abas** — CD de classe, Percepção, Iniciativa, as 16 perícias e os Lores, cada uma com selo de
   proficiência e dado; abas **Weapons, Defense, Gear, Spells, Pets, Details, Feats, Actions**.

| Item | Decisão | Observação |
| --- | --- | --- |
| Plano por nível 1–20 com slots e contadores | ✅ | Núcleo do Criador. No celular vira lista por nível recolhível |
| Pré-planejar níveis futuros | ✅ | "Nível atual" separado do plano; o compilador só aplica até o nível atual |
| Cabeçalho de status ao vivo | ✅ | Resumo fixo (PV, CA, salvaguardas, Percepção, CD de classe) que recalcula a cada escolha |
| Hide Plan | 🔧 | No desktop o plano recolhe; no celular é um passo do fluxo |
| Rolar dados, condições, Rest, Pontos de Heroísmo | ♻️ | A Ficha Virtual já faz tudo isso (rolagens no feed, condições, Novo dia). O Criador não rola |

## 2. Menu principal

| Menu | Item | Decisão | Observação |
| --- | --- | --- | --- |
| Topo | Remaster On/Off | 🔧 | Plataforma é Remaster; legado só por liberação do GM (livro a livro) |
| Topo | Tema Dark/Light | ♻️ | Tema da plataforma |
| Topo | Signin / Login and Upgrade App | ♻️ | Conta do Covil (usuário + senha) |
| Character | Convert to Remaster Rules | ⏳ | Fase de importação: avisar itens legados e sugerir o equivalente pelo `remaster_id` da AON |
| Character | Character Options | 🔧 | Vira "Opções do personagem" (por ficha) + "Regras da mesa" (do GM, em `/mesa`) |
| Character | New Character | ✅ | "Novo personagem" |
| Character | Save Character (Local) / autosave | 🔧 | Salva no banco automaticamente (rascunho), com rascunho local de segurança |
| Character | Open Character / Load Most Recent | 🔧 | Lista "Meus personagens" da mesa |
| Connect | Connect to GM / Launch GM Mode | ♻️ | A mesa em tempo real já é o "modo GM" (Iniciativa, Mapa, Ficha somente leitura) |
| Export | Character Sheet PDF / Stat Block PDF | ⛔ | Ficha em PDF foi removida de propósito (D5) |
| Export | Export JSON | ✅ | "Baixar JSON (compatível com Pathbuilder)" — útil para backup e para a Transformação |
| Export | Share Copy of Character | 🔧 | "Duplicar" / "Copiar para outra mesa" (⏳) |
| Data | Backup/Restore | ♻️ | Banco + histórico de versões (`sheet_versions`) + backup semanal |
| Data | Campaign Management | 🔧 | "Regras da mesa": livros liberados, variantes, raridade permitida, homebrew — definido pelo GM |
| Data | Feat Browser | ⏳ | Navegador de talentos fora de um slot (consulta), dentro do Criador |
| Data | Remaster Information | ⛔ | — |
| Custom | Custom Pack (Backgrounds, Feats, Heritages, Spells, Specials, Ancestries, Classes, Buffs; Custom Items; Custom Pets; export/import do pacote) | ⏳ | "Conteúdo da mesa" (homebrew) criado pelo GM, fase 9 |
| Custom | Custom Ability Increases (por nível) | ✅ | "Ajustes manuais": boosts extras num nível |
| Custom | Custom Feat Choice (General/Class/Ancestry por nível) | ✅ | Slot extra concedido pelo GM ("Talento concedido") |
| Custom | Custom Skill Increases (0–10 por nível) | ✅ | Aumentos de perícia extras por nível |
| Help | Help / Licenses / Patch Notes / Report Error | 🔧 | Licenças ORC/OGL obrigatórias numa página "Créditos e licenças" |
| Rodapé | Dice Tray / Free Roll | ♻️ | Mapa e Ficha já rolam |

## 3. Opções (Character Options)

Observado no diálogo **Options**:

**Manage Available Rulebooks** — abas *Rulebooks, Setting, 3rd Party, Adventures, Bestiaries*; cada livro com caixa
de seleção e o aviso de licença (ORC / OGL 1.0a). Remaster: Player Core 1 e 2, GM Core, Monster Core, NPC Core, Howl of
the Wild, War of Immortals, Battlecry!, Treasure Vault (R), Guns & Gears (R), Dark Archive (R), Impossible Magic,
Feybound, Lost Omens (Shining Kingdoms, Rival Academies, Tian Xia, Divine Mysteries, Draconic Codex, Hellfire Dispatches,
High Seas, Cheliax…). "Legacy Rulebooks" e "Setting Books" com Select/Deselect All. Terceiros: Battlezoo. Aventuras:
guias do jogador e volumes de cada Adventure Path.

| Opção | Decisão | Observação |
| --- | --- | --- |
| Livros disponíveis (por personagem) | 🔧 | Por **mesa** (GM), com exceção por personagem aprovada pelo GM |
| Show Mythic options | ✅ | Necessário: o elenco inteiro é mítico |
| Confirm when adding/removing from spellbook | ✅ | Confirmação leve |
| Separate Adventurer's Kit into individual items | ✅ | Padrão ligado |
| Display rare Aftermath and Deviant feats | ⏳ | Entra junto com o filtro de raridade |
| Autosave Character | ✅ | Sempre ligado (rascunho no banco) |
| Add generic companion / generic caster for staves | 🔧 | "Conjurador genérico" para bastão/varinha de quem não conjura: já é um caso que a Ficha trata |
| Show dice rolling buttons / dice sound | ♻️ | Ficha |
| Open dialogs with filters visible | ✅ | Preferência do aparelho |
| Show cursed items | ✅ | Filtro do catálogo |
| Disable database backup warnings / automatic saving | ⛔ | — |
| Show Remastered / legacy / Battlezoo / Mythic checkbox (novo personagem) | 🔧 | Regras da mesa |
| **Free Archetype** | ✅ MVP | 9 de 10 personagens usam |
| **Automatic Bonus Progression** | ✅ | Muda potência/striking/resiliente e o cálculo de itens |
| **Proficiency Without Level** | ⏳ | Variante rara; o compilador suporta a fórmula, a Ficha precisa de revisão |
| **Ancestry Paragon** | ✅ MVP | Ceros, Hearts Folly, Thalos e Woyd usam ("Ancestral Paragon Feat") |
| Skill Paragon | ⏳ | — |
| Mythic via custom feat choices only | ⛔ | — |
| Mythic Destinies as high level archetypes | ⏳ | — |
| Legacy GMG Dual Classing | ⏳ | O JSON tem `dualClass`; a Ficha não trata hoje |
| Legacy GMG Stamina / Gradual Ability Boosts | ⏳ | Sem versão Remaster; só se uma mesa pedir (ver REGRAS-OPCIONAIS.md, D8) |

## 4. Ancestralidade, Herança e Background

- **Seletor padrão do Pathbuilder** (vale para tudo): abas por **raridade** (*Common / Uncommon / Rare / All*), lista à
  esquerda, detalhe à direita, botões **Accept / Cancel / PRD** (abre a regra) / **Clear**. Item escolhido em laranja.
- Ancestralidades comuns: Dwarf, Elf, Gnome, Goblin, Halfling, Human, Leshy, Orc (+ dezenas incomuns/raras).
- Detalhe da ancestralidade: traços, descrição, **PV**, **Tamanho**, **Velocidade**, **Boosts e Flaws**, **Idiomas**
  (Comum + adicionais = 1 + INT se positivo), fonte (`PC1`).
- Heranças da ancestralidade + **heranças versáteis** (Aiuvarin, Dromaar no Humano; Nephilim, Changeling, Dhampir… de
  qualquer ancestralidade). No JSON: `["Versatile Human", null, "Heritage", 1, "Heritage Feat", ...]` e slots
  `Heritage Featversatile heritage`.
- Background: boosts (um de duas opções + um livre), perícia treinada, Lore e talento de perícia concedido ("Free Feat:
  Hobnobber"). Backgrounds raros podem conceder talentos (Reborn Soulchild → `BACKGROUND_Reborn Soulchild`).

| Item | Decisão |
| --- | --- |
| Seletor lista+detalhe com abas de raridade, busca, filtros | ✅ (componente `ContentPicker`, base de todo o Criador) |
| Heranças comuns e versáteis | ✅ |
| "Alternate ancestry boosts" (dois livres no lugar dos fixos) e flaw voluntário | ✅ |
| Idiomas (contagem por INT, idiomas da ancestralidade e regionais) | ✅ |
| Background com boosts, perícia, Lore e talento concedido | ✅ |
| Link "PRD" | 🔧 → descrição da AON pelo `DescriptionDrawer`, traduzida, com "Corrigir tradução" |

## 5. Classe

- Abas **All Classes / Core / Expanded / Class Archetypes**. 27 classes no catálogo: Alchemist, Animist, Barbarian, Bard,
  Champion, Cleric, Commander, Druid, Exemplar, Fighter, Guardian, Gunslinger, Inventor, Investigator, Kineticist, Magus,
  Monk, Necromancer, Oracle, Psychic, Ranger, Rogue, Runesmith, Sorcerer, Summoner, Swashbuckler, Thaumaturge, Witch, Wizard.
- Detalhe: descrição, **Key Ability**, **PV** (n + CON), Percepção, salvaguardas, perícias treinadas, ataques, defesas,
  CD de classe.
- **Escolhas de classe aparecem no plano** como cartões próprios: `Arcane School`, `Arcane Thesis` (Mago), `Weapon Mastery
  Group` (Guerreiro 5), `Combat Flexibility` (9), `Improved Flexibility` (15), `Weapon Legend Group` (13), ordem do Druida,
  doutrina do Clérigo, causa do Campeão, instinto do Bárbaro, racket do Ladino, metodologia do Investigador, consciência do
  Psíquico, *hybrid study* do Magus etc.
- Características automáticas listadas por nível (Bravery 3, Battlefield Surveyor 7, Weapon Specialization 7, Armor
  Expertise 11…). Trocar a classe refaz o plano (o personagem de teste virou Mago e o plano foi recriado).
- Classes de arquétipo (Class Archetypes, ex. Battle Harbinger, Wellspring Mage) substituem características.

| Item | Decisão |
| --- | --- |
| 27 classes com progressão completa 1–20 | ✅ (MVP: as 8 classes do elenco + as do Player Core 1; demais na fase 5) |
| Escolhas de classe com sub-escolhas (escola → magias da escola; doutrina → domínios) | ✅ |
| Class Archetypes | ⏳ |
| Dual Class | ⏳ |

## 6. Atributos (Set Starting Ability Boosts)

Diálogo com quatro blocos: **Ancestry Boosts** (selects), **Background Boosts**, **Class Boost**, **Free Boosts** (4,
caixas de seleção com o modificador ao vivo) e "**Override character creation ability modifiers**". Nos níveis 5/10/15/20,
botão **4 Ability Boosts**. JSON: `abilities.breakdown` com `ancestryFree`, `ancestryBoosts`, `ancestryFlaws`,
`backgroundBoosts`, `classBoosts`, `mapLevelledBoosts`.

| Item | Decisão |
| --- | --- |
| Boosts por origem, modificadores ao vivo | ✅ |
| Boost parcial acima de +4 (dois parciais = +1) | ✅ (ver MOTOR-DE-REGRAS) |
| Override manual dos modificadores | ✅ com aviso "valores manuais" |
| Custom Ability Increases | ✅ |

## 7. Perícias (Skill Training / Skill Increase / Lores)

Diálogo **Remaining Skill Selections: N** com as 16 perícias + Lores; para cada uma, botões **T E M L** e a conta
(atributo, proficiência, item). Botão **Lores** para adicionar Lore livre. Perícia já treinada pela ancestralidade/
background aparece marcada. `Skill Increase` nos níveis ímpares a partir do 3. Teto por nível (Mestre a partir do 7,
Lendário a partir do 15).

| Item | Decisão |
| --- | --- |
| Treino inicial (classe + INT) e aumentos por nível | ✅ |
| Lores livres e concedidas | ✅ |
| Bônus de item por perícia (`mods`) | ✅ (vem dos itens investidos/vestidos) |
| Perícia treinada em duplicidade (ex.: background + classe) vira escolha livre | ✅ (regra: Player Core, "se já treinado, escolha outra") |

## 8. Talentos (seletor)

- Abas **Class Feats / Dedication Feats / Archetype Class Feats / All Feats**; filtro com ordenação
  (*Alphabetically / By Level*), busca e campo de busca (*Names / Traits / Other*).
- Lista com ícone de ações (◆, ◆◆, ↺ reação, ◇ livre), selo de **nível** (cinza = comum, **laranja = incomum**), nome
  **esmaecido** quando o personagem não cumpre nível/pré-requisito — mas o detalhe abre normalmente.
- Detalhe: traços (raridade, classe), Requisitos/Gatilho/Frequência, texto, fonte abreviada (`PC1`, `LO: KoL`).
- Dedicações: lista enorme (Acrobat… Wrestler), regra de "duas dedicações exigem 2 talentos do arquétipo anterior".
- **Escolhas aninhadas** (JSON): `parentChoice` / `childChoice` — ex. *Reincarnation Feat* (talento de ancestralidade)
  que dá um talento de outra lista, *Basic Thoughtform* (arquétipo) que dá um talento de Psíquico, *Assurance (Deception)*
  com o qualificador (perícia), *General Training*, *Natural Ambition*, *Skill Lessons*, *Basic Maneuver*.
- Aba **Feats** da ficha: lista o que falta escolher ("You have 3 unselected feats up to this level", "You have not yet
  assigned level 1 ability boosts"), agrupado por General Feats, Skill Feats, Specials.

| Item | Decisão |
| --- | --- |
| Seletor com abas, ordenação, busca por nome/traço/texto | ✅ |
| Raridade e elegibilidade visíveis; escolher inelegível = permitido com aviso | ✅ (regra "avisa, não trava") |
| Motivo da inelegibilidade ("Requer Expert em Atletismo") | ✅ — o Pathbuilder só esmaece; nós dizemos o porquê |
| Talentos com qualificador (Assurance (X), Additional Lore (X)) | ✅ |
| Escolhas aninhadas (talento que concede talento) | ✅ |
| Regra de dedicação (2 talentos antes de outra) | ✅ como aviso |
| Lista de pendências ("faltam 3 talentos") | ✅ painel "Pendências" sempre visível |

## 9. Armas

- Botão **Add Weapon** → seletor com abas **All / Simple / Martial / Advanced / Unarmed / Proficient** e sub-abas
  **Standard / Magic / Custom / All**; cada linha com selo de proficiência (T/E) e o nível do item (laranja = incomum).
  Detalhe: traços, proficiência, grupo, preço, volume, mãos, texto, fonte.
- Botões **Buy** (desconta do dinheiro, com aviso "isso simplifica suas moedas"), **Give** (de graça), **Custom**.
- Cartão da arma: **Roll, Options, Runes, Stow, Delete**; Acerto e Dano calculados.
- **Options**: barra de proficiência (T E M L) com a conta; Potency Rune, Striking Rune, atributo de ataque, Quantidade,
  **Attack Override**, **Damage Override**, Material, Bulk override, **Increase Dice**, **Large Weapon**, **Critical
  Specialization**, **Proficiency Override**, nome personalizado, **traços adicionais**, construtor de **dano extra**
  (`N` × `dado/bônus` × `tipo`, inclusive Persistent), especialização crítica descrita.
- **Runes**: lista de runas de propriedade por nível, "Remaining Slots N" (= potência), Buy/Give, Potency, Striking.

| Item | Decisão |
| --- | --- |
| Catálogo de armas com filtros, comprar/dar | ✅ |
| Runas fundamentais e de propriedade com slots | ✅ |
| Materiais (cold iron, silver, adamantine…) | ✅ |
| Overrides (ataque, dano, proficiência, dados, Large) | ✅ com aviso "valor manual" (a Ficha já tem catálogos por nome para isso) |
| Dano extra e traços adicionais | ✅ |
| Desarmados (punho, mordida, garras de ancestralidade) | ✅ — **melhor que o Pathbuilder**, que não exporta desarmados (hoje `unarmed.ts` cataloga à mão) |
| Roll | ♻️ Ficha |

## 10. Defesa

Proficiências (Light/Medium/Heavy/Unarmored) e a conta da CA (Base 10, Item, DES, Proficiência). Armadura com **Change,
Options, Runes, Stow**; "Stow Additional Armor/Shield"; **Item Bonus** e **Dex Cap** visíveis; escudo com **Change**.

| Item | Decisão |
| --- | --- |
| Armadura com runas (potência, resiliente, propriedade), material, teto de DES, penalidades | ✅ |
| Escudo (dureza, PV, BT, runa de reforço) | ✅ (a Ficha já lê escudo da AON) |
| Armaduras/escudos guardados | ✅ |

## 11. Equipamento (Gear)

Dinheiro (pp/po/pe/pc), **Total Bulk** com Encumbered/Max (ex.: "Enc 8; Max 13" com FOR +3), **Add Gear, Add Container,
Add Formula**, "Main Inventory". Seletor com abas **Gear** (*Adventuring, Ammunition, Misc, Weapon Attachments*),
**Consumables** (*Magic Potions, Alchemical, Snares, Talismans, All*), **Magic Items** (*Held, Worn, Staves, Wands,
Scrolls, Artifacts*), **All**, **Custom**. JSON: `equipment: [nome, qtd, "Invested"?]`, `equipmentContainers`,
`formula`, `money`.

| Item | Decisão |
| --- | --- |
| Catálogo de itens por categoria, comprar/dar, quantidade | ✅ |
| Contêineres (mochila, bolsa de carga) com volume próprio | ✅ |
| Investir (limite de 10 investidos) | ✅ com aviso |
| Livro de fórmulas | ✅ |
| Carga e sobrecarregado | ✅ |
| Riqueza inicial por nível | ✅ como referência (D6) |
| Consumir itens, passar item a colega, dinheiro na mesa | ♻️ Ficha (`consumed`, `gave`, `money`) |

## 12. Magias

Aba **Spells** com uma sub-aba por conjurador (ex. *Wizard*, *Rituals*). Cabeçalho com CD e ataque, a conta
(atributo/prof/item) e T E M L; **Bonus Spells** (slots extras); **Print**. Truques (5 no Mago) e cada rank com slots
"Cast — Not Selected", Duração e Alcance. Seletor de magias com abas **Arcane / Divine / Occult / Primal**, ação, rank,
raridade (laranja). Rituais com **Add Ritual**.
JSON: `spellCasters[]` (`name`, `magicTradition`, `spellcastingType`, `ability`, `proficiency`, `focusPoints`, `innate`,
`perDay[11]`, `spells[]`, `prepared[]`, `blendedSpells`), `focus` (por tradição e atributo, `focusCantrips`,
`focusSpells`), `focusPoints`, `rituals`. Conjuradores extras vêm de itens e talentos: *Advanced Targeting System*,
*Pinch Time*, *Caster Arcane Sense*, *Mythic Magic*, *Archetype Wizard*, *Aeromancer*, *Cleric Font*.

| Item | Decisão |
| --- | --- |
| Preparado (grimório + preparadas), espontâneo (repertório + assinatura), inato, foco, rituais | ✅ |
| Slots por classe/nível e por arquétipo (Basic/Expert/Master Spellcasting) | ✅ (tabelas curadas, MOTOR-DE-REGRAS §8) |
| Fonte divina (Cleric Font), magias de domínio, escola (curriculum) | ✅ |
| Bastão/varinha/pergaminho | ✅ inventário; a Ficha já lê bastões |
| Marcar conjuração/slot gasto | ♻️ Ficha |

## 13. Companheiros (Pets)

"Animal Companions, Eidolons, Constructs and Familiars are gained from feats and class features." Companheiro animal
(tipo, jovem → maduro → incrível com especialização Savage/Nimble…), familiar (habilidades), eidolon, construto do
Inventor. JSON: `pets[]` (`type`, `name`, `animal`, `mature`, `incredible`, `incredibleType`, `specializations`,
`armor`, `equipment`), `familiars[]`.

| Item | Decisão |
| --- | --- |
| Companheiro animal e familiar | ✅ (fase 6) |
| Eidolon, construto | ⏳ |
| Cálculo do companheiro | ♻️ A Ficha já calcula (`companionStats.ts`) a partir do tipo + progressão |

## 14. Detalhes, Talentos, Ações

- **Details**: retrato, Divindade, Idade, Gênero, Idiomas, **Notes** (texto livre com "Save Notes").
- **Feats**: pendências + lista por grupo, Specials.
- **Actions**: filtros *Class, Skills, Gear, Basic, Exploration, Downtime, Activity*; busca por *Names/Traits/Description*.

| Item | Decisão |
| --- | --- |
| Retrato | 🔧 → avatar do token (Storage `tokens/`, `useImageUrl`) |
| Divindade (com santificação, fonte divina, arma favorita, perícia) | ✅ |
| Idade, gênero, idiomas, notas | 🔧 Notas e background ♻️ Anotações da Ficha (`character_notes`) |
| Lista de ações por filtro | ♻️ Ficha (Habilidades/Talentos agrupados, ações de perícia) |

## 15. Condições e buffs personalizados

- **Apply Condition**: Blinded… Wounded (36 condições, inclui Persistent Damage).
- **Custom Buffs**: nome, descrição, **Add Effect** com tipo (Proficiency Bonus, All Skills, Speed, AC, Weapon To Hit,
  Weapon Damage, HP, Temp HP, Set Proficiency, Resistance, Size Change, Initiative, Ability Modifier, Max Dex, Spell
  Attack, Innate Spell, Focus Spell), tipo de bônus (Status/Circumstance/Untyped/Item), alvo e valor (−50…+50).

| Item | Decisão |
| --- | --- |
| Condições | ♻️ Ficha (catálogo do Remaster com efeitos) |
| Buffs **permanentes** do personagem (ex.: bônus de item de relíquia, resistência de item) | 🔧 "Ajustes" do Criador: efeitos fixos que entram no compilado, com motivo — substitui parte dos catálogos por nome da Ficha |
| Buffs temporários | ♻️ Ficha |

## 16. O que o Pathbuilder **não** faz bem e o Criador deve fazer

1. **Desarmados no export** (Pathbuilder não exporta; a Ficha mantém `unarmed.ts` à mão).
2. **Foco pelo Remaster** (Pathbuilder conta o pool pela regra antiga; a Ficha corrige em `fixFocusPool`).
3. **Path to Perfection** exportado só como "Will" (`fixPathToPerfection`).
4. **Grimório do Magus** em `prepared` com `spells` vazio (`normalizeSpellCasters`).
5. **Tamanho em `specials`** (`dropSizeSpecials`).
6. **Resistência de item** não exportada (`addItemResistances`).
7. **Ataque de arma 1 abaixo** em casos específicos (`fixWeaponExports`).
8. **Motivo de inelegibilidade** de talento não é mostrado.
9. **Idioma**: tudo em inglês; o Criador mostra nomes e descrições em português (com o termo original), ou em inglês por conta.
10. **Tempo real e mesa**: o GM vê a ficha nascer, aprova liberações e já tem o personagem na Iniciativa.

Cada correção do `normalizeBuild` vira **teste de regressão** do compilador: o Criador deve gerar o JSON já certo
(e o `normalizeBuild` continua idempotente sobre ele).
