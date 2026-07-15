import { Matrix4, Quaternion, Vector3, type Object3D } from 'three';

const WORLD_UP = new Vector3(0, 1, 0);
const MINIMUM_FLOOR_UP_DOT = 0.85;

export class FloorHitTest {
  latestPoseMatrix: Matrix4 | null = null;

  private readonly reticle: Object3D;
  private hitTestSource: XRHitTestSource | null = null;
  private hitTestSourceRequested = false;
  private requestGeneration = 0;
  private session: XRSession | null = null;

  constructor(reticle: Object3D) {
    this.reticle = reticle;
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
  }

  update(frame: XRFrame, session: XRSession, referenceSpace: XRReferenceSpace): boolean {
    if (!this.hitTestSourceRequested) {
      this.requestHitSource(session);
    }

    if (!this.hitTestSource) {
      return this.hideReticle();
    }

    const hit = frame.getHitTestResults(this.hitTestSource)[0];
    const pose = hit?.getPose(referenceSpace);
    if (!pose) {
      return this.hideReticle();
    }

    const matrix = new Matrix4().fromArray(pose.transform.matrix);
    const up = new Vector3(0, 1, 0).applyQuaternion(
      new Quaternion().setFromRotationMatrix(matrix),
    );
    if (up.dot(WORLD_UP) < MINIMUM_FLOOR_UP_DOT) {
      return this.hideReticle();
    }

    this.reticle.matrix.copy(matrix);
    this.reticle.matrixWorldNeedsUpdate = true;
    this.reticle.visible = true;
    this.latestPoseMatrix = matrix;
    return true;
  }

  reset(): void {
    this.requestGeneration += 1;
    this.cancelHitSource();
    this.hitTestSourceRequested = false;
    this.latestPoseMatrix = null;
    this.reticle.visible = false;

    if (this.session) {
      this.session.removeEventListener('end', this.onSessionEnd);
      this.session = null;
    }
  }

  dispose(): void {
    this.reset();
  }

  private requestHitSource(session: XRSession): void {
    this.hitTestSourceRequested = true;
    this.session = session;
    session.addEventListener('end', this.onSessionEnd, { once: true });

    const requestGeneration = ++this.requestGeneration;
    void this.acquireHitSource(session, requestGeneration);
  }

  private async acquireHitSource(session: XRSession, requestGeneration: number): Promise<void> {
    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const requestHitTestSource = session.requestHitTestSource;
      if (typeof requestHitTestSource !== 'function') {
        return;
      }

      const source = await requestHitTestSource.call(session, { space: viewerSpace });
      if (requestGeneration !== this.requestGeneration) {
        if (source && typeof source.cancel === 'function') {
          source.cancel();
        }
        return;
      }

      this.hitTestSource = source ?? null;
    } catch {
      if (requestGeneration === this.requestGeneration) {
        this.hitTestSourceRequested = false;
        this.reticle.visible = false;
      }
    }
  }

  private cancelHitSource(): void {
    if (this.hitTestSource && typeof this.hitTestSource.cancel === 'function') {
      this.hitTestSource.cancel();
    }
    this.hitTestSource = null;
  }

  private hideReticle(): false {
    this.reticle.visible = false;
    return false;
  }

  private readonly onSessionEnd = (): void => {
    this.reset();
  };
}
