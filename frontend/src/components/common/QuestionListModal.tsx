import React, { useMemo, useState } from 'react';
import { getQuizzesForLevel } from '../../services/quizEngine';
import { useHistoryStore } from '../../store/historyStore';
import { useQuestionSettingsStore } from '../../store/questionSettingsStore';
import { colors, fonts, shadow } from '../../styles/theme';
import MaruIcon from '../../assets/icons/icon_maru.svg';
import BatsuIcon from '../../assets/icons/icon_batsu.svg';
import ListIcon from '../../assets/icons/list.svg';

interface QuestionListModalProps {
  genre: string;
  difficulty: number;
  onClose: () => void;
}

type FilterMode = 'all' | 'unplayed' | 'played' | 'correct' | 'incorrect' | 'enabled' | 'disabled';

const FILTER_OPTIONS: { mode: FilterMode; label: string }[] = [
  { mode: 'all', label: 'すべて' },
  { mode: 'unplayed', label: '未出題' },
  { mode: 'played', label: '出題済み' },
  { mode: 'correct', label: '正解' },
  { mode: 'incorrect', label: '不正解' },
  { mode: 'enabled', label: '出題対象' },
  { mode: 'disabled', label: '出題対象外' },
];

const renderRuby = (text: string): React.ReactNode[] =>
  text.split(/(\{[^|]+\|[^}]+\})/g).map((part, i) => {
    const m = part.match(/\{([^|]+)\|([^}]+)\}/);
    return m ? <ruby key={i}>{m[1]}<rt>{m[2]}</rt></ruby> : part;
  });

const QuestionListModal: React.FC<QuestionListModalProps> = ({ genre, difficulty, onClose }) => {
  const quizzes = useMemo(() => getQuizzesForLevel(genre, difficulty), [genre, difficulty]);
  const originalIndexById = useMemo(() => {
    const map: Record<string, number> = {};
    quizzes.forEach((q, i) => { map[q.id] = i; });
    return map;
  }, [quizzes]);
  const allRecords = useHistoryStore((s) => s.records);
  const recordsForLevel = useMemo(() => {
    const result: Record<string, { quizId: string; isCorrect: boolean }> = {};
    quizzes.forEach((q) => {
      const r = allRecords[q.id];
      if (r) result[q.id] = r;
    });
    return result;
  }, [allRecords, quizzes]);
  const disabledQuizIds = useQuestionSettingsStore((s) => s.disabledQuizIds);
  const setDisabled = useQuestionSettingsStore((s) => s.setDisabled);
  const disabledSet = useMemo(
    () => new Set(disabledQuizIds.filter((id) => quizzes.some((q) => q.id === id))),
    [disabledQuizIds, quizzes]
  );

  const enabledCount = quizzes.length - disabledSet.size;
  const playedCount = quizzes.filter((q) => recordsForLevel[q.id]).length;
  const correctCount = quizzes.filter((q) => recordsForLevel[q.id]?.isCorrect).length;

  const handleToggle = (quizId: string, isCurrentlyDisabled: boolean) => {
    if (isCurrentlyDisabled) {
      setDisabled(quizId, false);
      return;
    }
    // 出題対象が最後の1問になる場合は、出題対象が0問にならないようにブロックする
    if (enabledCount <= 1) {
      alert('すべての問題を「出題しない」にはできません。少なくとも1問は出題対象にしてください。');
      return;
    }
    setDisabled(quizId, true);
  };

  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const record = recordsForLevel[q.id];
      const isDisabled = disabledSet.has(q.id);
      switch (filterMode) {
        case 'unplayed': return !record;
        case 'played': return !!record;
        case 'correct': return !!record?.isCorrect;
        case 'incorrect': return !!record && !record.isCorrect;
        case 'enabled': return !isDisabled;
        case 'disabled': return isDisabled;
        default: return true;
      }
    });
  }, [quizzes, recordsForLevel, disabledSet, filterMode]);

  const handleBulkEnable = () => {
    filteredQuizzes.forEach((q) => setDisabled(q.id, false));
  };

  const handleBulkDisable = () => {
    const filteredIds = new Set(filteredQuizzes.map((q) => q.id));
    const wouldRemainEnabled = quizzes.some((q) => !filteredIds.has(q.id) && !disabledSet.has(q.id));
    if (!wouldRemainEnabled) {
      alert('すべての問題を「出題しない」にはできません。少なくとも1問は出題対象にしてください。');
      return;
    }
    filteredQuizzes.forEach((q) => setDisabled(q.id, true));
  };

  return (
    <div style={overlayStyle}>
      <div style={modalContentStyle}>
        <button onClick={onClose} aria-label="閉じる" style={closeButtonStyle}>✖</button>
        <h2 style={modalTitleStyle}>
          <img src={ListIcon} alt="" style={{ width: '26px', height: '26px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '8px' }} />
          もんだい設定
        </h2>
        <p style={subTitleStyle}>{genre} Lv.{difficulty}</p>

        <div style={summaryBarStyle}>
          <span style={summaryItemStyle}>出題対象 <strong>{enabledCount}</strong>/{quizzes.length}問</span>
          <span style={summaryItemStyle}>出題済み <strong>{playedCount}</strong>問</span>
          <span style={summaryItemStyle}>正解 <strong>{correctCount}</strong>問</span>
        </div>
        <p style={helpTextStyle}>
          チェックを外すと、その問題はこれから出題されなくなります（この端末だけの設定です）
        </p>

        <div style={filterRowStyle}>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => setFilterMode(opt.mode)}
              style={{
                ...filterChipStyle,
                ...(filterMode === opt.mode ? filterChipActiveStyle : {}),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={bulkActionRowStyle}>
          <button
            onClick={handleBulkEnable}
            disabled={filteredQuizzes.length === 0}
            style={{ ...bulkButtonStyle, opacity: filteredQuizzes.length === 0 ? 0.5 : 1 }}
          >
            絞り込み結果を全て出題する（{filteredQuizzes.length}問）
          </button>
          <button
            onClick={handleBulkDisable}
            disabled={filteredQuizzes.length === 0}
            style={{ ...bulkButtonStyle, ...bulkButtonOffStyle, opacity: filteredQuizzes.length === 0 ? 0.5 : 1 }}
          >
            絞り込み結果を全て出題しない
          </button>
        </div>

        <div style={listContainerStyle}>
          {filteredQuizzes.length === 0 && (
            <p style={emptyStateStyle}>この条件に当てはまる問題はありません。</p>
          )}
          {filteredQuizzes.map((quiz) => {
            const record = recordsForLevel[quiz.id];
            const isDisabled = disabledSet.has(quiz.id);
            return (
              <div key={quiz.id} style={{ ...rowStyle, opacity: isDisabled ? 0.55 : 1 }}>
                <span style={rowIndexStyle}>{originalIndexById[quiz.id] + 1}</span>
                <div style={rowQuestionWrapStyle}>
                  <p style={rowQuestionStyle}>{renderRuby(quiz.questionRuby || quiz.question)}</p>
                  <div style={rowStatusStyle}>
                    {record ? (
                      <span style={playedBadgeStyle}>出題済み</span>
                    ) : (
                      <span style={notPlayedBadgeStyle}>未出題</span>
                    )}
                    {record && (
                      <img
                        src={record.isCorrect ? MaruIcon : BatsuIcon}
                        alt={record.isCorrect ? '正解' : '不正解'}
                        style={resultIconStyle}
                      />
                    )}
                  </div>
                </div>
                <label style={toggleLabelStyle}>
                  <input
                    type="checkbox"
                    checked={!isDisabled}
                    onChange={() => handleToggle(quiz.id, isDisabled)}
                    style={checkboxStyle}
                  />
                  <span style={toggleTextStyle}>出題する</span>
                </label>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={closeFooterButtonStyle}>
          閉じる
        </button>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(74, 68, 88, 0.55)',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 1100, padding: '16px', boxSizing: 'border-box',
};

const modalContentStyle: React.CSSProperties = {
  position: 'relative',
  backgroundColor: '#fff',
  padding: '25px',
  borderRadius: '20px',
  boxShadow: shadow.lg,
  maxWidth: '560px',
  width: '100%',
  textAlign: 'center',
  fontFamily: fonts.body,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute', top: '14px', right: '16px',
  background: 'none', border: 'none', fontSize: '1.3em',
  color: colors.inkSoft, cursor: 'pointer', lineHeight: 1, padding: '4px',
};

const modalTitleStyle: React.CSSProperties = {
  color: colors.primaryDark, fontFamily: fonts.heading,
  marginBottom: '4px', fontSize: '1.5em', fontWeight: 'bold',
};

const subTitleStyle: React.CSSProperties = {
  color: colors.ink, fontWeight: 'bold', margin: '0 0 14px 0', fontSize: '1.05em',
};

const summaryBarStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px',
  marginBottom: '10px',
};

const summaryItemStyle: React.CSSProperties = {
  background: colors.surfaceSoft, color: colors.ink, fontSize: '0.85em',
  borderRadius: '50px', padding: '5px 12px', boxShadow: shadow.sm,
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '0.75em', color: colors.inkSoft, marginBottom: '14px',
};

const filterRowStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginBottom: '10px',
};

const filterChipStyle: React.CSSProperties = {
  background: '#F0EDF4', color: colors.inkSoft, border: '1.5px solid #E4DEE8',
  borderRadius: '50px', padding: '5px 12px', fontSize: '0.78em', fontWeight: 'bold',
  cursor: 'pointer',
};

const filterChipActiveStyle: React.CSSProperties = {
  background: colors.primary, color: '#fff', border: `1.5px solid ${colors.primaryDark}`,
};

const bulkActionRowStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: '14px',
};

const bulkButtonStyle: React.CSSProperties = {
  background: colors.violet, color: '#fff', border: 'none', borderRadius: '50px',
  padding: '8px 14px', fontSize: '0.78em', fontWeight: 'bold', cursor: 'pointer',
  boxShadow: '0 3px 0 rgba(74,68,88,0.2)',
};

const bulkButtonOffStyle: React.CSSProperties = {
  background: '#E4DEE8', color: colors.ink,
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: '0.85em', color: colors.inkSoft, textAlign: 'center', padding: '20px 0',
};

const listContainerStyle: React.CSSProperties = {
  overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px',
  paddingRight: '2px', marginBottom: '16px', textAlign: 'left',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px',
  background: '#F7F5FA', borderRadius: '14px', padding: '10px 12px',
  border: '1.5px solid #ECE7F1',
};

const rowIndexStyle: React.CSSProperties = {
  fontSize: '0.8em', fontWeight: 'bold', color: colors.inkSoft, flexShrink: 0, width: '22px', textAlign: 'right',
};

const rowQuestionWrapStyle: React.CSSProperties = { flex: 1, minWidth: 0 };

const rowQuestionStyle: React.CSSProperties = {
  margin: '0 0 6px 0', fontSize: '0.85em', color: colors.ink, lineHeight: '1.4',
};

const rowStatusStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px' };

const playedBadgeStyle: React.CSSProperties = {
  fontSize: '0.68em', fontWeight: 'bold', color: '#fff', background: colors.violet,
  borderRadius: '50px', padding: '2px 8px',
};

const notPlayedBadgeStyle: React.CSSProperties = {
  fontSize: '0.68em', fontWeight: 'bold', color: colors.inkSoft, background: '#E4DEE8',
  borderRadius: '50px', padding: '2px 8px',
};

const resultIconStyle: React.CSSProperties = { width: '18px', height: '18px', objectFit: 'contain' };

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
  flexShrink: 0, cursor: 'pointer', width: '54px',
};

const checkboxStyle: React.CSSProperties = { width: '22px', height: '22px', accentColor: colors.primary, cursor: 'pointer' };

const toggleTextStyle: React.CSSProperties = { fontSize: '0.62em', color: colors.inkSoft, fontWeight: 'bold', whiteSpace: 'nowrap' };

const closeFooterButtonStyle: React.CSSProperties = {
  backgroundColor: '#E4DEE8', color: colors.ink, padding: '12px 24px',
  border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1em',
  fontWeight: 'bold', boxShadow: '0 4px #C7BFCF', flexShrink: 0,
};

export default QuestionListModal;
