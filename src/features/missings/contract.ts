import { z } from "zod";

export const missingRowSchema = z.object({
  member: z.string(),
  self: z.number(),
  unknown: z.number(),
  unknownPctSelf: z.number().nullable(),
  evolution30: z.number().nullable(),
  evolution60: z.number().nullable(),
  evolution90: z.number().nullable(),
});

export const unknownHistoPointSchema = z.object({
  day: z.string(),
  member: z.string(),
  unknownPct: z.number().nullable(),
});

export const missingsSchema = z.object({
  status: z.literal("ok"),
  globalUnknownPct: z.number().nullable(),
  rows: z.array(missingRowSchema),
  history: z.array(unknownHistoPointSchema),
});

export type MissingRow = z.infer<typeof missingRowSchema>;
export type UnknownHistoPoint = z.infer<typeof unknownHistoPointSchema>;
export type Missings = z.infer<typeof missingsSchema>;
