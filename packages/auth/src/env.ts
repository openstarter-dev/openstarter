import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
});

export const env = schema.parse(process.env);
