import type {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  SphereGeometry,
  Texture,
  Vector3,
} from "three";

export type EquirectangularPanorama = {
  path: string;
  data?: PanoData | PanoDataProvider;
};

export type PanoData = {
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

export type PanoDataProvider = (
  image: HTMLImageElement,
  xmpData?: PanoData
) => PanoData;

export type EquirectangularTextureData = TextureData<
  Texture,
  string | EquirectangularPanorama,
  PanoData
>;

export type TextureData<
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

export type EquirectangularMesh = Mesh<SphereGeometry, MeshBasicMaterial>;

export type EquirectangularAdapterConfig = {
  /**
   * number of faces of the sphere geometry, higher values may decrease performances
   * @default 64
   */
  resolution?: number;
  /**
   * read real image size from XMP data
   * @default true
   */
  useXmpData?: boolean;
  /**
   * used for equirectangular tiles adapter
   * @internal
   */
  blur?: boolean;
};

export type EquirectangularTilesAdapterConfig = Omit<
  EquirectangularAdapterConfig,
  "interpolateBackground" | "blur"
> & {
  /**
   * shows a warning sign on tiles that cannot be loaded
   * @default true
   */
  showErrorTile?: boolean;
  /**
   * applies a blur effect to the low resolution panorama
   * @default true
   */
  baseBlur?: boolean;
  /**
   * applies antialiasing to high resolutions tiles
   * @default true
   */
  antialias?: boolean;
  /**
   * shows debug helpers
   * @default false
   * @internal
   */
  debug?: boolean;
  camera?: PerspectiveCamera;
  direction?: Vector3;
};

export type EquirectangularTilesPanoData = PanoData & {
  baseData: PanoData;
};

export type EquirectangularTilesPanorama = {
  /**
   * low resolution panorama loaded before tiles
   */
  baseUrl?: string;
  /**
   * panoData configuration associated to low resolution panorama loaded before tiles
   */
  basePanoData?: PanoData | PanoDataProvider;
  /**
   * complete panorama width (height is always width/2)
   */
  width: number;
  /**
   * number of vertical tiles (must be a power of 2)
   */
  cols: number;
  /**
   * number of horizontal tiles (must be a power of 2)
   */
  rows: number;
  /**
   * function to build a tile url
   */
  tileUrl: (col: number, row: number) => string | null;
};

export type EquirectangularTileLevel = {
  /**
   * Lower and upper zoom levels (0-100)
   */
  zoomRange: [number, number];
  /**
   * complete panorama width (height is always width/2)
   */
  width: number;
  /**
   * number of vertical tiles (must be a power of 2)
   */
  cols: number;
  /**
   * number of horizontal tiles (must be a power of 2)
   */
  rows: number;
};

/**
 * Configuration of a tiled panorama with multiple tiles configurations
 */
export type EquirectangularMultiTilesPanorama = {
  /**
   * low resolution panorama loaded before tiles
   */
  baseUrl?: string;
  /**
   * panoData configuration associated to low resolution panorama loaded before tiles
   */
  basePanoData?: PanoData | PanoDataProvider;
  /**
   * Configuration of tiles by zoom level
   */
  levels: EquirectangularTileLevel[];
  /**
   * function to build a tile url
   */
  tileUrl: (col: number, row: number, level: number) => string | null;
};

export type EquirectangularTilesMesh = Mesh<
  SphereGeometry,
  MeshBasicMaterial[]
>;
export type EquirectangularTilesTextureData = TextureData<
  Texture,
  EquirectangularTilesPanorama | EquirectangularMultiTilesPanorama,
  EquirectangularTilesPanoData
>;
export type EquirectangularTile = {
  row: number;
  col: number;
  angle: number;
  config: EquirectangularTileConfig;
  url: string;
};

export type EquirectangularTileConfig = EquirectangularTileLevel & {
  level: number;
  colSize: number;
  rowSize: number;
  facesByCol: number;
  facesByRow: number;
};
