interface SpeechRecognitionService {
    start: () => void;
    stop: () => void;
    isRecognizing: () => boolean;
    onResult: (callback: (transcript: string, isFinal: boolean) => void) => void;
    onError: (callback: (error: SpeechRecognitionErrorEvent) => void) => void;
    onRecognizingChange: (callback: (recognizing: boolean) => void) => void;
}
export declare const speechRecognitionService: SpeechRecognitionService;
/**
 * 認識されたテキストからコマンドを判定します。
 * @param transcript 認識されたテキスト
 * @returns 検出されたコマンド名 ('hint1', 'hint2', 'hint3', 'surrender', 'repeatQuestion', null)
 */
export declare const GENRE_READING_MAP: Record<string, string>;
export declare const detectVoiceCommand: (transcript: string) => string | null;
export {};
