import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { PROJECT_DIR } from "../config.mjs";

const HISTORY_PATH = `${PROJECT_DIR}\\runtime\\news_history.json`;

export function loadHistory() {
  if (existsSync(HISTORY_PATH)) {
    try {
      const raw = readFileSync(HISTORY_PATH, "utf-8");
      if (raw.trim()) return JSON.parse(raw);
    } catch (e) {
      console.error("⚠️ 新闻历史文件损坏");
    }
  }
  return [];
}

export function saveHistory(history) {
  const dir = dirname(HISTORY_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
}

export function addNewsToHistory({ issue, dateFrom, dateTo, playerTag, articles }) {
  const history = loadHistory();
  history.push({
    issue,
    dateFrom,
    dateTo,
    playerTag,
    timestamp: new Date().toISOString(),
    articles,
  });
  saveHistory(history);
  return history;
}

export function getRecentNews(count = 3) {
  const history = loadHistory();
  return history.slice(-count);
}

export function clearHistory() {
  saveHistory([]);
}
