import { useState, useRef, useEffect, ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: number[];
  initialSnap?: number;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  snapPoints = [0.3, 0.6, 0.9],
  initialSnap = 0,
  children,
  className = '',
}: BottomSheetProps) {
  const [snapIndex, setSnapIndex] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const snapHeight = snapPoints[snapIndex] * window.innerHeight;

  useEffect(() => {
    if (!isOpen) {
      setSnapIndex(initialSnap);
    }
  }, [isOpen, initialSnap]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = currentY - startY;
    const threshold = 50;

    if (deltaY > threshold && snapIndex > 0) {
      setSnapIndex(snapIndex - 1);
    } else if (deltaY < -threshold && snapIndex < snapPoints.length - 1) {
      setSnapIndex(snapIndex + 1);
    } else if (deltaY > threshold && snapIndex === 0) {
      onClose();
    }

    setStartY(0);
    setCurrentY(0);
  };

  if (!isOpen) return null;

  const dragOffset = isDragging ? currentY - startY : 0;
  const height = Math.max(0, snapHeight - dragOffset);

  return (
    <>
      <div 
        className={`bottom-sheet-overlay ${isOpen ? 'show' : ''}`} 
        onClick={onClose} 
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
      />
      <div
        ref={sheetRef}
        className={`bottom-sheet ${className} ${isOpen ? 'open' : ''}`}
        style={{ 
          height: `${height}px`,
          transition: isDragging ? 'none' : 'height 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <div
          className="bottom-sheet-handle"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bottom-sheet-handle-bar" />
        </div>
        <div className="bottom-sheet-content" style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </>
  );
}
