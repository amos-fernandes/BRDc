import { registerRootComponent } from "expo";
import { Buffer } from "buffer";
global.Buffer = Buffer;
import App from "./App";

registerRootComponent(App);