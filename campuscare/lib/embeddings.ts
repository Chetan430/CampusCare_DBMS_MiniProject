import { pipeline } from "@xenova/transformers";

// Keep one in-process model instance, but permit retries after a failed download.
let extractorPromise: Promise<any> | null = null;
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")
      .catch((error) => { extractorPromise = null; throw error; });
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// An explicit, local lexical fallback for when MiniLM cannot be loaded.
// This is NOT a semantic MiniLM embedding; it is a deterministic 384D token
// vector, compared only against other lexical vectors (never mixed with MiniLM).
export function lexicalVector(text: string): number[] {
  const vec = new Array<number>(384).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const stop = new Set(["the", "a", "an", "is", "are", "in", "at", "on", "to", "of", "and", "for", "with", "it", "this", "that"]);
  for (const token of tokens) {
    if (stop.has(token)) continue;
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    vec[(hash >>> 0) % 384] += 1;
  }
  const magnitude = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0));
  if (magnitude === 0) vec[0] = 1;
  else for (let i = 0; i < vec.length; i++) vec[i] /= magnitude;
  return vec;
}

export function toVectorLiteral(vec: number[]): string {
  if (vec.length !== 384 || vec.some((n) => !Number.isFinite(n))) {
    throw new Error("Invalid embedding: expected 384 finite numbers");
  }
  return `[${vec.join(",")}]`;
}
