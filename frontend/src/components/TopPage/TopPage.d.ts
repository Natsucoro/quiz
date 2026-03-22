import React from 'react';
interface TopPageProps {
    onStart: (genre: string, difficulty: number) => void;
    initialView?: 'genre' | 'difficulty';
}
declare const TopPage: React.FC<TopPageProps>;
export default TopPage;
