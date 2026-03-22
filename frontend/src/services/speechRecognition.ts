
// src/services/speechRecognition.ts

interface SpeechRecognitionService {
  start: () => void;
  stop: () => void;
  isRecognizing: () => boolean;
  onResult: (callback: (transcript: string, isFinal: boolean) => void) => void;
  onError: (callback: (error: SpeechRecognitionErrorEvent) => void) => void;
  onRecognizingChange: (callback: (recognizing: boolean) => void) => void;
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

let recognition: SpeechRecognition | null = null;
let recognizing = false;
let resultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
let errorCallback: ((error: SpeechRecognitionErrorEvent) => void) | null = null;
let recognizingChangeCallback: ((recognizing: boolean) => void) | null = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    recognition.onstart = () => {
      recognizing = true;
      recognizingChangeCallback?.(true);
      console.log('音声認識開始...');
    };

    recognition.onend = () => {
      console.log('音声認識停止。再起動します...');
      // 自動再起動 (手動でstop()を呼んだ場合はrecognizing=falseになっている)
      if (recognizing) {
          recognition?.start();
      }
      recognizing = false;
      recognizingChangeCallback?.(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const transcript = result[0].transcript.trim();
      const isFinal = result.isFinal;
      console.log('認識結果:', transcript, isFinal ? '(確定)' : '(途中)');
      if (resultCallback) {
        resultCallback(transcript, isFinal);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('音声認識エラー:', event.error);
      recognizing = false;
      if (errorCallback) {
        errorCallback(event);
      }
      // エラー後も自動再起動を試みる
      if (recognition && event.error !== 'not-allowed') { // 権限エラー以外
          recognition.start();
      }
    };
  }
} else {
  console.warn('Web Speech API (SpeechRecognition) はこのブラウザでサポートされていません。');
}

export const speechRecognitionService: SpeechRecognitionService = {
  start: () => {
    if (recognition && !recognizing) {
      try {
        recognition.start();
        recognizing = true;
      } catch (e) {
        console.error("音声認識の開始に失敗しました。", e);
      }
    }
  },
  stop: () => {
    if (recognition && recognizing) {
      recognition.stop();
      recognizing = false;
    }
  },
  isRecognizing: () => recognizing,
  onResult: (callback) => {
    resultCallback = callback;
  },
  onError: (callback) => {
    errorCallback = callback;
  },
  onRecognizingChange: (callback) => {
    recognizingChangeCallback = callback;
  },
};

/**
 * 認識されたテキストからコマンドを判定します。
 * @param transcript 認識されたテキスト
 * @returns 検出されたコマンド名 ('hint1', 'hint2', 'hint3', 'surrender', 'repeatQuestion', null)
 */
// ジャンルのよみがな→ジャンル名マッピング
export const GENRE_READING_MAP: Record<string, string> = {
  'どうぶつ': '動物',
  'こんちゅう': '昆虫',
  'しょくぶつ': '植物',
  'さかな': '魚類',
  'とり': '鳥類',
  'は虫類': '爬虫類',
  'はちゅうるい': '爬虫類',
  'ほにゅうるい': '哺乳類',
  'かいようせいぶつ': '海洋生物',
};

export const detectVoiceCommand = (transcript: string): string | null => {
  const t = transcript.toLowerCase();

  if (t.includes('ヒント1') || t.includes('ヒントいち')) return 'hint1';
  if (t.includes('ヒント2') || t.includes('ヒントに')) return 'hint2';
  if (t.includes('ヒント3') || t.includes('ヒントさん')) return 'hint3';
  if (t.includes('降参') || t.includes('答え') || t.includes('わからない') || t.includes('わからん')) return 'surrender';
  if (t.includes('問題') || t.includes('もういちど')) return 'repeatQuestion';

  // ジャンル選択
  for (const [reading, genre] of Object.entries(GENRE_READING_MAP)) {
    if (t.includes(reading)) return `genre:${genre}`;
  }

  return null;
};
