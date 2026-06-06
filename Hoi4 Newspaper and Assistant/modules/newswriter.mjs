import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

function escapeYml(text) {
  return String(text || "")
    .replace(/\r?\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\(?![n"'])/g, "")
    .replace(/"/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseExistingYml(filePath) {
  const entries = new Map();
  if (!existsSync(filePath)) return entries;
  try {
    const raw = readFileSync(filePath, "utf-8").replace(/^\ufeff+/, "");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s+(\S+?):0\s+"(.*?)"/);
      if (m) entries.set(m[1], m[2]);
    }
  } catch (e) {}
  return entries;
}

function writeSingleYml(filePath, newEntries, date, dateKey, lang) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const existing = parseExistingYml(filePath);

  if (date) existing.set(dateKey || "newspaper_date", escapeYml(date));
  for (const { key, value } of newEntries) {
    existing.set(key, escapeYml(value));
  }

  const ymlHeader = lang === "en" ? "l_english" : lang === "rus" ? "l_russian" : "l_simp_chinese";
  let yml = `${ymlHeader}:\n`;
  for (const [key, value] of existing) {
    yml += ` ${key}:0 "${value}"\n`;
  }

  writeFileSync(filePath, "\ufeff" + yml, "utf-8");
  console.log(`[写入] 新闻已写入: ${filePath}`);
}

export function resetNewspaperYml(styles, modBaseDir) {
  for (const style of Object.values(styles)) {
    const articleGroups = style.articleGroups || [];
    for (const lang of ["zh", "en", "rus"]) {
      const ymlFile = lang === "en" ? style.ymlFileEn : lang === "rus" ? style.ymlFileRus : style.ymlFile;
      if (!ymlFile) continue;
      const absPath = modBaseDir ? join(modBaseDir, ymlFile) : ymlFile;
      const dir = dirname(absPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const ymlHeader = lang === "en" ? "l_english" : lang === "rus" ? "l_russian" : "l_simp_chinese";
      const noTitle = lang === "en" ? "Awaiting News..." : lang === "rus" ? "Ожидание новостей..." : "等待新闻...";
      const noBody = lang === "en"
        ? `${style.nameEn || style.name} awaits the latest dispatch.`
        : lang === "rus"
        ? `${style.nameRus || style.nameEn || style.name} ожидает последних новостей.`
        : `${style.name}等待最新消息。`;
      const dateKey = style.dateKey || "newspaper_date";

      const existing = parseExistingYml(absPath);
      existing.set(dateKey, "");
      for (const group of articleGroups) {
        existing.set(group.titleKey, noTitle);
        existing.set(group.bodyKey, noBody);
      }

      let yml = `${ymlHeader}:\n`;
      for (const [key, value] of existing) {
        yml += ` ${key}:0 "${value}"\n`;
      }

      writeFileSync(absPath, "\ufeff" + yml, "utf-8");
      console.log(`[重置] 已重置: ${absPath}`);
    }
  }
}

export function writeNewsToMod(newsSlots, _unused, date) {
  const fileGroups = new Map();

  for (const news of newsSlots) {
    const baseDir = news.modBaseDir || "";
    const ymlFile = news.ymlFile || "localisation/simp_chinese/newspaper_l_simp_chinese.yml";
    const absPath = baseDir ? join(baseDir, ymlFile) : ymlFile;
    if (!fileGroups.has(absPath)) fileGroups.set(absPath, []);
    fileGroups.get(absPath).push(news);
  }

  for (const [absPath, slots] of fileGroups) {
    const entries = [];
    const dateKey = slots[0]?.dateKey;
    const lang = slots[0]?.lang || "zh";
    const noTitle = lang === "en" ? "No News This Issue" : lang === "rus" ? "Нет новостей в этом выпуске" : "本期无新闻";
    const noBody = lang === "en" ? "No content to publish." : lang === "rus" ? "Нет содержания для публикации." : "本期暂无可刊发内容。";

    for (const news of slots) {
      const titleKey = news.titleKey;
      const bodyKey = news.bodyKey;

      if (news.title && news.body) {
        entries.push({ key: titleKey, value: news.title });
        entries.push({ key: bodyKey, value: news.body });
      } else {
        entries.push({ key: titleKey, value: noTitle });
        entries.push({ key: bodyKey, value: noBody });
      }
    }

    writeSingleYml(absPath, entries, date, dateKey, lang);
  }
}
