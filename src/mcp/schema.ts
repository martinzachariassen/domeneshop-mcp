import type { z } from "zod";

/** Infers the parsed argument type for a Zod raw shape, as passed to `registerTool`'s `inputSchema`. */
export type InferShape<Shape extends z.ZodRawShape> = z.infer<z.ZodObject<Shape>>;
