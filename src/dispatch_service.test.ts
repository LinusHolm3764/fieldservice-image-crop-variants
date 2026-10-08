import test from "node:test";
import assert from "node:assert/strict";
import { chooseVariants } from "./dispatch_service.js";

test("storefront image slots keep one variant per aspect ratio", () => {
  assert.deepEqual(chooseVariants(["1:1", "4:5", "1:1", "bad"]), ["1:1", "4:5"]);
});
