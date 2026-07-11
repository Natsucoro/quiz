import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QuizHistoryRecord {
  quizId: string;
  genre: string;
  difficulty: number;
  isCorrect: boolean;
  playedAt: number; // timestamp
}

interface HistoryState {
  // quizIdをキーとした最新の回答結果のみを保持する（履歴の蓄積はしない）
  records: Record<string, QuizHistoryRecord>;

  // 最新の回答結果を記録する（同じ問題に再挑戦した場合は上書き）
  setResult: (quizId: string, genre: string, difficulty: number, isCorrect: boolean) => void;
  // 特定の問題の最新結果を取得する
  getRecord: (quizId: string) => QuizHistoryRecord | undefined;
  // 特定のジャンル・難易度の全記録を取得する
  getRecordsForLevel: (genre: string, difficulty: number) => Record<string, QuizHistoryRecord>;
  // 成績をクリアする（手動リセット時）
  clearHistory: (genre?: string, difficulty?: number) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      records: {},

      setResult: (quizId, genre, difficulty, isCorrect) => {
        set((state) => ({
          records: {
            ...state.records,
            [quizId]: { quizId, genre, difficulty, isCorrect, playedAt: Date.now() },
          },
        }));
      },

      getRecord: (quizId) => get().records[quizId],

      getRecordsForLevel: (genre, difficulty) => {
        const result: Record<string, QuizHistoryRecord> = {};
        Object.values(get().records).forEach((r) => {
          if (r.genre === genre && r.difficulty === difficulty) {
            result[r.quizId] = r;
          }
        });
        return result;
      },

      clearHistory: (genre, difficulty) => {
        set((state) => {
          if (!genre || difficulty === undefined) {
            // 全てクリア
            return { records: {} };
          }
          // 指定条件以外のものを残す
          const filtered: Record<string, QuizHistoryRecord> = {};
          Object.entries(state.records).forEach(([id, r]) => {
            if (!(r.genre === genre && r.difficulty === difficulty)) {
              filtered[id] = r;
            }
          });
          return { records: filtered };
        });
      },
    }),
    {
      name: 'quiz-app-history-storage',
    }
  )
);
