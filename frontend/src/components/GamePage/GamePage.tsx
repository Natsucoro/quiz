// src/components/GamePage/GamePage.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Settings from '../common/Settings/Settings';
import {
  QuizData,
  getNextQuiz,
  getShuffledOptions,
  checkAnswer,
} from '../../services/quizEngine';
import { speak, stopSpeaking } from '../../services/speechSynthesis';
import { useHandsFree } from '../../hooks/useHandsFree';
import { useSettingsStore } from '../../store/settingsStore';
import { usePurchaseStore } from '../../store/purchaseStore';

const playCorrectSound = () => {
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    osc.connect(gain);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.3);
  });
};

const playIncorrectSound = () => {
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  [300, 250].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
    osc.connect(gain);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.2);
  });
};

interface GamePageProps {
  genre: string;
  difficulty: number;
  onBack: () => void;
  onBackToDifficulty: () => void;
}

const TOTAL_QUIZZES = 10;

const GamePage: React.FC<GamePageProps> = ({ genre: selectedGenre, difficulty: selectedDifficulty, onBack, onBackToDifficulty }) => {
  const { isMuted, setIsMuted, isHandsFree: isHandsFreeMode, setIsHandsFree: setIsHandsFreeMode } = useSettingsStore();
  const isSpeakingAllowed = true;

  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'surrender' | null>(null);
  const [showHint, setShowHint] = useState<number | null>(null);
  const [isQuizEnded, setIsQuizEnded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [conciergeMessage, setConciergeMessage] = useState<string | null>(null);

  const quizSequenceRef = useRef<number>(0);
  // 循環依存を避けるためにhandlerをrefで保持
  const handleShowHintRef = useRef<(n: number) => void>(() => {});
  const handleSurrenderRef = useRef<() => void>(() => {});
  const handleAnswerRef = useRef<(ans: string) => void>(() => {});
  const handleNextQuestionRef = useRef<() => void>(() => {});
  const readQuestionRef = useRef<() => void>(() => {});

  const playSound = useCallback((type: 'correct' | 'incorrect') => {
    if (isMuted) return;
    if (type === 'correct') playCorrectSound();
    else playIncorrectSound();
  }, [isMuted]);

  const playedIdsThisSession = useRef<Set<string>>(new Set());
  const hasAnsweredIncorrectlyRef = useRef(false);
  const isHandsFreeModeRef = useRef(isHandsFreeMode);
  const isMutedRef = useRef(isMuted);
  useEffect(() => { isHandsFreeModeRef.current = isHandsFreeMode; }, [isHandsFreeMode]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);

  const loadNextQuiz = useCallback((questionIndex: number) => {
    const nextQuiz = getNextQuiz(selectedGenre, selectedDifficulty, playedIdsThisSession.current);
    if (nextQuiz) {
      setCurrentQuiz(nextQuiz);
      setOptions(getShuffledOptions(nextQuiz));
      setShowHint(null);
      setFeedback(null);
      hasAnsweredIncorrectlyRef.current = false;
      playedIdsThisSession.current = new Set([...playedIdsThisSession.current, nextQuiz.id]);
      if (isHandsFreeModeRef.current && !isMutedRef.current && isSpeakingAllowed) {
        speak(`第${questionIndex + 1}問。${nextQuiz.question}`);
        setConciergeMessage(null);
      }
    } else if (initializedRef.current) {
      // 問題が尽きたら静かに終了画面へ
      setIsQuizEnded(true);
    }
  }, [selectedGenre, selectedDifficulty, isSpeakingAllowed]);

  const initializedRef = useRef(false);

  // 初期化
  useEffect(() => {
    initializedRef.current = false;
    playedIdsThisSession.current = new Set();
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsQuizEnded(false);
    loadNextQuiz(0);
    initializedRef.current = true;
  }, [selectedGenre, selectedDifficulty, loadNextQuiz]);

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex(prev => {
      const next = prev + 1;
      if (next >= TOTAL_QUIZZES) {
        setIsQuizEnded(true);
        if (isHandsFreeModeRef.current && !isMutedRef.current && isSpeakingAllowed) {
          setScore(s => { speak(`クイズ終了です。あなたのスコアは${s}点でした。`); return s; });
        }
      } else {
        quizSequenceRef.current = 0;
        setFeedback(null);
        setShowHint(null);
        setConciergeMessage(null);
        loadNextQuiz(next);
      }
      return next;
    });
  }, [isSpeakingAllowed, loadNextQuiz]);

  handleNextQuestionRef.current = handleNextQuestion;

  // 正解・降参後に自動で次の問題へ
  useEffect(() => {
    if (feedback === 'correct' || feedback === 'surrender') {
      const seq = quizSequenceRef.current;
      const timer = setTimeout(() => {
        if (quizSequenceRef.current === seq) {
          handleNextQuestionRef.current();
        }
      }, isHandsFreeMode ? 1500 : 1000);
      return () => clearTimeout(timer);
    }
  }, [feedback, isHandsFreeMode]);

  const handleAnswer = useCallback((userAnswer: string) => {
    if (!currentQuiz || feedback === 'correct' || feedback === 'surrender') return;
    quizSequenceRef.current++;
    const correct = checkAnswer(currentQuiz, userAnswer);
    if (correct) {
      playSound('correct');
      if (!hasAnsweredIncorrectlyRef.current) setScore(prev => prev + 1);
      hasAnsweredIncorrectlyRef.current = false;
      setFeedback('correct');
      if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
        speak(`ピンポン！正解は${currentQuiz.answer}です。次の問題です。`);
        setConciergeMessage(null);
      }
    } else {
      hasAnsweredIncorrectlyRef.current = true;
      playSound('incorrect');
      setFeedback('incorrect');
      if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
        speak('ブブー！違います。もう一度考えてみましょう。');
        setConciergeMessage(null);
      }
    }
  }, [currentQuiz, feedback, isHandsFreeMode, isMuted, isSpeakingAllowed, playSound]);

  handleAnswerRef.current = handleAnswer;

  const handleSurrender = useCallback(() => {
    if (!currentQuiz || feedback === 'correct' || feedback === 'surrender') return;
    quizSequenceRef.current++;
    playSound('correct');
    setFeedback('surrender');
    if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
      speak(`答えは${currentQuiz.answer}です。次の問題です。`);
      setConciergeMessage(null);
    }
  }, [currentQuiz, feedback, isHandsFreeMode, isMuted, isSpeakingAllowed, playSound]);

  handleSurrenderRef.current = handleSurrender;

  const handleShowHint = useCallback((hintNumber: number) => {
    if (!currentQuiz) return;
    let hintText = '';
    if (hintNumber === 1) {
      hintText = currentQuiz.hint1;
    } else if (hintNumber === 2) {
      if (!isHandsFreeMode) return;
      hintText = (currentQuiz as any).hint2 ?? '';
    } else if (hintNumber === 3) {
      if (!isHandsFreeMode) return;
      hintText = (currentQuiz as any).hint3 ?? '';
    } else return;
    setShowHint(hintNumber);
    if (!isMuted && isSpeakingAllowed) {
      speak(`ヒント${hintNumber}：${hintText}`);
      setConciergeMessage(null);
    }
  }, [currentQuiz, isHandsFreeMode, isMuted, isSpeakingAllowed]);

  handleShowHintRef.current = handleShowHint;

  const { isRecognizing, readQuestion, resetSilenceTimer } = useHandsFree({
    // useHandsFreeの呼び出し後にreadQuestionRefを更新（下のuseEffect内で参照）
    isHandsFreeMode,
    onVoiceCommand: useCallback((command: string, transcript?: string) => {
      setConciergeMessage(null);
      if (command === 'hint1') handleShowHintRef.current(1);
      else if (command === 'hint2') handleShowHintRef.current(2);
      else if (command === 'hint3') handleShowHintRef.current(3);
      else if (command === 'surrender') handleSurrenderRef.current();
      else if (command === 'repeatQuestion') readQuestionRef.current();
      else if (command === 'answerAttempt' && transcript) handleAnswerRef.current(transcript);
    }, []),  // refを使うので依存なし
    onSilenceDetected: useCallback((seconds: number) => {
      if (isMuted) return;
      if (seconds === 7) { setConciergeMessage('ヒント1と言ってみてね'); speak('ヒント1と言ってみてね'); }
      else if (seconds === 12) { setConciergeMessage('ヒント2と言ってみてね'); speak('ヒント2と言ってみてね'); }
      else if (seconds === 17) { setConciergeMessage('ヒント3と言ってみてね'); speak('ヒント3と言ってみてね'); }
      else if (seconds === 25) { setConciergeMessage('降参の場合は、降参と言ってね'); speak('降参の場合は、降参と言ってね'); }
    }, [isMuted]),
    currentQuestion: currentQuiz?.question,
    isSpeakingAllowed,
  });

  // useHandsFree呼び出し後にrefを更新
  readQuestionRef.current = readQuestion;

  const handleToggleMute = useCallback(() => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (newState) {
      stopSpeaking();
    } else if (isHandsFreeMode && currentQuiz) {
      speak(`${currentQuiz.question}`);
    }
  }, [isMuted, setIsMuted, isHandsFreeMode, currentQuiz]);

  const handleGoHomeConfirm = () => {
    if (window.confirm('クイズを中断しますか？スコアはリセットされます。')) {
      stopSpeaking();
      onBack();
    }
  };

  const getGenreIcon = (genreName: string) => {
    switch (genreName) {
      case '動物': return '🐾';
      case '昆虫': return '🐛';
      case '植物': return '🌿';
      case '乗り物': return '🚗';
      case '道具': return '🔨';
      case '歴史上の人物': return '🗿';
      case '日本の地理': return '🗾';
      case '世界の地理': return '🌍';
      default: return '❓';
    }
  };

  if (!currentQuiz && !isQuizEnded) {
    return <div style={loadingStyle}>問題を読み込み中...</div>;
  }

  if (isQuizEnded) {
    const accuracy = (score / TOTAL_QUIZZES) * 100;
    return (
      <div style={containerStyle}>
        <div style={headerIconsStyle}>
          <button onClick={() => setShowSettings(true)} style={iconButtonStyle}>⚙️</button>
          <button onClick={handleToggleMute} style={iconButtonStyle}>{isMuted ? '🔇' : '🔊'}</button>
          <button onClick={() => setIsHandsFreeMode(!isHandsFreeMode)} style={{ ...iconButtonStyle, opacity: isHandsFreeMode ? 1 : 0.4 }}>🤲</button>
          <button onClick={handleGoHomeConfirm} style={iconButtonStyle}>🏠</button>
        </div>
        <h1 style={titleStyle}>🎉 結果発表 🎉</h1>
        <div style={resultBoxStyle}>
          <p style={resultTextStyle}>正解数: <span style={{ color: '#FF69B4', fontSize: '1.2em' }}>{score}</span> / {TOTAL_QUIZZES}問</p>
          <p style={resultTextStyle}>正解率: <span style={{ color: '#FF69B4', fontSize: '1.2em' }}>{accuracy.toFixed(1)}</span>%</p>

          <div style={resultActionButtonsStyle}>
            <button onClick={() => { playedIdsThisSession.current = new Set(); setCurrentQuestionIndex(0); setScore(0); setIsQuizEnded(false); loadNextQuiz(0); }} style={buttonStyle}>もう一度</button>
            <button onClick={onBackToDifficulty} style={buttonStyle}>別のレベルへ</button>
            <button onClick={onBack} style={buttonStyle}>別のジャンルへ</button>
            <button onClick={onBack} style={buttonStyle}>TOPに戻る</button>
          </div>
        </div>
        {showSettings && (
          <Settings onClose={() => setShowSettings(false)} onLoginStatusChange={() => {}} currentView="RESULT" />
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerIconsStyle}>
        <button onClick={() => setShowSettings(true)} style={iconButtonStyle}>⚙️</button>
        <button onClick={handleToggleMute} style={iconButtonStyle}>{isMuted ? '🔇' : '🔊'}</button>
        <button onClick={() => setIsHandsFreeMode(!isHandsFreeMode)} style={{ ...iconButtonStyle, opacity: isHandsFreeMode ? 1 : 0.4 }}>🤲</button>
        <button onClick={handleGoHomeConfirm} style={iconButtonStyle}>🏠</button>
      </div>

      <div style={genreInfoStyle}>
        <span style={genreIconStyle}>{getGenreIcon(selectedGenre)}</span>
        <h2 style={genreNameStyle}>{selectedGenre}</h2>
      </div>

      <p style={questionCountStyle}>{currentQuestionIndex + 1}/{TOTAL_QUIZZES}問</p>
      <p style={scoreStyle}>スコア: {score}</p>

      <div style={questionBoxStyle}>
        <p style={questionTextStyle}>{currentQuiz?.question}</p>
        {showHint === 1 && currentQuiz && (
          <p style={hintTextStyle}>ヒント1: {currentQuiz.hint1}</p>
        )}
        {showHint === 2 && currentQuiz && (
          <p style={hintTextStyle}>ヒント2: {(currentQuiz as any).hint2}</p>
        )}
        {showHint === 3 && currentQuiz && (
          <p style={hintTextStyle}>ヒント3: {(currentQuiz as any).hint3}</p>
        )}
        {(feedback === 'correct' || feedback === 'surrender') && currentQuiz && (
          <p style={answerInBoxStyle}>答え「{currentQuiz.answer}」</p>
        )}
      </div>

      {isHandsFreeMode ? (
        <div style={handsFreeGuideStyle}>
          {conciergeMessage && <p style={conciergeMessageStyle}>🗣️ {conciergeMessage}</p>}
          <p style={voiceCommandStyle}>「〇〇」と言ってみてね</p>
          <p style={voiceCommandExampleStyle}>
            （例：「問題」「ヒント1」「ヒント2」「ヒント3」「降参」）
            {isRecognizing
              ? <span style={{ marginLeft: '10px', color: '#4CAF50' }}>音声認識中...</span>
              : <span style={{ marginLeft: '10px', color: '#f44336' }}>音声認識オフ</span>}
          </p>
        </div>
      ) : (
        <div style={optionsContainerStyle}>
          {options.map((option, index) => {
            const isCorrectOption = option === currentQuiz?.answer;
            const isRevealed = feedback === 'correct' || feedback === 'surrender';
            const bg = isRevealed && isCorrectOption ? '#4CAF50' : '#87CEEB';
            return (
              <button
                key={index}
                onClick={() => handleAnswer(option)}
                disabled={isRevealed}
                style={{
                  ...optionButtonStyle,
                  backgroundColor: bg,
                  cursor: isRevealed ? 'not-allowed' : 'pointer',
                } as React.CSSProperties}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      <div style={actionButtonsContainerStyle}>
        <button onClick={() => handleShowHint(1)} style={{ ...actionButtonStyle, backgroundColor: showHint === 1 ? '#FFD700' : '#FF69B4' } as React.CSSProperties}>
          ヒント1
        </button>
        {isHandsFreeMode && (
          <>
            <button onClick={() => handleShowHint(2)} style={{ ...actionButtonStyle, backgroundColor: showHint === 2 ? '#FFD700' : '#FF69B4' } as React.CSSProperties}>
              ヒント2
            </button>
            <button onClick={() => handleShowHint(3)} style={{ ...actionButtonStyle, backgroundColor: showHint === 3 ? '#FFD700' : '#FF69B4' } as React.CSSProperties}>
              ヒント3
            </button>
          </>
        )}
        <button onClick={handleSurrender} style={surrenderButtonStyle}>降参</button>
      </div>


      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} onLoginStatusChange={() => {}} currentView="GAME" />
      )}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  fontFamily: "'Mochiy Pop One', cursive",
  backgroundColor: '#FFC0CB',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  boxSizing: 'border-box',
  position: 'relative',
};
const headerIconsStyle: React.CSSProperties = { position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px', zIndex: 500 };
const iconButtonStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.8em', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.1)' };
const genreInfoStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', marginTop: '70px', marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '15px', padding: '10px 20px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' };
const genreIconStyle: React.CSSProperties = { fontSize: '1.8em', marginRight: '10px' };
const genreNameStyle: React.CSSProperties = { fontSize: '1.5em', color: '#4682B4', margin: 0 };
const questionCountStyle: React.CSSProperties = { fontSize: '1.2em', color: '#333', position: 'absolute', top: '20px', left: '20px', backgroundColor: 'rgba(255,255,255,0.7)', padding: '8px 15px', borderRadius: '10px' };
const scoreStyle: React.CSSProperties = { fontSize: '1.2em', color: '#333', position: 'absolute', top: '65px', left: '20px', backgroundColor: 'rgba(255,255,255,0.7)', padding: '8px 15px', borderRadius: '10px' };
const questionBoxStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '25px', padding: '30px', margin: '20px 0', boxShadow: '0 10px 20px rgba(0,0,0,0.15)', width: '90%', maxWidth: '700px', minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', boxSizing: 'border-box', gap: '16px' };
const questionTextStyle: React.CSSProperties = { fontSize: '2em', color: '#333', textAlign: 'center', fontWeight: 'bold', lineHeight: '1.4', margin: 0 };
const optionsContainerStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '90%', maxWidth: '700px', margin: '20px 0' };
const optionButtonStyle: React.CSSProperties = { padding: '20px 15px', borderRadius: '15px', border: 'none', fontSize: '1.4em', fontWeight: 'bold', color: '#fff', textAlign: 'center', transition: 'transform 0.1s ease-out, background-color 0.2s' };
const actionButtonsContainerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '15px', margin: '30px 0', width: '90%', maxWidth: '700px' };
const actionButtonStyle: React.CSSProperties = { color: 'white', padding: '15px 25px', border: 'none', borderRadius: '15px', cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold', boxShadow: '0 5px #CD5C91', flex: '1 1 auto', minWidth: '120px', maxWidth: '180px' };
const surrenderButtonStyle: React.CSSProperties = { backgroundColor: '#FF4500', color: 'white', padding: '15px 25px', border: 'none', borderRadius: '15px', cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold', boxShadow: '0 5px #CD3700', flex: '1 1 auto', minWidth: '120px', maxWidth: '180px' };
const hintTextStyle: React.CSSProperties = { fontSize: '1.1em', color: '#555', textAlign: 'center', margin: 0, padding: '8px 16px', backgroundColor: '#FFF9C4', borderRadius: '10px', width: '100%', boxSizing: 'border-box' as const };
const answerInBoxStyle: React.CSSProperties = { fontSize: '1.2em', fontWeight: 'bold', color: '#fff', textAlign: 'center', margin: 0, padding: '8px 16px', backgroundColor: '#4CAF50', borderRadius: '10px', width: '100%', boxSizing: 'border-box' as const };
const handsFreeGuideStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '20px', padding: '25px', margin: '20px 0', width: '90%', maxWidth: '700px', textAlign: 'center' };
const conciergeMessageStyle: React.CSSProperties = { fontSize: '1.5em', color: '#4682B4', fontWeight: 'bold', marginBottom: '15px' };
const voiceCommandStyle: React.CSSProperties = { fontSize: '1.8em', color: '#333', fontWeight: 'bold', marginBottom: '10px' };
const voiceCommandExampleStyle: React.CSSProperties = { fontSize: '1em', color: '#555' };
const loadingStyle: React.CSSProperties = { fontSize: '2em', color: '#4682B4', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#FFC0CB', fontFamily: "'Mochiy Pop One', cursive" };
const titleStyle: React.CSSProperties = { color: '#4682B4', fontSize: '2.5em', marginTop: '80px', marginBottom: '40px', textAlign: 'center' };
const resultBoxStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '25px', padding: '30px', margin: '20px 0', boxShadow: '0 10px 20px rgba(0,0,0,0.15)', width: '90%', maxWidth: '700px', boxSizing: 'border-box', textAlign: 'center' };
const resultTextStyle: React.CSSProperties = { fontSize: '1.5em', color: '#333', margin: '10px 0' };
const resultActionButtonsStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' };
const buttonStyle: React.CSSProperties = { backgroundColor: '#FF69B4', color: 'white', padding: '15px 25px', border: 'none', borderRadius: '15px', cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold', boxShadow: '0 5px #CD5C91' };

export default GamePage;
