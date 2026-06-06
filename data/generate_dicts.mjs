// ===================================================
// generate_dicts.mjs — 一键生成静态字典
// 只需运行一次：node data/generate_dicts.mjs
// ===================================================

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getStatesDir, getLocDir, STATES_DICT, VP_DICT } from "../config.mjs";
import { loadSettings } from "../modules/settings.mjs";

const settings = loadSettings();
const STATES_DIR = getStatesDir(settings);
const LOC_DIR = getLocDir(settings);

if (!STATES_DIR) {
  console.error("[错误] HOI4目录未配置，无法生成字典。请在设置中配置HOI4目录路径。");
  process.exit(1);
}
if (!LOC_DIR) {
  console.error("[警告] 中文本地化目录不可用，将跳过中文名称解析。");
}

// ===== 第一部分：生成 states_dict.json =====
console.log("===== 生成 states_dict.json =====");

const statesDict = {};  // { "64": "勃兰登堡" }

// 收集所有州ID
const stateFiles = readdirSync(STATES_DIR).filter(f => f.endsWith(".txt"));
for (const file of stateFiles) {
  const match = file.match(/^(\d+)-/);
  if (match) statesDict[match[1]] = `STATE_${match[1]}`;  // 先用占位符
}

// 从本地化文件里找中文名
const dirs = LOC_DIR ? [LOC_DIR] : [];
for (const dir of dirs) {
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith(".yml")); }
  catch(e) { continue; }

  for (const file of files) {
    let content;
    try { content = readFileSync(join(dir, file), "utf-8"); }
    catch(e) {
      try { content = readFileSync(join(dir, file), "utf-16le"); }
      catch(e2) { continue; }
    }

    for (const line of content.split("\n")) {
      const match = line.match(/^\s+(STATE_(\d+)):\d*\s+"(.+)"/);
      if (match) {
        let value = match[3];
        value = value.replace(/\[[\w|]+\]/g, "");
        value = value.replace(/§[A-Z!]/g, "");
        value = value.replace(/\$[\w|]+\$/g, "");
        value = value.trim();
        if (value) statesDict[match[2]] = value;
      }
    }
  }
}

writeFileSync(STATES_DICT, JSON.stringify(statesDict, null, 2), "utf8");
console.log(`[OK] states_dict.json: ${Object.keys(statesDict).length} 个州`);

// ===== 第二部分：生成 vp_dict.json =====
console.log("\n===== 生成 vp_dict.json =====");

// 读取每个州文件的 victory_points
const stateVPs = {};
for (const file of stateFiles) {
  const idMatch = file.match(/^(\d+)-/);
  if (!idMatch) continue;
  const stateId = idMatch[1];

  const content = readFileSync(join(STATES_DIR, file), "utf-8");
  const vpMatches = [...content.matchAll(
    /victory_points\s*=\s*\{\s*\n\s*(\d+)\s+(\d+)/g
  )];

  if (vpMatches.length > 0) {
    stateVPs[stateId] = vpMatches.map(m => ({
      provId: m[1],
      vp: parseInt(m[2])
    }));
  }
}

// 读取省份名称
const provNames = {};
const vpLocPath = LOC_DIR ? join(LOC_DIR, "victory_points_l_simp_chinese.yml") : "";
let vpContent;
if (vpLocPath) {
  try { vpContent = readFileSync(vpLocPath, "utf-8"); }
  catch(e) {
    try { vpContent = readFileSync(vpLocPath, "utf-16le"); }
    catch(e2) { console.error("[错误] 找不到 victory_points 本地化文件"); }
  }
}

if (vpContent) {
  for (const line of vpContent.split("\n")) {
    const m1 = line.match(/^\s+VICTORY_POINTS_(\d+):\d*\s+"(.+)"/);
    const m2 = line.match(/^\s+PROV(\d+):\d*\s+"(.+)"/);
    const match = m1 || m2;
    if (match) {
      let value = match[2];
      value = value.replace(/\[[\w|]+\]/g, "");
      value = value.replace(/§[A-Z!]/g, "");
      value = value.replace(/\$[\w|]+\$/g, "");
      value = value.trim();
      if (value) provNames[match[1]] = value;
    }
  }
}

// 组合
const vpDict = {};
for (const [stateId, vps] of Object.entries(stateVPs)) {
  const mainVP = vps.reduce((a, b) => a.vp > b.vp ? a : b);
  vpDict[stateId] = {
    stateName:     statesDict[stateId] || `STATE_${stateId}`,
    capital:       provNames[mainVP.provId] || `省份${mainVP.provId}`,
    capitalProvId: mainVP.provId,
    vp:            mainVP.vp,
    otherVPs: vps
      .filter(v => v.provId !== mainVP.provId)
      .map(v => ({
        provId: v.provId,
        vp:     v.vp,
        name:   provNames[v.provId] || `省份${v.provId}`
      }))
  };
}

writeFileSync(VP_DICT, JSON.stringify(vpDict, null, 2), "utf8");
console.log(`[OK] vp_dict.json: ${Object.keys(vpDict).length} 个州`);

console.log("\n===== 全部完成 =====");
