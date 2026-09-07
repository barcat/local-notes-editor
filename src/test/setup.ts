import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/preact";
import { afterEach } from "vitest";

if (typeof globalThis.cancelAnimationFrame !== "function") {
  globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
}

afterEach(cleanup);
