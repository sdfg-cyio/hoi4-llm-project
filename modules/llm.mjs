import fetch from "node-fetch";
import { loadSettings } from "./settings.mjs";
import { getRecentNews } from "./history.mjs";

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MONTHS_RUS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function formatDate(d, lang) {
  const date = new Date(d);
  if (lang === "en") {
    return `${MONTHS_EN[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  }
  if (lang === "rus") {
    return `${date.getUTCDate()} ${MONTHS_RUS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function formatFuel(fuelStatus, lang) {
  if (!fuelStatus) return lang === "en" ? "Fuel data unavailable" : lang === "rus" ? "Данные о топливе недоступны" : "燃油数据不可用";
  const current = Math.round(fuelStatus.fuel);
  const max = Math.round(fuelStatus.max_fuel);
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  return lang === "en"
    ? `${current}/${max} (${pct}%)`
    : lang === "rus"
    ? `${current}/${max} (${pct}%)`
    : `${current}/${max}（${pct}%）`;
}

export function getNewspaperStyle() {
  const settings = loadSettings();
  const styles = settings.newspaper?.styles || {};
  const selected = settings.newspaper?.selectedStyle || "GER";
  return styles[selected] || {
    name: "《国际通讯》", nameEn: "International News",
    tone: "国际通讯社风格，客观中立地报道各国动态", toneEn: "International news agency style, objective and neutral",
    promptTemplate: null, promptTemplateEn: null,
    articleGroups: [{ titleKey: "domestic_1_title", bodyKey: "domestic_1_body" }],
    dateKey: "newspaper_date",
  };
}

export function getInternationalStyle() {
  const settings = loadSettings();
  const intlStyles = settings.newspaper?.internationalStyles || {};
  const selectedKey = settings.newspaper?.selectedInternationalStyle || "intl_ap";
  return intlStyles[selectedKey] || {
    name: "美联社全球电讯", nameEn: "Associated Press World Wire",
    tone: "美联社国际报道风格，关注民主自由与国际秩序", toneEn: "AP international reporting style, focused on democracy and international order",
    promptTemplate: null, promptTemplateEn: null,
    articleGroups: [{ titleKey: "intl_ap_1_title", bodyKey: "intl_ap_1_body" }],
    dateKey: "intl_ap_date",
  };
}

function buildHistoryContext(playerTag, type = "domestic", lang) {
  const settings = loadSettings();
  const count = settings.llm?.historyCount ?? 3;
  if (count <= 0) return "";

  const recent = getRecentNews(count);
  if (recent.length === 0) return "";

  const header = lang === "en"
    ? "Previous issues (for reference, maintain narrative continuity):"
    : lang === "rus"
    ? "Предыдущие выпуски (для справки, сохраняйте нарративную преемственность):"
    : "以下是往期新闻（供参考，请保持叙事连贯性）：";
  const lines = [header];
  recent.forEach((entry, i) => {
    const filtered = entry.articles.filter(a => {
      const articleType = a.type || "domestic";
      if (type === "domestic") return articleType === "domestic" && a.tag === playerTag;
      if (type === "international") return articleType === "international";
      return true;
    });
    if (filtered.length > 0) {
      filtered.forEach(a => {
        const issueLabel = lang === "en" ? `Issue #${entry.issue}` : lang === "rus" ? `Выпуск №${entry.issue}` : `第${entry.issue}期`;
        lines.push(`${issueLabel}（${entry.dateFrom}~${entry.dateTo}）：${a.title} — ${a.body}`);
      });
    }
  });

  if (lines.length <= 1) return "";
  return lines.join("\n");
}

function replacePlaceholders(template, replacements) {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

function buildPrompt({ style, playerName, playerTag, stability, warSupport, fuelInfo, dateFrom, dateTo, events, lang }) {
  const historyCtx = buildHistoryContext(playerTag, "domestic", lang);
  const articleCount = style.articleGroups?.length || 1;
  const eventsText = events.map((e, i) => `${i + 1}. ${e}`).join("\n");

  const template = lang === "en" ? (style.promptTemplateEn || style.promptTemplate) : lang === "rus" ? (style.promptTemplateRus || style.promptTemplateEn || style.promptTemplate) : style.promptTemplate;
  if (template) {
    const zhPlaceholders = {
      "报纸名": style.name,
      "风格描述": style.tone,
      "起始日期": dateFrom,
      "结束日期": dateTo,
      "国家名": playerName,
      "稳定度": (stability * 100).toFixed(0),
      "战争支持度": (warSupport * 100).toFixed(0),
      "燃油信息": fuelInfo,
      "历史新闻": historyCtx,
      "事件列表": eventsText,
      "articleCount": String(articleCount),
    };
    const enPlaceholders = {
      "newspaperName": style.nameEn || style.name,
      "styleDesc": style.toneEn || style.tone,
      "dateFrom": dateFrom,
      "dateTo": dateTo,
      "countryName": playerName,
      "stability": (stability * 100).toFixed(0),
      "warSupport": (warSupport * 100).toFixed(0),
      "fuelInfo": fuelInfo,
      "historyNews": historyCtx,
      "eventList": eventsText,
      "articleCount": String(articleCount),
    };
    const rusPlaceholders = {
      "newspaperName": style.nameRus || style.nameEn || style.name,
      "styleDesc": style.toneRus || style.toneEn || style.tone,
      "dateFrom": dateFrom,
      "dateTo": dateTo,
      "countryName": playerName,
      "stability": (stability * 100).toFixed(0),
      "warSupport": (warSupport * 100).toFixed(0),
      "fuelInfo": fuelInfo,
      "historyNews": historyCtx,
      "eventList": eventsText,
      "articleCount": String(articleCount),
    };
    return replacePlaceholders(template, lang === "en" ? enPlaceholders : lang === "rus" ? rusPlaceholders : zhPlaceholders);
  }

  if (lang === "en") {
    return `You are the editor-in-chief of ${style.nameEn || style.name}, in the 1930s.
Write news reports based on the following events.

Style: ${style.toneEn || style.tone}

Period: ${dateFrom} to ${dateTo}
Country: ${playerName}
Stability: ${(stability * 100).toFixed(0)}%
War Support: ${(warSupport * 100).toFixed(0)}%
Fuel Reserves: ${fuelInfo}

${historyCtx}

Events this issue:
${eventsText}

Output ${articleCount} articles in strict JSON format:
{"articles":[{"title":"Title","body":"Body"}]}
Do not output anything outside the JSON.`.trim();
  }

  if (lang === "rus") {
    return `Вы главный редактор газеты ${style.nameRus || style.nameEn || style.name}, время — 1930-е годы.
 Напишите новостные репортажи на основе следующих событий.

 Стиль: ${style.toneRus || style.toneEn || style.tone}

 Период: с ${dateFrom} по ${dateTo}
 Страна: ${playerName}
 Стабильность: ${(stability * 100).toFixed(0)}%
 Поддержка войны: ${(warSupport * 100).toFixed(0)}%
 Запасы топлива: ${fuelInfo}

 ${historyCtx}

 События этого выпуска:
 ${eventsText}

 Выведите ${articleCount} статей в строгом формате JSON:
 {"articles":[{"title":"Заголовок","body":"Текст"}]}
 Не выводите ничего за пределами JSON.`.trim();
  }

  return `你是${style.name}的主编，时间是1930年代。
请根据以下事件写新闻报道。

风格要求：${style.tone}

时间段：${dateFrom} 至 ${dateTo}
国家：${playerName}
稳定度：${(stability * 100).toFixed(0)}%
战争支持度：${(warSupport * 100).toFixed(0)}%
燃油储备：${fuelInfo}

${historyCtx}

本期事件：
${eventsText}

请输出${articleCount}条新闻，严格以JSON格式输出：
{"articles":[{"title":"标题","body":"正文"}]}
第1条为头条，其余为简讯。不要输出JSON以外的任何内容。`.trim();
}

function buildInternationalPrompt({ style, dateFrom, dateTo, countryEvents, lang }) {
  const historyCtx = buildHistoryContext(null, "international", lang);
  const articleCount = style.articleGroups?.length || 1;

  const eventsText = countryEvents
    .filter(ce => ce.events.length > 0)
    .map(ce => {
      const prefix = lang === "en" ? `[${ce.name}]` : lang === "rus" ? `[${ce.name}]` : `【${ce.name}】`;
      return `${prefix}\n${ce.events.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;
    })
    .join("\n\n");

  const template = lang === "en" ? (style.promptTemplateEn || style.promptTemplate) : lang === "rus" ? (style.promptTemplateRus || style.promptTemplateEn || style.promptTemplate) : style.promptTemplate;
  if (template) {
    const zhPlaceholders = {
      "报纸名": style.name,
      "风格描述": style.tone,
      "起始日期": dateFrom,
      "结束日期": dateTo,
      "历史新闻": historyCtx,
      "各国事件": eventsText,
      "articleCount": String(articleCount),
    };
    const enPlaceholders = {
      "newspaperName": style.nameEn || style.name,
      "styleDesc": style.toneEn || style.tone,
      "dateFrom": dateFrom,
      "dateTo": dateTo,
      "historyNews": historyCtx,
      "countryEvents": eventsText,
      "articleCount": String(articleCount),
    };
    const rusPlaceholders = {
      "newspaperName": style.nameRus || style.nameEn || style.name,
      "styleDesc": style.toneRus || style.toneEn || style.tone,
      "dateFrom": dateFrom,
      "dateTo": dateTo,
      "historyNews": historyCtx,
      "countryEvents": eventsText,
      "articleCount": String(articleCount),
    };
    return replacePlaceholders(template, lang === "en" ? enPlaceholders : lang === "rus" ? rusPlaceholders : zhPlaceholders);
  }

  if (lang === "en") {
    return `You are the editor-in-chief of ${style.nameEn || style.name}, in the 1930s.
Write international news reports based on events from various countries.

Style: ${style.toneEn || style.tone}

Period: ${dateFrom} to ${dateTo}

${historyCtx}

International developments this issue:
${eventsText}

Output ${articleCount} articles in strict JSON format:
{"articles":[{"title":"Title","body":"Body"}]}
Do not output anything outside the JSON.`.trim();
  }

  if (lang === "rus") {
    return `Вы главный редактор агентства ${style.nameRus || style.nameEn || style.name}, время — 1930-е годы.
 Напишите международные новостные репортажи на основе событий из разных стран.

 Стиль: ${style.toneRus || style.toneEn || style.tone}

 Период: с ${dateFrom} по ${dateTo}

 ${historyCtx}

 Международные события этого выпуска:
 ${eventsText}

 Выведите ${articleCount} статей в строгом формате JSON:
 {"articles":[{"title":"Заголовок","body":"Текст"}]}
 Не выводите ничего за пределами JSON.`.trim();
  }

  return `你是${style.name}的主编，时间是1930年代。
请根据以下各国事件写国际新闻报道。

风格要求：${style.tone}

时间段：${dateFrom} 至 ${dateTo}

${historyCtx}

本期各国动态：
${eventsText}

请输出${articleCount}条新闻，严格以JSON格式输出：
{"articles":[{"title":"标题","body":"正文"}]}
第1条为头条，其余为简讯。不要输出JSON以外的任何内容。`.trim();
}

export function parseArticlesOutput(raw) {
  if (!raw) return null;

  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.articles && Array.isArray(parsed.articles)) {
      return parsed.articles.map(a => ({
        title: String(a.title || "").trim(),
        body: String(a.body || "").trim(),
      })).filter(a => a.title || a.body);
    }
  } catch (e) {
  }

  const articles = [];
  const blocks = raw.split(/\[ARTICLE\s*\d+\]/i).filter(b => b.trim());
  if (blocks.length > 0) {
    for (const block of blocks) {
      const titleMatch = block.match(/TITLE:\s*(.+)/i);
      const bodyMatch = block.match(/BODY:\s*([\s\S]+?)(?=\[ARTICLE|$)/i);
      if (titleMatch || bodyMatch) {
        articles.push({
          title: titleMatch ? titleMatch[1].trim() : "",
          body: bodyMatch ? bodyMatch[1].trim() : block.trim(),
        });
      }
    }
    if (articles.length > 0) return articles;
  }

  const titleMatch = raw.match(/TITLE:\s*(.+)/);
  const bodyMatch = raw.match(/BODY:\s*([\s\S]+)/);
  if (titleMatch && bodyMatch) {
    return [{
      title: titleMatch[1].trim(),
      body: bodyMatch[1].replace(/\*+/g, "").replace(/#+/g, "").replace(/\n/g, " ").trim(),
    }];
  }

  const lines = raw.trim().split("\n").filter(l => l.trim());
  if (lines.length >= 2) {
    return [{
      title: lines[0].replace(/^[#*\s【]+/, "").replace(/[】\s*]+$/, "").trim(),
      body: lines.slice(1).join(" ").trim(),
    }];
  }

  return null;
}

async function callLLM(prompt, settings) {
  const apiUrl = settings.llm?.apiUrl || "";
  const model = settings.llm?.model || "";
  const temperature = settings.llm?.temperature ?? 0.8;
  const maxTokens = settings.llm?.maxTokens ?? 400;
  const apiKey = settings.llm?.apiKey || "";

  if (!apiUrl || !apiKey || !model) {
    console.error("[错误] LLM 配置不完整，请在 Web 控制台填写 API 设置");
    return null;
  }

  const bodyPayload = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens: maxTokens,
  };

  const provider = settings.llm?.provider || "custom";
  if (["deepseek", "openai"].includes(provider)) {
    bodyPayload.response_format = { type: "json_object" };
  }


  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();

    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content.trim();
    } else {
      console.error("API返回异常：", JSON.stringify(data, null, 2));
      return null;
    }
  } catch (e) {
    console.error("LLM请求失败：", e.message);
    return null;
  }
}

export async function generateNews({
  events,
  playerName,
  playerTag,
  stability,
  warSupport,
  fuelStatus,
  dateFrom,
  dateTo,
  lang,
}) {
  const settings = loadSettings();
  const outputLang = lang || settings.console?.outputLang || "zh";
  const fuelInfo = formatFuel(fuelStatus, outputLang);
  const style = getNewspaperStyle();
  const prompt = buildPrompt({ style, playerName, playerTag, stability, warSupport, fuelInfo, dateFrom, dateTo, events, lang: outputLang });

  const raw = await callLLM(prompt, settings);
  if (!raw) return null;

  const articles = parseArticlesOutput(raw);
  if (!articles || articles.length === 0) {
    console.error("[错误] LLM 返回内容无法解析为文章");
    return null;
  }

  return { articles, style };
}

export async function generateInternationalNews({
  countryEvents,
  dateFrom,
  dateTo,
  lang,
}) {
  const settings = loadSettings();
  const outputLang = lang || settings.console?.outputLang || "zh";
  const style = getInternationalStyle();
  const prompt = buildInternationalPrompt({ style, dateFrom, dateTo, countryEvents, lang: outputLang });

  const raw = await callLLM(prompt, settings);
  if (!raw) return null;

  const articles = parseArticlesOutput(raw);
  if (!articles || articles.length === 0) {
    console.error("[错误] 国际新闻 LLM 返回内容无法解析为文章");
    return null;
  }

  return { articles, style };
}
