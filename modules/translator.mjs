import { describeState } from "./states.mjs";
import { TAG_OVERRIDES } from "../config.mjs";

export function translate(code, dict) {
  if (!code) return code;

  if (/^D\d+$/.test(code)) {
    return null;
  }

  if (TAG_OVERRIDES[code]) return TAG_OVERRIDES[code];

  const name = dict[code];
  if (!name) return code;
  if (name.length <= 2) return `${name}（${code}）`;
  return name;
}

function translateTag(tag, dict, opponentTag, lang) {
  const isEn = lang === "en";
  const isRus = lang === "rus";
  if (/^D\d+$/.test(tag)) {
    if (isEn) {
      if (opponentTag && !/^D\d+$/.test(opponentTag)) {
        const opponentName = translate(opponentTag, dict) || opponentTag;
        return `${opponentName} Civil War Faction`;
      }
      return `Civil War Faction (${tag})`;
    }
    if (opponentTag && !/^D\d+$/.test(opponentTag)) {
      const opponentName = translate(opponentTag, dict) || opponentTag;
      return isRus ? `Фракция гражданской войны ${opponentName}` : `${opponentName}内战势力`;
    }
    return isRus ? `Фракция гражданской войны (${tag})` : `内战势力（${tag}）`;
  }

  return translate(tag, dict) || tag;
}

function isCivilWar(tagA, tagB) {
  return /^D\d+$/.test(tagA) || /^D\d+$/.test(tagB);
}

const TREATY_NAMES = {
  "guarantee":            "保证独立",
  "non_aggression_pact":  "互不侵犯条约",
  "war_relation":         "战争状态",
  "military_access":      "军事通行权",
};

const TREATY_NAMES_EN = {
  "guarantee":            "Guarantee of Independence",
  "non_aggression_pact":  "Non-Aggression Pact",
  "war_relation":         "State of War",
  "military_access":      "Military Access",
};

const TREATY_NAMES_RUS = {
  "guarantee":            "Гарантия независимости",
  "non_aggression_pact":  "Пакт о ненападении",
  "war_relation":         "Состояние войны",
  "military_access":      "Военный доступ",
};

const WARGOAL_NAMES = {
  "annex_everything":       "全面吞并",
  "puppet_wargoal_focus":   "傀儡化",
  "take_state_focus":       "夺取领土",
  "topple_government":      "推翻政府",
  "liberate_wargoal":       "解放",
};

const WARGOAL_NAMES_EN = {
  "annex_everything":       "Full Annexation",
  "puppet_wargoal_focus":   "Puppeting",
  "take_state_focus":       "Take Territory",
  "topple_government":      "Topple Government",
  "liberate_wargoal":       "Liberation",
};

const WARGOAL_NAMES_RUS = {
  "annex_everything":       "Полное присоединение",
  "puppet_wargoal_focus":   "Установление марионеточного режима",
  "take_state_focus":       "Захват территории",
  "topple_government":      "Свержение правительства",
  "liberate_wargoal":       "Освобождение",
};

const EN_COUNTRY_NAMES = {
  GER: "Germany", ENG: "United Kingdom", SOV: "Soviet Union", FRA: "France",
  USA: "United States", JAP: "Japan", ITA: "Italy", POL: "Poland",
  CHI: "China", PRC: "People's Republic of China", MAN: "Manchukuo",
  SPR: "Spain", LIT: "Lithuania", LAT: "Latvia", EST: "Estonia",
  FIN: "Finland", SWE: "Sweden", NOR: "Norway", DEN: "Denmark",
  HOL: "Netherlands", BEL: "Belgium", SWI: "Switzerland", AUT: "Austria",
  CZE: "Czechoslovakia", HUN: "Hungary", ROM: "Romania", YUG: "Yugoslavia",
  BUL: "Bulgaria", GRE: "Greece", TUR: "Turkey", IRN: "Iran",
  IRA: "Iraq", SAF: "South Africa", CAN: "Canada", AUS: "Australia",
  NZL: "New Zealand", BRA: "Brazil", ARG: "Argentina", MEX: "Mexico",
  ETH: "Ethiopia", RAJ: "British Raj", SAU: "Saudi Arabia", AFG: "Afghanistan",
  MON: "Mongolia", TAN: "Tannu Tuva", LBY: "Libya", EGY: "Egypt",
  POR: "Portugal", IRE: "Ireland", COL: "Colombia", VEN: "Venezuela",
  PER: "Persia", SIA: "Siam", PHI: "Philippines", INS: "Dutch East Indies",
};

const RUS_COUNTRY_NAMES = {
  GER: "Германия", ENG: "Великобритания", SOV: "Советский Союз", FRA: "Франция",
  USA: "США", JAP: "Япония", ITA: "Италия", POL: "Польша",
  CHI: "Китай", PRC: "Китайская Народная Республика", MAN: "Маньчжоу-го",
  SPR: "Испания", LIT: "Литва", LAT: "Латвия", EST: "Эстония",
  FIN: "Финляндия", SWE: "Швеция", NOR: "Норвегия", DEN: "Дания",
  HOL: "Нидерланды", BEL: "Бельгия", SWI: "Швейцария", AUT: "Австрия",
  CZE: "Чехословакия", HUN: "Венгрия", ROM: "Румыния", YUG: "Югославия",
  BUL: "Болгария", GRE: "Греция", TUR: "Турция", IRN: "Иран",
  IRA: "Ирак", SAF: "ЮАР", CAN: "Канада", AUS: "Австралия",
  NZL: "Новая Зеландия", BRA: "Бразилия", ARG: "Аргентина", MEX: "Мексика",
  ETH: "Эфиопия", RAJ: "Британская Индия", SAU: "Саудовская Аравия", AFG: "Афганистан",
  MON: "Монголия", TAN: "Танну-Тува", LBY: "Ливия", EGY: "Египет",
  POR: "Португалия", IRE: "Ирландия", COL: "Колумбия", VEN: "Венесуэла",
  PER: "Персия", SIA: "Сиам", PHI: "Филиппины", INS: "Голландская Ост-Индия",
};

export function getEnCountryName(tag) {
  return EN_COUNTRY_NAMES[tag] || tag;
}

export function getRusCountryName(tag) {
  return RUS_COUNTRY_NAMES[tag] || tag;
}

export function translateEvents(events, dict, vpDict, lang, dictEn, dictRus) {
  const isEn = lang === "en";
  const isRus = lang === "rus";
  const activeDict = isEn && dictEn ? dictEn : isRus && dictRus ? dictRus : dict;

  return events.map(event => {
    switch (event.type) {

      case "focus_completed":
        return isEn
          ? `Focus completed: ${translate(event.data, activeDict) || event.data}`
          : isRus
          ? `Фокус завершён: ${translate(event.data, activeDict) || event.data}`
          : `完成国策：${translate(event.data, activeDict)}`;

      case "idea_gained":
        return isEn
          ? `National spirit gained: ${translate(event.data, activeDict) || event.data}`
          : isRus
          ? `Получен национальный дух: ${translate(event.data, activeDict) || event.data}`
          : `获得国家精神：${translate(event.data, activeDict)}`;

      case "idea_lost":
        return isEn
          ? `National spirit lost: ${translate(event.data, activeDict) || event.data}`
          : isRus
          ? `Утрачен национальный дух: ${translate(event.data, activeDict) || event.data}`
          : `失去国家精神：${translate(event.data, activeDict)}`;

      case "state_controlled_gained":
        return isEn
          ? `Forces occupied ${describeState(event.data)}`
          : isRus
          ? `Войска оккупировали ${describeState(event.data)}`
          : `军队占领了 ${describeState(event.data)}`;

      case "state_controlled_lost":
        return isEn
          ? `Lost control of ${describeState(event.data)}`
          : isRus
          ? `Утрачен контроль над ${describeState(event.data)}`
          : `失去了对 ${describeState(event.data)} 的控制`;

      case "state_owner_gained":
        return isEn
          ? `Territory incorporated: ${describeState(event.data)}`
          : isRus
          ? `Территория включена в состав: ${describeState(event.data)}`
          : `正式并入版图：${describeState(event.data)}`;

      case "state_owner_lost":
        return isEn
          ? `Territory ceded: ${describeState(event.data)}`
          : isRus
          ? `Территория уступлена: ${describeState(event.data)}`
          : `正式割让：${describeState(event.data)}`;

      case "state_controlled_third_party": {
        const eventData = event.data;
        const fromName = translateTag(eventData.from, activeDict, eventData.to, lang);
        const toName   = translateTag(eventData.to, activeDict, eventData.from, lang);

        if (isCivilWar(eventData.from, eventData.to)) {
          const normalTag = /^D\d+$/.test(eventData.from) ? eventData.to : eventData.from;
          const normalName = translate(normalTag, activeDict) || normalTag;
          if (isEn) {
            return `${normalName} Civil War: Rebels occupied ${describeState(eventData.id)}`;
          }
          if (isRus) {
            return `Гражданская война в ${normalName}: Мятежники оккупировали ${describeState(eventData.id)}`;
          }
          return `${normalName}内战：叛军占领了 ${describeState(eventData.id)}`;
        }

        return isEn
          ? `${toName} occupied ${describeState(eventData.id)} (formerly ${fromName})`
          : isRus
          ? `${toName} оккупировал(а) ${describeState(eventData.id)} (ранее ${fromName})`
          : `${toName} 占领了 ${describeState(eventData.id)}（原属 ${fromName}）`;
      }

      case "faction_joined":
        return isEn
          ? `${translate(event.data, activeDict) || event.data} joined a faction`
          : isRus
          ? `${translate(event.data, activeDict) || event.data} вступил(а) в фракцию`
          : `${translate(event.data, activeDict)} 加入阵营`;

      case "faction_left":
        return isEn
          ? `${translate(event.data, activeDict) || event.data} left a faction`
          : isRus
          ? `${translate(event.data, activeDict) || event.data} вышел(а) из фракции`
          : `${translate(event.data, activeDict)} 离开阵营`;

      case "battles_started":
      case "battles_started_other": {
        const d = event.data;

        if (isCivilWar(d.sideA, d.sideB)) {
          const normalTag = /^D\d+$/.test(d.sideA) ? d.sideB : d.sideA;
          const normalName = translate(normalTag, activeDict) || normalTag;
          return isEn
            ? `${normalName} Civil War: ${d.count} new battle(s) erupted`
            : isRus
            ? `Гражданская война в ${normalName}: началось ${d.count} новых сражений`
            : `${normalName}内战：爆发 ${d.count} 场新战斗`;
        }

        const sideAName = translateTag(d.sideA, activeDict, d.sideB, lang);
        const sideBName = translateTag(d.sideB, activeDict, d.sideA, lang);
        return isEn
          ? `${d.count} new battle(s) between ${sideAName} and ${sideBName}`
          : isRus
          ? `${d.count} новых сражений между ${sideAName} и ${sideBName}`
          : `${sideAName} 与 ${sideBName} 之间爆发 ${d.count} 场新战斗`;
      }

      case "battles_ended":
      case "battles_ended_other": {
        const d = event.data;
        const dmgA = d.damageBy[d.sideA] || 0;
        const dmgB = d.damageBy[d.sideB] || 0;
        const totalDmg = dmgA + dmgB;

        let winnerName;
        if (totalDmg === 0) {
          winnerName = null;
        } else if (dmgA > dmgB * 1.5) {
          winnerName = translateTag(d.sideA, activeDict, d.sideB, lang);
        } else if (dmgB > dmgA * 1.5) {
          winnerName = translateTag(d.sideB, activeDict, d.sideA, lang);
        } else {
          winnerName = null;
        }

        if (isCivilWar(d.sideA, d.sideB)) {
          const normalTag = /^D\d+$/.test(d.sideA) ? d.sideB : d.sideA;
          const normalName = translate(normalTag, activeDict) || normalTag;

          if (isEn) {
            const verdictPart = winnerName
              ? `, ${winnerName === normalName + " Civil War Faction" ? "rebels" : "government forces"} have the upper hand`
              : ", both sides traded blows";
            return `${normalName} Civil War: ${d.count} battle(s) concluded${verdictPart} (total casualties: ${totalDmg.toFixed(0)})`;
          }

          if (isRus) {
            const verdictPartRus = winnerName
              ? `, ${winnerName === normalName + "Фракция гражданской войны" ? "мятежники" : "правительственные войска"} имеют преимущество`
              : ", обе стороны понесли потери";
            return `Гражданская война в ${normalName}: ${d.count} сражений завершено${verdictPartRus} (общие потери: ${totalDmg.toFixed(0)})`;
          }

          const verdictPart = winnerName
            ? `，${winnerName === normalName + "内战势力" ? "叛军" : "政府军"}占优`
            : "，双方互有胜负";
          return `${normalName}内战：${d.count} 场战斗结束${verdictPart}（总伤亡：${totalDmg.toFixed(0)}）`;
        }

        const sideAName = translateTag(d.sideA, activeDict, d.sideB, lang);
        const sideBName = translateTag(d.sideB, activeDict, d.sideA, lang);

        let verdict;
        if (isEn) {
          verdict = !winnerName ? "both sides traded blows" : `${winnerName} clearly has the upper hand`;
        } else if (isRus) {
          verdict = !winnerName ? "обе стороны понесли потери" : `${winnerName} явно имеет преимущество`;
        } else {
          verdict = !winnerName ? "双方互有胜负" : `${winnerName} 明显占优`;
        }

        return isEn
          ? `${d.count} battle(s) between ${sideAName} and ${sideBName} concluded, ${verdict} (total casualties: ${totalDmg.toFixed(0)})`
          : isRus
          ? `${d.count} сражений между ${sideAName} и ${sideBName} завершено, ${verdict} (общие потери: ${totalDmg.toFixed(0)})`
          : `${sideAName} 与 ${sideBName} 之间 ${d.count} 场战斗结束，${verdict}（总伤亡：${totalDmg.toFixed(0)}）`;
      }

      case "treaty_gained": {
        const d         = event.data;
        const tagName   = translate(d.tag, activeDict) || d.tag;
        const treatyName = isEn ? (TREATY_NAMES_EN[d.treatyType] || d.treatyType) : isRus ? (TREATY_NAMES_RUS[d.treatyType] || d.treatyType) : (TREATY_NAMES[d.treatyType] || d.treatyType);

        if (d.treatyType === "war_relation") {
          const detail = d.detail;
          const instigator = detail.first_was_instigator ? detail.first : detail.second;
          const instigatorName = translate(instigator, activeDict) || instigator;
          return isEn
            ? `Now at war with ${tagName} (instigator: ${instigatorName})`
            : isRus
            ? `Война с ${tagName} (инициатор: ${instigatorName})`
            : `与 ${tagName} 进入战争状态（发起方：${instigatorName}）`;
        }

        return isEn
          ? `Established ${treatyName} with ${tagName}`
          : isRus
          ? `Заключён ${treatyName} с ${tagName}`
          : `与 ${tagName} 建立【${treatyName}】`;
      }

      case "treaty_lost": {
        const d         = event.data;
        const tagName   = translate(d.tag, activeDict) || d.tag;
        const treatyName = isEn ? (TREATY_NAMES_EN[d.treatyType] || d.treatyType) : isRus ? (TREATY_NAMES_RUS[d.treatyType] || d.treatyType) : (TREATY_NAMES[d.treatyType] || d.treatyType);

        if (d.treatyType === "war_relation") {
          return isEn
            ? `War with ${tagName} has ended`
            : isRus
            ? `Война с ${tagName} завершилась`
            : `与 ${tagName} 的战争结束`;
        }

        return isEn
          ? `${treatyName} with ${tagName} terminated`
          : isRus
          ? `${treatyName} с ${tagName} расторгнут`
          : `与 ${tagName} 的【${treatyName}】终止`;
      }

      case "wargoal_added": {
        const d          = event.data;
        const actorName  = translate(d.actor, activeDict) || d.actor;
        const targetName = translate(d.recipient, activeDict) || d.recipient || (isEn ? "Unknown Country" : isRus ? "Неизвестная страна" : "未知国家");
        const goalName   = isEn ? (WARGOAL_NAMES_EN[d.type] || d.type) : isRus ? (WARGOAL_NAMES_RUS[d.type] || d.type) : (WARGOAL_NAMES[d.type] || d.type);
        return isEn
          ? `${actorName} declared wargoal on ${targetName}: ${goalName}`
          : isRus
          ? `${actorName} объявил(а) цель войны против ${targetName}: ${goalName}`
          : `${actorName} 对 ${targetName} 提出战争目标：${goalName}`;
      }

      case "wargoal_removed": {
        const d          = event.data;
        const actorName  = translate(d.actor, activeDict) || d.actor;
        const targetName = translate(d.recipient, activeDict) || d.recipient || (isEn ? "Unknown Country" : isRus ? "Неизвестная страна" : "未知国家");
        const goalName2  = isEn ? (WARGOAL_NAMES_EN[d.type] || d.type) : isRus ? (WARGOAL_NAMES_RUS[d.type] || d.type) : (WARGOAL_NAMES[d.type] || d.type);
        return isEn
          ? `${actorName}'s wargoal on ${targetName} (${goalName2}) completed or cancelled`
          : isRus
          ? `Цель войны ${actorName} против ${targetName} (${goalName2}) выполнена или отменена`
          : `${actorName} 对 ${targetName} 的战争目标（${goalName2}）已完成或取消`;
      }

      case "research_completed": {
        const techName = translate(event.data.tech, activeDict) || event.data.tech;
        return isEn
          ? `Research completed: ${techName}`
          : isRus
          ? `Исследование завершено: ${techName}`
          : `完成研究：${techName}`;
      }

      case "research_lost": {
        const techName = translate(event.data.tech, activeDict) || event.data.tech;
        return isEn
          ? `Lost technology: ${techName}`
          : isRus
          ? `Утрачена технология: ${techName}`
          : `失去科技：${techName}`;
      }

      default:
        return isEn
          ? `Unknown event ${event.type}: ${JSON.stringify(event.data)}`
          : isRus
          ? `Неизвестное событие ${event.type}: ${JSON.stringify(event.data)}`
          : `未知事件 ${event.type}: ${JSON.stringify(event.data)}`;
    }
  });
}
