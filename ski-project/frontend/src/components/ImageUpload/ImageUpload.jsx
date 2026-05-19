import { useState, useRef, useCallback, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Tiny sub-components ──────────────────────────────────────────────────────

function HealthBadge({ score, label, color }) {
  const theme = {
    green:  { ring: "#16a34a", bg: "#f0fdf4", text: "#15803d" },
    yellow: { ring: "#ca8a04", bg: "#fefce8", text: "#a16207" },
    red:    { ring: "#dc2626", bg: "#fef2f2", text: "#b91c1c" },
  }[color] || { ring: "#6b7280", bg: "#f9fafb", text: "#374151" };

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ background: theme.bg, borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, border: `1px solid ${theme.ring}22` }}>
      {/* Circular progress */}
      <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
        <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="44" cy="44" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="44" cy="44" r="36"
            fill="none"
            stroke={theme.ring}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: theme.text, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 10, color: theme.text, opacity: 0.7 }}>/100</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.text, opacity: 0.7, marginBottom: 2 }}>Health Score</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{label}</div>
      </div>
    </div>
  );
}

function ReasonPill({ text, type }) {
  const colors = { good: "#16a34a", warn: "#ca8a04", bad: "#dc2626" };
  const bgs    = { good: "#f0fdf4", warn: "#fefce8", bad: "#fef2f2" };
  const c = colors[type] || colors.warn;
  const bg = bgs[type] || bgs.warn;
  return (
    <span style={{ display: "inline-block", background: bg, color: c, border: `1px solid ${c}22`, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 500, margin: "2px 3px" }}>
      {text}
    </span>
  );
}

function NutritionRow({ label, value, unit, highlight }) {
  const colors = { high: "#fef2f2", low: "#f0fdf4", normal: "transparent" };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: colors[highlight] || "transparent", borderRadius: 8 }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
        {value != null ? `${typeof value === "number" ? value.toFixed(1) : value}${unit}` : "—"}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ImageUpload({ token, onScanSuccess }) {
  const [scanMode, setScanMode]     = useState("upload"); // "upload" | "camera"
  const [cameraMode, setCameraMode] = useState("barcode"); // "barcode" | "label"
  const [dragOver, setDragOver]     = useState(false);
  const [preview, setPreview]       = useState(null);   // data URL
  const [file, setFile]             = useState(null);
  const [status, setStatus]         = useState("idle"); // idle | uploading | done | error
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const [progress, setProgress]     = useState(0);
  
  // Camera States
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [cameraError, setCameraError]     = useState(null);
  const [manualBarcode, setManualBarcode] = useState("");

  const inputRef = useRef();
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Play a synthesized scan beep sound on successful barcode detection
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (err) {
      console.warn("Could not play audio beep:", err);
    }
  };

  // Start Camera Stream
  const startCamera = async (deviceId = "") => {
    try {
      setCameraError(null);
      stopCamera();
      
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Enumerate available video inputs
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameraDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Camera access denied or unavailable. Please verify browser permissions.");
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  // Handle active barcode scanning loop
  const startBarcodeScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    
    const isNativeDetectorSupported = "BarcodeDetector" in window;
    
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;
      
      if (isNativeDetectorSupported) {
        try {
          // Initialize detector with support for common formats
          const detector = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "qr_code", "upc_a", "upc_e"]
          });
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const detectedCode = barcodes[0].rawValue;
            handleBarcodeDetected(detectedCode);
          }
        } catch (err) {
          console.error("BarcodeDetector error:", err);
        }
      }
    }, 600); // Check every 600ms
  };

  // Process detected barcode (either native scan, mock click, or manual search)
  const handleBarcodeDetected = async (code) => {
    if (!code || !code.trim()) return;
    playBeep();
    stopCamera();
    
    setStatus("uploading");
    setProgress(30);
    setError(null);
    setResult(null);

    // Fade ticker
    const ticker = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 90));
    }, 200);

    try {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/products/${code.trim()}`, {
        method: "GET",
        headers: headers
      });

      clearInterval(ticker);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Barcode lookup failed" }));
        throw new Error(err.detail || "Barcode not found in catalog.");
      }

      setProgress(100);
      const data = await res.json();
      setResult(data);
      setStatus("done");
      if (onScanSuccess) {
        onScanSuccess(data);
      }
    } catch (err) {
      clearInterval(ticker);
      setError(err.message);
      setStatus("error");
    }
  };

  // Capture a snapshot photo of the label from the camera feed
  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL("image/jpeg");
    setPreview(dataUrl);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        setFile(capturedFile);
      }
    }, "image/jpeg");
    
    stopCamera();
  };

  // Load drag-and-drop or browsing files
  const loadFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setResult(null);
    setError(null);
    setStatus("idle");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  // Trigger Gemini vision scan
  const analyse = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(0);
    setError(null);

    const ticker = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 12, 88));
    }, 400);

    try {
      const form = new FormData();
      form.append("file", file);

      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/image-scan/`, {
        method: "POST",
        headers: headers,
        body: form,
      });

      clearInterval(ticker);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload analysis failed" }));
        throw new Error(err.detail || "Analysis failed");
      }

      setProgress(100);
      const data = await res.json();
      setResult(data);
      setStatus("done");
      if (onScanSuccess) {
        onScanSuccess(data);
      }
    } catch (err) {
      clearInterval(ticker);
      setError(err.message);
      setStatus("error");
    }
  };

  // Reset Scanner
  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStatus("idle");
    setProgress(0);
    setManualBarcode("");
    if (scanMode === "camera") {
      startCamera(selectedDevice);
    }
  };

  // Sync camera state on tab or mode switches
  useEffect(() => {
    if (scanMode === "camera") {
      startCamera(selectedDevice);
    } else {
      stopCamera();
    }
  }, [scanMode]);

  // Sync barcode scanner loop
  useEffect(() => {
    if (scanMode === "camera" && cameraStream) {
      if (cameraMode === "barcode") {
        startBarcodeScanner();
      } else {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
      }
    }
  }, [scanMode, cameraMode, cameraStream]);

  // Clean up camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Sync stream to video element when it mounts/updates
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const p = result?.product;
  const hs = result?.health_score;
  const n = p?.nutrition;

  // Highlights for nutrition cells
  const sugarFlag = n?.sugars > 12 ? "high" : n?.sugars < 5 ? "low" : "normal";
  const sodiumFlag = n?.sodium != null ? (n.sodium * 1000 > 600 ? "high" : n.sodium * 1000 < 120 ? "low" : "normal") : "normal";
  const fatFlag = n?.saturated_fat > 5 ? "high" : "normal";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "var(--font-sans)" }}>

      {/* Title Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: 0, fontFamily: "var(--font-heading)" }}>
          Packaged Food Scanner
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>
          Choose an option below to analyze your food packet details and calculate its safety rating.
        </p>
      </div>

      {/* Main Mode Toggle Tabs */}
      {status !== "done" && !preview && (
        <div style={{ display: "flex", background: "var(--color-background-secondary)", borderRadius: 12, padding: 4, border: "1px solid var(--color-border-secondary)", marginBottom: 20 }}>
          <button
            onClick={() => setScanMode("upload")}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "none",
              background: scanMode === "upload" ? "var(--color-background-primary)" : "transparent",
              color: scanMode === "upload" ? "var(--color-primary)" : "var(--color-text-secondary)",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
              boxShadow: scanMode === "upload" ? "0 2px 8px rgba(15, 23, 42, 0.05)" : "none"
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Photo
          </button>
          <button
            onClick={() => setScanMode("camera")}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "none",
              background: scanMode === "camera" ? "var(--color-background-primary)" : "transparent",
              color: scanMode === "camera" ? "var(--color-primary)" : "var(--color-text-secondary)",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
              boxShadow: scanMode === "camera" ? "0 2px 8px rgba(15, 23, 42, 0.05)" : "none"
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Live Camera
          </button>
        </div>
      )}

      {/* ── MODE 1: FILE UPLOAD ────────────────────────────────────────────────── */}
      {scanMode === "upload" && !preview && (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          style={{
            border: `2px dashed ${dragOver ? "#16a34a" : "var(--color-border-secondary)"}`,
            borderRadius: 16,
            padding: "3.5rem 2rem",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? "var(--color-primary-light)" : "var(--color-background-secondary)",
            transition: "all .2s",
            marginBottom: "1rem",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ margin: "0 auto" }}>
              <rect width="44" height="44" rx="12" fill={dragOver ? "#dcfce7" : "var(--color-background-primary)"} />
              <path d="M22 14v16M14 22l8-8 8 8" stroke={dragOver ? "#16a34a" : "var(--color-text-secondary)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 32h20" stroke={dragOver ? "#16a34a" : "var(--color-border-secondary)"} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
            {dragOver ? "Drop it here!" : "Drop your food label image"}
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: 0 }}>
            or click to browse from device · JPEG, PNG, WebP · max 10 MB
          </p>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />
        </div>
      )}

      {/* ── MODE 2: LIVE CAMERA SCANNER ────────────────────────────────────────── */}
      {scanMode === "camera" && !preview && status !== "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Sub-toggle: Scan Barcode vs Take Label Photo */}
          <div style={{ display: "flex", background: "var(--color-border-tertiary)", padding: 4, borderRadius: 10, gap: 4 }}>
            <button
              onClick={() => setCameraMode("barcode")}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "none",
                background: cameraMode === "barcode" ? "var(--color-primary)" : "transparent",
                color: cameraMode === "barcode" ? "#fff" : "var(--color-text-secondary)",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Scan Barcode
            </button>
            <button
              onClick={() => setCameraMode("label")}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "none",
                background: cameraMode === "label" ? "var(--color-primary)" : "transparent",
                color: cameraMode === "label" ? "#fff" : "var(--color-text-secondary)",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Capture Label Photo
            </button>
          </div>

          {/* Camera Viewport Area */}
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1.5px solid var(--color-border-secondary)", background: "#000", height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {cameraStream ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                
                {/* Laser scan lines */}
                <div style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: cameraMode === "barcode" ? "#16a34a" : "#3b82f6",
                  boxShadow: cameraMode === "barcode" ? "0 0 10px #16a34a, 0 0 20px #16a34a" : "0 0 10px #3b82f6, 0 0 20px #3b82f6",
                  animation: "scanLaser 2.2s infinite linear",
                  zIndex: 2
                }} />

                {/* Laser scan animation keyframe stylesheet */}
                <style>{`
                  @keyframes scanLaser {
                    0% { top: 5%; }
                    50% { top: 95%; }
                    100% { top: 5%; }
                  }
                  .mock-barcode-btn {
                    padding: 6px 12px;
                    border: 1px solid var(--color-border-secondary);
                    background: var(--color-background-primary);
                    color: var(--color-text-primary);
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                  }
                  .mock-barcode-btn:hover {
                    background: var(--color-primary-light);
                    border-color: var(--color-primary);
                    color: var(--color-primary-dark);
                    transform: scale(1.04);
                  }
                `}</style>

                {/* Scanning reticle box overlay */}
                <div style={{
                  position: "absolute",
                  width: cameraMode === "barcode" ? "70%" : "85%",
                  height: cameraMode === "barcode" ? "45%" : "75%",
                  border: `2px solid ${cameraMode === "barcode" ? "#16a34a" : "#3b82f6"}`,
                  borderRadius: 12,
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                  pointerEvents: "none",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {/* Small corners */}
                  <span style={{ fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {cameraMode === "barcode" ? "Align Barcode" : "Align Ingredients"}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                {cameraError ? (
                  <div style={{ color: "#ef4444", fontSize: 13 }}>
                    ⚠️ {cameraError}
                    <button onClick={() => startCamera(selectedDevice)} style={{ display: "block", margin: "12px auto 0", padding: "8px 16px", background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Retry Permission
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ margin: "0 0 10px 0", fontSize: 13 }}>Camera stream starting...</p>
                    <div style={{ width: 24, height: 24, border: "2.5px solid #64748b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s infinite linear", margin: "0 auto" }}></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camera Devices Dropdown & Actions */}
          {cameraStream && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              {cameraDevices.length > 1 && (
                <select
                  value={selectedDevice}
                  onChange={(e) => { setSelectedDevice(e.target.value); startCamera(e.target.value); }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border-secondary)",
                    background: "var(--color-background-primary)",
                    color: "var(--color-text-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    maxWidth: 160
                  }}
                >
                  {cameraDevices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>Camera {i + 1}</option>
                  ))}
                </select>
              )}
              
              {cameraMode === "label" ? (
                <button
                  onClick={capturePhoto}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Capture Label Photo
                </button>
              ) : (
                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", fontWeight: 500, fontStyle: "italic" }}>
                  💡 Point at a barcode to scan automatically.
                </span>
              )}
            </div>
          )}

          {/* Barcode Simulator and Manual Input Section (Only in Barcode Mode) */}
          {cameraMode === "barcode" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              {/* Manual Input Search */}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  placeholder="Enter barcode manually (e.g. 8901058862413)..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: 10,
                    background: "var(--color-background-primary)",
                    color: "var(--color-text-primary)",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
                <button
                  onClick={() => handleBarcodeDetected(manualBarcode)}
                  disabled={!manualBarcode.trim() || status === "uploading"}
                  style={{
                    padding: "10px 16px",
                    background: "var(--color-primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    opacity: !manualBarcode.trim() ? 0.6 : 1
                  }}
                >
                  Search
                </button>
              </div>

              {/* Quick Mock Catalog testing tools */}
              <div style={{ background: "var(--color-background-secondary)", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--color-border-secondary)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  💡 Test Barcodes (Tap to Simulate Scanner)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => handleBarcodeDetected("8901058862413")} className="mock-barcode-btn">🍜 Maggi Masala</button>
                  <button onClick={() => handleBarcodeDetected("8901725181223")} className="mock-barcode-btn">🥔 Lays Salted</button>
                  <button onClick={() => handleBarcodeDetected("8902080004035")} className="mock-barcode-btn">🥤 Coca-Cola</button>
                  <button onClick={() => handleBarcodeDetected("8901207040510")} className="mock-barcode-btn">🌽 Kurkure Munch</button>
                  <button onClick={() => handleBarcodeDetected("8901058895053")} className="mock-barcode-btn">🥭 i-Drink Mango</button>
                  <button onClick={() => handleBarcodeDetected("8901063022277")} className="mock-barcode-btn">🍪 NutriChoice (Healthy)</button>
                  <button onClick={() => handleBarcodeDetected("8901063142272")} className="mock-barcode-btn">🍪 Oreo Cream (Unhealthy)</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── IMAGE PREVIEW SCREEN (BEFORE ANALYSIS) ────────────────────────────── */}
      {preview && status !== "done" && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--color-border-tertiary)", marginBottom: 12 }}>
            <img src={preview} alt="Food label preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", background: "#111827", display: "block" }} />
            {status === "uploading" && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(11, 15, 25, 0.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-heading)" }}>Analysing Packaged Ingredients…</div>
                <div style={{ width: 200, height: 4, background: "rgba(255,255,255,.25)", borderRadius: 2 }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "var(--color-primary)", borderRadius: 2, transition: "width .3s" }} />
                </div>
                <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 700 }}>{Math.round(progress)}%</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={analyse}
              disabled={status === "uploading"}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "var(--color-primary)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                opacity: status === "uploading" ? 0.6 : 1,
                transition: "all 0.2s"
              }}
            >
              {status === "uploading" ? "Analysing…" : "Confirm & Analyse Photo"}
            </button>
            <button
              onClick={reset}
              disabled={status === "uploading"}
              style={{ padding: "12px 18px", background: "transparent", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Retake / Remove
            </button>
          </div>

          {status === "error" && (
            <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginTop: 10, fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* ── SCANNER RESULTS PRESENTATION ────────────────────────────────────────── */}
      {status === "uploading" && !preview && (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ width: 44, height: 44, border: "3px solid var(--color-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s infinite linear", margin: "0 auto 16px" }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h4 style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>Processing Barcode Scan...</h4>
          <p style={{ color: "var(--color-text-tertiary)", fontSize: 12, marginTop: 4 }}>Retrieving details and scoring nutritional health facts.</p>
        </div>
      )}

      {status === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Header image / thumbnail & confidence */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {preview && preview !== "barcode_scan" ? (
              <img src={preview} alt="scanned product label" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: "1px solid var(--color-border-tertiary)", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 10, background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--color-primary)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-dark)" strokeWidth="2.5">
                  <path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2z" />
                  <path d="M7 7h2v10H7zm4 0h1v10h-1zm3 0h3v10h-3zm5 0h1v10h-1z" />
                </svg>
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--color-text-primary)", fontFamily: "var(--font-heading)" }}>{p?.name || "Unknown Product"}</div>
              {p?.brand && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 1, fontWeight: 600 }}>{p.brand}</div>}
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 12,
                  background: result.extraction_confidence === "high" ? "#f0fdf4" : result.extraction_confidence === "low" ? "#fef2f2" : "#fefce8",
                  color: result.extraction_confidence === "high" ? "#15803d" : result.extraction_confidence === "low" ? "#b91c1c" : "#a16207",
                }}>
                  {result.extraction_confidence} confidence
                </span>
                {result.product?.barcode && !result.product.barcode.startsWith("image_") && (
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: 8, fontWeight: 600 }}>
                    Code: {result.product.barcode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Health score ring */}
          {hs && <HealthBadge score={hs.score} label={hs.label} color={hs.color} />}

          {/* Score reasons */}
          {hs?.reasons?.length > 0 && (
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--color-border-secondary)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 8 }}>Key Health Factors</div>
              <div>
                {hs.reasons.map((r, i) => {
                  const type = r.toLowerCase().includes("high") || r.toLowerCase().includes("ultra") ? "bad"
                    : r.toLowerCase().includes("low") || r.toLowerCase().includes("good") || r.toLowerCase().includes("minimal") ? "good"
                    : "warn";
                  return <ReasonPill key={i} text={r} type={type} />;
                })}
              </div>
            </div>
          )}

          {/* Nutrition table */}
          {n && (
            <div style={{ background: "var(--color-background-primary)", border: "1.5px solid var(--color-border-secondary)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1.5px solid var(--color-border-secondary)", fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-tertiary)", background: "var(--color-background-secondary)" }}>Nutrition Facts (per 100g)</div>
              <NutritionRow label="Energy"        value={n.energy_kcal}    unit=" kcal" />
              <NutritionRow label="Fat"           value={n.fat}            unit="g" />
              <NutritionRow label="Saturated fat" value={n.saturated_fat}  unit="g" highlight={fatFlag} />
              <NutritionRow label="Sugars"        value={n.sugars}         unit="g" highlight={sugarFlag} />
              <NutritionRow label="Sodium"        value={n.sodium != null ? (n.sodium * 1000).toFixed(0) : null} unit="mg" highlight={sodiumFlag} />
              <NutritionRow label="Dietary Fibre" value={n.fiber}          unit="g" />
              <NutritionRow label="Protein"       value={n.proteins}       unit="g" />
            </div>
          )}

          {/* Additives */}
          {result.additives_detected?.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#b91c1c", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Chemical Additives Detected
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.additives_detected.map((a, i) => (
                  <span key={i} style={{ background: "#fff", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Allergens */}
          {result.allergens?.length > 0 && (
            <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#a16207", marginBottom: 8 }}>Allergens & Sensitivity warnings</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.allergens.map((a, i) => (
                  <span key={i} style={{ background: "#fff", color: "#a16207", border: "1px solid #fde68a", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients */}
          {p?.ingredients && (
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--color-border-secondary)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 6 }}>Extracted Ingredients List</div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.7, margin: 0, fontWeight: 500 }}>{p.ingredients}</p>
            </div>
          )}

          {/* Notes */}
          {result.notes && (
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic", border: "1px solid var(--color-border-secondary)" }}>
              Note: {result.notes}
            </div>
          )}

          {/* Healthy alternatives */}
          {result.healthy_alternatives?.length > 0 && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bcf0da", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#15803d", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                  <path d="M9 18h6"/>
                  <path d="M10 22h4"/>
                </svg>
                Healthy Alternatives Recommended
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.healthy_alternatives.map((alt, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                    <div style={{ fontWeight: 800, color: "#1e293b", fontSize: 13, display: "flex", alignItems: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", color: "var(--color-primary)", marginRight: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </span>
                      {alt.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5, fontWeight: 500 }}>{alt.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset button to scan again */}
          <button
            onClick={reset}
            style={{ width: "100%", padding: "12px 0", background: "transparent", color: "var(--color-text-primary)", border: "1px solid var(--color-border-secondary)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
          >
            Scan another label / barcode
          </button>
        </div>
      )}

      {/* Errors (from direct barcode / search failure) */}
      {status === "error" && !preview && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", fontSize: 13, marginTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Scan Failed</div>
          <div>{error}</div>
          <button
            onClick={reset}
            style={{ marginTop: 10, padding: "6px 12px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
