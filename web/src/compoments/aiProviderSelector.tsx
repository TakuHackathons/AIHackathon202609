import { useAtom } from 'jotai';
import { aiProviderAtom, AI_PROVIDER_OPTIONS, AiProvider } from '../lib/aiProviderAtom';

export function AiProviderSelector() {
  const [provider, setProvider] = useAtom(aiProviderAtom);

  return (
    <select style={selectStyle} value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
      {AI_PROVIDER_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

const selectStyle: React.CSSProperties = {
  backgroundColor: 'rgba(30, 18, 50, 0.85)',
  color: '#e8d9f5',
  border: '1px solid rgba(180, 140, 220, 0.6)',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
};
