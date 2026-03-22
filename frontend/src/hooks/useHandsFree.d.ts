interface UseHandsFreeOptions {
    isHandsFreeMode: boolean;
    onVoiceCommand: (command: string, transcript?: string) => void;
    onSilenceDetected?: (seconds: number) => void;
    currentQuestion?: string;
    isSpeakingAllowed: boolean;
}
export declare const useHandsFree: ({ isHandsFreeMode, onVoiceCommand, onSilenceDetected, currentQuestion, isSpeakingAllowed, }: UseHandsFreeOptions) => {
    isRecognizing: boolean;
    isListening: boolean;
    isProcessing: boolean;
    transcript: string;
    setTranscript: import("react").Dispatch<import("react").SetStateAction<string>>;
    readQuestion: () => void;
    readHint: (hintText: string) => void;
    resetSilenceTimer: () => void;
};
export {};
