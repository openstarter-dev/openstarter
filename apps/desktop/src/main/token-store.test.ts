import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";

// Mock safeStorage at top level
vi.mock("electron", () => ({
  safeStorage: {
    encryptString: vi.fn((s) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b) => {
      const str = b.toString();
      if (!str.startsWith("enc:")) {
        throw new Error("Decryption failed");
      }
      return str.replace("enc:", "");
    }),
  },
}));

import { createTokenStore } from "./token-store";

const testFilePath = "/tmp/test-token-store";

describe("TokenStore", () => {
  afterEach(() => {
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  it("should return null when file does not exist", () => {
    const store = createTokenStore(`${testFilePath}-nonexistent`);
    expect(store.get()).toBeNull();
  });

  it("should store and retrieve a token", () => {
    const store = createTokenStore(testFilePath);
    const token = "test-token-12345";

    store.set(token);
    const retrieved = store.get();

    expect(retrieved).toBe(token);
  });

  it("should clear the token", () => {
    const store = createTokenStore(testFilePath);
    store.set("test-token");
    store.clear();

    expect(store.get()).toBeNull();
  });

  it("should handle corrupted files gracefully", () => {
    const store = createTokenStore(testFilePath);
    store.set("valid-token");
    // Corrupt the file by writing garbage data directly
    writeFileSync(testFilePath, "garbage data");
    // Should not throw — returns null gracefully
    expect(() => store.get()).not.toThrow();
    expect(store.get()).toBeNull();
  });
});