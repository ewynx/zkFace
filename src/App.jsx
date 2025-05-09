import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import circuit from "./circuits/face_eq.json";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";

const SCALE = 2 ** 16;
const MATCH_THRESHOLD = 1_500_000_000;

function quantize(embedding) {
  return embedding.map((f) => Math.round(f * SCALE));
}

function euclideanSquaredDistance(a, b) {
  if (a.length !== b.length) throw new Error("Mismatched lengths");
  return a.reduce((sum, ai, i) => {
    const diff = ai - b[i];
    return sum + diff * diff;
  }, 0);
}

const runZKEqualityProof = async (xRaw, yRaw) => {
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode);

  // Wrap each value in { x: value } to match `Quantized` struct
  const x = xRaw.map((v) => ({ x: v }));
  const registered = yRaw.map((v) => ({ x: v }));
  try {
    console.log("x,registered ", x, registered)
    console.log("executing circuit")
    // TOCO check which one is registered
    const { witness } = await noir.execute({ x, registered });
    console.log("generating proof")
    const proof = await backend.generateProof(witness);
    console.log("verifying proof")
    const isValid = await backend.verifyProof(proof);
    console.log("proof is valid? ", isValid)
    return isValid;
  } catch (err) {
    console.error("Error in ZK circuit:", err);
    return false;
  }
};

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [registered, setRegistered] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      const modelPath = "/models";
      await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      setStatus("Models loaded");

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
    };

    loadModels();
  }, []);

  const detectEmbedding = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const detection = await faceapi
      .detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    if (detection) {
      faceapi.draw.drawDetections(canvas, [detection.detection]);
      return Array.from(detection.descriptor);
    } else {
      setStatus("No face detected");
      return null;
    }
  };

  const handleRegister = async () => {
    const embedding = await detectEmbedding();
    if (!embedding) return;

    const quantized = quantize(embedding);
    setRegistered(quantized);
    setMatchResult(null);
    setDistance(null);
    setStatus("Face registered");
  };

  const handleRecognize = async () => {
    if (!registered) {
      setStatus("Register a face");
      return;
    }
  
    const embedding = await detectEmbedding();
    if (!embedding) return;
  
    const quantized = quantize(embedding);
    const distSq = euclideanSquaredDistance(registered, quantized);
    setDistance(distSq);
  
    setMatchResult("pending");
  
    const zkProofOK = await runZKEqualityProof(registered, quantized);
    const match = distSq < MATCH_THRESHOLD && zkProofOK;
  
    setMatchResult(match);
    setStatus(match ? "Match: ✅" : "Match: ❌");
  };
  

  const handleDetection = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
  
    if (!video || !canvas || video.readyState !== 4) return;
  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  
    const detection = await faceapi
      .detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();
  
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    if (detection) {
      faceapi.draw.drawDetections(canvas, [detection.detection]);
    }
  };
  
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>🎥 zkFace: Webcam Detection</h2>
      <p>{status}</p>
      {matchResult === "pending" ? (
        <div style={{ height: "360px", display: "flex", justifyContent: "center", alignItems: "center", border: "2px dashed gray", borderRadius: "10px" }}>
          <p style={{ fontSize: "1.2rem" }}>⏳ Generating ZK proof, please wait...</p>
        </div>
      ) : (
        <div style={{ position: "relative", maxWidth: "600px" }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            onPlay={() => setInterval(handleDetection, 1000)}
            style={{ width: "100%", borderRadius: "10px" }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
        </div>
      )}


      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        <button onClick={handleRegister}>📸 Register face</button>
        <button onClick={handleRecognize}>🔍 Verify face</button>
      </div>

      {distance !== null && (
        <p>
          <strong>Distance²:</strong> {distance} <br />
          <strong>Result:</strong>{" "}
          {matchResult === "pending"
            ? "⏳ Generating proof..."
            : matchResult === true
            ? "✅ Match"
            : matchResult === false
            ? "❌ Match"
            : ""}
        </p>
      )}
    </div>
  );
}

export default App;
