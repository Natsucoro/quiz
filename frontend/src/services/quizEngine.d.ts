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
/**
 * 答えの文字列からヒント2（先頭1文字）とヒント3（末尾1文字）を動的に生成します。
 * @param answer クイズの答えの文字列
 * @returns { hint2: string, hint3: string } ヒント2とヒント3のオブジェクト
 */
export declare const generateDynamicHints: (answer: string) => {
    hint2: string;
    hint3: string;
};
/**
 * 指定されたジャンル、難易度、および既出問題IDに基づいて、新しいクイズをランダムに取得します。
 * @param genre 選択されたジャンル
 * @param difficulty 選択された難易度
 * @param playedQuizIds 既に出題された問題のIDのセット
 * @returns QuizWithHints | null 新しいクイズデータ（ヒント2,3含む）、または利用可能な問題がない場合はnull
 */
export declare const getNextQuiz: (genre: string, difficulty: number, playedQuizIds: Set<string>) => QuizWithHints | null;
/**
 * クイズの選択肢をシャッフルして返します。
 * @param quiz クイズデータ
 * @returns string[] シャッフルされた4択の選択肢
 */
export declare const getShuffledOptions: (quiz: QuizData) => string[];
export declare const checkAnswer: (quiz: QuizData, userAnswer: string) => boolean;
export declare const getAllAvailableQuizzesCount: (genre: string, difficulty: number) => number;
export declare const getAvailableGenres: () => string[];
export declare const getAvailableDifficultiesForGenre: (genre: string) => number[];
export {};
