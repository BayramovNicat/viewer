import { MeshBasicMaterial, WebGLRenderer } from "three";
import { PerspectiveCamera } from "three/src/cameras/PerspectiveCamera.js";
import { SRGBColorSpace } from "three/src/constants.js";
import { SphereGeometry } from "three/src/geometries/SphereGeometry.js";
import { TextureLoader } from "three/src/loaders/TextureLoader.js";
import { MathUtils } from "three/src/math/MathUtils.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { Scene } from "three/src/scenes/Scene.js";
import { fragmentShader, vertexShader } from "./shaders/meshbasic.glsl";
import "./style.css";
import { CustomWebGLRenderer } from "./custom/CustomWebGLRenderer";

init();

function init() {
  let isUserInteracting = false,
    lon = 0,
    lat = 0,
    phi = 0,
    theta = 0;

  const container = document.getElementById("app");

  const camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    1100
  );

  const scene = new Scene();

  const geometry = new SphereGeometry(500, 60, 40);
  // invert the geometry on the x-axis so that all of the faces point inward
  geometry.scale(-1, 1, 1);

  const texture = new TextureLoader().load("./panorama/panorama.jpg");
  texture.colorSpace = SRGBColorSpace;

  const material = new MeshBasicMaterial({
    map: texture,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = vertexShader;
    shader.fragmentShader = fragmentShader;
  };

  //   console.log(material);

  const mesh = new Mesh(geometry, material);

  scene.add(mesh);

  //   const renderer = new WebGLRenderer();
  const renderer = new CustomWebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  container?.appendChild(renderer.domElement);

  function animate() {
    if (isUserInteracting === false) {
      lon += 0.1;
    }

    lat = Math.max(-85, Math.min(85, lat));
    phi = MathUtils.degToRad(90 - lat);
    theta = MathUtils.degToRad(lon);

    const x = 500 * Math.sin(phi) * Math.cos(theta);
    const y = 500 * Math.cos(phi);
    const z = 500 * Math.sin(phi) * Math.sin(theta);

    camera.lookAt(x, y, z);

    renderer.render(scene, camera);
  }
}
