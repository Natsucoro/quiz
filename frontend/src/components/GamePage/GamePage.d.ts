import React from 'react';
interface GamePageProps {
    genre: string;
    difficulty: number;
    onBack: () => void;
    onBackToDifficulty: () => void;
    onMicStatus?: (status: {
        isRecognizing: boolean;
        isListening: boolean;
        isProcessing: boolean;
        transcript: string;
    }) => void;
}
declare const GamePage: React.FC<GamePageProps>;
export default GamePage;
