
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
}

export interface QuizOption {
  text: string;
  ruby?: string;
}

interface QuizWithHints extends QuizData {
  hint2: string;
  hint3: string;
}

import mammalsQuizzes from '../../../data/quizzes/mammals.json';
import insectsQuizzes from '../../../data/quizzes/insects.json';
import plantsQuizzes from '../../../data/quizzes/plants.json';
import vehiclesQuizzes from '../../../data/quizzes/vehicles.json';
import toolsQuizzes from '../../../data/quizzes/tools.json';
import foodQuizzes from '../../../data/quizzes/food.json';
import fishQuizzes from '../../../data/quizzes/fish.json';
import birdsQuizzes from '../../../data/quizzes/birds.json';
import reptilesQuizzes from '../../../data/quizzes/reptiles.json';
import marineQuizzes from '../../../data/quizzes/marine.json';
import historyQuizzes from '../../../data/quizzes/history.json';
import geographyJpQuizzes from '../../../data/quizzes/geography_jp.json';
import geographyWorldQuizzes from '../../../data/quizzes/geography_world.json';

const allQuizzes: QuizData[] = [
  ...mammalsQuizzes,
  ...insectsQuizzes,
  ...plantsQuizzes,
  ...vehiclesQuizzes,
  ...fishQuizzes,
  ...birdsQuizzes,
  ...reptilesQuizzes,
  ...marineQuizzes,
  ...historyQuizzes,
  ...geographyJpQuizzes,
  ...geographyWorldQuizzes,
  ...toolsQuizzes,
  ...foodQuizzes,
];

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
export const getNextQuiz = (
  genre: string,
  difficulty: number,
  playedQuizIds: Set<string>
): QuizWithHints | null => {
  const availableQuizzes = allQuizzes.filter(
    (quiz) =>
      quiz.genre === genre &&
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
  return allQuizzes.filter(
    (quiz) => quiz.genre === genre && quiz.difficulty === difficulty
  ).length;
};

// 指定したジャンル・難易度の全問題一覧を取得する（問題管理画面用）
export const getQuizzesForLevel = (genre: string, difficulty: number): QuizData[] => {
  return allQuizzes.filter(
    (quiz) => quiz.genre === genre && quiz.difficulty === difficulty
  );
};

// 全ジャンル・全レベルの問題数の合計を取得する
export const getTotalQuizzesCount = (): number => {
  return allQuizzes.length;
};

// 指定したジャンルの全レベル合計の問題数を取得する
export const getTotalQuizzesCountForGenre = (genre: string): number => {
  return allQuizzes.filter((quiz) => quiz.genre === genre).length;
};

// 全ジャンル、難易度を取得する
export const getAvailableGenres = (): string[] => {
  const genres = new Set<string>();
  allQuizzes.forEach(quiz => genres.add(quiz.genre));
  return Array.from(genres);
};

export const getAvailableDifficultiesForGenre = (genre: string): number[] => {
  const difficulties = new Set<number>();
  allQuizzes.filter(quiz => quiz.genre === genre)
             .forEach(quiz => difficulties.add(quiz.difficulty));
  return Array.from(difficulties).sort((a, b) => a - b);
};
