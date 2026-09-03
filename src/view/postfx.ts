// view/postfx.ts — EffectComposer + UnrealBloomPass (neon glow). Bundled
// three/examples modules; no external dependency. The render loop uses
// composer.render() (not renderer.render).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export interface PostFx {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  resize(w: number, h: number): void;
}

export function createPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostFx {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // strength ~0.6, radius ~0.4, threshold ~0.85 — only the emissive/neon
  // parts glow, not the scene as a whole.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6,
    0.4,
    0.85,
  );
  composer.addPass(bloom);

  // OutputPass: ACES tone mapping + sRGB conversion applied at the end of the chain.
  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    resize(w: number, h: number): void {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
  };
}
