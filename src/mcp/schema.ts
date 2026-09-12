import type { z } from "zod";

export type InferShape<Shape extends z.ZodRawShape> = z.infer<z.ZodObject<Shape>>;
