import { jsx as _jsx } from "react/jsx-runtime";
// frontend/src/components/common/Toast/Toast.tsx
import { useState, useEffect } from 'react';
const Toast = ({ message, duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
        else {
            setIsVisible(false);
        }
    }, [message, duration, onClose]);
    if (!isVisible)
        return null;
    return (_jsx("div", { style: toastStyle, children: message }));
};
const toastStyle = {
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
