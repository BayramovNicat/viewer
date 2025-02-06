import "./style.css";
import { mat4 } from "gl-matrix";

const viewer = createPanoramaViewer("app", "/panorama.jpeg");
viewer.yaw = 180;
viewer.fov = 180;

function createPanoramaViewer(elmId: string, url: string) {
  const container = document.getElementById(elmId)!;
  if (!container) {
    throw Error("Container not found");
  }

  const DPR = window.devicePixelRatio;
  const MIN_FOV = 10;
  const MAX_FOV = 140;
  let width = 1;
  let height = 1;

  // create canvas
  const canvas = document.createElement("canvas");
  const gl = initWebGlContext(canvas);
  container.appendChild(canvas);

  resizeCanvas();

  const shaderProgram = initShaderProgram();
  const programInfo = getProgramInfo(shaderProgram);

  const geometry = sphereGeometry(100, 128, 64);

  const webglAttrs = webGLAttributes(gl);
  const buffers = initBuffers(geometry);
  const texture = loadTexture(url);

  let isDragging = false;
  let yaw = 0;
  let pitch = 0;
  let fov = deg2rad(90);

  setupPointerEvents();
  setupScrollEvent();

  window.addEventListener("resize", () => {
    resizeCanvas();
    drawScene();
  });

  drawScene();

  function resizeCanvas() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width * DPR;
    canvas.height = height * DPR;
  }

  function initShaderProgram(): WebGLProgram {
    const vsSource = `
      attribute vec4 aVertexPosition;
      attribute vec2 aTextureCoord;
      varying highp vec2 vTextureCoord;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vTextureCoord = aTextureCoord;
      }
    `;

    const fsSource = `
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      void main(void) {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
      }
    `;

    const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) {
      throw Error("Unable to create shader program");
    }
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      throw Error(
        `Unable to initialize the shader program: ${gl.getProgramInfoLog(
          shaderProgram
        )}`
      );
    }

    return shaderProgram;
  }

  function loadShader(type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw Error("Unable to create shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw Error(
        `An error occurred compiling the shaders: ${gl.getShaderInfoLog(
          shader
        )}`
      );
    }

    return shader;
  }

  function getProgramInfo(shaderProgram: WebGLProgram) {
    return {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
        textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(
          shaderProgram,
          "uProjectionMatrix"
        ),
        modelViewMatrix: gl.getUniformLocation(
          shaderProgram,
          "uModelViewMatrix"
        ),
        uSampler: gl.getUniformLocation(shaderProgram, "uSampler"),
      },
    };
  }

  function initBuffers(sphere: {
    position: Float32Array;
    normal?: Float32Array;
    uv: Float32Array;
    indices: number[];
  }) {
    const position = webglAttrs.update(
      {
        array: sphere.position,
        usage: gl.STATIC_DRAW,
      },
      gl.ARRAY_BUFFER
    );

    const textureCoord = webglAttrs.update(
      {
        array: sphere.uv,
        usage: gl.STATIC_DRAW,
      },
      gl.ARRAY_BUFFER
    );

    const indices = webglAttrs.update(
      {
        array: new Uint16Array(sphere.indices),
        usage: gl.STATIC_DRAW,
      },
      gl.ELEMENT_ARRAY_BUFFER
    );

    return {
      position,
      textureCoord,
      indices,
    };
  }

  function loadTexture(url: string) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 0, 0]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel
    );

    const image = new Image();
    image.onload = function () {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );

      if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }

      drawScene();
    };
    image.src = url;

    return texture;
  }

  function setupPointerEvents() {
    let previousMouseX = 0;
    let previousMouseY = 0;

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isDragging = true;
      canvas.style.cursor = "all-scroll";
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    });

    document.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.clientY - previousMouseY;

      const rotationSpeed = 0.005 * (90 / ((fov * 180) / Math.PI));

      yaw -= deltaX * rotationSpeed;
      pitch -= deltaY * rotationSpeed;

      const maxPitch = Math.PI / 2;
      const minPitch = -Math.PI / 2;
      pitch = clamp(pitch, minPitch, maxPitch);

      previousMouseX = e.clientX;
      previousMouseY = e.clientY;

      drawScene();
    });

    document.addEventListener("pointerup", () => {
      isDragging = false;
      canvas.style.cursor = "";
    });
  }

  function setupScrollEvent() {
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      fov += e.deltaY * zoomSpeed * (Math.PI / 180);
      fov = clamp(fov, deg2rad(MIN_FOV), deg2rad(MAX_FOV));
      drawScene();
    });
  }

  function drawScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = width / height;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    mat4.perspective(projectionMatrix, fov, aspect, zNear, zFar);

    const modelViewMatrix = mat4.create();
    mat4.rotate(modelViewMatrix, modelViewMatrix, pitch, [1, 0, 0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, yaw, [0, 1, 0]);

    // Set up vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      3, // numComponents
      gl.FLOAT, // type
      false, // normalize
      0, // stride
      0 // offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    // Set up texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
      programInfo.attribLocations.textureCoord,
      2, // numComponents
      gl.FLOAT, // type
      false, // normalize
      0, // stride
      0 // offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix
    );
    gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.drawElements(
      gl.TRIANGLES,
      geometry.indices.length,
      gl.UNSIGNED_SHORT,
      0
    );
  }

  return {
    get yaw() {
      return rad2deg(yaw);
    },
    set yaw(value) {
      yaw = deg2rad(value);
      drawScene();
    },
    get pitch() {
      return rad2deg(pitch);
    },
    set pitch(value) {
      pitch = deg2rad(value);
      drawScene();
    },
    get fov() {
      return rad2deg(fov);
    },
    set fov(value) {
      fov = deg2rad(clamp(value, MIN_FOV, MAX_FOV));
      drawScene();
    },
  };
}

function isPowerOf2(value: number) {
  return (value & (value - 1)) === 0;
}

function deg2rad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function rad2deg(radians: number) {
  return (radians * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function initWebGlContext(
  canvas: HTMLCanvasElement,
  opts?: {
    antialias?: boolean;
    preserveDrawingBuffer?: boolean;
    wrapContext?: (gl: WebGLRenderingContext) => WebGLRenderingContext;
  }
) {
  const options = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: !!opts?.antialias,
    preserveDrawingBuffer: !!opts?.preserveDrawingBuffer,
  };

  let gl =
    canvas.getContext &&
    ((canvas.getContext("webgl", options) ||
      canvas.getContext(
        "experimental-webgl",
        options
      )) as WebGLRenderingContext);

  if (!gl) {
    throw new Error("Could not get WebGL context");
  }

  if (opts?.wrapContext) {
    gl = opts.wrapContext(gl);
  }

  return gl;
}

// function sphereGeometry(latitudeBands: number, longitudeBands: number) {
//   // latitude bands must be power of 2
//   if (!isPowerOf2(latitudeBands)) {
//     throw new Error("latitudeBands must be power of 2");
//   }

//   // longitudeBands must be half of latitudeBands
//   if (longitudeBands !== latitudeBands / 2) {
//     throw new Error("longitudeBands must be half of latitudeBands");
//   }

//   const positions = [];
//   const textureCoordinates = [];
//   const indices = [];

//   for (let latNumber = 0; latNumber <= latitudeBands; latNumber++) {
//     const theta = (latNumber * Math.PI) / latitudeBands;
//     const sinTheta = Math.sin(theta);
//     const cosTheta = Math.cos(theta);

//     for (let longNumber = 0; longNumber <= longitudeBands; longNumber++) {
//       const phi = (longNumber * 2 * Math.PI) / longitudeBands;
//       const sinPhi = Math.sin(phi);
//       const cosPhi = Math.cos(phi);

//       const x = cosPhi * sinTheta;
//       const y = cosTheta;
//       const z = sinPhi * sinTheta;
//       const u = longNumber / longitudeBands;
//       const v = latNumber / latitudeBands;

//       positions.push(x, y, z);
//       textureCoordinates.push(u, v);
//     }
//   }

//   for (let latNumber = 0; latNumber < latitudeBands; latNumber++) {
//     for (let longNumber = 0; longNumber < longitudeBands; longNumber++) {
//       const first = latNumber * (longitudeBands + 1) + longNumber;
//       const second = first + longitudeBands + 1;

//       indices.push(first, second, first + 1);
//       indices.push(second, second + 1, first + 1);
//     }
//   }

//   return {
//     position: new Float32Array(positions),
//     uv: new Float32Array(textureCoordinates),
//     indices: indices,
//   };
// }

function sphereGeometry(
  radius = 1,
  widthSegments = 32,
  heightSegments = 16,
  phiStart = 0,
  phiLength = Math.PI * 2,
  thetaStart = 0,
  thetaLength = Math.PI
) {
  widthSegments = Math.max(3, Math.floor(widthSegments));
  heightSegments = Math.max(2, Math.floor(heightSegments));

  const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);

  let index = 0;
  const grid: number[][] = [];

  const vertex = vector3();
  const normal = vector3();

  // buffers
  const indices: number[] = [];
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  // generate vertices, normals and uvs
  for (let iy = 0; iy <= heightSegments; iy++) {
    const verticesRow = [];

    const v = iy / heightSegments;

    // special case for the poles
    let uOffset = 0;

    if (iy === 0 && thetaStart === 0) {
      uOffset = 0.5 / widthSegments;
    } else if (iy === heightSegments && thetaEnd === Math.PI) {
      uOffset = -0.5 / widthSegments;
    }

    for (let ix = 0; ix <= widthSegments; ix++) {
      const u = ix / widthSegments;

      // vertex
      vertex.x =
        -radius *
        Math.cos(phiStart + u * phiLength) *
        Math.sin(thetaStart + v * thetaLength);
      vertex.y = radius * Math.cos(thetaStart + v * thetaLength);
      vertex.z =
        radius *
        Math.sin(phiStart + u * phiLength) *
        Math.sin(thetaStart + v * thetaLength);

      vertices.push(vertex.x, vertex.y, vertex.z);

      // normal
      normal.copy(vertex).normalize();
      normals.push(normal.x, normal.y, normal.z);

      // uv
      uvs.push(1 - u + uOffset, v);

      verticesRow.push(index++);
    }

    grid.push(verticesRow);
  }

  // indices
  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = grid[iy][ix + 1];
      const b = grid[iy][ix];
      const c = grid[iy + 1][ix];
      const d = grid[iy + 1][ix + 1];

      if (iy !== 0 || thetaStart > 0) indices.push(a, b, d);
      if (iy !== heightSegments - 1 || thetaEnd < Math.PI)
        indices.push(b, c, d);
    }
  }

  // build geometry

  return {
    indices,
    position: new Float32Array(vertices),
    normal: new Float32Array(normals),
    uv: new Float32Array(uvs),
  };
}

function vector3(x = 0, y = 0, z = 0) {
  const res = {
    x,
    y,
    z,
    copy,
    normalize,
    divideScalar,
    length,
    multiplyScalar,
  };

  function copy(v: { x: number; y: number; z: number }) {
    x = v.x;
    y = v.y;
    z = v.z;

    return res;
  }

  function normalize() {
    return divideScalar(length() || 1);
  }

  function divideScalar(scalar: number) {
    return multiplyScalar(1 / scalar);
  }

  function length() {
    return Math.sqrt(x * x + y * y + z * z);
  }

  function multiplyScalar(scalar: number) {
    x *= scalar;
    y *= scalar;
    z *= scalar;

    return res;
  }

  return res;
}

type BufferAttribute = {
  array: ArrayBufferView;
  usage: GLenum;
  onUploadCallback?: () => void;
  version?: number;
  isFloat16BufferAttribute?: boolean;
};

type GlAttribute = {
  buffer: WebGLBuffer;
  type: number;
  bytesPerElement: number;
  version: number;
  size: number;
};

function webGLAttributes(gl: WebGLRenderingContext) {
  const buffers: WeakMap<BufferAttribute, GlAttribute> = new WeakMap();

  function createBuffer(
    attribute: BufferAttribute,
    bufferType: GLenum
  ): GlAttribute {
    const array = attribute.array;
    const usage: GLenum = attribute.usage;
    const size = array.byteLength;

    const buffer = gl.createBuffer()!;

    gl.bindBuffer(bufferType, buffer);
    gl.bufferData(bufferType, array, usage);

    attribute.onUploadCallback?.();

    let type: number;

    if (array instanceof Float32Array) {
      type = gl.FLOAT;
    } else if (array instanceof Uint16Array) {
      if (attribute.isFloat16BufferAttribute) {
        type =
          gl.getExtension("OES_texture_half_float")?.HALF_FLOAT_OES ||
          gl.UNSIGNED_SHORT;
      } else {
        type = gl.UNSIGNED_SHORT;
      }
    } else if (array instanceof Int16Array) {
      type = gl.SHORT;
    } else if (array instanceof Uint32Array) {
      type = gl.UNSIGNED_INT;
    } else if (array instanceof Int32Array) {
      type = gl.INT;
    } else if (array instanceof Int8Array) {
      type = gl.BYTE;
    } else if (array instanceof Uint8Array) {
      type = gl.UNSIGNED_BYTE;
    } else if (array instanceof Uint8ClampedArray) {
      type = gl.UNSIGNED_BYTE;
    } else {
      throw new Error("Unsupported buffer data format: " + array);
    }

    return {
      buffer,
      size,
      type: type,
      bytesPerElement: array.BYTES_PER_ELEMENT,
      version: attribute.version || 0,
    };
  }

  function updateBuffer(
    buffer: WebGLBuffer,
    attribute: BufferAttribute,
    bufferType: number
  ) {
    const array = attribute.array;

    gl.bindBuffer(bufferType, buffer);

    gl.bufferSubData(bufferType, 0, array);
    attribute.onUploadCallback?.();
  }

  function get(attribute: BufferAttribute) {
    return buffers.get(attribute);
  }

  function remove(attribute: BufferAttribute): void {
    const data = buffers.get(attribute);
    if (data) {
      gl.deleteBuffer(data.buffer);
      buffers.delete(attribute);
    }
  }

  function update(attribute: BufferAttribute, bufferType: number): WebGLBuffer {
    const data = buffers.get(attribute);
    if (data === undefined) {
      const newData = createBuffer(attribute, bufferType);
      buffers.set(attribute, newData);
      return newData.buffer!;
    }

    if (data.version < attribute.version!) {
      if (data.size !== attribute.array.byteLength) {
        throw new Error(
          "The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported."
        );
      }
      updateBuffer(data.buffer, attribute, bufferType);
      data.version = attribute.version!;
    }

    return data.buffer;
  }

  return {
    get,
    remove,
    update,
  };
}
