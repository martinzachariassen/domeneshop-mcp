declare module "subset-font" {
  /** Keeps only the glyphs for `text` and re-encodes the font in `targetFormat`. */
  export default function subsetFont(
    font: Buffer,
    text: string,
    options: { targetFormat: "woff2" | "woff" | "sfnt" },
  ): Promise<Buffer>;
}
