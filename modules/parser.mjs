// ===================================================
// parser.mjs — 存档解析器
// 使用Jomini精准提取存档中的关键字段
// 支持同时提取多个国家的完整数据
// ===================================================
import { Jomini } from "jomini";
import { readFileSync } from "fs";
import { MAJOR_TAGS } from "../config.mjs";

let parser = null;

export async function initParser() {
  if (!parser) {
    parser = await Jomini.initialize();
  }
  return parser;
}

// ===== 主解析函数 =====
export async function parseSave(filePath, extraTags = []) {
  if (!parser) await initParser();

  const buffer = readFileSync(filePath);

  // 检测存档格式
  const header = buffer.slice(0, 8).toString("utf-8");
  if (header.startsWith("HOI4bin")) {
    throw new Error(
      "存档为二进制格式，jomini 无法解析。\n" +
      "请在 HOI4 设置中关闭「Save as Binary」（保存为二进制），然后重新保存游戏。"
    );
  }
  if (!header.startsWith("HOI4txt")) {
    console.log(`[警告] 存档头部异常: ${header.slice(0, 20).replace(/\0/g, "\\0")}`);
  }

  const data = parser.parseText(
    buffer,
    { encoding: "windows1252" },
    (query) => {
      const player = query.at("/player");
      const date   = query.at("/date");

      const states  = query.at("/states");
      const faction = query.at("/faction");
      const combat  = query.at("/combat");

      const fullTags = new Set([player, ...MAJOR_TAGS, ...extraTags]);

      const countryData = {};
      for (const tag of fullTags) {
        countryData[tag] = {
          stability:    query.at(`/countries/${tag}/stability`),
          war_support:  query.at(`/countries/${tag}/war_support`),
          focus:        query.at(`/countries/${tag}/focus`),
          politics:     query.at(`/countries/${tag}/politics`),
          diplomacy:    query.at(`/countries/${tag}/diplomacy`),
          production:   query.at(`/countries/${tag}/production`),
          technology:   query.at(`/countries/${tag}/technology`),
          fuel_status:  query.at(`/countries/${tag}/fuel_status`),
        };
      }

      const allWargoals = {};
      const wgTags = new Set([...fullTags, ...MAJOR_TAGS]);
      for (const tag of wgTags) {
        const wg = query.at(`/countries/${tag}/diplomacy/wargoals`);
        if (wg) allWargoals[tag] = wg;
      }

      return {
        player,
        date,
        states,
        faction,
        combat,
        countryData,
        allWargoals,
      };
    }
  );

  return data;
}
