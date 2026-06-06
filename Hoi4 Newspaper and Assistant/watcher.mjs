import { readFileSync, writeFileSync, existsSync, watch } from "fs";
import { join, basename } from "path";
import * as dotenv from "dotenv";
dotenv.config();

import {
  SNAPSHOT_PATH,
  SAVE_WRITE_DELAY,
  WEB_PORT,
  MOD_DIR,
  getSaveDir,
} from "./config.mjs";


import { loadSettings } from "./modules/settings.mjs";
import { startServer, setWatcherState, addLog } from "./modules/server.mjs";
import { initParser, parseSave } from "./modules/parser.mjs";
import { loadLocalisation, loadLocalisationEn, loadLocalisationRus } from "./modules/localisation.mjs";
import { loadStates } from "./modules/states.mjs";
import { diffSaves } from "./modules/differ.mjs";
import { translateEvents, translate, getEnCountryName, getRusCountryName } from "./modules/translator.mjs";
import { generateNews, generateInternationalNews, formatDate, getInternationalStyle, getNewspaperStyle } from "./modules/llm.mjs";
import {
  checkContinuity,
  startNewSession,
  updateSession,
  loadSession,
} from "./modules/session.mjs";
import { writeNewsToMod, resetNewspaperYml } from "./modules/newswriter.mjs";
import { addNewsToHistory } from "./modules/history.mjs";

function getNewsTags() {
  const settings = loadSettings();
  return settings.console?.newsTags || ["ENG"];
}

function getNewsType() {
  const settings = loadSettings();
  return settings.console?.newsType || "both";
}

function getCustomTags() {
  const settings = loadSettings();
  return settings.console?.customTags || [];
}

function getOutputLang() {
  const settings = loadSettings();
  return settings.console?.outputLang || "zh";
}

function resetAllNewspapers() {
  const settings = loadSettings();
  const modBaseDir = getStyleModBaseDir(null);
  const allStyles = {
    ...(settings.newspaper?.styles || {}),
    ...(settings.newspaper?.internationalStyles || {}),
  };
  resetNewspaperYml(allStyles, modBaseDir);
  console.log("[重置] 所有报纸已重置为初始状态");
  addLog("[重置] 所有报纸已重置为初始状态");
}

function getMinDays() {
  const settings = loadSettings();
  return settings.console?.minDaysBetweenNews || 25;
}

function getLocalSaveDir() {
  const settings = loadSettings();
  return getSaveDir(settings);
}

function getStyleModBaseDir(style) {
  if (style?.modBaseDir) return style.modBaseDir;
  const settings = loadSettings();
  const modDir = settings.paths?.modDir || MOD_DIR;
  if (modDir) return modDir;
  return null;
}


console.log("╔══════════════════════════════════════════╗");
console.log("║      HOI4 新闻生成器 v2.1                  ║");
console.log("╚══════════════════════════════════════════╝\n");

console.log("正在加载翻译字典...");
const dict = loadLocalisation();
const dictEn = loadLocalisationEn();
const dictRus = loadLocalisationRus();

console.log("正在加载州名字典...");
const { vpDict } = loadStates();

console.log("正在初始化存档解析器...");
await initParser();

let snapshot = null;
if (existsSync(SNAPSHOT_PATH)) {
  const raw = readFileSync(SNAPSHOT_PATH, "utf-8");
  if (raw.trim()) {
    snapshot = JSON.parse(raw);
    console.log(`[OK] 找到快照，日期：${formatDate(snapshot.date, getOutputLang())}`);
  }
}

async function generateNewsForTag(snapshot, current, viewTag, dateFrom, dateTo) {
  const outputLang = getOutputLang();
  function tr(tag) {
    if (outputLang === "en") return translate(tag, dictEn) || getEnCountryName(tag) || tag;
    if (outputLang === "rus") return translate(tag, dictRus) || getRusCountryName(tag) || tag;
    return translate(tag, dict) || tag;
  }
  const countryData = current.countryData?.[viewTag];
  if (!countryData) {
    console.log(`  [警告] ${viewTag}：数据不可用`);
    addLog(`[警告] ${viewTag}：数据不可用`);
    return null;
  }

  function buildFallbackArticles(viewTag, translatedEvents, dict, dateFrom, dateTo) {
    const countryName = tr(viewTag);
    const title = outputLang === "en"
      ? `${countryName} - Briefing`
      : outputLang === "rus"
      ? `${countryName} — Краткий обзор`
      : `${countryName}本期简报`;
    const body = outputLang === "en"
      ? [
          `Between ${dateFrom} and ${dateTo}, several notable events occurred in ${countryName}.`,
          translatedEvents.slice(0, 6).join("; ") + ".",
          "Due to telegraph transmission issues, only a brief record is published this issue.",
        ].join(" ")
      : outputLang === "rus"
      ? [
          `В период с ${dateFrom} по ${dateTo} в ${countryName} произошло несколько значимых событий.`,
          translatedEvents.slice(0, 6).join("; ") + ".",
          "Из-за проблем с телеграфной связью в этом выпуске публикуется лишь краткая сводка.",
        ].join(" ")
      : [
          `${dateFrom}至${dateTo}期间，${countryName}发生若干重要事项。`,
          translatedEvents.slice(0, 6).join("；") + "。",
          "由于新闻电报传输异常，本期仅刊发简要记录。",
        ].join(" ");
    return [{ title, body }];
  }

  const events = diffSaves(snapshot, current, viewTag, vpDict);
  if (events.length === 0) {
    console.log(`  ${viewTag}：无重大事件`);
    addLog(`${viewTag}：无重大事件`);
    return null;
  }

  const translatedEvents = translateEvents(events, dict, vpDict, outputLang, dictEn, dictRus);
  console.log(`\n  [新闻] ${viewTag} 事件（${events.length}条）：`);
  addLog(`[新闻] ${viewTag} 检测到 ${events.length} 条事件：`);
  translatedEvents.forEach((e) => {
    console.log(`    - ${e}`);
    addLog(`  · ${e}`);
  });

  const playerName = tr(viewTag);

  let result = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`  [LLM] ${viewTag} 调用LLM，第${attempt}次...`);
    addLog(`[LLM] ${viewTag} 调用LLM（第${attempt}次）...`);

    result = await generateNews({
      events: translatedEvents,
      playerName,
      playerTag: viewTag,
      stability: countryData.stability,
      warSupport: countryData.war_support,
      fuelStatus: countryData.fuel_status,
      dateFrom,
      dateTo,
      lang: outputLang,
    });

    if (result && result.articles && result.articles.length > 0) {
      addLog(`[OK] ${viewTag} LLM返回成功，${result.articles.length}条文章`);
      break;
    }

    console.log(`  [警告] ${viewTag} 第${attempt}次LLM返回空内容`);
    addLog(`[警告] ${viewTag} 第${attempt}次LLM返回空内容`);
    result = null;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!result || !result.articles || result.articles.length === 0) {
    console.log(`  [警告] ${viewTag} LLM失败，使用简报fallback`);
    addLog(`[警告] ${viewTag} LLM失败，使用简报fallback`);
    return {
      articles: buildFallbackArticles(viewTag, translatedEvents, dict, dateFrom, dateTo),
      style: null,
    };
  }

  result.articles.forEach((a, i) => {
    addLog(`[OK] ${viewTag} 文章${i + 1}：${a.title}`);
  });
  return result;
}

function buildInternationalFallback(countryEvents, dateFrom, dateTo, outputLang = "zh") {
  if (outputLang === "en") {
    const title = "International Briefing";
    const bodyParts = countryEvents.map(ce =>
      `${ce.name}: ${ce.events.slice(0, 3).join("; ")}`
    );
    const body = `International developments between ${dateFrom} and ${dateTo}. ${bodyParts.join(". ")}. Due to telegraph transmission issues, only a brief record is published this issue.`;
    return { title, body };
  }
  if (outputLang === "rus") {
    const title = "Международная сводка";
    const bodyParts = countryEvents.map(ce =>
      `${ce.name}: ${ce.events.slice(0, 3).join("; ")}`
    );
    const body = `Международные события с ${dateFrom} по ${dateTo}. ${bodyParts.join(". ")}. Из-за проблем с телеграфной связью публикуется лишь краткая сводка.`;
    return { title, body };
  }
  const title = "国际简报";
  const bodyParts = countryEvents.map(ce =>
    `${ce.name}：${ce.events.slice(0, 3).join("；")}`
  );
  const body = `${dateFrom}至${dateTo}期间，国际局势动态。${bodyParts.join("。")}。由于新闻电报传输异常，本期仅刊发简要记录。`;
  return { title, body };
}

async function handleNewSave(filePath) {
  try {
    addLog(`[解析] 解析存档：${basename(filePath)}`);
    const customTags = getCustomTags();
    const outputLang = getOutputLang();
    const current = await parseSave(filePath, customTags);
    addLog(`[OK] 存档解析完毕`);

    const dateTo = formatDate(current.date, outputLang);
    const player = current.player;
    const newsTags = getNewsTags();
    const newsType = getNewsType();
    const minDays = getMinDays();
    const allMonitoredTags = [...new Set([...newsTags, ...customTags])];

    console.log(`\n日期：${dateTo} | 玩家：${player} | 类型：${newsType === "domestic" ? "国内" : newsType === "international" ? "国际" : "国内+国际"
      }`);
    addLog(`日期：${dateTo} | 玩家：${player}`);

    for (const ctag of customTags) {
      if (!current.countryData?.[ctag]) {
        console.log(`[警告] 自定义TAG ${ctag} 在存档中未找到`);
        addLog(`[警告] 自定义TAG ${ctag} 在存档中未找到`);
      }
    }

    const continuity = checkContinuity(player, current.date, minDays);

    switch (continuity.status) {
      case "first":
        console.log("[首次] 首次运行，建立基准快照");
        addLog("[首次] 首次运行，建立基准快照");
        resetAllNewspapers();
        startNewSession(player, current.date);
        writeFileSync(SNAPSHOT_PATH, JSON.stringify(current), "utf-8");
        snapshot = current;
        console.log("[提示] 下次存档时将生成第一期新闻\n");
        addLog("[提示] 下次存档时将生成第一期新闻");
        return;

      case "new_game":
        console.log(`[新游戏] 新游戏：${continuity.reason}`);
        addLog(`[新游戏] 新游戏：${continuity.reason}`);
        resetAllNewspapers();
        startNewSession(player, current.date);
        writeFileSync(SNAPSHOT_PATH, JSON.stringify(current), "utf-8");
        snapshot = current;
        console.log("[提示] 新基准已建立，下次存档时开始生成新闻\n");
        addLog("[提示] 新基准已建立");
        return;

      case "too_soon":
        console.log(`[间隔] 距上期仅${continuity.daysDiff}天（需${continuity.daysNeeded}天），跳过`);
        addLog(`[间隔] 距上期仅${continuity.daysDiff}天（需${continuity.daysNeeded}天），跳过`);
        writeFileSync(SNAPSHOT_PATH, JSON.stringify(current), "utf-8");
        snapshot = current;
        return;

      case "continue":
        console.log(`[OK] 距上期${continuity.daysDiff}天，开始生成新闻`);
        addLog(`[OK] 距上期${continuity.daysDiff}天，开始生成新闻`);
        break;
    }

    if (!snapshot) {
      console.log("[警告] 没有旧快照可对比，本次建立基准");
      addLog("[警告] 没有旧快照可对比，本次建立基准");
      resetAllNewspapers();
      writeFileSync(SNAPSHOT_PATH, JSON.stringify(current), "utf-8");
      snapshot = current;
      return;
    }

    const dateFrom = formatDate(snapshot.date, outputLang);
    const newsSlots = [];
    const historyArticles = [];

    function tr(tag) {
      if (outputLang === "en") return translate(tag, dictEn) || getEnCountryName(tag) || tag;
      if (outputLang === "rus") return translate(tag, dictRus) || getRusCountryName(tag) || tag;
      return translate(tag, dict) || tag;
    }

    // ===== 国内新闻 =====
    if (newsType === "domestic" || newsType === "both") {
      console.log(`\n${"─".repeat(50)}`);
      console.log(`[新闻] 国内新闻 — ${tr(player)}（${player}）`);
      addLog(`[新闻] 生成国内新闻：${tr(player)}`);

      const result = await generateNewsForTag(snapshot, current, player, dateFrom, dateTo);

      if (result && result.articles && result.articles.length > 0) {
        const articleGroups = result.style?.articleGroups || [];
        const ymlFile = outputLang === "en"
          ? (result.style?.ymlFileEn || result.style?.ymlFile)
          : outputLang === "rus"
          ? (result.style?.ymlFileRus || result.style?.ymlFileEn || result.style?.ymlFile)
          : (result.style?.ymlFile || "localisation/simp_chinese/newspaper_l_simp_chinese.yml");
        const modBaseDir = getStyleModBaseDir(result.style);
        const dateKey = result.style?.dateKey;

        result.articles.forEach((article, i) => {
          const group = articleGroups[i] || {
            titleKey: `domestic_${i + 1}_title`,
            bodyKey: `domestic_${i + 1}_body`,
          };

          newsSlots.push({
            tag: player,
            title: article.title,
            body: article.body,
            titleKey: group.titleKey,
            bodyKey: group.bodyKey,
            ymlFile,
            modBaseDir,
            dateKey,
            lang: outputLang,
          });

          historyArticles.push({ type: "domestic", tag: player, title: article.title, body: article.body });
          console.log(`  文章${i + 1}：${article.title}`);
        });

        addLog(`[OK] 国内新闻生成成功，${result.articles.length}条文章`);
      } else {
        const domStyle = getNewspaperStyle();
        const fallbackGroup = domStyle.articleGroups?.[0] || { titleKey: "domestic_1_title", bodyKey: "domestic_1_body" };
        const fallbackYmlFile = outputLang === "en"
          ? (domStyle.ymlFileEn || domStyle.ymlFile)
          : outputLang === "rus"
          ? (domStyle.ymlFileRus || domStyle.ymlFileEn || domStyle.ymlFile)
          : (domStyle.ymlFile || "localisation/simp_chinese/newspaper_l_simp_chinese.yml");
        newsSlots.push({
          tag: player,
          title: outputLang === "en" ? `${tr(player)} - No News This Issue` : outputLang === "rus" ? `${tr(player)} — Нет новостей` : `${tr(player)}本期无新闻`,
          body: outputLang === "en" ? "No major events to report this issue." : outputLang === "rus" ? "Нет значимых событий для публикации." : "本期暂无重大事项可刊发。",
          titleKey: fallbackGroup.titleKey,
          bodyKey: fallbackGroup.bodyKey,
          ymlFile: fallbackYmlFile,
          modBaseDir: getStyleModBaseDir(domStyle),
          dateKey: domStyle.dateKey,
          lang: outputLang,
        });
      }
    }

    // ===== 国际新闻 =====
    if (newsType === "international" || newsType === "both") {
      const intlTags = [player, ...allMonitoredTags.filter(t => t !== player)];
      console.log(`\n${"─".repeat(50)}`);
      console.log(`[国际] 国际新闻 — 监听国家：${intlTags.join(", ")}`);
      addLog(`[国际] 生成国际新闻：${intlTags.join(", ")}`);

      const countryEvents = [];
      const seenGlobalTexts = new Set();
      for (const tag of intlTags) {
        const countryData = current.countryData?.[tag];
        if (!countryData) { addLog(`[警告] ${tag}：数据不可用，跳过`); continue; }
        const events = diffSaves(snapshot, current, tag, vpDict);
        if (events.length === 0) continue;
        const translatedEvents = translateEvents(events, dict, vpDict, outputLang, dictEn, dictRus);
        const filteredEvents = translatedEvents.filter(e => {
          const isGlobalEvent = outputLang === "en"
            ? (e.includes("new battle") || e.includes("battle(s) concluded") || e.includes("wargoal") || e.includes("Civil War: Rebels occupied") || e.includes(" occupied "))
            : (e.includes("之间爆发") || e.includes("战斗结束") || e.includes("战争目标") || e.includes("提出战争目标") || e.includes("内战：叛军占领了") || e.includes("占领了"));
          if (isGlobalEvent) {
            if (seenGlobalTexts.has(e)) return false;
            seenGlobalTexts.add(e);
          }
          return true;
        });
        if (filteredEvents.length === 0) continue;
        const name = tr(tag);
        countryEvents.push({ tag, name, events: filteredEvents });
        addLog(`[事件] ${name}：${filteredEvents.length}条事件`);
        filteredEvents.forEach(e => console.log(`    - [${tag}] ${e}`));
      }

      if (countryEvents.length > 0) {
        let intlResult = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          addLog(`[LLM] 国际新闻调用LLM（第${attempt}次）...`);
          intlResult = await generateInternationalNews({ countryEvents, dateFrom, dateTo, lang: outputLang });
          if (intlResult?.articles?.length > 0) { addLog(`[OK] 国际新闻LLM返回成功`); break; }
          intlResult = null;
          await new Promise(r => setTimeout(r, 1000));
        }

        if (intlResult?.articles?.length > 0) {
          const articleGroups = intlResult.style?.articleGroups || [];
          const ymlFile = outputLang === "en"
            ? (intlResult.style?.ymlFileEn || intlResult.style?.ymlFile)
            : outputLang === "rus"
            ? (intlResult.style?.ymlFileRus || intlResult.style?.ymlFileEn || intlResult.style?.ymlFile)
            : (intlResult.style?.ymlFile || "localisation/simp_chinese/newspaper_l_simp_chinese.yml");
          const modBaseDir = getStyleModBaseDir(intlResult.style);
          const dateKey = intlResult.style?.dateKey;

          intlResult.articles.forEach((article, i) => {
            const group = articleGroups[i] || {
              titleKey: `intl_${i + 1}_title`,
              bodyKey: `intl_${i + 1}_body`,
            };

            newsSlots.push({
              tag: "WORLD",
              title: article.title,
              body: article.body,
              titleKey: group.titleKey,
              bodyKey: group.bodyKey,
              ymlFile,
              modBaseDir,
              dateKey,
              lang: outputLang,
            });

            historyArticles.push({ type: "international", tag: "WORLD", title: article.title, body: article.body });
            console.log(`  文章${i + 1}：${article.title}`);
          });

          addLog(`[OK] 国际新闻生成成功，${intlResult.articles.length}条文章`);
        } else {
          const intlStyle = getInternationalStyle();
          const fallbackGroup = intlStyle.articleGroups?.[0] || { titleKey: "intl_1_title", bodyKey: "intl_1_body" };
          const fallback = buildInternationalFallback(countryEvents, dateFrom, dateTo, outputLang);
          const fallbackYmlFile = outputLang === "en"
            ? (intlStyle.ymlFileEn || intlStyle.ymlFile)
            : outputLang === "rus"
            ? (intlStyle.ymlFileRus || intlStyle.ymlFileEn || intlStyle.ymlFile)
            : (intlStyle.ymlFile || "localisation/simp_chinese/newspaper_l_simp_chinese.yml");
          newsSlots.push({
            tag: "WORLD",
            title: fallback.title,
            body: fallback.body,
            titleKey: fallbackGroup.titleKey,
            bodyKey: fallbackGroup.bodyKey,
            ymlFile: fallbackYmlFile,
            modBaseDir: getStyleModBaseDir(intlStyle),
            dateKey: intlStyle.dateKey,
            lang: outputLang,
          });
          historyArticles.push({ type: "international", tag: "WORLD", title: fallback.title, body: fallback.body });
        }
      } else {
        addLog(`[国际] 国际新闻：所有监听国家均无重大事件`);
      }
    }


    // ===== 写入文件 =====
    if (newsSlots.length > 0) {
      writeNewsToMod(newsSlots, null, dateTo);

      const guiFiles = new Set();
      for (const slot of newsSlots) {
        const gui = slot.tag === "WORLD"
          ? loadSettings().newspaper?.internationalStyles?.[loadSettings().newspaper?.selectedInternationalStyle]?.guiFile
          : loadSettings().newspaper?.styles?.[loadSettings().newspaper?.selectedStyle]?.guiFile;
        if (gui) guiFiles.add(gui);
      }

      const commands = ["reload loc"];
      for (const gui of guiFiles) {
        commands.push(`reload ${gui.replace(/^interface\//, '')}`);
      }

      console.log(`\n[提示] 新闻已写入，请在游戏控制台输入：`);
      for (const cmd of commands) { console.log(`   ${cmd}`); }
      console.log(`   然后点击决议打开报纸`);

      setWatcherState({ reloadCommands: { commands, time: Date.now() } });
      addLog(`[写入] 新闻已写入 ${newsSlots.length} 篇`);
      addLog(`[提示] 请在游戏控制台：${commands.join(" → ")} → 点击决议`);
    }

    writeFileSync(SNAPSHOT_PATH, JSON.stringify(current), "utf-8");
    snapshot = current;
    const session = updateSession(current.date);

    if (historyArticles.length > 0) {
      addNewsToHistory({
        issue: session.newsCount,
        dateFrom,
        dateTo,
        playerTag: player,
        articles: historyArticles,
      });
      addLog(`📚 第${session.newsCount}期新闻已存入历史（${historyArticles.length}篇）`);
    }

    console.log("\n[OK] 处理完成，等待下次存档...\n");
    addLog("[OK] 处理完成，等待下次存档");
  } catch (e) {
    console.error("[错误] 处理出错：", e.message);
    console.error(e.stack);
    addLog(`[错误] 处理出错：${e.message}`);
  }
}

let isProcessing = false;
let isWatching = false;
let watcher = null;
const recentFiles = new Set();

function startWatching() {
  if (isWatching) return;
  isWatching = true;

  const newsTags = getNewsTags();
  const customTags = getCustomTags();
  const newsType = getNewsType();
  const minDays = getMinDays();
  const saveDir = getLocalSaveDir();
  const outputLang = getOutputLang();
  const allMonitoredTags = [...new Set([...newsTags, ...customTags])];

  if (!saveDir) {
    console.error("[错误] 存档目录未配置！");
    console.error("[提示] 请在 http://localhost:3000 中填写存档保存路径");
    console.error("[提示] 例如: C:\\Users\\你的用户名\\Documents\\Paradox Interactive\\Hearts of Iron IV\\save games");
    addLog("[错误] 存档目录未配置，请在 Web 控制台填写存档保存路径");
    isWatching = false;
    return;
  }

  console.log(`\n监听中：${saveDir}`);
  console.log(`新闻类型：${newsType === "domestic" ? "国内" : newsType === "international" ? "国际" : "国内+国际"}`);
  console.log(`监听国家：${["(玩家)", ...allMonitoredTags].join(", ")}`);
  console.log(`新闻间隔：≥${minDays}天`);
  console.log(`🌐 输出语言：${outputLang === "en" ? "English" : outputLang === "rus" ? "Русский" : "中文"}`);
  console.log("正常存档即可触发\n");

  addLog(`开始监听：${saveDir}`);
  addLog(`新闻类型：${newsType === "domestic" ? "国内" : newsType === "international" ? "国际" : "国内+国际"}`);
  addLog(`监听国家：${["(玩家)", ...allMonitoredTags].join(", ")}`);
  addLog(`新闻间隔：≥${minDays}天`);

  try {
    watcher = watch(saveDir, async (eventType, filename) => {
      if (!filename) return;
      if (!filename.endsWith(".hoi4")) return;
      if (filename.toLowerCase().includes("_temp")) return;
      if (isProcessing) return;
      if (recentFiles.has(filename)) return;

      recentFiles.add(filename);
      setTimeout(() => recentFiles.delete(filename), 5000);

      isProcessing = true;
      try {
        console.log(`\n[存档] 检测到存档：${filename}`);
        addLog(`[存档] 检测到存档：${filename}`);
        console.log(`等待写入完成（${SAVE_WRITE_DELAY / 1000}秒）...`);
        addLog(`[等待] 等待存档写入完成（${SAVE_WRITE_DELAY / 1000}秒）...`);
        await new Promise((r) => setTimeout(r, SAVE_WRITE_DELAY));

        await handleNewSave(join(saveDir, filename));
      } finally {
        isProcessing = false;
      }
    });

    setWatcherState({ isWatching: true });
  } catch (e) {
    console.error(`[错误] 监听失败：${e.message}`);
    if (e.code === "ENOENT") {
      console.error("[提示] 路径不存在，请检查以下设置：");
      console.error(`[提示] 当前存档路径：${saveDir || "（未填写）"}`);
      console.error("[提示] 请在 http://localhost:3000 中确认路径正确并保存");
      console.error("[提示] 常见存档路径：C:\\Users\\你的用户名\\Documents\\Paradox Interactive\\Hearts of Iron IV\\save games");
      addLog("[错误] 监听路径不存在，请在 Web 控制台检查存档路径设置");
    } else {
      addLog(`[错误] 监听失败：${e.message}`);
    }
    isWatching = false;
    setWatcherState({ isWatching: false });
  }
}

function stopWatching() {
  if (!isWatching) return;
  isWatching = false;
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  setWatcherState({ isWatching: false });
  addLog("[停止] 监听已停止");
  console.log("[停止] 监听已停止");
}

function restartWatching() {
  if (isWatching) {
    stopWatching();
    startWatching();
    addLog("[重启] 监听已重启（设置变更）");
  }
}

setWatcherState({
  isWatching: false,
  onStart: startWatching,
  onStop: stopWatching,
  onRestart: restartWatching,
});

await startServer(WEB_PORT);
startWatching();
