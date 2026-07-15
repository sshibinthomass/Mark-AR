import { Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FloorHitTest } from '../src/ar/floorHitTest';

describe('FloorHitTest', () => {
  it('shows the reticle only for a horizontal hit pose', async () => {
    const reticle = new Group();
    const hitTest = new FloorHitTest(reticle);
    const { session } = fakeSessionWithHitSource();
    const matrix = horizontalPoseMatrix();

    expect(hitTest.update(fakeFrame(matrix), session, {} as XRReferenceSpace)).toBe(false);
    expect(reticle.visible).toBe(false);

    await flushHitSourceRequest();

    expect(hitTest.update(fakeFrame(matrix), session, {} as XRReferenceSpace)).toBe(true);
    expect(reticle.visible).toBe(true);
    expect(reticle.matrix.elements).toEqual(matrix.elements);
    expect(hitTest.latestPoseMatrix?.elements).toEqual(matrix.elements);
    expect(hitTest.latestPoseMatrix).not.toBe(matrix);
  });

  it('rejects vertical and upside-down poses without discarding the latest valid floor pose', async () => {
    const reticle = new Group();
    const hitTest = new FloorHitTest(reticle);
    const { session } = fakeSessionWithHitSource();
    const validMatrix = horizontalPoseMatrix();

    hitTest.update(fakeFrame(validMatrix), session, {} as XRReferenceSpace);
    await flushHitSourceRequest();
    expect(hitTest.update(fakeFrame(validMatrix), session, {} as XRReferenceSpace)).toBe(true);

    expect(hitTest.update(fakeFrame(verticalPoseMatrix()), session, {} as XRReferenceSpace)).toBe(false);
    expect(reticle.visible).toBe(false);
    expect(hitTest.latestPoseMatrix?.elements).toEqual(validMatrix.elements);

    expect(hitTest.update(fakeFrame(upsideDownPoseMatrix()), session, {} as XRReferenceSpace)).toBe(false);
    expect(reticle.visible).toBe(false);
    expect(hitTest.latestPoseMatrix?.elements).toEqual(validMatrix.elements);

    expect(hitTest.update(fakeFrame(), session, {} as XRReferenceSpace)).toBe(false);
    expect(reticle.visible).toBe(false);
    expect(hitTest.latestPoseMatrix?.elements).toEqual(validMatrix.elements);
  });

  it('reset clears placement state and allows a fresh hit source request', async () => {
    const reticle = new Group();
    const hitTest = new FloorHitTest(reticle);
    const { session, requestReferenceSpace } = fakeSessionWithHitSource();
    const matrix = horizontalPoseMatrix();

    hitTest.update(fakeFrame(matrix), session, {} as XRReferenceSpace);
    await flushHitSourceRequest();
    expect(hitTest.update(fakeFrame(matrix), session, {} as XRReferenceSpace)).toBe(true);

    hitTest.reset();

    expect(hitTest.latestPoseMatrix).toBeNull();
    expect(reticle.visible).toBe(false);
    expect(hitTest.update(fakeFrame(matrix), session, {} as XRReferenceSpace)).toBe(false);
    expect(requestReferenceSpace).toHaveBeenCalledTimes(2);
  });

  it('cancels the active hit-test source when disposed', async () => {
    const reticle = new Group();
    const hitTest = new FloorHitTest(reticle);
    const { session, source } = fakeSessionWithHitSource();

    hitTest.update(fakeFrame(horizontalPoseMatrix()), session, {} as XRReferenceSpace);
    await flushHitSourceRequest();
    hitTest.dispose();

    expect(source.cancel).toHaveBeenCalledOnce();
    expect(hitTest.latestPoseMatrix).toBeNull();
    expect(reticle.visible).toBe(false);
  });
});

function horizontalPoseMatrix(): Matrix4 {
  return new Matrix4().makeTranslation(1, 0, -2);
}

function verticalPoseMatrix(): Matrix4 {
  return new Matrix4().compose(
    new Vector3(1, 0, -2),
    new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0)),
    new Vector3(1, 1, 1),
  );
}

function upsideDownPoseMatrix(): Matrix4 {
  return new Matrix4().compose(
    new Vector3(1, 0, -2),
    new Quaternion().setFromEuler(new Euler(Math.PI, 0, 0)),
    new Vector3(1, 1, 1),
  );
}

function fakeFrame(matrix?: Matrix4): XRFrame {
  return {
    getHitTestResults: () => matrix
      ? [{ getPose: () => ({ transform: { matrix: matrix.elements } }) }]
      : [],
  } as unknown as XRFrame;
}

function fakeSessionWithHitSource() {
  const source = { cancel: vi.fn() };
  const requestReferenceSpace = vi.fn(async () => ({} as XRReferenceSpace));
  const requestHitTestSource = vi.fn(async () => source);
  const session = {
    requestReferenceSpace,
    requestHitTestSource,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as XRSession;

  return { session, source, requestReferenceSpace };
}

async function flushHitSourceRequest(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
