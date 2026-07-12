import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBFqrE_k_fBHEeQ3A2CjTnF_y-yZ1jZsdo",
  authDomain: "watashihadare-quiz.firebaseapp.com",
  projectId: "watashihadare-quiz",
  storageBucket: "watashihadare-quiz.firebasestorage.app",
  messagingSenderId: "693543207365",
  appId: "1:693543207365:web:6821edbcbe6f9955cb8bac",
  measurementId: "G-ZF8GBLSPYN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);

// Googleログイン用プロバイダ（メールリンクが迷惑メール判定されても
// ログインできるよう、メール配信に依存しない選択肢として提供する）
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
