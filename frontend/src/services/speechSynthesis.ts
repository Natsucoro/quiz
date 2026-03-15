
// src/services/speechSynthesis.ts

const DEFAULT_SPEECH_RATE = 1.0;
const SPEECH_RATE_STORAGE_KEY = 'quizAppSpeechRate';

let utterance: SpeechSynthesisUtterance | null = null;
let currentVoice: SpeechSynthesisVoice | null = null;
let speechRate: number = parseFloat(localStorage.getItem(SPEECH_RATE_STORAGE_KEY) || String(DEFAULT_SPEECH_RATE));
let voices: SpeechSynthesisVoice[] = [];

// 音声リストの準備
const loadVoices = () => {
  voices = window.speechSynthesis.getVoices();
  // 日本語の声を優先的に選択
  currentVoice = voices.find(voice => voice.lang === 'ja-JP') || voices[0];
};

if (typeof window !== 'undefined' && window.speechSynthesis) {
  // ボイスがロードされたら更新
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
  // ページロード時に既にボイスが利用可能な場合
  if (window.speechSynthesis.getVoices().length > 0) {
    loadVoices();
  }
}

/**
 * 音声コンテキストを初期化（アンロック）します。
 * iOS Safariなどのブラウザ制限対策として、ユーザー操作によって一度音声再生をトリガーする必要があります。
 */
export const unlockAudioContext = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // 既に初期化済みか、ユーザー操作以外で呼ばれた場合は何もしない
  if (window.speechSynthesis.speaking || utterance) return;

  // 短い無音またはごく短い音声でAudioContextをアクティブにする
  const dummyUtterance = new SpeechSynthesisUtterance(' '); // 空白でもOKだが、念のため
  dummyUtterance.volume = 0; // 無音にする
  dummyUtterance.rate = 1;
  dummyUtterance.pitch = 1;
  dummyUtterance.lang = 'ja-JP';

  window.speechSynthesis.speak(dummyUtterance);

  // iOS Safariではutterance.onendが呼ばれないことがあるため、setTimeoutで強制的に停止
  setTimeout(() => {
    window.speechSynthesis.cancel();
    console.log("AudioContext unlocked.");
  }, 100); // わずかな時間で停止
};


/**
 * 指定されたテキストを読み上げます。
 * @param text 読み上げるテキスト
 */
export const speak = (text: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // 既に読み上げ中の場合はキャンセル
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP'; // 日本語を指定
  utterance.rate = speechRate;
  if (currentVoice) {
    utterance.voice = currentVoice;
  }

  utterance.onend = () => {
    utterance = null;
  };

  utterance.onerror = (event) => {
    console.error('SpeechSynthesisUtterance.onerror', event);
    utterance = null;
  };

  window.speechSynthesis.speak(utterance);
};

/**
 * 現在の読み上げを停止します。
 */
export const stopSpeaking = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  utterance = null;
};

/**
 * 読み上げ速度を設定し、localStorageに保存します。
 * @param rate 読み上げ速度 (0.1〜10.0、今回は0.5〜2.0を想定)
 */
export const setSpeechRate = (rate: number) => {
  if (typeof window === 'undefined') return;
  speechRate = rate;
  localStorage.setItem(SPEECH_RATE_STORAGE_KEY, String(rate));
  if (utterance) {
    utterance.rate = rate; // 読み上げ中でも適用
  }
};

/**
 * 現在の読み上げ速度を取得します。
 * @returns number 読み上げ速度
 */
export const getSpeechRate = (): number => {
  return speechRate;
};

/**
 * 現在読み上げ中かどうかを返します。
 */
export const isSpeaking = (): boolean => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking;
};
