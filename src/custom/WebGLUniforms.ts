/**
 * Uniforms of a program.
 * Those form a tree structure with a special top-level container for the root,
 * which you get by calling 'new WebGLUniforms( gl, program )'.
 *
 *
 * Properties of inner nodes including the top-level container:
 *
 * .seq - array of nested uniforms
 * .map - nested uniforms by name
 *
 *
 * Methods of all nodes except the top-level container:
 *
 * .setValue( gl, value, [textures] )
 *
 * 		uploads a uniform value(s)
 *  	the 'textures' parameter is needed for sampler uniforms
 *
 *
 * Static methods of the top-level container (textures factorizations):
 *
 * .upload( gl, seq, values, textures )
 *
 * 		sets uniforms in 'seq' to 'values[id].value'
 *
 * .seqWithValue( seq, values ) : filteredSeq
 *
 * 		filters 'seq' entries with corresponding entry in values
 *
 *
 * Methods of the top-level container (textures factorizations):
 *
 * .setValue( gl, name, value, textures )
 *
 * 		sets uniform with  name 'name' to 'value'
 *
 * .setOptional( gl, obj, prop )
 *
 * 		like .set for an optional property of the object
 *
 */

import { CubeTexture } from "../../textures/CubeTexture.js";
import { Texture } from "../../textures/Texture.js";
import { DataArrayTexture } from "../../textures/DataArrayTexture.js";
import { Data3DTexture } from "../../textures/Data3DTexture.js";
import { DepthTexture } from "../../textures/DepthTexture.js";
import { LessEqualCompare } from "../../constants.js";

const emptyTexture = /*@__PURE__*/ new Texture();

// --- Utilities ---

// Array Caches (provide typed arrays for temporary by size)

const arrayCacheF32 = [];
const arrayCacheI32 = [];

// Float32Array caches used for uploading Matrix uniforms

const mat4array = new Float32Array(16);
const mat3array = new Float32Array(9);
const mat2array = new Float32Array(4);

// Flattening for arrays of vectors and matrices

function flatten(array, nBlocks, blockSize) {
  const firstElem = array[0];

  if (firstElem <= 0 || firstElem > 0) return array;

  const n = nBlocks * blockSize;
  let r = arrayCacheF32[n];

  if (r === undefined) {
    r = new Float32Array(n);
    arrayCacheF32[n] = r;
  }

  if (nBlocks !== 0) {
    firstElem.toArray(r, 0);

    for (let i = 1, offset = 0; i !== nBlocks; ++i) {
      offset += blockSize;
      array[i].toArray(r, offset);
    }
  }

  return r;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;

  for (let i = 0, l = a.length; i < l; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

function copyArray(a, b) {
  for (let i = 0, l = b.length; i < l; i++) {
    a[i] = b[i];
  }
}

// Texture unit allocation

function allocTexUnits(textures, n) {
  let r = arrayCacheI32[n];

  if (r === undefined) {
    r = new Int32Array(n);
    arrayCacheI32[n] = r;
  }

  for (let i = 0; i !== n; ++i) {
    r[i] = textures.allocateTextureUnit();
  }

  return r;
}

// --- Setters ---

// Note: Defining these methods externally, because they come in a bunch
// and this way their names minify.

// Single scalar

function setValueV1f(gl, v) {
  const cache = this.cache;

  if (cache[0] === v) return;

  gl.uniform1f(this.addr, v);

  cache[0] = v;
}

// Single float vector (from flat array or THREE.VectorN)

function setValueV2f(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y) {
      gl.uniform2f(this.addr, v.x, v.y);

      cache[0] = v.x;
      cache[1] = v.y;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform2fv(this.addr, v);

    copyArray(cache, v);
  }
}

function setValueV3f(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
      gl.uniform3f(this.addr, v.x, v.y, v.z);

      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
    }
  } else if (v.r !== undefined) {
    if (cache[0] !== v.r || cache[1] !== v.g || cache[2] !== v.b) {
      gl.uniform3f(this.addr, v.r, v.g, v.b);

      cache[0] = v.r;
      cache[1] = v.g;
      cache[2] = v.b;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform3fv(this.addr, v);

    copyArray(cache, v);
  }
}

function setValueV4f(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (
      cache[0] !== v.x ||
      cache[1] !== v.y ||
      cache[2] !== v.z ||
      cache[3] !== v.w
    ) {
      gl.uniform4f(this.addr, v.x, v.y, v.z, v.w);

      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
      cache[3] = v.w;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform4fv(this.addr, v);

    copyArray(cache, v);
  }
}

// Single matrix (from flat array or THREE.MatrixN)

function setValueM2(gl, v) {
  const cache = this.cache;
  const elements = v.elements;

  if (elements === undefined) {
    if (arraysEqual(cache, v)) return;

    gl.uniformMatrix2fv(this.addr, false, v);

    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements)) return;

    mat2array.set(elements);

    gl.uniformMatrix2fv(this.addr, false, mat2array);

    copyArray(cache, elements);
  }
}

function setValueM3(gl, v) {
  const cache = this.cache;
  const elements = v.elements;

  if (elements === undefined) {
    if (arraysEqual(cache, v)) return;

    gl.uniformMatrix3fv(this.addr, false, v);

    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements)) return;

    mat3array.set(elements);

    gl.uniformMatrix3fv(this.addr, false, mat3array);

    copyArray(cache, elements);
  }
}

function setValueM4(gl, v) {
  const cache = this.cache;
  const elements = v.elements;

  if (elements === undefined) {
    if (arraysEqual(cache, v)) return;

    gl.uniformMatrix4fv(this.addr, false, v);

    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements)) return;

    mat4array.set(elements);

    gl.uniformMatrix4fv(this.addr, false, mat4array);

    copyArray(cache, elements);
  }
}

// Single integer / boolean

function setValueV1i(gl, v) {
  const cache = this.cache;

  if (cache[0] === v) return;

  gl.uniform1i(this.addr, v);

  cache[0] = v;
}

// Single integer / boolean vector (from flat array or THREE.VectorN)

function setValueV2i(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y) {
      gl.uniform2i(this.addr, v.x, v.y);

      cache[0] = v.x;
      cache[1] = v.y;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform2iv(this.addr, v);

    copyArray(cache, v);
  }
}

function setValueV3i(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
      gl.uniform3i(this.addr, v.x, v.y, v.z);

      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform3iv(this.addr, v);

    copyArray(cache, v);
  }
}

function setValueV4i(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (
      cache[0] !== v.x ||
      cache[1] !== v.y ||
      cache[2] !== v.z ||
      cache[3] !== v.w
    ) {
      gl.uniform4i(this.addr, v.x, v.y, v.z, v.w);

      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
      cache[3] = v.w;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform4iv(this.addr, v);

    copyArray(cache, v);
  }
}

// Single unsigned integer

function setValueV1ui(gl, v) {
  const cache = this.cache;

  if (cache[0] === v) return;

  gl.uniform1ui(this.addr, v);

  cache[0] = v;
}

// Single unsigned integer vector (from flat array or THREE.VectorN)

function setValueV2ui(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y) {
      gl.uniform2ui(this.addr, v.x, v.y);

      cache[0] = v.x;
      cache[1] = v.y;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform2uiv(this.addr, v);

    copyArray(cache, v);
  }
}

function setValueV3ui(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
      gl.uniform3ui(this.addr, v.x, v.y, v.z);

      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform3uiv(this.addr, v);

    copyArray(cache, v);
  }
}

function setValueV4ui(gl, v) {
  const cache = this.cache;

  if (v.x !== undefined) {
    if (
      cache[0] !== v.x ||
      cache[1] !== v.y ||
      cache[2] !== v.z ||
      cache[3] !== v.w
    ) {
      gl.uniform4ui(this.addr, v.x, v.y, v.z, v.w);

      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
      cache[3] = v.w;
    }
  } else {
    if (arraysEqual(cache, v)) return;

    gl.uniform4uiv(this.addr, v);

    copyArray(cache, v);
  }
}

// Single texture (2D)

function setValueT1(gl, v, textures) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();

  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }

  textures.setTexture2D(v || emptyTexture, unit);
}

// --- Uniform Classes ---

class SingleUniform {
  constructor(id, activeInfo, addr) {
    this.id = id;
    this.addr = addr;
    this.cache = [];
    this.type = activeInfo.type;
    this.setValue = getSingularSetter(activeInfo.type);
  }
}

// Helper to pick the right setter for the singular case

function getSingularSetter(type) {
  switch (type) {
    case 0x1406:
      return setValueV1f; // FLOAT
    case 0x8b50:
      return setValueV2f; // _VEC2
    case 0x8b51:
      return setValueV3f; // _VEC3
    case 0x8b52:
      return setValueV4f; // _VEC4

    case 0x8b5a:
      return setValueM2; // _MAT2
    case 0x8b5b:
      return setValueM3; // _MAT3
    case 0x8b5c:
      return setValueM4; // _MAT4

    case 0x1404:
    case 0x8b56:
      return setValueV1i; // INT, BOOL
    case 0x8b53:
    case 0x8b57:
      return setValueV2i; // _VEC2
    case 0x8b54:
    case 0x8b58:
      return setValueV3i; // _VEC3
    case 0x8b55:
    case 0x8b59:
      return setValueV4i; // _VEC4

    case 0x1405:
      return setValueV1ui; // UINT
    case 0x8dc6:
      return setValueV2ui; // _VEC2
    case 0x8dc7:
      return setValueV3ui; // _VEC3
    case 0x8dc8:
      return setValueV4ui; // _VEC4

    case 0x8b5e: // SAMPLER_2D
    case 0x8d66: // SAMPLER_EXTERNAL_OES
    case 0x8dca: // INT_SAMPLER_2D
    case 0x8dd2: // UNSIGNED_INT_SAMPLER_2D
    case 0x8b62: // SAMPLER_2D_SHADOW
      return setValueT1;
  }
}

// --- Top-level ---

class WebGLUniforms {
  constructor(gl, program) {
    this.seq = [];
    this.map = {};

    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    for (let i = 0; i < n; ++i) {
      const info = gl.getActiveUniform(program, i),
        addr = gl.getUniformLocation(program, info.name);

      parseUniform(info, addr, this);
    }
  }

  setValue(gl, name, value, textures) {
    const u = this.map[name];

    if (u !== undefined) u.setValue(gl, value, textures);
  }

  setOptional(gl, object, name) {
    const v = object[name];

    if (v !== undefined) this.setValue(gl, name, v);
  }

  static upload(gl, seq, values, textures) {
    for (let i = 0, n = seq.length; i !== n; ++i) {
      const u = seq[i],
        v = values[u.id];

      if (v.needsUpdate !== false) {
        // note: always updating when .needsUpdate is undefined
        u.setValue(gl, v.value, textures);
      }
    }
  }

  static seqWithValue(seq, values) {
    const r = [];

    for (let i = 0, n = seq.length; i !== n; ++i) {
      const u = seq[i];
      if (u.id in values) r.push(u);
    }

    return r;
  }
}

export { WebGLUniforms };
