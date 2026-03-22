import React from 'react';
interface ToastProps {
    message: string | null;
    duration?: number;
    onClose: () => void;
}
declare const Toast: React.FC<ToastProps>;
export default Toast;
