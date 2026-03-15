
// frontend/src/components/common/Toast/Toast.tsx
import React, { useState, useEffect } from 'react';

interface ToastProps {
  message: string | null;
  duration?: number; // ms
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [message, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div style={toastStyle}>
      {message}
    </div>
  );
};

const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '50px',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  padding: '12px 20px',
  borderRadius: '25px',
  textAlign: 'center',
  fontSize: '1.1em',
  zIndex: 2000,
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  fontFamily: "'Zen Maru Gothic', sans-serif",
  animation: 'fadeInOut 3s forwards', // アニメーションはApp.cssなどのグローバルスタイルシートで定義
};

export default Toast;
