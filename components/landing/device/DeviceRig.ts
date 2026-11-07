import {
  CanvasTexture,
  Color,
  type DirectionalLight,
  ExtrudeGeometry,
  type Group,
  MathUtils,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
  PMREMGenerator,
  type Scene,
  Shape,
  Vector3,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { TagId, WattWiseBridge } from "./bridge";
import { COVER, createCoverTexture, createDisplayTexture, createShadowTexture, fontStacks, waitForFonts } from "./textures";

/* Stylized WattWise unit: a stack of rounded layers under a warm-white cover. Heights in model units. */

export const STACK = [
  { id: "base", thickness: 0.17, color: "#A9B8AC", lift: 0 },
  { id: "relay", thickness: 0.09, color: "#D2DFD6", lift: 0.62 },
  { id: "gapB", thickness: 0.03, color: "#0D0D0D", lift: 1.24 }, // underside of the sensing layer
  { id: "sense", thickness: 0.09, color: "#163E28", lift: 1.24 },
  { id: "compute", thickness: 0.09, color: "#212B28", lift: 1.86 },
] as const;

/** Dark underside of the cover; it travels with the cover when it lifts. */
export const COVER_SKIN = { thickness: 0.04 } as const;

export type LayerId = (typeof STACK)[number]["id"];

export const COVER_THICKNESS = 0.14;
const COVER_SKIN_COLOR = "#0D0D0D";
const COVER_LIFT = 2.62; // cover height above the stack with explode = 1
const COVER_OPEN_LIFT = 0.55; // cover clears the stack before the layers separate

const FOCUS_OF: Partial<Record<LayerId, "focusSense" | "focusCompute" | "focusControl">> = {
  relay: "focusControl",
  sense: "focusSense",
  compute: "focusCompute",
};

function roundedSlab(width: number, depth: number, radius: number, thickness: number) {
  const shape = new Shape();
  const x = -width / 2;
  const y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const bevel = Math.min(0.02, thickness / 4);
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 14,
  });
  // Extrude upward: the far cap becomes the top face, shape +y becomes the far edge.
  geometry.translate(0, 0, bevel);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * Owns every three.js object of the device and applies the scroll proxy to them.
 * React only mounts the scene graph; all per-frame mutation happens here.
 */
export class DeviceRig {
  readonly geometries = new Map<string, ExtrudeGeometry>();
  readonly layerMaterials = new Map<LayerId, { material: MeshStandardMaterial; base: Color }>();
  readonly materials = {
    pcb: new MeshStandardMaterial({ color: "#0F1A16", roughness: 0.5 }),
    pcbGreen: new MeshStandardMaterial({ color: "#1D5B3B", roughness: 0.5 }),
    shield: new MeshStandardMaterial({ color: "#C9CEC9", roughness: 0.28, metalness: 0.75 }),
    chip: new MeshStandardMaterial({ color: "#111111", roughness: 0.35 }),
    coil: new MeshStandardMaterial({ color: "#1A1A1A", roughness: 0.55 }),
    terminal: new MeshStandardMaterial({ color: "#2F8F5B", roughness: 0.45 }),
    relay: new MeshStandardMaterial({ color: "#16324F", roughness: 0.38 }),
    screw: new MeshStandardMaterial({ color: "#D9D9D2", roughness: 0.25, metalness: 0.9 }),
    cover: new MeshStandardMaterial({ color: "#F4F3EA", roughness: 0.38 }),
    coverSkin: new MeshStandardMaterial({ color: COVER_SKIN_COLOR, roughness: 0.6 }),
    coverSide: new MeshStandardMaterial({ color: "#E9E8DF", roughness: 0.42 }),
    display: new MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, emissive: "#00E66F", emissiveIntensity: 0.25 }),
    led: new MeshStandardMaterial({ color: "#00E66F", emissive: "#00E66F", emissiveIntensity: 0.2 }),
    shadow: new MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.9 }),
  };

  private root: Group | null = null;
  private cover: Group | null = null;
  private readonly layers: Partial<Record<LayerId, Group>> = {};
  private readonly parts: Partial<Record<TagId, Group>> = {};
  private readonly anchors: Partial<Record<TagId, Object3D>> = {};
  private keyLight: DirectionalLight | null = null;
  private rimLight: DirectionalLight | null = null;
  private readonly textures: CanvasTexture[] = [];
  private readonly target = new Vector3();
  private readonly world = new Vector3();
  private readonly right = new Vector3();

  constructor() {
    for (const layer of STACK) {
      this.geometries.set(layer.id, roundedSlab(COVER.width, COVER.depth, COVER.radius, layer.thickness));
      const base = new Color(layer.color);
      this.layerMaterials.set(layer.id, {
        base,
        material: new MeshStandardMaterial({ color: base.clone(), roughness: layer.id.startsWith("gap") ? 0.6 : 0.42, emissive: "#00E66F", emissiveIntensity: 0 }),
      });
    }
    this.geometries.set("cover", roundedSlab(COVER.width, COVER.depth, COVER.radius, COVER_THICKNESS));
    this.geometries.set("coverSkin", roundedSlab(COVER.width, COVER.depth, COVER.radius, COVER_SKIN.thickness));
    const shadow = createShadowTexture();
    this.textures.push(shadow);
    this.materials.shadow.map = shadow;
  }

  /* Scene-graph registration from React callback refs. */
  setRoot(node: Group | null) {
    this.root = node;
  }
  setCover(node: Group | null) {
    this.cover = node;
  }
  setLayer(id: LayerId, node: Group | null) {
    if (node) this.layers[id] = node;
    else delete this.layers[id];
  }
  setPart(id: TagId, node: Group | null) {
    if (node) this.parts[id] = node;
    else delete this.parts[id];
  }
  setAnchor(id: TagId, node: Object3D | null) {
    if (node) this.anchors[id] = node;
    else delete this.anchors[id];
  }
  setLights(key: DirectionalLight | null, rim: DirectionalLight | null) {
    if (key) this.keyLight = key;
    if (rim) this.rimLight = rim;
  }

  /** Draws the face artwork with the loaded SF Pro Display. Resolves when ready to show. */
  async drawFace(isCancelled: () => boolean) {
    const { display: family } = fontStacks();
    await waitForFonts(family);
    if (isCancelled()) return false;
    const cover = createCoverTexture(family);
    cover.repeat.set(1 / COVER.width, 1 / COVER.depth);
    cover.offset.set(0.5, 0.5);
    const display = createDisplayTexture(family);
    this.textures.push(cover, display);
    this.materials.cover.map = cover;
    this.materials.cover.color.set("#FFFFFF");
    this.materials.cover.needsUpdate = true;
    this.materials.display.map = display;
    this.materials.display.needsUpdate = true;
    return true;
  }

  /** Generated studio reflections; returns the cleanup that releases them. */
  applyEnvironment(gl: WebGLRenderer, scene: Scene) {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const envMap = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.55;
    return () => {
      if (scene.environment === envMap) scene.environment = null;
      envMap.dispose();
      room.traverse((child) => (child as Mesh).geometry?.dispose?.());
      pmrem.dispose();
    };
  }

  /**
   * Frame adapter. Applies the latest absolute pose; called only for requested frames
   * (frameloop="demand"), so nothing moves unless scroll moved it.
   */
  apply(bridge: WattWiseBridge, camera: PerspectiveCamera, size: { width: number; height: number }) {
    const p = bridge.proxy;
    if (!this.root) return;

    this.root.rotation.set(p.rootPitch, p.rootYaw, 0);
    this.root.position.set(p.modelX, p.modelY, 0);
    this.root.scale.setScalar(p.modelScale);

    let y = 0;
    for (const layer of STACK) {
      const group = this.layers[layer.id];
      if (group) group.position.y = y + layer.lift * p.explode;
      y += layer.thickness;
    }
    if (this.cover) {
      this.cover.position.y = y + COVER_SKIN.thickness + COVER_OPEN_LIFT * p.coverLift + (COVER_LIFT - COVER_OPEN_LIFT) * p.explode;
      this.cover.rotation.x = -0.06 * p.coverLift * (1 - p.explode);
    }

    // Components rise out of their boards as the stack separates.
    const rise = MathUtils.smoothstep(p.explode, 0.15, 0.85);
    for (const part of Object.values(this.parts)) {
      part.visible = rise > 0.001;
      part.scale.set(1, Math.max(rise, 0.001), 1);
    }

    // Focus keeps one layer at full value and dims the rest.
    const maxFocus = Math.max(p.focusSense, p.focusCompute, p.focusControl);
    this.layerMaterials.forEach(({ material, base }, id) => {
      const key = FOCUS_OF[id];
      const own = key ? p[key] : 0;
      material.color.copy(base).multiplyScalar(1 - 0.5 * Math.max(0, maxFocus - own));
      material.emissiveIntensity = own * 0.12;
    });

    this.materials.display.opacity = p.displayOn;
    this.materials.led.emissiveIntensity = 0.2 + p.displayOn * 3.2;
    if (this.keyLight) this.keyLight.intensity = 2.6 * p.keyIntensity;
    if (this.rimLight) this.rimLight.intensity = 3.4 * p.rimIntensity;

    // Narrow portrait screens see far less horizontally at the same vertical FOV;
    // pull the camera back along its view line so the whole unit stays in frame.
    this.target.set(p.tgtX, p.tgtY, p.tgtZ);
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < 0.75 ? Math.pow(0.75 / aspect, 0.55) : 1;
    camera.position.set(p.camX, p.camY, p.camZ).sub(this.target).multiplyScalar(fit).add(this.target);

    // Compact landscape: slide the view so the unit occupies the right half, clear of the copy column.
    if (bridge.variant === "compact" && aspect > 1.25) {
      const distance = camera.position.distanceTo(this.target);
      const halfWidth = distance * Math.tan(MathUtils.degToRad(camera.fov / 2)) * aspect;
      this.right.subVectors(this.target, camera.position).cross(camera.up).normalize().multiplyScalar(-0.42 * halfWidth);
      // Compact poses aim low to lift the unit above stacked copy; landscape has no stack, so recentre.
      this.right.addScaledVector(camera.up, 0.3 * (halfWidth / aspect));
      camera.position.add(this.right);
      this.target.add(this.right);
    }
    camera.lookAt(this.target);
    camera.updateMatrixWorld();

    // Project component anchors onto their HTML tags.
    const focusOfTag: Record<TagId, number> = { sense: p.focusSense, compute: p.focusCompute, control: p.focusControl };
    for (const [id, element] of bridge.tags) {
      const anchor = this.anchors[id];
      if (!anchor) continue;
      const opacity = p.tags * rise * (0.38 + 0.62 * focusOfTag[id]);
      element.style.opacity = opacity.toFixed(3);
      element.style.visibility = opacity > 0.01 ? "visible" : "hidden";
      anchor.getWorldPosition(this.world);
      this.world.project(camera);
      const px = (this.world.x * 0.5 + 0.5) * size.width;
      const py = (-this.world.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    }
  }

  /** Releases everything this rig created. Called once when the experience retires. */
  dispose() {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.layerMaterials.forEach(({ material }) => material.dispose());
    Object.values(this.materials).forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
  }
}
