import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { localeAtom, Locale } from '../lib/i18n';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];

function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return navigator.language?.startsWith('ja') ? 'ja' : 'en';
}

export function LocaleToggle() {
  const [locale, setLocale] = useAtom(localeAtom);

  // 初回マウント時: localStorage に値がなければ（='en' がデフォルト値のまま）
  // ブラウザ言語で上書きする
  useEffect(() => {
    const stored = localStorage.getItem('selected_locale');
    if (!stored) {
      setLocale(detectBrowserLocale());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        left: '12px',
        zIndex: 60,
        display: 'flex',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(180,140,220,0.4)',
        boxShadow: '0 2px 8px rgba(80,40,140,0.2)',
      }}
    >
      {LOCALES.map((l) => (
        <button
          key={l.value}
          onClick={() => setLocale(l.value)}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: locale === l.value ? 700 : 400,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: locale === l.value ? 'rgba(140,90,220,0.85)' : 'rgba(20,12,40,0.80)',
            color: locale === l.value ? '#fff' : 'rgba(200,170,240,0.6)',
            transition: 'all 0.15s ease',
            letterSpacing: '0.03em',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
