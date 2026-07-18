
// src/services/quizEngine.ts

export interface QuizData {
  id: string;
  genre: string;
  difficulty: number;
  question: string;
  questionRuby?: string;
  hint1: string;
  hint1Ruby?: string;
  answer: string;
  answerRuby?: string;
  answerReading?: string;
  answerAliases?: string[];
  dummy1: string;
  dummy1Ruby?: string;
  dummy2: string;
  dummy2Ruby?: string;
  dummy3: string;
  dummy3Ruby?: string;
  categories?: string[];
}

export interface QuizOption {
  text: string;
  ruby?: string;
}

interface QuizWithHints extends QuizData {
  hint2: string;
  hint3: string;
}

// 全16ジャンルの問題データ(1ジャンンルあたり約500KB、合計8MB超)を毎回まとめて
// 静的importするとJSバンドルが肥大化しCore Web Vitalsが悪化するため、
// 件数だけを軽量な生成済みJSONから読み込み、問題本文は選択されたジャンルのみ
// dynamic importで遅延読み込みする(genreDataCacheでキャッシュ)。
// quizCounts.generated.jsonは npm run dev/build 時に scripts/generate-quiz-counts.mjs
// が自動生成するため、データとの乖離は起きない。
import quizCounts from '../data/quizCounts.generated.json';

type QuizCounts = Record<string, Record<string, number>>;
const counts = quizCounts as QuizCounts;

const GENRE_LOADERS: Record<string, () => Promise<{ default: QuizData[] }>> = {
  '哺乳類': () => import('../../../data/quizzes/mammals.json'),
  '昆虫': () => import('../../../data/quizzes/insects.json'),
  '植物': () => import('../../../data/quizzes/plants.json'),
  '乗り物': () => import('../../../data/quizzes/vehicles.json'),
  '魚類': () => import('../../../data/quizzes/fish.json'),
  '鳥類': () => import('../../../data/quizzes/birds.json'),
  '爬虫類': () => import('../../../data/quizzes/reptiles.json'),
  '海洋生物': () => import('../../../data/quizzes/marine.json'),
  '歴史上の人物': () => import('../../../data/quizzes/history.json'),
  '日本の地理': () => import('../../../data/quizzes/geography_jp.json'),
  '世界の地理': () => import('../../../data/quizzes/geography_world.json'),
  '道具': () => import('../../../data/quizzes/tools.json'),
  '食べ物': () => import('../../../data/quizzes/food.json'),
  'AI・ロボット': () => import('../../../data/quizzes/ai_robot.json'),
  '恐竜': () => import('../../../data/quizzes/dinosaurs.json'),
  '宇宙・天体': () => import('../../../data/quizzes/space.json'),
};

const genreDataCache = new Map<string, Promise<QuizData[]>>();

const loadGenreQuizzes = (genre: string): Promise<QuizData[]> => {
  let cached = genreDataCache.get(genre);
  if (!cached) {
    const loader = GENRE_LOADERS[genre];
    cached = loader ? loader().then((m) => m.default as QuizData[]) : Promise.resolve([]);
    genreDataCache.set(genre, cached);
  }
  return cached;
};

/**
 * 答えの文字列からヒント2（先頭1文字）とヒント3（末尾1文字）を動的に生成します。
 * @param answer クイズの答えの文字列
 * @returns { hint2: string, hint3: string } ヒント2とヒント3のオブジェクト
 */
export const generateDynamicHints = (answer: string): { hint2: string; hint3: string } => {
  if (answer.length === 0) {
    return { hint2: '', hint3: '' };
  }
  const hint2 = answer.charAt(0);
  const hint3 = answer.charAt(answer.length - 1);
  return {
    hint2: `${hint2}から始まります`,
    hint3: `${hint3}で終わります`,
  };
};

/**
 * 指定されたジャンル、難易度、および既出問題IDに基づいて、新しいクイズをランダムに取得します。
 * @param genre 選択されたジャンル
 * @param difficulty 選択された難易度
 * @param playedQuizIds 既に出題された問題のIDのセット
 * @returns QuizWithHints | null 新しいクイズデータ（ヒント2,3含む）、または利用可能な問題がない場合はnull
 */
export const getNextQuiz = async (
  genre: string,
  difficulty: number,
  playedQuizIds: Set<string>
): Promise<QuizWithHints | null> => {
  const quizzes = await loadGenreQuizzes(genre);
  const availableQuizzes = quizzes.filter(
    (quiz) =>
      quiz.difficulty === difficulty &&
      !playedQuizIds.has(quiz.id)
  );

  if (availableQuizzes.length === 0) {
    return null; // 利用可能な問題がない場合
  }

  const randomIndex = Math.floor(Math.random() * availableQuizzes.length);
  const selectedQuiz = availableQuizzes[randomIndex];

  const { hint2, hint3 } = generateDynamicHints(selectedQuiz.answer);

  return { ...selectedQuiz, hint2, hint3 };
};

/**
 * クイズの選択肢をシャッフルして返します。
 * @param quiz クイズデータ
 * @returns QuizOption[] シャッフルされた4択の選択肢（表示用ルビ付き）
 */
export const getShuffledOptions = (quiz: QuizData): QuizOption[] => {
  const options: QuizOption[] = [
    { text: quiz.answer, ruby: quiz.answerRuby },
    { text: quiz.dummy1, ruby: quiz.dummy1Ruby },
    { text: quiz.dummy2, ruby: quiz.dummy2Ruby },
    { text: quiz.dummy3, ruby: quiz.dummy3Ruby },
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]]; // Fisher-Yates shuffle
  }
  return options;
};

/**
 * ユーザーの回答が正解かどうかを判定します。
 * @param quiz クイズデータ
 * @param userAnswer ユーザーの回答
 * @returns boolean 正解であればtrue、そうでなければfalse
 */
// ひらがな→カタカナ変換
const toKatakana = (str: string): string =>
  str.replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));

// カタカナ→ひらがな変換
const toHiragana = (str: string): string =>
  str.replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 表記ゆれを正規化（カタカナに統一・空白除去・長音符正規化）
const normalize = (str: string): string =>
  toKatakana(str.trim().replace(/\s/g, '').replace(/[\u30FC\uFF70]/g, 'ー'));

export const checkAnswer = (quiz: QuizData, userAnswer: string): boolean => {
  const user = normalize(userAnswer);
  // タップ時は answer（表示テキスト）そのものが渡されるため、
  // 読み仮名(answerReading)だけでなく answer 自体・aliasesも候補に含めて判定する
  const candidates = [quiz.answer, quiz.answerReading, ...(quiz.answerAliases ?? [])].filter(
    (c): c is string => !!c
  );
  return candidates.some(candidate => {
    const c = normalize(candidate);
    return c === user || c.includes(user) || user.includes(c);
  });
};

export const getAllAvailableQuizzesCount = (genre: string, difficulty: number): number => {
  return counts[genre]?.[String(difficulty)] ?? 0;
};

// 指定したジャンル・難易度の全問題一覧を取得する（問題管理画面用）
export const getQuizzesForLevel = async (genre: string, difficulty: number): Promise<QuizData[]> => {
  const quizzes = await loadGenreQuizzes(genre);
  return quizzes.filter((quiz) => quiz.difficulty === difficulty);
};

// 全ジャンル・全レベルの問題数の合計を取得する
export const getTotalQuizzesCount = (): number => {
  return Object.values(counts).reduce(
    (sum, byDifficulty) => sum + Object.values(byDifficulty).reduce((s, c) => s + c, 0),
    0
  );
};

// 指定したジャンルの全レベル合計の問題数を取得する
export const getTotalQuizzesCountForGenre = (genre: string): number => {
  const byDifficulty = counts[genre];
  if (!byDifficulty) return 0;
  return Object.values(byDifficulty).reduce((s, c) => s + c, 0);
};

// 全ジャンル、難易度を取得する
export const getAvailableGenres = (): string[] => {
  return Object.keys(counts);
};

export const getAvailableDifficultiesForGenre = (genre: string): number[] => {
  const byDifficulty = counts[genre];
  if (!byDifficulty) return [];
  return Object.keys(byDifficulty).map(Number).sort((a, b) => a - b);
};

// 無料で遊べるレベル（子ども向けLv1-2、おとな向けLv6-7の体験用）
export const FREE_DIFFICULTIES = [1, 2, 6, 7];

// ゲスト(未購入)が無料で遊べる問題数の合計。全ジャンルの無料レベル(FREE_DIFFICULTIES)の
// 実データ件数を合算するため、問題数やレベル構成が将来変わっても自動的に追従する。
// CLAUDE.mdの「固定文言で嘘の数字を書かない」方針に従い、必ず実データから算出する。
export const getTotalFreeQuizzesCount = (): number => {
  return Object.values(counts).reduce(
    (sum, byDifficulty) =>
      sum +
      Object.entries(byDifficulty).reduce(
        (s, [difficulty, c]) => (FREE_DIFFICULTIES.includes(Number(difficulty)) ? s + c : s),
        0
      ),
    0
  );
};

// あるジャンルの「購入が必要なレベル」一覧（実データに基づくため、ジャンルの
// レベル構成が将来変わっても自動的に追従する）
export const getPaidDifficultiesForGenre = (genre: string): number[] => {
  return getAvailableDifficultiesForGenre(genre).filter((d) => !FREE_DIFFICULTIES.includes(d));
};

// ジャンルまとめ買いで解放されるitemIdの一覧
export const getGenreBundleItemIds = (genre: string): string[] => {
  return getPaidDifficultiesForGenre(genre).map((d) => `${genre}_${d}`);
};
