import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

export const client = hc<AppType>("/");
