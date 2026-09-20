import { useContext, useEffect, useRef } from 'react';
import { ViewerContext } from '../features/vrmViewer/viewerContext';
import { buildUrl } from '@/utils/buildUrl';

export function VrmViewer() {
  const { viewer } = useContext(ViewerContext);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    viewer.setup(canvas.current);
    viewer.loadVrm(buildUrl('/vrm/Zundamon_VRM_10.vrm'));
    return () => viewer.dispose();
  }, [viewer]);
  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100svh', zIndex: -1 }}>
      <canvas ref={canvas} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
