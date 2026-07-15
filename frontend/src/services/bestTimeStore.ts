// タイムアタックの自己ベストタイムを端末内(localStorage)に保存・取得するヘルパー。
//
// 「自分自身の争い(自己ベスト更新)」はログイン不要・無料で成立させたいので、
// バックエンド(Firestore)ではなく端末ローカルに保持する。全国ランキングのような
// 「全員での争い」は不正対策・名前の検閲・コストが絡むため、まずは実装しない
// (競争感はシェア=「42秒!君は何秒?」が担う想定)。将来ランキングを足す場合は
// ここを差し替え/拡張ポイントにする。

const KEY_PREFIX = 'quizBestTime:';

const bestKey = (genre: string, difficulty: number, count: number): string =>
  `${KEY_PREFIX}${genre}_${difficulty}_${count}`;

/** 保存済みの自己ベストタイム(ミリ秒)。未記録なら null。 */
export const getBestTimeMs = (genre: string, difficulty: number, count: number): number | null => {
  try {
    const raw = localStorage.getItem(bestKey(genre, difficulty, count));
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

/**
 * 今回のタイムを自己ベストとして保存する(より速い場合のみ更新)。
 * @returns updated=ベスト更新したか / best=更新後(または既存)のベストタイム(ms)
 */
export const saveBestTimeMs = (
  genre: string,
  difficulty: number,
  count: number,
  timeMs: number,
): { updated: boolean; best: number } => {
  const prev = getBestTimeMs(genre, difficulty, count);
  if (prev !== null && prev <= timeMs) {
    return { updated: false, best: prev };
  }
  try {
    localStorage.setItem(bestKey(genre, difficulty, count), String(Math.round(timeMs)));
  } catch {
    // 保存に失敗しても遊べること優先(プライベートブラウジング等)。
  }
  return { updated: true, best: Math.round(timeMs) };
};

/** ミリ秒を「M:SS.d」または「S.d秒」の見やすい表記にする。 */
export const formatTime = (ms: number): string => {
  const totalSec = ms / 1000;
  if (totalSec < 60) {
    return `${totalSec.toFixed(1)}秒`;
  }
  const min = Math.floor(totalSec / 60);
  const sec = totalSec - min * 60;
  return `${min}分${sec.toFixed(1)}秒`;
};
