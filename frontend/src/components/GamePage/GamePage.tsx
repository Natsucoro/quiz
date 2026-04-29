// src/components/GamePage/GamePage.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Settings from '../common/Settings/Settings';
import {
  QuizData,
  getNextQuiz,
  getShuffledOptions,
  checkAnswer,
} from '../../services/quizEngine';
import { speak, stopSpeaking, toReadableText } from '../../services/speechSynthesis';
import { useHandsFree } from '../../hooks/useHandsFree';
import { useSettingsStore } from '../../store/settingsStore';
import { usePurchaseStore } from '../../store/purchaseStore';
import { SpriteIcon } from '../common/SpriteIcon';

// SVGアイコンのインポート
import AshikaIcon from '../../assets/icons/ashika.svg';
import KabutomushiIcon from '../../assets/icons/kabutomushi.svg';
import toolIcon from '../../assets/icons/icon_setting.png';
import soundIcon from '../../assets/icons/sound.svg';
import micIcon from '../../assets/icons/mic.svg';
import HanaIcon from '../../assets/icons/hana.svg';
import NorimonoIcon from '../../assets/icons/shinkansen.svg';
import MonoIcon from '../../assets/icons/tool.svg';
import NihonIcon from '../../assets/icons/niihon.svg';
import ChikyuIcon from '../../assets/icons/xhikyu2.svg';
import SakanaIcon from '../../assets/icons/sakana.svg';
import HatoIcon from '../../assets/icons/hato.svg';
import HebiIcon from '../../assets/icons/hebi.svg';
import KaniIcon from '../../assets/icons/kani.svg';
import HagurumaIcon from '../../assets/icons/haguruma.svg';
import RekishiIcon from '../../assets/icons/rekishi.svg';
import FoodIcon from '../../assets/icons/food.svg';
import FlagIcon from '../../assets/icons/flag.svg';
import MedalKinIcon from '../../assets/icons/medaru_kin.svg';
import MedalGinIcon from '../../assets/icons/medaru_gin.svg';
import MedalDouIcon from '../../assets/icons/medaru_dou.svg';
import GuestIcon from '../../assets/icons/guest.svg';
import UserIcon from '../../assets/icons/user.svg';

const renderRuby = (text: string): React.ReactNode[] =>
  text.split(/(\{[^|]+\|[^}]+\})/g).map((part, i) => {
    const m = part.match(/\{([^|]+)\|([^}]+)\}/);
    return m ? <ruby key={i}>{m[1]}<rt>{m[2]}</rt></ruby> : part;
  });

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
  questionCount: number;
  onBack: () => void;
  onBackToDifficulty: () => void;
  onMicStatus?: (status: { isRecognizing: boolean; isListening: boolean; isProcessing: boolean; transcript: string }) => void;
  onLoginRequest?: () => void;
}

const GENRE_RUBY: Record<string, string> = {
  '昆虫': 'こんちゅう', '植物': 'しょくぶつ',
  '魚類': 'さかな', '鳥類': 'とりるい', '爬虫類': 'はちゅうるい',
  '哺乳類': 'ほにゅうるい', '海洋生物': 'かいようせいぶつ',
  '乗り物': 'のりもの', '道具': 'どうぐ', '歴史上の人物': 'れきしのじんぶつ',
  '日本の地理': 'にほんのちり', '世界の地理': 'せかいのちり',
};

const GamePage: React.FC<GamePageProps> = ({ genre: selectedGenre, difficulty: selectedDifficulty, questionCount, onBack, onBackToDifficulty, onMicStatus, onLoginRequest }) => {
  const { isMuted, setIsMuted, isHandsFree, setIsHandsFree } = useSettingsStore();
  const { isLoggedIn } = usePurchaseStore();
  const isHandsFreeMode = isHandsFree;
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
  const [effectKey, setEffectKey] = useState<{ type: 'correct' | 'incorrect'; id: number } | null>(null);

  const quizSequenceRef = useRef<number>(0);
  // 循環依存を避けるためにhandlerをrefで保持
  const handleShowHintRef = useRef<(n: number) => void>(() => {});
  const handleSurrenderRef = useRef<() => void>(() => {});
  const handleAnswerRef = useRef<(ans: string) => void>(() => {});
  const handleNextQuestionRef = useRef<() => void>(() => {});
  const readQuestionRef = useRef<() => void>(() => {});
  
  const [isResultActionsVisible, setIsResultActionsVisible] = useState(false);
  const resultActionsRef = useRef<HTMLDivElement>(null);

  // 結果画面のボタンエリアを監視
  useEffect(() => {
    if (!isQuizEnded || !resultActionsRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsResultActionsVisible(entry.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(resultActionsRef.current);
    return () => observer.disconnect();
  }, [isQuizEnded]);

  const playSound = useCallback((type: 'correct' | 'incorrect') => {
    if (isMuted) return;
    if (type === 'correct') playCorrectSound();
    else playIncorrectSound();
  }, [isMuted]);

  const playedIdsThisSession = useRef<Set<string>>(new Set());
  const wrongQuizzesRef = useRef<QuizData[]>([]);
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
    } else if (initializedRef.current) {
      // 問題が尽きたら静かに終了画面へ
      setIsQuizEnded(true);
    }
  }, [selectedGenre, selectedDifficulty]);

  const initializedRef = useRef(false);
  const spokenQuestionIndex = useRef(-1);

  // 初期化
  useEffect(() => {
    initializedRef.current = false;
    spokenQuestionIndex.current = -1;
    playedIdsThisSession.current = new Set();
    wrongQuizzesRef.current = [];
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsQuizEnded(false);
    loadNextQuiz(0);
    initializedRef.current = true;
  }, [selectedGenre, selectedDifficulty, loadNextQuiz]);

  // 問題の読み上げ
  useEffect(() => {
    if (initializedRef.current && !isMuted && currentQuiz && spokenQuestionIndex.current !== currentQuestionIndex) {
      const q = toReadableText(currentQuiz.questionRuby || currentQuiz.question);
      speak(`第${currentQuestionIndex + 1}問。${q}`);
      spokenQuestionIndex.current = currentQuestionIndex;
    }
  }, [isMuted, currentQuiz, currentQuestionIndex]);


  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex(prev => {
      const next = prev + 1;
      if (next >= questionCount) {
        setIsQuizEnded(true);
        if (!isMutedRef.current && isSpeakingAllowed) {
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
  }, [isSpeakingAllowed, loadNextQuiz, questionCount]);

  handleNextQuestionRef.current = handleNextQuestion;

  // 正解・降参後に自動で次の問題へ（ハンズフリーモードのみ）
  useEffect(() => {
    if (!isHandsFreeMode) return;
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
      setEffectKey({ type: 'correct', id: Date.now() });
      if (!isMuted && isSpeakingAllowed) {
        const ans = toReadableText(currentQuiz.answerReading ?? currentQuiz.answer);
        speak(`ピンポン！正解は${ans}です。`);
      }
    } else {
      hasAnsweredIncorrectlyRef.current = true;
      playSound('incorrect');
      setFeedback('incorrect');
      setEffectKey({ type: 'incorrect', id: Date.now() });
      // 初めて間違えた時だけ wrongQuizzes に追加
      if (currentQuiz && !wrongQuizzesRef.current.find(q => q.id === currentQuiz.id)) {
        wrongQuizzesRef.current = [...wrongQuizzesRef.current, currentQuiz];
      }
      if (!isMuted && isSpeakingAllowed) {
        speak('ブブー！「' + userAnswer + '」は不正解です。もう一度考えてみましょう。');
        setConciergeMessage(null);
      }
    }
  }, [currentQuiz, feedback, isMuted, isSpeakingAllowed, playSound]);

  handleAnswerRef.current = handleAnswer;

  const handleSurrender = useCallback(() => {
    if (!currentQuiz || feedback === 'correct' || feedback === 'surrender') return;
    quizSequenceRef.current++;
    playSound('correct');
    setFeedback('surrender');
    if (!wrongQuizzesRef.current.find(q => q.id === currentQuiz.id)) {
      wrongQuizzesRef.current = [...wrongQuizzesRef.current, currentQuiz];
    }
    if (!isMuted && isSpeakingAllowed) {
      const ans = toReadableText(currentQuiz.answerReading ?? currentQuiz.answer);
      speak(`答えは${ans}です。`);
    }
  }, [currentQuiz, feedback, isMuted, isSpeakingAllowed, playSound]);

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
      const readableHint = hintNumber === 1
        ? toReadableText(currentQuiz.hint1Ruby || currentQuiz.hint1)
        : hintText;
      speak(`ヒント${hintNumber}：${readableHint}`);
      setConciergeMessage(null);
    }
  }, [currentQuiz, isHandsFreeMode, isMuted, isSpeakingAllowed]);

  handleShowHintRef.current = handleShowHint;

  const { isRecognizing, isListening, isProcessing, transcript, readQuestion, resetSilenceTimer } = useHandsFree({
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

  useEffect(() => {
    onMicStatus?.({ isRecognizing, isListening, isProcessing, transcript });
  }, [isRecognizing, isListening, isProcessing, transcript, onMicStatus]);

  const handleToggleMute = useCallback(() => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (newState) {
      stopSpeaking();
    } else if (currentQuiz) {
      speak(toReadableText(currentQuiz.questionRuby || currentQuiz.question));
    }
  }, [isMuted, setIsMuted, currentQuiz]);

  const handleGoHomeConfirm = () => {
    if (window.confirm('クイズを中断しますか？スコアはリセットされます。')) {
      stopSpeaking();
      onBack();
    }
  };

  const getGenreIcon = (genreName: string) => {
    const iconStyle = { width: '1.2em', height: '1.2em', objectFit: 'contain' as const };
    switch (genreName) {
      case '哺乳類': return <img src={AshikaIcon} alt="哺乳類" style={iconStyle} />;
      case '昆虫': return <img src={KabutomushiIcon} alt="昆虫" style={iconStyle} />;
      case '植物': return <img src={HanaIcon} alt="植物" style={iconStyle} />;
      case '乗り物': return <img src={NorimonoIcon} alt="乗り物" style={iconStyle} />;
      case '道具': return <img src={MonoIcon} alt="道具" style={iconStyle} />;
      case '魚類': return <img src={SakanaIcon} alt="魚類" style={iconStyle} />;
      case '鳥類': return <img src={HatoIcon} alt="鳥類" style={iconStyle} />;
      case '爬虫類': return <img src={HebiIcon} alt="爬虫類" style={iconStyle} />;
      case '海洋生物': return <img src={KaniIcon} alt="海洋生物" style={iconStyle} />;
      case '歴史上の人物': return <img src={RekishiIcon} alt="歴史上の人物" style={iconStyle} />;
      case '日本の地理': return <img src={NihonIcon} alt="日本の地理" style={iconStyle} />;
      case '世界の地理': return <img src={ChikyuIcon} alt="世界の地理" style={iconStyle} />;
      case '食べ物': return <img src={FoodIcon} alt="食べ物" style={iconStyle} />;
      default: return '❓';
    }
  };

if (!currentQuiz && !isQuizEnded) {
    return <div style={loadingStyle}>問題を読み込み中...</div>;
  }

  const renderLoginBadge = () => {
    if (isLoggedIn) {
      return (
        <div style={loginBadgeActiveStyle} onClick={onLoginRequest}>
          <img src={UserIcon} alt="user" style={{ width: '22px', height: '22px' }} />
        </div>
      );
    }
    return (
      <div style={loginBadgeGuestStyle} onClick={onLoginRequest}>
        <img src={GuestIcon} alt="guest" style={{ width: '20px', height: '20px' }} />
        <span style={{ fontSize: '10px', marginTop: '-2px' }}>ゲスト</span>
      </div>
    );
  };

  const stickyHeader = (
    <header style={stickyHeaderStyle}>
      <h1 style={headerTitleStyle} onClick={handleGoHomeConfirm}>
        🎉 こどもクイズあそび 🎉
      </h1>
      <div style={headerIconsStyle}>
        <button onClick={() => setShowSettings(true)} style={iconButtonStyle}>
          ⚙️
        </button>
        <button onClick={handleToggleMute} style={{ ...iconButtonStyle, opacity: isMuted ? 0.4 : 1 }}>
          <img src={soundIcon} alt="音声" style={{ width: '24px', height: '24px' }} />
        </button>
        {renderLoginBadge()}
      </div>
    </header>
  );

  if (isQuizEnded) {
    const accuracy = (score / questionCount) * 100;
    const wrongQuizzes = wrongQuizzesRef.current;
    return (
      <div style={containerStyle}>
        <style>{`
          @keyframes confetti-fall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
          @keyframes confetti-sway {
            0%, 100% { margin-left: 0; }
            50% { margin-left: 50px; }
          }
          .confetti {
            position: fixed;
            top: -20px;
            width: 10px;
            height: 10px;
            z-index: 1500;
            pointer-events: none;
            animation: confetti-fall linear forwards;
          }
          .confetti-inner {
            width: 100%;
            height: 100%;
            animation: confetti-sway ease-in-out infinite;
          }
          rt { font-size: 0.5em; font-weight: normal; }
          
          @keyframes slideUp {
            from { transform: translate(-50%, 100px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
          }
          .floating-bar {
            animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
          @keyframes shine {
            0% { left: -100%; }
            20% { left: 100%; }
            100% { left: 100%; }
          }
          .shine-button {
            position: relative;
            overflow: hidden;
          }
          .shine-button::after {
            content: "";
            position: absolute;
            top: -50%;
            left: -100%;
            width: 60%;
            height: 200%;
            background: linear-gradient(
              to right,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.6) 50%,
              rgba(255, 255, 255, 0) 100%
            );
            transform: rotate(30deg);
            animation: shine 3s infinite;
          }
        `}</style>
        {stickyHeader}
        
        {/* 紙吹雪エフェクト */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="confetti" style={{
            left: `${Math.random() * 100}vw`,
            animationDuration: `${2 + Math.random() * 3}s`,
            animationDelay: `${Math.random() * 5}s`,
          }}>
            <div className="confetti-inner" style={{
              backgroundColor: ['#FF6B6B', '#54A0FF', '#FECA57', '#1DD1A1', '#FF9F43', '#A29BFE'][Math.floor(Math.random() * 6)],
              animationDuration: `${1 + Math.random()}s`,
            }} />
          </div>
        ))}

        <h1 style={{ ...titleStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <img src={FlagIcon} alt="flag" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          結果発表
          <img src={FlagIcon} alt="flag" style={{ width: '40px', height: '40px', objectFit: 'contain', transform: 'scaleX(-1)' }} />
        </h1>
        
        <div style={resultBoxStyle}>
          {/* メダル表示 */}
          <div style={{ marginBottom: '20px' }}>
            {accuracy >= 90 ? (
              <img src={MedalKinIcon} alt="金メダル" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            ) : accuracy >= 60 ? (
              <img src={MedalGinIcon} alt="銀メダル" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            ) : (
              <img src={MedalDouIcon} alt="銅メダル" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            )}
          </div>

          <p style={resultTextStyle}>正解数: <span style={{ color: '#FF69B4', fontSize: '1.2em' }}>{score}</span> / {questionCount}問</p>
          <p style={resultTextStyle}>正解率: <span style={{ color: '#FF69B4', fontSize: '1.2em' }}>{accuracy.toFixed(1)}</span>%</p>

          {wrongQuizzes.length > 0 && (
            <div style={wrongListContainerStyle}>
              <h3 style={wrongListTitleStyle}>📝 まちがえた・降参した問題</h3>
              {wrongQuizzes.map((q) => (
                <div key={q.id} style={wrongItemStyle}>
                  <p style={wrongQuestionStyle}>{q.question}</p>
                  <p style={wrongAnswerStyle}>答え：<strong>{q.answer}</strong></p>
                </div>
              ))}
            </div>
          )}

          <div ref={resultActionsRef} style={resultActionButtonsStyle}>
            <button className="shine-button" onClick={onBackToDifficulty} style={buttonStyle}>べつのレベルへ</button>
            <button onClick={onBack} style={buttonStyle}>べつのジャンルへ</button>
            <button onClick={() => { playedIdsThisSession.current = new Set(); wrongQuizzesRef.current = []; setCurrentQuestionIndex(0); setScore(0); setIsQuizEnded(false); loadNextQuiz(0); }} style={{ ...buttonStyle, background: 'linear-gradient(135deg, #FF9A3C, #FFD6A5)', color: '#a0522d', boxShadow: '0 5px 0 #e67e22' }}>もういちど</button>
            <button onClick={onBack} style={backButtonStyle}>TOPにもどる</button>
          </div>
        </div>

        {/* 追従アクションバー (最下部ボタンが見えていない時) */}
        {!isResultActionsVisible && (
          <div className="floating-bar" style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1600,
            width: '94%',
            maxWidth: '500px',
            display: 'flex',
            gap: '10px'
          }}>
            <button 
              onClick={onBack} 
              style={{
                ...backButtonStyle,
                flex: 1,
                fontSize: '0.9em',
                padding: '12px 8px',
                boxShadow: '0 6px 15px rgba(0, 0, 0, 0.1)'
              }}
            >
              べつのジャンルへ
            </button>
            <button 
              className="shine-button"
              onClick={onBackToDifficulty} 
              style={{
                ...buttonStyle,
                flex: 1,
                fontSize: '0.9em',
                padding: '12px 8px',
                boxShadow: '0 6px 15px rgba(255, 110, 199, 0.3)'
              }}
            >
              べつのレベルへ
            </button>
          </div>
        )}
        {showSettings && (
          <Settings onClose={() => setShowSettings(false)} currentView="RESULT" onLoginRequest={() => setShowSettings(false)} />
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes popFade { 0% { transform: scale(0.3); opacity: 0; } 40% { transform: scale(1.2); opacity: 1; } 70% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.1); opacity: 0; } } 
        @keyframes micPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } } 
        @keyframes micFade { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } } 
        rt { font-size: 0.5em; font-weight: normal; }
        
        /* 紙吹雪アニメーション */
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confetti-sway {
          0%, 100% { margin-left: 0; }
          50% { margin-left: 50px; }
        }
        .confetti {
          position: fixed;
          top: -20px;
          width: 10px;
          height: 10px;
          z-index: 1500;
          pointer-events: none;
          animation: confetti-fall linear forwards;
        }
        .confetti-inner {
          width: 100%;
          height: 100%;
          animation: confetti-sway ease-in-out infinite;
        }
      `}</style>
      {effectKey && (
        <div key={effectKey.id} style={effectOverlayStyle}>
          {effectKey.type === 'correct' ? (
            <svg width="180" height="180" style={{ animation: 'popFade 0.8s ease-out forwards', filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.4))' }} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" stroke="#51CF66" strokeWidth="12" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="180" height="180" style={{ animation: 'popFade 0.8s ease-out forwards', filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.4))' }} viewBox="0 0 100 100">
              <line x1="20" y1="20" x2="80" y2="80" stroke="#FF4757" strokeWidth="12" strokeLinecap="round" />
              <line x1="80" y1="20" x2="20" y2="80" stroke="#FF4757" strokeWidth="12" strokeLinecap="round" />
            </svg>
          )}
        </div>
      )}
      {stickyHeader}

      <div style={genreInfoStyle}>
        <span style={genreIconStyle}>{getGenreIcon(selectedGenre)}</span>
        <h2 style={genreNameStyle}><ruby>{selectedGenre}<rt style={{ fontSize: '0.6em', fontWeight: 'normal' }}>{GENRE_RUBY[selectedGenre] ?? ''}</rt></ruby></h2>
        <span style={questionCountStyle}>{currentQuestionIndex + 1}/{questionCount}問</span>
        <span style={scoreStyle}>スコア: {score}</span>
      </div>

      <div style={questionBoxStyle}>
        <p style={questionTextStyle}>{renderRuby(currentQuiz?.questionRuby || currentQuiz?.question || '')}</p>
        {showHint === 1 && currentQuiz && (
          <p style={hintTextStyle}>ヒント1: {renderRuby(currentQuiz.hint1Ruby || currentQuiz.hint1)}</p>
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
        {!(feedback === 'correct' || feedback === 'surrender') && showHint === null && (
          <button onClick={() => handleShowHint(1)} style={{ ...actionButtonStyle, backgroundColor: showHint === 1 ? '#FFD700' : '#FF69B4', width: '100%', maxWidth: '100%', boxSizing: 'border-box' } as React.CSSProperties}>
            ヒント1
          </button>
        )}
      </div>

      {isHandsFreeMode ? (
        <div style={handsFreeGuideStyle}>
          {conciergeMessage && <p style={conciergeMessageStyle}>🗣️ {conciergeMessage}</p>}
          <p style={voiceCommandStyle}>「〇〇」と言ってみてね</p>
          <p style={voiceCommandExampleStyle}>（例：「問題」「ヒント1」「ヒント2」「ヒント3」「降参」）</p>

        </div>
      ) : (
        <div style={optionsContainerStyle}>
          {options.map((option, index) => {
            const isCorrectOption = option === currentQuiz?.answer;
            const isRevealed = feedback === 'correct' || feedback === 'surrender';
            const colors = ['#FF6B6B', '#54A0FF', '#FECA57', '#1DD1A1'];
            const bg = isRevealed ? (isCorrectOption ? '#51CF66' : '#B0B0B0') : colors[index % 4];
            return (
              <button
                key={index}
                onClick={() => handleAnswer(option)}
                disabled={isRevealed}
                style={{
                  ...optionButtonStyle,
                  backgroundColor: bg,
                  cursor: isRevealed ? 'not-allowed' : 'pointer',
                  position: 'relative', // 番号配置用
                } as React.CSSProperties}
              >
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  left: '4px',
                  fontSize: '0.9em',
                  color: 'rgba(0,0,0,0.5)',
                  fontWeight: 'bold',
                  textShadow: '0.5px 0.5px 0 rgba(255,255,255,0.4)',
                  pointerEvents: 'none'
                }}>
                  {['①', '②', '③', '④'][index]}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      )}

      <div style={actionButtonsContainerStyle}>
        {!isHandsFreeMode && (feedback === 'correct' || feedback === 'surrender') && (
          <button onClick={handleNextQuestion} style={{ ...actionButtonStyle, background: 'linear-gradient(135deg, #51CF66, #20C997)', boxShadow: '0 5px 0 #1aaa7a', flex: '1 1 100%', maxWidth: '100%' }}>
            つぎのもんだいへ →
          </button>
        )}
        {isHandsFreeMode && (
          <>
            <button onClick={() => handleShowHint(1)} style={{ ...actionButtonStyle, backgroundColor: showHint === 1 ? '#FFD700' : '#FF69B4' } as React.CSSProperties}>
              ヒント1
            </button>
            <button onClick={() => handleShowHint(2)} style={{ ...actionButtonStyle, backgroundColor: showHint === 2 ? '#FFD700' : '#FF69B4' } as React.CSSProperties}>
              ヒント2
            </button>
            <button onClick={() => handleShowHint(3)} style={{ ...actionButtonStyle, backgroundColor: showHint === 3 ? '#FFD700' : '#FF69B4' } as React.CSSProperties}>
              ヒント3
            </button>
          </>
        )}
        <button onClick={handleSurrender} style={{ ...surrenderButtonStyle, display: (feedback === 'correct' || feedback === 'surrender') ? 'none' : undefined }}>こうさん</button>
      </div>
      
      {!(feedback === 'correct' || feedback === 'surrender') && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => handleGoHomeConfirm()} style={backButtonStyle}>← TOPにもどる</button>
        </div>
      )}


      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} currentView="GAME" onLoginRequest={onLoginRequest} />
      )}

    </div>
  );
};

const effectOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, pointerEvents: 'none', background: 'rgba(0,0,0,0.08)' };
const containerStyle: React.CSSProperties = {
  fontFamily: "'Yomogi', cursive",
  background: 'linear-gradient(135deg, #FF9DE2 0%, #FFD6A5 50%, #FFFB8F 100%)',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: '84px',
  paddingLeft: '20px',
  paddingRight: '20px',
  paddingBottom: '100px',
  boxSizing: 'border-box',
  position: 'relative',
};
const stickyHeaderStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, height: '64px', background: 'linear-gradient(90deg, #FF6EC7 0%, #FF9A3C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', zIndex: 1000, boxShadow: '0 3px 12px rgba(0,0,0,0.18)' };
const headerTitleStyle: React.CSSProperties = { color: '#fff', fontSize: 'clamp(1.0em, 4.5vw, 1.5em)', margin: 0, textShadow: '1px 2px 0 rgba(0,0,0,0.18)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0, cursor: 'pointer' };
const headerIconsStyle: React.CSSProperties = { display: 'flex', gap: '4px', flexShrink: 0 };
const iconButtonStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.3em', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' };
const loginBadgeGuestStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.9)', borderRadius: '50%', width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.6em', fontWeight: 'bold', color: '#888', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', whiteSpace: 'nowrap', flexShrink: 0 };
const loginBadgeActiveStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.7)', border: '3px solid #2E86DE', borderRadius: '50%', width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#2E86DE', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', whiteSpace: 'nowrap', flexShrink: 0 };
const genreInfoStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', marginBottom: '10px', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: '50px', padding: '8px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '90%', maxWidth: '700px', boxSizing: 'border-box' };
const genreIconStyle: React.CSSProperties = { fontSize: '1.8em', marginRight: '8px' };
const genreNameStyle: React.CSSProperties = { fontSize: '1.1em', color: '#FF5FA0', margin: 0, fontWeight: 'bold', flexGrow: 1 };
const questionCountStyle: React.CSSProperties = { fontSize: '0.9em', color: '#fff', backgroundColor: '#FF6EC7', padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 3px 0 #D94FAA', whiteSpace: 'nowrap' };
const scoreStyle: React.CSSProperties = { fontSize: '0.9em', color: '#fff', backgroundColor: '#54A0FF', padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 3px 0 #2E86DE', whiteSpace: 'nowrap' };
const questionBoxStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '28px', padding: '28px', margin: '12px 0', boxShadow: '0 8px 24px rgba(255,100,180,0.15)', width: '90%', maxWidth: '700px', minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', boxSizing: 'border-box', gap: '14px', border: '3px solid rgba(255,255,255,0.8)' };
const questionTextStyle: React.CSSProperties = { fontSize: '1.2em', color: '#333', textAlign: 'center', fontWeight: 'bold', lineHeight: '1.5', margin: 0 };
const optionsContainerStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '90%', maxWidth: '700px', margin: '10px 0' };
const optionButtonStyle: React.CSSProperties = { padding: '18px 12px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.7)', fontSize: '1.3em', fontWeight: 'bold', color: '#fff', textAlign: 'center', transition: 'transform 0.1s', textShadow: '1px 1px 2px rgba(0,0,0,0.2)', boxShadow: '0 5px 0 rgba(0,0,0,0.15)' };
const actionButtonsContainerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', margin: '16px 0', width: '90%', maxWidth: '700px' };
const actionButtonStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)', color: 'white', padding: '14px 22px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #D94F9A', flex: '1 1 auto', minWidth: '110px', maxWidth: '160px' };
const surrenderButtonStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #FF4757, #FF6B81)', color: 'white', padding: '14px 22px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #C0392B', flex: '1 1 auto', minWidth: '110px', maxWidth: '160px' };
const hintTextStyle: React.CSSProperties = { fontSize: '1.05em', color: '#555', textAlign: 'center', margin: 0, padding: '8px 16px', backgroundColor: '#FFF9C4', borderRadius: '12px', width: '100%', boxSizing: 'border-box' as const, border: '2px solid #FFE066' };
const answerInBoxStyle: React.CSSProperties = { fontSize: '1.2em', fontWeight: 'bold', color: '#51CF66', textAlign: 'center', margin: 0, padding: '10px 16px', background: 'rgba(81,207,102,0.12)', borderRadius: '12px', width: '100%', boxSizing: 'border-box' as const, border: '2px dashed #51CF66' };
const handsFreeGuideStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '20px', padding: '20px', margin: '10px 0', width: '90%', maxWidth: '700px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' };
const conciergeMessageStyle: React.CSSProperties = { fontSize: '1.4em', color: '#FF5FA0', fontWeight: 'bold', margin: 0 };
const voiceCommandStyle: React.CSSProperties = { fontSize: '1.6em', color: '#333', fontWeight: 'bold', margin: 0 };
const voiceCommandExampleStyle: React.CSSProperties = { fontSize: '0.95em', color: '#666', margin: 0 };
const loadingStyle: React.CSSProperties = { fontSize: '2em', color: '#FF5FA0', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #FF9DE2 0%, #FFD6A5 50%, #FFFB8F 100%)', fontFamily: "'Yomogi', cursive" };
const titleStyle: React.CSSProperties = { color: '#fff', fontSize: '2.2em', marginTop: '20px', marginBottom: '30px', textAlign: 'center', textShadow: '2px 3px 0px #FF6BAE' };
const resultBoxStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '28px', padding: '30px', margin: '20px 0', boxShadow: '0 8px 24px rgba(255,100,180,0.2)', width: '90%', maxWidth: '700px', boxSizing: 'border-box', textAlign: 'center' };
const resultTextStyle: React.CSSProperties = { fontSize: '1.5em', color: '#333', margin: '10px 0' };
const resultActionButtonsStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '24px', width: '100%' };
const buttonStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)', color: 'white', padding: '14px 20px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #D94F9A' };
const backButtonStyle: React.CSSProperties = { background: '#ccc', color: '#555', padding: '14px 20px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #999' };
const wrongListContainerStyle: React.CSSProperties = { marginTop: '20px', marginBottom: '10px', textAlign: 'left', width: '100%' };
const wrongListTitleStyle: React.CSSProperties = { color: '#FF5FA0', fontSize: '1.1em', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' };
const wrongItemStyle: React.CSSProperties = { background: '#FFF3F7', border: '1.5px solid #FFB3D9', borderRadius: '14px', padding: '12px 16px', marginBottom: '10px' };
const wrongQuestionStyle: React.CSSProperties = { fontSize: '0.95em', color: '#444', margin: '0 0 6px 0', lineHeight: '1.5' };
const wrongAnswerStyle: React.CSSProperties = { fontSize: '1.05em', color: '#FF5FA0', margin: 0 };

export default GamePage;
