import React, { useState } from 'react';
import { colors, fonts, shadow } from '../../styles/theme';

interface PromptDialogProps {
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

// window.prompt() の代替(ConfirmDialogと同じ理由による自前実装)。
const PromptDialog: React.FC<PromptDialogProps> = ({ message, placeholder, confirmLabel = '送信', cancelLabel = 'キャンセル', onConfirm, onCancel }) => {
  const [value, setValue] = useState('');

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <p style={messageStyle}>{message}</p>
        <input
          type="email"
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          style={inputStyle}
        />
        <div style={buttonRowStyle}>
          <button onClick={onCancel} style={cancelButtonStyle}>{cancelLabel}</button>
          <button onClick={() => onConfirm(value)} style={confirmButtonStyle} disabled={!value}>{confirmLabel}</button>
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
  fontSize: '1em',
  color: colors.ink,
  margin: '0 0 16px 0',
  lineHeight: '1.6',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '2px solid #ddd',
  fontSize: '1em',
  marginBottom: '20px',
  outline: 'none',
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

export default PromptDialog;
