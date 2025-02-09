export function WebGLProgram(
  gl: WebGLRenderingContext,
  parameters: {
    vertexShader: string;
    fragmentShader: string;
    glslVersion?: number;
  }
) {
  let vertexShader = parameters.vertexShader;
  let fragmentShader = parameters.fragmentShader;

  let prefixVertex, prefixFragment;
  let versionString = parameters.glslVersion
    ? "#version " + parameters.glslVersion + "\n"
    : "";

  const program = gl.createProgram()!;

  const vertexGlsl = versionString + prefixVertex + vertexShader;
  const fragmentGlsl = versionString + prefixFragment + fragmentShader;

  const glVertexShader = WebGLShader(gl, gl.VERTEX_SHADER, vertexGlsl);
  const glFragmentShader = WebGLShader(gl, gl.FRAGMENT_SHADER, fragmentGlsl);

  gl.attachShader(program, glVertexShader);
  gl.attachShader(program, glFragmentShader);

  gl.linkProgram(program);
  console.log(1);
  return program;
}

function WebGLShader(gl: WebGLRenderingContext, type: number, string: string) {
  const shader = gl.createShader(type)!;

  gl.shaderSource(shader, string);
  gl.compileShader(shader);

  return shader;
}
