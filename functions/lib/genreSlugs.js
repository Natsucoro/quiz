"use strict";
// functions/src/genreSlugs.ts
// frontend/src/constants/genreSlugs.ts と同じ対応表(値は完全一致させること)。
// Cloud FunctionsはfrontendとTypeScriptプロジェクトが分かれているため複製している。
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENRE_SLUGS = void 0;
exports.getGenreFromSlug = getGenreFromSlug;
exports.GENRE_SLUGS = {
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
};
const SLUG_TO_GENRE = Object.fromEntries(Object.entries(exports.GENRE_SLUGS).map(([genre, slug]) => [slug, genre]));
function getGenreFromSlug(slug) {
    return SLUG_TO_GENRE[slug];
}
//# sourceMappingURL=genreSlugs.js.map