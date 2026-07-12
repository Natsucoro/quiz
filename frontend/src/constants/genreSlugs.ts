// src/constants/genreSlugs.ts
// Google Play Consoleの商品ID(半角英数字・ピリオド・アンダースコアのみ)には
// 日本語ジャンル名をそのまま使えないため、英語スラッグとの対応表を持つ。
// Play Billingの商品ID設計にのみ使用する(表示用の日本語ジャンル名は既存のまま)。

export const GENRE_SLUGS: Record<string, string> = {
  '哺乳類': 'mammals',
  '昆虫': 'insects',
  '植物': 'plants',
  '魚類': 'fish',
  '鳥類': 'birds',
  '爬虫類': 'reptiles',
  '海洋生物': 'marine',
  '乗り物': 'vehicles',
  '道具': 'tools',
  '歴史上の人物': 'history',
  '日本の地理': 'geography_jp',
  '世界の地理': 'geography_world',
  '食べ物': 'food',
  'AI・ロボット': 'ai_robot',
  '恐竜': 'dinosaurs',
  '宇宙・天体': 'space',
};

export const getGenreSlug = (genre: string): string => GENRE_SLUGS[genre] ?? genre;
