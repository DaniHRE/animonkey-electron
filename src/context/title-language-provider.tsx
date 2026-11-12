import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TitleLanguageContext } from '@/context/title-language-state';

export function TitleLanguageProvider({ children }: { children: ReactNode }) {
  const [titleLanguage, setTitleLanguage] = useState<'en' | 'jp'>('jp');
  const value = useMemo(
    () => ({
      titleLanguage,
      toggleTitleLanguage: () =>
        setTitleLanguage((current) => (current === 'en' ? 'jp' : 'en')),
    }),
    [titleLanguage],
  );

  return (
    <TitleLanguageContext.Provider value={value}>
      {children}
    </TitleLanguageContext.Provider>
  );
}
