import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
// The shader scene needs real WebGL2 in the headless browser.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
