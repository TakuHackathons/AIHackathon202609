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
  public error = '';
  private frame = 0;
  private onResize = () => this.resize();

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
    const directionalLight = new DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(directionalLight);

    const ambientLight = new AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    // 主光源の反対側から補助光を当て、顔や体の暗い部分を和らげる。
    const fillLight = new DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-1.0, 0.5, 2.0).normalize();
    scene.add(fillLight);

    // animate — THREE.Timer は Clock の後継でdeprecate警告が出ない
    this._timer = new Timer();
  }

  public loadVrm(url: string) {
    this.unloadVRM();
    this.model?.disposeAudio();
    const model = new Model(this._camera || new Object3D());
    this.model = model;
    this.error = '';
    void model
      .loadVRM(url)
      .then(async () => {
        if (this.model !== model) {
          model.unLoadVrm();
          return;
        }
        if (!model.vrm) throw new Error('VRM not found');
        model.vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });
        this._scene.add(model.vrm.scene);
        const vrma = await loadVRMAnimation(buildUrl('/vrma/idle_loop.vrma'));
        if (this.model !== model) return;
        if (vrma) await model.loadAnimation(vrma);
        requestAnimationFrame(() => {
          if (this.model === model) this.resetCamera();
        });
      })
      .catch(() => {
        if (this.model === model) this.error = 'VRMまたはアニメーションの読み込みに失敗しました。';
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
    this._camera = new PerspectiveCamera(28.0, width / height, 0.1, 20.0);
    this._camera.position.set(0, 1.3, 2.5);
    this._cameraControls?.target.set(0, 1.3, 0);
    this._cameraControls?.update();
    // camera controls
    this._cameraControls = new OrbitControls(this._camera, this._renderer.domElement);
    this._cameraControls.screenSpacePanning = true;
    this._cameraControls.update();

    window.addEventListener('resize', this.onResize);
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
      this._camera?.position.set(headWPos.x, headWPos.y - 0.2, 2.5);
      this._cameraControls?.target.set(headWPos.x, headWPos.y - 0.25, headWPos.z);
      this._cameraControls?.update();
    }
  }

  public dispose() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    this.unloadVRM();
    this.model?.disposeAudio();
    this.model = undefined;
    this._cameraControls?.dispose();
    this._renderer?.dispose();
    this._renderer = undefined;
    this.isReady = false;
  }

  public update = () => {
    this.frame = requestAnimationFrame(this.update);
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
