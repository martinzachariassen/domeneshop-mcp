import { readFileSync } from "node:fs";
import { Ajv, type ValidateFunction } from "ajv";
import addFormatsModule from "ajv-formats";

const addFormats = addFormatsModule.default;

type Json = Record<string, unknown>;

interface Parameter {
  name: string;
  in: "path" | "query";
  required?: boolean;
  description?: string;
  schema: Json;
}

interface Operation {
  parameters?: (Parameter | { $ref: string })[];
  requestBody?: { content: Record<string, { schema: Json }> };
  responses: Record<string, { content?: Record<string, { schema: Json }> }>;
  security?: unknown[];
}

interface Spec {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Json>; parameters: Record<string, Parameter> };
  security: Record<string, unknown>[];
}

export const spec = JSON.parse(
  readFileSync(new URL("./domeneshop-openapi.json", import.meta.url), "utf8"),
) as Spec;

/**
 * Record types the spec leaves out but the API accepts, modelled on the
 * record validation in Domeneshop's own clients:
 * https://github.com/domeneshop/domeneshop.js (src/lib/interfaces/dnsrecord.ts)
 * and https://github.com/domeneshop/python-domeneshop (domeneshop/client.py).
 */
const OVERLAY_RECORD_TYPES: Record<string, Json> = {
  ANAME: { data: { type: "string", format: "hostname" } },
  NS: { data: { type: "string", format: "hostname" } },
  CAA: {
    data: { type: "string" },
    flags: { type: "integer", minimum: 0, maximum: 255 },
    tag: { type: "string" },
  },
  DS: {
    data: { type: "string" },
    tag: { type: "integer", minimum: 0, maximum: 65535 },
    alg: { type: "integer", minimum: 0, maximum: 255 },
    digest: { type: "integer", minimum: 0, maximum: 255 },
  },
};

function withOverlay(source: Spec): Spec {
  const copy = structuredClone(source);
  const schemas = copy.components.schemas;
  const oneOf = (schemas["DNSRecord"] as { oneOf: Json[] }).oneOf;
  for (const [type, properties] of Object.entries(OVERLAY_RECORD_TYPES)) {
    schemas[type] = {
      allOf: [
        { $ref: "#/components/schemas/BaseRecord" },
        {
          type: "object",
          required: ["type", ...Object.keys(properties)],
          properties: { type: { type: "string", enum: [type] }, ...properties },
        },
      ],
    };
    oneOf.push({ $ref: `#/components/schemas/${type}` });
  }
  return copy;
}

/** Request bodies omit readOnly properties, so they must not stay `required`. */
function dropReadOnlyRequired(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(dropReadOnlyRequired);
    return;
  }
  if (node === null || typeof node !== "object") {
    return;
  }
  const schema = node as Json;
  const properties = schema["properties"] as Record<string, Json> | undefined;
  if (Array.isArray(schema["required"]) && properties) {
    schema["required"] = (schema["required"] as string[]).filter(
      (name) => properties[name]?.["readOnly"] !== true,
    );
  }
  Object.values(schema).forEach(dropReadOnlyRequired);
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function makeAjv(components: Json): Ajv {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addFormat("int16", true);
  ajv.addFormat("int32", true);
  ajv.addFormat("url", (value: string) => URL.canParse(value));
  ajv.addFormat("ipv4|ipv6", (value: string) => IPV4.test(value) || value.includes(":"));
  ajv.addSchema({ $id: "spec", components }, "spec");
  return ajv;
}

const overlaid = withOverlay(spec);
const requestComponents = structuredClone(overlaid.components) as unknown as Json;
dropReadOnlyRequired(requestComponents);
const responseAjv = makeAjv(overlaid.components as unknown as Json);
const requestAjv = makeAjv(requestComponents);

function compile(ajv: Ajv, schema: Json): ValidateFunction {
  const rewritten = JSON.parse(
    JSON.stringify(schema).replaceAll('"#/components/', '"spec#/components/'),
  );
  return ajv.compile(rewritten);
}

function check(ajv: Ajv, schema: Json, value: unknown, what: string): string[] {
  const validate = compile(ajv, schema);
  if (validate(value)) {
    return [];
  }
  return (validate.errors ?? []).map(
    (error) => `${what}${error.instancePath} ${error.message ?? "is invalid"}`,
  );
}

export function schemaFor(name: string): Json {
  return { $ref: `#/components/schemas/${name}` };
}

/** Validates a value against a named component schema, as a response would be. */
export function validateSchema(name: string, value: unknown): string[] {
  return check(responseAjv, schemaFor(name), value, name);
}

export interface MatchedOperation {
  /** `METHOD /path/{template}`, as in the spec. */
  key: string;
  operation: Operation;
}

function resolveParameter(parameter: Parameter | { $ref: string }): Parameter {
  if ("$ref" in parameter) {
    const name = parameter.$ref.split("/").pop() ?? "";
    const resolved = spec.components.parameters[name];
    if (!resolved) {
      throw new Error(`unresolved parameter ${parameter.$ref}`);
    }
    return resolved;
  }
  return parameter;
}

function parametersOf(path: string, method: string): Parameter[] {
  const item = spec.paths[path] ?? {};
  const shared = (item["parameters"] as unknown as Parameter[] | undefined) ?? [];
  return [...shared, ...(item[method]?.parameters ?? [])].map(resolveParameter);
}

function templateRegex(path: string): RegExp {
  const pattern = path
    .split(/(\{[^}]+\})/)
    .map((part) => (part.startsWith("{") ? "([^/]+)" : part.replace(/[.*+?^$()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`^${pattern}$`);
}

export const OPERATIONS: string[] = Object.entries(spec.paths).flatMap(([path, item]) =>
  Object.keys(item)
    .filter((method) => method !== "parameters")
    .map((method) => `${method.toUpperCase()} ${path}`),
);

/**
 * Finds the spec operation for a request and checks its path parameters,
 * query parameters and authentication. Returns the violations found.
 */
export function matchOperation(
  method: string,
  url: string,
  authorization: string | undefined,
): { match: MatchedOperation | undefined; violations: string[] } {
  const { pathname, searchParams } = new URL(url, "http://spec.invalid");
  for (const [path, item] of Object.entries(spec.paths)) {
    const lower = method.toLowerCase();
    const operation = item[lower];
    const found = templateRegex(path).exec(pathname);
    if (!operation || !found) {
      continue;
    }
    const key = `${method.toUpperCase()} ${path}`;
    const violations: string[] = [];
    const parameters = parametersOf(path, lower);

    const names = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1] ?? "");
    names.forEach((name, index) => {
      const parameter = parameters.find((p) => p.in === "path" && p.name === name);
      const raw = decodeURIComponent(found[index + 1] ?? "");
      if (!parameter) {
        violations.push(`${key}: path parameter ${name} is not documented`);
      } else if (parameter.schema["type"] === "integer" && !/^-?\d+$/.test(raw)) {
        violations.push(`${key}: path parameter ${name}="${raw}" is not an integer`);
      }
    });

    const query = parameters.filter((p) => p.in === "query");
    for (const name of searchParams.keys()) {
      if (!query.some((p) => p.name === name)) {
        violations.push(`${key}: query parameter ${name} is not documented`);
      }
    }
    for (const parameter of query) {
      const value = searchParams.get(parameter.name);
      if (value === null) {
        if (parameter.required) {
          violations.push(`${key}: required query parameter ${parameter.name} is missing`);
        }
        continue;
      }
      const values = /delimited by commas/i.test(parameter.description ?? "")
        ? value.split(",")
        : [value];
      for (const single of values) {
        violations.push(
          ...check(
            requestAjv,
            parameter.schema,
            single,
            `${key}: query ${parameter.name}=${single}`,
          ),
        );
      }
    }

    if (spec.security.some((s) => "basicAuth" in s) && !authorization?.startsWith("Basic ")) {
      violations.push(`${key}: missing HTTP Basic authorization`);
    }
    return { match: { key, operation }, violations };
  }
  return { match: undefined, violations: [`${method} ${url} matches no operation in the spec`] };
}

/**
 * The spec leaves the body of `POST /forwards/` undocumented; the API takes
 * the same HTTPForward object as the PUT.
 */
const UNDOCUMENTED_BODIES: Record<string, string> = {
  "POST /domains/{domainId}/forwards/": "HTTPForward",
};

export function validateRequestBody(match: MatchedOperation, body: string): string[] {
  const documented = match.operation.requestBody?.content["application/json"]?.schema;
  const fallback = UNDOCUMENTED_BODIES[match.key];
  const schema = documented ?? (fallback ? schemaFor(fallback) : undefined);
  if (!schema) {
    return body === "" ? [] : [`${match.key}: sends a body the spec does not document`];
  }
  if (body === "") {
    return [`${match.key}: request body is missing`];
  }
  return check(requestAjv, schema, JSON.parse(body), `${match.key} body`);
}

export function validateResponse(key: string, status: number, body: unknown): string[] {
  const [method = "", path = ""] = key.split(" ");
  const response = spec.paths[path]?.[method.toLowerCase()]?.responses[String(status)];
  if (!response) {
    return [`${key}: status ${String(status)} is not documented`];
  }
  const schema = response.content?.["application/json"]?.schema;
  if (!schema) {
    return body === undefined ? [] : [`${key}: ${String(status)} documents no body`];
  }
  return check(responseAjv, schema, body, `${key} ${String(status)}`);
}

/** Documented error statuses per operation, i.e. every non-2xx response. */
export function errorStatuses(key: string): number[] {
  const [method = "", path = ""] = key.split(" ");
  const responses = spec.paths[path]?.[method.toLowerCase()]?.responses ?? {};
  return Object.keys(responses)
    .map(Number)
    .filter((status) => status >= 400);
}
