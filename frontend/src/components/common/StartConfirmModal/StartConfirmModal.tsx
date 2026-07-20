import React, { useState } from 'react';
import { colors, fonts, shadow } from '../../../styles/theme';
import type { QuizMode } from '../../../types/quizMode';

interface StartConfirmModalProps {
  genre: string;
  difficulty: number;
  count: number;
  onStart: (mode: QuizMode) => void;
  onCancel: () => void;
}

// クイズ開始前の確認ポップアップ。ここで遊び方(つうじょう / タイムアタック)を選んでから始める。
// 小さい子はタイマーがプレッシャーになるため、通常モードを既定にして残す。
const StartConfirmModal: React.FC<StartConfirmModalProps> = ({ genre, difficulty, count, onStart, onCancel }) => {
  const [mode, setMode] = useState<QuizMode>('normal');

  return (
    <div style={overlayStyle} role="dialog" aria-label="クイズ開始の確認">
      <div style={cardStyle}>
        <p style={titleStyle}>このないようで はじめる？</p>

        <div style={summaryStyle}>
          <span style={summaryGenreStyle}>{genre}</span>
          <span style={summaryBadgeStyle}>Lv.{difficulty}</span>
          <span style={summaryBadgeStyle}>{count}問</span>
        </div>

        <p style={modeLabelStyle}>モードをえらぶ</p>
        <div style={modeRowStyle}>
          <button
            type="button"
            onClick={() => setMode('normal')}
            style={modeCardStyle(mode === 'normal', colors.secondary)}
          >
            <span style={modeEmojiStyle}>🌱</span>
            <span style={modeNameStyle}>つうじょう</span>
            <span style={modeDescStyle}>ヒントを使って<br />じっくり遊ぶ</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('timeattack')}
            style={modeCardStyle(mode === 'timeattack', colors.tertiary)}
          >
            <span style={modeEmojiStyle}>⏱️</span>
            <span style={modeNameStyle}>タイムアタック</span>
            <span style={modeDescStyle}>クリアタイムに挑戦！<br />ヒント・降参は加算</span>
          </button>
        </div>

        <button style={startButtonStyle} onClick={() => onStart(mode)}>
          はじめる →
        </button>
        <button style={cancelButtonStyle} onClick={onCancel}>もどる</button>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(74, 68, 88, 0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 2200, padding: '20px', boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '24px',
  padding: '26px 22px',
  width: '100%',
  maxWidth: '380px',
  boxShadow: shadow.lg,
  textAlign: 'center',
  fontFamily: fonts.body,
  animation: 'screenIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 14px', color: colors.primaryDark,
  fontFamily: fonts.heading, fontWeight: 'bold', fontSize: '1.2em',
};

const summaryStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexWrap: 'wrap', gap: '8px', marginBottom: '18px',
};

const summaryGenreStyle: React.CSSProperties = {
  fontWeight: 'bold', color: colors.ink, fontSize: '1.05em',
};

const summaryBadgeStyle: React.CSSProperties = {
  background: colors.bgGradient, color: colors.primaryDark,
  borderRadius: '50px', padding: '3px 12px', fontSize: '0.85em', fontWeight: 'bold',
};

const modeLabelStyle: React.CSSProperties = {
  margin: '0 0 10px', color: colors.inkSoft, fontSize: '0.85em', fontWeight: 'bold',
};

const modeRowStyle: React.CSSProperties = {
  display: 'flex', gap: '12px', marginBottom: '20px',
};

const modeCardStyle = (selected: boolean, accent: string): React.CSSProperties => ({
  flex: 1,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  // 未選択でも「選べる項目」だとわかるよう、常にアクセント色で薄く塗り＋枠線を付ける。
  // 選択時はさらに濃く・枠を太く・浮かせて区別する。
  background: selected ? `${accent}26` : `${accent}12`,
  border: selected ? `3px solid ${accent}` : `2px solid ${accent}66`,
  borderRadius: '18px',
  padding: '14px 8px',
  cursor: 'pointer',
  boxShadow: selected ? `0 5px 16px ${accent}55` : '0 2px 6px rgba(74,68,88,0.10)',
  transform: selected ? 'translateY(-2px)' : 'none',
  transition: 'all 0.15s ease',
  fontFamily: fonts.body,
});

const modeEmojiStyle: React.CSSProperties = { fontSize: '1.6em', lineHeight: 1 };
const modeNameStyle: React.CSSProperties = { fontWeight: 'bold', color: colors.ink, fontSize: '0.95em' };
const modeDescStyle: React.CSSProperties = { color: colors.inkSoft, fontSize: '0.72em', lineHeight: 1.4 };

const startButtonStyle: React.CSSProperties = {
  display: 'block', width: '100%',
  background: colors.actionGradient, color: '#fff', border: 'none',
  borderRadius: '50px', padding: '14px', fontSize: '1.08em', fontWeight: 'bold',
  fontFamily: fonts.heading, cursor: 'pointer', boxShadow: `0 5px 0 ${colors.primaryDark}`,
};

const cancelButtonStyle: React.CSSProperties = {
  display: 'block', width: '100%',
  background: 'transparent', color: colors.inkSoft, border: 'none',
  padding: '12px 0 2px', fontSize: '0.9em', fontWeight: 'bold', cursor: 'pointer',
};

export default StartConfirmModal;
