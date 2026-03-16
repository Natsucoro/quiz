import React, { useState } from 'react';
import TopPage from './components/TopPage/TopPage';
import GamePage from './components/GamePage/GamePage';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'top' | 'game'>('top');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(1);
  const [topInitialView, setTopInitialView] = useState<'genre' | 'difficulty'>('genre');

  const handleStart = (genre: string, difficulty: number) => {
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

  return (
    <div style={{ fontFamily: "'Yomogi', cursive", minHeight: '100vh' }}>
      {currentPage === 'top' ? (
        <TopPage onStart={handleStart} initialView={topInitialView} />
      ) : (
        <GamePage genre={selectedGenre} difficulty={selectedDifficulty} onBack={handleBack} onBackToDifficulty={handleBackToDifficulty} />
      )}
    </div>
  );
};

export default App;
