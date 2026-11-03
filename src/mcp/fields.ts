import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { z } from "zod";

export const domainIdField = z
  .number()
  .int()
  .positive()
  .describe("the Domeneshop domain ID, from list_domains");

export const recordIdField = z
  .number()
  .int()
  .positive()
  .describe("the DNS record ID, from list_dns_records");

export const invoiceIdField = z
  .number()
  .int()
  .positive()
  .describe("the invoice ID, from list_invoices");

/** A non-blank host. An empty host would turn `/forwards/{host}` into the list endpoint. */
export function hostField(description: string) {
  return z
    .string()
    .trim()
    .min(1, { message: "must not be empty; use '@' for the root" })
    .describe(description);
}

export const ttlField = z
  .number()
  .int()
  .min(60)
  .max(604800)
  .multipleOf(60)
  .describe("time-to-live in seconds, 60-604800, must be a multiple of 60, defaults to 3600");

export function uintField(max: number) {
  return z.number().int().min(0).max(max);
}

export const forwardUrlField = z
  .url({ protocol: /^(https?|ftp)$/ })
  .describe(
    "the destination URL to forward requests to, including the scheme: http://, https:// or ftp://",
  );

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/** Joins without spaces: the dynamic DNS endpoint would take a space after a comma verbatim. */
export function joinList(parts: readonly string[]): string {
  return parts.join(",");
}

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/**
 * Splits a comma-separated hostname list into the form the dynamic DNS
 * endpoint expects: ASCII (punycode for IDNs) without a trailing dot.
 * Entries that are not valid hostnames come back as "".
 */
export function hostnameList(value: string): string[] {
  return splitList(value).map((name) => {
    const ascii = domainToASCII(name.replace(/\.$/, ""));
    return HOSTNAME.test(ascii) ? ascii : "";
  });
}

export const hostnameListField = z
  .string()
  .refine((value) => splitList(value).length > 0, { message: "must name at least one hostname" })
  .refine((value) => hostnameList(value).every((name) => name !== ""), {
    message: "must be valid hostnames, e.g. 'home.example.com', separated by commas",
  })
  .describe(
    "the fully qualified hostname to update, e.g. 'home.example.com'; several hostnames can be updated at once by separating them with commas",
  );

/** Accepts "" as omitted, since some models send "" for "not set". */
export const ipListField = z
  .string()
  .refine(
    (value) => {
      const parts = splitList(value);
      return parts.length <= 9 && parts.every((part) => isIP(part) !== 0);
    },
    { message: "must be an IPv4 or IPv6 address, or up to 9 of them separated by commas" },
  )
  .describe(
    "the IP address to set, IPv4 or IPv6; up to 9 addresses may be comma-separated, e.g. '192.0.2.1,2001:db8::1'. If omitted or empty, Domeneshop uses the caller's apparent IP",
  );

/** Also accepts "", which some models send for "no filter"; the HTTP layer drops it. */
export function optionalFilter<const T extends readonly [string, ...string[]]>(values: T) {
  return z.union([z.enum(values), z.literal("")]).optional();
}
