import { Object3D } from 'three';
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { ExpressionController } from './expressionController';

/**
 * 感情表現としてExpressionとMotionを操作する為のクラス
 * デモにはExpressionのみが含まれています
 */
export class EmoteController {
  private _expressionController: ExpressionController;

  constructor(vrm: VRM, camera: Object3D) {
    this._expressionController = new ExpressionController(vrm, camera);
  }

  public playEmotion(preset: VRMExpressionPresetName, strength = 1) {
    this._expressionController.playEmotion(preset, strength);
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    this._expressionController.lipSync(preset, value);
  }

  public update(delta: number) {
    this._expressionController.update(delta);
  }
}
