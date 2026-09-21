import { AnimationMixer, Object3D } from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMAnimation } from '../../lib/VRMAnimation/VRMAnimation';
import { VRMLookAtSmootherLoaderPlugin } from '../../lib/VRMLookAtSmootherLoaderPlugin/VRMLookAtSmootherLoaderPlugin';
import { LipSync } from '../lipSync/lipSync';
import { ThinkingMotion } from '../emoteController/thinkingMotion';
import { EmoteController } from '../emoteController/emoteController';

type TalkStyle = ['talk', 'happy', 'sad', 'angry', 'fear', 'surprised'][number];

export type Talk = {
  style: TalkStyle;
  speakerX: number;
  speakerY: number;
  message: string;
};

export type EmotionType = ['neutral', 'happy', 'angry', 'sad', 'relaxed'][number] & VRMExpressionPresetName;

/**
 * 発話文と音声の感情と、モデルの感情表現がセットになった物
 */
export type Screenplay = {
  expression: EmotionType;
  talk: Talk;
};

/**
 * 3Dキャラクターを管理するクラス
 */
export class Model {
  public vrm?: VRM | null;
  public mixer?: AnimationMixer;
  public emoteController?: EmoteController;

  private _lookAtTargetParent: Object3D;
  private _lipSync?: LipSync;
  private thinking = false;
  private thinkingMotion?: ThinkingMotion;

  constructor(lookAtTargetParent: Object3D) {
    this._lookAtTargetParent = lookAtTargetParent;
    this._lipSync = new LipSync(new AudioContext());
  }

  public async loadVRM(url: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.register(
      (parser) =>
        new VRMLoaderPlugin(parser, {
          lookAtPlugin: new VRMLookAtSmootherLoaderPlugin(parser),
        }),
    );

    const gltf = await loader.loadAsync(url);

    const vrm = (this.vrm = gltf.userData.vrm);
    vrm.scene.name = 'VRMRoot';

    VRMUtils.rotateVRM0(vrm);
    this.mixer = new AnimationMixer(vrm.scene);

    this.emoteController = new EmoteController(vrm, this._lookAtTargetParent);
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    if (head) this.thinkingMotion = new ThinkingMotion(head);
  }

  public unLoadVrm() {
    this.setThinking(false);
    this.thinkingMotion?.restore();
    this.thinkingMotion = undefined;
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
  }

  /**
   * VRMアニメーションを読み込む
   *
   * https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm_animation-1.0/README.ja.md
   */
  public async loadAnimation(vrmAnimation: VRMAnimation): Promise<void> {
    const { vrm, mixer } = this;
    if (vrm == null || mixer == null) {
      throw new Error('You have to load VRM first');
    }

    const clip = vrmAnimation.createAnimationClip(vrm);
    const action = mixer.clipAction(clip);
    action.play();
  }

  /**
   * 回答待ちの表情とモーションを切り替える
   */
  public setThinking(active: boolean) {
    if (this.thinking === active) return;
    this.thinking = active;
    this.thinkingMotion?.setActive(active);
    this.emoteController?.playEmotion(active ? 'sad' : 'neutral', active ? 0.3 : 1);
  }

  public async speak(buffer: ArrayBuffer, expression: EmotionType) {
    this.setThinking(false);
    this.emoteController?.playEmotion(expression);
    if (!this._lipSync) throw new Error('Audio is unavailable');
    await this._lipSync.playFromArrayBuffer(buffer);
  }

  public disposeAudio() {
    this._lipSync?.stop();
    void this._lipSync?.audio.close();
  }
  public resumeAudio() {
    return this._lipSync!.audio.resume();
  }
  public stopSpeaking() {
    this._lipSync?.stop();
  }
  public update(delta: number): void {
    if (this._lipSync) {
      const { volume } = this._lipSync.update();
      this.emoteController?.lipSync('aa', volume);
    }

    this.emoteController?.update(delta);
    this.thinkingMotion?.restore();
    this.mixer?.update(delta);
    this.thinkingMotion?.update(delta);
    this.vrm?.update(delta);
  }
}
