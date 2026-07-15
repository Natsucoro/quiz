// クイズ結果のシェア(共有)を組み立てるサービス。
//
// 「見せたくなる結果」を広めるため、可能なら結果カード画像を生成して
// Web Share API(ネイティブ共有シート=LINE/X等)で画像付き共有する。
// 画像やネイティブ共有が使えない環境では、テキスト+URLの共有や
// X / LINE / コピー のフォールバックに切り替えられるよう、部品を公開する。

import type { QuizMode } from '../types/quizMode';
import { formatTime } from './bestTimeStore';

export const SITE_URL = 'https://watashihadare-quiz.web.app/';

const GENRE_EMOJI: Record<string, string> = {
  '哺乳類': '🦁', '昆虫': '🐝', '植物': '🌸', '魚類': '🐟', '鳥類': '🐦',
  '爬虫類': '🦎', '海洋生物': '🐳', '乗り物': '🚗', '道具': '🔧',
  '歴史上の人物': '👑', '日本の地理': '🗾', '世界の地理': '🌍', '食べ物': '🍙',
  'AI・ロボット': '🤖', '恐竜': '🦕', '宇宙・天体': '🪐',
};

export interface ShareParams {
  genre: string;
  difficulty: number;
  mode: QuizMode;
  score: number;
  questionCount: number;
  accuracy: number; // 0-100
  timeMs: number | null; // タイムアタックのみ
  isBest: boolean;
}

export const genreEmoji = (genre: string): string => GENRE_EMOJI[genre] ?? '❓';

/** 共有用のテキスト(URL・ハッシュタグ込み)を組み立てる。正解率は必ず含める。 */
export const buildShareText = (p: ShareParams): string => {
  const emoji = genreEmoji(p.genre);
  const acc = `${p.accuracy.toFixed(0)}%`;
  const lines: string[] = [`わたしはダレでしょう？クイズ集！${emoji}`];
  if (p.mode === 'timeattack' && p.timeMs !== null) {
    lines.push(`${p.genre} Lv.${p.difficulty} ⏱タイムアタック`);
    lines.push(`クリアタイム ${formatTime(p.timeMs)} / 正解率 ${acc}${p.isBest ? '（自己ベスト更新！）' : ''}`);
    lines.push('きみは何秒でクリアできるかな？');
  } else {
    lines.push(`${p.genre} Lv.${p.difficulty}`);
    lines.push(`正解率 ${acc}（${p.score}/${p.questionCount}問）に挑戦したよ！`);
    lines.push('きみもやってみてね😊');
  }
  lines.push('');
  lines.push(SITE_URL);
  lines.push('#わたしはダレでしょう #クイズ');
  return lines.join('\n');
};

export const xShareUrl = (text: string): string =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

// LINEはテキスト共有に対応していないため、URL共有(自動でOGPカードが表示される)を使う。
export const lineShareUrl = (): string =>
  `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(SITE_URL)}`;

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/**
 * 結果カード画像(正方形1080px)を生成して File を返す。生成不可なら null。
 * 正解率とタイム(タイムアタック時)を大きく見せる。
 */
export const generateResultCard = async (p: ShareParams): Promise<File | null> => {
  try {
    const S = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // フォント読み込み(失敗しても既定フォントで続行)。
    const FF = '"M PLUS Rounded 1c", sans-serif';
    try {
      await Promise.all([
        (document as any).fonts?.load(`800 120px ${FF}`),
        (document as any).fonts?.load(`700 56px ${FF}`),
      ]);
      await (document as any).fonts?.ready;
    } catch { /* 既定フォントで続行 */ }

    // 背景(クリーム系グラデーション)。
    const bg = ctx.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#FFF3EA');
    bg.addColorStop(0.55, '#FFE9F0');
    bg.addColorStop(1, '#FDE8D8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    // 白いパネル。
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 70, 70, S - 140, S - 140, 56);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // タイトル。
    ctx.fillStyle = '#E2527A';
    ctx.font = `700 46px ${FF}`;
    ctx.fillText('わたしはダレでしょう？クイズ集！', S / 2, 175);

    // 絵文字 + ジャンル・レベル。
    ctx.font = `800 120px ${FF}`;
    ctx.fillText(genreEmoji(p.genre), S / 2, 320);
    ctx.fillStyle = '#4A4458';
    ctx.font = `800 64px ${FF}`;
    ctx.fillText(`${p.genre} Lv.${p.difficulty}`, S / 2, 440);

    // モードラベル。
    const modeLabel = p.mode === 'timeattack' ? '⏱ タイムアタック' : 'クイズ';
    ctx.font = `700 40px ${FF}`;
    ctx.fillStyle = '#8B8598';
    ctx.fillText(modeLabel, S / 2, 512);

    // 主役: タイム(TA) または 正解率。
    if (p.mode === 'timeattack' && p.timeMs !== null) {
      ctx.fillStyle = '#E89A38';
      ctx.font = `700 44px ${FF}`;
      ctx.fillText('クリアタイム', S / 2, 600);
      ctx.fillStyle = '#E2527A';
      ctx.font = `800 150px ${FF}`;
      ctx.fillText(formatTime(p.timeMs), S / 2, 710);
      // 正解率(サブ)。
      ctx.fillStyle = '#4A4458';
      ctx.font = `700 60px ${FF}`;
      ctx.fillText(`正解率 ${p.accuracy.toFixed(0)}%`, S / 2, 838);
      if (p.isBest) {
        ctx.fillStyle = '#2CA792';
        ctx.font = `700 46px ${FF}`;
        ctx.fillText('🎉 自己ベスト更新！', S / 2, 910);
      }
    } else {
      // メダル + 正解率を主役に。
      const medal = p.accuracy >= 90 ? '🥇' : p.accuracy >= 60 ? '🥈' : '🥉';
      ctx.font = `800 140px ${FF}`;
      ctx.fillText(medal, S / 2, 620);
      ctx.fillStyle = '#E2527A';
      ctx.font = `800 130px ${FF}`;
      ctx.fillText(`正解率 ${p.accuracy.toFixed(0)}%`, S / 2, 790);
      ctx.fillStyle = '#4A4458';
      ctx.font = `700 56px ${FF}`;
      ctx.fillText(`${p.score} / ${p.questionCount}問 正解`, S / 2, 895);
    }

    // フッター URL。
    ctx.fillStyle = '#8B8598';
    ctx.font = `700 40px ${FF}`;
    ctx.fillText('watashihadare-quiz.web.app', S / 2, 980);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return new File([blob], 'quiz-result.png', { type: 'image/png' });
  } catch {
    return null;
  }
};

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

/**
 * ネイティブ共有(Web Share API)を試みる。可能なら画像カード付きで共有する。
 * - shared: 共有シートで完了 / cancelled: ユーザーが閉じた
 * - unsupported: navigator.share非対応(UI側でX/LINE/コピーにフォールバック)
 */
export const nativeShare = async (p: ShareParams): Promise<ShareOutcome> => {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share !== 'function') return 'unsupported';

  const text = buildShareText(p);
  const file = await generateResultCard(p);

  // 画像ファイル共有が可能なら画像付きで。
  if (file && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // 画像共有に失敗したらテキスト共有へフォールバック。
    }
  }

  try {
    await nav.share({ text, url: SITE_URL });
    return 'shared';
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
};

/** クリップボードへコピー(結果テキスト+URL)。 */
export const copyShareText = async (p: ShareParams): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(buildShareText(p));
    return true;
  } catch {
    return false;
  }
};
