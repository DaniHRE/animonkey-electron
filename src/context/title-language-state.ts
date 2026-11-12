import { createContext } from 'react';

export type TitleLanguage = 'en' | 'jp';

export interface TitleLanguageContextValue {
  titleLanguage: TitleLanguage;
  toggleTitleLanguage: () => void;
}

export const TitleLanguageContext =
  createContext<TitleLanguageContextValue | null>(null);
