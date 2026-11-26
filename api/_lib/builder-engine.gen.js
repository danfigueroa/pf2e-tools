// GERADO por scripts/build-engine.mjs a partir de src/modules/character-builder/engine/. Não edite.
/* i18n-ignore-file */

// src/modules/character-builder/engine/rulesIndex.ts
function buildRulesIndex(lists, languages) {
  const byId = /* @__PURE__ */ new Map();
  const byName = /* @__PURE__ */ new Map();
  for (const list of lists) {
    for (const entry of list) {
      if (byId.has(entry.id)) continue;
      byId.set(entry.id, entry);
      for (const name of [entry.name, ...entry.legacyNames ?? []]) {
        const key = name.toLowerCase();
        byName.set(key, [...byName.get(key) ?? [], entry]);
      }
    }
  }
  return {
    get: (id) => id ? byId.get(id) : void 0,
    byName: (name, type) => {
      const all = (byName.get(name.toLowerCase()) ?? []).filter((e) => !type || e.type === type);
      return all.find((e) => e.remaster) ?? all[0];
    },
    languages
  };
}
function grantedFeat(rule, rules, missing) {
  if (rule.key !== "GrantItem" || typeof rule.uuid !== "string") return void 0;
  const id = typeof rule.grantId === "string" ? rule.grantId : void 0;
  const byId = id ? rules.get(id) : void 0;
  if (byId) return byId;
  const name = /^Compendium\.pf2e\.feats-srd\.Item\.(.+)$/.exec(rule.uuid)?.[1];
  const byName = name ? rules.byName(name, "feat") : void 0;
  if (!byName && id) missing?.add(id);
  return byName;
}

// src/i18n/index.ts
var LANG_KEY = "pf2e:language";
var isLang = (v) => v === "pt" || v === "en";
function readStored() {
  try {
    const v = typeof localStorage === "undefined" ? null : localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}
function detect() {
  if (typeof window === "undefined") {
    const env = globalThis.process?.env;
    return env?.PF2E_LANG === "en" ? "en" : "pt";
  }
  const stored = readStored();
  if (stored) return stored;
  const nav = typeof navigator === "undefined" ? "" : navigator.language || "";
  return /^en\b/i.test(nav) ? "en" : "pt";
}
var lang = detect();
var isEn = lang === "en";
function tr(pt, en) {
  return isEn ? en : pt;
}
if (typeof document !== "undefined") document.documentElement.lang = isEn ? "en" : "pt-BR";

// src/modules/character-builder/engine/types.ts
var ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];
var SKILL_ATTRIBUTE = {
  acrobatics: "dex",
  arcana: "int",
  athletics: "str",
  crafting: "int",
  deception: "cha",
  diplomacy: "cha",
  intimidation: "cha",
  medicine: "wis",
  nature: "wis",
  occultism: "int",
  performance: "cha",
  religion: "wis",
  society: "int",
  stealth: "dex",
  survival: "wis",
  thievery: "dex"
};
var SKILL_KEYS = Object.keys(SKILL_ATTRIBUTE);

// src/modules/character-builder/engine/attributes.ts
var LEVELLED_BOOST_LEVELS = [5, 10, 15, 20];
var ATTR_LABEL = {
  str: tr("FOR", "STR"),
  dex: tr("DES", "DEX"),
  con: tr("CON", "CON"),
  int: tr("INT", "INT"),
  wis: tr("SAB", "WIS"),
  cha: tr("CAR", "CHA")
};
var attributeLabel = (key) => ATTR_LABEL[key];
var boostsOf = (state, key) => {
  const choice = state.choices[key];
  return choice && "boosts" in choice ? choice.boosts : [];
};
function boostGroups(state, ancestry, background, cls) {
  const groups = [];
  if (ancestry) {
    const listed = ancestry.ancestry?.boosts ?? [];
    const alternate = state.origin.alternateBoosts === true;
    const fixed = alternate ? [] : listed.filter((b) => b !== "free");
    const free = alternate ? 2 : listed.filter((b) => b === "free").length;
    groups.push({ key: "boosts-ancestry", label: tr("Ancestralidade", "Ancestry"), level: 1, count: free, options: [], fixed, chosen: boostsOf(state, "boosts-ancestry") });
  }
  if (background) {
    const options = (background.background?.boosts ?? []).filter((b) => b !== "free");
    groups.push({ key: "boosts-background", label: tr("Background", "Background"), level: 1, count: 2, options, oneOf: options.length > 0, fixed: [], chosen: boostsOf(state, "boosts-background") });
  }
  if (cls) {
    const keys = cls.class?.keyAttribute ?? [];
    const chosen = keys.length === 1 ? [keys[0]] : state.class.keyAttribute && keys.includes(state.class.keyAttribute) ? [state.class.keyAttribute] : [];
    groups.push({ key: "class-key", label: tr("Classe (atributo-chave)", "Class (key attribute)"), level: 1, count: keys.length > 1 ? 1 : 0, options: keys, fixed: keys.length === 1 ? [keys[0]] : [], chosen: keys.length === 1 ? [] : chosen });
  }
  groups.push({ key: "boosts-1", label: tr("Quatro boosts livres", "Four free boosts"), level: 1, count: 4, options: [], fixed: [], chosen: boostsOf(state, "boosts-1") });
  for (const level of LEVELLED_BOOST_LEVELS) {
    if (level > state.level) break;
    groups.push({ key: `boosts-${level}`, label: tr(`Boosts do n\xEDvel ${level}`, `Level ${level} boosts`), level, count: 4, options: [], fixed: [], chosen: boostsOf(state, `boosts-${level}`) });
  }
  return groups;
}
function compileAttributes(state, ancestry, background, cls, pending, warnings) {
  const mod = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0]));
  const partial = Object.fromEntries(ATTRIBUTES.map((a) => [a, false]));
  const boost = (a) => {
    if (mod[a] >= 4) {
      if (partial[a]) {
        mod[a] += 1;
        partial[a] = false;
      } else partial[a] = true;
    } else mod[a] += 1;
  };
  const groups = boostGroups(state, ancestry, background, cls);
  const intGains = {};
  let intAt1 = 0;
  const breakdown = {
    ancestryFree: [],
    ancestryBoosts: [],
    ancestryFlaws: [],
    backgroundBoosts: [],
    classBoosts: [],
    mapLevelledBoosts: {}
  };
  const flaws = state.origin.alternateBoosts ? [] : ancestry?.ancestry?.flaws ?? [];
  for (const flaw of [...flaws, ...state.origin.voluntaryFlaws ?? []]) mod[flaw] -= 1;
  const voluntary = state.origin.voluntaryFlaws ?? [];
  if (voluntary.some((f) => flaws.includes(f))) {
    warnings.push({ code: "FLAW_TWICE", level: "warn", ref: "origin", message: tr("Mais de um flaw no mesmo atributo (Player Core pg. 23).", "More than one flaw on the same attribute (Player Core pg. 23).") });
  }
  breakdown.ancestryFlaws = [...flaws, ...voluntary];
  for (const group of groups) {
    const picks = group.chosen.slice(0, group.count);
    const all = [...group.fixed, ...picks];
    if (new Set(all).size !== all.length) {
      warnings.push({ code: "BOOST_DUPLICATE", level: "warn", ref: group.key, message: tr(`${group.label}: boosts do mesmo grupo v\xE3o para atributos diferentes.`, `${group.label}: boosts in the same group go to different attributes.`) });
    }
    if (group.oneOf && picks.length === 2 && !picks.some((p) => group.options.includes(p))) {
      warnings.push({ code: "BOOST_NOT_ALLOWED", level: "warn", ref: group.key, message: tr(`Background: um dos boosts precisa ser ${group.options.map(attributeLabel).join(" ou ")}.`, `Background: one boost must be ${group.options.map(attributeLabel).join(" or ")}.`) });
    }
    if (!group.oneOf && group.options.length && picks.some((p) => !group.options.includes(p))) {
      warnings.push({ code: "BOOST_NOT_ALLOWED", level: "warn", ref: group.key, message: tr(`${group.label}: escolha fora das op\xE7\xF5es.`, `${group.label}: choice outside the options.`) });
    }
    if (group.chosen.length > group.count) {
      warnings.push({ code: "BOOST_TOO_MANY", level: "warn", ref: group.key, message: tr(`${group.label}: boosts a mais foram ignorados.`, `${group.label}: extra boosts were ignored.`) });
    }
    if (picks.length < group.count) pending.push({ key: group.key, label: group.label, level: group.level, missing: group.count - picks.length });
    const intBefore = mod.int;
    for (const a of new Set(all)) boost(a);
    if (group.level > 1 && mod.int > intBefore) intGains[group.level] = (intGains[group.level] ?? 0) + (mod.int - intBefore);
    if (group.level === 1) intAt1 = mod.int;
    if (group.key === "boosts-ancestry") {
      breakdown.ancestryBoosts = group.fixed;
      breakdown.ancestryFree = picks;
    } else if (group.key === "boosts-background") breakdown.backgroundBoosts = picks;
    else if (group.key === "class-key") breakdown.classBoosts = all;
    else breakdown.mapLevelledBoosts[String(group.level)] = picks;
  }
  for (const [lvl, list] of Object.entries(state.manual.extraBoosts ?? {})) {
    if (Number(lvl) > state.level) continue;
    for (const a of new Set(list)) boost(a);
    warnings.push({ code: "MANUAL_BOOST", level: "info", ref: "manual", message: tr(`Boosts extras \xE0 m\xE3o no n\xEDvel ${lvl}: ${list.map(attributeLabel).join(", ")}.`, `Extra boosts by hand at level ${lvl}: ${list.map(attributeLabel).join(", ")}.`) });
  }
  if (Object.values(mod).some((v) => v > 4) && state.level === 1) {
    warnings.push({ code: "ATTR_OVER_4", level: "warn", message: tr("No n\xEDvel 1, nenhum modificador passa de +4 (Player Core pg. 17).", "At 1st level, no modifier goes above +4 (Player Core pg. 17).") });
  }
  for (const [a, value] of Object.entries(state.manual.attributeOverride ?? {})) {
    mod[a] = value;
    partial[a] = false;
    warnings.push({ code: "ATTR_OVERRIDE", level: "info", ref: a, message: tr(`${attributeLabel(a)} definido \xE0 m\xE3o: ${value >= 0 ? "+" : ""}${value}.`, `${attributeLabel(a)} set by hand: ${value >= 0 ? "+" : ""}${value}.`) });
  }
  return { result: { mod, partial, breakdown }, groups, intGains, intAt1 };
}
var attributeScore = (mod, partial) => 10 + 2 * mod + (partial ? 1 : 0);

// src/modules/character-builder/engine/classArchetypes.ts
var CLASS_ARCHETYPE = "class-archetype";
var BLOODRAGER = "archetype:archetype-283";
var WAR_MAGE = "archetype:archetype-331";
var PALATINE_DETECTIVE = "archetype:archetype-306";
var RUNELORD = "archetype:archetype-303";
var ADVANCED_SCHOOL_SPELL = "feat:feat-5036";
var QUICK_IDENTIFICATION = "feat:feat-5195";
var CLASS_ARCHETYPES = {
  // War of Immortals pg. 60 (Archetypes.aspx?ID=283).
  [BLOODRAGER]: { className: "Barbarian", dedication: "feat:feat-7239", subclass: "instinct:instinct-14" },
  // Battlecry! pg. 68 (Archetypes.aspx?ID=331).
  [WAR_MAGE]: { className: "Wizard", dedication: "feat:feat-7976", subclass: "arcane-school:arcane-school-22" },
  // Divine Mysteries pg. 288 (Archetypes.aspx?ID=306): a metodologia Esoterica no lugar das outras.
  [PALATINE_DETECTIVE]: { className: "Investigator", dedication: "feat:feat-7557", subclass: "methodology:methodology-9" },
  // Rival Academies pg. 114 (Archetypes.aspx?ID=303): a School of Thassilonian Rune Magic como escola arcana.
  [RUNELORD]: { className: "Wizard", dedication: "feat:feat-7482", subclass: "arcane-school:arcane-school-25" }
};
var archetypeOfSubclass = (id) => id ? Object.entries(CLASS_ARCHETYPES).find(([, a]) => a.subclass === id)?.[0] : void 0;
function selectedClassArchetype(choice, cls) {
  if (!choice || !("id" in choice) || !cls || CLASS_ARCHETYPES[choice.id]?.className !== cls.name) return void 0;
  return choice.id;
}
function adjustedClass(cls, archetype) {
  if (!cls?.class) return cls;
  const c = cls.class;
  if (archetype === BLOODRAGER) {
    return { ...cls, class: { ...c, trainedSkills: { fixed: ["athletics", "medicine"], additional: 2 } } };
  }
  if (archetype === RUNELORD) {
    const features2 = (c.features ?? []).map((f) => f.name === "Arcane Thesis" ? { ...f, name: "Personal Rune" } : f);
    return { ...cls, class: { ...c, features: features2 } };
  }
  if (archetype !== WAR_MAGE) return cls;
  const replaced = ["Arcane Bond", "Arcane Thesis", "Defensive Robes"];
  const features = (c.features ?? []).filter((f) => !replaced.includes(f.name));
  return { ...cls, class: {
    ...c,
    defenses: { ...c.defenses, light: 1, medium: 1 },
    attacks: { ...c.attacks, martial: c.attacks?.simple },
    features: [{ level: 1, name: "War Magic" }, ...features]
  } };
}

// src/modules/character-builder/engine/skills.ts
var SKILL_SET = new Set(SKILL_KEYS);
var SKILL_INCREASE_CAP = [{ level: 15, rank: 4 }, { level: 7, rank: 3 }, { level: 1, rank: 2 }];
function skillRef(name) {
  const raw = name.trim();
  const lower2 = raw.toLowerCase();
  if (SKILL_SET.has(lower2)) return `skill:${lower2}`;
  const lore = lower2.replace(/\s*lore$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `lore:${lore || "lore"}`;
}
function loreName(ref, names = {}) {
  const key = ref.replace(/^lore:/, "");
  return names[key] ?? key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
var choiceSkills = (state, key) => {
  const choice = state.choices[key];
  return choice && "skills" in choice ? choice.skills : [];
};
function compileSkills(state, background, cls, intMod1, intGains, skillIncreaseLevels, pending, warnings, classArchetype, subclassTrained = [], featTrained = []) {
  const rank = Object.fromEntries(SKILL_KEYS.map((s) => [s, 0]));
  const lores = /* @__PURE__ */ new Map();
  const loreNames = {};
  const get = (ref) => ref.startsWith("skill:") ? rank[ref.slice(6)] ?? 0 : lores.get(ref) ?? 0;
  const set = (ref, value) => {
    if (ref.startsWith("skill:")) {
      const key = ref.slice(6);
      if (SKILL_SET.has(key)) rank[key] = value;
    } else lores.set(ref, value);
  };
  const automatic = [];
  let overlaps = 0;
  const train = (ref, source, auto) => {
    if (get(ref) >= 1) {
      overlaps += 1;
      return;
    }
    set(ref, 1);
    if (auto) automatic.push({ ref, source });
  };
  for (const name of background?.background?.skills ?? []) {
    const ref = skillRef(name);
    if (ref.startsWith("lore:")) loreNames[ref.slice(5)] = name.replace(/\s*Lore$/i, "");
    train(ref, background?.name ?? "", true);
  }
  for (const skill of cls?.class?.trainedSkills?.fixed ?? []) train(skillRef(skill), cls?.name ?? "", true);
  for (const t of subclassTrained) train(t.ref, t.source, true);
  const slots = [];
  if (backgroundLoreChoice(background)) {
    const key = "lore-background";
    const chosen = choiceSkills(state, key).filter((s) => s.startsWith("lore:")).slice(0, 1);
    slots.push({ key, label: tr(`${background.name}: Lore`, `${background.name}: Lore`), level: 1, count: 1, options: [], loreOnly: true, kind: "train", chosen });
    for (const ref of chosen) train(ref, background.name, false);
  }
  ;
  (cls?.class?.trainedSkills?.choices ?? []).forEach((options, i) => {
    const key = `class-skill-${i + 1}`;
    const chosen = choiceSkills(state, key).slice(0, 1);
    slots.push({ key, label: tr(`${cls?.name}: per\xEDcia \xE0 escolha`, `${cls?.name}: skill choice`), level: 1, count: 1, options: options.map(skillRef), kind: "train", chosen });
    if (chosen[0] && !options.map(skillRef).includes(chosen[0])) {
      warnings.push({ code: "SKILL_NOT_ALLOWED", level: "warn", ref: key, message: tr("Per\xEDcia fora das op\xE7\xF5es da classe.", "Skill outside the class options.") });
    }
    for (const ref of chosen) train(ref, cls?.name ?? "", false);
  });
  if (classArchetype === PALATINE_DETECTIVE) {
    const key = "skills-esoterica";
    const options = ["skill:occultism", "skill:religion"];
    const chosen = choiceSkills(state, key).filter((s) => options.includes(s)).slice(0, 1);
    slots.push({ key, label: "Esoterica", level: 1, count: 1, options, kind: "train", chosen });
    if (chosen[0]) train(chosen[0], "Esoterica", false);
  }
  if (cls) {
    const additional = (cls.class?.trainedSkills?.additional ?? 0) + intMod1;
    const count = Math.max(0, additional) + overlaps;
    const chosen = choiceSkills(state, "skills-1");
    slots.push({ key: "skills-1", label: tr("Per\xEDcias treinadas", "Trained skills"), level: 1, count, options: [], kind: "train", chosen });
    for (const ref of chosen.slice(0, count)) train(ref, "", false);
  }
  const dedication = state.choices["class-feat-2"];
  const hasDedication = classArchetype && state.level >= 2 && dedication && "id" in dedication && dedication.id === CLASS_ARCHETYPES[classArchetype]?.dedication;
  let warfareLore = false;
  if (hasDedication) {
    const skill = state.choices["class-feat-2/choice:skill"];
    let ref;
    if (classArchetype === WAR_MAGE) ref = "lore:warfare";
    if (classArchetype === BLOODRAGER && skill && "value" in skill && ["arcana", "religion"].includes(skill.value)) ref = skillRef(skill.value);
    if (ref) {
      warfareLore = classArchetype === WAR_MAGE;
      const label = warfareLore ? "War Mage Dedication" : "Bloodrager Dedication";
      if (get(ref) === 0) train(ref, label, true);
      else {
        const key = "skills-dedication-2";
        const chosen = choiceSkills(state, key);
        const valid = chosen.filter((s) => (!warfareLore || s.startsWith("lore:")) && get(s) === 0);
        slots.push({ key, label, level: 2, count: 1, kind: "train", options: [], loreOnly: warfareLore, chosen });
        if (valid[0]) train(valid[0], label, false);
        if (chosen.length && !valid.length) warnings.push({
          code: "SKILL_NOT_ALLOWED",
          level: "warn",
          ref: key,
          message: tr("Escolha um novo treino para a dedica\xE7\xE3o.", "Choose a new trained skill for your dedication.")
        });
      }
    }
  }
  for (const [level, gain] of Object.entries(intGains)) {
    const key = `skills-int-${level}`;
    const chosen = choiceSkills(state, key);
    slots.push({ key, label: tr(`Per\xEDcia pela INT (n\xEDvel ${level})`, `Skill from INT (level ${level})`), level: Number(level), count: gain, options: [], kind: "train", chosen });
    for (const ref of chosen.slice(0, gain)) train(ref, "", false);
  }
  const pendingFeatTraining = [...featTrained].filter((t) => t.level <= state.level).sort((a, b) => a.level - b.level);
  const featTrainUpTo = (level) => {
    while (pendingFeatTraining.length && pendingFeatTraining[0].level <= level) {
      const t = pendingFeatTraining.shift();
      if (get(t.ref) === 0) set(t.ref, 1);
    }
  };
  for (const level of skillIncreaseLevels) {
    if (level > state.level) break;
    featTrainUpTo(level);
    const key = `skill-increase-${level}`;
    const chosen = choiceSkills(state, key).slice(0, 1);
    slots.push({ key, label: tr(`Aumento de per\xEDcia (n\xEDvel ${level})`, `Skill increase (level ${level})`), level, count: 1, options: [], kind: "increase", chosen });
    for (const ref of chosen) {
      const cap = SKILL_INCREASE_CAP.find((c) => level >= c.level)?.rank ?? 2;
      const next = Math.min(4, get(ref) + 1);
      if (next > cap) {
        warnings.push({ code: "SKILL_RANK_CAP", level: "warn", ref: key, message: tr(`N\xEDvel ${level}: ${next === 3 ? "mestre s\xF3 a partir do 7" : "lend\xE1rio s\xF3 a partir do 15"} (Player Core pg. 92).`, `Level ${level}: ${next === 3 ? "master only from 7th" : "legendary only from 15th"} (Player Core pg. 92).`) });
      }
      set(ref, next);
    }
  }
  featTrainUpTo(20);
  if (warfareLore) {
    const rank2 = 1 + [3, 7, 15].filter((l) => state.level >= l).length;
    set("lore:warfare", Math.max(rank2, get("lore:warfare")));
  }
  for (const [lvl, count] of Object.entries(state.manual.extraSkillIncreases ?? {})) {
    const level = Number(lvl);
    if (level > state.level) continue;
    for (let i = 1; i <= count; i++) {
      const key = `skill-increase-${level}-extra-${i}`;
      const chosen = choiceSkills(state, key).slice(0, 1);
      slots.push({ key, label: tr(`Aumento extra (n\xEDvel ${level}, ajuste)`, `Extra increase (level ${level}, adjustment)`), level, count: 1, options: [], kind: "increase", chosen });
      for (const ref of chosen) set(ref, Math.min(4, get(ref) + 1));
    }
    warnings.push({ code: "MANUAL_SKILL", level: "info", ref: "manual", message: tr(`${count} aumento(s) de per\xEDcia extra(s) \xE0 m\xE3o no n\xEDvel ${level}.`, `${count} extra skill increase(s) by hand at level ${level}.`) });
  }
  for (const slot of slots) {
    const missing = slot.count - Math.min(slot.count, slot.chosen.length);
    if (missing > 0) pending.push({ key: slot.key, label: slot.label, level: slot.level, missing });
    if (slot.chosen.length > slot.count) {
      warnings.push({ code: "SKILL_TOO_MANY", level: "warn", ref: slot.key, message: tr(`${slot.label}: escolhas a mais foram ignoradas.`, `${slot.label}: extra choices were ignored.`) });
    }
  }
  return {
    result: {
      rank,
      lores: [...lores].filter(([, r]) => r > 0).map(([key, r]) => ({ key, name: loreName(key, loreNames), rank: r }))
    },
    slots,
    automatic,
    languageSlots: Math.max(0, intMod1) + Object.values(intGains).reduce((a, b) => a + b, 0)
  };
}
function backgroundLoreChoice(background) {
  if (!background) return false;
  if ((background.background?.skills ?? []).some((n) => /lore/i.test(n))) return false;
  return (background.unsupported ?? []).some((u) => /^Lore\b/i.test(u.trim()) || /\bLore for\b/i.test(u));
}

// src/modules/character-builder/engine/prereqs.ts
var RANKS = { trained: 1, expert: 2, master: 3, legendary: 4 };
var RANK_PT = {
  trained: tr("treinado", "trained"),
  expert: tr("perito", "expert"),
  master: tr("mestre", "master"),
  legendary: tr("lend\xE1rio", "legendary")
};
var ATTR = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha"
};
function splitParts(text) {
  return text.split(/;|,(?![^()]*\))/).map((p) => p.trim()).filter(Boolean);
}
function evalOne(raw, ctx) {
  const text = raw.trim();
  const lower2 = text.toLowerCase().replace(/\.$/, "");
  if (/\bor\b/.test(lower2) && !/^(trained|expert|master|legendary) in \w+ or \w+$/.test(lower2)) {
    const alts = lower2.split(/\s*,?\s*\bor\b\s*/).filter(Boolean);
    const results = alts.map((a) => evalOne(a, ctx).result);
    const result = results.includes("ok") ? "ok" : results.every((r) => r === "fail") ? "fail" : "unknown";
    return { text, result, ...result === "fail" ? { reason: tr(`nenhuma das op\xE7\xF5es: ${text}`, `none of: ${text}`) } : {} };
  }
  const rank = /^(trained|expert|master|legendary) in (?:the )?(.+)$/.exec(lower2);
  if (rank) {
    const need = RANKS[rank[1]];
    const targets = rank[2].split(/\s+or\s+/);
    let anyKnown = false;
    for (const target of targets) {
      const t = target.trim();
      let have = null;
      if (SKILL_KEYS.includes(t)) have = ctx.skillRank(t);
      else if (t === "perception") have = ctx.stat.perception ?? 0;
      else if (/^(fortitude|reflex|will)( saves?)?$/.test(t)) have = ctx.stat[t.split(" ")[0]] ?? 0;
      else if (/ lore$/.test(t) && !/\ba lore\b|\bany\b/.test(t)) have = ctx.loreRank(t.replace(/ lore$/, ""));
      else if (t === "at least one skill") have = Math.max(...SKILL_KEYS.map((s) => ctx.skillRank(s)));
      if (have === null) continue;
      anyKnown = true;
      if (have >= need) return { text, result: "ok" };
    }
    if (!anyKnown) return { text, result: "unknown" };
    return { text, result: "fail", reason: tr(`precisa ser ${RANK_PT[rank[1]]} em ${rank[2]}`, `needs ${RANK_PT[rank[1]]} in ${rank[2]}`) };
  }
  const attr = /^(strength|dexterity|constitution|intelligence|wisdom|charisma) \+?(\d)$/.exec(lower2);
  if (attr) {
    const have = ctx.attribute[ATTR[attr[1]]];
    return have >= Number(attr[2]) ? { text, result: "ok" } : { text, result: "fail", reason: tr(`${text} (tem ${have >= 0 ? "+" : ""}${have})`, `${text} (has ${have >= 0 ? "+" : ""}${have})`) };
  }
  const heritage = /^(.+?) (heritage|ancestry)$/.exec(lower2);
  if (heritage) {
    const name = heritage[1];
    const mine = [ctx.heritageName, ctx.ancestryName].filter(Boolean).map((n) => n.toLowerCase());
    return mine.includes(name) ? { text, result: "ok" } : { text, result: "fail", reason: tr(`precisa de ${text}`, `needs ${text}`) };
  }
  if (ctx.ancestryName && lower2 === ctx.ancestryName.toLowerCase()) return { text, result: "ok" };
  if (/^(you )?(follow|worship) a deity$/.test(lower2)) return ctx.deity ? { text, result: "ok" } : { text, result: "fail", reason: tr("precisa de uma divindade", "needs a deity") };
  if (ctx.has.has(lower2)) return { text, result: "ok" };
  if (/^[A-Z][\w'’-]*( [A-Z(][\w'’()-]*)*$/.test(text) && text.split(" ").length <= 5) {
    return { text, result: "fail", reason: tr(`precisa de ${text}`, `needs ${text}`) };
  }
  return { text, result: "unknown" };
}
function evaluatePrereqs(text, ctx) {
  if (!text?.trim()) return { result: "ok", parts: [] };
  const parts = splitParts(text).map((p) => evalOne(p, ctx));
  const result = parts.some((p) => p.result === "fail") ? "fail" : parts.some((p) => p.result === "unknown") ? "unknown" : "ok";
  return { result, parts };
}

// src/modules/character-builder/engine/slots.ts
var FEATURE_SLOTS = [
  { name: /^combat flexibility$/i, kind: "class", maxLevel: 8, key: "flexibility" },
  { name: /^improved flexibility$/i, kind: "class", maxLevel: 14, key: "flexibility" }
];
function variantFlags(state, mesa) {
  const own = state.options.variants ?? {};
  const v = mesa?.variants;
  return {
    freeArchetype: own.freeArchetype ?? v?.freeArchetype ?? false,
    mythic: state.options.mythic?.enabled ?? v?.mythic.enabled ?? false,
    ancestralParagon: own.ancestralParagon ?? v?.ancestralParagon ?? false,
    abp: own.abp ?? v?.abp ?? false
  };
}
var KIND_LABEL = {
  ancestry: tr("Talento de ancestralidade", "Ancestry feat"),
  class: tr("Talento de classe", "Class feat"),
  general: tr("Talento geral", "General feat"),
  skill: tr("Talento de per\xEDcia", "Skill feat"),
  archetype: tr("Arqu\xE9tipo livre", "Free archetype"),
  mythic: tr("Talento m\xEDtico", "Mythic feat"),
  paragon: tr("Ancestry Paragon", "Ancestry Paragon")
};
var featKindLabel = (kind) => KIND_LABEL[kind];
var EVEN = Array.from({ length: 10 }, (_, i) => (i + 1) * 2);
var ODD = Array.from({ length: 10 }, (_, i) => i * 2 + 1);
function featSlots(cls, flags) {
  const slots = [];
  const add = (kind, levels) => {
    for (const level of levels) slots.push({ key: `${kind}-feat-${level}`, kind, level, label: KIND_LABEL[kind] });
  };
  const fl = cls?.class?.featLevels;
  const ancestryLevels = fl?.ancestry ?? [1, 5, 9, 13, 17];
  add("ancestry", ancestryLevels);
  if (cls) {
    add("class", fl?.class ?? []);
    add("general", fl?.general ?? []);
    add("skill", fl?.skill ?? []);
  }
  for (const feature of cls?.class?.features ?? []) {
    const spec = FEATURE_SLOTS.find((f) => f.name.test(feature.name));
    if (spec) slots.push({ key: `${spec.key}-feat-${feature.level}`, kind: spec.kind, level: feature.level, maxLevel: spec.maxLevel, label: feature.name });
  }
  if (flags.freeArchetype) add("archetype", EVEN);
  if (flags.mythic) add("mythic", EVEN);
  if (flags.ancestralParagon) add("paragon", [1, ...ODD.filter((l) => l > 1 && !ancestryLevels.includes(l))]);
  const order = ["ancestry", "paragon", "class", "archetype", "skill", "general", "mythic"];
  return slots.sort((a, b) => a.level - b.level || order.indexOf(a.kind) - order.indexOf(b.kind));
}
function fitsSlot(feat, kind, ctx) {
  const traits = new Set((feat.traits ?? []).map((t) => t.toLowerCase()));
  switch (kind) {
    case "class":
      return !!ctx.className && traits.has(ctx.className.toLowerCase()) || traits.has("archetype");
    case "archetype":
      return traits.has("archetype");
    case "ancestry":
    case "paragon":
      return ctx.ancestryTraits.some((t) => traits.has(t.toLowerCase()));
    case "general":
      return traits.has("general");
    case "skill":
      return traits.has("skill");
    case "mythic":
      return traits.has("mythic");
  }
}

// src/modules/character-builder/engine/feats.ts
var STAT_SELECTORS = /* @__PURE__ */ new Set(["perception", "fortitude", "reflex", "will"]);
function numeric(value, level) {
  if (typeof value === "number") return value;
  if (value === "@actor.level") return level;
  return null;
}
function rankTarget(path) {
  let m = /^system\.skills\.([a-z-]+)\.rank$/.exec(path);
  if (m) return SKILL_KEYS.includes(m[1]) ? `skill:${m[1]}` : `lore:${m[1].replace(/-lore$/, "")}`;
  m = /^system\.saves\.(fortitude|reflex|will)\.rank$/.exec(path);
  if (m) return m[1];
  if (path === "system.perception.rank" || path === "system.attributes.perception.rank") return "perception";
  m = /^system\.proficiencies\.(attacks|defenses)\.([a-z-]+)\.rank$/.exec(path);
  if (m) return `${m[1] === "attacks" ? "attack" : "defense"}:${m[2]}`;
  m = /^system\.proficiencies\.classDCs?\.[a-z-]+\.rank$/.exec(path);
  if (m) return "classDC";
  return null;
}
var choiceKey = (slot, flag) => `${slot}/choice:${flag}`;
function parseFilter(filter) {
  const out = { traits: [] };
  for (const part of filter) {
    if (typeof part !== "string") continue;
    let m = /^item:level:(\d+)$/.exec(part);
    if (m) out.maxLevel = Number(m[1]);
    m = /^item:category:([a-z]+)$/.exec(part);
    if (m) out.category = m[1];
    m = /^item:trait:([a-z-]+)$/.exec(part);
    if (m) out.traits.push(m[1]);
  }
  return out;
}
function compileFeats(state, slots, rules, ctx, warnings) {
  const mods = { hp: 0, hpPerLevel: 0, speed: 0, stat: {}, skill: {}, ranks: {}, sources: [], senses: [], speeds: {}, resistances: [], weaknesses: [], immunities: [] };
  const taken = [];
  const children = [];
  const has = ctx.has;
  const level = ctx.level;
  const upgrade = (target, value) => {
    const rank = Math.max(0, Math.min(4, value));
    if ((mods.ranks[target] ?? 0) < rank) mods.ranks[target] = rank;
  };
  const apply = (entry, slot, slotLevel, depth) => {
    const selections = {};
    for (const rule of entry.rules ?? []) {
      if (rule.situational) continue;
      if (rule.key === "ChoiceSet" && typeof rule.flag === "string") {
        const key = choiceKey(slot, rule.flag);
        const raw = state.choices[key];
        const chosen = raw && ("value" in raw ? raw.value : "id" in raw ? raw.id : void 0);
        const child = { key, parent: slot, label: `${entry.name}: ${tr("escolha", "choice")}`, level: slotLevel, kind: "value", chosen };
        if (Array.isArray(rule.choices)) {
          child.options = rule.choices.filter((c) => typeof c.value === "string").map((c) => ({ value: c.value, label: typeof c.label === "string" ? c.label : c.value }));
        } else if (rule.choices && typeof rule.choices === "object") {
          const spec = rule.choices;
          if (spec.config === "skills") {
            child.kind = "skill";
            child.options = SKILL_KEYS.map((s) => ({ value: s, label: s }));
          } else if (Array.isArray(spec.filter)) {
            child.kind = "feat";
            child.filter = parseFilter(spec.filter);
          } else continue;
        } else continue;
        children.push(child);
        if (chosen) selections[rule.flag] = chosen;
        if (chosen && child.kind === "feat" && depth < 2) {
          const feat = rules.get(chosen);
          if (feat) take(feat, key, slotLevel, "child", depth + 1);
        }
        continue;
      }
      if (rule.key === "GrantItem" && typeof rule.uuid === "string" && depth < 2) {
        if (entry.id === CLASS_ARCHETYPES[BLOODRAGER].subclass && rule.flag === "bloodragerDedication") continue;
        const granted = grantedFeat(rule, rules, ctx.missing);
        if (granted && !has.has(granted.name.toLowerCase())) take(granted, `${slot}/grant:${granted.aon.id}`, slotLevel, "granted", depth + 1);
        continue;
      }
      if (rule.predicate) continue;
      if (rule.key === "Sense" && typeof rule.selector === "string") {
        const name = rule.selector.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const range = numeric(rule.range, level);
        const label = range ? `${name} ${range} ft` : name;
        if (!mods.senses.some((x) => x.toLowerCase().startsWith(name.toLowerCase()))) mods.senses.push(label);
        continue;
      }
      if (rule.key === "BaseSpeed" && typeof rule.selector === "string") {
        const value = numeric(rule.value, level);
        if (value !== null) mods.speeds[rule.selector] = Math.max(mods.speeds[rule.selector] ?? 0, value);
        continue;
      }
      if ((rule.key === "Resistance" || rule.key === "Weakness" || rule.key === "Immunity") && typeof rule.type === "string") {
        const value = rule.key === "Immunity" ? 0 : numeric(rule.value, level);
        if (value === null) continue;
        const list = rule.key === "Resistance" ? mods.resistances : rule.key === "Weakness" ? mods.weaknesses : mods.immunities;
        list.push(rule.key === "Immunity" ? rule.type : `${rule.type} ${value}`);
        continue;
      }
      if (rule.key === "FlatModifier" && typeof rule.selector === "string") {
        const value = numeric(rule.value, level);
        const type = typeof rule.type === "string" ? rule.type : "untyped";
        if (value === null || !["untyped", "item"].includes(type)) continue;
        const sel = rule.selector;
        if (sel === "hp") mods.hp += value;
        else if (sel === "hp-per-level") mods.hpPerLevel += value;
        else if (sel === "land-speed" || sel === "speed") mods.speed += value;
        else if (STAT_SELECTORS.has(sel)) mods.stat[sel] = (mods.stat[sel] ?? 0) + value;
        else if (SKILL_KEYS.includes(sel)) mods.skill[sel] = (mods.skill[sel] ?? 0) + value;
        else continue;
        mods.sources.push({ label: entry.name, target: sel, value });
        continue;
      }
      if (rule.key === "ActiveEffectLike" && rule.mode === "upgrade" && typeof rule.path === "string") {
        const path = rule.path.replace(/\{item\|flags\.system\.rulesSelections\.([\w-]+)\}/g, (_, flag) => selections[flag] ?? "?");
        const target = path.includes("?") ? null : rankTarget(path);
        const value = numeric(rule.value, level);
        if (target && value !== null) upgrade(target, value);
      }
    }
  };
  const take = (entry, slot, slotLevel, kind, depth) => {
    const prereq = evaluatePrereqs(entry.prerequisites?.text, ctx.prereqContext());
    taken.push({ slot, level: slotLevel, entry, kind, prereq });
    has.add(entry.name.toLowerCase());
    apply(entry, slot, slotLevel, depth);
  };
  for (const award of ctx.awarded) if (award.level <= level) take(award.entry, `awarded:${award.entry.aon.id}`, award.level, "granted", 0);
  const seen = /* @__PURE__ */ new Map();
  let openDedication = null;
  for (const slot of slots) {
    if (slot.level > level) continue;
    const raw = state.choices[slot.key];
    if (!raw || !("id" in raw)) continue;
    const entry = rules.get(raw.id);
    if (!entry) {
      warnings.push({ code: "ENTRY_NOT_FOUND", level: "error", ref: slot.key, message: tr(`${slot.label} ${slot.level}: talento fora do cat\xE1logo atual (${raw.id}).`, `${slot.label} ${slot.level}: feat not in the current catalog (${raw.id}).`) });
      continue;
    }
    const cap = slot.maxLevel ?? slot.level;
    if ((entry.level ?? 0) > cap) {
      warnings.push({ code: "LEVEL_TOO_LOW", level: "warn", ref: slot.key, message: tr(`${entry.name} \xE9 de n\xEDvel ${entry.level}, acima do limite do slot (${cap}).`, `${entry.name} is level ${entry.level}, above the slot limit (${cap}).`) });
    }
    if (!fitsSlot(entry, slot.kind, { className: ctx.className, ancestryTraits: ctx.ancestryTraits })) {
      warnings.push({ code: "WRONG_SLOT", level: "warn", ref: slot.key, message: tr(`${entry.name} n\xE3o \xE9 ${slot.label.toLowerCase()}.`, `${entry.name} is not a ${slot.label.toLowerCase()}.`) });
    }
    const before = seen.get(entry.id);
    if (before && !/\b(special|more than once|multiple times)\b/i.test(entry.summary ?? "")) {
      warnings.push({ code: "DUPLICATE_FEAT", level: "info", ref: slot.key, message: tr(`${entry.name} j\xE1 foi escolhido (${before}); confira se pode repetir.`, `${entry.name} was already chosen (${before}); check that it can repeat.`) });
    }
    seen.set(entry.id, `${slot.label} ${slot.level}`);
    const traits = (entry.traits ?? []).map((t) => t.toLowerCase());
    const archetype = entry.feat?.archetype?.[0];
    if (traits.includes("dedication")) {
      if (openDedication && openDedication.count < 2) {
        warnings.push({ code: "DEDICATION_LOCK", level: "warn", ref: slot.key, message: tr(`${entry.name}: antes de outra dedica\xE7\xE3o, faltam ${2 - openDedication.count} talento(s) de ${openDedication.name} (Player Core pg. 215).`, `${entry.name}: before another dedication, ${2 - openDedication.count} more ${openDedication.name} feat(s) are needed (Player Core pg. 215).`) });
      }
      openDedication = { name: entry.name, archetype: archetype ?? entry.name.replace(/ Dedication$/i, ""), count: 0 };
    } else if (openDedication && archetype && archetype.toLowerCase() === openDedication.archetype.toLowerCase()) {
      openDedication.count++;
    }
    take(entry, slot.key, slot.level, slot.kind, 0);
  }
  for (const feat of taken) {
    for (const part of feat.prereq.parts) {
      if (part.result === "fail") warnings.push({ code: "PREREQ_FAIL", level: "warn", ref: feat.slot, message: tr(`${feat.entry.name}: ${part.reason ?? part.text}.`, `${feat.entry.name}: ${part.reason ?? part.text}.`) });
      else if (part.result === "unknown") warnings.push({ code: "PREREQ_UNKNOWN", level: "info", ref: feat.slot, message: tr(`${feat.entry.name}: confira o pr\xE9-requisito "${part.text}".`, `${feat.entry.name}: check the prerequisite "${part.text}".`) });
    }
    for (const effect of feat.entry.unsupported ?? []) {
      warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: feat.slot, message: tr(`Efeito n\xE3o calculado: ${feat.entry.name} (${effect}).`, `Effect not calculated: ${feat.entry.name} (${effect}).`) });
    }
  }
  return { taken, children, mods, has };
}

// src/modules/character-builder/engine/spells.ts
var TRADITIONS = ["arcane", "divine", "occult", "primal"];
var SPELLBOOK_CLASSES = /* @__PURE__ */ new Set(["wizard", "magus"]);
function compileCasters(state, cls, ctx, pending, warnings, used) {
  const casting = cls?.class?.casting;
  if (!cls || !casting) return [];
  const row = ctx.table?.classes[cls.name];
  if (casting.type === "mixed" || !casting.type) {
    warnings.push({ code: "UNSUPPORTED_CASTING", level: "info", ref: "spells", message: tr(`Conjura\xE7\xE3o de ${cls.name} ainda n\xE3o calculada (preparado e repert\xF3rio juntos).`, `${cls.name} spellcasting is not calculated yet (prepared and repertoire together).`) });
    return [];
  }
  if (!row) {
    warnings.push({ code: "UNSUPPORTED_CASTING", level: "info", ref: "spells", message: tr(`Sem tabela de magias por dia para ${cls.name}.`, `No spell slot table for ${cls.name}.`) });
    return [];
  }
  let tradition = casting.traditions.length === 1 ? casting.traditions[0] : null;
  if (!tradition) {
    const key = "spell-tradition";
    used.add(key);
    const raw = state.choices[key];
    const chosen = raw && "value" in raw && TRADITIONS.includes(raw.value) ? raw.value : null;
    if (chosen) tradition = chosen;
    else pending.push({ key, label: tr("Tradi\xE7\xE3o das magias (pela subclasse)", "Spell tradition (from the subclass)"), level: 1, missing: 1 });
  }
  const attribute = casting.attribute ?? ctx.keyAttribute ?? "int";
  const perDay = Array.from({ length: 11 }, (_, r) => {
    const n = row.perDay[String(ctx.level)]?.[r] ?? 0;
    return Array.isArray(n) ? n[0] : n;
  });
  const bonus = state.spellcasting.class?.bonusSlots ?? {};
  for (const [rank, extra] of Object.entries(bonus)) perDay[Number(rank)] = (perDay[Number(rank)] ?? 0) + extra;
  const prof = ctx.spellRank > 0 ? ctx.level + 2 * ctx.spellRank : 0;
  return [{
    key: "class",
    name: cls.name,
    tradition,
    type: casting.type,
    attribute,
    rank: ctx.spellRank,
    perDay,
    dc: 10 + prof + ctx.mod[attribute],
    attack: prof + ctx.mod[attribute],
    spellbook: casting.type === "prepared" && SPELLBOOK_CLASSES.has(cls.name.toLowerCase()),
    source: row.source
  }];
}
function checkSpellChoices(state, casters, spells, pending, warnings, level = 1) {
  for (const caster of casters) {
    const choices = state.spellcasting[caster.key] ?? {};
    const lists = caster.type === "spontaneous" ? choices.repertoire ?? {} : choices.prepared ?? {};
    for (let rank = 0; rank <= 10; rank++) {
      const slots = caster.perDay[rank] ?? 0;
      const chosen = lists[String(rank)] ?? [];
      if (caster.type === "prepared" && slots > chosen.length) {
        pending.push({ key: `spells:${caster.key}:${rank}`, label: tr(`${caster.name}: magias de rank ${rank}`, `${caster.name}: rank ${rank} spells`), level, missing: slots - chosen.length });
      }
      for (const id of chosen) {
        const spell = spells(id);
        if (!spell) continue;
        const sr = spell.spell?.rank ?? spell.level ?? 0;
        const cantrip = spell.spell?.cantrip ?? false;
        if (rank === 0 !== cantrip || rank > 0 && sr > rank) {
          warnings.push({ code: "SPELL_RANK", level: "warn", ref: `spells:${caster.key}:${rank}`, message: tr(`${spell.name} n\xE3o cabe no rank ${rank}.`, `${spell.name} does not fit rank ${rank}.`) });
        }
        if (caster.tradition && !(spell.spell?.traditions ?? []).some((t) => t.toLowerCase() === caster.tradition)) {
          warnings.push({ code: "SPELL_TRADITION", level: "warn", ref: `spells:${caster.key}:${rank}`, message: tr(`${spell.name} n\xE3o \xE9 da tradi\xE7\xE3o ${caster.tradition}.`, `${spell.name} is not on the ${caster.tradition} list.`) });
        }
      }
    }
    if (caster.key === "archetype:bloodrager") {
      const cantrips = lists["0"] ?? [];
      if (cantrips.length < 2) pending.push({ key: "spells:archetype:bloodrager:0", label: tr("Truques de Bloodrager", "Bloodrager cantrips"), level: 2, missing: 2 - cantrips.length });
      if (cantrips.length > 2 || !cantrips.some((id) => spells(id)?.traits?.includes("Attack"))) {
        warnings.push({ code: "BLOODRAGER_CANTRIPS", level: "warn", ref: "spells", message: tr(
          "Escolha dois truques de Bloodrager e confira se pelo menos um exige uma rolagem de ataque de magia.",
          "Choose two Bloodrager cantrips and check that at least one requires a spell attack roll."
        ) });
      }
    } else if (caster.type === "spontaneous") {
      warnings.push({ code: "REPERTOIRE_SIZE", level: "info", ref: `spells:${caster.key}`, message: tr(`${caster.name}: o tamanho do repert\xF3rio por rank ainda n\xE3o \xE9 conferido (veja a tabela da classe).`, `${caster.name}: repertoire size per rank is not checked yet (see the class table).`) });
    }
  }
}
function compileFocus(granted, level) {
  const unique = [...new Map(granted.filter((s) => s.spell?.focus || (s.traits ?? []).includes("Focus")).map((s) => [s.id, s])).values()];
  const cantrips = unique.filter((s) => s.spell?.cantrip || (s.traits ?? []).includes("Cantrip"));
  const spells = unique.filter((s) => !cantrips.includes(s));
  return { spells, cantrips, points: Math.min(3, spells.length), heightened: Math.ceil(level / 2) };
}
function compileArchetypeCasters(state, taken, ctx, pending, warnings, used) {
  const names = new Set(taken.map((t) => t.entry.name.toLowerCase()));
  const out = [];
  const takenIds = new Set(taken.map((t) => t.entry.id));
  for (const { entry, slot } of taken) {
    const bloodrager = ctx.classArchetype === BLOODRAGER && entry.id === CLASS_ARCHETYPES[BLOODRAGER].dedication;
    const casting = bloodrager ? { className: "Bloodrager", type: "spontaneous", attribute: "cha", cantrips: 2, tradition: void 0 } : entry.feat?.casting;
    if (!casting?.type || !casting.className) continue;
    const cls = casting.className;
    const slug = cls.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const key = `archetype:${slug}`;
    let tradition = casting.tradition ?? null;
    if (bloodrager) {
      const skill = state.choices[`${slot}/choice:skill`];
      if (skill && "value" in skill) tradition = skill.value === "arcana" ? "arcane" : skill.value === "religion" ? "divine" : null;
    } else if (!tradition) {
      const options = ctx.classByName(cls)?.class?.casting?.traditions ?? [];
      if (options.length === 1) tradition = options[0];
      else {
        const choiceKey2 = `spell-tradition-${slug}`;
        used.add(choiceKey2);
        const raw = state.choices[choiceKey2];
        if (raw && "value" in raw && TRADITIONS.includes(raw.value)) tradition = raw.value;
        else pending.push({ key: choiceKey2, label: tr(`Tradi\xE7\xE3o do arqu\xE9tipo ${cls}`, `${cls} archetype tradition`), level: 1, missing: 1 });
      }
    }
    const attribute = casting.attribute ?? ctx.keyAttribute ?? "cha";
    if (!casting.attribute) warnings.push({ code: "ARCHETYPE_ATTRIBUTE", level: "info", ref: "spells", message: tr(`${cls} (arqu\xE9tipo): atributo de conjura\xE7\xE3o assumido como o atributo-chave; confira.`, `${cls} (archetype): spellcasting attribute assumed to be the key attribute; check it.`) });
    const tiers = ["basic", "expert", "master"];
    const bloodMagic = { basic: "feat:feat-7241", expert: "feat:feat-7245", master: "feat:feat-7246" };
    const perDay = Array.from({ length: 11 }, () => 0);
    perDay[0] = casting.cantrips ?? 0;
    let rank = 1;
    for (const tier of tiers) {
      const hasTier = bloodrager ? takenIds.has(bloodMagic[tier]) : names.has(`${tier} ${cls.toLowerCase()} spellcasting`);
      if (!hasTier) continue;
      if (tier === "expert") rank = Math.max(rank, 2);
      if (tier === "master") rank = Math.max(rank, 3);
      for (const [lvl, r] of Object.entries(ctx.table?.[tier] ?? {})) if (Number(lvl) <= ctx.level) perDay[r] = Math.max(perDay[r], 1);
    }
    if (bloodrager && takenIds.has(bloodMagic.master)) {
      for (let r = 1; r < perDay.length; r++) if (perDay[r]) perDay[r]++;
    }
    const prof = ctx.level + 2 * rank;
    out.push({
      key,
      name: `Archetype ${cls}`,
      tradition,
      type: casting.type,
      attribute,
      rank,
      perDay,
      dc: 10 + prof + ctx.mod[attribute],
      attack: prof + ctx.mod[attribute],
      spellbook: casting.type === "prepared" && SPELLBOOK_CLASSES.has(cls.toLowerCase()),
      source: "Player Core pg. 215"
    });
  }
  return out;
}

// src/modules/character-builder/engine/equipment.ts
var ATTR_LABEL2 = { str: tr("FOR", "STR"), dex: tr("DES", "DEX"), con: "CON", int: "INT", wis: tr("SAB", "WIS"), cha: tr("CAR", "CHA") };
var COINS_GP = (m) => m.pp * 10 + m.gp + m.sp / 10 + m.cp / 100;
var bulkOf = (b) => b === "L" ? 0.1 : typeof b === "number" ? b : 0;
var TRAIT = (t) => t.toLowerCase().split(" ")[0];
var STRIKING_NAME = ["", "Striking", "Greater Striking", "Major Striking"];
var GROUP_FEATURES = [
  { name: /^fighter weapon mastery$/i, ranks: { simple: 3, martial: 3, unarmed: 3, advanced: 2 } },
  { name: /^weapon legend$/i, ranks: { simple: 4, martial: 4, unarmed: 4, advanced: 3 } }
];
function resolveItems(state, rules, warnings) {
  return state.inventory.map((inv) => {
    const entry = rules.get(inv.item) ?? null;
    const baseName = entry?.item?.baseItem ? [entry.item.baseItem].flat()[0] : void 0;
    const base = entry && (entry.item?.weapon || entry.item?.armor || entry.item?.shield) ? entry : baseName ? rules.byName(baseName) ?? null : null;
    if (!entry && inv.item.startsWith("custom:")) {
      warnings.push({ code: "CUSTOM_ITEM", level: "info", ref: "equipment", message: tr(`${inv.customName ?? inv.item}: item caseiro \u2014 pre\xE7o, volume e efeitos n\xE3o entram nos n\xFAmeros.`, `${inv.customName ?? inv.item}: homebrew item \u2014 price, bulk and effects are not in the numbers.`) });
    } else if (!entry) warnings.push({ code: "ENTRY_NOT_FOUND", level: "warn", ref: "equipment", message: tr(`Item fora do cat\xE1logo atual: ${inv.customName ?? inv.item}.`, `Item not in the current catalog: ${inv.customName ?? inv.item}.`) });
    if (entry && baseName && entry.item?.subcategory?.startsWith("Specific")) {
      warnings.push({ code: "SPECIFIC_ITEM", level: "info", ref: "equipment", message: tr(`${entry.name}: item espec\xEDfico \u2014 confira as runas e efeitos pr\xF3prios dele.`, `${entry.name}: specific item \u2014 check its own runes and effects.`) });
    }
    return {
      key: inv.key,
      entry,
      base,
      name: inv.customName ?? entry?.name ?? inv.item,
      qty: inv.qty,
      bulk: bulkOf(entry?.item?.bulk) * inv.qty,
      price: (entry?.item?.price?.gp ?? 0) * inv.qty,
      inv
    };
  });
}
function compileEquipment(state, rules, ctx, warnings) {
  const items = resolveItems(state, rules, warnings);
  const str = ctx.mod.str;
  const coins = Math.floor((state.money.pp + state.money.gp + state.money.sp + state.money.cp) / 1e3);
  const total = Math.floor(items.reduce((sum, i) => sum + i.bulk, 0) * 10) / 10 + coins;
  const encumberedAt = 5 + str;
  const max = 10 + str;
  if (total > max) warnings.push({ code: "OVER_BULK", level: "warn", ref: "equipment", message: tr(`Volume ${total} passa do m\xE1ximo de ${max} (Player Core pg. 269).`, `Bulk ${total} is over the maximum of ${max} (Player Core pg. 269).`) });
  else if (total > encumberedAt) warnings.push({ code: "ENCUMBERED", level: "warn", ref: "equipment", message: tr(`Volume ${total} acima de ${encumberedAt}: sobrecarregado (desajeitado 1, \u221210 p\xE9s).`, `Bulk ${total} over ${encumberedAt}: encumbered (clumsy 1, \u221210 feet).`) });
  const invested = items.filter((i) => i.inv.invested).length;
  if (invested > 10) warnings.push({ code: "INVESTED_LIMIT", level: "warn", ref: "equipment", message: tr(`${invested} itens investidos; o limite \xE9 10 (GM Core pg. 219).`, `${invested} invested items; the limit is 10 (GM Core pg. 219).`) });
  const spent = items.filter((i) => i.inv.acquired === "bought").reduce((sum, i) => sum + i.price, 0);
  const start = COINS_GP(state.money);
  const remaining = Math.round((start - spent) * 100) / 100;
  if (remaining < 0) warnings.push({ code: "NEGATIVE_MONEY", level: "warn", ref: "equipment", message: tr(`Compras passam do dinheiro em ${-remaining} po.`, `Purchases exceed the money by ${-remaining} gp.`) });
  const wornArmor = items.find((i) => i.inv.worn && i.base?.item?.armor);
  let armor = null;
  if (wornArmor) {
    const a = wornArmor.base.item.armor;
    const strengthMet = (a.strength ?? 0) <= str;
    const rawSpeed = typeof a.speedPenalty === "number" ? a.speedPenalty : Number(String(a.speedPenalty ?? "0").replace(/[^-\d]/g, "")) || 0;
    armor = {
      item: wornArmor,
      category: (a.category ?? "unarmored").toLowerCase(),
      ac: a.ac ?? 0,
      dexCap: a.dexCap ?? 99,
      potency: wornArmor.inv.runes?.potency ?? 0,
      resilient: wornArmor.inv.runes?.resilient ?? 0,
      checkPenalty: strengthMet ? 0 : a.checkPenalty ?? 0,
      speedPenalty: strengthMet ? Math.min(0, rawSpeed + 5) : rawSpeed,
      strengthMet
    };
    if (wornArmor.inv.runes?.property?.length && wornArmor.inv.runes.property.length > armor.potency) {
      warnings.push({ code: "RUNE_SLOTS", level: "warn", ref: "equipment", message: tr(`${wornArmor.name}: mais runas de propriedade que a pot\xEAncia permite.`, `${wornArmor.name}: more property runes than the potency allows.`) });
    }
  }
  if (items.filter((i) => i.inv.worn && i.base?.item?.armor).length > 1) {
    warnings.push({ code: "TWO_ARMORS", level: "warn", ref: "equipment", message: tr("Mais de uma armadura vestida; vale a primeira.", "More than one armor worn; the first one counts.") });
  }
  const shieldItem = items.find((i) => (i.inv.worn || i.inv.equipped) && i.base?.item?.shield);
  const shield = shieldItem ? { item: shieldItem, ac: shieldItem.base.item.shield.ac ?? 0, hardness: shieldItem.base.item.shield.hardness, hp: shieldItem.base.item.shield.hp } : null;
  const strikes = [];
  const specBonus = (rank) => ctx.specialization === 0 || rank < 2 ? 0 : [0, 0, 2, 3, 4][rank] * ctx.specialization;
  const weaponStrike = (key, name, base, inv) => {
    const w = base.item?.weapon;
    if (!w) return null;
    const traits = (w.traitsRaw ?? []).map((t) => t);
    const low = traits.map(TRAIT);
    const category = (w.category ?? "simple").toLowerCase();
    const group = w.group?.toLowerCase();
    const rank = Math.max(ctx.attacks[category] ?? 0, (group ? ctx.groupRanks[group]?.[category] : 0) ?? 0);
    const prof = rank > 0 ? ctx.level + 2 * rank : 0;
    const ranged = !!w.range && !low.includes("thrown");
    const finesse = low.includes("finesse");
    const attr = inv?.weapon?.attackAttribute ?? (ranged ? "dex" : finesse && ctx.mod.dex > ctx.mod.str ? "dex" : "str");
    const potency = ctx.abp ? ctx.abp.attack : inv?.runes?.potency ?? 0;
    const striking = ctx.abp ? ctx.abp.dice - 1 : inv?.runes?.striking ?? 0;
    const strDamage = ranged ? low.includes("propulsive") ? str > 0 ? Math.floor(str / 2) : str : 0 : str;
    const spec = specBonus(rank);
    const attackParts = [{ label: tr("Profici\xEAncia", "Proficiency"), value: prof }, { label: ATTR_LABEL2[attr], value: ctx.mod[attr] }, ...potency ? [{ label: tr("Pot\xEAncia", "Potency"), value: potency }] : []];
    const damageParts = [...strDamage ? [{ label: tr("FOR", "STR"), value: strDamage }] : [], ...spec ? [{ label: tr("Especializa\xE7\xE3o", "Specialization"), value: spec }] : []];
    let attack = attackParts.reduce((s, p) => s + p.value, 0);
    let damageBonus = damageParts.reduce((s, p) => s + p.value, 0);
    const o = inv?.weapon?.overrides;
    if (o?.attack !== void 0 || o?.damage !== void 0) {
      warnings.push({ code: "WEAPON_OVERRIDE", level: "info", ref: "equipment", message: tr(`${name}: valor definido \xE0 m\xE3o.`, `${name}: value set by hand.`) });
      if (o.attack !== void 0) attack = o.attack;
      if (o.damage !== void 0) damageBonus = o.damage;
    }
    const runes = (inv?.runes?.property ?? []).map((id) => rules.get(id)?.name ?? id);
    if (runes.length > potency) warnings.push({ code: "RUNE_SLOTS", level: "warn", ref: "equipment", message: tr(`${name}: mais runas de propriedade que a pot\xEAncia permite (GM Core pg. 236).`, `${name}: more property runes than the potency allows (GM Core pg. 236).`) });
    if (runes.length) warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: "equipment", message: tr(`Efeito n\xE3o calculado: dano extra das runas de ${name} (${runes.join(", ")}).`, `Effect not calculated: extra damage from ${name}'s runes (${runes.join(", ")}).`) });
    const material = inv?.material ? rules.get(inv.material.id)?.name : void 0;
    const display = [potency ? `+${potency}` : "", STRIKING_NAME[striking] ?? "", ...runes, material ?? "", name].filter(Boolean).join(" ");
    return {
      key,
      name,
      display,
      category,
      group: w.group,
      die: (w.die ?? "d4").replace(/^1/, ""),
      dice: 1 + striking,
      damageType: w.damageType ?? "",
      attack,
      damageBonus,
      traits,
      attackParts,
      damageParts,
      range: w.range,
      potency,
      striking,
      runes,
      material
    };
  };
  for (const item of items) {
    if (!item.base?.item?.weapon) continue;
    const strike = weaponStrike(item.key, item.name, item.base, item.inv);
    if (strike) strikes.push(strike);
  }
  const fist = rules.byName("Fist", "weapon") ?? rules.byName("Fist");
  if (fist?.item?.weapon) {
    const strike = weaponStrike("fist", fist.name, fist);
    if (strike) strikes.unshift(strike);
  }
  return { items, bulk: { total, encumberedAt, max, coins }, invested, money: { start, spent, remaining }, armor, shield, strikes };
}
function armorClass(eq, ctx) {
  const cat = eq.armor?.category ?? "unarmored";
  const rank = ctx.defenses[cat] ?? 0;
  const prof = rank > 0 ? ctx.level + 2 * rank : 0;
  const dex = eq.armor ? Math.min(ctx.dex, eq.armor.dexCap) : ctx.dex;
  const parts = [{ label: tr("Base", "Base"), value: 10 }, { label: tr("DES", "DEX"), value: dex }, { label: ctx.label(rank), value: prof }];
  if (eq.armor && eq.armor.ac + eq.armor.potency) parts.push({ label: tr("Item", "Item"), value: eq.armor.ac + eq.armor.potency });
  if (!eq.armor && ctx.unarmoredPotency) parts.push({ label: tr("Item", "Item"), value: ctx.unarmoredPotency });
  return { total: parts.reduce((s, p) => s + p.value, 0), parts };
}

// src/modules/character-builder/mesaRules.ts
var DEFAULT_MESA_RULES = Object.freeze({
  sources: { allow: [] },
  legacy: false,
  rarity: { uncommon: "ask", rare: "ask" },
  variants: {
    freeArchetype: false,
    mythic: { enabled: false, progression: "level" },
    ancestralParagon: false,
    abp: false,
    pwl: false,
    dualClass: false,
    gradualBoosts: false
  },
  startingLevel: 1,
  wealth: "table",
  exceptions: []
});
var restrictsSources = (rules) => rules.sources.allow.length > 0;
function allowsLegacyBook(rules, source) {
  return !(rules.sources.deny ?? []).includes(source) && (rules.sources.legacy !== void 0 ? rules.sources.legacy.includes(source) : rules.legacy && (!restrictsSources(rules) || rules.sources.allow.includes(source)));
}
function allowsBook(entry, rules) {
  if (!entry.remaster) return allowsLegacyBook(rules, entry.source.id);
  return (!restrictsSources(rules) || rules.sources.allow.includes(entry.source.id)) && !(rules.sources.deny ?? []).includes(entry.source.id);
}

// src/modules/character-builder/engine/abp.ts
var step = (level, levels) => levels.filter((l) => level >= l).length;
var SKILL_POTENCY = [
  [20, [3, 3, 2, 2, 1, 1]],
  [17, [3, 2, 2, 1, 1]],
  [15, [2, 2, 2, 1]],
  [13, [2, 2, 1]],
  [9, [2, 1]],
  [6, [1, 1]],
  [3, [1]]
];
function abpAt(level) {
  return {
    attack: step(level, [2, 10, 16]),
    dice: 1 + step(level, [4, 12, 19]),
    defense: step(level, [5, 11, 18]),
    perception: step(level, [7, 13, 19]),
    save: step(level, [8, 14, 20]),
    skillSlots: SKILL_POTENCY.find(([l]) => level >= l)?.[1] ?? [],
    apex: level >= 17
  };
}
function abpSkillBonus(order, slots) {
  const out = {};
  order.slice(0, slots.length).forEach((ref, i) => {
    if (ref.startsWith("skill:")) out[ref.slice(6)] = slots[i];
  });
  return out;
}

// src/modules/character-builder/engine/classChoices.ts
var CLASS_CHOICE_TYPES = {
  "arcane-school": { className: "Wizard", label: tr("Escola arcana", "Arcane school"), feature: /arcane school/i },
  bloodline: { className: "Sorcerer", label: tr("Linhagem", "Bloodline"), feature: /bloodline/i },
  cause: { className: "Champion", label: tr("Causa", "Cause"), feature: /cause/i },
  "conscious-mind": { className: "Psychic", label: tr("Mente consciente", "Conscious mind"), feature: /conscious mind/i },
  "subconscious-mind": { className: "Psychic", label: tr("Mente subconsciente", "Subconscious mind"), feature: /subconscious mind/i },
  doctrine: { className: "Cleric", label: tr("Doutrina", "Doctrine"), feature: /doctrine/i },
  "druidic-order": { className: "Druid", label: tr("Ordem dru\xEDdica", "Druidic order"), feature: /order/i },
  eidolon: { className: "Summoner", label: tr("Eidolon", "Eidolon"), feature: /eidolon/i },
  "grim-fascination": { className: "Necromancer", label: tr("Fasc\xEDnio sombrio", "Grim fascination"), feature: /fascination/i },
  "hunters-edge": { className: "Ranger", label: tr("Hunter's Edge", "Hunter's Edge"), feature: /hunter's edge/i },
  "hybrid-study": { className: "Magus", label: tr("Estudo h\xEDbrido", "Hybrid study"), feature: /hybrid study/i },
  implement: { className: "Thaumaturge", label: tr("Implemento", "Implement"), feature: /implement/i },
  innovation: { className: "Inventor", label: tr("Inova\xE7\xE3o", "Innovation"), feature: /innovation/i },
  instinct: { className: "Barbarian", label: tr("Instinto", "Instinct"), feature: /instinct/i },
  methodology: { className: "Investigator", label: tr("Metodologia", "Methodology"), feature: /methodology/i },
  muse: { className: "Bard", label: tr("Musa", "Muse"), feature: /muse/i },
  mystery: { className: "Oracle", label: tr("Mist\xE9rio", "Mystery"), feature: /myster/i },
  patron: { className: "Witch", label: tr("Patrono", "Patron"), feature: /patron/i },
  practice: { className: "Animist", label: tr("Pr\xE1tica", "Practice"), feature: /practice/i },
  racket: { className: "Rogue", label: tr("Racket", "Racket"), feature: /racket/i },
  "research-field": { className: "Alchemist", label: tr("Campo de pesquisa", "Research field"), feature: /research field/i },
  style: { className: "Swashbuckler", label: tr("Estilo", "Style"), feature: /style/i },
  way: { className: "Gunslinger", label: tr("Caminho", "Way"), feature: /\bway\b/i }
};
var UNCOUNTED_CHOICE_TYPES = {
  ikon: "Exemplar",
  epithet: "Exemplar",
  tactic: "Commander",
  "runesmith-rune": "Runesmith",
  apparition: "Animist",
  lesson: "Witch",
  "arcane-thesis": "Wizard"
};
function classChoiceSlots(cls, options) {
  if (!cls) return [];
  const features = cls.class?.features ?? [];
  const out = [];
  for (const [type, spec] of Object.entries(CLASS_CHOICE_TYPES)) {
    if (spec.className.toLowerCase() !== cls.name.toLowerCase()) continue;
    const level = features.find((f) => spec.feature.test(f.name))?.level ?? 1;
    const list = options.filter((o) => o.type === type);
    if (list.length) out.push({ key: `class-choice:${type}`, type, level, label: spec.label, options: list });
  }
  return out;
}
var SAVE_CHOICE_FEATURES = [
  { name: /^path to perfection$/i, rank: 3 },
  { name: /^second path to perfection$/i, rank: 3 },
  { name: /^third path to perfection$/i, rank: 4 }
];

// src/modules/character-builder/engine/compile.ts
var CLASS_DC_RANK = 1;
var RANK_NAME = {
  0: tr("Destreinado", "Untrained"),
  1: tr("Treinado", "Trained"),
  2: tr("Perito", "Expert"),
  3: tr("Mestre", "Master"),
  4: tr("Lend\xE1rio", "Legendary")
};
var rankName = (rank) => RANK_NAME[rank];
var proficiencyBonus = (rank, level) => rank > 0 ? level + 2 * rank : 0;
var stat = (parts, base = 0) => ({
  total: base + parts.reduce((sum, p) => sum + p.value, 0),
  parts: base ? [{ label: tr("Base", "Base"), value: base }, ...parts] : parts
});
function sourceWarnings(entry, ctx, ref, warnings) {
  const rules = ctx.mesaRules;
  if (rules && entry.source.id !== "mesa") {
    const allowed = allowsBook(entry, rules);
    const exception = rules.exceptions.some((e) => e.buildId === ctx.buildId && e.ids.includes(entry.id));
    if (entry.remaster && !allowed && !exception) {
      warnings.push({ code: "SOURCE_NOT_ALLOWED", level: "warn", ref, entryId: entry.id, message: tr(`${entry.name}: livro n\xE3o liberado nesta mesa.`, `${entry.name}: book not allowed at this table.`) });
    }
    if (!entry.remaster && !allowed && !exception) {
      warnings.push({ code: "LEGACY_NOT_ALLOWED", level: "warn", ref, entryId: entry.id, message: tr(`${entry.name}: conte\xFAdo pr\xE9-Remaster n\xE3o liberado nesta mesa.`, `${entry.name}: pre-Remaster content not allowed at this table.`) });
    }
    const rarity = entry.rarity === "uncommon" ? rules.rarity.uncommon : entry.rarity === "rare" || entry.rarity === "unique" ? rules.rarity.rare : "allow";
    if (rarity !== "allow" && !exception) {
      warnings.push({
        code: rarity === "deny" ? "RARITY_DENIED" : "RARITY_ASK",
        level: "warn",
        ref,
        entryId: entry.id,
        message: rarity === "deny" ? tr(`${entry.name}: raridade n\xE3o permitida nesta mesa.`, `${entry.name}: rarity not allowed at this table.`) : tr(`${entry.name}: ${entry.rarity === "uncommon" ? "incomum" : "raro"} \u2014 combine com o GM.`, `${entry.name}: ${entry.rarity} \u2014 check with the GM.`)
      });
    }
  }
  for (const effect of entry.unsupported ?? []) {
    if (entry.background && backgroundLoreChoice(entry) && (/^Lore\b/i.test(effect.trim()) || /\bLore for\b/i.test(effect))) continue;
    if (entry.class && (/^attribute:/i.test(effect) || /skills? determined by your/i.test(effect))) continue;
    warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref, message: tr(`Efeito n\xE3o calculado: ${entry.name} (${effect}).`, `Effect not calculated: ${entry.name} (${effect}).`) });
  }
}
function compileBuild(state, ctx) {
  const { rules } = ctx;
  const level = Math.min(20, Math.max(1, state.level));
  const pending = [];
  const warnings = [];
  const used = /* @__PURE__ */ new Set();
  const missingRefs = /* @__PURE__ */ new Set();
  const ancestry = rules.get(state.origin.ancestry);
  const heritage = rules.get(state.origin.heritage);
  const background = rules.get(state.origin.background);
  const baseClass = rules.get(state.class.id);
  const choice = state.choices[CLASS_ARCHETYPE];
  const archetypeId = selectedClassArchetype(choice, baseClass);
  const spec = archetypeId ? CLASS_ARCHETYPES[archetypeId] : void 0;
  const archetype = rules.get(archetypeId);
  const cls = adjustedClass(baseClass, archetypeId);
  if (archetypeId) {
    used.add(CLASS_ARCHETYPE);
    if (archetype) sourceWarnings(archetype, ctx, CLASS_ARCHETYPE, warnings);
  }
  const missing = (id, entry, key, label) => {
    if (!id) pending.push({ key, label, level: 1, missing: 1 });
    else if (!entry) warnings.push({ code: "ENTRY_NOT_FOUND", level: "error", ref: key, message: tr(`${label}: n\xE3o est\xE1 no cat\xE1logo atual (${id}).`, `${label}: not in the current catalog (${id}).`) });
  };
  missing(state.origin.ancestry, ancestry, "ancestry", tr("Ancestralidade", "Ancestry"));
  missing(state.origin.heritage, heritage, "heritage", tr("Heran\xE7a", "Heritage"));
  missing(state.origin.background, background, "background", tr("Background", "Background"));
  missing(state.class.id, cls, "class", tr("Classe", "Class"));
  for (const [entry, ref] of [[ancestry, "ancestry"], [heritage, "heritage"], [background, "background"], [cls, "class"]]) {
    if (entry) sourceWarnings(entry, ctx, ref, warnings);
  }
  const heritageOf = heritage?.heritage?.ancestry;
  if (heritage && ancestry && heritageOf && heritageOf.toLowerCase() !== ancestry.name.toLowerCase()) {
    warnings.push({ code: "HERITAGE_MISMATCH", level: "warn", ref: "heritage", message: tr(`${heritage.name} \xE9 heran\xE7a de ${heritageOf}, n\xE3o de ${ancestry.name}.`, `${heritage.name} is a ${heritageOf} heritage, not ${ancestry.name}.`) });
  }
  if (ancestry && ancestry.ancestry?.hp === void 0) {
    warnings.push({ code: "ANCESTRY_HP_UNKNOWN", level: "warn", ref: "ancestry", message: tr(`${ancestry.name}: o cat\xE1logo n\xE3o traz os PV da ancestralidade; o total sai sem eles.`, `${ancestry.name}: the catalog has no ancestry HP; the total leaves them out.`) });
  }
  const attrs = compileAttributes(state, ancestry, background, cls, pending, warnings);
  for (const g of attrs.groups) if (g.key !== "class-key") used.add(g.key);
  const mod = attrs.result.mod;
  const keyAttribute = attrs.groups.find((g) => g.key === "class-key")?.fixed[0] ?? attrs.groups.find((g) => g.key === "class-key")?.chosen[0] ?? null;
  const c = cls?.class;
  const r = (v) => v ?? 0;
  const proficiency = {
    perception: r(c?.perception),
    fortitude: r(c?.saves?.fortitude),
    reflex: r(c?.saves?.reflex),
    will: r(c?.saves?.will),
    classDC: cls ? CLASS_DC_RANK : 0,
    spell: c?.spellcasting ?? 0,
    attacks: { ...c?.attacks ?? {} },
    defenses: { ...c?.defenses ?? {} }
  };
  const has = /* @__PURE__ */ new Set();
  const awarded = [];
  const features = [];
  const extraRanks = {};
  const upgrade = (target, rank) => {
    if (target === "perception" || target === "fortitude" || target === "reflex" || target === "will" || target === "classDC") {
      if (proficiency[target] < rank) proficiency[target] = rank;
    } else if (["simple", "martial", "advanced", "unarmed"].includes(target)) {
      const k = target;
      if ((proficiency.attacks[k] ?? 0) < rank) proficiency.attacks[k] = rank;
    } else if (["light", "medium", "heavy", "unarmored"].includes(target)) {
      const k = target;
      if ((proficiency.defenses[k] ?? 0) < rank) proficiency.defenses[k] = rank;
    } else if (target === "spell") {
      if (proficiency.spell < rank) proficiency.spell = rank;
    } else extraRanks[target] = Math.max(extraRanks[target] ?? 0, rank);
  };
  for (const ref of c?.features ?? []) {
    const entry = ref.id ? rules.get(ref.id) : void 0;
    features.push({ level: ref.level, name: ref.name, id: ref.id });
    if (ref.level > level) continue;
    has.add(ref.name.toLowerCase());
    if (!entry) continue;
    for (const p2 of entry.classFeature?.proficiencies ?? []) upgrade(p2.target, p2.rank);
    const handled = GROUP_FEATURES.some((g) => g.name.test(ref.name)) || SAVE_CHOICE_FEATURES.some((f) => f.name.test(ref.name));
    for (const note of handled ? [] : (entry.unsupported ?? []).filter((u) => u.startsWith("proficiency:"))) {
      warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: "class", message: tr(`Efeito n\xE3o calculado: ${entry.name} (${note.slice(13)}).`, `Effect not calculated: ${entry.name} (${note.slice(13)}).`) });
    }
    for (const rule of entry.rules ?? []) {
      const feat = grantedFeat(rule, rules, missingRefs);
      if (feat) awarded.push({ entry: feat, level: ref.level, source: entry.name });
    }
  }
  if (archetypeId === WAR_MAGE) {
    upgrade("martial", proficiency.attacks.simple ?? 0);
    if (level >= 11) for (const target of ["light", "medium", "unarmored"]) upgrade(target, 2);
    const shieldBlock = rules.get("feat:feat-5212");
    if (shieldBlock) awarded.push({ entry: shieldBlock, level: 1, source: "War Magic" });
    else warnings.push({ code: "ENTRY_NOT_FOUND", level: "warn", ref: CLASS_ARCHETYPE, message: tr("Shield Block ainda n\xE3o foi carregado.", "Shield Block has not loaded yet.") });
  }
  const grant = (id, at, source) => {
    const entry = rules.get(id);
    if (entry) awarded.push({ entry, level: at, source });
    else warnings.push({ code: "ENTRY_NOT_FOUND", level: "warn", ref: CLASS_ARCHETYPE, message: tr(`${source}: talento concedido fora das listas carregadas (${id}).`, `${source}: granted feat not in the loaded lists (${id}).`) });
  };
  if (archetypeId === RUNELORD) grant(ADVANCED_SCHOOL_SPELL, 8, "Runelord");
  if (archetypeId === PALATINE_DETECTIVE) grant(QUICK_IDENTIFICATION, 1, "Esoterica");
  const classChoices = classChoiceSlots(cls, ctx.classOptions ?? []).map((slot) => {
    const raw = state.choices[slot.key];
    const fixed = spec?.subclass.startsWith(slot.type + ":") ? spec.subclass : void 0;
    const saved = raw && "id" in raw ? raw.id : void 0;
    const chosen = fixed ?? saved;
    if (fixed && saved && fixed !== saved) {
      warnings.push({
        code: "REPLACED_SUBCLASS",
        level: "info",
        ref: CLASS_ARCHETYPE,
        message: tr("A subclasse anterior fica guardada enquanto o arqu\xE9tipo de classe estiver ativo.", "Your previous subclass is saved while the class archetype is active.")
      });
    }
    if (slot.level <= level) {
      used.add(slot.key);
      if (!chosen) pending.push({ key: slot.key, label: slot.label, level: slot.level, missing: 1 });
      const entry = chosen ? rules.get(chosen) ?? slot.options.find((o) => o.id === chosen) : void 0;
      const owner = archetypeOfSubclass(chosen);
      if (owner && archetypeId !== owner) {
        const ownerName = rules.get(owner)?.name ?? owner;
        warnings.push({
          code: "CLASS_ARCHETYPE_REQUIRED",
          level: "warn",
          ref: CLASS_ARCHETYPE,
          message: tr(`Escolha ${ownerName} na aba Classe para aplicar os ajustes desta escolha.`, `Choose ${ownerName} on the Class tab to apply this choice\u2019s adjustments.`)
        });
      }
      if (entry) {
        awarded.push({ entry, level: slot.level, source: slot.label });
        has.add(entry.name.toLowerCase());
        if (slot.type === "doctrine") {
          if (entry.doctrine?.steps?.length) {
            for (const stepDef of entry.doctrine.steps) if (stepDef.level <= level) for (const p2 of stepDef.proficiencies) upgrade(p2.target, p2.rank);
          } else {
            warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: slot.key, message: tr(`Efeito n\xE3o calculado: a progress\xE3o da doutrina ${entry.name} (salvaguardas e armas por n\xEDvel).`, `Effect not calculated: the ${entry.name} doctrine progression (saves and weapons by level).`) });
          }
        }
      }
    }
    return { ...slot, chosen, fixed: !!fixed };
  });
  const mythicOn = variantFlags(state, ctx.mesaRules).mythic;
  if (mythicOn) {
    const callingLevel = state.options.mythic?.startLevel ?? 1;
    const options = (ctx.classOptions ?? []).filter((o) => o.type === "mythic-calling");
    const key = "class-choice:mythic-calling";
    const raw = state.choices[key];
    const chosen = raw && "id" in raw ? raw.id : void 0;
    if (options.length) classChoices.push({ key, type: "mythic-calling", level: callingLevel, label: tr("Chamado m\xEDtico", "Mythic calling"), options, chosen });
    if (options.length && callingLevel <= level) {
      used.add(key);
      if (!chosen) pending.push({ key, label: tr("Chamado m\xEDtico", "Mythic calling"), level: callingLevel, missing: 1 });
      const entry = chosen ? options.find((o) => o.id === chosen) : void 0;
      if (entry) {
        awarded.push({ entry, level: callingLevel, source: tr("Chamado m\xEDtico", "Mythic calling") });
        has.add(entry.name.toLowerCase());
      }
    }
    if (level >= 12) {
      warnings.push({ code: "MYTHIC_DESTINY", level: "info", ref: "mythic-feat-12", message: tr("N\xEDvel 12: o talento m\xEDtico precisa ser o de um destino m\xEDtico (War of Immortals pg. 77).", "Level 12: the mythic feat must be a mythic destiny feat (War of Immortals pg. 77).") });
    }
  }
  for (const [type, owner] of Object.entries(UNCOUNTED_CHOICE_TYPES)) {
    if ((archetypeId === WAR_MAGE || archetypeId === RUNELORD) && type === "arcane-thesis") continue;
    if (cls && owner.toLowerCase() === cls.name.toLowerCase()) {
      warnings.push({ code: "UNSUPPORTED_CHOICE", level: "info", ref: "class", message: tr(`Escolhas de ${type} ainda n\xE3o entram no Criador: anote \xE0 parte.`, `${type} choices are not in the Builder yet: note them separately.`) });
    }
  }
  const saveChoices = [];
  for (const ref of c?.features ?? []) {
    const spec2 = SAVE_CHOICE_FEATURES.find((f) => f.name.test(ref.name));
    if (!spec2) continue;
    const key = `class-choice:save-${ref.level}`;
    const raw = state.choices[key];
    const chosen = raw && "value" in raw ? raw.value : void 0;
    saveChoices.push({ key, level: ref.level, label: ref.name, rank: spec2.rank, chosen });
    if (ref.level > level) continue;
    used.add(key);
    if (!chosen) pending.push({ key, label: ref.name, level: ref.level, missing: 1 });
    else if (chosen === "fortitude" || chosen === "reflex" || chosen === "will") upgrade(chosen, spec2.rank);
  }
  const picked = saveChoices.filter((s) => s.level <= level && s.chosen);
  if (picked.length >= 2 && picked[0].chosen === picked[1].chosen) {
    warnings.push({ code: "SAVE_CHOICE_REPEAT", level: "warn", ref: picked[1].key, message: tr(`${picked[1].label}: escolha uma salvaguarda diferente da primeira (Player Core 2 pg. 114).`, `${picked[1].label}: choose a different save than the first (Player Core 2 pg. 114).`) });
  }
  if (picked.length >= 3 && !picked.slice(0, 2).some((s) => s.chosen === picked[2].chosen)) {
    warnings.push({ code: "SAVE_CHOICE_REPEAT", level: "warn", ref: picked[2].key, message: tr(`${picked[2].label}: precisa ser uma das duas j\xE1 escolhidas (Player Core 2 pg. 114).`, `${picked[2].label}: must be one of the two already chosen (Player Core 2 pg. 114).`) });
  }
  for (const entry of [ancestry, heritage]) if (entry?.rules?.length) awarded.push({ entry, level: 1, source: entry.name });
  for (const name of background?.background?.feats ?? []) {
    const feat = rules.byName(name, "feat");
    if (feat) awarded.push({ entry: feat, level: 1, source: background.name });
    else warnings.push({ code: "ENTRY_NOT_FOUND", level: "info", ref: "background", message: tr(`Talento do background fora das listas carregadas: ${name}.`, `Background feat not in the loaded lists: ${name}.`) });
  }
  const subclassTrained = classChoices.filter((c2) => c2.level === 1 && c2.chosen).flatMap((c2) => {
    const entry = rules.get(c2.chosen) ?? c2.options.find((o) => o.id === c2.chosen);
    return (entry?.rules ?? []).flatMap((r2) => {
      const path = typeof r2.path === "string" ? /^system\.skills\.([a-z]+)\.rank$/.exec(r2.path) : null;
      return r2.key === "ActiveEffectLike" && r2.mode === "upgrade" && r2.value === 1 && path && !r2.predicate && !r2.situational ? [{ ref: `skill:${path[1]}`, source: entry.name }] : [];
    });
  });
  const featTrained = Object.entries(state.choices).flatMap(([key, choice2]) => {
    const m = /-feat-(\d+)$/.exec(key);
    if (!m || !("id" in choice2)) return [];
    const entry = rules.get(choice2.id);
    return (entry?.rules ?? []).flatMap((r2) => {
      if (r2.key !== "ActiveEffectLike" || r2.mode !== "upgrade" || r2.value !== 1 || r2.predicate || r2.situational || typeof r2.path !== "string") return [];
      const fixed = /^system\.skills\.([a-z]+)\.rank$/.exec(r2.path)?.[1];
      const flag = /^system\.skills\.\{item\|flags\.system\.rulesSelections\.([A-Za-z]+)\}\.rank$/.exec(r2.path)?.[1];
      const picked2 = flag ? state.choices[`${key}/choice:${flag}`] : void 0;
      const skill = fixed ?? (picked2 && "value" in picked2 ? picked2.value : void 0);
      return skill ? [{ ref: `skill:${skill}`, level: Number(m[1]), source: entry.name }] : [];
    });
  });
  const skills = compileSkills(state, background, cls, attrs.intAt1, attrs.intGains, cls?.class?.skillIncreaseLevels ?? [], pending, warnings, archetypeId, subclassTrained, featTrained);
  for (const s of skills.slots) used.add(s.key);
  const flags = variantFlags(state, ctx.mesaRules);
  const slots = featSlots(cls, flags);
  const dedicationSlot = slots.find((s) => s.key === "class-feat-2");
  if (dedicationSlot && spec) {
    dedicationSlot.requiredFeat = spec.dedication;
    const pick = state.choices[dedicationSlot.key];
    if (level >= 2 && pick && (!("id" in pick) || pick.id !== spec.dedication)) {
      warnings.push({
        code: "CLASS_DEDICATION",
        level: "warn",
        ref: dedicationSlot.key,
        message: tr("O arqu\xE9tipo exige sua dedica\xE7\xE3o no talento de classe do n\xEDvel 2.", "This archetype requires its dedication in the 2nd-level class feat slot.")
      });
    }
    dedicationSlot.label = rules.get(spec.dedication)?.name ?? tr("Dedica\xE7\xE3o do arqu\xE9tipo de classe", "Class archetype dedication");
  }
  for (const [i, extra] of (state.manual.extraFeatSlots ?? []).entries()) {
    slots.push({ key: `extra-${extra.kind}-feat-${extra.level}-${i + 1}`, kind: extra.kind, level: extra.level, label: tr("Talento concedido (ajuste)", "Granted feat (adjustment)") });
    if (extra.level <= level) warnings.push({ code: "MANUAL_FEAT_SLOT", level: "info", ref: "manual", message: tr(`Slot de talento extra \xE0 m\xE3o no n\xEDvel ${extra.level}.`, `Extra feat slot by hand at level ${extra.level}.`) });
  }
  const ancestryTraits = [ancestry?.name, ...heritage && !heritage.heritage?.ancestry ? [heritage.name] : []].filter((t) => !!t);
  const prereqContext = () => ({
    level,
    className: cls?.name,
    ancestryName: ancestry?.name,
    heritageName: heritage?.name,
    has,
    skillRank: (s) => skills.result.rank[s],
    loreRank: (l) => skills.result.lores.find((x) => x.key === `lore:${l.replace(/\s+/g, "-")}`)?.rank ?? 0,
    stat: { perception: proficiency.perception, fortitude: proficiency.fortitude, reflex: proficiency.reflex, will: proficiency.will },
    attribute: mod,
    deity: state.origin.deity
  });
  const feats = compileFeats(state, slots, rules, { level, className: cls?.name, ancestryTraits, awarded, has, prereqContext, missing: missingRefs }, warnings);
  for (const t of feats.taken) {
    const required = Object.entries(CLASS_ARCHETYPES).find(([, a]) => a.dedication === t.entry.id);
    if (required && archetypeId !== required[0]) {
      warnings.push({
        code: "CLASS_ARCHETYPE_REQUIRED",
        level: "warn",
        ref: CLASS_ARCHETYPE,
        message: tr(`${t.entry.name} exige o arqu\xE9tipo correspondente desde o n\xEDvel 1.`, `${t.entry.name} requires its class archetype from 1st level.`)
      });
    }
  }
  for (const slot of slots) {
    if (slot.level > level) continue;
    used.add(slot.key);
    const choice2 = state.choices[slot.key];
    if (!choice2) pending.push({ key: slot.key, label: slot.label, level: slot.level, missing: 1 });
  }
  for (const child of feats.children) {
    used.add(child.key);
    if (!child.chosen) pending.push({ key: child.key, label: child.label, level: child.level, missing: 1 });
  }
  if (archetypeId === RUNELORD) {
    warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: CLASS_ARCHETYPE, message: tr(
      "Runelord: o v\xEDnculo arcano \xE9 uma polearm ou spear, e a personal rune (cajado com as magias do pecado) n\xE3o entra nas magias; anote \xE0 parte.",
      "Runelord: your arcane bond is a polearm or spear, and the personal rune (a staff with your sin spells) is not in the spell lists; note it separately."
    ) });
  }
  if (archetypeId === PALATINE_DETECTIVE) {
    warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: CLASS_ARCHETYPE, message: tr(
      "Esoterica: os dois truques inatos (um divino, um oculto) e o treino em ataque e CD de magia (INT) ainda n\xE3o entram nas magias; anote \xE0 parte.",
      "Esoterica: the two innate cantrips (one divine, one occult) and trained spell attack and DC (INT) are not in the spell lists yet; note them separately."
    ) });
  }
  if (archetypeId === BLOODRAGER) {
    warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: CLASS_ARCHETYPE, message: tr(
      "Aplique na mesa os efeitos de f\xFAria e de Harvest Blood que dependem do alvo.",
      "Apply the target-dependent rage and Harvest Blood effects at the table."
    ) });
  }
  for (const [target, rank] of Object.entries({ ...extraRanks, ...feats.mods.ranks })) {
    const best = Math.max(rank, extraRanks[target] ?? 0, feats.mods.ranks[target] ?? 0);
    if (target.startsWith("skill:")) {
      const k = target.slice(6);
      if (k in skills.result.rank && skills.result.rank[k] < best) skills.result.rank[k] = best;
    } else if (target.startsWith("lore:")) {
      const lore = skills.result.lores.find((l) => l.key === target);
      if (lore) lore.rank = Math.max(lore.rank, best);
      else skills.result.lores.push({ key: target, name: target.slice(5).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), rank: best });
    } else if (target.startsWith("attack:")) upgrade(target.slice(7), best);
    else if (target.startsWith("defense:")) upgrade(target.slice(8), best);
    else upgrade(target, best);
  }
  const ancestryLanguages = ancestry?.ancestry?.languages ?? [];
  const extraLanguages = [];
  if (archetypeId === RUNELORD) extraLanguages.push("Thassilonian");
  const chosenLanguages = (state.origin.languages ?? []).map((id) => rules.get(id)?.name ?? id);
  if (ancestry) {
    if (chosenLanguages.length < skills.languageSlots) {
      pending.push({ key: "languages", label: tr("Idiomas", "Languages"), level: 1, missing: skills.languageSlots - chosenLanguages.length });
    } else if (chosenLanguages.length > skills.languageSlots) {
      warnings.push({ code: "LANGUAGE_TOO_MANY", level: "warn", ref: "languages", message: tr(`Idiomas a mais: a INT d\xE1 ${skills.languageSlots} (Player Core pg. 89).`, `Too many languages: INT grants ${skills.languageSlots} (Player Core pg. 89).`) });
    }
  }
  for (const id of state.origin.languages ?? []) {
    const entry = rules.get(id);
    if (entry) sourceWarnings(entry, ctx, "languages", warnings);
  }
  const groupRanks = {};
  const groupChoices = [];
  for (const ref of c?.features ?? []) {
    const spec2 = GROUP_FEATURES.find((g) => g.name.test(ref.name));
    if (!spec2) continue;
    const key = `class-choice:weapon-group-${ref.level}`;
    const raw = state.choices[key];
    const chosen = raw && "value" in raw ? raw.value.toLowerCase() : void 0;
    groupChoices.push({ key, level: ref.level, label: ref.name, chosen });
    if (ref.level > level) continue;
    used.add(key);
    if (!chosen) pending.push({ key, label: ref.name, level: ref.level, missing: 1 });
    else {
      const cur = groupRanks[chosen] ?? {};
      for (const [cat, r2] of Object.entries(spec2.ranks)) cur[cat] = Math.max(cur[cat] ?? 0, r2);
      groupRanks[chosen] = cur;
    }
  }
  if (archetypeId === RUNELORD && (proficiency.attacks.simple ?? 0) > 0) {
    for (const group of ["polearm", "spear"]) {
      const cur = groupRanks[group] ?? {};
      cur.martial = Math.max(cur.martial ?? 0, proficiency.attacks.simple ?? 0);
      groupRanks[group] = cur;
    }
  }
  const reached = (re) => (c?.features ?? []).some((f) => f.level <= level && re.test(f.name));
  const specialization = reached(/^greater weapon specialization$/i) ? 2 : reached(/^weapon specialization$/i) ? 1 : 0;
  const abp = flags.abp ? abpAt(level) : null;
  const equipment = compileEquipment(state, rules, { level, mod, attacks: proficiency.attacks, groupRanks, specialization, abp }, warnings);
  if (abp && equipment.armor) {
    equipment.armor.potency = abp.defense;
    equipment.armor.resilient = 0;
  }
  const abpOrder = (() => {
    const c2 = state.choices["abp-skills"];
    return c2 && "skills" in c2 ? c2.skills : [];
  })();
  if (abp) {
    used.add("abp-skills");
    if (abp.skillSlots.length > abpOrder.length) pending.push({ key: "abp-skills", label: tr("Pot\xEAncia de per\xEDcia (ABP)", "Skill potency (ABP)"), level, missing: abp.skillSlots.length - abpOrder.length });
    if (abp.apex) warnings.push({ code: "UNSUPPORTED_EFFECT", level: "info", ref: "abp", message: tr("Efeito n\xE3o calculado: attribute apex da ABP (n\xEDvel 17).", "Effect not calculated: ABP attribute apex (level 17).") });
    for (const [skill, bonus] of Object.entries(abpSkillBonus(abpOrder, abp.skillSlots))) feats.mods.skill[skill] = Math.max(feats.mods.skill[skill] ?? 0, bonus ?? 0);
  }
  const checkTable = (entry, ref) => {
    const before = warnings.length;
    sourceWarnings(entry, ctx, ref, warnings);
    for (let i = warnings.length - 1; i >= before; i--) if (warnings[i].code === "UNSUPPORTED_EFFECT") warnings.splice(i, 1);
  };
  for (const t of feats.taken) if (t.kind !== "granted") checkTable(t.entry, t.slot);
  for (const item of equipment.items) if (item.entry) checkTable(item.entry, "equipment");
  const checkIds = (ids, ref) => {
    for (const id of new Set(ids)) {
      const entry = rules.get(id);
      if (entry) checkTable(entry, ref);
    }
  };
  for (const slot of classChoices) if (!slot.fixed && slot.level <= level) checkIds([slot.chosen], slot.key);
  checkIds([
    ...state.formulas,
    ...state.inventory.flatMap((i) => [i.material?.id, ...i.runes?.property ?? []]),
    ...state.companions.flatMap((c2) => [c2.type, ...Object.values(c2.choices).flatMap((v) => "id" in v ? [v.id] : [])])
  ], "equipment");
  checkIds(Object.values(state.spellcasting).flatMap((c2) => [
    ...c2.spellbook ?? [],
    ...c2.signature ?? [],
    ...Object.values(c2.repertoire ?? {}).flat(),
    ...Object.values(c2.prepared ?? {}).flat()
  ]), "spells");
  const casters = compileCasters(state, cls, { level, keyAttribute, mod, spellRank: proficiency.spell, table: ctx.tables?.spellSlots }, pending, warnings, used);
  casters.push(...compileArchetypeCasters(state, feats.taken, {
    level,
    mod,
    keyAttribute,
    classArchetype: archetypeId,
    table: ctx.tables?.spellSlots?.archetype,
    classByName: (n) => rules.byName(n, "class")
  }, pending, warnings, used));
  checkSpellChoices(state, casters, (id) => rules.get(id), pending, warnings, level);
  const focusIds = Object.values(state.spellcasting.focus?.repertoire ?? {}).flat();
  const focus = compileFocus(focusIds.map((id) => rules.get(id)).filter((e) => !!e), level);
  const adjust = { hp: 0, speed: 0, items: {} };
  for (const a of state.manual.adjustments ?? []) {
    const v = typeof a.effect.value === "number" ? a.effect.value : Number(a.effect.value);
    const t = (a.effect.target ?? "").toLowerCase();
    if (a.effect.kind === "hp" && Number.isFinite(v)) adjust.hp += v;
    else if (a.effect.kind === "speed" && Number.isFinite(v)) adjust.speed += v;
    else if (a.effect.kind === "resistance" && t) feats.mods.resistances.push(Number.isFinite(v) ? `${t} ${v}` : t);
    else if (a.effect.kind === "sense" && t) feats.mods.senses.push(a.effect.target);
    else if (a.effect.kind === "language" && t) extraLanguages.push(a.effect.target);
    else if (a.effect.kind === "proficiency" && t && Number.isFinite(v)) upgrade(t.startsWith("skill:") ? t : t, Math.max(0, Math.min(4, v)));
    else if (a.effect.kind === "itemBonus" && t && Number.isFinite(v)) adjust.items[t] = Math.max(adjust.items[t] ?? 0, v);
    warnings.push({ code: "MANUAL_ADJUSTMENT", level: "info", ref: "manual", message: tr(`Ajuste \xE0 m\xE3o: ${a.label} (${a.reason}).`, `Adjustment by hand: ${a.label} (${a.reason}).`) });
  }
  for (const [target, rank] of Object.entries(extraRanks)) {
    if (!target.startsWith("skill:")) continue;
    const k = target.slice(6);
    if (k in skills.result.rank && skills.result.rank[k] < rank) skills.result.rank[k] = rank;
  }
  const part = (label, value) => ({ label, value });
  const attrPart = (key) => part(attributeLabel(key), mod[key]);
  const hpParts = [
    ...ancestry ? [part(tr("Ancestralidade", "Ancestry"), ancestry.ancestry?.hp ?? 0)] : [],
    ...cls ? [part(tr(`Classe \xD7 ${level}`, `Class \xD7 ${level}`), (c?.hp ?? 0) * level), part(tr(`CON \xD7 ${level}`, `CON \xD7 ${level}`), mod.con * level)] : []
  ];
  const p = (rank) => part(rankName(rank), proficiencyBonus(rank, level));
  const resilient = abp ? abp.save : equipment.armor?.resilient ?? 0;
  const featPart = (key) => [
    ...feats.mods.stat[key] ? [part(tr("Talentos", "Feats"), feats.mods.stat[key] ?? 0)] : [],
    ...resilient && key !== "perception" ? [part(abp ? tr("Pot\xEAncia (ABP)", "Potency (ABP)") : tr("Resiliente", "Resilient"), resilient)] : [],
    ...abp?.perception && key === "perception" ? [part(tr("Pot\xEAncia (ABP)", "Potency (ABP)"), abp.perception)] : [],
    ...adjust.items[key] ? [part(tr("Item (ajuste)", "Item (adjustment)"), adjust.items[key])] : []
  ];
  const stats = {
    hp: stat([
      ...hpParts,
      ...adjust.hp ? [part(tr("Ajuste", "Adjustment"), adjust.hp)] : [],
      ...feats.mods.hp ? [part(tr("Talentos", "Feats"), feats.mods.hp)] : [],
      ...feats.mods.hpPerLevel ? [part(tr(`Talentos \xD7 ${level}`, `Feats \xD7 ${level}`), feats.mods.hpPerLevel * level)] : []
    ]),
    ac: armorClass(equipment, { dex: mod.dex, level, defenses: proficiency.defenses, label: rankName, unarmoredPotency: abp && !equipment.armor ? abp.defense : 0 }),
    fortitude: stat([p(proficiency.fortitude), attrPart("con"), ...featPart("fortitude")]),
    reflex: stat([p(proficiency.reflex), attrPart("dex"), ...featPart("reflex")]),
    will: stat([p(proficiency.will), attrPart("wis"), ...featPart("will")]),
    perception: stat([p(proficiency.perception), attrPart("wis"), ...featPart("perception")]),
    classDC: cls && keyAttribute ? stat([p(proficiency.classDC), attrPart(keyAttribute)], 10) : null,
    speed: stat([
      ...ancestry?.ancestry?.speed !== void 0 ? [part(tr("Ancestralidade", "Ancestry"), ancestry.ancestry.speed)] : [],
      ...feats.mods.speed ? [part(tr("Talentos", "Feats"), feats.mods.speed)] : [],
      ...equipment.armor?.speedPenalty ? [part(tr("Armadura", "Armor"), equipment.armor.speedPenalty)] : [],
      ...adjust.speed ? [part(tr("Ajuste", "Adjustment"), adjust.speed)] : []
    ])
  };
  const senses = [...ancestry?.ancestry?.senses ?? []];
  for (const sense of feats.mods.senses) if (!senses.some((x) => sense.toLowerCase().startsWith(x.toLowerCase()))) senses.push(sense);
  for (const key of Object.keys(state.choices)) {
    if (!used.has(key)) warnings.push({ code: "ORPHAN_CHOICE", level: "info", ref: key, message: tr(`Escolha sem lugar: ${key}.`, `Choice without a slot: ${key}.`) });
  }
  return {
    level,
    missingRefs: [...missingRefs].sort(),
    attributes: attrs.result,
    skills: skills.result,
    stats,
    proficiency,
    size: ancestry?.ancestry?.size ?? null,
    senses,
    speeds: feats.mods.speeds,
    resistances: feats.mods.resistances,
    weaknesses: feats.mods.weaknesses,
    immunities: feats.mods.immunities,
    languages: [...ancestryLanguages, ...chosenLanguages, ...extraLanguages],
    languageSlots: skills.languageSlots,
    keyAttribute,
    pending: pending.sort((a, b) => a.level - b.level),
    // A ancestralidade e a herança passam pelos dois caminhos (origem e concessões): um aviso igual sai uma vez só.
    warnings: warnings.filter((w, i) => warnings.findIndex((x) => x.code === w.code && x.message === w.message) === i),
    usedChoices: [...used],
    boostGroups: attrs.groups,
    skillSlots: skills.slots,
    automaticSkills: skills.automatic,
    featSlots: slots,
    featChildren: feats.children,
    taken: feats.taken,
    classFeatures: features,
    classChoices,
    saveChoices,
    prereq: prereqContext(),
    ancestryTraits,
    casters,
    focus,
    equipment,
    groupChoices,
    skillBonus: feats.mods.skill
  };
}

// src/modules/character-builder/engine/export.ts
var ATTR_LABEL3 = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
var SIZE = { tiny: 0, small: 1, medium: 2, large: 3, huge: 4, gargantuan: 5 };
var STRIKING = ["", "striking", "greaterStriking", "majorStriking"];
var RESILIENT = ["", "resilient", "greaterResilient", "majorResilient"];
var DAMAGE_LETTER = { Bludgeoning: "B", Piercing: "P", Slashing: "S" };
function slotLabel(slot, className, ancestryName) {
  switch (slot.kind) {
    case "class":
      return slot.maxLevel ? slot.label : `${className} Feat ${slot.level}`;
    case "ancestry":
      return `${ancestryName} Feat ${slot.level}`;
    case "paragon":
      return `Ancestral Paragon Feat ${slot.level}`;
    case "general":
      return `General Feat ${slot.level}`;
    case "skill":
      return `Skill Feat ${slot.level}`;
    case "archetype":
      return `Free Archetype ${slot.level}`;
    case "mythic":
      return `Mythic Feat ${slot.level}`;
  }
}
function featType(entry, slot, className) {
  const t = new Set((entry.traits ?? []).map((x) => x.toLowerCase()));
  if (t.has("mythic")) return "Mythic Feat";
  if (t.has("archetype")) return "Archetype Feat";
  if (t.has(className.toLowerCase())) return "Class Feat";
  if (slot?.kind === "ancestry" || slot?.kind === "paragon") return "Ancestry Feat";
  if (t.has("skill")) return "Skill Feat";
  if (t.has("general")) return "General Feat";
  return slot ? featKindLabel(slot.kind) : "Feat";
}
var spellLists = (byRank, name) => Object.entries(byRank ?? {}).map(([rank, ids]) => ({ spellLevel: Number(rank), list: ids.map(name) })).sort((a, b) => a.spellLevel - b.spellLevel);
function exportBuild(state, compiled, ctx) {
  const { rules } = ctx;
  const name = (id) => rules.get(id)?.name ?? id;
  const ancestry = rules.get(state.origin.ancestry);
  const heritage = rules.get(state.origin.heritage);
  const background = rules.get(state.origin.background);
  const cls = rules.get(state.class.id);
  const className = cls?.name ?? "";
  const ancestryName = ancestry?.name ?? "";
  const { mod, partial, breakdown } = compiled.attributes;
  const label = (list) => list.map((a) => ATTR_LABEL3[a]);
  const level = compiled.level;
  const pr = compiled.proficiency;
  const slotByKey = new Map(compiled.featSlots.map((s) => [s.key, s]));
  const feats = [];
  const homebrewFeats = {};
  if (heritage) feats.push([heritage.name, null, "Heritage", 1, "Heritage Feat", "standardChoice", null]);
  for (const t of compiled.taken) {
    if (t.entry.type === "feat" && t.entry.homebrew === "feat") {
      homebrewFeats[feats.length] = { id: t.entry.id, name: t.entry.name, ...t.kind === "granted" ? {} : { slot: t.slot } };
    }
    const slot = slotByKey.get(t.slot);
    if (t.kind === "granted") {
      if (["ancestry", "heritage", "class-feature"].includes(t.entry.type) || t.entry.type !== "feat") continue;
      feats.push([t.entry.name, null, "Awarded Feat", t.level]);
      continue;
    }
    if (t.kind === "child") {
      const parentKey = t.slot.split("/")[0];
      const parent = slotByKey.get(parentKey);
      feats.push([t.entry.name, null, featType(t.entry, void 0, className), t.level, `${t.entry.name}`, "childChoice", parent ? slotLabel(parent, className, ancestryName) : null]);
      continue;
    }
    const choice = state.choices[t.slot];
    const qualifier = choice && "qualifier" in choice && choice.qualifier && !choice.qualifier.startsWith("archetype:") ? choice.qualifier.split(":")[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
    const hasChild = compiled.taken.some((x) => x.kind === "child" && x.slot.startsWith(`${t.slot}/`));
    feats.push([t.entry.name, qualifier, featType(t.entry, slot, className), t.level, slot ? slotLabel(slot, className, ancestryName) : "", hasChild ? "parentChoice" : "standardChoice", null]);
  }
  const specials = [
    ...compiled.classFeatures.filter((f) => f.level <= level).map((f) => {
      const save = compiled.saveChoices.find((s) => s.label === f.name && s.chosen);
      return save ? `${f.name} (${save.chosen.charAt(0).toUpperCase()}${save.chosen.slice(1)})` : f.name;
    }),
    ...compiled.classChoices.filter((c) => c.chosen && c.level <= level).map((c) => name(c.chosen)),
    ...compiled.senses,
    ...heritage ? [heritage.name] : []
  ];
  const proficiencies = {
    classDC: pr.classDC * 2,
    perception: pr.perception * 2,
    fortitude: pr.fortitude * 2,
    reflex: pr.reflex * 2,
    will: pr.will * 2,
    heavy: (pr.defenses.heavy ?? 0) * 2,
    medium: (pr.defenses.medium ?? 0) * 2,
    light: (pr.defenses.light ?? 0) * 2,
    unarmored: (pr.defenses.unarmored ?? 0) * 2,
    advanced: (pr.attacks.advanced ?? 0) * 2,
    martial: (pr.attacks.martial ?? 0) * 2,
    simple: (pr.attacks.simple ?? 0) * 2,
    unarmed: (pr.attacks.unarmed ?? 0) * 2,
    castingArcane: 0,
    castingDivine: 0,
    castingOccult: 0,
    castingPrimal: 0,
    piloting: 0,
    computers: 0
  };
  for (const c of compiled.casters) if (c.tradition) {
    const k = `casting${c.tradition.charAt(0).toUpperCase()}${c.tradition.slice(1)}`;
    proficiencies[k] = Math.max(proficiencies[k] ?? 0, c.rank * 2);
  }
  for (const s of SKILL_KEYS) proficiencies[s] = compiled.skills.rank[s] * 2;
  const eq = compiled.equipment;
  const weapons = eq.strikes.filter((s) => s.key !== "fist").map((s) => {
    const item = eq.items.find((i) => i.key === s.key);
    return {
      name: item?.base?.name ?? s.name,
      qty: item?.qty ?? 1,
      prof: s.category,
      die: s.die,
      pot: s.potency,
      str: STRIKING[s.striking] ?? "",
      mat: s.material ?? null,
      display: s.display,
      runes: s.runes,
      damageType: DAMAGE_LETTER[s.damageType] ?? s.damageType,
      attack: s.attack,
      damageBonus: s.damageBonus,
      extraDamage: [],
      increasedDice: false,
      isInventor: false,
      grade: ""
    };
  });
  const armor = eq.items.filter((i) => i.base?.item?.armor || i.base?.item?.shield).map((i) => ({
    name: i.entry?.name ?? i.name,
    qty: i.qty,
    prof: i.base?.item?.shield ? "shield" : (i.base?.item?.armor?.category ?? "unarmored").toLowerCase(),
    pot: i.inv.runes?.potency ?? 0,
    res: RESILIENT[i.inv.runes?.resilient ?? 0] ?? "",
    mat: i.inv.material ? name(i.inv.material.id) : null,
    display: i.inv.customName ?? "",
    worn: !!i.inv.worn,
    runes: (i.inv.runes?.property ?? []).map(name),
    grade: ""
  }));
  const equipment = eq.items.filter((i) => !i.base?.item?.weapon && !i.base?.item?.armor && !i.base?.item?.shield).map((i) => i.inv.invested ? [i.name, i.qty, "Invested"] : [i.name, i.qty]);
  const gp = Math.max(0, eq.money.remaining);
  const money = { pp: 0, gp: Math.floor(gp), sp: Math.floor(gp * 10 % 10), cp: Math.round(gp * 100 % 10) };
  const spellCasters = compiled.casters.map((c) => {
    const choices = state.spellcasting[c.key] ?? {};
    const byRank = (ids) => {
      const out = {};
      for (const id of ids) {
        const e = rules.get(id);
        const r = e?.spell?.cantrip ? 0 : e?.spell?.rank ?? e?.level ?? 1;
        out[String(r)] = [...out[String(r)] ?? [], id];
      }
      return out;
    };
    const prepared = spellLists(choices.prepared, name);
    const spells = c.type === "spontaneous" ? spellLists(choices.repertoire, name) : c.spellbook ? spellLists(byRank(choices.spellbook ?? []), name) : prepared;
    return {
      name: c.name,
      magicTradition: c.tradition ?? "",
      spellcastingType: c.type,
      ability: c.attribute,
      proficiency: c.rank * 2,
      focusPoints: 0,
      innate: false,
      perDay: c.perDay,
      spells,
      prepared: c.spellbook ? prepared : [],
      blendedSpells: []
    };
  });
  const focusTradition = compiled.casters[0]?.tradition ?? cls?.class?.casting?.traditions?.[0] ?? null;
  const focusAttr = compiled.casters[0]?.attribute ?? compiled.keyAttribute ?? "cha";
  const focus = focusTradition && (compiled.focus.spells.length || compiled.focus.cantrips.length) ? { [focusTradition]: { [focusAttr]: {
    abilityBonus: mod[focusAttr],
    proficiency: (compiled.casters[0]?.rank ?? pr.spell) * 2,
    itemBonus: 0,
    focusCantrips: compiled.focus.cantrips.map((s) => s.name),
    focusSpells: compiled.focus.spells.map((s) => s.name)
  } } } : void 0;
  const pets = state.companions.filter((c) => c.kind === "animal").map((c) => {
    const chosen = Object.values(c.choices).flatMap((v) => "id" in v ? [rules.get(v.id)] : []).filter((e) => !!e);
    const advanced = chosen.filter((e) => e.type === "animal-companion-advanced").map((e) => e.name);
    return {
      type: "Animal Companion",
      name: c.name,
      animal: c.type ? name(c.type) : void 0,
      mature: advanced.length > 0,
      incredible: advanced.length > 1,
      incredibleType: advanced.slice(1).join(", ") || void 0,
      specializations: chosen.filter((e) => e.type === "animal-companion-specialization").map((e) => e.name),
      equipment: []
    };
  });
  const familiars = state.companions.filter((c) => c.kind === "familiar").map((c) => ({
    name: c.name,
    type: c.type ? name(c.type) : "Familiar",
    abilities: Object.values(c.choices).flatMap((v) => "id" in v ? [name(v.id)] : [])
  }));
  const ac = compiled.stats.ac;
  const partOf = (re) => ac.parts.filter((p) => re.test(p.label)).reduce((s, p) => s + p.value, 0);
  const acItem = partOf(/^item$/i);
  const acAbility = ac.parts.find((p) => /^(DES|DEX)$/.test(p.label))?.value ?? mod.dex;
  const acProf = ac.total - 10 - acItem - acAbility;
  const resilient = eq.armor?.resilient ?? 0;
  const build = {
    name: state.name,
    class: className,
    dualClass: null,
    level,
    xp: state.xp,
    ancestry: ancestryName,
    heritage: heritage?.name ?? "",
    background: background?.name ?? "",
    alignment: "N",
    gender: state.details.gender ?? "Not set",
    age: state.details.age ?? "Not set",
    deity: state.origin.deity ? name(state.origin.deity) : "Not set",
    size: SIZE[(compiled.size ?? "medium").toLowerCase()] ?? 2,
    sizeName: compiled.size ?? "Medium",
    keyability: compiled.keyAttribute ?? "",
    languages: compiled.languages.length ? compiled.languages : ["None selected"],
    abilities: {
      ...Object.fromEntries(ATTRIBUTES.map((a) => [a, attributeScore(mod[a], partial[a])])),
      breakdown: {
        ancestryFree: label(breakdown.ancestryFree),
        ancestryBoosts: label(breakdown.ancestryBoosts),
        ancestryFlaws: label(breakdown.ancestryFlaws),
        backgroundBoosts: label(breakdown.backgroundBoosts),
        classBoosts: label(breakdown.classBoosts),
        mapLevelledBoosts: Object.fromEntries(Object.entries(breakdown.mapLevelledBoosts).map(([k, v]) => [k, label(v)]))
      }
    },
    attributes: {
      ancestryhp: ancestry?.ancestry?.hp ?? 0,
      classhp: cls?.class?.hp ?? 0,
      bonushp: compiled.stats.hp.parts.filter((p) => /^(Talentos|Feats)$/.test(p.label)).reduce((s, p) => s + p.value, 0),
      bonushpPerLevel: 0,
      speed: ancestry?.ancestry?.speed ?? 0,
      speedBonus: compiled.stats.speed.total - (ancestry?.ancestry?.speed ?? 0)
    },
    proficiencies,
    feats,
    specials,
    lores: compiled.skills.lores.map((l) => [l.name, l.rank * 2]),
    equipment,
    specificProficiencies: { trained: [], expert: [], master: [], legendary: [] },
    weapons,
    armor,
    money,
    spellCasters,
    focusPoints: compiled.focus.points,
    ...focus ? { focus } : {},
    mods: (() => {
      const m = {};
      const savePot = compiled.stats.fortitude.parts.find((p) => /resil|ABP/i.test(p.label))?.value ?? resilient;
      if (savePot) for (const k of ["Fortitude", "Reflex", "Will"]) m[k] = { "Item Bonus": savePot };
      const percPot = compiled.stats.perception.parts.find((p) => /ABP/.test(p.label))?.value;
      if (percPot) m.Perception = { "Item Bonus": percPot };
      for (const [skill, bonus] of Object.entries(compiled.skillBonus)) if (bonus) m[skill.charAt(0).toUpperCase() + skill.slice(1)] = { "Item Bonus": bonus };
      return m;
    })(),
    acTotal: { acProfBonus: acProf, acAbilityBonus: acAbility, acItemBonus: acItem, acTotal: ac.total, shieldBonus: eq.shield ? eq.shield.ac : null },
    pets,
    familiars,
    rituals: (state.spellcasting.rituals?.spellbook ?? []).map(name),
    resistances: compiled.resistances,
    formula: state.formulas.length ? [{ type: "other", known: state.formulas.map(name) }] : [],
    inventorMods: [],
    equipmentContainers: {},
    covil: {
      schema: 1,
      buildId: ctx.buildId,
      rulesVersion: state.rulesVersion,
      warnings: compiled.warnings.filter((w) => w.level !== "info").slice(0, 40).map((w) => ({ code: w.code, message: w.message })),
      ...Object.keys(homebrewFeats).length ? { homebrewFeats } : {},
      ids: Object.fromEntries(Object.entries(state.choices).flatMap(([k, v]) => "id" in v ? [[k, v.id]] : [])),
      // Slot de cada talento escolhido (nome → chave), para "Trocar talento" na Ficha.
      slots: Object.fromEntries(compiled.taken.filter((t) => t.kind !== "granted").map((t) => [t.entry.name, t.slot])),
      variants: compiled.featSlots.some((s) => s.kind === "archetype") ? ["freeArchetype"] : [],
      mythic: compiled.classChoices.find((c) => c.type === "mythic-calling")?.chosen ? { calling: name(compiled.classChoices.find((c) => c.type === "mythic-calling").chosen) } : null,
      unarmed: eq.strikes.filter((s) => s.key === "fist").map((s) => ({ name: s.name, die: s.die, attack: s.attack, damageBonus: s.damageBonus, damageType: s.damageType, traits: s.traits }))
    }
  };
  return { success: true, build };
}

// src/modules/character-builder/remaster.ts
function visitRuleIds(state, visit) {
  function field(owner, key) {
    const id = owner[key];
    if (!id) return;
    const next = visit(id);
    if (next && next !== id) owner[key] = next;
  }
  const choices = (values) => {
    for (const choice of Object.values(values)) if ("id" in choice) field(choice, "id");
  };
  const list = (ids, repeats = false) => {
    if (!ids) return;
    const mapped = ids.map((id) => visit(id) ?? id);
    if (mapped.some((id, i) => id !== ids[i])) ids.splice(0, ids.length, ...repeats ? mapped : new Set(mapped));
  };
  for (const key of ["ancestry", "heritage", "background", "deity"]) {
    field(state.origin, key);
  }
  list(state.origin.languages);
  field(state.class, "id");
  field(state.class, "dual");
  choices(state.choices);
  for (const item of state.inventory) {
    field(item, "item");
    if (item.material) field(item.material, "id");
    list(item.runes?.property);
  }
  list(state.formulas);
  for (const caster of Object.values(state.spellcasting)) {
    list(caster.signature);
    list(caster.spellbook);
    for (const rank of Object.values(caster.repertoire ?? {})) list(rank);
    for (const rank of Object.values(caster.prepared ?? {})) list(rank, true);
  }
  for (const companion of state.companions) {
    field(companion, "type");
    choices(companion.choices);
  }
}
function chosenRuleIds(state) {
  const ids = /* @__PURE__ */ new Set();
  visitRuleIds(state, (id) => {
    ids.add(id);
    return void 0;
  });
  return ids;
}

// src/modules/character-builder/engine/catalog.ts
var ruleListSlug = (value) => value.normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
var ITEM_LISTS = ["weapons", "armor", "shields", "runes", "materials", "worn", "held", "consumables", "gear", "staves-wands", "relics"];
function featListPaths(needs) {
  return [
    "feats/general",
    "feats/skill",
    needs.mythic ? "feats/mythic" : null,
    needs.className ? `feats/class/${ruleListSlug(needs.className)}` : null,
    needs.ancestryName ? `feats/ancestry/${ruleListSlug(needs.ancestryName)}` : null,
    needs.versatileHeritage ? `feats/ancestry/${ruleListSlug(needs.versatileHeritage)}` : null,
    ...needs.archetypes.map((a) => `feats/archetype/${ruleListSlug(a)}`),
    ...(needs.traditions ?? []).map((t) => `spells/${t}`),
    "spells/focus",
    "spells/rituals",
    ...needs.items ? ITEM_LISTS.map((l) => `items/${l}`) : [],
    ...needs.companions ? ["companions/animal", "companions/familiar"] : []
  ].filter((p) => Boolean(p));
}
function needsOf(state, core, mesaRules, extra = {}) {
  const cls = core.classes.find((c) => c.id === state.class.id);
  const anc = core.ancestries.find((a) => a.id === state.origin.ancestry);
  const her = core.heritages.find((h) => h.id === state.origin.heritage);
  const archetypes = new Set(extra.browseArchetype ? [extra.browseArchetype] : []);
  const selected = selectedClassArchetype(state.choices[CLASS_ARCHETYPE], cls);
  const archetype = core.archetypes.find((a) => a.id === selected);
  if (archetype) archetypes.add(archetype.name);
  for (const choice of Object.values(state.choices)) {
    if ("qualifier" in choice && choice.qualifier?.startsWith("archetype:")) archetypes.add(choice.qualifier.slice(10));
  }
  const list = cls?.class?.casting?.traditions ?? [];
  const chosen = state.choices["spell-tradition"];
  const own = list.length === 1 ? list : chosen && "value" in chosen ? [chosen.value] : [];
  return {
    references: [.../* @__PURE__ */ new Set([...chosenRuleIds(state), ...extra.references ?? []])].sort(),
    className: cls?.name,
    ancestryName: anc?.name,
    versatileHeritage: her && !her.heritage?.ancestry ? her.name : void 0,
    mythic: variantFlags(state, mesaRules ?? void 0).mythic,
    archetypes: [...archetypes].sort(),
    items: state.inventory.length > 0 || state.formulas.length > 0 || !!extra.itemsWanted,
    companions: state.companions.length > 0 || !!extra.itemsWanted,
    traditions: [.../* @__PURE__ */ new Set([...own, ...extra.traditions ?? []])].map((t) => t.toLowerCase())
  };
}
async function locate(ids, reader, read) {
  const paths = /* @__PURE__ */ new Set();
  const locations = await reader.read("core/locations");
  for (const id of ids) if (locations?.[id]) paths.add(locations[id]);
  const rows = await reader.read("core/remaster") ?? [];
  for (const row of rows) {
    if (ids.has(row.id) && row.list) paths.add(row.list);
    for (const target of row.targets ?? []) if (ids.has(target.id) && target.list) paths.add(target.list);
  }
  return (await Promise.all([...paths].map(read))).flat().filter((e) => ids.has(e.id));
}
async function compileFromCatalog(state, ctx) {
  const lists = /* @__PURE__ */ new Map();
  const read = async (path) => {
    if (!lists.has(path)) {
      const raw = await ctx.reader.read(path);
      lists.set(path, Array.isArray(raw) ? raw : []);
    }
    return lists.get(path);
  };
  const [ancestries, heritages, backgrounds, classes, languages, classFeatures, archetypes] = await Promise.all(
    ["core/ancestries", "core/heritages", "core/backgrounds", "core/classes", "core/languages", "core/class-features", "core/archetypes"].map(read)
  );
  const tables = await ctx.reader.read("core/tables");
  const homebrew = ctx.homebrew ?? [];
  const of = (type) => homebrew.filter((e) => e.type === type);
  const core = {
    ancestries,
    heritages: [...heritages, ...of("heritage")],
    backgrounds: [...backgrounds, ...of("background")],
    classes,
    languages,
    classFeatures,
    archetypes
  };
  const loose = homebrew.filter((e) => e.type !== "background" && e.type !== "heritage");
  const supplement = [];
  let traditions = [];
  let result = null;
  let remasterTried = false;
  const grantsTried = /* @__PURE__ */ new Set();
  for (let round = 0; round < 6; round += 1) {
    const needs = needsOf(state, core, ctx.mesaRules, { traditions });
    const loaded = await Promise.all(featListPaths(needs).map(read));
    const index = buildRulesIndex([
      core.ancestries,
      core.heritages,
      core.backgrounds,
      core.classes,
      core.languages,
      core.classFeatures,
      loaded.flat(),
      loose,
      core.archetypes,
      supplement
    ], core.languages);
    const missing = new Set((needs.references ?? []).filter((id) => !id.startsWith("custom:") && !id.startsWith("mesa:") && !index.get(id)));
    if (missing.size && !remasterTried) {
      remasterTried = true;
      const found = await locate(missing, ctx.reader, read);
      if (found.length) {
        supplement.push(...found);
        continue;
      }
    }
    const compiled = compileBuild(state, {
      rules: index,
      mesaRules: ctx.mesaRules ?? void 0,
      classOptions: core.classFeatures,
      tables: tables ?? void 0,
      buildId: ctx.buildId
    });
    const granted = new Set(compiled.missingRefs.filter((id) => !grantsTried.has(id)));
    if (granted.size) {
      for (const id of granted) grantsTried.add(id);
      const found = await locate(granted, ctx.reader, read);
      if (found.length) {
        supplement.push(...found);
        continue;
      }
    }
    result = { compiled, index, sheet: exportBuild(state, compiled, { rules: index, buildId: ctx.buildId }) };
    const next = [.../* @__PURE__ */ new Set([...traditions, ...compiled.casters.map((c) => c.tradition).filter((t) => !!t)])].sort();
    if (next.length === traditions.length) break;
    traditions = next;
  }
  return result;
}

// src/pathbuilder/types.ts
function parseFeatEntry(f) {
  if (Array.isArray(f)) {
    return {
      name: String(f[0] ?? ""),
      type: String(f[2] ?? tr("Outro", "Other")),
      level: Number(f[3] ?? 1)
    };
  }
  return {
    name: String(f.name ?? ""),
    type: String(f.type ?? tr("Outro", "Other")),
    level: Number(f.level ?? 1)
  };
}
function parseCharacterJson(json) {
  const obj = json;
  if (!obj || !obj.success || !obj.build) {
    throw new Error(tr('JSON de personagem inv\xE1lido: campo "build" ausente.', 'Invalid character JSON: missing "build" field.'));
  }
  return normalizeBuild(obj.build);
}
var hasSpells = (lists) => Array.isArray(lists) && lists.some((l) => Array.isArray(l?.list) && l.list.length > 0);
function normalizeSpellCasters(build) {
  if (!build.spellCasters?.some((c) => hasSpells(c.prepared))) return build;
  return {
    ...build,
    spellCasters: build.spellCasters.map(
      (c) => hasSpells(c.prepared) ? { ...c, spells: c.prepared } : c
    )
  };
}
var WEAPON_EXPORT_FIXES = [
  // Longsword +1 striking do Nathaniel: o export dá 18 (10 + Perito 4 + FOR 4); o certo é 19.
  { character: /^nathaniel/i, weapon: "zarroc sheilvean" }
  // i18n-ok: nome
];
function fixWeaponExports(build) {
  const fixes = WEAPON_EXPORT_FIXES.filter((f) => f.character.test(build.name ?? ""));
  if (fixes.length === 0 || !Array.isArray(build.weapons)) return build;
  let changed = false;
  const weapons = build.weapons.map((w) => {
    const label = (w.display || w.name || "").trim().toLowerCase();
    if (!fixes.some((f) => f.weapon === label)) return w;
    const prof = build.proficiencies[w.prof] ?? 0;
    const str = Math.floor(((build.abilities?.str ?? 10) - 10) / 2);
    const expected = build.level + (prof > 0 ? prof : 0) + str + (w.pot || 0);
    if (w.attack !== expected - 1) return w;
    changed = true;
    return { ...w, attack: expected };
  });
  return changed ? { ...build, weapons } : build;
}
var SIZE_SPECIALS = /* @__PURE__ */ new Set(["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]);
function dropSizeSpecials(build) {
  if (!build.specials?.some((s) => SIZE_SPECIALS.has(s))) return build;
  return { ...build, specials: build.specials.filter((s) => !SIZE_SPECIALS.has(s)) };
}
var PATHS = ["Path to Perfection", "Second Path to Perfection", "Third Path to Perfection"];
var SAVE_NAMES = /* @__PURE__ */ new Set(["Fortitude", "Reflex", "Will"]);
function fixPathToPerfection(build) {
  if (!/^monk$/i.test(build.class ?? "") || !build.specials) return build;
  if (build.specials.some((s) => /path to perfection/i.test(s))) return build;
  const allowed = build.level >= 15 ? 3 : build.level >= 11 ? 2 : build.level >= 7 ? 1 : 0;
  let used = 0;
  let changed = false;
  const specials = build.specials.map((s) => {
    if (!SAVE_NAMES.has(s) || used >= allowed) return s;
    changed = true;
    return `${PATHS[used++]} (${s})`;
  });
  return changed ? { ...build, specials } : build;
}
function fixFocusPool(build) {
  if (!build.focusPoints || /^psychic$/i.test(build.class ?? "")) return build;
  let spells = 0;
  for (const byAttr of Object.values(build.focus ?? {})) {
    for (const group of Object.values(byAttr ?? {})) spells += group?.focusSpells?.length ?? 0;
  }
  const pool = Math.min(3, spells);
  if (spells === 0 || build.focusPoints <= pool) return build;
  return { ...build, focusPoints: pool };
}
var ITEM_RESISTANCES = {
  "arachnid harness": "poison 2"
  // Treasure Vault (Remastered) pg. 14
};
function addItemResistances(build) {
  const have = new Set((build.resistances ?? []).map((r) => String(r).trim().toLowerCase()));
  const add = (build.armor ?? []).filter((a) => a.worn).map((a) => ITEM_RESISTANCES[String(a.name ?? "").trim().toLowerCase()]).filter((r) => !!r && !have.has(r));
  return add.length ? { ...build, resistances: [...build.resistances ?? [], ...add] } : build;
}
function normalizeBuild(build) {
  return addItemResistances(fixFocusPool(fixPathToPerfection(dropSizeSpecials(fixWeaponExports(normalizeSpellCasters(build))))));
}

// src/modules/character-builder/engine/import.ts
var ATTR2 = { Str: "str", Dex: "dex", Con: "con", Int: "int", Wis: "wis", Cha: "cha" };
var STRIKING2 = { "": 0, striking: 1, greaterStriking: 2, majorStriking: 3 };
var RESILIENT2 = { "": 0, resilient: 1, greaterResilient: 2, majorResilient: 3 };
var lower = (list) => (list ?? []).map((a) => ATTR2[a]).filter(Boolean);
function slotKeyFromLabel(label, className, level) {
  let m = /^Free Archetype (\d+)$/.exec(label);
  if (m) return `archetype-feat-${m[1]}`;
  m = /^Mythic Feat (\d+)$/.exec(label);
  if (m) return `mythic-feat-${m[1]}`;
  m = /^(?:Skill Feat|Skill Lessons) (\d+)$/.exec(label);
  if (m) return `skill-feat-${m[1]}`;
  m = /^General Feat (\d+)$/.exec(label);
  if (m) return `general-feat-${m[1]}`;
  if (label === "Combat Flexibility" || label === "Improved Flexibility") return `flexibility-feat-${level}`;
  m = new RegExp(`^${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} Feat (\\d+)$`).exec(label);
  if (m) return `class-feat-${m[1]}`;
  m = /^Ancestral Paragon Feat (\d+)$/.exec(label);
  if (m) return `paragon-feat-${m[1]}`;
  m = /^(.+) Feat (\d+)$/.exec(label);
  if (m) return `ancestry-feat-${m[2]}`;
  return null;
}
function importPathbuilder(b, ctx) {
  const { rules } = ctx;
  const notFound = [];
  const guesses = [];
  const find = (name, type) => {
    if (!name || name === "Not set" || name === "None selected") return void 0;
    const e = rules.byName(name, type);
    if (!e) notFound.push(name);
    return e;
  };
  const ancestry = find(b.ancestry, "ancestry");
  const heritage = find(b.heritage, "heritage");
  const background = find(b.background, "background");
  const cls = find(b.class, "class");
  const bd = b.abilities.breakdown;
  const listedFlaws = ancestry?.ancestry?.flaws ?? [];
  const alternate = !!bd && (bd.ancestryBoosts ?? []).length === 0 && (ancestry?.ancestry?.boosts ?? []).some((x) => x !== "free");
  const choices = {};
  if (bd) {
    if (bd.ancestryFree?.length) choices["boosts-ancestry"] = { boosts: lower(bd.ancestryFree) };
    if (bd.backgroundBoosts?.length) choices["boosts-background"] = { boosts: lower(bd.backgroundBoosts) };
    for (const [lvl, list] of Object.entries(bd.mapLevelledBoosts ?? {})) choices[`boosts-${lvl}`] = { boosts: lower(list) };
  } else guesses.push("atributos sem mem\xF3ria dos boosts no export");
  const languages = (b.languages ?? []).filter((l) => l !== "None selected" && !(ancestry?.ancestry?.languages ?? []).includes(l)).map((l) => rules.languages.find((x) => x.name === l || (x.legacyNames ?? []).includes(l))?.id).filter((x) => !!x);
  const parentByLabel = /* @__PURE__ */ new Map();
  for (const f of b.feats) {
    if (!Array.isArray(f)) continue;
    const [name, qualifier, , level, label, kind] = f;
    if (!label || kind === "childChoice" || label.startsWith("BACKGROUND_")) continue;
    if (label === "Heritage Feat") {
      if (heritage) parentByLabel.set(label, { key: `awarded:${heritage.aon.id}`, entry: heritage });
      continue;
    }
    const key2 = slotKeyFromLabel(label, b.class, Number(level));
    const entry = find(name, "feat");
    if (!key2 || !entry) continue;
    const q = qualifier ? `skill:${qualifier.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : void 0;
    const archetype = entry.feat?.archetype?.[0];
    choices[key2] = { id: entry.id, ...q && /^skill:[a-z0-9-]+$/.test(q) ? { qualifier: q } : archetype ? { qualifier: `archetype:${archetype.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` } : {} };
    parentByLabel.set(label, { key: key2, entry });
  }
  for (const f of b.feats) {
    if (!Array.isArray(f) || f[5] !== "childChoice") continue;
    const parentLabel = String(f[6] ?? "");
    const parent = parentByLabel.get(parentLabel);
    const child = find(String(f[0]), "feat");
    if (!parent || !child) continue;
    const flag = (parent.entry.rules ?? []).find((r) => r.key === "ChoiceSet" && r.choices && typeof r.choices === "object" && !Array.isArray(r.choices))?.flag;
    if (typeof flag === "string") choices[`${parent.key}/choice:${flag}`] = { id: child.id };
    else guesses.push(`escolha filha sem lugar: ${f[0]} (de ${parentLabel})`);
  }
  const specialKeys = new Set((b.specials ?? []).map((sp) => sp.toLowerCase().replace(/^hunter['’]s edge:\s*/, "").replace(/\s+(racket|instinct|methodology|muse|bloodline|order|mystery|patron|school|style|way|research field|doctrine)$/, "")));
  const types = Object.entries(CLASS_CHOICE_TYPES).filter(([, spec]) => spec.className.toLowerCase() === b.class.toLowerCase()).map(([t]) => t);
  for (const type of [...types, "mythic-calling"]) {
    const option = (ctx.classOptions ?? []).filter((o) => o.type === type).find((o) => specialKeys.has(o.name.toLowerCase()) || (b.specials ?? []).includes(o.name));
    if (option) choices[`class-choice:${type}`] = { id: option.id };
  }
  const covil = b.covil;
  const archetypeId = covil?.ids ? covil.ids[CLASS_ARCHETYPE] : Object.entries(CLASS_ARCHETYPES).find(([id, spec]) => spec.className === cls?.name && (Object.values(choices).some((c) => "id" in c && c.id === spec.dedication) || id === BLOODRAGER && specialKeys.has("bloodrager") || id === WAR_MAGE && specialKeys.has("war magic") || id === PALATINE_DETECTIVE && specialKeys.has("esoterica") || id === RUNELORD && specialKeys.has("school of thassilonian rune magic")))?.[0];
  if (archetypeId && cls && CLASS_ARCHETYPES[archetypeId]?.className === cls.name) {
    choices[CLASS_ARCHETYPE] = { id: archetypeId };
    const fixed = CLASS_ARCHETYPES[archetypeId].subclass;
    const key2 = `class-choice:${fixed.split(":")[0]}`;
    if (covil?.ids?.[key2]) choices[key2] = { id: covil.ids[key2] };
    else if (choices[key2] && "id" in choices[key2] && choices[key2].id === fixed) delete choices[key2];
  }
  if (archetypeId === BLOODRAGER) {
    const caster = b.spellCasters?.find((c) => c.name === "Archetype Bloodrager");
    const slot = Object.keys(choices).find((k) => {
      const c = choices[k];
      return "id" in c && c.id === CLASS_ARCHETYPES[BLOODRAGER].dedication;
    });
    if (slot && (caster?.magicTradition === "arcane" || caster?.magicTradition === "divine")) {
      choices[`${slot}/choice:skill`] = { value: caster.magicTradition === "arcane" ? "arcana" : "religion" };
    }
  }
  for (const sp of b.specials ?? []) {
    const m = /^(Path to Perfection|Second Path to Perfection|Third Path to Perfection) \((Fortitude|Reflex|Will)\)$/.exec(sp);
    const ref = m && cls?.class?.features?.find((x) => x.name === m[1]);
    if (ref) choices[`class-choice:save-${ref.level}`] = { value: m[2].toLowerCase() };
  }
  const groupFeatures = (cls?.class?.features ?? []).filter((x) => /^(fighter weapon mastery|weapon legend)$/i.test(x.name) && x.level <= b.level);
  for (const [i, ref] of groupFeatures.entries()) {
    const names = i === 0 ? [...b.specificProficiencies?.master ?? [], ...b.specificProficiencies?.legendary ?? []] : b.specificProficiencies?.legendary ?? [];
    const group = names.map((n2) => rules.byName(n2)?.item?.weapon?.group).find(Boolean);
    if (group) choices[`class-choice:weapon-group-${ref.level}`] = { value: group.toLowerCase() };
    else guesses.push(`${ref.name}: grupo de arma n\xE3o identificado no export`);
  }
  const base = {
    schema: 1,
    rulesVersion: "",
    name: b.name,
    level: b.level,
    xp: b.xp ?? 0,
    options: {},
    origin: {
      ancestry: ancestry?.id,
      heritage: heritage?.id,
      background: background?.id,
      alternateBoosts: alternate || void 0,
      voluntaryFlaws: lower(bd?.ancestryFlaws).filter((f) => !listedFlaws.includes(f)),
      languages,
      deity: find(b.deity, "deity")?.id
    },
    class: { id: cls?.id, keyAttribute: lower(bd?.classBoosts)[0] ?? b.keyability },
    choices,
    manual: {},
    inventory: [],
    money: { ...b.money },
    formulas: [],
    spellcasting: {},
    companions: [],
    details: (() => {
      const x = b;
      return { ...x.gender && x.gender !== "Not set" ? { gender: x.gender } : {}, ...x.age && x.age !== "Not set" ? { age: String(x.age) } : {} };
    })(),
    history: [{ at: (/* @__PURE__ */ new Date()).toISOString(), by: "import", note: "Importado do Pathbuilder", kind: "override" }]
  };
  if (!b.feats.some((f) => Array.isArray(f) && /^Free Archetype/.test(String(f[4] ?? "")))) base.options.variants = { freeArchetype: false };
  const want = Object.fromEntries(SKILL_KEYS.map((s) => [s, Math.round((b.proficiencies[s] ?? 0) / 2)]));
  const children = compileBuild(base, ctx).featChildren.filter((c) => !choices[c.key]);
  const specialNames = new Set((b.specials ?? []).map((sp) => sp.toLowerCase()));
  for (const child of children) {
    const flag = child.key.split("/choice:")[1]?.toLowerCase() ?? "";
    if (child.kind === "feat") {
      const option = (ctx.classOptions ?? []).find((o) => specialNames.has(o.name.toLowerCase()) && flag.includes(o.type.toLowerCase()));
      if (option) {
        choices[child.key] = { id: option.id };
        continue;
      }
      const traits = (child.filter?.traits ?? []).filter((t) => !t.includes("{"));
      const row = traits.length ? b.feats.find((f) => Array.isArray(f) && Number(f[3]) === child.level && traits.some((t) => String(f[2] ?? "").toLowerCase() === `${t.toLowerCase()} feat`)) : void 0;
      const entry = row ? rules.byName(String(row[0]), "feat") : void 0;
      if (entry) choices[child.key] = { id: entry.id };
    } else if (child.kind === "value" && child.options?.length && child.options.every((o) => SKILL_KEYS.includes(o.value))) {
      const pick = child.options.find((o) => want[o.value] >= 1);
      if (pick) choices[child.key] = { value: pick.value };
    }
  }
  const auto = compileBuild(base, ctx);
  const have = auto.skills.rank;
  const classSlots = auto.skillSlots.filter((s) => s.key.startsWith("class-skill-"));
  for (const slot of classSlots) {
    const pick = slot.options.find((o) => o.startsWith("skill:") && want[o.slice(6)] >= 1);
    if (pick) choices[slot.key] = { skills: [pick] };
  }
  const trained = new Set(Object.entries(have).filter(([, r]) => r >= 1).map(([k]) => k));
  for (const slot of classSlots) for (const s of choices[slot.key]?.skills ?? []) trained.add(s.slice(6));
  const toTrain = SKILL_KEYS.filter((s) => want[s] >= 1 && !trained.has(s)).map((s) => `skill:${s}`);
  const lores = (b.lores ?? []).map(([n2, bonus]) => ({ ref: skillRef(`${n2} Lore`), rank: Math.round(bonus / 2) })).filter((l) => !auto.skills.lores.some((x) => x.key === l.ref));
  const freeSlots = auto.skillSlots.filter((s) => s.kind === "train" && !s.key.startsWith("class-skill-"));
  const queue = [...toTrain, ...lores.filter((l) => l.rank >= 1).map((l) => l.ref)];
  for (const slot of freeSlots.filter((s) => s.loreOnly)) {
    const take = queue.filter((r) => r.startsWith("lore:")).slice(0, slot.count);
    for (const r of take) queue.splice(queue.indexOf(r), 1);
    if (take.length) choices[slot.key] = { skills: take };
  }
  for (const slot of freeSlots.filter((s) => !s.loreOnly)) {
    const take = queue.splice(0, slot.count);
    if (take.length) choices[slot.key] = { skills: take };
  }
  const increases = (cls?.class?.skillIncreaseLevels ?? []).filter((l) => l <= b.level);
  const steps = [];
  for (const s of SKILL_KEYS) for (let r = 2; r <= want[s]; r++) steps.push({ ref: `skill:${s}`, to: r });
  for (const l of lores) for (let r = 2; r <= l.rank; r++) steps.push({ ref: l.ref, to: r });
  for (const ref of queue) steps.unshift({ ref, to: 1 });
  steps.sort((a, b2) => a.to - b2.to);
  const used = /* @__PURE__ */ new Set();
  for (const step2 of steps) {
    const minLevel = step2.to === 4 ? 15 : step2.to === 3 ? 7 : 1;
    const lvl = increases.find((l) => l >= minLevel && !used.has(l));
    if (lvl === void 0) {
      guesses.push(`aumento sem lugar: ${step2.ref} \u2192 ${step2.to}`);
      continue;
    }
    used.add(lvl);
    choices[`skill-increase-${lvl}`] = { skills: [step2.ref] };
  }
  if (steps.length) guesses.push("ordem dos aumentos de per\xEDcia deduzida (do n\xEDvel mais baixo)");
  let n = 0;
  const key = () => `inv-imp${(n++).toString(36)}`;
  const inventory = [];
  for (const w of b.weapons ?? []) {
    const e = find(w.name);
    if (!e) continue;
    inventory.push({
      key: key(),
      item: e.id,
      qty: w.qty || 1,
      acquired: "given",
      equipped: true,
      runes: { potency: w.pot || 0, striking: STRIKING2[w.str ?? ""] ?? 0, property: (w.runes ?? []).map((r) => rules.byName(r)?.id).filter((x) => !!x) }
    });
  }
  for (const a of b.armor ?? []) {
    const e = find(a.name);
    if (!e) continue;
    inventory.push({
      key: key(),
      item: e.id,
      qty: a.qty || 1,
      acquired: "given",
      worn: !!a.worn,
      runes: { potency: a.pot || 0, resilient: RESILIENT2[a.res ?? ""] ?? 0, property: (a.runes ?? []).map((r) => rules.byName(r)?.id).filter((x) => !!x) }
    });
  }
  for (const [name, qty, ...rest] of b.equipment ?? []) {
    const e = find(name);
    if (!e) continue;
    inventory.push({ key: key(), item: e.id, qty: qty || 1, acquired: "given", invested: rest.includes("Invested") && (e.traits ?? []).includes("Invested") });
  }
  const spellcasting = {};
  const spellId = (name) => find(name.replace(/ \(Amped\)$/, ""), "spell")?.id;
  const classCaster = (b.spellCasters ?? []).find((c) => c.name === b.class);
  if (classCaster) {
    const byRank = (lists) => Object.fromEntries((lists ?? []).filter((l) => l.list.length).map((l) => [String(l.spellLevel), l.list.map(spellId).filter((x) => !!x)]));
    if (classCaster.spellcastingType === "spontaneous") spellcasting.class = { repertoire: byRank(classCaster.spells) };
    else {
      const prepared = byRank(classCaster.prepared?.length ? classCaster.prepared : classCaster.spells);
      const book = Object.values(byRank(classCaster.spells)).flat();
      spellcasting.class = { prepared, ...book.length ? { spellbook: book } : {} };
    }
    if (cls?.class?.casting && cls.class.casting.traditions.length > 1) choices["spell-tradition"] = { value: classCaster.magicTradition };
  }
  for (const caster of (b.spellCasters ?? []).filter((c) => /^Archetype /.test(c.name))) {
    const slug = caster.name.replace(/^Archetype /, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const byRank = (lists) => Object.fromEntries((lists ?? []).filter((l) => l.list.length).map((l) => [String(l.spellLevel), l.list.map(spellId).filter((x) => !!x)]));
    if (caster.spellcastingType === "spontaneous") spellcasting[`archetype:${slug}`] = { repertoire: byRank(caster.spells) };
    else {
      const book = Object.values(byRank(caster.spells)).flat();
      spellcasting[`archetype:${slug}`] = { prepared: byRank(caster.prepared?.length ? caster.prepared : caster.spells), ...book.length ? { spellbook: book } : {} };
    }
  }
  const focusNames = Object.values(b.focus ?? {}).flatMap((byAttr) => Object.values(byAttr));
  const focusCantrips = focusNames.flatMap((f) => f.focusCantrips ?? []).map(spellId).filter((x) => !!x);
  const focusSpells = focusNames.flatMap((f) => f.focusSpells ?? []).map(spellId).filter((x) => !!x);
  if (focusCantrips.length || focusSpells.length) spellcasting.focus = { repertoire: { 0: focusCantrips, 1: focusSpells } };
  const rituals = (b.rituals ?? []).map((r) => find(r, "spell")?.id ?? find(r)?.id).filter((x) => !!x);
  if (rituals.length) spellcasting.rituals = { spellbook: rituals };
  const companions = [];
  for (const p of b.pets ?? []) {
    if (p.type !== "Animal Companion") continue;
    const type = p.animal ? rules.byName(p.animal)?.id : void 0;
    companions.push({ key: `pet-imp${companions.length}`, kind: "animal", name: p.name || p.animal || "Companion", ...type ? { type } : {}, choices: {} });
  }
  for (const f of b.familiars ?? []) {
    const abilities = (f.abilities ?? []).map((a) => rules.byName(a)?.id).filter((x) => !!x);
    companions.push({ key: `pet-imp${companions.length}`, kind: "familiar", name: f.name || "Familiar", choices: Object.fromEntries(abilities.map((id, i) => [`ability-${i + 1}`, { id }])) });
  }
  return {
    state: { ...base, choices, inventory, spellcasting, companions },
    report: { notFound: [...new Set(notFound)].sort(), guesses }
  };
}

// src/modules/character-builder/engine/importCatalog.ts
async function importFromCatalog(json, ctx) {
  const b = parseCharacterJson(json);
  const read = async (path) => {
    const raw = await ctx.reader.read(path).catch(() => null);
    return Array.isArray(raw) ? raw : [];
  };
  const [a, h, bg, c, l, cf, ar] = await Promise.all(
    ["core/ancestries", "core/heritages", "core/backgrounds", "core/classes", "core/languages", "core/class-features", "core/archetypes"].map(read)
  );
  const tables = await ctx.reader.read("core/tables").catch(() => null);
  const her = h.find((x) => x.name === b.heritage);
  const dedications = b.feats.map((f) => parseFeatEntry(f).name).filter((n) => / Dedication$/.test(n)).map((n) => n.replace(/ Dedication$/, ""));
  const traditions = [...new Set(b.spellCasters.map((x) => x.magicTradition).filter((t) => ["arcane", "divine", "occult", "primal"].includes(t)))];
  const flairNames = new Set(b.feats.filter((f) => Array.isArray(f) && / Feat$/.test(String(f[2] ?? "")) && dedications.some((d) => String(f[2]).toLowerCase() === `${d.toLowerCase()} feat`)).map((f) => String(f[0])));
  const dedicatedClasses = dedications.filter((d) => c.some((x) => x.name.toLowerCase() === d.toLowerCase())).map((d) => `feats/class/${ruleListSlug(d)}`);
  const flair = (await Promise.all(dedicatedClasses.map(read))).flat().filter((e) => flairNames.has(e.name));
  const paths = [
    ...featListPaths({
      className: b.class,
      ancestryName: b.ancestry,
      versatileHeritage: her && !her.heritage?.ancestry ? her.name : void 0,
      mythic: true,
      archetypes: dedications.map(ruleListSlug),
      traditions
    }),
    ...ITEM_LISTS.map((x) => `items/${x}`),
    "companions/animal",
    "companions/familiar",
    "core/deities"
  ];
  const extra = await Promise.all(paths.map(read));
  const homebrew = ctx.homebrew ?? [];
  const index = buildRulesIndex([a, h, bg, c, l, cf, ...extra, ar, homebrew, flair], l);
  const { state, report } = importPathbuilder(b, { rules: index, mesaRules: ctx.mesaRules ?? void 0, classOptions: cf, tables: tables ?? void 0 });
  return { state, report, className: b.class || null, name: b.name };
}
export {
  compileFromCatalog,
  exportBuild,
  featListPaths,
  importFromCatalog,
  needsOf
};
