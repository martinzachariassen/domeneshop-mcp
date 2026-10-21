import { isIP } from "node:net";
import { z } from "zod";

/** Input fields shared across tools, so their validation and wording stay consistent. */

export const domainIdField = z
  .number()
  .int()
  .positive()
  .describe("the Domeneshop domain ID, from list_domains");

export const ttlField = z
  .number()
  .int()
  .min(60)
  .max(604800)
  .multipleOf(60)
  .describe("time-to-live in seconds, 60-604800, must be a multiple of 60, defaults to 3600");

export const httpUrlField = z
  .url({ protocol: /^https?$/ })
  .describe("the destination URL to forward requests to, starting with http:// or https://");

/** The dynamic DNS endpoint accepts up to nine comma-separated IPv4/IPv6 addresses. */
export const ipListField = z
  .string()
  .refine(
    (value) => {
      const parts = value.split(",").map((part) => part.trim());
      return parts.length <= 9 && parts.every((part) => isIP(part) !== 0);
    },
    { message: "must be an IPv4 or IPv6 address, or up to 9 of them separated by commas" },
  )
  .describe(
    "the IP address to set, IPv4 or IPv6; up to 9 addresses may be comma-separated, e.g. '192.0.2.1,2001:db8::1'. If omitted, Domeneshop uses the caller's apparent IP",
  );

/**
 * Optional enum filters also accept "", which some models send for "no
 * filter". The HTTP layer drops empty query parameters.
 */
export function optionalFilter<const T extends readonly [string, ...string[]]>(values: T) {
  return z.union([z.enum(values), z.literal("")]).optional();
}

/**
 * Output schemas are loose objects with only the fields the API always
 * returns required, so a new or missing field never fails validation.
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
