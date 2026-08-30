"use client";

import { useRef, useState } from "react";

export default function SignaturePad({ inputName }: { inputName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [dessine, setDessine] = useState(false);
  const enTrain = useRef(false);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function commencer(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    enTrain.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function dessiner(e: React.MouseEvent | React.TouchEvent) {
    if (!enTrain.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#20221f";
    ctx.lineTo(x, y);
    ctx.stroke();
    setDessine(true);
  }

  function terminer() {
    if (!enTrain.current) return;
    enTrain.current = false;
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = canvasRef.current!.toDataURL("image/png");
    }
  }

  function effacer() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDessine(false);
    if (hiddenInputRef.current) hiddenInputRef.current.value = "";
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full touch-none rounded-lg border-2 border-dashed border-ardoise-300 bg-white"
        onMouseDown={commencer}
        onMouseMove={dessiner}
        onMouseUp={terminer}
        onMouseLeave={terminer}
        onTouchStart={commencer}
        onTouchMove={dessiner}
        onTouchEnd={terminer}
      />
      <input ref={hiddenInputRef} type="hidden" name={inputName} required />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-ardoise-400">Signez avec le doigt ou la souris ci-dessus.</p>
        <button type="button" onClick={effacer} className="text-xs text-ardoise-500 underline">
          Effacer
        </button>
      </div>
    </div>
  );
}
