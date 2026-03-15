
// src/components/GamePage/GamePage.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Settings from '../common/Settings/Settings';
import { getLoginStatus } from '../common/Login/Login';
import {
  QuizData,
  getNextQuiz,
  getShuffledOptions,
  checkAnswer,
  addPlayedQuizId,
  getPlayedQuizIds,
  resetPlayedQuizIds,
  getAllAvailableQuizzesCount
} from '../../services/quizEngine';
import { speak, stopSpeaking } from '../../services/speechSynthesis';
import { useHandsFree } from '../../hooks/useHandsFree';

// SEのパス（publicフォルダに配置を想定）
const CORRECT_SE_PATH = '/se/correct.mp3';
const INCORRECT_SE_PATH = '/se/incorrect.mp3';

const correctAudio = typeof window !== 'undefined' ? new Audio(CORRECT_SE_PATH) : null;
const incorrectAudio = typeof window !== 'undefined' ? new Audio(INCORRECT_SE_PATH) : null;

interface GamePageProps {
  setCurrentPage: (page: 'TOP' | 'GAME' | 'RESULT') => void;
  selectedGenre: string;
  selectedDifficulty: number;
  isHandsFreeMode: boolean;
  setIsHandsFreeMode: (mode: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isLoggedIn: boolean;
  isPremiumUser: boolean;
  setIsLoggedIn: (status: boolean) => void;
  setIsPremiumUser: (status: (prev: boolean) => boolean) => void; // setStateの関数型更新に対応
  isSpeakingAllowed: boolean; // 音声コンテキストがアンロックされたか
  resetQuizState: () => void; // 親コンポーネント (TopPage) からGamePageの状態をリセットするコールバック
}

interface QuizResult {
  question: string;
  answer: string;
  userAnswer: string;
  isCorrect: boolean;
}

const GamePage: React.FC<GamePageProps> = ({
  setCurrentPage,
  selectedGenre,
  selectedDifficulty,
  isHandsFreeMode,
  setIsHandsFreeMode,
  isMuted,
  setIsMuted,
  isLoggedIn,
  isPremiumUser,
  setIsLoggedIn,
  setIsPremiumUser,
  isSpeakingAllowed,
  resetQuizState,
}) => {
  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'surrender' | null>(null);
  const [showHint, setShowHint] = useState<number | null>(null); // 1, 2, 3
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [isQuizEnded, setIsQuizEnded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playedQuizIds, setPlayedQuizIds] = useState<Set<string>>(new Set());
  const [conciergeMessage, setConciergeMessage] = useState<string | null>(null);
  const quizSequenceRef = useRef<number>(0); // クイズの進行状況を追跡するためのカウンター

  const TOTAL_QUIZZES = 10; // 問題数固定

  const { isRecognizing, readQuestion, readHint, resetSilenceTimer } = useHandsFree({
    isHandsFreeMode,
    onVoiceCommand: useCallback((command, transcript) => {
      // 発話認識時にコンシェルジュメッセージをクリア
      setConciergeMessage(null);
      if (command === 'hint1') {
        handleShowHint(1);
      } else if (command === 'hint2') {
        handleShowHint(2);
      } else if (command === 'hint3') {
        handleShowHint(3);
      } else if (command === 'surrender') {
        handleSurrender();
      } else if (command === 'repeatQuestion') {
        if (currentQuiz) {
          readQuestion();
        }
      } else if (command === 'answerAttempt' && transcript && currentQuiz) {
        // 音声認識での回答試行
        handleAnswer(transcript);
      }
    }, [currentQuiz, handleShowHint, handleSurrender, handleAnswer, readQuestion]),
    onSilenceDetected: useCallback((seconds) => {
      if (isMuted) return; // ミュート時はコンシェルジュもオフ
      if (seconds === 7) {
        setConciergeMessage('ヒント1と言ってみてね');
        speak('ヒント1と言ってみてね');
      } else if (seconds === 12) {
        setConciergeMessage('ヒント2と言ってみてね');
        speak('ヒント2と言ってみてね');
      } else if (seconds === 17) {
        setConciergeMessage('ヒント3と言ってみてね');
        speak('ヒント3と言ってみてね');
      } else if (seconds === 25) {
        setConciergeMessage('降参の場合は、降参と言ってね');
        speak('降参の場合は、降参と言ってね');
      }
    }, [isMuted, speak]),
    currentQuestion: currentQuiz?.question,
    isSpeakingAllowed,
  });


  // SE再生ヘルパー
  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio && !isMuted) {
      audio.currentTime = 0;
      audio.play().catch(e => console.error("Audio playback failed:", e));
    }
  };

  const loadNextQuiz = useCallback(() => {
    if (currentQuestionIndex >= TOTAL_QUIZZES) {
      setIsQuizEnded(true);
      return;
    }

    const currentPlayedIds = getPlayedQuizIds(selectedGenre, selectedDifficulty);
    const nextQuiz = getNextQuiz(selectedGenre, selectedDifficulty, currentPlayedIds);

    if (nextQuiz) {
      setCurrentQuiz(nextQuiz);
      setOptions(getShuffledOptions(nextQuiz));
      setShowHint(null);
      setFeedback(null);
      // 既読リストに追加
      addPlayedQuizId(selectedGenre, selectedDifficulty, nextQuiz.id);
      setPlayedQuizIds(prev => new Set(prev).add(nextQuiz.id));

      if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
        // 問題文を読み上げ
        speak(`第${currentQuestionIndex + 1}問。${nextQuiz.question}`);
        resetSilenceTimer();
        setConciergeMessage(null); // 新しい問題でコンシェルジュメッセージをリセット
      }
    } else {
        // 指示事項1: 10問固定のクイズ中に利用可能な問題が不足した場合の処理を修正
        stopSpeaking(); // 読み上げ中の場合は停止
        alert('エラー: このジャンルと難易度で利用可能な新しい問題が不足しています。開発者に連絡してください。');
        setCurrentPage('TOP'); // TOP画面に戻る
        resetQuizState(); // クイズの状態をリセット
    }
  }, [currentQuestionIndex, selectedGenre, selectedDifficulty, isHandsFreeMode, isMuted, isSpeakingAllowed, setCurrentPage, resetSilenceTimer, speak, resetQuizState]);

  useEffect(() => {
    // コンポーネントマウント時、またはクイズ開始時に一度だけリセット
    setPlayedQuizIds(getPlayedQuizIds(selectedGenre, selectedDifficulty));
    loadNextQuiz();
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizResults([]);
    setIsQuizEnded(false);
  }, [selectedGenre, selectedDifficulty, loadNextQuiz, resetQuizState]);


  // 指示事項2: feedbackがセットされたら一定時間後に次の問題へ（不正解時はループ）
  useEffect(() => {
    // 正解または降参の場合のみ、自動で次の問題へ
    if ((feedback === 'correct' || feedback === 'surrender') && currentQuiz) {
      const currentQuizSequence = quizSequenceRef.current; // コールバック実行時のシーケンスを保存
      setTimeout(() => {
        // 次の問題に進む前に、feedbackが現在のものと一致するか確認
        if (quizSequenceRef.current === currentQuizSequence) {
            handleNextQuestion();
        }
      }, isHandsFreeMode ? 1500 : 1000); // ハンズフリーは少し長めに
    }
    // feedback === 'incorrect' (不正解) の場合は何もしない (ループ)
  }, [feedback, currentQuiz, isHandsFreeMode, handleNextQuestion]);

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex(prev => prev + 1);
    quizSequenceRef.current = 0; // 次の問題へ進むのでシーケンスをリセット
    setFeedback(null);
    setShowHint(null);
    setConciergeMessage(null); // 次の問題へ進む際にコンシェルジュメッセージをリセット

    if (currentQuestionIndex + 1 >= TOTAL_QUIZZES) {
      setIsQuizEnded(true);
      // 結果発表画面に遷移
      if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
        speak(`クイズ終了です。あなたのスコアは${score}点でした。`);
      }
    } else {
      loadNextQuiz();
    }
  }, [currentQuestionIndex, isHandsFreeMode, isMuted, isSpeakingAllowed, score, loadNextQuiz]);


  const handleAnswer = useCallback((userAnswer: string) => {
    if (!currentQuiz || feedback === 'correct' || feedback === 'surrender') return; // 既に正解済みか降参済みの場合は処理しない

    quizSequenceRef.current++; // シーケンスをインクリメント

    const correct = checkAnswer(currentQuiz, userAnswer);
    let spokenFeedback = '';

    if (correct) {
      playSound(correctAudio);
      setScore(prev => prev + 1);
      setFeedback('correct');
      // 指示事項2: 正解の場合のみ、次の問題への誘導を含める
      if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
        speak(`ピンポン！正解は${currentQuiz.answer}です。次の問題です。`);
        resetSilenceTimer();
        setConciergeMessage(null);
      }
    } else {
      playSound(incorrectAudio);
      setFeedback('incorrect');
      // 指示事項2: 不正解の場合は、現在の問題を再考させるフィードバックのみ
      if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
        speak(`ブブー！違います。もう一度考えてみましょう。`);
        resetSilenceTimer();
        setConciergeMessage(null);
      }
    }

    setQuizResults(prev => [
      ...prev,
      {
        question: currentQuiz.question,
        answer: currentQuiz.answer,
        userAnswer: userAnswer,
        isCorrect: correct,
      },
    ]);

  }, [currentQuiz, feedback, isHandsFreeMode, isMuted, isSpeakingAllowed, playSound, speak, resetSilenceTimer]);

  const handleSurrender = useCallback(() => {
    if (!currentQuiz || feedback === 'correct' || feedback === 'surrender') return;

    quizSequenceRef.current++; // シーケンスをインクリメント

    playSound(correctAudio); // 降参時も肯定的なSE
    setFeedback('surrender');
    setQuizResults(prev => [
      ...prev,
      {
        question: currentQuiz.question,
        answer: currentQuiz.answer,
        userAnswer: '降参',
        isCorrect: false,
      },
    ]);

    if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
      speak(`答えは${currentQuiz.answer}です。次の問題です。`);
      resetSilenceTimer();
      setConciergeMessage(null);
    }
  }, [currentQuiz, feedback, isHandsFreeMode, isMuted, isSpeakingAllowed, playSound, speak, resetSilenceTimer]);

  const handleShowHint = useCallback((hintNumber: number) => {
    if (!currentQuiz) return;
    let hintText = '';
    if (hintNumber === 1) {
      hintText = currentQuiz.hint1;
    } else if (hintNumber === 2) {
      // ヒント2と3はhandsFreeModeのみ有効
      if (!isHandsFreeMode) return;
      hintText = currentQuiz.hint2;
    } else if (hintNumber === 3) {
      if (!isHandsFreeMode) return;
      hintText = currentQuiz.hint3;
    } else {
      return; // 不正なヒント番号
    }
    setShowHint(hintNumber);

    if (isHandsFreeMode && !isMuted && isSpeakingAllowed) {
      speak(`ヒント${hintNumber}：${hintText}`);
      resetSilenceTimer();
      setConciergeMessage(null);
    } else if (!isMuted && isSpeakingAllowed) {
      // 通常モードでヒント1を読み上げる
      speak(`ヒント1：${currentQuiz.hint1}`);
    }

  }, [currentQuiz, isHandsFreeMode, isMuted, isSpeakingAllowed, speak, resetSilenceTimer]);


  const handleToggleMute = useCallback(() => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (newState) {
      stopSpeaking();
    } else {
      if (isHandsFreeMode && isSpeakingAllowed && currentQuiz) {
        // ミュート解除時、ハンズフリーモードなら問題文を読み上げる
        speak(`第${currentQuestionIndex + 1}問。${currentQuiz.question}`);
      }
    }
  }, [isMuted, setIsMuted, isHandsFreeMode, isSpeakingAllowed, currentQuestionIndex, currentQuiz, speak]);

  const handleSettingsLoginStatusChange = (isLoggedIn: boolean, isPremium: boolean) => {
    setIsLoggedIn(isLoggedIn);
    setIsPremiumUser(() => isPremium); // 関数型更新に対応
  };

  const handleGoHomeConfirm = () => {
    if (window.confirm('クイズを中断しますか？スコアはリセットされます。')) {
      stopSpeaking();
      setCurrentPage('TOP');
      resetQuizState();
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
    const correctCount = quizResults.filter(r => r.isCorrect).length;
    const accuracy = (correctCount / TOTAL_QUIZZES) * 100;

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

          <h3 style={mistakeTitleStyle}>間違えた問題</h3>
          {quizResults.filter(r => !r.isCorrect).length > 0 ? (
            <ul style={mistakeListStyle}>
              {quizResults.filter(r => !r.isCorrect).map((result, index) => (
                <li key={index} style={mistakeItemStyle}>
                  <strong>Q:</strong> {result.question} <br />
                  <strong>A:</strong> {result.answer} <br />
                  <strong>あなたの回答:</strong> {result.userAnswer}
                </li>
              ))}
            </ul>
          ) : (
            <p style={resultTextStyle}>全問正解！素晴らしい！</p>
          )}

          <div style={resultActionButtonsStyle}>
            <button onClick={() => { setCurrentQuestionIndex(0); setScore(0); setQuizResults([]); setIsQuizEnded(false); loadNextQuiz(); }} style={{ ...buttonStyle, '--shadow-color': '#CD5C91' } as React.CSSProperties}>もう一度</button>
            <button onClick={() => { setCurrentPage('TOP'); resetQuizState(); }} style={{ ...buttonStyle, '--shadow-color': '#CD5C91' } as React.CSSProperties}>別のレベルへ</button>
            <button onClick={() => { setCurrentPage('TOP'); resetQuizState(); }} style={{ ...buttonStyle, '--shadow-color': '#CD5C91' } as React.CSSProperties}>別のジャンルへ</button>
            <button onClick={() => { setCurrentPage('TOP'); resetQuizState(); }} style={{ ...buttonStyle, '--shadow-color': '#CD5C91' } as React.CSSProperties}>TOPに戻る</button>
          </div>
        </div>
        {showSettings && (
            <Settings
                onClose={() => setShowSettings(false)}
                onLoginStatusChange={handleSettingsLoginStatusChange}
                currentView="RESULT"
                onResetPlayedQuizzes={() => setPlayedQuizIds(getPlayedQuizIds(selectedGenre, selectedDifficulty))}
            />
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
        {feedback === 'correct' && <div style={{...feedbackIconStyle, color: '#4CAF50'}}>●</div>}
        {feedback === 'incorrect' && <div style={{...feedbackIconStyle, color: '#f44336'}}>×</div>}
        {feedback === 'surrender' && <div style={{...feedbackIconStyle, color: '#4CAF50'}}>●</div>} {/* 降参も●で表示 */}
        <p style={questionTextStyle}>{currentQuiz?.question}</p>
      </div>

      {isHandsFreeMode ? (
        <div style={handsFreeGuideStyle}>
          {conciergeMessage && <p style={conciergeMessageStyle}>🗣️ {conciergeMessage}</p>}
          <p style={voiceCommandStyle}>「〇〇」と言ってみてね</p>
          <p style={voiceCommandExampleStyle}>
            （例：「問題」「ヒント1」「ヒント2」「ヒント3」「降参」）
            {isRecognizing ? <span style={{marginLeft: '10px', color: '#4CAF50'}}>音声認識中...</span> : <span style={{marginLeft: '10px', color: '#f44336'}}>音声認識オフ</span>}
          </p>
        </div>
      ) : (
        <div style={optionsContainerStyle}>
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(option)}
              style={{
                ...optionButtonStyle,
                backgroundColor:
                  feedback === 'correct' && option === currentQuiz?.answer
                    ? '#4CAF50' // 正解
                    : feedback === 'incorrect' && option === currentQuiz?.answer
                    ? '#FDD835' // 不正解だが正解選択肢
                    : feedback === 'incorrect' && option === quizResults[quizResults.length - 1]?.userAnswer && option !== currentQuiz?.answer
                    ? '#f44336' // 不正解で選択した選択肢
                    : '#87CEEB', // 通常
                boxShadow:
                  feedback === 'correct' && option === currentQuiz?.answer
                    ? '0 5px #388E3C'
                    : feedback === 'incorrect' && option === currentQuiz?.answer
                    ? '0 5px #FBC02D'
                    : feedback === 'incorrect' && option === quizResults[quizResults.length - 1]?.userAnswer && option !== currentQuiz?.answer
                    ? '0 5px #D32F2F'
                    : '0 5px #64B5F6',
                cursor: feedback === 'correct' || feedback === 'surrender' ? 'not-allowed' : 'pointer',
                '--shadow-color':
                  feedback === 'correct' && option === currentQuiz?.answer
                    ? '#388E3C'
                    : feedback === 'incorrect' && option === currentQuiz?.answer
                    ? '#FBC02D'
                    : feedback === 'incorrect' && option === quizResults[quizResults.length - 1]?.userAnswer && option !== currentQuiz?.answer
                    ? '#D32F2F'
                    : '#64B5F6',
              } as React.CSSProperties}
              disabled={feedback === 'correct' || feedback === 'surrender'}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      <div style={actionButtonsContainerStyle}>
        <button
          onClick={() => handleShowHint(1)}
          // 指示事項6: 不要な opacity/cursor 条件を削除
          style={{
            ...actionButtonStyle,
            backgroundColor: showHint === 1 ? '#FFD700' : actionButtonStyle.backgroundColor,
            boxShadow: showHint === 1 ? '0 4px #DAA520' : actionButtonStyle.boxShadow,
            '--shadow-color': showHint === 1 ? '#DAA520' : '#CD5C91',
          } as React.CSSProperties}
        >
          ヒント1
        </button>
        {isHandsFreeMode && (
          <>
            <button
              onClick={() => handleShowHint(2)}
              style={{
                ...actionButtonStyle,
                backgroundColor: showHint === 2 ? '#FFD700' : actionButtonStyle.backgroundColor,
                boxShadow: showHint === 2 ? '0 4px #DAA520' : actionButtonStyle.boxShadow,
                '--shadow-color': showHint === 2 ? '#DAA520' : '#CD5C91',
              } as React.CSSProperties}
            >
              ヒント2
            </button>
            <button
              onClick={() => handleShowHint(3)}
              style={{
                ...actionButtonStyle,
                backgroundColor: showHint === 3 ? '#FFD700' : actionButtonStyle.backgroundColor,
                boxShadow: showHint === 3 ? '0 4px #DAA520' : actionButtonStyle.boxShadow,
                '--shadow-color': showHint === 3 ? '#DAA520' : '#CD5C91',
              } as React.CSSProperties}
            >
              ヒント3
            </button>
          </>
        )}
        <button onClick={handleSurrender} style={surrenderButtonStyle}>
          降参
        </button>
      </div>

      {showHint === 1 && currentQuiz && <p style={hintTextStyle}>ヒント1: {currentQuiz.hint1}</p>}
      {showHint === 2 && currentQuiz && <p style={hintTextStyle}>ヒント2: {currentQuiz.hint2}</p>}
      {showHint === 3 && currentQuiz && <p style={hintTextStyle}>ヒント3: {currentQuiz.hint3}</p>}
      {(feedback === 'correct' || feedback === 'surrender') && currentQuiz && (
        <p style={answerDisplayOnFeedback}>答えは: {currentQuiz.answer}</p>
      )}


      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onLoginStatusChange={handleSettingsLoginStatusChange}
          currentView="GAME"
          onResetPlayedQuizzes={() => setPlayedQuizIds(getPlayedQuizIds(selectedGenre, selectedDifficulty))}
        />
      )}
    </div>
  );
};

// Styles
const containerStyle: React.CSSProperties = {
  fontFamily: "'Mochiy Pop One', cursive", // Google Fonts
  backgroundColor: '#FFC0CB', // ピンク基調
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  boxSizing: 'border-box',
  position: 'relative',
};

const headerIconsStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  display: 'flex',
  gap: '10px',
  zIndex: 500,
};

const iconButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  border: 'none',
  borderRadius: '50%',
  width: '50px',
  height: '50px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '1.8em',
  cursor: 'pointer',
  boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
  transition: 'transform 0.1s ease-out, background-color 0.2s',
  '--shadow-color': 'rgba(0,0,0,0.1)', // デフォルトシャドウカラー
} as React.CSSProperties; // 型アサーション

const genreInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginTop: '70px',
  marginBottom: '20px',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: '15px',
  padding: '10px 20px',
  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
};

const genreIconStyle: React.CSSProperties = {
  fontSize: '1.8em',
  marginRight: '10px',
};

const genreNameStyle: React.CSSProperties = {
  fontSize: '1.5em',
  color: '#4682B4',
  margin: 0,
};

const questionCountStyle: React.CSSProperties = {
  fontSize: '1.2em',
  color: '#333',
  position: 'absolute',
  top: '20px',
  left: '20px',
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  padding: '8px 15px',
  borderRadius: '10px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const scoreStyle: React.CSSProperties = {
  fontSize: '1.2em',
  color: '#333',
  position: 'absolute',
  top: '65px',
  left: '20px',
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  padding: '8px 15px',
  borderRadius: '10px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const questionBoxStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: '25px',
  padding: '30px',
  margin: '20px 0',
  boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15)',
  width: '90%',
  maxWidth: '700px',
  minHeight: '150px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  boxSizing: 'border-box',
};

const feedbackIconStyle: React.CSSProperties = {
  position: 'absolute',
  top: '15px',
  right: '15px',
  fontSize: '3em',
  fontWeight: 'bold',
  color: 'white',
  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
  zIndex: 1,
};

const questionTextStyle: React.CSSProperties = {
  fontSize: '2em',
  color: '#333',
  textAlign: 'center',
  fontWeight: 'bold',
  lineHeight: '1.4',
  margin: 0,
};

const optionsContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '15px',
  width: '90%',
  maxWidth: '700px',
  margin: '20px 0',
};

const optionButtonStyle: React.CSSProperties = {
  padding: '20px 15px',
  borderRadius: '15px',
  border: 'none',
  fontSize: '1.4em',
  fontWeight: 'bold',
  color: '#fff',
  textAlign: 'center',
  transition: 'transform 0.1s ease-out, background-color 0.2s, box-shadow 0.1s',
} as React.CSSProperties;

const actionButtonsContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: '15px',
  margin: '30px 0',
  width: '90%',
  maxWidth: '700px',
};

const actionButtonStyle: React.CSSProperties = {
  backgroundColor: '#FF69B4', // ピンク
  color: 'white',
  padding: '15px 25px',
  border: 'none',
  borderRadius: '15px',
  cursor: 'pointer',
  fontSize: '1.2em',
  fontWeight: 'bold',
  boxShadow: '0 5px #CD5C91',
  transition: 'background-color 0.2s, transform 0.1s ease-out, box-shadow 0.1s',
  flex: '1 1 auto', // フレキシブルに配置
  minWidth: '120px', // 最小幅
  maxWidth: '180px', // 最大幅
  // 指示事項6: 不要な opacity/cursor 条件を削除
  // `--shadow-color` を追加して :active で参照できるようにする
  '--shadow-color': '#CD5C91',
} as React.CSSProperties; // 型アサーション

const surrenderButtonStyle: React.CSSProperties = {
  backgroundColor: '#FF4500', // オレンジレッド
  color: 'white',
  padding: '15px 25px',
  border: 'none',
  borderRadius: '15px',
  cursor: 'pointer',
  fontSize: '1.2em',
  fontWeight: 'bold',
  boxShadow: '0 5px #CD3700',
  transition: 'background-color 0.2s, transform 0.1s ease-out, box-shadow 0.1s',
  flex: '1 1 auto',
  minWidth: '120px',
  maxWidth: '180px',
  '--shadow-color': '#CD3700',
} as React.CSSProperties;

const hintTextStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  padding: '15px 25px',
  borderRadius: '15px',
  marginTop: '20px',
  fontSize: '1.2em',
  color: '#555',
  width: '90%',
  maxWidth: '700px',
  textAlign: 'center',
  boxShadow: '0 5px 10px rgba(0,0,0,0.1)',
};

const answerDisplayOnFeedback: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: '15px 25px',
    borderRadius: '15px',
    marginTop: '10px',
    fontSize: '1.4em',
    color: '#333',
    fontWeight: 'bold',
    width: '90%',
    maxWidth: '700px',
    textAlign: 'center',
    boxShadow: '0 5px 10px rgba(0,0,0,0.1)',
    border: '2px solid #4CAF50',
};

const handsFreeGuideStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: '20px',
  padding: '25px',
  margin: '20px 0',
  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  width: '90%',
  maxWidth: '700px',
  textAlign: 'center',
};

const conciergeMessageStyle: React.CSSProperties = {
  fontSize: '1.5em',
  color: '#4682B4',
  fontWeight: 'bold',
  marginBottom: '15px',
};

const voiceCommandStyle: React.CSSProperties = {
  fontSize: '1.8em',
  color: '#333',
  fontWeight: 'bold',
  marginBottom: '10px',
};

const voiceCommandExampleStyle: React.CSSProperties = {
  fontSize: '1em',
  color: '#555',
};

const loadingStyle: React.CSSProperties = {
  fontSize: '2em',
  color: '#4682B4',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#FFC0CB',
  fontFamily: "'Mochiy Pop One', cursive",
};

// Result Page Styles
const titleStyle: React.CSSProperties = {
  color: '#4682B4',
  fontSize: '2.5em',
  marginTop: '80px',
  marginBottom: '40px',
  textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
  textAlign: 'center',
};

const resultBoxStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: '25px',
  padding: '30px',
  margin: '20px 0',
  boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15)',
  width: '90%',
  maxWidth: '700px',
  boxSizing: 'border-box',
  textAlign: 'center',
};

const resultTextStyle: React.CSSProperties = {
  fontSize: '1.5em',
  color: '#333',
  margin: '10px 0',
};

const mistakeTitleStyle: React.CSSProperties = {
  color: '#FF4500',
  fontSize: '1.6em',
  marginTop: '30px',
  marginBottom: '15px',
  borderBottom: '2px solid #FF4500',
  paddingBottom: '5px',
  display: 'inline-block',
};

const mistakeListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  maxHeight: '250px',
  overflowY: 'auto',
  textAlign: 'left',
  backgroundColor: '#ffebee',
  borderRadius: '10px',
  padding: '15px',
};

const mistakeItemStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '10px 15px',
  borderRadius: '8px',
  marginBottom: '10px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
  lineHeight: '1.4',
  color: '#333',
  fontSize: '0.95em',
};

const resultActionButtonsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '15px',
  marginTop: '30px',
};

const buttonStyle: React.CSSProperties = {
    backgroundColor: '#FF69B4', // ピンク
    color: 'white',
    padding: '15px 25px',
    border: 'none',
    borderRadius: '15px',
    cursor: 'pointer',
    fontSize: '1.2em',
    fontWeight: 'bold',
    boxShadow: '0 5px #CD5C91',
    transition: 'background-color 0.2s, transform 0.1s ease-out, box-shadow 0.1s',
} as React.CSSProperties;

export default GamePage;
