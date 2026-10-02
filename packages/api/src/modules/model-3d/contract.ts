import { z } from "zod";

export const ARK_3D_TASKS_URL =
  "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
export const ARK_3D_MODEL = "hyper3d-gen2-260112";

// The supplied API example documents HTTPS URLs, not blob or base64 inputs.
const imageUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Reference images must have HTTPS URLs without embedded credentials");

export const generationInput = z.object({
  images: z.array(imageUrl).min(1).max(5),
  prompt: z.string().trim().max(4000).default(""),
  seed: z.number().int().optional(),
});

/** Pure request builder: does not upload data or trigger billable generation. */
export function buildGenerationRequest(input: z.input<typeof generationInput>) {
  const parsed = generationInput.parse(input);
  return {
    model: ARK_3D_MODEL,
    content: [
      ...(parsed.prompt ? [{ type: "text" as const, text: parsed.prompt }] : []),
      ...parsed.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ],
    ...(parsed.seed !== undefined ? { seed: parsed.seed } : {}),
  };
}
export const creationResponse = z.object({ id: z.string().min(1) });

export const queryResponse = z
  .object({
    id: z.string().min(1),
    status: z.string().min(1),
    content: z.object({ file_url: imageUrl.optional() }).optional(),
  })
  .refine((value) => value.status !== "succeeded" || Boolean(value.content?.file_url), {
    message: "Successful generation must include a model URL",
  });
