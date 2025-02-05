import "./style.css";
import { mat4 } from "gl-matrix";

const canvas = document.getElementById("viewer") as HTMLCanvasElement;

setTimeout(() => {
  const viewer = createPanoramaViewer(canvas);
  if (!viewer) return;
  viewer.yaw = 90;
}, 10);

function createPanoramaViewer(canvas: HTMLCanvasElement) {
  let width = 1;
  let height = 1;

  resizeCanvas();

  const gl = canvas.getContext("webgl")!;
  if (!gl) {
    console.error("WebGL not supported");
    return;
  }

  const shaderProgram = initShaderProgram()!;
  const programInfo = getProgramInfo(shaderProgram);
  const sphere = createSphere(90, 90);
  const buffers = initBuffers(sphere);
  // const texture = loadTexture(url);

  let isDragging = false;
  let yaw = 0;
  let pitch = 0;
  let fov = deg2rad(90);

  setupPointerEvents();
  setupScrollEvent();

  const tiles = loadTiles();

  window.addEventListener("resize", () => {
    resizeCanvas();
    drawScene();
  });

  drawScene();

  function resizeCanvas() {
    const parentElement = canvas.parentElement;
    width = parentElement?.clientWidth || 1;
    height = parentElement?.clientHeight || 1;
    canvas.width = width;
    canvas.height = height;
  }

  function initShaderProgram() {
    const vsSource = `
      attribute vec4 aVertexPosition;
      attribute vec2 aTextureCoord;
      varying highp vec2 vTextureCoord;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      uniform vec4 uTileOffset;
      void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        
        vec2 tileCoord = floor(aTextureCoord);
        vec2 localCoord = fract(aTextureCoord);
        
        // Add padding to prevent seams
        vec2 padding = vec2(0.002);
        localCoord = mix(vec2(0.0) - padding, vec2(1.0) + padding, localCoord);
        
        bool inTile = tileCoord.x == uTileOffset.x && tileCoord.y == uTileOffset.y;
        vTextureCoord = inTile ? clamp(localCoord, 0.0, 1.0) : vec2(-1.0);
      }
    `;

    const fsSource = `
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      void main(void) {
        if (vTextureCoord.x < 0.0) {
          discard;
        }
        gl_FragColor = texture2D(uSampler, vTextureCoord);
      }
    `;

    const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource)!;
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource)!;

    const shaderProgram = gl.createProgram()!;
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.error(
        "Unable to initialize the shader program: " +
          gl.getProgramInfoLog(shaderProgram)
      );
      return null;
    }

    return shaderProgram;
  }

  function loadShader(type: WebGLProgram, source: any) {
    const shader = gl.createShader(type as any)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(
        "An error occurred compiling the shaders: " +
          gl.getShaderInfoLog(shader)
      );
      gl.deleteShader(shader);
      return null;
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
        tileOffset: gl.getUniformLocation(shaderProgram, "uTileOffset"),
      },
    };
  }

  function initBuffers(sphere: any) {
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
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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

  function loadTiles() {
    const tiles = [];
    const tilesX = 10;
    const tilesY = 5;

    // Load tiles in reverse order for Y to match sphere UV mapping
    for (let y = tilesY - 1; y >= 0; y--) {
      for (let x = 0; x < tilesX; x++) {
        const index = y * tilesX + x + 1;
        const tileUrl = `./tiles/${index}.jpg`;
        const texture = loadTexture(tileUrl);
        tiles.push({
          texture,
          x,
          y: tilesY - y - 1, // Flip Y coordinate
          width: 1,
          height: 1,
        });
      }
    }
    return tiles;
  }

  function createSphere(latitudeBands: number, longitudeBands: number) {
    const positions = [];
    const textureCoordinates = [];
    const indices = [];

    const tilesX = 10;
    const tilesY = 5;

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

        // Adjust UV mapping with slight overlap
        const u = (longNumber / longitudeBands) * tilesX;
        const v = (1.001 - latNumber / latitudeBands) * tilesY;

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

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const tilesX = 10;
    const tilesY = 5;

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const tileIndex = y * tilesX + x;
        const tile = tiles[tileIndex];

        if (!tile) continue;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
          programInfo.attribLocations.vertexPosition,
          3,
          gl.FLOAT,
          false,
          0,
          0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
          programInfo.attribLocations.textureCoord,
          2,
          gl.FLOAT,
          false,
          0,
          0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        // Update tile offset for this section
        gl.uniform4fv(programInfo.uniformLocations.tileOffset, [
          tile.x,
          tile.y,
          1.0,
          1.0,
        ]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tile.texture);
        gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

        gl.drawElements(gl.TRIANGLES, sphere.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    }
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

function deg2rad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function rad2deg(radians: number) {
  return (radians * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
