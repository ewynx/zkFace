import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [embedding, setEmbedding] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      const modelPath = "/models";
      await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      setStatus("Models loaded");
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Could not access the camera:", err);
        setStatus("Camera access error");
      }
    };

    loadModels().then(startCamera);
  }, []);

  const handleDetection = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const detection = await faceapi
      .detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (detection) {
      faceapi.draw.drawDetections(canvas, [detection.detection]);
      setEmbedding(detection.descriptor);
      setStatus("Embedding generated ✅");
    } else {
      setEmbedding(null);
      setStatus("No face detected");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>🎥 zkFace: Webcam Detection</h2>
      <p>{status}</p>
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
      <pre style={{ marginTop: "2rem", whiteSpace: "pre-wrap" }}>
        {embedding
          ? JSON.stringify(
              embedding.map((v) => +v.toFixed(6)),
              null,
              2
            )
          : "Waiting for embedding..."}
      </pre>
    </div>
  );
}

export default App;
