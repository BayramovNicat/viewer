import {
  MathUtils,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { equirectangularTilesAdapter } from "./core/equirectangularTilesAdapter";
import "./style.css";

const SPHERE_RADIUS = 10;
const vector = new Vector3();

async function init() {
  let isUserInteracting = false,
    onPointerDownMouseX = 0,
    onPointerDownMouseY = 0,
    lon = 0,
    onPointerDownLon = 0,
    lat = 0,
    onPointerDownLat = 0,
    phi = 0,
    theta = 0;

  const direction = new Vector3();

  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  const app = document.getElementById("app")!;
  app.appendChild(renderer.domElement);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  const camera = new PerspectiveCamera(
    90,
    window.innerWidth / window.innerHeight,
    0.1,
    2 * SPHERE_RADIUS
  );
  // camera.position.set(0, 0, 0.1); // Set initial camera position
  camera.matrixAutoUpdate = false;

  const adapter = equirectangularTilesAdapter({ camera, direction });

  const scene = new Scene();
  const textureData = await adapter.loadTexture({
    width: 8192,
    cols: 16,
    rows: 8,
    baseUrl: `./panorama_thumb.jpeg`,
    tileUrl: (col: number, row: number) => {
      return `./tiles/image${col + 1}x${row + 1}.jpg`;
    },
  });
  textureData.texture.colorSpace = SRGBColorSpace;
  const mesh = adapter.createMesh(textureData.panoData!);
  // mesh.material.map = textureData.texture; // Assign the texture to the material
  adapter.setTexture(mesh, textureData);
  scene.add(mesh);

  app.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("wheel", onDocumentMouseWheel);
  window.addEventListener("resize", onWindowResize);

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.isPrimary === false) return;

    isUserInteracting = true;

    onPointerDownMouseX = event.clientX;
    onPointerDownMouseY = event.clientY;

    onPointerDownLon = lon;
    onPointerDownLat = lat;

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.isPrimary === false) return;

    lon = (onPointerDownMouseX - event.clientX) * 0.1 + onPointerDownLon;
    lat = (event.clientY - onPointerDownMouseY) * 0.1 + onPointerDownLat;
  }

  function onPointerUp(event: PointerEvent) {
    if (event.isPrimary === false) return;

    isUserInteracting = false;

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  }

  function onDocumentMouseWheel(event: WheelEvent) {
    const fov = camera.fov + event.deltaY * 0.05;

    camera.fov = MathUtils.clamp(fov, 10, 75);

    camera.updateProjectionMatrix();
  }

  function animate() {
    if (isUserInteracting === false) {
      lon += 0.1;
    }
    adapter.refresh();

    lat = Math.max(-85, Math.min(85, lat));
    phi = MathUtils.degToRad(90 - lat);
    theta = MathUtils.degToRad(lon);

    vector.x = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
    vector.y = SPHERE_RADIUS * Math.cos(phi);
    vector.z = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);
    // direction.set(x, y, z);

    // theta rad2deg
    // theta = ;

    // console.log(MathUtils.radToDeg(theta));

    sphericalCoordsToVector3(
      {
        yaw: theta,
        pitch: phi,
      },
      direction
    );
    // direction.set(x, y, z);

    const position = vector3ToSphericalCoords(vector);
    sphericalCoordsToVector3(position, direction);

    // console log direction angle
    // console.log(MathUtils.radToDeg(Math.atan2(direction.x, direction.z)));

    // camera.lookAt(x, y, z);
    // camera.updateMatrix(); // Update the camera matrix

    camera.position.set(0, 0, 0);
    camera.lookAt(direction);

    camera.updateMatrix();
    camera.updateMatrixWorld();

    renderer.render(scene, camera);
  }
}

init();

function sphericalCoordsToVector3(
  position: Position,
  vector?: Vector3,
  distance = SPHERE_RADIUS
): Vector3 {
  if (!vector) {
    vector = new Vector3();
  }
  vector.x = distance * -Math.cos(position.pitch) * Math.sin(position.yaw);
  vector.y = distance * Math.sin(position.pitch);
  vector.z = distance * Math.cos(position.pitch) * Math.cos(position.yaw);
  return vector;
}

function vector3ToSphericalCoords(vector: Vector3): Position {
  const phi = Math.acos(
    vector.y /
      Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)
  );
  const theta = Math.atan2(vector.x, vector.z);

  return {
    yaw: theta < 0 ? -theta : Math.PI * 2 - theta,
    pitch: Math.PI / 2 - phi,
  };
}

type Position = {
  yaw: number;
  pitch: number;
};
