import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import TopPage from './components/TopPage/TopPage';
import GamePage from './components/GamePage/GamePage';
import FloatingMicBar from './components/common/FloatingMicBar/FloatingMicBar';
import { useSettingsStore } from './store/settingsStore';
import { speechRecognitionService } from './services/speechRecognition';
const App = () => {
    const { isHandsFree: isHandsFreeMode } = useSettingsStore();
    const [currentPage, setCurrentPage] = useState('top');
    const [selectedGenre, setSelectedGenre] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState(1);
    const [topInitialView, setTopInitialView] = useState('genre');
    const [micStatus, setMicStatus] = useState({ isRecognizing: false, isListening: false, isProcessing: false, transcript: '' });
    useEffect(() => {
        speechRecognitionService.onRecognizingChange((recognizing) => {
            setMicStatus(prev => ({ ...prev, isRecognizing: recognizing }));
        });
    }, []);
    useEffect(() => {
        if (currentPage === 'top') {
            speechRecognitionService.onResult((transcript, isFinal) => {
                setMicStatus(prev => ({
                    ...prev,
                    isListening: !isFinal,
                    transcript: isFinal ? '' : transcript,
                }));
            });
        }
    }, [currentPage]);
    useEffect(() => {
        if (isHandsFreeMode && currentPage === 'top') {
            speechRecognitionService.start();
        }
    }, [isHandsFreeMode, currentPage]);
    const handleMicStatus = useCallback((status) => {
        setMicStatus(status);
    }, []);
    const handleStart = (genre, difficulty) => {
        setSelectedGenre(genre);
        setSelectedDifficulty(difficulty);
        setCurrentPage('game');
    };
    const handleBack = () => {
        setTopInitialView('genre');
        setCurrentPage('top');
    };
    const handleBackToDifficulty = () => {
        setTopInitialView('difficulty');
        setCurrentPage('top');
    };
    return (_jsxs("div", { style: { fontFamily: "'Yomogi', cursive", minHeight: '100vh' }, children: [currentPage === 'top' ? (_jsx(TopPage, { onStart: handleStart, initialView: topInitialView })) : (_jsx(GamePage, { genre: selectedGenre, difficulty: selectedDifficulty, onBack: handleBack, onBackToDifficulty: handleBackToDifficulty, onMicStatus: handleMicStatus })), isHandsFreeMode && (_jsx(FloatingMicBar, { isRecognizing: micStatus.isRecognizing, isListening: micStatus.isListening, isProcessing: micStatus.isProcessing, transcript: micStatus.transcript }))] }));
};
export default App;
