import {
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Texture,
} from "three";
import type {
  EquirectangularAdapterConfig,
  EquirectangularMesh,
  EquirectangularPanorama,
  EquirectangularTextureData,
  PanoData,
} from "./types";
import { BlobLoader } from "./BlobLoader";
import { Cache } from "./Cache";

export function equirectangularAdapter(
  config: EquirectangularAdapterConfig = {
    resolution: 64,
    useXmpData: true,
    blur: false,
  }
) {
  const SPHERE_RADIUS = 10;
  const SPHERE_SEGMENTS = config.resolution!;
  const SPHERE_HORIZONTAL_SEGMENTS = SPHERE_SEGMENTS / 2;

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

  function setTexture(
    mesh: EquirectangularMesh,
    textureData: EquirectangularTextureData
  ) {
    mesh.material.map = textureData.texture;
  }

  function setTextureOpacity(mesh: EquirectangularMesh, opacity: number) {
    mesh.material.opacity = opacity;
    mesh.material.transparent = opacity < 1;
  }

  function disposeTexture({ texture }: EquirectangularTextureData) {
    texture.dispose();
  }

  function disposeMesh(mesh: EquirectangularMesh) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  return {
    createMesh,
    loadTexture,
    setTexture,
    setTextureOpacity,
    disposeTexture,
    disposeMesh,
  };
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

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("webgl2")!;
canvas.width = 0;
canvas.height = 0;
const maxTextureSize = ctx.getParameter(ctx.MAX_TEXTURE_SIZE);

function createEquirectangularTexture(img: HTMLImageElement): Texture {
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

function createTexture(img: TexImageSource, mimaps = false): Texture {
  const texture = new Texture(img);
  texture.needsUpdate = true;
  texture.minFilter = mimaps ? LinearMipmapLinearFilter : LinearFilter;
  texture.generateMipmaps = mimaps;
  texture.anisotropy = mimaps ? 2 : 1;
  return texture;
}

const fileLoader = new BlobLoader();
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
