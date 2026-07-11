import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface QuestionSettingsState {
  // 出題から除外する問題IDの一覧（この端末のみに適用されるローカル設定）
  disabledQuizIds: string[];
  isDisabled: (quizId: string) => boolean;
  setDisabled: (quizId: string, disabled: boolean) => void;
  getDisabledSet: () => Set<string>;
}

export const useQuestionSettingsStore = create<QuestionSettingsState>()(
  persist(
    (set, get) => ({
      disabledQuizIds: [],

      isDisabled: (quizId) => get().disabledQuizIds.includes(quizId),

      setDisabled: (quizId, disabled) => {
        set((state) => {
          const has = state.disabledQuizIds.includes(quizId);
          if (disabled && !has) {
            return { disabledQuizIds: [...state.disabledQuizIds, quizId] };
          }
          if (!disabled && has) {
            return { disabledQuizIds: state.disabledQuizIds.filter((id) => id !== quizId) };
          }
          return state;
        });
      },

      getDisabledSet: () => new Set(get().disabledQuizIds),
    }),
    {
      name: 'quiz-app-question-settings-storage',
    }
  )
);
