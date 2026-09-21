import { useContext, useEffect, useRef } from 'react';
import { ViewerContext } from '../features/vrmViewer/viewerContext';
import { buildUrl } from '@/utils/buildUrl';
export function VrmViewer() {
  const { viewer } = useContext(ViewerContext);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const element = canvas.current;
    try {
      viewer.setup(element);
      viewer.loadVrm(buildUrl('/vrm/beautiful_gentle_eyes_companion.vrm'));
    } catch {
      viewer.error = '3D表示を開始できませんでした。ブラウザのWebGL設定を確認してください。';
    }
    const observer = new ResizeObserver(() => viewer.resize());
    if (element.parentElement) observer.observe(element.parentElement);
    return () => {
      observer.disconnect();
      viewer.dispose();
    };
  }, [viewer]);
  return (
    <div className="vrm-canvas">
      <canvas ref={canvas} aria-label="AI相談アシスタントの3Dモデル" />
    </div>
  );
}
