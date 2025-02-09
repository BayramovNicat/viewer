import "../style.css";
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
import { BlobLoader } from "./core/BlobLoader";
import { Cache } from "./core/Cache";

const app = document.getElementById("app")!;
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("webgl2")!;

const SPHERE_RADIUS = 10;
const config = {
  resolution: 64,
  useXmpData: true,
  blur: false,
};
const fileLoader = new BlobLoader();
const SPHERE_SEGMENTS = config.resolution;
const SPHERE_HORIZONTAL_SEGMENTS = SPHERE_SEGMENTS / 2;

type EquirectangularPanorama = {
  path: string;
  data?: PanoData | PanoDataProvider;
};
type PanoData = {
  isEquirectangular?: true;
  fullWidth: number;
  fullHeight?: number;
  croppedWidth?: number;
  croppedHeight?: number;
  croppedX: number;
  croppedY: number;
  poseHeading?: number;
  posePitch?: number;
  poseRoll?: number;
  /* @internal */
  initialHeading?: number;
  /* @internal */
  initialPitch?: number;
  /* @internal */
  initialFov?: number;
};
type PanoDataProvider = (
  image: HTMLImageElement,
  xmpData?: PanoData
) => PanoData;
type EquirectangularTextureData = TextureData<
  Texture,
  string | EquirectangularPanorama,
  PanoData
>;
type TextureData<
  TTexture = Texture | Texture[] | Record<string, Texture>,
  TPanorama = any,
  TData = any
> = {
  /**
   * Actual texture or list of textures
   */
  texture: TTexture;
  /**
   * Original panorama definition
   */
  panorama: TPanorama;
  /**
   * Panorama metadata
   */
  panoData?: TData;
  /**
   * Key used in the loader cache
   */
  cacheKey?: string;
};
type EquirectangularMesh = Mesh<SphereGeometry, MeshBasicMaterial>;

function createTexture(img: TexImageSource, mimaps = false): Texture {
  const texture = new Texture(img);
  texture.needsUpdate = true;
  texture.minFilter = mimaps ? LinearMipmapLinearFilter : LinearFilter;
  texture.generateMipmaps = mimaps;
  texture.anisotropy = mimaps ? 2 : 1;
  return texture;
}
async function loadTexture(
  panorama: string
): Promise<EquirectangularTextureData> {
  const cleanPanorama: EquirectangularPanorama = {
    path: panorama,
  };
  const blob = await loadFile(
    cleanPanorama.path,
    undefined,
    cleanPanorama.path
  );
  const img = await blobToImage(blob);
  const panoData = mergePanoData(img.width, img.height);
  const texture = createEquirectangularTexture(img);

  return {
    panorama,
    texture,
    panoData,
    cacheKey: cleanPanorama.path,
  };
}
function createEquirectangularTexture(img: HTMLImageElement): Texture {
  const maxTextureSize = ctx.getParameter(ctx.MAX_TEXTURE_SIZE);
  if (img.width > maxTextureSize) {
    const ratio = Math.min(1, maxTextureSize / img.width);
    const buffer = new OffscreenCanvas(
      Math.floor(img.width * ratio),
      Math.floor(img.height * ratio)
    );
    const ctx = buffer.getContext("2d")!;
    ctx.drawImage(img, 0, 0, buffer.width, buffer.height);
    return createTexture(buffer);
  }

  return createTexture(img);
}
function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
function loadFile(
  url: string,
  onProgress?: (p: number) => void,
  cacheKey?: string
): Promise<Blob> {
  const cached = Cache.get(url, cacheKey!);

  if (cached) {
    if (cached instanceof Blob) {
      onProgress?.(100);
      return Promise.resolve(cached);
    } else {
      // unlikely case when the image has already been loaded with the ImageLoader
      Cache.remove(url, cacheKey!);
    }
  }

  return new Promise((resolve, reject) => {
    let progress = 0;
    onProgress?.(progress);

    fileLoader.load(
      url,
      (result) => {
        progress = 100;
        onProgress?.(progress);
        Cache.add(url, cacheKey!, result);
        resolve(result);
      },
      (e) => {
        if (e.lengthComputable) {
          const newProgress = (e.loaded / e.total) * 100;
          if (newProgress > progress) {
            progress = newProgress;
            onProgress?.(progress);
          }
        }
      },
      (err) => {
        reject(err);
      }
    );
  });
}
function mergePanoData(
  width: number,
  height: number,
  newPanoData?: PanoData,
  xmpPanoData?: PanoData
): PanoData {
  if (!newPanoData && !xmpPanoData) {
    const fullWidth = Math.max(width, height * 2);
    const fullHeight = Math.round(fullWidth / 2);
    const croppedX = Math.round((fullWidth - width) / 2);
    const croppedY = Math.round((fullHeight - height) / 2);

    newPanoData = {
      fullWidth: fullWidth,
      fullHeight: fullHeight,
      croppedWidth: width,
      croppedHeight: height,
      croppedX: croppedX,
      croppedY: croppedY,
    };
  }

  const panoData: PanoData = {
    isEquirectangular: true,
    fullWidth: newPanoData?.fullWidth || xmpPanoData?.fullWidth || 0,
    fullHeight: newPanoData?.fullHeight || xmpPanoData?.fullHeight,
    croppedWidth:
      newPanoData?.croppedWidth || xmpPanoData?.croppedWidth || width,
    croppedHeight:
      newPanoData?.croppedHeight || xmpPanoData?.croppedHeight || height,
    croppedX: newPanoData?.croppedX || xmpPanoData?.croppedX || 0,
    croppedY: newPanoData?.croppedY || xmpPanoData?.croppedY || 0,
    poseHeading: newPanoData?.poseHeading || xmpPanoData?.poseHeading || 0,
    posePitch: newPanoData?.posePitch || xmpPanoData?.posePitch || 0,
    poseRoll: newPanoData?.poseRoll || xmpPanoData?.poseRoll || 0,
    initialHeading: xmpPanoData?.initialHeading,
    initialPitch: xmpPanoData?.initialPitch,
    initialFov: xmpPanoData?.initialFov,
  };

  if (!panoData.fullWidth && panoData.fullHeight) {
    panoData.fullWidth = panoData.fullHeight * 2;
  } else if (!panoData.fullWidth || !panoData.fullHeight) {
    panoData.fullWidth = panoData.fullWidth ?? width;
    panoData.fullHeight = panoData.fullHeight ?? height;
  }

  if (panoData.croppedWidth !== width || panoData.croppedHeight !== height) {
    console.warn(`Invalid panoData, croppedWidth/croppedHeight is not coherent with the loaded image.
      panoData: ${panoData.croppedWidth}x${panoData.croppedHeight}, image: ${width}x${height}`);
  }

  if (Math.abs(panoData.fullWidth - panoData.fullHeight * 2) > 1) {
    console.warn("Invalid panoData, fullWidth should be twice fullHeight");
    panoData.fullHeight = Math.round(panoData.fullWidth / 2);
  }
  if (panoData.croppedX + panoData.croppedWidth! > panoData.fullWidth) {
    console.warn("Invalid panoData, croppedX + croppedWidth > fullWidth");
    panoData.croppedX = panoData.fullWidth - panoData.croppedWidth!;
  }
  if (panoData.croppedY + panoData.croppedHeight! > panoData.fullHeight) {
    console.warn("Invalid panoData, croppedY + croppedHeight > fullHeight");
    panoData.croppedY = panoData.fullHeight - panoData.croppedHeight!;
  }
  if (panoData.croppedX < 0) {
    console.warn("Invalid panoData, croppedX < 0");
    panoData.croppedX = 0;
  }
  if (panoData.croppedY < 0) {
    console.warn("Invalid panoData, croppedY < 0");
    panoData.croppedY = 0;
  }

  return panoData;
}
function createMesh(panoData: PanoData): EquirectangularMesh {
  const hStart = (panoData.croppedX / panoData.fullWidth) * 2 * Math.PI;
  const hLength = (panoData.croppedWidth! / panoData.fullWidth) * 2 * Math.PI;
  const vStart = (panoData.croppedY / panoData.fullHeight!) * Math.PI;
  const vLength = (panoData.croppedHeight! / panoData.fullHeight!) * Math.PI;

  // The middle of the panorama is placed at yaw=0
  const geometry = new SphereGeometry(
    SPHERE_RADIUS,
    Math.round((SPHERE_SEGMENTS / (2 * Math.PI)) * hLength),
    Math.round((SPHERE_HORIZONTAL_SEGMENTS / Math.PI) * vLength),
    -Math.PI / 2 + hStart,
    hLength,
    vStart,
    vLength
  ).scale(-1, 1, 1);

  const material = new MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
  });

  return new Mesh(geometry, material);
}

async function init() {
  let lat = 0,
    lon = 0,
    phi = 0,
    theta = 0,
    isUserInteracting = false;

  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  app.appendChild(renderer.domElement);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  const camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    2 * SPHERE_RADIUS
  );
  camera.position.set(0, 0, 0.1); // Set initial camera position
  camera.matrixAutoUpdate = false;

  const scene = new Scene();
  const textureData = await loadTexture("./panorama/panorama.jpg");
  textureData.texture.colorSpace = SRGBColorSpace;
  const mesh = createMesh(textureData.panoData!);
  mesh.material.onBeforeCompile = (shader) => {
    console.log(shader.vertexShader); // Logs the vertex shader
    console.log(shader.fragmentShader); // Logs the fragment shader
  };
  mesh.material.map = textureData.texture; // Assign the texture to the material
  scene.add(mesh);

  function animate() {
    if (isUserInteracting === false) {
      lon += 0.1;
    }

    lat = Math.max(-85, Math.min(85, lat));
    phi = MathUtils.degToRad(90 - lat);
    theta = MathUtils.degToRad(lon);

    const x = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
    const y = SPHERE_RADIUS * Math.cos(phi);
    const z = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);

    camera.lookAt(x, y, z);
    camera.updateMatrix(); // Update the camera matrix

    renderer.render(scene, camera);
  }
}

init();
