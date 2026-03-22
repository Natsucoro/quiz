import React from 'react';
interface FloatingMicBarProps {
    isRecognizing: boolean;
    isListening: boolean;
    isProcessing: boolean;
    transcript: string;
}
declare const FloatingMicBar: React.FC<FloatingMicBarProps>;
export default FloatingMicBar;
