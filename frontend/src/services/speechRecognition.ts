
// src/services/speechRecognition.ts

interface SpeechRecognitionService {
  start: () => void;
  stop: () => void;
  isRecognizing: () => boolean;
  onResult: (callback: (transcript: string) => void) => void;
  onError: (callback: (error: SpeechRecognitionErrorEvent) => void) => void;
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

let recognition: SpeechRecognition | null = null;
let recognizing = false;
let resultCallback: ((transcript: string) => void) | null = null;
let errorCallback: ((error: SpeechRecognitionErrorEvent) => void) | null = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true; // 継続的に認識
  recognition.interimResults = false; // 暫定結果は不要
  recognition.lang = 'ja-JP'; // 日本語

  recognition.onstart = () => {
    recognizing = true;
    console.log('音声認識開始...');
  };

  recognition.onend = () => {
    recognizing = false;
    console.log('音声認識停止。再起動します...');
    // 自動再起動 (ハンズフリーモードでの常時ONを想定)
    if (recognizing) { // 手動で停止されていない限り
        recognition?.start();
    }
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.trim();
    console.log('認識結果:', transcript);
    if (resultCallback) {
      resultCallback(transcript);
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
};

/**
 * 認識されたテキストからコマンドを判定します。
 * @param transcript 認識されたテキスト
 * @returns 検出されたコマンド名 ('hint1', 'hint2', 'hint3', 'surrender', 'repeatQuestion', null)
 */
export const detectVoiceCommand = (transcript: string): string | null => {
  const lowerTranscript = transcript.toLowerCase();

  if (lowerTranscript.includes('ヒント1') || lowerTranscript.includes('ヒントいち')) {
    return 'hint1';
  }
  if (lowerTranscript.includes('ヒント2') || lowerTranscript.includes('ヒントに')) {
    return 'hint2';
  }
  if (lowerTranscript.includes('ヒント3') || lowerTranscript.includes('ヒントさん')) {
    return 'hint3';
  }
  if (
    lowerTranscript.includes('降参') ||
    lowerTranscript.includes('答え') ||
    lowerTranscript.includes('わからない') ||
    lowerTranscript.includes('わからん')
  ) {
    return 'surrender';
  }
  if (lowerTranscript.includes('問題') || lowerTranscript.includes('もういちど')) {
    return 'repeatQuestion';
  }

  return null;
};
