# Adding a New Language to Pawmate

## Step-by-step guide

### 1. Create a locale file

Copy `en.json` and create a new file named after the language code (e.g., `fr.json` for French, `he.json` for Hebrew):

```bash
cp src/locales/en.json src/locales/fr.json
```

### 2. Translate all strings

Open the new file and translate every value (not the keys) to the target language.

For RTL languages (Hebrew, Arabic), also note the `dir` setting in step 5.

### 3. Register the language in i18n.ts

Open `src/lib/i18n.ts` and add the new locale:

```ts
import fr from '@/locales/fr.json';

i18next.init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },  // <-- add here
  },
  ...
});
```

### 4. Add to the language switcher

Open `src/components/modals/SettingsModal.tsx` and add the new language to the `LANGUAGES` array:

```ts
const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },   // <-- add here
  { code: 'he', label: 'עברית', dir: 'rtl' },
];
```

### 5. Handle RTL (if needed)

The app dynamically sets `document.documentElement.dir` based on the selected language's `dir` field. RTL languages automatically get right-to-left layout via Tailwind's RTL plugin.

### 6. Test

Run `npm run dev` and switch to the new language in Settings. Verify all strings render correctly and the layout direction is correct.

## Key rules

- Never hardcode UI strings in components — always use `t('key.subkey')`  
- Use `{{variable}}` interpolation for dynamic values: `t('actions.xpGained', { xp: 10 })`
- Numbers are always rendered LTR regardless of language (use `className="ltr-num"`)
- Dates/numbers use `Intl` formatting: `new Intl.NumberFormat(i18n.language).format(n)`
