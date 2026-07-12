import React from 'react';
import { colors, fonts, shadow } from '../../styles/theme';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// window.confirm() の代替。
// サンドボックス化された(allow-modalsを持たない)埋め込み環境では
// window.confirm/alert/promptは無反応になり(何も表示されず即falseを
// 返す)、ボタンが反応しないように見える不具合の原因になるため、
// アプリ内で完結する確認ダイアログとして自前実装する。
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, confirmLabel = 'はい', cancelLabel = 'キャンセル', onConfirm, onCancel }) => {
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <p style={messageStyle}>{message}</p>
        <div style={buttonRowStyle}>
          <button onClick={onConfirm} style={confirmButtonStyle}>{confirmLabel}</button>
          <button onClick={onCancel} style={cancelButtonStyle}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(74, 68, 88, 0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 2200,
  padding: '20px',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '24px',
  padding: '28px 24px',
  width: '100%',
  maxWidth: '360px',
  boxShadow: shadow.lg,
  textAlign: 'center',
  fontFamily: fonts.body,
};

const messageStyle: React.CSSProperties = {
  fontSize: '1.05em',
  color: colors.ink,
  margin: '0 0 24px 0',
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
};

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  background: '#E4DEE8',
  color: colors.ink,
  padding: '12px',
  border: 'none',
  borderRadius: '50px',
  fontSize: '1em',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 4px #C7BFCF',
};

const confirmButtonStyle: React.CSSProperties = {
  flex: 1,
  background: colors.actionGradient,
  color: '#fff',
  padding: '12px',
  border: 'none',
  borderRadius: '50px',
  fontSize: '1em',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: `0 4px ${colors.primaryDark}`,
};

export default ConfirmDialog;
