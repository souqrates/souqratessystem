import { useRef, useEffect, useCallback, useState } from "react";

interface Props {
  symbols: string[];
  gridSize: number;
  accentColor: string;
  gradientFrom: string;
  onProgress: (pct: number) => void;
}

const CELL_SIZE = 72;
const GAP = 6;
const COLS = 3;

export default function ScratchCanvas({ symbols, gridSize, accentColor, gradientFrom, onProgress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [revealPct, setRevealPct] = useState(0);
  const lastReportedRef = useRef(0);

  const rows = Math.ceil(gridSize / COLS);
  const cols = Math.min(gridSize, COLS);
  const W = cols * CELL_SIZE + (cols - 1) * GAP + 24;
  const H = rows * CELL_SIZE + (rows - 1) * GAP + 24;

  // Draw the underlying symbol layer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    symbols.slice(0, gridSize).forEach((sym, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = 12 + col * (CELL_SIZE + GAP);
      const y = 12 + row * (CELL_SIZE + GAP);

      // Cell background
      const grad = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
      grad.addColorStop(0, `${gradientFrom}88`);
      grad.addColorStop(1, `${accentColor}44`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 12);
      ctx.fill();

      ctx.strokeStyle = `${accentColor}55`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Symbol
      ctx.font = `${Math.floor(CELL_SIZE * 0.48)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(sym, x + CELL_SIZE / 2, y + CELL_SIZE / 2);
    });
  }, [symbols, gridSize, accentColor, gradientFrom, W, H]);

  // Draw the scratch (silver) layer
  useEffect(() => {
    const canvas = scratchRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    symbols.slice(0, gridSize).forEach((_, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = 12 + col * (CELL_SIZE + GAP);
      const y = 12 + row * (CELL_SIZE + GAP);

      const grad = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
      grad.addColorStop(0, "#c0c0c0");
      grad.addColorStop(0.4, "#e8e8e8");
      grad.addColorStop(0.6, "#a8a8a8");
      grad.addColorStop(1, "#d0d0d0");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 12);
      ctx.fill();

      // Shimmer lines
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 10 + i * 15, y + 8);
        ctx.lineTo(x + 5 + i * 15, y + CELL_SIZE - 8);
        ctx.stroke();
      }
    });
  }, [symbols, gridSize, W, H]);

  const getCanvasPos = useCallback((e: React.PointerEvent) => {
    const canvas = scratchRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const scratch = useCallback((x: number, y: number) => {
    const canvas = scratchRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Calculate reveal percentage
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 10) transparent++;
    }
    const pct = (transparent / (pixels.length / 4)) * 100;

    if (pct - lastReportedRef.current >= 2) {
      lastReportedRef.current = pct;
      setRevealPct(pct);
      onProgress(pct);
    }
  }, [onProgress]);

  return (
    <div className="relative" style={{ width: W, maxWidth: "100%" }}>
      {/* Base layer (symbols) */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ position: "absolute", top: 0, left: 0, borderRadius: 16, width: "100%", height: "auto" }}
      />
      {/* Scratch layer */}
      <canvas
        ref={scratchRef}
        width={W}
        height={H}
        style={{ position: "relative", zIndex: 2, borderRadius: 16, width: "100%", height: "auto", display: "block" }}
        onPointerDown={(e) => {
          isDrawingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const { x, y } = getCanvasPos(e);
          scratch(x, y);
        }}
        onPointerMove={(e) => {
          if (!isDrawingRef.current) return;
          const { x, y } = getCanvasPos(e);
          scratch(x, y);
        }}
        onPointerUp={() => { isDrawingRef.current = false; }}
        onPointerLeave={() => { isDrawingRef.current = false; }}
      />
      {/* Progress bar */}
      <div className="mt-2 w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, revealPct)}%`, background: accentColor }} />
      </div>
      <div className="text-center text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
        {Math.min(100, Math.round(revealPct))}% مكشوف
      </div>
    </div>
  );
}
