"use client";

import { useEffect, useRef, useState } from "react";
import { ActionIcon, Box, Button, Text } from "@mantine/core";
import { X, Flashlight } from "@phosphor-icons/react";
import jsQR from "jsqr";

interface Props {
  opened: boolean;
  onClose: () => void;
  onScan: (raw: string) => void;
  onManual?: () => void;   // optional "type the code manually" escape hatch
}

// On-demand camera + jsQR decode loop. Fully offline (camera + local decode).
// Decodes ~20×/sec on an 800px frame for a fast lock without pegging the CPU.
const SCAN_INTERVAL = 50;
const SCAN_MAX_DIM = 800;

export default function QrScanner({ opened, onClose, onScan, onManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const lastDecodeRef = useRef(0);
  const frameRef = useRef(0);
  const firedRef = useRef(false);
  const [hint, setHint] = useState("Point the camera at the QR code");
  const [blocked, setBlocked] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!opened) return;
    firedRef.current = false;
    setBlocked(false);
    setHint("Point the camera at the QR code");
    start();

    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  async function start() {
    if (streamRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      // Torch (flashlight) support — available on most Android Chrome cameras.
      try {
        const track = stream.getVideoTracks()[0];
        const caps: any = track.getCapabilities?.();
        setTorchAvailable(!!caps?.torch);
      } catch { setTorchAvailable(false); }
      setTorchOn(false);
      scanningRef.current = true;
      lastDecodeRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.warn("Camera error:", e);
      setBlocked(true);
      setHint("Camera blocked — allow permission and retry");
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch (e) {
      console.warn("Torch toggle failed:", e);
    }
  }

  function stop() {
    scanningRef.current = false;
    setTorchOn(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const s = streamRef.current;
    if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    const video = videoRef.current;
    if (video) { try { video.srcObject = null; } catch {} }
  }

  function tick(ts: number) {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && ts - lastDecodeRef.current >= SCAN_INTERVAL) {
      lastDecodeRef.current = ts;
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw && vh) {
        const scale = Math.min(1, SCAN_MAX_DIM / Math.max(vw, vh));
        const w = Math.round(vw * scale), h = Math.round(vh * scale);
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          // Alternate inversion mode between frames: normal (black-on-white)
          // decodes stay fast, and inverted / low-contrast prints still lock
          // within a frame or two.
          const invert = (frameRef.current++ % 2 === 0) ? "dontInvert" : "attemptBoth";
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: invert as any });
          if (code && code.data) { fire(code.data.trim()); return; }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function fire(raw: string) {
    if (firedRef.current || !raw) { rafRef.current = requestAnimationFrame(tick); return; }
    firedRef.current = true;
    scanningRef.current = false;
    if (navigator.vibrate) navigator.vibrate(40);
    stop();
    onScan(raw);
  }

  if (!opened) return null;

  return (
    <Box
      pos="fixed"
      style={{ inset: 0, zIndex: 3000, background: "#000", display: "flex", flexDirection: "column" }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <canvas ref={canvasRef} hidden />

      {/* Overlay chrome */}
      <Box style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <ActionIcon
          variant="filled" color="dark" radius="xl" size="xl" onClick={() => { stop(); onClose(); }}
          aria-label="Close" style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", right: 16 }}
        >
          <X size={22} weight="bold" />
        </ActionIcon>
        {torchAvailable && (
          <ActionIcon
            variant="filled" color={torchOn ? "yellow" : "dark"} radius="xl" size="xl" onClick={toggleTorch}
            aria-label="Torch" style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", left: 16 }}
          >
            <Flashlight size={22} weight={torchOn ? "fill" : "bold"} />
          </ActionIcon>
        )}

        <Box
          style={{
            width: "min(72vw, 280px)", aspectRatio: "1", borderRadius: 24,
            border: "3px solid rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
        <Text c="white" fw={600} mt="xl" ta="center" px="lg" style={{ position: "absolute", bottom: "18%" }}>
          {hint}
        </Text>
        {blocked && (
          <Button
            mt="md" variant="white" onClick={start}
            style={{ position: "absolute", bottom: "10%" }}
          >
            Retry camera
          </Button>
        )}
        {onManual && (
          <Button
            variant="white" color="dark" radius="xl"
            onClick={() => { stop(); onClose(); onManual(); }}
            style={{ position: "absolute", bottom: "calc(24px + env(safe-area-inset-bottom))" }}
          >
            Type code manually
          </Button>
        )}
      </Box>
    </Box>
  );
}
