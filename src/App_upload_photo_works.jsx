import { useEffect, useState } from "react";
import * as faceapi from "@vladmandic/face-api";

function App() {
  const [embedding, setEmbedding] = useState(null);
  const [status, setStatus] = useState("Loading models...");

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        setStatus("Models loaded");
      } catch (err) {
        setStatus("Error loading models");
        console.error(err);
      }
    };

    loadModels();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
      const detection = await faceapi.detectSingleFace(img);
      if (!detection) {
        setStatus("No face detected");
        return;
      }

      const landmarks = await faceapi.detectFaceLandmarks(img);
      const descriptor = await faceapi.computeFaceDescriptor(img);
      setEmbedding(Array.from(descriptor));
      setStatus("Embedding generated");
    };
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>🔐 zkFace Embedding Generator</h2>
      <p>{status}</p>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <pre style={{ marginTop: "2rem", whiteSpace: "pre-wrap" }}>
        {embedding
          ? JSON.stringify(embedding.map((v) => +v.toFixed(6)), null, 2)
          : "Upload an image to generate the embedding."}
      </pre>
    </div>
  );
}

export default App;

/*190-63
[
  -0.045646,
  0.076012,
  0.06983,
  0.064888,
  -0.072652,
  -0.009863,
  -0.08454,
  -0.032938,
  0.064941,
  -0.057045,
  0.189701,
  -0.010376,
  -0.196216,
  -0.048942,
  -0.037307,
  0.134912,
  -0.164979,
  -0.040174,
  -0.066811,
  -0.108815,
  0.062693,
  0.104634,
  0.037306,
  -0.027211,
  -0.097814,
  -0.284678,
  -0.084134,
  -0.114117,
  0.075017,
  -0.118538,
  0.004157,
  0.037059,
  -0.159368,
  0.024467,
  0.005158,
  0.082651,
  -0.022108,
  -0.126752,
  0.224517,
  0.014175,
  -0.119904,
  0.03479,
  0.076845,
  0.241911,
  0.203591,
  -0.011515,
  -0.018105,
  -0.026309,
  0.074795,
  -0.264684,
  0.029412,
  0.170752,
  0.059619,
  0.141491,
  0.046018,
  -0.101114,
  0.058701,
  0.074715,
  -0.115587,
  0.045782,
  0.058434,
  -0.105101,
  -0.009817,
  -0.041677,
  0.198327,
  0.08765,
  -0.074794,
  -0.116254,
  0.072896,
  -0.213262,
  -0.091386,
  0.081583,
  -0.09765,
  -0.108729,
  -0.287596,
  0.060723,
  0.384279,
  0.165193,
  -0.156407,
  0.035631,
  -0.036498,
  -0.053407,
  0.079751,
  0.09544,
  -0.076281,
  -0.040409,
  -0.090251,
  0.050647,
  0.231936,
  -0.018522,
  0.003627,
  0.23439,
  0.003853,
  0.029653,
  0.027529,
  0.005041,
  -0.037421,
  -0.074864,
  -0.030391,
  -0.013246,
  0.079734,
  -0.181355,
  0.004933,
  0.139562,
  -0.204537,
  0.104611,
  -0.055591,
  -0.034198,
  0.092956,
  0.019773,
  -0.085637,
  0.014099,
  0.199883,
  -0.200029,
  0.20214,
  0.166206,
  -0.013212,
  0.116123,
  0.072295,
  0.204379,
  -0.114097,
  -0.033446,
  -0.149305,
  -0.083399,
  -0.021538,
  0.010371,
  0.006085,
  0.019021
]

Minimum: -0.287596

Maximum: 0.384279

With quantized lib:
The smallest non-zero difference you can represent is 1 / 65536 ≈ 0.00001526

So any change smaller than ~0.000015
*/