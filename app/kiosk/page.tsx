"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface CheckinResponse {
  status: "success" | "duplicate" | "rejected";
  attendee?: { full_name: string; email: string };
  ticket?: { status: string };
  reason?: string;
}

type ResultKind = "success" | "duplicate" | "rejected" | null;

export default function KioskPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [qrInput, setQrInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ResultKind>(null);
  const [resultData, setResultData] = useState<CheckinResponse | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [showEventPicker, setShowEventPicker] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role);
        if (data.role !== "facilitator") {
          router.push("/");
        }
      });
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setCameraError(null);

      scanTimerRef.current = window.setInterval(scanFrame, 500);
    } catch {
      setCameraError("Camera unavailable. Use manual input below.");
      setCameraActive(false);
    }
  }, []);

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if ("BarcodeDetector" in globalThis) {
      const detector = new (
        globalThis as typeof window & {
          BarcodeDetector: new (o: { formats: string[] }) => {
            detect: (s: HTMLCanvasElement) => Promise<{ rawValue: string }[]>;
          };
        }
      )("BarcodeDetector")({ formats: ["qr_code"] });
      detector.detect(canvas).then((barcodes) => {
        if (barcodes.length > 0 && !processing) {
          handleCheckin(barcodes[0].rawValue);
        }
      });
    }
  }

  async function handleCheckin(token: string) {
    if (processing || !token.trim()) return;
    setProcessing(true);
    setQrInput(token);

    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_token: token.trim() }),
    });

    const data: CheckinResponse = await res.json();
    setResultData(data);

    if (data.status === "success") {
      setResult("success");
    } else if (data.status === "duplicate") {
      setResult("duplicate");
    } else {
      setResult("rejected");
    }

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setResult(null);
      setResultData(null);
      setQrInput("");
      setProcessing(false);
    }, 3000);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleCheckin(qrInput);
  }

  if (!isLoaded) return <div>Loading...</div>;
  if (userRole !== "facilitator") return null;

  if (showEventPicker) {
    return (
      <div>
        <h1>Kiosk Check-in</h1>
        <p>Select an event to start scanning:</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (eventId) setShowEventPicker(false);
          }}
        >
          <input type="number" value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="Event ID" />
          <button type="submit">Start Scanning</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1>Kiosk Check-in</h1>
      <p>Event #{eventId}</p>

      <div>
        {!cameraActive && !cameraError && <button onClick={startCamera}>Start Camera Scanner</button>}

        {cameraError && <p>{cameraError}</p>}

        {cameraActive && (
          <div>
            <video ref={videoRef} autoPlay muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        )}

        <form onSubmit={handleManualSubmit}>
          <input
            type="text"
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            placeholder="Scan or type QR token..."
            disabled={processing}
          />
          <button type="submit" disabled={processing || !qrInput.trim()}>
            {processing ? "Checking..." : "Check In"}
          </button>
        </form>
      </div>

      {result && resultData && (
        <div>
          {result === "success" && (
            <div style={{ backgroundColor: "#d4edda", color: "#155724", padding: "1rem" }}>
              <p>Checked in: {resultData.attendee?.full_name}</p>
              <p>{resultData.attendee?.email}</p>
            </div>
          )}
          {result === "duplicate" && (
            <p style={{ backgroundColor: "#fff3cd", color: "#856404", padding: "1rem" }}>Already checked in</p>
          )}
          {result === "rejected" && (
            <p style={{ backgroundColor: "#f8d7da", color: "#721c24", padding: "1rem" }}>
              {resultData.reason === "cancelled" ? "Ticket cancelled" : "Invalid ticket"}
            </p>
          )}
        </div>
      )}

      <div>
        <button onClick={() => setShowEventPicker(true)}>Change Event</button>
        <button onClick={() => router.push(`/kiosk/${eventId}/attendees`)}>View Attendees</button>
      </div>
    </div>
  );
}
