import { z } from "zod";

/**
 * Output schemas for the tools' `structuredContent`. Only fields the API
 * always returns are required, and every object is loose, so a new or missing
 * field never fails output validation.
 */
export const domainOutput = z.looseObject({
  id: z.number(),
  domain: z.string(),
  expiry_date: z.string().optional(),
  registered_date: z.string().optional(),
  renew: z.boolean().optional(),
  registrant: z.string().optional(),
  status: z.string().optional(),
  nameservers: z.array(z.string()).optional(),
  services: z.looseObject({}).optional(),
});

export const dnsRecordOutput = z.looseObject({
  id: z.number().optional(),
  host: z.string(),
  type: z.string(),
  data: z.string(),
  ttl: z.number().optional(),
  priority: z.number().optional(),
  weight: z.number().optional(),
  port: z.number().optional(),
  usage: z.number().optional(),
  selector: z.number().optional(),
  dtype: z.number().optional(),
  alg: z.number().optional(),
  digest: z.number().optional(),
  flags: z.number().optional(),
  tag: z.union([z.number(), z.string()]).optional(),
});

export const forwardOutput = z.looseObject({
  host: z.string(),
  url: z.string(),
  frame: z.boolean().optional(),
});

export const invoiceOutput = z.looseObject({
  id: z.number(),
  type: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  due_date: z.string().nullable().optional(),
  issued_date: z.string().optional(),
  paid_date: z.string().nullable().optional(),
  status: z.string().optional(),
  url: z.string().optional(),
});
