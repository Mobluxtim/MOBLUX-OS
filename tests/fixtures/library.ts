// Synthetic observed-layout containers generated with Python stdlib bz2; no real catalog/customer records.
import type { LibraryCategory } from "../../packages/contracts/library.js";
const containers: Record<LibraryCategory, string> = {
  "PANEL": "Ym86bWF0ZXJpYWxzOnBhbmVsAAAAAAQAAACGAAAAQlpoOTFBWSZTWci7b/YAAAF/xHggVgBAAdAAUAAIASrn3mBAAEAAIAB1FekJoaGgAHqNG1AxUaaAAGjQACVTfYGFzWkCWaeECJAgVp7hkrGF+iPHWxW4jgLSEe2rnQOlyUL4POwTBJWs9UhvOK1dEAzw2ASRHMPyAIMn4u5IpwoSGRdt/sA=",
  "EDGE": "Ym86bWF0ZXJpYWxzOmVkZ2UAAAAABAAAAIkAAABCWmg5MUFZJlNZNysQ1QAAAX/leCFSAEABgIDAAAgBDuHeYEAAADBAAAAgIAB1DREDQ0ADamjIaDJBNAANBoAaIlbq+2l7nECeilZDUIAemIUijmVs2u0PEBBiwXhkSqg47GpaVxRg1fYi9julBDHhgQOdFApezLEjAALjGLR+LuSKcKEgblYhqg==",
  "BAR": "Ym86bWF0ZXJpYWxzOmJhcgAAAAAEAAAAggAAAEJaaDkxQVkmU1nJccT6AAABf8B4IPIAQAGAAUEBCAAL5d5gQAAgAHUV6FA0NNABkaNqDIk00NADIDQCI213ytE6RVxIe+thDUIIgkAqKdTtLc9ykIsA8k0iUNZONh1Y4d3jIK96TYsGwkYiSEB6cEDKPlbN8hBB/F3JFOFCQyXHE+g="
};
export const syntheticLibrary = (category: LibraryCategory) => Buffer.from(containers[category], "base64");

// Compressed zeros exceeding the allowed decoded budget by one byte.
export const oversizedLibraryStream = Buffer.from('QlpoOTFBWSZTWRTRJWMACAhAAMACAAggADDMBSmmCAbEIB4u5IpwoSApokrG', "base64");
