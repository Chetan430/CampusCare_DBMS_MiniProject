import { embedText } from "../lib/embeddings";

async function main() {
  console.log("Loading MiniLM model (first download requires internet)...");
  const start = Date.now();
  const vector = await embedText("The classroom ceiling fan is not working.");
  if (vector.length !== 384 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Expected 384 finite values, got ${vector.length}`);
  }
  console.log(`MiniLM ready: ${vector.length} dimensions in ${((Date.now() - start) / 1000).toFixed(1)} seconds.`);
}

main().catch((err) => { console.error("MiniLM setup failed:", err); process.exitCode = 1; });
