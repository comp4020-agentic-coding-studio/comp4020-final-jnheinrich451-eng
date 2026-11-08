import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Img,
  cancelRender,
  continueRender,
  delayRender,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadImage } from "./gl";
import layers from "../public/layers/layers.json";

// Shot 3a: the Cuculidae coasts over Caldera, engines dark, firing on the planet while
// three drop pods fall away. Camera and planet stay still. The plate and ship are the
// supplied images; pods, flames and shells are drawn here because they have to move.
// The last frame lands on the composition of scene 03.

type Point = { x: number; y: number };

export const ORBIT_SECONDS = 10;

const PLATE_W = layers.plate.w;

// Engines are dark, so the ship coasts at one constant speed (plate pixels).
const COAST = 66;

// Under the hull, just behind its lower edge, so each pod slides into view.
const BAY: Point = { x: 752, y: 372 };

// A pod leaves at ejection speed, then gravity takes over: distance = EJECT t + PULL t^2.
const EJECT = 12;
const PULL = 3.57;

const flightTime = (distance: number) =>
  (-EJECT + Math.sqrt(EJECT * EJECT + 4 * PULL * distance)) / (2 * PULL);

// Pod positions in scene 03. Each release time is worked back from where it must end.
const PODS = [
  { x: 1070, y: 668 },
  { x: 905, y: 495 },
  { x: 813, y: 423 },
].map((end, seed) => {
  const reach = Math.hypot(end.x - BAY.x, end.y - BAY.y);
  return {
    seed,
    release: ORBIT_SECONDS - flightTime(reach),
    along: { x: (end.x - BAY.x) / reach, y: (end.y - BAY.y) / reach },
  };
});

// Muzzles of the two under-hull mounts, measured on the cutout at its final position.
const MOUNTS = [
  { angle: 23.4, barrels: [{ x: 850, y: 399 }, { x: 843, y: 410 }] },
  { angle: 22.4, barrels: [{ x: 1156, y: 393 }, { x: 1144, y: 403 }] },
];

// Alternating twin-barrel salvos; the second barrel follows a beat behind the first.
const SHOTS = [
  [1, 1.7],
  [0, 3.3],
  [1, 5.0],
  [0, 6.6],
  [1, 8.3],
].flatMap(([mount, at]) => [
  { mount, barrel: 0, at },
  { mount, barrel: 1, at: at + 0.14 },
]);

const SHELL_FLIGHT = 1.5;
const SHELL_REACH = 620; // How far along the barrel line a shell travels, in plate pixels.
const SHELL_DEPTH = 9; // How many times further away it ends than it starts.

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

const drawFlame = (ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number, heat: number) => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1) return;
  ctx.save();
  ctx.translate(to.x, to.y);
  ctx.rotate(Math.atan2(from.y - to.y, from.x - to.x));
  ctx.globalCompositeOperation = "lighter";
  const layer = (reach: number, half: number, stops: [number, string][]) => {
    const gradient = ctx.createLinearGradient(0, 0, length * reach, 0);
    for (const [at, colour] of stops) gradient.addColorStop(at, colour);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-half * 0.3, -half);
    ctx.quadraticCurveTo(length * reach * 0.3, -half * 0.95, length * reach, 0);
    ctx.quadraticCurveTo(length * reach * 0.3, half * 0.95, -half * 0.3, half);
    ctx.closePath();
    ctx.fill();
  };
  ctx.filter = `blur(${Math.max(2, width * 0.42)}px)`;
  layer(1, width * 1.25, [
    [0, `rgba(255,110,40,${0.75 * heat})`],
    [0.45, `rgba(240,70,25,${0.32 * heat})`],
    [1, "rgba(180,40,20,0)"],
  ]);
  ctx.filter = `blur(${Math.max(1, width * 0.16)}px)`;
  layer(0.62, width * 0.6, [
    [0, `rgba(255,236,190,${0.95 * heat})`],
    [0.35, `rgba(255,170,80,${0.6 * heat})`],
    [1, "rgba(255,110,40,0)"],
  ]);
  ctx.restore();
};

// Burning fragments shed along the trail, which keep the flame from reading as a smooth shape.
const drawSparks = (
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  size: number,
  heat: number,
  seed: number,
  frame: number,
) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 14; i++) {
    const along = (i / 14 + frame * 0.021 + random(`s${seed}-${i}`)) % 1;
    const spread = (random(`w${seed}-${i}`) - 0.5) * size * 0.9 * along;
    const x = to.x + (from.x - to.x) * along + spread * 0.6;
    const y = to.y + (from.y - to.y) * along - spread * 0.6;
    const alpha = heat * (1 - along) * (0.5 + 0.5 * random(`a${seed}-${i}-${frame % 7}`));
    ctx.fillStyle = `rgba(255,${190 - Math.round(along * 90)},110,${alpha})`;
    const dot = Math.max(1, size * 0.045);
    ctx.fillRect(x, y, dot, dot * 2.4);
  }
  ctx.restore();
};

const glowAt = (ctx: CanvasRenderingContext2D, at: Point, radius: number, inner: string, outer: string) => {
  const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius);
  glow.addColorStop(0, inner);
  glow.addColorStop(1, outer);
  ctx.fillStyle = glow;
  ctx.fillRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
};

// No air at the muzzle, so the flash is a hard blink with no smoke.
const drawMuzzleFlash = (ctx: CanvasRenderingContext2D, at: Point, angle: number, age: number, scale: number) => {
  const power = Math.exp(-age * 16);
  if (power < 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glowAt(ctx, at, 95 * scale, `rgba(255,214,170,${0.4 * power})`, "rgba(255,150,80,0)");
  glowAt(ctx, at, 26 * scale, `rgba(255,255,245,${power})`, "rgba(255,225,190,0)");
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.filter = `blur(${2.4 * scale}px)`;
  ctx.fillStyle = `rgba(255,246,225,${0.85 * power})`;
  ctx.beginPath();
  ctx.ellipse(38 * scale, 0, 46 * scale * (1 + age * 5), 4.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const Act3Orbit = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const under = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const [pod, setPod] = useState<HTMLImageElement | null>(null);
  const [handle] = useState(() => delayRender("Loading pod"));
  const time = frame / fps;

  useEffect(() => {
    loadImage(staticFile("layers/pod.png"))
      .then((image) => {
        setPod(image);
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [handle]);

  const scale = width / PLATE_W;
  // Reaches zero on the last frame, where the ship sits exactly as in scene 03.
  const coast = -COAST * (1 - time / ORBIT_SECONDS);
  const screen = (p: Point): Point => ({ x: (p.x + coast) * scale, y: p.y * scale });

  useLayoutEffect(() => {
    const below = under.current?.getContext("2d");
    const above = over.current?.getContext("2d");
    if (!below || !above || !pod) return;
    below.clearRect(0, 0, width, height);
    above.clearRect(0, 0, width, height);

    for (const { seed, release, along } of PODS) {
      const flown = time - release;
      if (flown <= 0) continue;
      const fallen = EJECT * flown + PULL * flown * flown;
      // Coast is added inside `screen`: a released pod keeps the ship's sideways drift.
      const here = screen({ x: BAY.x + along.x * fallen, y: BAY.y + along.y * fallen });
      const size = (17 + 0.00024 * fallen * fallen) * scale;
      // Flame grows with the fall, as the pod meets thicker air.
      const reach = (16 + 0.54 * fallen) * scale;
      const tail = { x: here.x - along.x * reach, y: here.y - along.y * reach };
      const flicker = 0.88 + 0.12 * random(`f${seed}-${frame}`);
      const heat = (0.3 + 0.7 * smooth(clamp(fallen / 300))) * flicker;

      drawFlame(below, tail, here, size * 0.34, heat);
      drawSparks(below, tail, here, size, heat, seed, frame);

      below.save();
      below.translate(here.x, here.y);
      below.rotate(Math.sin(seed * 1.7 + time * 0.45) * 0.06);
      below.drawImage(pod, -size * 0.5, -size * 0.47, size, size * (layers.pod.h / layers.pod.w));
      below.restore();

      below.save();
      below.globalCompositeOperation = "lighter";
      glowAt(below, here, size * 1.1, `rgba(255,190,120,${0.24 * heat})`, "rgba(255,90,30,0)");
      below.restore();
    }

    for (const shot of SHOTS) {
      const age = time - shot.at;
      if (age < 0) continue;
      const mount = MOUNTS[shot.mount];
      const radians = (mount.angle * Math.PI) / 180;
      const muzzle = screen(mount.barrels[shot.barrel]);
      drawMuzzleFlash(above, muzzle, radians, age, scale);

      if (age > SHELL_FLIGHT) continue;
      // A straight, even flight, foreshortened as it recedes toward the planet.
      const onScreen = (t: number) => {
        const u = clamp(t / SHELL_FLIGHT);
        const seen = (u * SHELL_DEPTH) / (1 - u + u * SHELL_DEPTH);
        const travel = seen * SHELL_REACH * scale;
        return { x: muzzle.x + Math.cos(radians) * travel, y: muzzle.y + Math.sin(radians) * travel };
      };
      const u = age / SHELL_FLIGHT;
      const head = onScreen(age);
      const back = onScreen(Math.max(0, age - 0.06));
      const nearness = 1 / (1 - u + u * SHELL_DEPTH);
      above.save();
      above.globalCompositeOperation = "lighter";
      above.lineCap = "round";
      above.strokeStyle = `rgba(255,232,190,${0.55 + 0.45 * nearness})`;
      above.lineWidth = Math.max(1, 3.4 * nearness * scale);
      above.beginPath();
      above.moveTo(back.x, back.y);
      above.lineTo(head.x, head.y);
      above.stroke();
      // Meets the top of the atmosphere just before it is lost from view.
      const burn = smooth(clamp((u - 0.72) / 0.14)) * (1 - smooth(clamp((u - 0.88) / 0.12)));
      glowAt(above, head, 13 * scale, `rgba(255,170,100,${0.9 * burn})`, "rgba(255,100,40,0)");
      above.restore();
    }
  });

  const { ship } = layers;
  const shipCorner = screen({ x: ship.x, y: ship.y });
  const rays = 0.1 + 0.02 * Math.sin(time * 0.9);

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <Img src={staticFile("layers/plate.png")} style={{ position: "absolute", left: 0, top: 0, width }} />
      {/* Pods fall behind the ship layer, so they slide out from under the hull. */}
      <canvas ref={under} width={width} height={height} style={{ position: "absolute", inset: 0 }} />
      <Img
        src={staticFile("layers/ship.png")}
        style={{
          position: "absolute",
          left: shipCorner.x,
          top: shipCorner.y,
          width: ship.w * scale,
          height: ship.h * scale,
        }}
      />
      <canvas ref={over} width={width} height={height} style={{ position: "absolute", inset: 0 }} />
      {/* The sunlight breathes very slightly, so a still sky never looks frozen. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 72% 72% at 96% 2%, rgba(205,228,255,0.95), rgba(150,195,255,0.25) 42%, rgba(120,170,255,0) 72%)",
          mixBlendMode: "screen",
          opacity: rays,
        }}
      />
    </AbsoluteFill>
  );
};
