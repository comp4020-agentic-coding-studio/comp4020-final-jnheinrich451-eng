import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { compile, loadImage, texture } from "./gl";
import layers from "../public/layers/layers.json";

// Shots 1a-1c: lights wake in the dark, the helmet ignites, a red wave runs out
// through the ship, then the camera pulls back from the close image to the wide one.

const VERTEX = `#version 300 es
in vec2 corner;
out vec2 screen;
void main() {
  screen = corner * 0.5 + 0.5;
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

// Shared by both passes: where the camera looks and when each point wakes.
const COMMON = `#version 300 es
precision highp float;
in vec2 screen;
out vec4 result;
uniform float time, view, closeMix, shakeX, shakeY;
uniform vec4 closeRect;
uniform vec2 helmet;

const float WAVE_START = 3.3;
const float WAVE_SPEED = 0.34;

vec2 pixelAt(vec2 p) {
  return vec2(p.x, 1.0 - p.y);
}
vec2 wideAt(vec2 p) {
  return helmet + (pixelAt(p) - 0.5) * view + vec2(shakeX, shakeY);
}
vec2 closeAt(vec2 wide) {
  return (wide - closeRect.xy) / closeRect.zw;
}
float waveTime(vec2 wide) {
  vec2 q = (wide - helmet) * vec2(16.0 / 9.0, 1.0);
  // Mostly right-angled, because the wall's cables run in straight lines.
  float reach = 0.65 * (abs(q.x) + abs(q.y)) + 0.35 * length(q);
  return WAVE_START + reach / WAVE_SPEED;
}
`;

// Pass 1: only the lights, each switched by its own timing.
const LIGHTS = `${COMMON}
uniform sampler2D wideGlow, wideMap, closeGlow, closeMap;

float stutter(float age, float phase) {
  if (age < 0.0) return 0.0;
  if (age > 0.3) return 1.0;
  return step(0.42, fract(age * (17.0 + 11.0 * phase) + phase));
}

float reveal(vec3 data, vec2 wide) {
  float delay = data.r, phase = data.g;
  float kind = floor(data.b * 255.0 / 60.0 + 0.5);
  float on;
  if (kind < 0.5) {
    on = stutter(time - (0.7 + delay * 2.1), phase);
  } else if (kind < 1.5) {
    on = stutter(time - waveTime(wide) - delay * 0.4, phase);
  } else if (kind < 2.5) {
    on = smoothstep(0.0, 0.16, time - waveTime(wide));
  } else {
    vec2 q = (wide - helmet) * vec2(16.0 / 9.0, 1.0);
    float around = abs(atan(q.x, -q.y)) / 3.14159;
    on = stutter(time - (2.95 + around * 0.6), phase * 0.3);
    return on * (0.9 + 0.1 * sin(time * 5.2));
  }
  // Roughly one light in five keeps blinking as a status light.
  if (fract(phase * 7.0) < 0.22 && kind < 1.5) {
    on *= 0.2 + 0.8 * step(0.45, fract(time / (0.7 + phase) + phase));
  }
  return on;
}

void main() {
  vec2 wide = wideAt(screen);
  vec3 far = texture(wideGlow, wide).rgb * reveal(texture(wideMap, wide).rgb, wide);
  vec3 near = vec3(0.0);
  if (closeMix > 0.0) {
    vec2 close = closeAt(wide);
    near = texture(closeGlow, close).rgb * reveal(texture(closeMap, close).rgb, wide);
  }
  result = vec4(mix(far, near, closeMix), 1.0);
}`;

// Pass 2: the wall, lit by the wave and by the lights that are already on.
const FINAL = `${COMMON}
uniform sampler2D wideBase, closeBase, lights;
uniform vec4 radiators[12];
uniform float hum, frame;

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 blurred(float level) {
  vec3 sum = textureLod(lights, screen, level).rgb * 2.0;
  float reach = pow(2.0, level) / 1080.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    sum += textureLod(lights, screen + vec2(cos(a) * 9.0 / 16.0, sin(a)) * reach, level).rgb;
  }
  return sum / 10.0;
}

void main() {
  vec2 wide = wideAt(screen);

  // Radiator fins tremble once the head is online.
  for (int i = 0; i < 12; i++) {
    vec4 r = radiators[i];
    vec2 edge = smoothstep(vec2(0.0), vec2(0.002), wide - r.xy) * smoothstep(vec2(0.0), vec2(0.002), r.zw - wide);
    wide.y += edge.x * edge.y * hum * 0.00055 * sin(frame * 2.6 + float(i) * 1.7 + wide.x * 900.0);
  }

  vec3 far = texture(wideBase, wide).rgb;
  vec3 near = closeMix > 0.0 ? texture(closeBase, closeAt(wide)).rgb : far;
  vec3 base = mix(far, near, closeMix);

  float age = time - waveTime(wide);
  float ambient = smoothstep(-0.05, 1.2, age);
  float front = exp(-pow(age / 0.42, 2.0));

  vec3 glow = texture(lights, screen).rgb;
  vec3 soft = blurred(3.0) * 0.5 + blurred(4.5) * 0.6 + blurred(6.0) * 0.75;
  float localLight = dot(soft, vec3(0.5, 0.3, 0.2)) * 7.0;

  // LEDs only light the wall while the room is dark; afterwards base and glow
  // add back up to the original lit image.
  vec3 colour = base * (ambient + (1.0 - ambient) * localLight);
  colour += base * vec3(2.6, 0.25, 0.2) * front;
  colour += vec3(0.05, 0.0, 0.002) * front;
  colour += glow + soft * mix(0.55, 0.16, ambient);

  vec2 c = screen - 0.5;
  colour *= 1.0 - dot(c, c) * 0.62;
  colour += (grain(screen * 1920.0 + frame) - 0.5) * 0.014;
  result = vec4(colour, 1.0);
}`;

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (6 * t - 15) + 10);
};

// Radiator grilles, measured on the close image (x0, y0, x1, y1 in pixels).
const RADIATORS = [
  [388, 462, 492, 596], [1180, 462, 1284, 596],
  [80, 680, 210, 800], [1458, 680, 1588, 800],
  [128, 0, 305, 102], [1368, 0, 1545, 102],
  [170, 340, 245, 490], [1428, 340, 1503, 490],
  [350, 720, 460, 790], [1212, 720, 1322, 790],
  [392, 92, 448, 180], [1224, 92, 1280, 180],
];

// Engines starting: when each thump lands, and how hard.
const THUMPS = [[6.15, 1], [7.3, 0.75], [8.35, 0.9], [9.2, 0.6]];

type Scene = {
  gl: WebGL2RenderingContext;
  lightsProgram: WebGLProgram;
  finalProgram: WebGLProgram;
  target: WebGLFramebuffer;
  lightsTexture: WebGLTexture;
};

export const Act1Wake = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading Act 1 layers"));

  useEffect(() => {
    const gl = canvas.current!.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
    if (!gl) {
      cancelRender(new Error("WebGL2 is not available"));
      return;
    }
    const names = ["wide-base", "wide-glow", "wide-map", "close-base", "close-glow", "close-map"];
    Promise.all(names.map((name) => loadImage(staticFile(`layers/${name}.png`))))
      .then((images) => {
        images.forEach((image, i) => {
          gl.activeTexture(gl.TEXTURE0 + i);
          texture(gl, image, names[i].endsWith("map"));
        });

        const lightsProgram = compile(gl, VERTEX, LIGHTS);
        const finalProgram = compile(gl, VERTEX, FINAL);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.getExtension("EXT_color_buffer_float");
        const lightsTexture = gl.createTexture()!;
        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, lightsTexture);
        gl.texStorage2D(gl.TEXTURE_2D, 7, gl.RGBA16F, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const target = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lightsTexture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error("Light buffer is not renderable");
        }

        scene.current = { gl, lightsProgram, finalProgram, target, lightsTexture };
        setReady(true);
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [handle, width, height]);

  useLayoutEffect(() => {
    const current = scene.current;
    if (!ready || !current) return;
    const { gl, lightsProgram, finalProgram, target, lightsTexture } = current;
    const time = frame / fps;

    // Almost still until the head is online, then a slow pull back to the wide image.
    const view = 0.474 + 0.024 * ease(time / 6) + 0.474 * ease((time - 6) / 4);
    const closeMix = 1 - ease((view - 0.53) / 0.09);

    let shake = 0;
    for (const [at, power] of THUMPS) {
      const age = time - at;
      if (age > 0) shake += power * Math.exp(-age * 4.5);
    }
    const shakeX = Math.sin(frame * 1.9) * shake * 0.0011;
    const shakeY = Math.cos(frame * 2.7) * shake * 0.0019;
    const hum = ease((time - 3.8) / 1.2) * (1 + shake * 2);

    const { x, y, w, h } = layers.closeRect;
    const shared = (program: WebGLProgram) => {
      gl.useProgram(program);
      gl.uniform1f(gl.getUniformLocation(program, "time"), time);
      gl.uniform1f(gl.getUniformLocation(program, "view"), view);
      gl.uniform1f(gl.getUniformLocation(program, "closeMix"), closeMix);
      gl.uniform1f(gl.getUniformLocation(program, "shakeX"), shakeX);
      gl.uniform1f(gl.getUniformLocation(program, "shakeY"), shakeY);
      gl.uniform4f(gl.getUniformLocation(program, "closeRect"), x, y, w, h);
      gl.uniform2f(gl.getUniformLocation(program, "helmet"), layers.helmet.x, layers.helmet.y);
    };

    gl.viewport(0, 0, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    shared(lightsProgram);
    gl.uniform1i(gl.getUniformLocation(lightsProgram, "wideGlow"), 1);
    gl.uniform1i(gl.getUniformLocation(lightsProgram, "wideMap"), 2);
    gl.uniform1i(gl.getUniformLocation(lightsProgram, "closeGlow"), 4);
    gl.uniform1i(gl.getUniformLocation(lightsProgram, "closeMap"), 5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, lightsTexture);
    gl.generateMipmap(gl.TEXTURE_2D);

    shared(finalProgram);
    gl.uniform1i(gl.getUniformLocation(finalProgram, "wideBase"), 0);
    gl.uniform1i(gl.getUniformLocation(finalProgram, "closeBase"), 3);
    gl.uniform1i(gl.getUniformLocation(finalProgram, "lights"), 6);
    gl.uniform1f(gl.getUniformLocation(finalProgram, "hum"), hum);
    gl.uniform1f(gl.getUniformLocation(finalProgram, "frame"), frame);
    const rects = RADIATORS.flatMap(([x0, y0, x1, y1]) => [
      x + (x0 / 1672) * w,
      y + (y0 / 941) * h,
      x + (x1 / 1672) * w,
      y + (y1 / 941) * h,
    ]);
    gl.uniform4fv(gl.getUniformLocation(finalProgram, "radiators"), new Float32Array(rects));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [ready, frame, fps, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvas} width={width} height={height} />
    </AbsoluteFill>
  );
};
