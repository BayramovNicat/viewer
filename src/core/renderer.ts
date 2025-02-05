import {
  Group,
  LinearSRGBColorSpace,
  LinearToneMapping,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import { TextureData } from "./types";

const SPHERE_RADIUS = 10;
const VIEWER_DATA = "photoSphereViewer";
const SYSTEM = {
  pixelRatio: window.devicePixelRatio || 1,
};

export function renderer(viewer: any) {
  const config = viewer.config;
  //   const state = viewer.state;
  const renderer = new WebGLRenderer(config.rendererParameters);
  renderer.setPixelRatio(SYSTEM.pixelRatio);
  // https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = LinearToneMapping;
  renderer.domElement.className = "psv-canvas";
  renderer.domElement.style.background = config.canvasBackground;

  let meshContainer: Group | undefined;
  let mesh: Object3D | undefined;

  const scene = new Scene();

  const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 2 * SPHERE_RADIUS);
  camera.matrixAutoUpdate = false;

  // mesh used to detect clicks on the viewer
  const raycasterMesh = new Mesh(
    new SphereGeometry(SPHERE_RADIUS).scale(-1, 1, 1),
    new MeshBasicMaterial({
      opacity: 0,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  raycasterMesh.userData = { [VIEWER_DATA]: true };
  scene.add(raycasterMesh);

  // const raycaster = new Raycaster();
  // const frustum = new Frustum();

  const container = document.createElement("div");
  container.className = "psv-canvas-container";
  container.appendChild(renderer.domElement);
  viewer.container.appendChild(container);

  container.addEventListener("contextmenu", (e) => e.preventDefault());

  // viewer.addEventListener(SizeUpdatedEvent.type, this);
  // viewer.addEventListener(ZoomUpdatedEvent.type, this);
  // viewer.addEventListener(PositionUpdatedEvent.type, this);
  // viewer.addEventListener(RollUpdatedEvent.type, this);
  // viewer.addEventListener(ConfigChangedEvent.type, this);

  hide();

  function hide() {
    container.style.opacity = "0";
  }

  function setTexture(textureData: TextureData) {
    if (!meshContainer) {
      meshContainer = new Group();
      scene.add(meshContainer);
    }

    // if (state.textureData) {
    //   viewer.adapter.disposeTexture(state.textureData);
    // }

    if (mesh) {
      meshContainer.remove(mesh);
      viewer.adapter.disposeMesh(mesh);
    }

    mesh = viewer.adapter.createMesh(textureData.panoData);
    viewer.adapter.setTexture(mesh, textureData, false);
    meshContainer.add(mesh!);

    // state.textureData = textureData;

    viewer.needsUpdate();
  }

  return { setTexture };
}
