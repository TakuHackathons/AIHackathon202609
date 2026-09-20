import { DirectionalLight, WebGLRenderer, Timer, PerspectiveCamera, Scene, AmbientLight, Object3D, Vector3, SRGBColorSpace } from 'three';
import { Model } from './model';
import { loadVRMAnimation } from '../../lib/VRMAnimation/loadVRMAnimation';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildUrl } from '@/utils/buildUrl';

/**
 * three.jsを使った3Dビューワー
 *
 * setup()でcanvasを渡してから使う
 */
export class Viewer {
  public isReady: boolean;
  public model?: Model;

  private _renderer?: WebGLRenderer;
  private _timer: Timer;
  private _scene: Scene;
  private _camera?: PerspectiveCamera;
  private _cameraControls?: OrbitControls;

  constructor() {
    this.isReady = false;

    // scene
    const scene = new Scene();
    this._scene = scene;

    // light
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(directionalLight);

    const ambientLight = new AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    // animate — THREE.Timer は Clock の後継でdeprecate警告が出ない
    this._timer = new Timer();
  }

  public loadVrm(url: string) {
    if (this.model?.vrm) {
      this.unloadVRM();
    }

    // gltf and vrm
    this.model = new Model(this._camera || new Object3D());
    this.model.loadVRM(url).then(async () => {
      if (!this.model?.vrm) return;

      // Disable frustum culling
      this.model.vrm.scene.traverse((obj) => {
        obj.frustumCulled = false;
      });

      this._scene.add(this.model.vrm.scene);

      const vrma = await loadVRMAnimation(buildUrl('/vrma/idle_loop.vrma'));
      if (vrma) this.model.loadAnimation(vrma);

      // HACK: アニメーションの原点がずれているので再生後にカメラ位置を調整する
      requestAnimationFrame(() => {
        this.resetCamera();
      });
    });
  }

  public unloadVRM(): void {
    if (this.model?.vrm) {
      this._scene.remove(this.model.vrm.scene);
      this.model?.unLoadVrm();
    }
  }

  /**
   * Reactで管理しているCanvasを後から設定する
   */
  public setup(canvas: HTMLCanvasElement) {
    const parentElement = canvas.parentElement;
    const width = parentElement?.clientWidth || canvas.width;
    const height = parentElement?.clientHeight || canvas.height;
    // renderer
    this._renderer = new WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
    });
    this._renderer.outputColorSpace = SRGBColorSpace;
    this._renderer.setSize(width, height);
    this._renderer.setPixelRatio(window.devicePixelRatio);

    // camera
    this._camera = new PerspectiveCamera(20.0, width / height, 0.1, 20.0);
    this._camera.position.set(0, 1.3, 1.5);
    this._cameraControls?.target.set(0, 1.3, 0);
    this._cameraControls?.update();
    // camera controls
    this._cameraControls = new OrbitControls(this._camera, this._renderer.domElement);
    this._cameraControls.screenSpacePanning = true;
    this._cameraControls.update();

    window.addEventListener('resize', () => {
      this.resize();
    });
    this.isReady = true;
    this.update();
  }

  /**
   * canvasの親要素を参照してサイズを変更する
   */
  public resize() {
    if (!this._renderer) return;

    const parentElement = this._renderer.domElement.parentElement;
    if (!parentElement) return;

    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(parentElement.clientWidth, parentElement.clientHeight);

    if (!this._camera) return;
    this._camera.aspect = parentElement.clientWidth / parentElement.clientHeight;
    this._camera.updateProjectionMatrix();
  }

  /**
   * VRMのheadノードを参照してカメラ位置を調整する
   */
  public resetCamera() {
    const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode('head');

    if (headNode) {
      const headWPos = headNode.getWorldPosition(new Vector3());
      this._camera?.position.set(this._camera.position.x, headWPos.y, this._camera.position.z);
      this._cameraControls?.target.set(headWPos.x, headWPos.y, headWPos.z);
      this._cameraControls?.update();
    }
  }

  public update = () => {
    requestAnimationFrame(this.update);
    // THREE.Timer: update() で内部時刻を進め、getDelta() で差分を取得する
    this._timer.update();
    const delta = this._timer.getDelta();

    if (this.model) {
      this.model.update(delta);
    }

    if (this._renderer && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  };
}
