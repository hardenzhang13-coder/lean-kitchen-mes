import { z } from "zod";

export const VALID_STAGES = ["初加工", "预处理", "上灶加工", "出锅成品"] as const;

export const dishProcessItemSchema = z.object({
  stage: z.enum(VALID_STAGES),
  stepNo: z.number().int().min(1),
  object: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  tool: z.string().max(100).nullish(),
  standard: z.string().max(500).nullish(),
});

export const dishProcessSchema = z.object({
  processes: z.array(dishProcessItemSchema),
});
