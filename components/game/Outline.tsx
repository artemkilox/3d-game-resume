"use client";

import { EffectComposer, ToneMapping, wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute, ToneMappingMode } from "postprocessing";
import { BackSide, Mesh, MeshBasicMaterial, type Object3D } from "three";

const fragmentShader = /* glsl */ `
float viewEdge(const in vec2 uv, const in vec2 offset) {
  return abs(getViewZ(readDepth(uv + offset)) - getViewZ(readDepth(uv - offset)));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = texelSize * 1.35;
  float edge = viewEdge(uv, vec2(px.x, 0.0));
  edge = max(edge, viewEdge(uv, vec2(0.0, px.y)));
  edge = max(edge, viewEdge(uv, px));
  edge = max(edge, viewEdge(uv, vec2(px.x, -px.y)));
  float line = smoothstep(0.28, 0.7, edge);
  outputColor = vec4(mix(inputColor.rgb, vec3(0.08), line), 1.0);
}
`;

class SilhouetteOutlineEffect extends Effect {
  constructor() {
    super("SilhouetteOutlineEffect", fragmentShader, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
    });
  }
}

const SilhouetteOutline = wrapEffect(SilhouetteOutlineEffect);

export const outlineMaterial = new MeshBasicMaterial({
  color: "#171717",
  side: BackSide,
  toneMapped: false,
});

export function attachOutline(root: Object3D, scale = 1.035) {
  const created: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || mesh.userData.outline) return;
    const outline = new Mesh(mesh.geometry, outlineMaterial);
    outline.userData.outline = true;
    outline.scale.setScalar(scale);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.raycast = () => undefined;
    mesh.add(outline);
    created.push(outline);
  });
  return () => {
    for (const outline of created) outline.removeFromParent();
  };
}

export function SceneOutline() {
  return (
    <EffectComposer multisampling={4}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SilhouetteOutline />
    </EffectComposer>
  );
}
