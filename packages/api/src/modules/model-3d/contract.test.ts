import { describe, expect, it } from "vitest";
import { buildGenerationRequest } from "./contract";

describe("Ark multi-image 3D request", () => {
  it("matches the documented multi-view body and preserves image order", () => {
    const images = ["front", "side", "back"].map((view) => `https://example.com/${view}.png`);
    expect(buildGenerationRequest({ images, prompt: "Three views", seed: 8648 })).toEqual({
      model: "hyper3d-gen2-260112",
      content: [
        { type: "text", text: "Three views" },
        ...images.map((url) => ({ type: "image_url", image_url: { url } })),
      ],
      seed: 8648,
    });
  });
  it("accepts five images without forcing an undocumented prompt or seed", () => {
    const body = buildGenerationRequest({ images: Array(5).fill("https://example.com/image.png") });
    expect(body.content).toHaveLength(5);
    expect(body).not.toHaveProperty("seed");
  });
  it.each([
    [],
    Array(6).fill("https://example.com/image.png"),
    ["blob:local"],
    ["data:image/png;base64,AA=="],
    ["http://example.com/a.png"],
    ["https://user:secret@example.com/a.png"],
  ])("rejects unsupported image inputs: %j", (...images) => {
    expect(() => buildGenerationRequest({ images: images as string[] })).toThrow();
  });
});
