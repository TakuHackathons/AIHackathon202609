import { useContext, useCallback } from 'react';
import { ViewerContext } from '../features/vrmViewer/viewerContext';
import { buildUrl } from '@/utils/buildUrl';

export function VrmViewer() {
  const { viewer } = useContext(ViewerContext);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (canvas) {
        viewer.setup(canvas);
        viewer.loadVrm(buildUrl('/vrm/Zundamon_VRM_10.vrm'));
      }
    },
    [viewer],
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100svh',
        zIndex: -10,
      }}
    >
      <canvas ref={canvasRef} style={{ height: '100%', width: '100%' }}></canvas>
    </div>
  );
}
