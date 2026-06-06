import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_DIR = __dirname;
export const MOD_DIR = join(PROJECT_DIR, "hoi4_newspaper");

export const SNAPSHOT_PATH  = join(PROJECT_DIR, "runtime", "last_snapshot.json");
export const SESSION_PATH   = join(PROJECT_DIR, "runtime", "session.json");
export const STATES_DICT    = join(PROJECT_DIR, "data", "states_dict.json");
export const VP_DICT        = join(PROJECT_DIR, "data", "vp_dict.json");

export const MAJOR_TAGS = [
  "GER", "ENG", "FRA", "SOV", "USA", "JAP", "ITA", "CHI"
];

export const TAG_OVERRIDES = {
  "SOV": "苏联",
};

export const SAVE_WRITE_DELAY = 3000;
export const WEB_PORT = 3000;

export function getHoi4Dir(settings) {
  return settings?.paths?.hoi4Dir || "";
}

export function getLocDir(settings) {
  const hoi4Dir = getHoi4Dir(settings);
  return hoi4Dir ? join(hoi4Dir, "localisation", "simp_chinese") : "";
}

export function getLocDirEn(settings) {
  const hoi4Dir = getHoi4Dir(settings);
  return hoi4Dir ? join(hoi4Dir, "localisation", "english") : "";
}

export function getStatesDir(settings) {
  const hoi4Dir = getHoi4Dir(settings);
  return hoi4Dir ? join(hoi4Dir, "history", "states") : "";
}

export function getSaveDir(settings) {
  return settings?.paths?.saveDir || "";
}
