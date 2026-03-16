import React, { useState, useEffect } from 'react';
import TopPage from './components/TopPage/TopPage';
import GamePage from './components/GamePage/GamePage';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'top' | 'game'>('top');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(1);
  const [topInitialView, setTopInitialView] = useState<'genre' | 'difficulty'>('genre');

  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
    return () => {
      document.head.removeChild(fontLink);
    };
  }, []);

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
    <div style={{ fontFamily: '"Mochiy Pop One", sans-serif', minHeight: '100vh' }}>
      {currentPage === 'top' ? (
        <TopPage onStart={handleStart} initialView={topInitialView} />
      ) : (
        <GamePage genre={selectedGenre} difficulty={selectedDifficulty} onBack={handleBack} onBackToDifficulty={handleBackToDifficulty} />
      )}
    </div>
  );
};

export default App;
