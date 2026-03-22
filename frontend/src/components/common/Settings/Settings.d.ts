import React from 'react';
interface SettingsProps {
    onClose: () => void;
    onLoginStatusChange: (isLoggedIn: boolean, isPremium: boolean) => void;
    currentView: 'TOP' | 'GAME' | 'RESULT';
}
declare const Settings: React.FC<SettingsProps>;
export default Settings;
