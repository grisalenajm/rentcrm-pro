import { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n/index';

type Theme = 'dark' | 'light';
type Language = 'es' | 'en';

interface UserPreferences {
  theme: Theme;
  language: Language;
  setTheme: (t: Theme) => void;
  setLanguage: (l: Language) => void;
}

const UserPreferencesContext = createContext<UserPreferences>({
  theme: 'dark', language: 'es',
  setTheme: () => {}, setLanguage: () => {},
});

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) || 'dark'
  );
  const [language, setLanguageState] = useState<Language>(() =>
    (localStorage.getItem('language') as Language) || 'es'
  );

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('light-mode', t === 'light');
  };

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem('language', l);
    i18n.changeLanguage(l);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', theme === 'light');
    i18n.changeLanguage(language);
  }, []);

  return (
    <UserPreferencesContext.Provider value={{ theme, language, setTheme, setLanguage }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export const useUserPreferences = () => useContext(UserPreferencesContext);
