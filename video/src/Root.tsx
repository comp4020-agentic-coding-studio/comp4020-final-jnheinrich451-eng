import { Composition } from "remotion";
import { Act1Wake } from "./Act1Wake";
import { Act3Orbit, ORBIT_SECONDS } from "./Act3Orbit";

const FPS = 30;

export const Root = () => (
  <>
    <Composition id="Act1Wake" component={Act1Wake} durationInFrames={10 * FPS} fps={FPS} width={1920} height={1080} />
    <Composition id="Act3Orbit" component={Act3Orbit} durationInFrames={ORBIT_SECONDS * FPS} fps={FPS} width={1920} height={1080} />
  </>
);
