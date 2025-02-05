import {
  Box3,
  BufferAttribute,
  Frustum,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import { equirectangularAdapter } from "./equirectangularAdapter";
import {
  EquirectangularMesh,
  EquirectangularMultiTilesPanorama,
  EquirectangularTile,
  EquirectangularTileConfig,
  EquirectangularTileLevel,
  EquirectangularTilesAdapterConfig,
  EquirectangularTilesMesh,
  EquirectangularTilesPanoData,
  EquirectangularTilesPanorama,
  EquirectangularTilesTextureData,
  PanoData,
} from "./types";
import { Cache } from "./Cache";
import { BlobLoader } from "./BlobLoader";
import { Queue, Task } from "./Queue";
import { ImageLoader } from "./ImageLoader";

const ATTR_POSITION = "position";
const SPHERE_RADIUS = 10;
const NB_VERTICES_BY_FACE = 6;
const NB_VERTICES_BY_SMALL_FACE = 3;
const ATTR_UV = "uv";
const ERROR_LEVEL = -1;

const vertexPosition = new Vector3();

export function equirectangularTilesAdapter(
  config: EquirectangularTilesAdapterConfig = {
    resolution: 64,
    showErrorTile: true,
    baseBlur: true,
    antialias: true,
    debug: false,
    useXmpData: false,
    camera: new PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      2 * SPHERE_RADIUS
    ),
    direction: new Vector3(),
  }
) {
  const state = {
    tileConfig: null as unknown as EquirectangularTileConfig,
    tiles: {} as Record<string, boolean>,
    faces: {} as Record<number, number>,
    geom: null as unknown as SphereGeometry,
    materials: [] as MeshBasicMaterial[],
    errorMaterial: null as unknown as MeshBasicMaterial,
    inTransition: false,
  };
  const queue = new Queue();
  let pano:
    | EquirectangularMultiTilesPanorama
    | EquirectangularTilesPanorama
    | undefined;

  const adapter = equirectangularAdapter({
    resolution: config.resolution,
    blur: config.baseBlur,
  });

  let frustumNeedsUpdate = true;
  const frustum = new Frustum();
  const matrix4 = new Matrix4();
  const box3 = new Box3();

  const SPHERE_SEGMENTS = config.resolution || 64;
  const SPHERE_HORIZONTAL_SEGMENTS = SPHERE_SEGMENTS / 2;

  console.log({ SPHERE_SEGMENTS, SPHERE_HORIZONTAL_SEGMENTS });

  const NB_VERTICES =
    2 * SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE +
    (SPHERE_HORIZONTAL_SEGMENTS - 2) * SPHERE_SEGMENTS * NB_VERTICES_BY_FACE;
  const NB_GROUPS = SPHERE_SEGMENTS * SPHERE_HORIZONTAL_SEGMENTS;

  const camera = config.camera!;

  let meshContainer: Group | undefined;

  function createMesh(panoData: EquirectangularTilesPanoData): Group {
    // mesh for the base panorama
    const baseMesh = adapter.createMesh(panoData.baseData ?? panoData);

    // mesh for the tiles
    const geometry = new SphereGeometry(
      SPHERE_RADIUS,
      SPHERE_SEGMENTS,
      SPHERE_HORIZONTAL_SEGMENTS,
      -Math.PI / 2
    )
      .scale(-1, 1, 1)
      .toNonIndexed() as SphereGeometry;

    geometry.clearGroups();
    let i = 0;
    let k = 0;
    // first row
    for (
      ;
      i < SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE;
      i += NB_VERTICES_BY_SMALL_FACE
    ) {
      geometry.addGroup(i, NB_VERTICES_BY_SMALL_FACE, k++);
    }
    // second to before last rows
    for (
      ;
      i < NB_VERTICES - SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE;
      i += NB_VERTICES_BY_FACE
    ) {
      geometry.addGroup(i, NB_VERTICES_BY_FACE, k++);
    }
    // last row
    for (; i < NB_VERTICES; i += NB_VERTICES_BY_SMALL_FACE) {
      geometry.addGroup(i, NB_VERTICES_BY_SMALL_FACE, k++);
    }

    const materials: MeshBasicMaterial[] = [];
    const material = new MeshBasicMaterial({
      opacity: 0,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    for (let g = 0; g < NB_GROUPS; g++) {
      materials.push(material);
    }

    const tilesMesh = new Mesh(geometry, materials);
    tilesMesh.renderOrder = 1;

    const group = new Group();
    group.add(baseMesh);
    group.add(tilesMesh);
    meshContainer = group;
    __switchMesh(meshContainer);
    return group;
  }

  function __switchMesh(group: Group) {
    const [, tilesMesh] = meshes(group);

    __cleanup();

    state.materials = tilesMesh.material;
    state.geom = tilesMesh.geometry;

    setTimeout(() => __refresh());
  }

  function __cleanup() {
    queue.clear();
    state.tiles = {};
    state.faces = {};
    state.materials = [];
    state.inTransition = false;
  }

  async function loadTexture(
    panorama: EquirectangularTilesPanorama | EquirectangularMultiTilesPanorama
  ): Promise<EquirectangularTilesTextureData> {
    checkPanoramaConfig(panorama, {
      SPHERE_SEGMENTS,
      SPHERE_HORIZONTAL_SEGMENTS,
    });

    pano = panorama;

    const firstTile = getTileConfig(panorama, 0, {
      SPHERE_SEGMENTS,
      SPHERE_HORIZONTAL_SEGMENTS,
    });
    const panoData: PanoData = {
      isEquirectangular: true,
      fullWidth: firstTile.width,
      fullHeight: firstTile.width / 2,
      croppedWidth: firstTile.width,
      croppedHeight: firstTile.width / 2,
      croppedX: 0,
      croppedY: 0,
      poseHeading: 0,
      posePitch: 0,
      poseRoll: 0,
    };

    if (panorama.baseUrl) {
      const textureData = await adapter.loadTexture(panorama.baseUrl);

      return {
        panorama,
        panoData: {
          ...panoData,
          baseData: textureData.panoData!,
        },
        cacheKey: textureData.cacheKey,
        texture: textureData.texture,
      };
    } else {
      return {
        panorama,
        panoData: undefined,
        cacheKey: getCacheKey(panorama, firstTile),
        texture: undefined as unknown as Texture,
      };
    }
  }

  function setTexture(
    group: Group,
    textureData: EquirectangularTilesTextureData
  ) {
    const [baseMesh] = meshes(group);

    if (textureData.texture) {
      adapter.setTexture(baseMesh, {
        panorama: textureData.panorama.baseUrl!,
        texture: textureData.texture,
        panoData: textureData.panoData!.baseData,
      });
    } else {
      baseMesh.visible = false;
    }
  }

  function setTextureOpacity(group: Group, opacity: number) {
    const [baseMesh] = meshes(group);
    adapter.setTextureOpacity(baseMesh, opacity);
  }

  function disposeTexture({ texture }: EquirectangularTilesTextureData) {
    texture?.dispose();
  }

  function disposeMesh(group: Group) {
    const [baseMesh, tilesMesh] = meshes(group);

    baseMesh.geometry.dispose();
    baseMesh.material.dispose();

    tilesMesh.geometry.dispose();
    tilesMesh.material.forEach((m) => m.dispose());
  }

  const direction = config.direction!;

  function __refresh() {
    if (!state.geom || state.inTransition) {
      return;
    }

    frustumNeedsUpdate = true;

    const panorama = pano as
      | EquirectangularTilesPanorama
      | EquirectangularMultiTilesPanorama;
    const zoomLevel = 100;
    const tileConfig = getTileConfig(panorama, zoomLevel, {
      SPHERE_SEGMENTS,
      SPHERE_HORIZONTAL_SEGMENTS,
    });

    const verticesPosition = state.geom.getAttribute(
      ATTR_POSITION
    ) as BufferAttribute;
    const tilesToLoad: Record<string, EquirectangularTile> = {};

    for (let i = 0; i < NB_VERTICES; i += 1) {
      vertexPosition.fromBufferAttribute(verticesPosition, i);
      vertexPosition.applyEuler(meshContainer!.rotation);

      if (isObjectVisible(vertexPosition, camera)) {
        // compute position of the segment (3 or 6 vertices)
        let segmentIndex;
        if (i < SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE) {
          // first row
          segmentIndex = Math.floor(i / 3);
        } else if (
          i <
          NB_VERTICES - SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE
        ) {
          // second to before last rows
          segmentIndex =
            Math.floor((i / 3 - SPHERE_SEGMENTS) / 2) + SPHERE_SEGMENTS;
        } else {
          // last row
          segmentIndex =
            Math.floor(
              (i - NB_VERTICES - SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE) /
                3
            ) +
            SPHERE_HORIZONTAL_SEGMENTS * (SPHERE_SEGMENTS - 1);
        }
        const segmentRow = Math.floor(segmentIndex / SPHERE_SEGMENTS);
        const segmentCol = segmentIndex - segmentRow * SPHERE_SEGMENTS;

        let config = tileConfig;
        while (config) {
          // compute the position of the tile
          const row = Math.floor(segmentRow / config.facesByRow);
          const col = Math.floor(segmentCol / config.facesByCol);
          let angle = vertexPosition.angleTo(direction);
          if (row === 0 || row === config.rows - 1) {
            angle *= 2; // lower priority to top and bottom tiles
          }

          const tile: EquirectangularTile = {
            row,
            col,
            angle,
            config,
            url: null!,
          };
          const id = tileId(tile);

          if (tilesToLoad[id]) {
            tilesToLoad[id].angle = Math.min(tilesToLoad[id].angle, angle);
            break;
          } else {
            tile.url = panorama.tileUrl(col, row, config.level)!;

            if (tile.url) {
              tilesToLoad[id] = tile;
              break;
            } else {
              console.log("no url");
              //   // if no url is returned, try a lower tile level
              //   config = getTileConfigByIndex(panorama, config.level - 1, this);
            }
          }
        }
      }
    }

    state.tileConfig = tileConfig;
    __loadTiles(Object.values(tilesToLoad));
  }

  /**
   * Loads tiles and change existing tiles priority
   */
  function __loadTiles(tiles: EquirectangularTile[]) {
    queue.disableAllTasks();

    tiles.forEach((tile) => {
      const id = tileId(tile);

      if (state.tiles[id]) {
        queue.setPriority(id, tile.angle);
      } else {
        state.tiles[id] = true;
        queue.enqueue(
          new Task(id, tile.angle, (task) => __loadTile(tile, task))
        );
      }
    });

    queue.start();
  }

  function isObjectVisible(
    value: Object3D | Vector3,
    camera: PerspectiveCamera
  ): boolean {
    if (!value) {
      return false;
    }

    if (frustumNeedsUpdate) {
      matrix4.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(matrix4);
      frustumNeedsUpdate = false;
    }

    // return true;

    if ((value as Vector3).isVector3) {
      return frustum.containsPoint(value as Vector3);
    } else if ((value as Mesh).isMesh && (value as Mesh).geometry) {
      // Frustum.intersectsObject uses the boundingSphere by default
      // for better precision we prefer the boundingBox
      const mesh = value as Mesh;
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      box3.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
      return frustum.intersectsBox(box3);
    } else if ((value as Object3D).isObject3D) {
      return frustum.intersectsObject(value as Object3D);
    } else {
      return false;
    }
  }

  /**
   * Loads and draw a tile
   */
  function __loadTile(tile: EquirectangularTile, task: Task): Promise<any> {
    return loadImage(tile.url, undefined)
      .then((image: HTMLImageElement) => {
        if (!task.isCancelled()) {
          const mipmaps = config.antialias && tile.config.level > 0;
          const material = new MeshBasicMaterial({
            map: createTexture(image, mipmaps),
          });
          __swapMaterial(tile, material, false);
          needsUpdate();
        }
      })
      .catch(() => {
        if (!task.isCancelled() && config.showErrorTile) {
          //   if (!state.errorMaterial) {
          //     state.errorMaterial = buildErrorMaterial();
          //   }
          __swapMaterial(tile, state.errorMaterial, true);
          needsUpdate();
        }
      });
  }

  function __swapMaterial(
    tile: EquirectangularTile,
    material: MeshBasicMaterial,
    isError: boolean
  ) {
    const uvs = state.geom.getAttribute(ATTR_UV) as BufferAttribute;

    for (let c = 0; c < tile.config.facesByCol; c++) {
      for (let r = 0; r < tile.config.facesByRow; r++) {
        // position of the face
        const faceCol = tile.col * tile.config.facesByCol + c;
        const faceRow = tile.row * tile.config.facesByRow + r;
        const isFirstRow = faceRow === 0;
        const isLastRow = faceRow === SPHERE_HORIZONTAL_SEGMENTS - 1;

        // first vertex for this face (3 or 6 vertices in total)
        let firstVertex: number;
        if (isFirstRow) {
          firstVertex = faceCol * NB_VERTICES_BY_SMALL_FACE;
        } else if (isLastRow) {
          firstVertex =
            NB_VERTICES -
            SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE +
            faceCol * NB_VERTICES_BY_SMALL_FACE;
        } else {
          firstVertex =
            SPHERE_SEGMENTS * NB_VERTICES_BY_SMALL_FACE +
            (faceRow - 1) * SPHERE_SEGMENTS * NB_VERTICES_BY_FACE +
            faceCol * NB_VERTICES_BY_FACE;
        }

        // in case of error, skip the face if already showing valid data
        if (isError && state.faces[firstVertex] > ERROR_LEVEL) {
          continue;
        }
        // skip this face if its already showing an higher resolution
        if (state.faces[firstVertex] > tile.config.level) {
          continue;
        }
        state.faces[firstVertex] = isError ? ERROR_LEVEL : tile.config.level;

        // swap material
        const matIndex = state.geom.groups.find(
          (g) => g.start === firstVertex
        )?.materialIndex;
        if (matIndex) {
          state.materials[matIndex] = material;
        }

        // define new uvs
        const top = 1 - r / tile.config.facesByRow;
        const bottom = 1 - (r + 1) / tile.config.facesByRow;
        const left = c / tile.config.facesByCol;
        const right = (c + 1) / tile.config.facesByCol;

        if (isFirstRow) {
          uvs.setXY(firstVertex, (left + right) / 2, top);
          uvs.setXY(firstVertex + 1, left, bottom);
          uvs.setXY(firstVertex + 2, right, bottom);
        } else if (isLastRow) {
          uvs.setXY(firstVertex, right, top);
          uvs.setXY(firstVertex + 1, left, top);
          uvs.setXY(firstVertex + 2, (left + right) / 2, bottom);
        } else {
          uvs.setXY(firstVertex, right, top);
          uvs.setXY(firstVertex + 1, left, top);
          uvs.setXY(firstVertex + 2, right, bottom);
          uvs.setXY(firstVertex + 3, left, top);
          uvs.setXY(firstVertex + 4, left, bottom);
          uvs.setXY(firstVertex + 5, right, bottom);
        }
      }
    }

    uvs.needsUpdate = true;
  }

  let _needsUpdate = false;
  function needsUpdate() {
    _needsUpdate = true;
  }

  return {
    createMesh,
    loadTexture,
    setTexture,
    setTextureOpacity,
    disposeTexture,
    disposeMesh,
    refresh: __refresh,
    get needsUpdate() {
      return _needsUpdate;
    },
  };
}

function checkTile(
  tile: EquirectangularTilesPanorama | EquirectangularTileLevel,
  data: { SPHERE_SEGMENTS: number; SPHERE_HORIZONTAL_SEGMENTS: number }
) {
  if (!tile.width || !tile.cols || !tile.rows) {
    throw new Error(
      "Invalid panorama configuration, are you using the right adapter?"
    );
  }
  if (tile.cols > data.SPHERE_SEGMENTS) {
    throw new Error(
      `Panorama cols must not be greater than ${data.SPHERE_SEGMENTS}.`
    );
  }
  if (tile.rows > data.SPHERE_HORIZONTAL_SEGMENTS) {
    throw new Error(
      `Panorama rows must not be greater than ${data.SPHERE_HORIZONTAL_SEGMENTS}.`
    );
  }
  if (
    !MathUtils.isPowerOfTwo(tile.cols) ||
    !MathUtils.isPowerOfTwo(tile.rows)
  ) {
    throw new Error("Panorama cols and rows must be powers of 2.");
  }
}

function getCacheKey(
  panorama: EquirectangularTilesPanorama | EquirectangularMultiTilesPanorama,
  firstTile: EquirectangularTileConfig
): string {
  // some tiles might be "null"
  for (let i = 0; i < firstTile.cols; i++) {
    const url = panorama.tileUrl(i, firstTile.rows / 2, firstTile.level);
    if (url) {
      return url;
    }
  }

  return panorama.tileUrl.toString();
}

function checkPanoramaConfig(
  panorama: EquirectangularTilesPanorama | EquirectangularMultiTilesPanorama,
  data: { SPHERE_SEGMENTS: number; SPHERE_HORIZONTAL_SEGMENTS: number }
) {
  if (typeof panorama !== "object" || !panorama.tileUrl) {
    throw new Error(
      "Invalid panorama configuration, are you using the right adapter?"
    );
  }

  if (isMultiTiles(panorama)) {
    panorama.levels.forEach((level) => checkTile(level, data));
    checkTilesLevels(panorama.levels);
  } else {
    checkTile(panorama, data);
  }
}

function isMultiTiles(
  panorama: EquirectangularTilesPanorama | EquirectangularMultiTilesPanorama
): panorama is EquirectangularMultiTilesPanorama {
  return !!(panorama as EquirectangularMultiTilesPanorama).levels;
}

function checkTilesLevels(levels: Array<{ zoomRange: [number, number] }>) {
  let previous = 0;
  levels.forEach((level, i) => {
    if (!level.zoomRange || level.zoomRange.length !== 2) {
      throw new Error(`Tiles level ${i} is missing "zoomRange" property`);
    }
    if (
      level.zoomRange[0] >= level.zoomRange[1] ||
      level.zoomRange[0] !== previous ||
      (i === 0 && level.zoomRange[0] !== 0) ||
      (i === levels.length - 1 && level.zoomRange[1] !== 100)
    ) {
      throw new Error(
        `Tiles levels' "zoomRange" are not orderer or are not covering the whole 0-100 range`
      );
    }
    previous = level.zoomRange[1];
  });
}

function getTileConfig(
  panorama: EquirectangularTilesPanorama | EquirectangularMultiTilesPanorama,
  zoomLevel: number,
  data: { SPHERE_SEGMENTS: number; SPHERE_HORIZONTAL_SEGMENTS: number }
): EquirectangularTileConfig {
  let tile: EquirectangularTileLevel;
  let level: number;
  if (!isMultiTiles(panorama)) {
    level = 0;
    tile = {
      ...panorama,
      zoomRange: [0, 100],
    };
  } else {
    level = getTileIndexByZoomLevel(panorama.levels, zoomLevel);
    tile = panorama.levels[level];
  }
  return computeTileConfig(tile, level, data);
}

function getTileIndexByZoomLevel<T extends { zoomRange: [number, number] }>(
  levels: T[],
  zoomLevel: number
): number {
  return levels.findIndex((level) => {
    return zoomLevel >= level.zoomRange[0] && zoomLevel <= level.zoomRange[1];
  });
}

function computeTileConfig(
  tile: EquirectangularTileLevel,
  level: number,
  data: { SPHERE_SEGMENTS: number; SPHERE_HORIZONTAL_SEGMENTS: number }
): EquirectangularTileConfig {
  return {
    ...tile,
    level,
    colSize: tile.width / tile.cols,
    rowSize: tile.width / 2 / tile.rows,
    facesByCol: data.SPHERE_SEGMENTS / tile.cols,
    facesByRow: data.SPHERE_HORIZONTAL_SEGMENTS / tile.rows,
  };
}

function meshes(group: Group) {
  return group.children as [EquirectangularMesh, EquirectangularTilesMesh];
}

const imageLoader = new ImageLoader();

function loadImage(
  url: string,
  onProgress?: (p: number) => void,
  cacheKey?: string
): Promise<HTMLImageElement> {
  const cached = Cache.get(url, cacheKey!);

  if (cached) {
    onProgress?.(100);
    if (cached instanceof Blob) {
      // unlikely case when the image has already been loaded with the FileLoader
      return blobToImage(cached);
    } else {
      return Promise.resolve(cached);
    }
  }

  if (!onProgress) {
    return new Promise((resolve, reject) => {
      imageLoader.load(
        url,
        (result) => {
          Cache.add(url, cacheKey!, result);
          resolve(result);
        },
        (err) => {
          reject(err);
        }
        //   __getAbortSignal(cacheKey)
      );
    });
  } else {
    return loadFile(url, onProgress, cacheKey).then((blob) =>
      blobToImage(blob)
    );
  }
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

function createTexture(img: TexImageSource, mimaps = false): Texture {
  const texture = new Texture(img);
  texture.needsUpdate = true;
  texture.minFilter = mimaps ? LinearMipmapLinearFilter : LinearFilter;
  texture.generateMipmaps = mimaps;
  texture.anisotropy = mimaps ? 2 : 1;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function tileId(tile: EquirectangularTile): string {
  return `${tile.col}x${tile.row}/${tile.config.level}`;
}
