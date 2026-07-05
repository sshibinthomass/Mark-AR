import type { Camera, Scene, WebGLRenderer } from 'three';
import type { MindARAnchor, MindARThreeConstructor } from '../../ar/mindarRuntime';

export const MindARThree: MindARThreeConstructor;

export type MindARThreeInstance = {
  addAnchor: (targetIndex: number) => MindARAnchor;
  camera: Camera;
  renderer: WebGLRenderer;
  scene: Scene;
  start: () => Promise<void>;
  stop?: () => void;
};
