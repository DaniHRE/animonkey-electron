import { createContext } from 'react';

export type TitleLanguage = 'en' | 'jp';

export interface TitleLanguageContextValue {
  titleLanguage: TitleLanguage;
  setTitleLanguage: (language: TitleLanguage) => void;
}

export const TitleLanguageContext =
  createContext<TitleLanguageContextValue | null>(null);
