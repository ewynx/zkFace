import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import facehash_circuit from "../circuits/face_hash.json";
import comparison_circuit from "../circuits/face_eq.json";

export const SCALE = 2 ** 16;
export const MATCH_THRESHOLD = 1_500_000_000;

export function quantize(embedding: number[]): number[] {
  return embedding.map((f) => Math.round(f * SCALE));
}

export function euclideanSquaredDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Mismatched lengths");
  return a.reduce((sum, ai, i) => {
    const diff = ai - b[i];
    return sum + diff * diff;
  }, 0);
}

export async function runZKEqualityProof(xRaw: number[], yRaw: number[]): Promise<[boolean, string]> {
  const noir = new Noir(comparison_circuit);
  const backend = new UltraHonkBackend(comparison_circuit.bytecode);

  const x = xRaw.map((v) => ({ x: v }));
  const registered = yRaw.map((v) => ({ x: v }));

  try {
    const { witness } = await noir.execute({ x, registered });
    const proof = await backend.generateProof(witness);
    const isValid = await backend.verifyProof(proof);
    return [isValid, proof.publicInputs[0]];
  } catch (err) {
    console.error("ZK circuit error:", err);
    return [false, ""];
  }
}

// Getting hash with a circuit now, but this can be replaced with some good frontend lib
export async function getFaceHash(xRaw: number[]): Promise<string> {
  const noir = new Noir(facehash_circuit);
  const backend = new UltraHonkBackend(facehash_circuit.bytecode);
  const x = xRaw.map((v) => ({ x: v }));
  try {
    const { witness } = await noir.execute({ x });
    const proof = await backend.generateProof(witness);
    return proof.publicInputs[0]
  } catch (err) {
    console.error("ZK circuit error:", err);
    return "";
  }
}