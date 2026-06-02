import { z } from "zod";

export const SalesContextSchema = z.object({
  sellerCompany: z.string().min(1),
  offering: z.string().min(1),
  icp: z.string().min(1),
  targetPersona: z.string().min(1),
  painHypotheses: z.array(z.string().min(1)).min(1),
  proofPoints: z.array(z.string().min(1)).min(1),
  tone: z.enum(["direct", "consultative", "formal"]),
});

export const ProspectSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  title: z.string().optional(),
  email: z.string().email().optional(),
  linkedinUrl: z.string().url().optional(),
  location: z.string().optional(),
});

export const RunInputSchema = z.object({
  mode: z.enum(["fixture", "live"]),
  fixtureId: z.string().optional(),
  prospect: ProspectSchema,
  salesContext: SalesContextSchema,
});

export const ExtractResponseSchema = z.object({
  candidates: z.array(
    z.object({
      summary: z.string().min(1),
      sourceIndexes: z.array(z.number().int().min(0)).min(1),
      signalType: z.enum(["person", "company", "generic"]).optional(),
    }),
  ),
});

export const JudgeResponseSchema = z.object({
  selectedIndex: z.number().int().min(0),
  safety: z.enum(["mentionable", "usable_but_do_not_mention", "disqualifying"]),
  relevanceReason: z.string().min(1),
  personaFitReason: z.string().min(1),
});

export const DraftResponseSchema = z.object({
  emailSubject: z.string().min(1),
  emailBody: z.string().min(1),
  linkedinBody: z.string().min(1),
});

export const ReviewResponseSchema = z.object({
  pass: z.boolean(),
  issues: z.array(z.string().min(1)),
});

export type RunInputParsed = z.infer<typeof RunInputSchema>;
