import { useContext } from 'react';
import { TitleLanguageContext } from '@/context/title-language-state';

export function useTitleLanguage() {
  const value = useContext(TitleLanguageContext);
  if (!value)
    throw new Error('useTitleLanguage must be used inside its provider.');
  return value;
}
