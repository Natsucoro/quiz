
// frontend/src/components/common/Toast/Toast.tsx
import React, { useState, useEffect } from 'react';
import { colors, fonts, shadow } from '../../../styles/theme';

interface ToastProps {
  message: string | null;
  duration?: number; // ms（表示している時間。フェードアウトの時間は含まない）
  onClose: () => void;
}

const FADE_DURATION = 400; // ms

const Toast: React.FC<ToastProps> = ({ message, duration = 3000, onClose }) => {
  // renderedMessage: フェードアウト中も表示し続けるための保持用
  const [renderedMessage, setRenderedMessage] = useState<string | null>(null);
  const [isShown, setIsShown] = useState(false);

  // 新しいメッセージが来たら、ふわっと表示 → duration後にふわっと非表示
  useEffect(() => {
    if (!message) return;
    setRenderedMessage(message);
    const showTimer = requestAnimationFrame(() => setIsShown(true));
    const hideTimer = setTimeout(() => setIsShown(false), duration);
    return () => {
      cancelAnimationFrame(showTimer);
      clearTimeout(hideTimer);
    };
  }, [message, duration]);

  // フェードアウトのアニメーションが終わってからDOMを消してonCloseを呼ぶ
  useEffect(() => {
    if (isShown || !renderedMessage) return;
    const timer = setTimeout(() => {
      setRenderedMessage(null);
      onClose();
    }, FADE_DURATION);
    return () => clearTimeout(timer);
  }, [isShown, renderedMessage, onClose]);

  if (!renderedMessage) return null;

  return (
    <div
      style={{
        ...toastStyle,
        opacity: isShown ? 1 : 0,
        transform: isShown ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.9)',
      }}
    >
      {renderedMessage}
    </div>
  );
};

const toastStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  background: colors.actionGradient,
  color: '#fff',
  border: '3px solid #fff',
  padding: '18px 30px',
  borderRadius: '24px',
  textAlign: 'center',
  fontSize: '1.1em',
  fontWeight: 'bold',
  lineHeight: 1.5,
  zIndex: 3000,
  maxWidth: '85vw',
  boxShadow: `${shadow.lg}, 0 0 0 2px rgba(255,111,145,0.25)`,
  fontFamily: fonts.body,
  pointerEvents: 'none', // 下の要素の操作を邪魔しない
  transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`,
};

export default Toast;
