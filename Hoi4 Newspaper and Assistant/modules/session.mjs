// ===================================================
// session.mjs — 会话管理
// 判断存档连续性、自动检测新游戏、管理快照
// ===================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { SESSION_PATH, SNAPSHOT_PATH } from "../config.mjs";

/**
 * 会话数据结构：
 * {
 *   playerTag: "GER",
 *   lastDateStr: "1937-03-15T...",
 *   lastDateDays: 730,
 *   newsCount: 3
 * }
 */

// ===== 日期工具 =====

/**
 * 把存档里的Date对象转成游戏天数（用于比较）
 */
export function dateToDays(dateInput) {
  const d = new Date(dateInput);
  const year  = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day   = d.getUTCDate();
  return year * 365 + month * 30 + day;
}

/**
 * 从Date对象提取年月日字符串
 */
export function formatDateShort(dateInput) {
  const d = new Date(dateInput);
  return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
}

// ===== 会话读写 =====

export function loadSession() {
  if (existsSync(SESSION_PATH)) {
    return JSON.parse(readFileSync(SESSION_PATH, "utf-8"));
  }
  return null;
}

function saveSessionData(session) {
  writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), "utf-8");
}

// ===== 连续性判定 =====

/**
 * 判断新存档与当前会话的关系
 * @param {string} playerTag - 新存档的玩家国家
 * @param {string|Date} date - 新存档的日期
 * @param {number} minDays - 两期新闻之间最少游戏天数
 * @returns {{ status: string, reason?: string, daysDiff?: number }}
 *   status: "first" | "new_game" | "too_soon" | "continue"
 */
export function checkContinuity(playerTag, date, minDays) {
  const session = loadSession();
  const newDays = dateToDays(date);

  // 第一次运行
  if (!session) {
    return { status: "first" };
  }

  // 国家不同 → 新的一局
  if (playerTag !== session.playerTag) {
    return {
      status: "new_game",
      reason: `国家变更: ${session.playerTag} → ${playerTag}`
    };
  }

  // 日期倒退 → 新的一局（或者读了旧档）
  if (newDays <= session.lastDateDays) {
    return {
      status: "new_game",
      reason: `日期倒退: ${session.lastDateStr} → ${formatDateShort(date)}`
    };
  }

  // 日期差距
  const daysDiff = newDays - session.lastDateDays;

  // 距离上次新闻太近
  if (daysDiff < minDays) {
    return { status: "too_soon", daysDiff, daysNeeded: minDays };
  }

  // 正常继续
  return { status: "continue", daysDiff };
}

// ===== 会话操作 =====

/**
 * 开始新会话（清空旧快照）
 */
export function startNewSession(playerTag, date) {
  // 删除旧快照
  if (existsSync(SNAPSHOT_PATH)) {
    writeFileSync(SNAPSHOT_PATH, "", "utf-8");
  }

  const session = {
    playerTag,
    lastDateStr: formatDateShort(date),
    lastDateDays: dateToDays(date),
    newsCount: 0,
  };

  saveSessionData(session);
  console.log(`[新会话] 新会话: ${playerTag}, ${session.lastDateStr}`);
  return session;
}

/**
 * 更新会话（生成新闻后调用）
 */
export function updateSession(date) {
  const session = loadSession();
  if (!session) return;

  session.lastDateStr  = formatDateShort(date);
  session.lastDateDays = dateToDays(date);
  session.newsCount   += 1;

  saveSessionData(session);
  console.log(`[新闻] 第${session.newsCount}期, 日期推进到 ${session.lastDateStr}`);
  return session;
}
