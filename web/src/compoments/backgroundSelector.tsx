import { useEffect } from 'react';
import { useAtom } from 'jotai';
import {
  backgroundListAtom,
  selectedBackgroundAtom,
  selectedBackgroundPathAtom,
  BackgroundEntry,
  loadDefaultBackgroundList,
} from '../lib/backgroundAtom';

type Props = {
  onBackgroundChange: (url: string) => void;
};

export function BackgroundSelector({ onBackgroundChange }: Props) {
  const [backgroundList, setBackgroundList] = useAtom(backgroundListAtom);
  const [selectedBackground, setSelectedBackground] = useAtom(selectedBackgroundAtom);
  const [selectedBgPath, setSelectedBgPath] = useAtom(selectedBackgroundPathAtom);

  useEffect(() => {
    if (backgroundList.length > 0) return;
    loadDefaultBackgroundList().then((defaults) => {
      setBackgroundList(defaults);
      // localStorage に保存済みのパスがあれば復元、なければ先頭
      const restored = selectedBgPath ? (defaults.find((b) => b.url === selectedBgPath) ?? defaults[0]) : defaults[0];
      if (restored) {
        setSelectedBackground(restored);
        onBackgroundChange(restored.url);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const entry = backgroundList.find((b) => b.url === e.target.value) ?? null;
    setSelectedBackground(entry);
    if (entry) {
      onBackgroundChange(entry.url);
      setSelectedBgPath(entry.url);
    }
  };

  if (backgroundList.length === 0) return null;

  return (
    <select style={selectStyle} value={selectedBackground?.url ?? ''} onChange={onSelectChange}>
      {backgroundList.map((b: BackgroundEntry) => (
        <option key={b.url} value={b.url}>
          {b.label}
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
