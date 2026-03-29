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
  playedRecords: QuizHistoryRecord[];
  
  // 履歴を追加する
  addRecord: (record: Omit<QuizHistoryRecord, 'playedAt'>) => void;
  // 特定のジャンル・難易度の出題済みID一覧を取得する
  getPlayedQuizIds: (genre: string, difficulty: number) => Set<string>;
  // 成績をクリアする（手動リセット時）
  clearHistory: (genre?: string, difficulty?: number) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      playedRecords: [],

      addRecord: (record) => {
        set((state) => ({
          playedRecords: [
            ...state.playedRecords,
            { ...record, playedAt: Date.now() },
          ],
        }));
      },

      getPlayedQuizIds: (genre, difficulty) => {
        const records = get().playedRecords.filter(
          (r) => r.genre === genre && r.difficulty === difficulty && r.isCorrect // 正解したものを「既読（出題済み）」として扱う
        );
        return new Set(records.map((r) => r.quizId));
      },

      clearHistory: (genre, difficulty) => {
        set((state) => {
          if (!genre || difficulty === undefined) {
            // 全てクリア
            return { playedRecords: [] };
          }
          // 指定条件以外のものを残す
          return {
            playedRecords: state.playedRecords.filter(
              (r) => !(r.genre === genre && r.difficulty === difficulty)
            ),
          };
        });
      },
    }),
    {
      name: 'quiz-app-history-storage',
    }
  )
);
