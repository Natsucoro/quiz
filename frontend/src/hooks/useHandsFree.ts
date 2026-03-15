
// src/hooks/useHandsFree.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { speechRecognitionService, detectVoiceCommand } from '../services/speechRecognition';
import { speak, stopSpeaking } from '../services/speechSynthesis';

interface UseHandsFreeOptions {
  isHandsFreeMode: boolean;
  onVoiceCommand: (command: string, transcript?: string) => void;
  onSilenceDetected?: (seconds: number) => void;
  currentQuestion?: string; // 問題文の読み上げ用
  isSpeakingAllowed: boolean; // ユーザー操作で音声が有効化されたか
}

export const useHandsFree = ({
  isHandsFreeMode,
  onVoiceCommand,
  onSilenceDetected,
  currentQuestion,
  isSpeakingAllowed,
}: UseHandsFreeOptions) => {
  const silenceTimerRef = useRef<number | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const [isRecognizing, setIsRecognizing] = useState(false);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    lastSpeechTimeRef.current = Date.now();
    silenceTimerRef.current = window.setTimeout(() => {
      checkSilence();
    }, 1000); // 1秒ごとに沈黙をチェック
  }, []);

  const checkSilence = useCallback(() => {
    if (!isHandsFreeMode || !isRecognizing) return;

    const elapsed = (Date.now() - lastSpeechTimeRef.current) / 1000;
    if (elapsed >= 25) {
      onSilenceDetected?.(25);
    } else if (elapsed >= 17) {
      onSilenceDetected?.(17);
    } else if (elapsed >= 12) {
      onSilenceDetected?.(12);
    } else if (elapsed >= 7) {
      onSilenceDetected?.(7);
    }

    silenceTimerRef.current = window.setTimeout(() => {
      checkSilence();
    }, 1000);
  }, [isHandsFreeMode, isRecognizing, onSilenceDetected]);


  useEffect(() => {
    if (isHandsFreeMode) {
      if (isSpeakingAllowed) {
        speechRecognitionService.start();
        setIsRecognizing(true);
        resetSilenceTimer();
      } else {
        // 音声認識は音声コンテキストのアンロック後でなければ開始できない場合があるため、ここでは開始しない
        // TOP画面でのユーザー操作でisSpeakingAllowedがtrueになるまで待つ
        setIsRecognizing(false);
      }
    } else {
      speechRecognitionService.stop();
      setIsRecognizing(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopSpeaking(); // モード切り替えで読み上げを停止
    }

    return () => {
      speechRecognitionService.stop();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopSpeaking();
    };
  }, [isHandsFreeMode, isSpeakingAllowed, resetSilenceTimer]);

  useEffect(() => {
    if (!isHandsFreeMode) return;

    const handleResult = (transcript: string) => {
      resetSilenceTimer(); // 発話があったらタイマーリセット
      const command = detectVoiceCommand(transcript);
      if (command) {
        onVoiceCommand(command, transcript);
      } else {
        // コマンド以外の発話は答えとして扱う
        onVoiceCommand('answerAttempt', transcript);
      }
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech Recognition Error:", event);
      setIsRecognizing(false); // エラーが発生したら認識中フラグを落とす
      if (event.error === 'not-allowed') {
        // ユーザーがマイクの使用を拒否した場合
        speak('マイクの使用が許可されていません。ブラウザの設定をご確認ください。');
      } else if (event.error === 'network') {
        speak('ネットワーク接続に問題があるようです。');
      }
      // エラーからの自動再開はspeechRecognitionService内で処理されるため、ここでは何もしない
      // ただし、onendで自動再起動されるため、認識中フラグは再度trueになる
    };

    speechRecognitionService.onResult(handleResult);
    speechRecognitionService.onError(handleError);

    return () => {
      // クリーンアップ関数は、コンポーネントのアンマウント時、または依存配列の変更時に実行されます
      // ここでコールバックをnullに設定すると、次のuseEffectで新しいコールバックが設定される
      speechRecognitionService.onResult(() => {}); // ダミーで上書き
      speechRecognitionService.onError(() => {}); // ダミーで上書き
    };
  }, [isHandsFreeMode, onVoiceCommand, resetSilenceTimer]);

  const readQuestion = useCallback(() => {
    if (isHandsFreeMode && currentQuestion && isSpeakingAllowed) {
      speak(currentQuestion);
      resetSilenceTimer();
    }
  }, [isHandsFreeMode, currentQuestion, isSpeakingAllowed, resetSilenceTimer]);

  const readHint = useCallback((hintText: string) => {
    if (isHandsFreeMode && hintText && isSpeakingAllowed) {
      speak(hintText);
      resetSilenceTimer();
    }
  }, [isHandsFreeMode, isSpeakingAllowed, resetSilenceTimer]);

  return { isRecognizing, readQuestion, readHint, resetSilenceTimer };
};
