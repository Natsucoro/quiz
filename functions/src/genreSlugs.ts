// functions/src/genreSlugs.ts
// frontend/src/constants/genreSlugs.ts と同じ対応表(値は完全一致させること)。
// Cloud FunctionsはfrontendとTypeScriptプロジェクトが分かれているため複製している。

export const GENRE_SLUGS: Record<string, string> = {
  "哺乳類": "mammals",
  "昆虫": "insects",
  "植物": "plants",
  "魚類": "fish",
  "鳥類": "birds",
  "爬虫類": "reptiles",
  "海洋生物": "marine",
  "乗り物": "vehicles",
  "道具": "tools",
  "歴史上の人物": "history",
  "日本の地理": "geography_jp",
  "世界の地理": "geography_world",
  "食べ物": "food",
  "AI・ロボット": "ai_robot",
};

const SLUG_TO_GENRE: Record<string, string> = Object.fromEntries(
  Object.entries(GENRE_SLUGS).map(([genre, slug]) => [slug, genre])
);

export function getGenreFromSlug(slug: string): string | undefined {
  return SLUG_TO_GENRE[slug];
}
