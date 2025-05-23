import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { quantize, euclideanSquaredDistance, runZKEqualityProof, MATCH_THRESHOLD, getFaceHash } from "./lib/zkFace";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [registered, setRegistered] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [distance, setDistance] = useState(null);
  const [sunglassesImg, setSunglassesImg] = useState(null);
  const [hatImg, setHatImg] = useState(null);
  const [registeredHash, setRegisteredHash] = useState(null);
  const [recognizedHash, setRecognizedHash] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const intervalRef = useRef(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    const modelPath = `${base}models`;

    const loadModels = async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      setStatus("Models loaded");

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      
      await new Promise((res) => setTimeout(res, 500)); // give video time to load
      handleDetection();
    };

    const img = new Image();
    img.src = `${base}sun.png`;
    img.onload = () => setSunglassesImg(img);

    const hat = new Image();
    hat.src = `${base}privacy_hat.png`;
    hat.onload = () => setHatImg(hat);

    loadModels();
  }, []);

  useEffect(() => {
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        handleDetection();
      }, 500);
    }
  
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
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
    setIsRegistering(true);
  
    try {
      const embedding = await detectEmbedding();
      if (!embedding) return;
  
      const quantized = quantize(embedding);
      const hash = await getFaceHash(quantized);
  
      setRegistered(quantized);
      setRegisteredHash(hash);
      setRecognizedHash(null);
      setMatchResult(null);
      setDistance(null);
      setStatus("Face registered");
    } finally {
      setIsRegistering(false);
    }
  };
  

  const handleRecognize = async () => {
    if (!registered) {
      setStatus("Register a face");
      return;
    }

    const embedding = await detectEmbedding();
    if (!embedding) return;

    const quantized = quantize(embedding);
    const distSq = euclideanSquaredDistance(quantized, registered);
    setDistance(distSq);

    setMatchResult("pending");
    const [zkProofOK, hashFromProof] = await runZKEqualityProof(quantized, registered);
    const match = distSq < MATCH_THRESHOLD && zkProofOK;

    setMatchResult(match);
    setStatus(match ? "Match: ✅" : "Match: ❌");

    if (zkProofOK) {
      setRecognizedHash(hashFromProof);
    }

    if (match) {
      clearInterval(intervalRef.current); // Stop detection loop immediately
      intervalRef.current = null;
    
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
    
      video.pause();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
      const detection = await faceapi
        .detectSingleFace(canvas)
        .withFaceLandmarks();
    
      if (detection && sunglassesImg && hatImg) {
        const leftEye = detection.landmarks.getLeftEye();
        const rightEye = detection.landmarks.getRightEye();
        const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
        const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2 + 15;
        const eyeWidth = Math.abs(rightEye[3].x - leftEye[0].x) * 1.9;
        const glassesWidth = eyeWidth;
        const glassesHeight = eyeWidth / 2;
    
        ctx.drawImage(
          sunglassesImg,
          eyeCenterX - glassesWidth / 2,
          eyeCenterY - glassesHeight / 2,
          glassesWidth,
          glassesHeight
        );

        const box = detection.detection.box;
        const hatWidth = box.width * 3;
        const hatHeight = hatWidth * (hatImg.height / hatImg.width);
      
        const offsetX = 15; // move right
        const offsetY = 31; // move down
        
        const hatX = box.x + box.width / 2 - hatWidth / 2 + offsetX;
        const hatY = box.y - hatHeight * 0.6 + offsetY;
      
        ctx.drawImage(hatImg, hatX, hatY, hatWidth, hatHeight);
      }
    
      setTimeout(() => {
        video.play();
        setMatchResult(null);
        setRecognizedHash(null);
        setDistance(null);
        setStatus("Models loaded");
      
        // Resume detection
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            handleDetection();
          }, 300);
        }
      }, 3000);
    }
    
  };

  const handleDetection = async () => {
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
  
    if (!video || !canvas || video.readyState !== 4) return;
  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    try {
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();
  
      if (detection) {
        faceapi.draw.drawDetections(canvas, [detection.detection]);
      } else {
        console.log("No detection in frame.");
      }
    } catch (err) {
      console.error("Face detection error:", err);
    }
  };
  

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>🎥 zkFace: Webcam Detection</h2>
      <p>{status}</p>
      {registeredHash && (
        <div style={{ marginTop: "1rem" }}>
          <strong>Registered Face Hash:</strong>
          <pre style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{registeredHash}</pre>
        </div>
      )}

      {recognizedHash && (
        <div style={{ marginTop: "1rem" }}>
          <strong>Recognized Face Hash:</strong>
          <pre style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{recognizedHash}</pre>
          <p>
            <strong>Hashes match:</strong>{" "}
            {recognizedHash === registeredHash ? "✅ Yes" : "❌ No"}
          </p>
        </div>
      )}
      <div style={{ position: "relative", maxWidth: "600px" }}>
        {matchResult === "pending" && (
          <div style={{
            position: "absolute",
            zIndex: 10,
            backgroundColor: "rgba(255,255,255,0.8)",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: "10px"
          }}>
            <p style={{ fontSize: "1.2rem" }}>⏳ Generating ZK proof, please wait...</p>
          </div>
        )}
        {isRegistering && (
          <div style={{
            position: "absolute",
            zIndex: 10,
            backgroundColor: "rgba(255,255,255,0.8)",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: "10px"
          }}>
            <p style={{ fontSize: "1.2rem" }}>📸 Registering face, please wait...</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
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
