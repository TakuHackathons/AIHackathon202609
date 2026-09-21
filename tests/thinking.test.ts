import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ThinkingMotion } from '../web/src/features/emoteController/thinkingMotion';
import { ExpressionController } from '../web/src/features/emoteController/expressionController';

const { Object3D } = createRequire(new URL('../web/package.json', import.meta.url))('three');

test('thinking motion stays bounded and restores the idle pose without drift', () => {
  const head = new Object3D();
  head.rotation.set(0.1, -0.2, 0.05);
  const initial = head.quaternion.clone();
  const motion = new ThinkingMotion(head);
  motion.setActive(true);
  for (let frame = 0; frame < 3600; frame++) {
    motion.restore();
    assert.ok(head.quaternion.angleTo(initial) < 0.00001);
    motion.update(1 / 60);
    assert.ok(head.quaternion.angleTo(initial) < 0.25);
  }
  assert.ok(head.quaternion.angleTo(initial) > 0.05);
  motion.setActive(false);
  for (let frame = 0; frame < 180; frame++) {
    motion.restore();
    motion.update(1 / 60);
  }
  assert.ok(head.quaternion.angleTo(initial) < 0.00001);
});

test('thinking pose layers over a changing animation and can restart', () => {
  const head = new Object3D();
  const motion = new ThinkingMotion(head);
  for (const active of [true, false, true]) {
    motion.setActive(active);
    for (let frame = 0; frame < 120; frame++) {
      motion.restore();
      head.rotation.set(Math.sin(frame / 60) * 0.1, 0, 0);
      const animated = head.quaternion.clone();
      motion.update(1 / 60);
      motion.restore();
      assert.ok(head.quaternion.angleTo(animated) < 0.00001);
    }
  }
});

test('a delayed thinking expression cannot override a newer speaking expression', async () => {
  const values = new Map<string, number>();
  const vrm = { expressionManager: { setValue: (name: string, value: number) => values.set(name, value) } };
  const controller = new ExpressionController(vrm as never, new Object3D());
  controller.playEmotion('sad', 0.3);
  controller.playEmotion('relaxed');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(values.get('sad'), 0);
  assert.equal(values.get('relaxed'), 1);
  controller.playEmotion('sad', 0.3);
  controller.playEmotion('neutral');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(values.get('sad'), 0);
  assert.equal(values.get('relaxed'), 0);
});
