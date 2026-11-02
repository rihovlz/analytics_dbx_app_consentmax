import { z } from "zod";

export const memberRowSchema = z.object({
  member: z.string(),
  self: z.number(),
  alliance: z.number(),
  total: z.number(),
  boosterRatio: z.number().nullable(),
  allianceShare: z.number().nullable(),
});

export const matrixCellSchema = z.object({
  collector: z.string(),
  recipient: z.string(),
  optIn: z.number(),
});

export const allianceContributionSchema = z.object({
  status: z.literal("ok"),
  members: z.array(z.string()),
  matrix: z.array(matrixCellSchema),
  byMember: z.array(memberRowSchema),
});

export type MemberRow = z.infer<typeof memberRowSchema>;
export type MatrixCell = z.infer<typeof matrixCellSchema>;
export type AllianceContribution = z.infer<typeof allianceContributionSchema>;
