"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState, type RefObject } from "react";
import { NeutralToneMapping, type PerspectiveCamera } from "three";
import type { WattWiseBridge, WattWiseProxy } from "./bridge";
import { COVER_SKIN, COVER_THICKNESS, DeviceRig, STACK } from "./DeviceRig";
import { COVER, DISPLAY, LED } from "./textures";

type Pose = Pick<
  WattWiseProxy,
  "modelY" | "camX" | "camY" | "camZ" | "tgtX" | "tgtY" | "tgtZ" | "coverLift" | "explode" | "tags" | "focusSense" | "focusCompute" | "focusControl"
>;

// Authored display poses for the stylized model; not device measurements.
// Focus 1 on every part keeps all layers at full value and the labels fully opaque.
const CLOSED: Pose = { modelY: -0.1, camX: 0, camY: 4.4, camZ: 10, tgtX: 0, tgtY: -0.3, tgtZ: 0, coverLift: 0, explode: 0, tags: 0, focusSense: 0, focusCompute: 0, focusControl: 0 };
const OPEN: Pose = { modelY: -0.3, camX: 0.8, camY: 4.4, camZ: 11.6, tgtX: 0, tgtY: 1.25, tgtZ: 0, coverLift: 1, explode: 1, tags: 1, focusSense: 1, focusCompute: 1, focusControl: 1 };
const KEYS = Object.keys(CLOSED) as (keyof Pose)[];

const REST_YAW = -0.7;
const OPEN_YAW = -0.5;
const SWAY = 0.28; // radians either side of rest while idle
const SWAY_SPEED = 0.32; // phase speed: one slow sway every ~20s
const LAMBDA = 5.5; // exponential damping: settles in ~0.6s and retargets mid-flight like a spring

/** Arrival pose: turned away and low, so the first second settles into place once. */
function arrive(p: WattWiseProxy, reduced: boolean) {
  Object.assign(p, CLOSED, { displayOn: 1, keyIntensity: 1, rimIntensity: 0.6, rootYaw: reduced ? REST_YAW : REST_YAW - 1.1 });
  if (!reduced) p.modelY = -0.7;
}

/** Moves the proxy one frame toward the open or closed pose; idle adds a slow sway. */
function step(p: WattWiseProxy, open: boolean, reduced: boolean, time: number, delta: number) {
  const target = open ? OPEN : CLOSED;
  const dt = Math.min(delta, 1 / 20); // tab switches hand back huge deltas; never jump
  const k = reduced ? 1 : 1 - Math.exp(-LAMBDA * dt);
  for (const key of KEYS) p[key] += (target[key] - p[key]) * k;
  const yaw = open ? OPEN_YAW : reduced ? REST_YAW : REST_YAW + Math.sin(time * SWAY_SPEED) * SWAY;
  p.rootYaw += (yaw - p.rootYaw) * (reduced ? 1 : 1 - Math.exp(-LAMBDA * 0.6 * dt));
}

interface ModelProps {
  bridge: WattWiseBridge;
  open: RefObject<boolean>;
  reduced: boolean;
  onReady: () => void;
}

function DeviceModel({ bridge, open, reduced, onReady }: ModelProps) {
  const [rig] = useState(() => new DeviceRig());
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => rig.applyEnvironment(gl, scene), [rig, gl, scene]);

  useEffect(() => {
    let cancelled = false;
    rig.drawFace(() => cancelled).then((drawn) => {
      if (!drawn || cancelled) return;
      invalidate();
      onReady();
    });
    return () => {
      cancelled = true;
    };
  }, [rig, invalidate, onReady]);

  useEffect(() => () => rig.dispose(), [rig]);

  useEffect(() => arrive(bridge.proxy, reduced), [bridge, reduced]);

  useFrame(({ camera, size, clock }, delta) => {
    step(bridge.proxy, open.current, reduced, clock.elapsedTime, delta);
    rig.apply(bridge, camera as PerspectiveCamera, size);
  });

  const m = rig.materials;
  return (
    <>
      <hemisphereLight args={["#ffffff", "#8f9a92", 0.8]} />
      <directionalLight ref={(node) => rig.setLights(node, null)} position={[4.5, 7, 6]} intensity={0} />
      <directionalLight ref={(node) => rig.setLights(null, node)} position={[-6, 3.5, -6]} intensity={0} color="#E8FFF2" />

      <group ref={(node) => rig.setRoot(node)}>
        <mesh rotation-x={-Math.PI / 2} position-y={-0.012} scale={[COVER.width * 1.9, COVER.depth * 2.1, 1]} material={m.shadow}>
          <planeGeometry />
        </mesh>

        {STACK.map((layer) => (
          <group key={layer.id} ref={(node) => rig.setLayer(layer.id, node)}>
            <mesh geometry={rig.geometries.get(layer.id)} material={rig.layerMaterials.get(layer.id)!.material} />

            {layer.id === "compute" ? (
              <group position-y={layer.thickness} ref={(node) => rig.setPart("compute", node)}>
                <mesh position={[0.15, 0.0125, 0.05]} material={m.pcb}>
                  <boxGeometry args={[1.25, 0.025, 0.52]} />
                </mesh>
                <mesh position={[0.32, 0.06, 0.05]} material={m.shield}>
                  <boxGeometry args={[0.56, 0.07, 0.4]} />
                </mesh>
                <mesh position={[-0.33, 0.04, 0.05]} material={m.chip}>
                  <boxGeometry args={[0.18, 0.03, 0.18]} />
                </mesh>
                <object3D position={[0.32, 0.12, 0.05]} ref={(node) => rig.setAnchor("compute", node)} />
              </group>
            ) : null}

            {layer.id === "sense" ? (
              <group position-y={layer.thickness} ref={(node) => rig.setPart("sense", node)}>
                <mesh position={[-0.2, 0.0125, 0]} material={m.pcbGreen}>
                  <boxGeometry args={[1.2, 0.025, 0.7]} />
                </mesh>
                <mesh position={[-0.48, 0.08, 0]} rotation-x={Math.PI / 2} material={m.coil}>
                  <torusGeometry args={[0.2, 0.07, 14, 36]} />
                </mesh>
                <mesh position={[0.05, 0.04, -0.12]} material={m.chip}>
                  <boxGeometry args={[0.26, 0.04, 0.2]} />
                </mesh>
                <mesh position={[0.22, 0.08, 0.18]} material={m.terminal}>
                  <boxGeometry args={[0.38, 0.13, 0.16]} />
                </mesh>
                <object3D position={[-0.48, 0.2, 0]} ref={(node) => rig.setAnchor("sense", node)} />
              </group>
            ) : null}

            {layer.id === "relay" ? (
              <group position-y={layer.thickness} ref={(node) => rig.setPart("control", node)}>
                <mesh position={[0.45, 0.0125, -0.05]} material={m.pcb}>
                  <boxGeometry args={[0.95, 0.025, 0.6]} />
                </mesh>
                <mesh position={[0.36, 0.18, -0.05]} material={m.relay}>
                  <boxGeometry args={[0.44, 0.32, 0.36]} />
                </mesh>
                {[-0.12, 0.02, 0.16].map((z) => (
                  <mesh key={z} position={[0.78, 0.06, z - 0.05]} material={m.screw}>
                    <cylinderGeometry args={[0.035, 0.035, 0.07, 16]} />
                  </mesh>
                ))}
                <object3D position={[0.36, 0.38, -0.05]} ref={(node) => rig.setAnchor("control", node)} />
              </group>
            ) : null}
          </group>
        ))}

        <group ref={(node) => rig.setCover(node)}>
          <mesh geometry={rig.geometries.get("coverSkin")} material={m.coverSkin} position-y={-COVER_SKIN.thickness} />
          <mesh geometry={rig.geometries.get("cover")} material={[m.cover, m.coverSide]} />
          <mesh rotation-x={-Math.PI / 2} position={[DISPLAY.x, COVER_THICKNESS + 0.002, -DISPLAY.y]} material={m.display}>
            <planeGeometry args={[DISPLAY.width, DISPLAY.height]} />
          </mesh>
          <mesh position={[LED.x, COVER_THICKNESS + 0.006, -LED.y]} material={m.led}>
            <cylinderGeometry args={[0.045, 0.045, 0.012, 24]} />
          </mesh>
        </group>
      </group>
    </>
  );
}

interface WattWiseCanvasProps {
  bridge: WattWiseBridge;
  open: RefObject<boolean>;
  /** False while the device is off screen: the render loop stops entirely. */
  active: boolean;
  reduced: boolean;
  onReady: () => void;
  onContextLost: () => void;
}

export default function WattWiseCanvas({ bridge, open, active, reduced, onReady, onContextLost }: WattWiseCanvasProps) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      resize={{ scroll: false, debounce: { scroll: 0, resize: 120 } }}
      camera={{ fov: 21, // tighter than the portfolio so the unit fills the hero column
       near: 0.1, far: 80, position: [0, 4.4, 9.2] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onContextLost();
        });
      }}
      aria-hidden="true"
    >
      <DeviceModel bridge={bridge} open={open} reduced={reduced} onReady={onReady} />
    </Canvas>
  );
}
