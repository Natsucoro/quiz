// src/components/GamePage/GamePage.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QuizData,
  QuizOption,
  getNextQuiz,
  getShuffledOptions,
  checkAnswer,
} from '../../services/quizEngine';
import { speak, stopSpeaking, toReadableText } from '../../services/speechSynthesis';
import { useHandsFree } from '../../hooks/useHandsFree';
import { useSettingsStore } from '../../store/settingsStore';
import { usePurchaseStore } from '../../store/purchaseStore';
import { useHistoryStore } from '../../store/historyStore';
import { useQuestionSettingsStore } from '../../store/questionSettingsStore';
import { trackEvent } from '../../services/analytics';
import { saveBestTimeMs, formatTime } from '../../services/bestTimeStore';
import type { QuizMode } from '../../types/quizMode';
import { SpriteIcon } from '../common/SpriteIcon';
import Header from '../common/Header/Header';
import ConfirmDialog from '../common/ConfirmDialog';
import ResultShare from '../common/ResultShare/ResultShare';
import { colors, fonts, rotatingColors, shadow } from '../../styles/theme';

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
import AiIcon from '../../assets/icons/ai.svg';
import DinosaurIcon from '../../assets/icons/texirano.svg';
import SpaceIcon from '../../assets/icons/space.svg';
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

// 画像検索(別タブ)用のURLを組み立てる。SafeSearchを常にonにして子ども向けに配慮する。
const buildImageSearchUrl = (term: string): string =>
  `https://www.google.com/search?tbm=isch&safe=active&q=${encodeURIComponent(term)}`;

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
  mode?: QuizMode;
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
  'AI・ロボット': 'エーアイ・ロボット',
  '恐竜': 'きょうりゅう',
  '宇宙・天体': 'うちゅう・てんたい',
};

// タイムアタックのペナルティ(クリアタイムに加算)。ヒント1回=+5秒、降参1問=+10秒。
const HINT_PENALTY_SEC = 5;
const SURRENDER_PENALTY_SEC = 10;

const GamePage: React.FC<GamePageProps> = ({ genre: selectedGenre, difficulty: selectedDifficulty, questionCount, mode = 'normal', onBack, onBackToDifficulty, onMicStatus, onLoginRequest }) => {
  const isTimeAttack = mode === 'timeattack';
  const { isMuted, setIsMuted, isHandsFree, setIsHandsFree } = useSettingsStore();
  const { isLoggedIn } = usePurchaseStore();
  const setHistoryResult = useHistoryStore((s) => s.setResult);
  const getDisabledSet = useQuestionSettingsStore((s) => s.getDisabledSet);
  const isHandsFreeMode = isHandsFree;
  const isSpeakingAllowed = true;

  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'surrender' | null>(null);
  const [showHint, setShowHint] = useState<number | null>(null);
  const [isQuizEnded, setIsQuizEnded] = useState(false);
  const [conciergeMessage, setConciergeMessage] = useState<string | null>(null);
  const [effectKey, setEffectKey] = useState<{ type: 'correct' | 'incorrect'; id: number } | null>(null);

  // タイムアタック用: 計測開始時刻・確定タイム・自己ベスト・更新フラグ・再描画用tick。
  const startTimeRef = useRef<number>(0);
  const endHandledRef = useRef(false);
  const [finalTimeMs, setFinalTimeMs] = useState<number | null>(null);
  const [bestTimeMs, setBestTimeMs] = useState<number | null>(null);
  const [isBestUpdated, setIsBestUpdated] = useState(false);
  // ペナルティ集計用: この試行で使ったヒント回数・降参問数。
  const hintsUsedRef = useRef(0);
  const surrendersUsedRef = useRef(0);
  const [penalty, setPenalty] = useState<{ rawMs: number; hints: number; surrenders: number } | null>(null);
  // 値自体は使わず、0.1秒ごとの再描画トリガーとしてのみ使う。
  const [, setNowTick] = useState(0);

  const quizSequenceRef = useRef<number>(0);
  // 循環依存を避けるためにhandlerをrefで保持
  const handleShowHintRef = useRef<(n: number) => void>(() => { });
  const handleSurrenderRef = useRef<() => void>(() => { });
  const handleAnswerRef = useRef<(ans: string) => void>(() => { });
  const handleNextQuestionRef = useRef<() => void>(() => { });
  const readQuestionRef = useRef<() => void>(() => { });

  const [isResultActionsVisible, setIsResultActionsVisible] = useState(false);
  const resultActionsRef = useRef<HTMLDivElement>(null);

  // 次の問題に進むたび、画面の一番上にスクロールし直す
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentQuestionIndex]);

  // クイズ終了画面に切り替わったときも一番上にスクロールし直す
  useEffect(() => {
    if (isQuizEnded) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [isQuizEnded]);

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

  const loadNextQuiz = useCallback(async (questionIndex: number) => {
    // 出題除外設定（この端末でオフにされた問題）も、既出問題と同様に候補から除外する
    const excludedIds = new Set([...playedIdsThisSession.current, ...getDisabledSet()]);
    const nextQuiz = await getNextQuiz(selectedGenre, selectedDifficulty, excludedIds);
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
  }, [selectedGenre, selectedDifficulty, getDisabledSet]);

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
    // タイム計測をリセットして開始。
    startTimeRef.current = Date.now();
    endHandledRef.current = false;
    hintsUsedRef.current = 0;
    surrendersUsedRef.current = 0;
    setFinalTimeMs(null);
    setPenalty(null);
    setIsBestUpdated(false);
    loadNextQuiz(0);
    initializedRef.current = true;
    trackEvent('quiz_start', { genre: selectedGenre, difficulty: selectedDifficulty });
  }, [selectedGenre, selectedDifficulty, loadNextQuiz]);

  // タイムアタック中はライブタイマーを動かす(0.1秒ごとに再描画)。
  useEffect(() => {
    if (!isTimeAttack || isQuizEnded) return;
    const id = window.setInterval(() => setNowTick((t) => t + 1), 100);
    return () => window.clearInterval(id);
  }, [isTimeAttack, isQuizEnded]);

  // クイズ終了時、タイムアタックなら確定タイムを計算して自己ベストを保存する(1回だけ)。
  useEffect(() => {
    if (!isTimeAttack) return;
    if (isQuizEnded && !endHandledRef.current) {
      endHandledRef.current = true;
      const rawMs = Date.now() - startTimeRef.current;
      const hints = hintsUsedRef.current;
      const surrenders = surrendersUsedRef.current;
      // クリアタイム = 素タイム + ヒント/降参ペナルティ。
      const penaltyMs = (hints * HINT_PENALTY_SEC + surrenders * SURRENDER_PENALTY_SEC) * 1000;
      const t = rawMs + penaltyMs;
      setFinalTimeMs(t);
      setPenalty({ rawMs, hints, surrenders });
      const { updated, best } = saveBestTimeMs(selectedGenre, selectedDifficulty, questionCount, t);
      setBestTimeMs(best);
      setIsBestUpdated(updated);
      trackEvent('time_attack_finish', {
        genre: selectedGenre, difficulty: selectedDifficulty,
        question_count: questionCount, time_ms: Math.round(t), is_best: updated,
      });
    } else if (!isQuizEnded) {
      endHandledRef.current = false;
    }
  }, [isTimeAttack, isQuizEnded, selectedGenre, selectedDifficulty, questionCount]);

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
        setScore(s => {
          trackEvent('quiz_complete', { genre: selectedGenre, difficulty: selectedDifficulty, score: s, question_count: questionCount });
          if (!isMutedRef.current && isSpeakingAllowed) {
            speak(`クイズ終了です。あなたのスコアは${s}点でした。`);
          }
          return s;
        });
      } else {
        quizSequenceRef.current = 0;
        setFeedback(null);
        setShowHint(null);
        setConciergeMessage(null);
        loadNextQuiz(next);
      }
      return next;
    });
  }, [isSpeakingAllowed, loadNextQuiz, questionCount, selectedGenre, selectedDifficulty]);

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
    setHistoryResult(currentQuiz.id, selectedGenre, selectedDifficulty, correct);
    trackEvent('question_answered', { genre: selectedGenre, difficulty: selectedDifficulty, quiz_id: currentQuiz.id, is_correct: correct });
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
  }, [currentQuiz, feedback, isMuted, isSpeakingAllowed, playSound, setHistoryResult, selectedGenre, selectedDifficulty]);

  handleAnswerRef.current = handleAnswer;

  const handleSurrender = useCallback(() => {
    if (!currentQuiz || feedback === 'correct' || feedback === 'surrender') return;
    quizSequenceRef.current++;
    playSound('correct');
    setHistoryResult(currentQuiz.id, selectedGenre, selectedDifficulty, false);
    trackEvent('surrender', { genre: selectedGenre, difficulty: selectedDifficulty, quiz_id: currentQuiz.id });
    surrendersUsedRef.current++;
    setFeedback('surrender');
    if (!wrongQuizzesRef.current.find(q => q.id === currentQuiz.id)) {
      wrongQuizzesRef.current = [...wrongQuizzesRef.current, currentQuiz];
    }
    if (!isMuted && isSpeakingAllowed) {
      const ans = toReadableText(currentQuiz.answerReading ?? currentQuiz.answer);
      speak(`答えは${ans}です。`);
    }
  }, [currentQuiz, feedback, isMuted, isSpeakingAllowed, playSound, setHistoryResult, selectedGenre, selectedDifficulty]);

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
    hintsUsedRef.current++;
    trackEvent('hint_used', { genre: selectedGenre, difficulty: selectedDifficulty, quiz_id: currentQuiz.id, hint_number: hintNumber });
    if (!isMuted && isSpeakingAllowed) {
      const readableHint = hintNumber === 1
        ? toReadableText(currentQuiz.hint1Ruby || currentQuiz.hint1)
        : hintText;
      speak(`ヒント${hintNumber}：${readableHint}`);
      setConciergeMessage(null);
    }
  }, [currentQuiz, isHandsFreeMode, isMuted, isSpeakingAllowed, selectedGenre, selectedDifficulty]);

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

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleGoHomeConfirm = () => {
    setShowExitConfirm(true);
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    stopSpeaking();
    onBack();
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
      case 'AI・ロボット': return <img src={AiIcon} alt="AI・ロボット" style={iconStyle} />;
      case '恐竜': return <img src={DinosaurIcon} alt="恐竜" style={iconStyle} />;
      case '宇宙・天体': return <img src={SpaceIcon} alt="宇宙・天体" style={iconStyle} />;
      default: return '❓';
    }
  };

  if (!currentQuiz && !isQuizEnded) {
    return <div style={loadingStyle}>問題を読み込み中...</div>;
  }

  const stickyHeader = (
    <Header
      onLoginRequest={() => onLoginRequest?.()}
      onTitleClick={handleGoHomeConfirm}
      currentView="GAME"
    />
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
              backgroundColor: [colors.primary, colors.secondary, colors.tertiary, colors.violet][Math.floor(Math.random() * 4)],
              animationDuration: `${1 + Math.random()}s`,
            }} />
          </div>
        ))}

        <h2 style={{ ...titleStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <img src={FlagIcon} alt="flag" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          結果発表
          <img src={FlagIcon} alt="flag" style={{ width: '40px', height: '40px', objectFit: 'contain', transform: 'scaleX(-1)' }} />
        </h2>
        <p style={resultGenreLevelStyle}>
          <ruby>{selectedGenre}<rt style={{ fontSize: '0.6em', fontWeight: 'normal' }}>{GENRE_RUBY[selectedGenre] ?? ''}</rt></ruby>
          <span style={difficultyInlineBadgeStyle}>Lv.{selectedDifficulty}</span>
        </p>

        <div style={resultBoxStyle}>
          {/* タイムアタック: クリアタイムを主役として表示 */}
          {isTimeAttack && finalTimeMs !== null && (
            <div style={timeResultBoxStyle}>
              <p style={timeResultLabelStyle}>⏱️ クリアタイム</p>
              <p style={timeResultValueStyle}>{formatTime(finalTimeMs)}</p>
              {penalty && (penalty.hints > 0 || penalty.surrenders > 0) && (
                <p style={penaltyBreakdownStyle}>
                  素タイム {formatTime(penalty.rawMs)}
                  {penalty.hints > 0 && ` ＋ヒント${penalty.hints}回(+${penalty.hints * HINT_PENALTY_SEC}秒)`}
                  {penalty.surrenders > 0 && ` ＋降参${penalty.surrenders}問(+${penalty.surrenders * SURRENDER_PENALTY_SEC}秒)`}
                </p>
              )}
              {isBestUpdated ? (
                <p style={bestUpdatedStyle}>🎉 自己ベスト更新！</p>
              ) : bestTimeMs !== null ? (
                <p style={bestTimeTextStyle}>自己ベスト: {formatTime(bestTimeMs)}</p>
              ) : null}
            </div>
          )}

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

          <div style={statsRowStyle}>
            <div style={statBoxStyle}>
              <span style={statLabelStyle}>正解数</span>
              <span style={statValueStyle}>{score}<span style={statUnitStyle}> / {questionCount}</span></span>
            </div>
            <div style={{ ...statBoxStyle, background: 'linear-gradient(135deg, #FFF0F5 0%, #FFE3EE 100%)' }}>
              <span style={statLabelStyle}>正解率</span>
              <span style={{ ...statValueStyle, color: colors.primaryDark }}>{accuracy.toFixed(0)}<span style={statUnitStyle}>%</span></span>
            </div>
          </div>

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

          <ResultShare
            genre={selectedGenre}
            difficulty={selectedDifficulty}
            mode={mode}
            score={score}
            questionCount={questionCount}
            accuracy={accuracy}
            timeMs={isTimeAttack ? finalTimeMs : null}
            isBest={isBestUpdated}
          />

        </div>

        <div ref={resultActionsRef} style={{ ...resultActionButtonsStyle, width: '90%', maxWidth: '700px' }}>
          <button className="shine-button" onClick={onBackToDifficulty} style={buttonStyle}>べつのレベルへ →</button>
          <button onClick={onBack} style={buttonStyle}>べつのジャンルへ →</button>
          <button onClick={() => { playedIdsThisSession.current = new Set(); wrongQuizzesRef.current = []; setCurrentQuestionIndex(0); setScore(0); startTimeRef.current = Date.now(); endHandledRef.current = false; hintsUsedRef.current = 0; surrendersUsedRef.current = 0; setFinalTimeMs(null); setPenalty(null); setIsBestUpdated(false); setIsQuizEnded(false); loadNextQuiz(0); }} style={{ ...buttonStyle, background: `linear-gradient(135deg, ${colors.tertiary}, #FFD9A0)`, color: '#8A5A2B', boxShadow: `0 5px 0 ${colors.tertiaryDark}` }}>もういちど</button>
          <button onClick={onBack} style={backButtonStyle}>← TOPにもどる</button>
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
            flexDirection: 'column',
            gap: '10px'
          }}>
            <button
              onClick={onBack}
              style={{
                ...backButtonStyle,
                flex: 1,
                fontSize: '0.9em',
                padding: '12px 8px',
                boxShadow: '0 6px 15px rgba(74,68,88,0.15)'
              }}
            >
              ← TOPにもどる
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

        {showExitConfirm && (
          <ConfirmDialog
            message={'クイズを中断しますか？\nスコアはリセットされます。'}
            confirmLabel="中断する"
            cancelLabel="つづける"
            onConfirm={handleConfirmExit}
            onCancel={() => setShowExitConfirm(false)}
          />
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
        @keyframes optionPop { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .option-pop { animation: optionPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards; }
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
            <svg width="180" height="180" style={{ animation: 'popFade 0.8s ease-out forwards', filter: 'drop-shadow(0 6px 20px rgba(74,68,88,0.35))' }} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" stroke={colors.success} strokeWidth="12" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="180" height="180" style={{ animation: 'popFade 0.8s ease-out forwards', filter: 'drop-shadow(0 6px 20px rgba(74,68,88,0.35))' }} viewBox="0 0 100 100">
              <line x1="20" y1="20" x2="80" y2="80" stroke={colors.danger} strokeWidth="12" strokeLinecap="round" />
              <line x1="80" y1="20" x2="20" y2="80" stroke={colors.danger} strokeWidth="12" strokeLinecap="round" />
            </svg>
          )}
        </div>
      )}
      {stickyHeader}

      <div style={genreInfoStyle}>
        <span style={genreIconStyle}>{getGenreIcon(selectedGenre)}</span>
        <h2 style={genreNameStyle}>
          <ruby>{selectedGenre}<rt style={{ fontSize: '0.6em', fontWeight: 'normal' }}>{GENRE_RUBY[selectedGenre] ?? ''}</rt></ruby>
          <span style={difficultyInlineBadgeStyle}>Lv.{selectedDifficulty}</span>
        </h2>
        <div style={metaBadgesStyle}>
          <span style={questionCountStyle}>{currentQuestionIndex + 1}/{questionCount}問</span>
          <span style={scoreStyle}>スコア: {score}</span>
          {isTimeAttack && (
            <span style={timerBadgeStyle}>⏱️ {formatTime(Date.now() - startTimeRef.current)}</span>
          )}
        </div>
      </div>

      <div key={`q-${currentQuiz?.id}`} style={{ ...questionBoxStyle, animation: 'screenIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
        {currentQuiz?.categories && currentQuiz.categories.length > 0 && (
          <div style={categoryBadgeRowStyle}>
            {currentQuiz.categories.map((cat) => (
              <span key={cat} style={categoryBadgeStyle}>{cat}</span>
            ))}
          </div>
        )}
        <p style={questionTextStyle}>{renderRuby(currentQuiz?.questionRuby || currentQuiz?.question || '')}</p>
        {/* 一度見たヒントは、次のヒントに進んでも・答えが表示されても消さずに積み上げて表示する */}
        {showHint !== null && showHint >= 1 && currentQuiz && (
          <p style={hintTextStyle}>ヒント1: {renderRuby(currentQuiz.hint1Ruby || currentQuiz.hint1)}</p>
        )}
        {showHint !== null && showHint >= 2 && currentQuiz && (
          <p style={hintTextStyle}>ヒント2: {(currentQuiz as any).hint2}</p>
        )}
        {showHint !== null && showHint >= 3 && currentQuiz && (
          <p style={hintTextStyle}>ヒント3: {(currentQuiz as any).hint3}</p>
        )}
        {(feedback === 'correct' || feedback === 'surrender') && currentQuiz && (
          <p style={answerInBoxStyle}>
            答え「{currentQuiz.answer}」
            <button
              onClick={() => {
                trackEvent('image_search_click', { genre: selectedGenre, difficulty: selectedDifficulty, quiz_id: currentQuiz.id, source: 'answer' });
                window.open(buildImageSearchUrl(currentQuiz.answer), '_blank', 'noopener,noreferrer');
              }}
              style={imageSearchLinkStyle}
            >
              🔍 画像で見る
            </button>
          </p>
        )}
        {!(feedback === 'correct' || feedback === 'surrender') && showHint === null && (
          <button onClick={() => handleShowHint(1)} style={{ ...actionButtonStyle, backgroundColor: showHint === 1 ? colors.warning : colors.primary, width: '100%', maxWidth: '100%', boxSizing: 'border-box' } as React.CSSProperties}>
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
        <div key={`opts-${currentQuiz?.id}`} style={optionsContainerStyle}>
          {options.map((option, index) => {
            const isCorrectOption = option.text === currentQuiz?.answer;
            const isRevealed = feedback === 'correct' || feedback === 'surrender';
            const bg = isRevealed ? (isCorrectOption ? colors.success : colors.lock) : rotatingColors[index % rotatingColors.length];
            return (
              <button
                key={index}
                className="option-pop"
                onClick={() => {
                  if (isRevealed) {
                    trackEvent('image_search_click', { genre: selectedGenre, difficulty: selectedDifficulty, quiz_id: currentQuiz?.id ?? '', source: 'option' });
                    window.open(buildImageSearchUrl(option.text), '_blank', 'noopener,noreferrer');
                  } else {
                    handleAnswer(option.text);
                  }
                }}
                title={isRevealed ? `「${option.text}」の画像を見る` : undefined}
                style={{
                  ...optionButtonStyle,
                  backgroundColor: bg,
                  cursor: 'pointer',
                  position: 'relative', // 番号配置用
                  animationDelay: `${index * 0.05}s`,
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
                {renderRuby(option.ruby || option.text)}
                {isRevealed && <span style={imageSearchBadgeStyle}>🔍</span>}
              </button>
            );
          })}
        </div>
      )}

      <div style={actionButtonsContainerStyle}>
        {!isHandsFreeMode && (feedback === 'correct' || feedback === 'surrender') && (
          <button onClick={handleNextQuestion} style={{ ...actionButtonStyle, background: colors.successGradient, boxShadow: `0 5px 0 ${colors.successDark}`, flex: '1 1 100%', maxWidth: '100%' }}>
            つぎのもんだいへ →
          </button>
        )}
        {isHandsFreeMode && (
          <>
            <button onClick={() => handleShowHint(1)} style={{ ...actionButtonStyle, backgroundColor: showHint === 1 ? colors.warning : colors.primary } as React.CSSProperties}>
              ヒント1
            </button>
            <button onClick={() => handleShowHint(2)} style={{ ...actionButtonStyle, backgroundColor: showHint === 2 ? colors.warning : colors.primary } as React.CSSProperties}>
              ヒント2
            </button>
            <button onClick={() => handleShowHint(3)} style={{ ...actionButtonStyle, backgroundColor: showHint === 3 ? colors.warning : colors.primary } as React.CSSProperties}>
              ヒント3
            </button>
          </>
        )}
        <button onClick={handleSurrender} style={{ ...surrenderButtonStyle, display: (feedback === 'correct' || feedback === 'surrender') ? 'none' : undefined, flex: '1 1 100%', maxWidth: '100%' }}>こうさん</button>
      </div>

      {!(feedback === 'correct' || feedback === 'surrender') && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', width: '90%', maxWidth: '700px' }}>
          <button onClick={() => handleGoHomeConfirm()} style={{ ...backButtonStyle, width: '100%' }}>← TOPにもどる</button>
        </div>
      )}

      {showExitConfirm && (
        <ConfirmDialog
          message={'クイズを中断しますか？\nスコアはリセットされます。'}
          confirmLabel="中断する"
          cancelLabel="つづける"
          onConfirm={handleConfirmExit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
};

const effectOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, pointerEvents: 'none', background: 'rgba(74,68,88,0.08)' };
const containerStyle: React.CSSProperties = {
  fontFamily: fonts.body,
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
const genreInfoStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', rowGap: '8px', marginTop: '10px', marginBottom: '10px', backgroundColor: colors.surfaceSoft, borderRadius: '26px', padding: '10px 18px', boxShadow: shadow.sm, width: '90%', maxWidth: '700px', boxSizing: 'border-box' };
// 問数・スコア・タイマーのバッジ群。狭い画面では折り返して見切れないようにする。
const metaBadgesStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '8px' };
const genreIconStyle: React.CSSProperties = { fontSize: '1.8em', marginRight: '8px' };
const genreNameStyle: React.CSSProperties = { fontSize: '1.1em', color: colors.primaryDark, fontFamily: fonts.heading, margin: 0, fontWeight: 'bold', flexGrow: 1, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' };
const difficultyInlineBadgeStyle: React.CSSProperties = { fontSize: '0.7em', color: '#fff', backgroundColor: colors.tertiaryDark, padding: '2px 9px', borderRadius: '50px', fontWeight: 'bold', whiteSpace: 'nowrap' };
const questionCountStyle: React.CSSProperties = { fontSize: '0.9em', color: '#fff', backgroundColor: colors.primary, padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold', boxShadow: `0 3px 0 ${colors.primaryDark}`, whiteSpace: 'nowrap' };
const scoreStyle: React.CSSProperties = { fontSize: '0.9em', color: '#fff', backgroundColor: colors.secondary, padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold', boxShadow: `0 3px 0 ${colors.secondaryDark}`, whiteSpace: 'nowrap' };
const timerBadgeStyle: React.CSSProperties = { fontSize: '0.9em', color: '#fff', backgroundColor: colors.tertiary, padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold', boxShadow: `0 3px 0 ${colors.tertiaryDark}`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const timeResultBoxStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #FFF6E9 0%, #FFEFD6 100%)', borderRadius: '20px', padding: '16px 20px', marginBottom: '20px', border: `2px solid ${colors.tertiary}` };
const timeResultLabelStyle: React.CSSProperties = { margin: '0 0 4px', color: colors.tertiaryDark, fontWeight: 'bold', fontSize: '0.95em' };
const timeResultValueStyle: React.CSSProperties = { margin: '0', color: colors.primaryDark, fontFamily: fonts.heading, fontWeight: 800, fontSize: '2.4em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' };
const bestUpdatedStyle: React.CSSProperties = { margin: '8px 0 0', color: colors.secondaryDark, fontWeight: 'bold', fontSize: '1.05em' };
const bestTimeTextStyle: React.CSSProperties = { margin: '8px 0 0', color: colors.inkSoft, fontWeight: 'bold', fontSize: '0.9em' };
const penaltyBreakdownStyle: React.CSSProperties = { margin: '6px 0 0', color: colors.inkSoft, fontSize: '0.8em', lineHeight: 1.5 };
const questionBoxStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '28px', padding: '28px', margin: '12px 0', boxShadow: shadow.md, width: '90%', maxWidth: '700px', minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', boxSizing: 'border-box', gap: '14px', border: '3px solid rgba(255,255,255,0.8)' };
const categoryBadgeRowStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginBottom: '-6px' };
const categoryBadgeStyle: React.CSSProperties = { fontSize: '0.7em', fontWeight: 'bold', color: colors.tertiaryDark, background: '#FFF3E0', border: `1.5px solid ${colors.tertiary}`, borderRadius: '50px', padding: '2px 10px', whiteSpace: 'nowrap' };
const questionTextStyle: React.CSSProperties = { fontSize: '1.2em', color: colors.ink, textAlign: 'center', fontWeight: 'bold', lineHeight: '1.5', margin: 0 };
const optionsContainerStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '90%', maxWidth: '700px', margin: '10px 0' };
const optionButtonStyle: React.CSSProperties = { padding: '16px 12px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.7)', fontSize: '1.05em', fontWeight: 'bold', color: '#fff', textAlign: 'center', transition: 'transform 0.1s', textShadow: '1px 1px 2px rgba(0,0,0,0.2)', boxShadow: '0 5px 0 rgba(74,68,88,0.15)' };
const actionButtonsContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0', width: '90%', maxWidth: '700px' };
const actionButtonStyle: React.CSSProperties = { background: colors.actionGradient, color: 'white', padding: '14px 22px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: `0 5px 0 ${colors.primaryDark}`, width: '100%' };
const surrenderButtonStyle: React.CSSProperties = { background: colors.dangerGradient, color: 'white', padding: '14px 22px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: `0 5px 0 ${colors.dangerDark}`, width: '100%' };
const hintTextStyle: React.CSSProperties = { fontSize: '1.05em', color: colors.ink, textAlign: 'center', margin: 0, padding: '8px 16px', backgroundColor: '#FFF3D6', borderRadius: '12px', width: '100%', boxSizing: 'border-box' as const, border: `2px solid ${colors.warning}` };
const answerInBoxStyle: React.CSSProperties = { fontSize: '1.2em', fontWeight: 'bold', color: colors.successDark, textAlign: 'center', margin: 0, padding: '10px 16px', background: 'rgba(61,201,176,0.12)', borderRadius: '12px', width: '100%', boxSizing: 'border-box' as const, border: `2px dashed ${colors.success}` };
// 答え・選択肢から画像検索(別タブ)へ飛ぶリンク/バッジ
const imageSearchLinkStyle: React.CSSProperties = { display: 'block', margin: '8px auto 0', fontSize: '0.7em', fontWeight: 'bold', color: '#fff', background: colors.tertiary, padding: '6px 14px', borderRadius: '50px', border: '2px solid #fff', boxShadow: `0 3px 0 ${colors.tertiaryDark}`, cursor: 'pointer', animation: 'optionPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.15s backwards' };
const imageSearchBadgeStyle: React.CSSProperties = { position: 'absolute', bottom: '-9px', right: '-9px', width: '30px', height: '30px', minWidth: '30px', minHeight: '30px', borderRadius: '50%', background: '#fff', border: `2px solid ${colors.tertiaryDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1em', boxShadow: shadow.sm, pointerEvents: 'none', animation: 'optionPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards' };
const handsFreeGuideStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '20px', padding: '20px', margin: '10px 0', width: '90%', maxWidth: '700px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' };
const conciergeMessageStyle: React.CSSProperties = { fontSize: '1.4em', color: colors.primaryDark, fontWeight: 'bold', margin: 0 };
const voiceCommandStyle: React.CSSProperties = { fontSize: '1.6em', color: colors.ink, fontWeight: 'bold', margin: 0 };
const voiceCommandExampleStyle: React.CSSProperties = { fontSize: '0.95em', color: colors.inkSoft, margin: 0 };
const loadingStyle: React.CSSProperties = { fontSize: '2em', color: colors.primaryDark, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: fonts.heading };
// 明るいクリーム系の背景に白文字だと見えにくいため、ブランドピンク＋白フチで
// コントラストを確保する(TOPページの見出しと同じ可読パターン)。
const titleStyle: React.CSSProperties = { color: colors.primaryDark, fontFamily: fonts.heading, fontSize: '2.2em', marginTop: '20px', marginBottom: '30px', textAlign: 'center', textShadow: '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 0 4px 8px rgba(74,68,88,0.18)' };
const resultBoxStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '28px', padding: '30px', boxShadow: shadow.lg, width: '90%', maxWidth: '700px', boxSizing: 'border-box', textAlign: 'center' };
const statsRowStyle: React.CSSProperties = { display: 'flex', gap: '12px', justifyContent: 'center', margin: '4px 0 18px' };
const statBoxStyle: React.CSSProperties = { flex: 1, maxWidth: '200px', background: 'linear-gradient(135deg, #F3FBF8 0%, #E6F7F1 100%)', borderRadius: '18px', padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' };
const statLabelStyle: React.CSSProperties = { fontSize: '0.85em', color: colors.inkSoft, fontWeight: 'bold' };
const statValueStyle: React.CSSProperties = { fontSize: '2em', color: colors.secondaryDark, fontFamily: fonts.heading, fontWeight: 800, lineHeight: 1 };
const statUnitStyle: React.CSSProperties = { fontSize: '0.5em', color: colors.inkSoft, fontWeight: 'bold' };
const resultGenreLevelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1.1em', color: colors.primaryDark, fontFamily: fonts.heading, fontWeight: 'bold', margin: '0 0 8px' };
const resultActionButtonsStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '24px', width: '100%' };
const buttonStyle: React.CSSProperties = { background: colors.actionGradient, color: 'white', padding: '14px 20px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: `0 5px 0 ${colors.primaryDark}` };
const backButtonStyle: React.CSSProperties = { background: '#E4DEE8', color: colors.ink, padding: '14px 20px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #C7BFCF' };
const wrongListContainerStyle: React.CSSProperties = { marginTop: '20px', marginBottom: '10px', textAlign: 'left', width: '100%' };
const wrongListTitleStyle: React.CSSProperties = { color: colors.primaryDark, fontSize: '1.1em', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' };
const wrongItemStyle: React.CSSProperties = { background: '#FFF3F7', border: `1.5px solid ${colors.primary}55`, borderRadius: '14px', padding: '12px 16px', marginBottom: '10px' };
const wrongQuestionStyle: React.CSSProperties = { fontSize: '0.95em', color: colors.ink, margin: '0 0 6px 0', lineHeight: '1.5' };
const wrongAnswerStyle: React.CSSProperties = { fontSize: '1.05em', color: colors.primaryDark, margin: 0 };

export default GamePage;
