import type { ToolAnnotations } from "@modelcontextprotocol/server";

/**
 * Clients use these hints to decide what may run without asking, so every
 * hint is set explicitly. The title is duplicated into the annotations
 * because older clients read it there.
 */
export interface ToolMeta {
  title: string;
  annotations: ToolAnnotations;
}

export function readOnly(title: string): ToolMeta {
  return {
    title,
    annotations: { title, readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  };
}

/** Creates something new without touching existing state; repeating it creates duplicates. */
export function additive(title: string): ToolMeta {
  return {
    title,
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  };
}

/** Overwrites or removes existing state; pass `idempotent: false` if repeating it changes the outcome. */
export function destructive(title: string, options: { idempotent?: boolean } = {}): ToolMeta {
  return {
    title,
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: options.idempotent ?? true,
      openWorldHint: true,
    },
  };
}
