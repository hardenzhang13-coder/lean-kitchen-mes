import { z } from "zod";

export const dishBomNetDetailSchema = z.object({
  role: z.string().max(50).optional(),
  netIngId: z.number().int().positive(),
  amountG: z.number().positive(),
  spec: z.string().max(200).nullish(),
  brand: z.string().max(100).nullish(),
});

export const dishBomMinorDetailSchema = z.object({
  netIngId: z.number().int().positive(),
  amountG: z.number().positive(),
  brand: z.string().max(100).nullish(),
});

export const dishBomSeasoningSchema = z.object({
  sourceId: z.number().int().positive(),
  amountG: z.number().positive(),
  brand: z.string().max(100).nullish(),
});

export const dishBomSauceSchema = z.object({
  sauceId: z.number().int().positive(),
  amountG: z.number().positive(),
  brand: z.string().max(100).nullish(),
});

export const dishBomSchema = z.object({
  netDetails: z.array(dishBomNetDetailSchema).optional(),
  minorDetails: z.array(dishBomMinorDetailSchema).optional(),
  seasoningDetails: z.array(dishBomSeasoningSchema).optional(),
  sauceDetails: z.array(dishBomSauceSchema).optional(),
});
