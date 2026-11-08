// Small WebGL2 helpers for the shader scene.

export const compile = (gl: WebGL2RenderingContext, vertex: string, fragment: string) => {
  const stage = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader failed to compile");
    }
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, stage(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, stage(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, "corner");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "shader failed to link");
  }
  return program;
};

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });

export const texture = (gl: WebGL2RenderingContext, image: HTMLImageElement, exact: boolean) => {
  const handle = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, handle);
  // Map images hold data, not pictures, so the browser must not recolour them.
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, exact ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, exact ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR);
  if (!exact) gl.generateMipmap(gl.TEXTURE_2D);
  return handle;
};
