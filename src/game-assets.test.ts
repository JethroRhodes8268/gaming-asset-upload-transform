import assert from "node:assert/strict";
import { chooseVariant } from "./game-assets.ts";

assert.equal(chooseVariant(128, 128), "thumbnail");
assert.equal(chooseVariant(512, 256), "standard");
console.log("variant decision checks passed");
