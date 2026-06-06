// ===================================================
// states.mjs — 州名与首府城市字典加载
// 加载预生成的 states_dict.json 和 vp_dict.json
// ===================================================

import { readFileSync } from "fs";
import { STATES_DICT, VP_DICT } from "../config.mjs";

let statesDict = null;
let vpDict = null;

/**
 * 加载州名字典和胜利点字典
 */
export function loadStates() {
  try {
    statesDict = JSON.parse(readFileSync(STATES_DICT, "utf8"));
    console.log(`[OK] 加载州名 ${Object.keys(statesDict).length} 条`);
  } catch(e) {
    console.error("[错误] 找不到 states_dict.json，请先运行 node data/generate_dicts.mjs");
    statesDict = {};
  }

  try {
    vpDict = JSON.parse(readFileSync(VP_DICT, "utf8"));
    console.log(`[OK] 加载首府 ${Object.keys(vpDict).length} 条`);
  } catch(e) {
    console.error("[错误] 找不到 vp_dict.json，请先运行 node data/generate_dicts.mjs");
    vpDict = {};
  }

  return { statesDict, vpDict };
}

/**
 * 州ID转人类可读描述
 * @param {string} id - 州ID
 * @returns {string} "勃兰登堡（首府：柏林，战略价值：50）"
 */
export function describeState(id) {
  const vp = vpDict?.[id];
  const stateName = statesDict?.[id] || `州${id}`;
  if (vp) {
    return `${stateName}（首府：${vp.capital}，战略价值：${vp.vp}）`;
  }
  return stateName;
}
