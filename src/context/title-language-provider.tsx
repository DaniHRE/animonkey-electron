import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  TitleLanguageContext,
  type TitleLanguage,
} from '@/context/title-language-state';
import { useLocalPreference } from '@/hooks/use-local-preference';

const TITLE_LANGUAGE_PREFERENCE_KEY = 'ui.title-language';

export function TitleLanguageProvider({ children }: { children: ReactNode }) {
  const { value: storedLanguage, update } = useLocalPreference<unknown>(
    TITLE_LANGUAGE_PREFERENCE_KEY,
    'jp',
  );
  const titleLanguage: TitleLanguage = storedLanguage === 'en' ? 'en' : 'jp';
  const setTitleLanguage = useCallback(
    (language: TitleLanguage) => update(language),
    [update],
  );
  const contextValue = useMemo(
    () => ({
      titleLanguage,
      setTitleLanguage,
    }),
    [titleLanguage, setTitleLanguage],
  );

  return (
    <TitleLanguageContext.Provider value={contextValue}>
      {children}
    </TitleLanguageContext.Provider>
  );
}
