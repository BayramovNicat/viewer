import "./style.css";
import { mat4 } from "gl-matrix";

const viewer = createPanoramaViewer("app", "/panorama.jpeg");
viewer.yaw = 90;

function createPanoramaViewer(elmId: string, url: string) {
  const container = document.getElementById(elmId)!;
  if (!container) {
    throw Error("Container not found");
  }

  // create canvas
  const canvas = document.createElement("canvas");
  const gl = initWebGlContext(canvas, {});

  container.appendChild(canvas);

  // get pixel ratio
  const dpr = window.devicePixelRatio;

  let width = 1;
  let height = 1;

  resizeCanvas();

  const shaderProgram = initShaderProgram();
  const programInfo = getProgramInfo(shaderProgram);
  const sphere = createSphere(128, 64);
  const buffers = initBuffers(sphere);
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
    canvas.width = width * dpr;
    canvas.height = height * dpr;
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
    positions: number[];
    textureCoordinates: number[];
    indices: number[];
  }) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(sphere.positions),
      gl.STATIC_DRAW
    );

    const textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(sphere.textureCoordinates),
      gl.STATIC_DRAW
    );

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(sphere.indices),
      gl.STATIC_DRAW
    );

    return {
      position: positionBuffer,
      textureCoord: textureCoordBuffer,
      indices: indexBuffer,
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
      fov = clamp(fov, deg2rad(30), deg2rad(120));
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
    gl.drawElements(gl.TRIANGLES, sphere.indexCount, gl.UNSIGNED_SHORT, 0);
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
      fov = deg2rad(value);
      drawScene();
    },
  };
}

function createSphere(latitudeBands: number, longitudeBands: number) {
  // latitude bands must be power of 2
  if (!isPowerOf2(latitudeBands)) {
    throw new Error("latitudeBands must be power of 2");
  }

  // longitudeBands must be half of latitudeBands
  if (longitudeBands !== latitudeBands / 2) {
    throw new Error("longitudeBands must be half of latitudeBands");
  }

  const positions = [];
  const textureCoordinates = [];
  const indices = [];

  for (let latNumber = 0; latNumber <= latitudeBands; latNumber++) {
    const theta = (latNumber * Math.PI) / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let longNumber = 0; longNumber <= longitudeBands; longNumber++) {
      const phi = (longNumber * 2 * Math.PI) / longitudeBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;
      const u = longNumber / longitudeBands;
      const v = latNumber / latitudeBands;

      positions.push(x, y, z);
      textureCoordinates.push(u, v);
    }
  }

  for (let latNumber = 0; latNumber < latitudeBands; latNumber++) {
    for (let longNumber = 0; longNumber < longitudeBands; longNumber++) {
      const first = latNumber * (longitudeBands + 1) + longNumber;
      const second = first + longitudeBands + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    positions: positions,
    textureCoordinates: textureCoordinates,
    indices: indices,
    indexCount: indices.length,
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
