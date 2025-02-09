import type { Camera, Scene } from "three";
import {
  vertexShader as vertex,
  fragmentShader as fragment,
} from "../shaders/meshbasic.glsl";
import { WebGLProgram } from "./WebGLProgram";
import { parameter } from "three/tsl";

export class CustomWebGLRenderer {
  domElement: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: any;

  constructor() {
    this.domElement = document.createElement("canvas");
    this.gl = this.domElement.getContext("webgl") as WebGLRenderingContext;

    if (!this.gl) {
      console.error("WebGL not supported");
    }
  }

  setPixelRatio(ratio: number) {
    console.log(`Setting pixel ratio to ${ratio}`);
  }

  setSize(width: number, height: number) {
    this.domElement.width = width;
    this.domElement.height = height;
    this.gl.viewport(0, 0, width, height);
    console.log(`Setting size to ${width}x${height}`);
  }

  setAnimationLoop(callback: () => void) {
    const loop = () => {
      callback();
      requestAnimationFrame(loop);
    };
    loop();
  }

  render(scene: Scene, camera: Camera) {
    if (!this.gl) return;

    // Check if the camera is valid
    if (camera.isCamera !== true) {
      console.error(
        "CustomWebGLRenderer.render: camera is not an instance of THREE.Camera."
      );
      return;
    }

    // Clear the canvas
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    if (!this.program) {
      this.program = WebGLProgram(this.gl, {
        vertexShader: vertex,
        fragmentShader: fragment,
      });
    }
    const program = this.program;
    // const program = WebGLProgram(this.gl, {
    //   vertexShader: vertex,
    //   fragmentShader: fragment,
    // });

    // Set up shaders using simplified meshbasic.glsl.ts
    // const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertex);
    // const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragment);

    // Create and link the program
    // const program = this.createProgram(vertexShader, fragmentShader);
    // this.gl.useProgram(program);

    // Update scene graph
    if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();

    // Update camera matrices
    if (camera.parent === null && camera.matrixWorldAutoUpdate === true)
      camera.updateMatrixWorld();

    // Iterate over scene children to find meshes
    // console.log(scene.children);
    scene.children.forEach((object: any) => {
      if (object.isMesh) {
        // Bind buffers and attributes for each mesh
        this.bindMesh(object, program);

        // Set camera uniforms if needed
        this.setCameraUniforms(camera, program);

        // Draw the mesh
        this.gl.drawArrays(
          this.gl.TRIANGLES,
          0,
          object.geometry.attributes.position.count
        );
      }
    });

    // Reset state if necessary
    // Example: this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  private bindMesh(mesh: any, program: WebGLProgram) {
    // Bind the position buffer
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(mesh.positions),
      this.gl.STATIC_DRAW
    );

    const positionAttributeLocation = this.gl.getAttribLocation(
      program,
      "a_position"
    );
    this.gl.enableVertexAttribArray(positionAttributeLocation);
    this.gl.vertexAttribPointer(
      positionAttributeLocation,
      3,
      this.gl.FLOAT,
      false,
      0,
      0
    );
  }

  private setCameraUniforms(camera: any, program: WebGLProgram) {
    // Set camera-related uniforms if needed
    // Example: this.gl.uniformMatrix4fv(cameraUniformLocation, false, camera.matrix);
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      throw new Error("Shader compilation failed");
    }
    return shader;
  }

  private createProgram(
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader
  ): WebGLProgram {
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      throw new Error("Program linking failed");
    }
    return program;
  }
}
