import React, { useState, useCallback, useEffect } from 'react';
import TopPage from './components/TopPage/TopPage';
import GamePage from './components/GamePage/GamePage';
import FloatingMicBar from './components/common/FloatingMicBar/FloatingMicBar';
import { useSettingsStore } from './store/settingsStore';
import { speechRecognitionService } from './services/speechRecognition';
// import { usePurchaseStore } from './store/purchaseStore'; // 後ほど活用

const App: React.FC = () => {
  const { isHandsFree: isHandsFreeMode } = useSettingsStore();
  
  const [currentPage, setCurrentPage] = useState<'top' | 'game'>('top');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(1);
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [topInitialView, setTopInitialView] = useState<'genre' | 'difficulty'>('genre');
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

  const handleMicStatus = useCallback((status: { isRecognizing: boolean; isListening: boolean; isProcessing: boolean; transcript: string }) => {
    setMicStatus(status);
  }, []);

  const handleStart = (genre: string, difficulty: number, count: number) => {
    setSelectedGenre(genre);
    setSelectedDifficulty(difficulty);
    setSelectedCount(count);
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

  return (

    <div style={{ fontFamily: "'Yomogi', cursive", minHeight: '100vh' }}>
      {currentPage === 'top' ? (
        <TopPage onStart={handleStart} initialView={topInitialView} />
      ) : (
        <GamePage genre={selectedGenre} difficulty={selectedDifficulty} questionCount={selectedCount} onBack={handleBack} onBackToDifficulty={handleBackToDifficulty} onMicStatus={handleMicStatus} />
      )}
      {isHandsFreeMode && (
        <FloatingMicBar
          isRecognizing={micStatus.isRecognizing}
          isListening={micStatus.isListening}
          isProcessing={micStatus.isProcessing}
          transcript={micStatus.transcript}
        />
      )}
    </div>
  );
};

export default App;
