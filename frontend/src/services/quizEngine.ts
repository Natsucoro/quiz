
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
  answerReading?: string;
  answerAliases?: string[];
  dummy1: string;
  dummy2: string;
  dummy3: string;
}

interface QuizWithHints extends QuizData {
  hint2: string;
  hint3: string;
}

import mammalsQuizzes from '../../../data/quizzes/mammals.json';
import insectsQuizzes from '../../../data/quizzes/insects.json';

const allQuizzes: QuizData[] = [
  ...mammalsQuizzes,
  ...insectsQuizzes,
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
 * @returns string[] シャッフルされた4択の選択肢
 */
export const getShuffledOptions = (quiz: QuizData): string[] => {
  const options = [quiz.answer, quiz.dummy1, quiz.dummy2, quiz.dummy3];
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
  const correct = normalize(quiz.answerReading ?? quiz.answer);
  if (correct === user || correct.includes(user) || user.includes(correct)) return true;
  // answerAliasesとも比較
  return (quiz.answerAliases ?? []).some(alias => {
    const a = normalize(alias);
    return a === user || a.includes(user) || user.includes(a);
  });
};

export const getAllAvailableQuizzesCount = (genre: string, difficulty: number): number => {
  return allQuizzes.filter(
    (quiz) => quiz.genre === genre && quiz.difficulty === difficulty
  ).length;
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
