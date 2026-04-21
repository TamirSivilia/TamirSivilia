import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '@/locales/en.json';
import he from '@/locales/he.json';

export const RTL_LANGUAGES = new Set(['he', 'ar', 'fa', 'ur']);

const resources = {
  en: { translation: en },
  he: { translation: he },
};

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pawmate_lang',
    },
  });

i18next.on('languageChanged', (lng) => {
  const dir = RTL_LANGUAGES.has(lng) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
});

// Apply direction on initial load
const initialLang = i18next.language?.split('-')[0] ?? 'en';
document.documentElement.dir = RTL_LANGUAGES.has(initialLang) ? 'rtl' : 'ltr';
document.documentElement.lang = initialLang;

export default i18next;

/** Formats a number using the active locale */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(i18next.language).format(n);
}

/** Formats a date using the active locale */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(i18next.language, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(date));
}
