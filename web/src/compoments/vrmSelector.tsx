import { useRef, useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { vrmListAtom, selectedVrmAtom, VrmEntry, loadDefaultVrmList, selectedVrmPathAtom } from '../lib/vrmAtom';
import { useTranslations } from '../lib/i18n';

type Props = {
  onVrmChange: (url: string) => void;
};

export function VrmSelector({ onVrmChange }: Props) {
  const t = useTranslations();
  const [vrmList, setVrmList] = useAtom(vrmListAtom);
  const [selectedVrm, setSelectedVrm] = useAtom(selectedVrmAtom);
  const [selectedVrmPath, setSelectedVrmPath] = useAtom(selectedVrmPathAtom);

  // assets-manifest.json からデフォルトVRM一覧を初期化
  // localStorage に保存済みのパスがあればそれを復元、なければ先頭を選択
  useEffect(() => {
    if (vrmList.length > 0) return;
    loadDefaultVrmList().then((defaults) => {
      setVrmList(defaults);
      const restored = selectedVrmPath ? (defaults.find((v) => v.url === selectedVrmPath) ?? defaults[0]) : defaults[0];
      if (restored) {
        setSelectedVrm(restored);
        onVrmChange(restored.url);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [modalOpen, setModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const loadCustomVrm = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.vrm')) return;
    const blob = new Blob([file], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const label = file.name.replace(/\.vrm$/i, '');
    const entry: VrmEntry = { label, url, isCustom: true };

    setVrmList((prev) => {
      const filtered = prev.filter((v) => v.label !== label);
      return [...filtered, entry];
    });
    setSelectedVrm(entry);
    onVrmChange(url);
    setModalOpen(false);
    // プルダウンをリセット（__add__ が選択されたままにならないよう）
    if (selectRef.current) selectRef.current.value = url;
  };

  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === '__add__') {
      setModalOpen(true);
      // select の値を元に戻す
      if (selectedVrm) e.target.value = selectedVrm.url;
      return;
    }
    const entry = vrmList.find((v) => v.url === e.target.value);
    if (!entry) return;
    setSelectedVrm(entry);
    onVrmChange(entry.url);
    // isCustom:false のときだけ localStorage に保存
    if (!entry.isCustom) setSelectedVrmPath(entry.url);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadCustomVrm(file);
    e.target.value = '';
  };

  const onModalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const onModalDragLeave = () => setIsDragOver(false);
  const onModalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadCustomVrm(file);
  };

  return (
    <>
      {/* VRM プルダウン */}
      <select ref={selectRef} style={selectStyle} value={selectedVrm?.url ?? ''} onChange={onSelectChange}>
        {vrmList.map((v: VrmEntry) => (
          <option key={v.url} value={v.url}>
            {v.isCustom ? `📎 ${v.label}` : `🧊 ${v.label}`}
          </option>
        ))}
        <option value="__add__">{t.vrmAddOption}</option>
      </select>

      <input ref={fileInputRef} type="file" accept=".vrm" style={{ display: 'none' }} onChange={onFileChange} />

      {/* ── VRM追加モーダル ── */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 90vw)',
              backgroundColor: 'rgba(18,10,40,0.97)',
              border: '1px solid rgba(160,120,220,0.55)',
              borderRadius: '12px',
              boxShadow: '0 8px 40px rgba(80,40,160,0.45)',
              padding: '28px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* モーダルヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#c8b8e8', fontWeight: 700, fontSize: '15px', letterSpacing: '0.05em' }}>{t.vrmModalTitle}</span>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(200,170,255,0.5)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '0 2px',
                }}
              >
                ✕
              </button>
            </div>

            {/* ドラッグ&ドロップゾーン */}
            <div
              onDragOver={onModalDragOver}
              onDragLeave={onModalDragLeave}
              onDrop={onModalDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? 'rgba(200,160,255,0.9)' : 'rgba(160,120,220,0.45)'}`,
                borderRadius: '10px',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragOver ? 'rgba(120,80,200,0.15)' : 'rgba(40,24,70,0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📂</div>
              <div style={{ color: isDragOver ? '#e0c8ff' : '#b8a0d8', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                {t.vrmDropZoneMain}
              </div>
              <div style={{ color: 'rgba(180,150,220,0.5)', fontSize: '12px' }}>{t.vrmDropZoneSub}</div>
              <div style={{ color: 'rgba(160,130,200,0.4)', fontSize: '11px', marginTop: '8px' }}>{t.vrmDropZoneFormat}</div>
            </div>

            {/* {t.vrmModalCancel}ボタン */}
            <button
              onClick={() => setModalOpen(false)}
              style={{
                padding: '9px',
                backgroundColor: 'rgba(60,40,90,0.5)',
                border: '1px solid rgba(160,120,220,0.3)',
                borderRadius: '7px',
                color: 'rgba(200,170,240,0.7)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.vrmModalCancel}
            </button>
          </div>
        </div>
      )}
    </>
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
