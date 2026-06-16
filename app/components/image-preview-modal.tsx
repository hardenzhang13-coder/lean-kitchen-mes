"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImagePreviewModalProps {
  src: string;
  open: boolean;
  onClose: () => void;
}

export function ImagePreviewModal({ src, open, onClose }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setScale(1);
      setRotation(0);
      setPos({ x: 0, y: 0 });
    }
  }, [open, src]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.5), 5));
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 5));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const rotateLeft = () => setRotation((prev) => prev - 90);
  const rotateRight = () => setRotation((prev) => prev + 90);
  const reset = () => {
    setScale(1);
    setRotation(0);
    setPos({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: dragRef.current.initialX + dx,
      y: dragRef.current.initialY + dy,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragRef.current = null;
  };

  const handleDoubleClick = () => {
    if (scale !== 1 || pos.x !== 0 || pos.y !== 0) {
      reset();
    } else {
      setScale(2);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "w-full h-full max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] sm:max-w-none p-0 gap-0 rounded-md overflow-hidden bg-black/90 border-none shadow-none flex flex-col items-center justify-center",
          "[&>button]:cursor-pointer [&>button]:text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20"
        )}
      >
        <div
          className="relative flex items-center justify-center w-full h-full"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="采购单预览"
            draggable={false}
            className={cn(
              "max-w-full max-h-full object-contain transition-transform",
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
          />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            className="text-white hover:bg-white/20"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white text-xs min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            className="text-white hover:bg-white/20"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={rotateLeft}
            className="text-white hover:bg-white/20"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={rotateRight}
            className="text-white hover:bg-white/20"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={reset}
            className="text-white hover:bg-white/20"
          >
            <span className="text-xs font-medium">重置</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
