/**
 * 音声コンテキストを初期化（アンロック）します。
 * iOS Safariなどのブラウザ制限対策として、ユーザー操作によって一度音声再生をトリガーする必要があります。
 */
export declare const unlockAudioContext: () => void;
/**
 * {漢字|よみ} 記法をよみだけに変換します。
 */
export declare const toReadableText: (text: string) => string;
/**
 * 指定されたテキストを読み上げます。{漢字|よみ} 記法を自動変換します。
 * @param text 読み上げるテキスト
 */
export declare const speak: (text: string) => void;
/**
 * 現在の読み上げを停止します。
 */
export declare const stopSpeaking: () => void;
/**
 * 読み上げ速度を設定し、localStorageに保存します。
 * @param rate 読み上げ速度 (0.1〜10.0、今回は0.5〜2.0を想定)
 */
export declare const setSpeechRate: (rate: number) => void;
/**
 * 現在の読み上げ速度を取得します。
 * @returns number 読み上げ速度
 */
export declare const getSpeechRate: () => number;
/**
 * 現在読み上げ中かどうかを返します。
 */
export declare const isSpeaking: () => boolean;
