// ===================================================
// differ.mjs — 差异对比引擎
// 接收两个存档数据对象，从指定国家视角输出事件列表
// ===================================================

// ===== 工具函数 =====

function findNew(oldArr, newArr) {
  const oldSet = new Set(
    Array.isArray(oldArr) ? oldArr : oldArr ? [oldArr] : [],
  );
  const newList = Array.isArray(newArr) ? newArr : newArr ? [newArr] : [];
  return newList.filter((x) => !oldSet.has(x));
}

function getCombatKey(battle) {
  const atk = battle.attacker?.log?.combat_side_data?.tags;
  const def = battle.defender?.log?.combat_side_data?.tags;
  const atkTag = Array.isArray(atk) ? atk[0] : atk || "?";
  const defTag = Array.isArray(def) ? def[0] : def || "?";
  return `${atkTag}_vs_${defTag}_at_${battle.location}`;
}

function summarizeBattle(battle) {
  const atk = battle.attacker?.log?.combat_side_data?.tags;
  const def = battle.defender?.log?.combat_side_data?.tags;
  return {
    attacker: Array.isArray(atk) ? atk[0] : atk || "?",
    defender: Array.isArray(def) ? def[0] : def || "?",
    location: battle.location,
    terrain: battle.terrain || "unknown",
    atkDamage: battle.attacker?.log?.total_damage || 0,
    defDamage: battle.defender?.log?.total_damage || 0,
    duration: battle.duration || 0,
  };
}

function extractResearch(technology) {
  if (!technology?.technologies) return [];
  const techs = technology.technologies;
  return Object.keys(techs).filter(k => k && k !== "empty").map((techKey) => ({
    tech: techKey,
  }));
}

/**
 * 从 active_relations 中提取外交条约
 */
function extractTreaties(diplomacy) {
  const relations = diplomacy?.active_relations || {};
  const treaties = {};

  const TREATY_FIELDS = [
    "guarantee",
    "non_aggression_pact",
    "war_relation",
    "military_access",
  ];

  for (const [tag, rel] of Object.entries(relations)) {
    const found = {};
    for (const field of TREATY_FIELDS) {
      if (rel[field]) {
        found[field] = rel[field];
      }
    }
    if (Object.keys(found).length > 0) {
      treaties[tag] = found;
    }
  }

  return treaties;
}

/**
 * 提取战争目标
 */
function extractWargoals(allWargoals) {
  const result = [];
  for (const [ownerTag, wgObj] of Object.entries(allWargoals || {})) {
    const wgList = Array.isArray(wgObj) ? wgObj : Object.values(wgObj || {});
    for (const wg of wgList) {
      if (!wg || typeof wg !== "object") continue;
      result.push({
        actor: wg.wargoaldata_actor || ownerTag,
        recipient: wg.wargoaldata_recipient || wg.target || wg.recipient || null,
        type: wg.type || "unknown",
      });
    }
  }
  return result;
}

/**
 * 获取指定国家的数据
 * 兼容旧格式（player直接在顶层）和新格式（在countryData里）
 */
function getCountry(save, tag) {
  if (save.countryData?.[tag]) return save.countryData[tag];
  if (tag === save.player) {
    return {
      stability: save.stability,
      war_support: save.war_support,
      focus: save.focus,
      politics: save.politics,
      diplomacy: save.diplomacy,
      production: save.production,
      technology: save.technology,
      fuel_status: save.fuel_status,
    };
  }
  return null;
}

/**
 * 把零散战斗聚合成战线概况
 * 输入：战斗摘要数组
 * 输出：按 "攻方-守方" 配对聚合的概况数组
 */
function aggregateBattles(battles) {
  // 按 攻方+守方 的无序配对分组（A打B 和 B打A 算同一条战线）
  const fronts = {};

  for (const b of battles) {
    // 生成无序key：字母序靠前的在前面
    const pair = [b.attacker, b.defender].sort().join("_vs_");
    if (!fronts[pair]) {
      fronts[pair] = {
        sideA: [b.attacker, b.defender].sort()[0],
        sideB: [b.attacker, b.defender].sort()[1],
        count: 0,
        totalAtkDamage: 0,
        totalDefDamage: 0,
        // 按原始攻守方累计伤害，用于判断谁占优
        damageBy: {}, // { "GER": 总造成伤害, "SOV": 总造成伤害 }
      };
    }

    const front = fronts[pair];
    front.count++;
    front.totalAtkDamage += b.atkDamage;
    front.totalDefDamage += b.defDamage;

    // 攻方造成的伤害算攻方的战果
    front.damageBy[b.attacker] =
      (front.damageBy[b.attacker] || 0) + b.atkDamage;
    // 守方造成的伤害算守方的战果
    front.damageBy[b.defender] =
      (front.damageBy[b.defender] || 0) + b.defDamage;
  }

  return Object.values(fronts);
}

// ===== 主对比函数 =====

/**
 * @param {object} snapshot - 上次存档数据
 * @param {object} current  - 本次存档数据
 * @param {string} viewTag  - 从哪个国家的视角进行对比
 * @param {object} [vpDict] - 胜利点字典（用于过滤小地区）
 */
export function diffSaves(snapshot, current, viewTag, vpDict) {
  const events = [];

  const oldC = getCountry(snapshot, viewTag);
  const newC = getCountry(current, viewTag);

  if (!oldC || !newC) {
    console.warn(`⚠️ 无法获取 ${viewTag} 的数据，跳过对比`);
    return events;
  }

  // ===== 1. 国策变化 =====
  const newFocuses = findNew(oldC.focus?.completed, newC.focus?.completed);
  newFocuses.forEach((f) => events.push({ type: "focus_completed", data: f }));

  // ===== 2. 国家精神变化 =====
  const gainedIdeas = findNew(oldC.politics?.ideas, newC.politics?.ideas);

  const lostIdeas = findNew(newC.politics?.ideas, oldC.politics?.ideas);

  gainedIdeas.forEach((i) => events.push({ type: "idea_gained", data: i }));
  lostIdeas.forEach((i) => events.push({ type: "idea_lost", data: i }));

  // ===== 3. 领土变化 =====
  const allIds = new Set([
    ...Object.keys(snapshot.states || {}),
    ...Object.keys(current.states || {}),
  ]);

  allIds.forEach((id) => {
    const oldState = snapshot.states?.[id];
    const newState = current.states?.[id];

    const oldOwner = oldState?.owner;
    const newOwner = newState?.owner;
    const oldController = oldState?.controller || oldState?.owner;
    const newController = newState?.controller || newState?.owner;

    if (oldOwner !== newOwner) {
      if (newOwner === viewTag)
        events.push({ type: "state_owner_gained", data: id });
      if (oldOwner === viewTag)
        events.push({ type: "state_owner_lost", data: id });
    }

    if (oldController !== newController) {
      if (newController === viewTag && oldOwner !== viewTag)
        events.push({ type: "state_controlled_gained", data: id });
      if (oldController === viewTag && newController !== viewTag)
        events.push({ type: "state_controlled_lost", data: id });

      // 第三方占领：只报告重要地区（VP≥10）
      if (
        newController !== viewTag &&
        oldController !== viewTag &&
        oldController !== newController
      ) {
        const stateVP = vpDict?.[id]?.vp || 0;
        if (stateVP >= 10) {
          events.push({
            type: "state_controlled_third_party",
            data: { id, from: oldController, to: newController },
          });
        }
      }
    }
  });

  // ===== 4. 阵营变化 =====
  const oldFactions = Array.isArray(snapshot.faction) ? snapshot.faction : [];
  const newFactions = Array.isArray(current.faction) ? current.faction : [];

  const oldMyFaction = oldFactions.find((f) => f.members?.includes(viewTag));
  const newMyFaction = newFactions.find((f) => f.members?.includes(viewTag));

  const oldMembers = oldMyFaction?.members || [];
  const newMembers = newMyFaction?.members || [];

  findNew(oldMembers, newMembers).forEach((tag) =>
    events.push({ type: "faction_joined", data: tag }),
  );
  findNew(newMembers, oldMembers).forEach((tag) =>
    events.push({ type: "faction_left", data: tag }),
  );

  // ===== 5. 战斗变化（聚合版）=====
  const oldBattles = Array.isArray(snapshot.combat?.land_combat)
    ? snapshot.combat.land_combat
    : snapshot.combat?.land_combat
      ? [snapshot.combat.land_combat]
      : [];
  const newBattles = Array.isArray(current.combat?.land_combat)
    ? current.combat.land_combat
    : current.combat?.land_combat
      ? [current.combat.land_combat]
      : [];

  const oldBattleKeys = new Set(oldBattles.map(getCombatKey));
  const newBattleKeys = new Set(newBattles.map(getCombatKey));

  const startedBattles = newBattles
    .filter((b) => !oldBattleKeys.has(getCombatKey(b)))
    .map(summarizeBattle);

  const endedBattles = oldBattles
    .filter((b) => !newBattleKeys.has(getCombatKey(b)))
    .map(summarizeBattle);

  const startedFronts = aggregateBattles(startedBattles);
  for (const front of startedFronts) {
    if (front.sideA === viewTag || front.sideB === viewTag) {
      events.push({ type: "battles_started", data: front });
    } else {
      events.push({ type: "battles_started_other", data: front });
    }
  }

  const endedFronts = aggregateBattles(endedBattles);
  for (const front of endedFronts) {
    if (front.sideA === viewTag || front.sideB === viewTag) {
      events.push({ type: "battles_ended", data: front });
    } else {
      events.push({ type: "battles_ended_other", data: front });
    }
  }

  // ===== 6. 外交条约变化 =====
  const oldTreaties = extractTreaties(oldC.diplomacy);
  const newTreaties = extractTreaties(newC.diplomacy);

  const allTreatyTags = new Set([
    ...Object.keys(oldTreaties),
    ...Object.keys(newTreaties),
  ]);

  for (const tag of allTreatyTags) {
    const oldT = oldTreaties[tag] || {};
    const newT = newTreaties[tag] || {};

    const allFields = new Set([...Object.keys(oldT), ...Object.keys(newT)]);

    for (const field of allFields) {
      const had = !!oldT[field];
      const has = !!newT[field];

      if (!had && has) {
        events.push({
          type: "treaty_gained",
          data: { tag, treatyType: field, detail: newT[field] },
        });
      } else if (had && !has) {
        events.push({
          type: "treaty_lost",
          data: { tag, treatyType: field, detail: oldT[field] },
        });
      }
    }
  }

  // ===== 7. 战争目标变化 =====
  const oldWGs = extractWargoals(snapshot.allWargoals);
  const newWGs = extractWargoals(current.allWargoals);

  const wgKey = (wg) => `${wg.actor}→${wg.recipient}:${wg.type}`;
  const oldWGKeys = new Set(oldWGs.map(wgKey));
  const newWGKeys = new Set(newWGs.map(wgKey));

  newWGs
    .filter((wg) => !oldWGKeys.has(wgKey(wg)))
    .forEach((wg) => events.push({ type: "wargoal_added", data: wg }));

  oldWGs
    .filter((wg) => !newWGKeys.has(wgKey(wg)))
    .forEach((wg) => events.push({ type: "wargoal_removed", data: wg }));

  // ===== 8. 科技变化 =====
  const oldTechSet = new Set(extractResearch(oldC.technology).map((r) => r.tech));
  const newTechSet = new Set(extractResearch(newC.technology).map((r) => r.tech));

  [...newTechSet]
    .filter((tech) => !oldTechSet.has(tech))
    .forEach((tech) => events.push({ type: "research_completed", data: { tech } }));

  [...oldTechSet]
    .filter((tech) => !newTechSet.has(tech))
    .forEach((tech) => events.push({ type: "research_lost", data: { tech } }));

  // ===== [扩展点] =====

  return events;
}
