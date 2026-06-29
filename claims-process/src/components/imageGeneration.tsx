import React, { useState } from 'react';
import {
  ArrowLeft,
  Circle,
  Trash2,
  Clock,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Check,
  Plus,
  MousePointer,
  Type,
  Copy,
  RotateCw,
  Image as ImageIcon,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Claim } from '../types';

export interface ImageGenerationWorkspaceProps {
  trackingId: string;
  claims: Claim[];
  onClose: (exitType: 'complete' | 'partial') => void;
}

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || hex === 'transparent') return 'rgba(0,0,0,0)';
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.slice(0, 2), 16) || 0;
  const g = parseInt(c.slice(2, 4), 16) || 0;
  const b = parseInt(c.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Merges left (local upload) and right (Drive download) into one side-by-side
// composite with baked "ORIGINAL SENT CUBE" / "RECEIVED CUBE" headers in black.
const mergeImagesForComposition = (leftSrc: string, rightSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const SLOT_W = 600;
    const SLOT_H = 800;
    const HEADER_H = 56;
    const CANVAS_W = SLOT_W * 2;
    const CANVAS_H = SLOT_H;

    const drawAll = (leftImg: HTMLImageElement, rightImg: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Left image – cover fit into left slot
      const lW = leftImg.naturalWidth || SLOT_W;
      const lH = leftImg.naturalHeight || SLOT_H;
      const lScale = Math.max(SLOT_W / lW, SLOT_H / lH);
      const lDW = lW * lScale;
      const lDH = lH * lScale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, SLOT_W, SLOT_H);
      ctx.clip();
      ctx.drawImage(leftImg, (SLOT_W - lDW) / 2, (SLOT_H - lDH) / 2, lDW, lDH);
      ctx.restore();

      // Right image – cover fit into right slot
      const rW = rightImg.naturalWidth || SLOT_W;
      const rH = rightImg.naturalHeight || SLOT_H;
      const rScale = Math.max(SLOT_W / rW, SLOT_H / rH);
      const rDW = rW * rScale;
      const rDH = rH * rScale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(SLOT_W, 0, SLOT_W, SLOT_H);
      ctx.clip();
      ctx.drawImage(rightImg, SLOT_W + (SLOT_W - rDW) / 2, (SLOT_H - rDH) / 2, rDW, rDH);
      ctx.restore();

      // Divider
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SLOT_W, 0);
      ctx.lineTo(SLOT_W, CANVAS_H);
      ctx.stroke();

      const fontSize = Math.round(HEADER_H * 0.36);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      // Left header – white band + black text
      ctx.fillStyle = 'rgba(255,255,255,0.90)';
      ctx.fillRect(0, 0, SLOT_W, HEADER_H);
      ctx.fillStyle = '#000000';
      ctx.fillText('ORIGINAL SENT CUBE', SLOT_W / 2, HEADER_H / 2);

      // Right header – white band + black text
      ctx.fillStyle = 'rgba(255,255,255,0.90)';
      ctx.fillRect(SLOT_W, 0, SLOT_W, HEADER_H);
      ctx.fillStyle = '#000000';
      ctx.fillText('RECEIVED CUBE', SLOT_W + SLOT_W / 2, HEADER_H / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };

    const leftImg = new Image();
    const rightImg = new Image();
    leftImg.crossOrigin = 'anonymous';
    rightImg.crossOrigin = 'anonymous';

    let leftLoaded = false;
    let rightLoaded = false;
    const check = () => { if (leftLoaded && rightLoaded) drawAll(leftImg, rightImg); };

    leftImg.onload = () => { leftLoaded = true; check(); };
    leftImg.onerror = () => { leftLoaded = true; check(); };
    rightImg.onload = () => { rightLoaded = true; check(); };
    rightImg.onerror = () => { rightLoaded = true; check(); };

    leftImg.src = leftSrc;
    rightImg.src = rightSrc;
  });
};

// Renders annotations on top of imageSrc and returns a JPEG data URL.
// Preserves the image's natural dimensions (no forced aspect ratio).
const exportAnnotatedCanvas = (imageSrc: string, annotations: any[]): Promise<string> => {
  const drawAnnotations = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    annotations.forEach(anno => {
      if (anno.type === 'circle') {
        const cx = (anno.x / 100) * W;
        const cy = (anno.y / 100) * H;
        const rx = anno.rx !== undefined ? (anno.rx / 100) * W : ((anno.r || 8) / 100) * W;
        const ry = anno.ry !== undefined ? (anno.ry / 100) * H : ((anno.r || 8) / 100) * H;
        const rotation = (anno.rotation || 0) * Math.PI / 180;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, 2 * Math.PI);
        const bWidth = anno.borderWidth !== undefined ? anno.borderWidth : 4;
        ctx.lineWidth = bWidth * (W / 337);
        const bColor = anno.borderColor || '#000000';
        const bOpacity = anno.borderOpacity !== undefined ? anno.borderOpacity : 1;
        ctx.strokeStyle = hexToRgba(bColor, bOpacity);
        const fColor = anno.fillColor || 'transparent';
        const fOpacity = anno.fillOpacity !== undefined ? anno.fillOpacity : 0.3;
        if (fColor && fColor !== 'transparent') {
          ctx.fillStyle = hexToRgba(fColor, fOpacity);
          ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
      } else if (anno.type === 'text') {
        const tx = (anno.x / 100) * W;
        const ty = (anno.y / 100) * H;
        const tW = ((anno.width || 74) / 100) * W;
        const fontSize = 13 * (W / 337);
        const lineHeight = fontSize * 1.4;
        const padding = fontSize * 0.4;
        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        const paragraphLines = (anno.text || '').split('\n');
        const wrappedLines: string[] = [];
        paragraphLines.forEach(paragraph => {
          const words = paragraph.split(' ');
          let currentLine = '';
          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(testLine).width > tW - padding * 2 && i > 0) {
              wrappedLines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) wrappedLines.push(currentLine);
        });
        const totalLinesHeight = wrappedLines.length * lineHeight;
        const contentHeight = totalLinesHeight + padding * 2;
        const manualHeightPx = anno.height ? (anno.height / 100) * H : 0;
        const boxHeight = Math.max(contentHeight, manualHeightPx);
        if (anno.fillColor && anno.fillColor !== 'transparent') {
          ctx.fillStyle = hexToRgba(anno.fillColor, anno.fillOpacity !== undefined ? anno.fillOpacity : 0.3);
          ctx.fillRect(tx, ty, tW, boxHeight);
          ctx.strokeStyle = hexToRgba(anno.fillColor, 0.4);
          ctx.lineWidth = 1 * (W / 337);
          ctx.strokeRect(tx, ty, tW, boxHeight);
        }
        ctx.fillStyle = anno.fontColor || anno.borderColor || '#000000';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        wrappedLines.forEach((line, index) => {
          ctx.fillText(line, tx + padding, ty + padding + index * lineHeight);
        });
        ctx.restore();
      }
    });
  };

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const W = img.naturalWidth || 1200;
      const H = img.naturalHeight || 800;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        drawAnnotations(ctx, W, H);
      }
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
    img.onerror = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1200, 800);
        drawAnnotations(ctx, 1200, 800);
      }
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
    img.src = imageSrc;
  });
};

interface LpnState {
  image: string | null;           // merged composite (set after Merge Images)
  annotations: any[];
  leftLocalImage: string | null;  // local file upload (left slot)
  rightDriveImage: string | null; // Drive download (right slot)
  isMerged: boolean;
}

export default function ImageGenerationWorkspace({ trackingId, claims, onClose }: ImageGenerationWorkspaceProps) {
  const matchingClaims = claims.filter(c => c.trackingId === trackingId);
  const sampleClaim = matchingClaims[0] || {} as Claim;

  const orderLpns = React.useMemo(() => {
    const claim = matchingClaims[0] as any;
    if (!claim) return [];
    const lpns: string[] = claim.lpns?.length > 0 ? claim.lpns : (claim.lpn ? [claim.lpn] : []);
    return Array.from(new Set(lpns)).filter(Boolean) as string[];
  }, [matchingClaims]);

  const finalLpns = orderLpns.length > 0 ? orderLpns : ['LPN_MOCK_FALLBACK'];

  const [activeLpn, setActiveLpn] = useState<string>(finalLpns[0] || '');
  const [lpnStateMap, setLpnStateMap] = useState<Record<string, LpnState>>({});
  const [lpnSaved, setLpnSaved] = useState<Record<string, boolean>>({});

  const [adderText, setAdderText] = useState('DAMAGE LOCATION');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Google Drive auth states
  const [accessToken, setAccessToken] = useState<string>(() =>
    sessionStorage.getItem('GOOGLE_DRIVE_ACCESS_TOKEN') || ''
  );
  const [googleClientId, setGoogleClientIdState] = useState<string>(() =>
    localStorage.getItem('GOOGLE_DRIVE_CLIENT_ID') || ''
  );
  const [googleClientSecret, setGoogleClientSecretState] = useState<string>(() =>
    localStorage.getItem('GOOGLE_DRIVE_CLIENT_SECRET') || ''
  );
  const [googleRefreshToken, setGoogleRefreshTokenState] = useState<string>(() =>
    localStorage.getItem('GOOGLE_DRIVE_REFRESH_TOKEN') || ''
  );
  const [showRefreshForm, setShowRefreshForm] = useState(false);

  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [selectedSourceImage, setSelectedSourceImage] = useState<string | null>(null);

  // Canvas annotation tool state
  const [canvasMode, setCanvasMode] = useState<'select' | 'circle' | 'text'>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Styling defaults
  const [activeBorderColor, setActiveBorderColor] = useState('#000000');
  const [activeBorderWidth, setActiveBorderWidth] = useState(4);
  const [activeBorderOpacity, setActiveBorderOpacity] = useState(1.0);
  const [activeFillColor, setActiveFillColor] = useState('transparent');
  const [activeFillOpacity, setActiveFillOpacity] = useState(0.3);

  const [isCreating, setIsCreating] = useState(false);
  const [creationStart, setCreationStart] = useState<{ x: number; y: number } | null>(null);

  interface ResizeState {
    handle: string;
    startX: number; startY: number;
    startRx: number; startRy: number;
    startXVal: number; startYVal: number;
    startWVal?: number; startHVal?: number;
  }
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  interface MovementState {
    selectedId: string;
    startX: number; startY: number;
    startXVal: number; startYVal: number;
  }
  const [movementState, setMovementState] = useState<MovementState | null>(null);

  interface RotationState {
    selectedId: string;
    centerX: number; centerY: number;
    startAngle: number; startRotation: number;
  }
  const [rotationState, setRotationState] = useState<RotationState | null>(null);

  const canvasContainerRef = React.useRef<HTMLDivElement>(null);

  const activeLpnRef = React.useRef(activeLpn);
  const annotationsRef = React.useRef<any[]>([]);
  const selectedIdRef = React.useRef<string | null>(null);
  const isCreatingRef = React.useRef(false);
  const creationStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const canvasModeRef = React.useRef<'select' | 'circle' | 'text'>('select');
  const resizeStateRef = React.useRef<ResizeState | null>(null);
  const movementStateRef = React.useRef<MovementState | null>(null);
  const rotationStateRef = React.useRef<RotationState | null>(null);
  const activeBorderColorRef = React.useRef('#000000');
  const activeBorderWidthRef = React.useRef(4);
  const activeBorderOpacityRef = React.useRef(1.0);
  const activeFillColorRef = React.useRef('transparent');
  const activeFillOpacityRef = React.useRef(0.3);

  // Derived active state
  const activeState: LpnState = lpnStateMap[activeLpn] || {
    image: null, annotations: [], leftLocalImage: null, rightDriveImage: null, isMerged: false
  };
  const currentImage = activeState.image;
  const annotations = activeState.annotations;
  const leftLocalImage = activeState.leftLocalImage;
  const rightDriveImage = activeState.rightDriveImage;
  const isMerged = activeState.isMerged;
  const canMerge = !!(leftLocalImage && rightDriveImage);
  const editingEnabled = isMerged;

  const selectedAnno = selectedId ? annotations.find(a => a.id === selectedId) : null;

  // Ref syncs
  React.useEffect(() => {
    activeLpnRef.current = activeLpn;
    requestAnimationFrame(() => setSelectedId(null));
  }, [activeLpn]);
  React.useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  React.useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  React.useEffect(() => { isCreatingRef.current = isCreating; }, [isCreating]);
  React.useEffect(() => { creationStartRef.current = creationStart; }, [creationStart]);
  React.useEffect(() => { canvasModeRef.current = canvasMode; }, [canvasMode]);
  React.useEffect(() => { resizeStateRef.current = resizeState; }, [resizeState]);
  React.useEffect(() => { movementStateRef.current = movementState; }, [movementState]);
  React.useEffect(() => { rotationStateRef.current = rotationState; }, [rotationState]);
  React.useEffect(() => { activeBorderColorRef.current = activeBorderColor; }, [activeBorderColor]);
  React.useEffect(() => { activeBorderWidthRef.current = activeBorderWidth; }, [activeBorderWidth]);
  React.useEffect(() => { activeBorderOpacityRef.current = activeBorderOpacity; }, [activeBorderOpacity]);
  React.useEffect(() => { activeFillColorRef.current = activeFillColor; }, [activeFillColor]);
  React.useEffect(() => { activeFillOpacityRef.current = activeFillOpacity; }, [activeFillOpacity]);

  // Generic state setters scoped to the active LPN
  const patchLpnState = (patch: Partial<LpnState>) => {
    setLpnStateMap(prev => {
      const lpn = activeLpnRef.current;
      const existing: LpnState = prev[lpn] || {
        image: null, annotations: [], leftLocalImage: null, rightDriveImage: null, isMerged: false
      };
      return { ...prev, [lpn]: { ...existing, ...patch } };
    });
  };

  const setAnnotations = (newAnnos: any[] | ((prev: any[]) => any[])) => {
    setLpnStateMap(prev => {
      const lpn = activeLpnRef.current;
      const existing: LpnState = prev[lpn] || {
        image: null, annotations: [], leftLocalImage: null, rightDriveImage: null, isMerged: false
      };
      const updated = typeof newAnnos === 'function' ? newAnnos(existing.annotations) : newAnnos;
      return { ...prev, [lpn]: { ...existing, annotations: updated } };
    });
  };

  const setLeftLocalImage = (img: string | null) => patchLpnState({ leftLocalImage: img });
  const setRightDriveImage = (img: string | null) => patchLpnState({ rightDriveImage: img });
  const setMergedImage = (img: string | null) => patchLpnState({ image: img });

  // Keyboard support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (!selectedId) return;
      const activeAnno = annotations.find(a => a.id === selectedId);
      if (!activeAnno) return;
      const step = e.shiftKey ? 10 : 1;
      const stepPercent = step * 0.4;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setAnnotations(prev => prev.filter(a => a.id !== selectedId));
        setSelectedId(null);
      } else if (e.key.toLowerCase() === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sessionStorage.setItem('COMPOSITION_COPIED_SHAPE', JSON.stringify(activeAnno));
      } else if (e.key.toLowerCase() === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const raw = sessionStorage.getItem('COMPOSITION_COPIED_SHAPE');
        if (raw) {
          try {
            const copied = JSON.parse(raw);
            const newId = `cir-${Date.now()}`;
            setAnnotations(prev => [...prev, {
              ...copied, id: newId,
              x: Math.min(95, Math.max(5, (copied.x || 45) + 4)),
              y: Math.min(95, Math.max(5, (copied.y || 45) + 4))
            }]);
            setSelectedId(newId);
          } catch (_) {}
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, y: Math.max(0, a.y - stepPercent) } : a));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, y: Math.min(100, a.y + stepPercent) } : a));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, x: Math.max(0, a.x - stepPercent) } : a));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, x: Math.min(100, a.x + stepPercent) } : a));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, annotations]);

  // Pointer move / up handlers
  React.useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!resizeStateRef.current && !movementStateRef.current && !rotationStateRef.current && !(isCreatingRef.current && creationStartRef.current)) return;
      if (!canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const currPercentX = ((e.clientX - rect.left) / rect.width) * 100;
      const currPercentY = ((e.clientY - rect.top) / rect.height) * 100;

      if (isCreatingRef.current && creationStartRef.current) {
        const start = creationStartRef.current;
        setAnnotations(prev => prev.map(anno => {
          if (anno.id !== 'temp-circle') return anno;
          let rx = Math.abs(currPercentX - start.x) / 2;
          let ry = Math.abs(currPercentY - start.y) / 2;
          if (e.shiftKey) { const ratio = rect.height / rect.width; ry = rx * (1 / ratio); }
          return { ...anno, x: start.x + (currPercentX - start.x) / 2, y: start.y + (currPercentY - start.y) / 2, rx: Math.max(0.5, rx), ry: Math.max(0.5, ry) };
        }));
        return;
      }

      if (movementStateRef.current) {
        const move = movementStateRef.current;
        const deltaX = ((e.clientX - move.startX) / rect.width) * 100;
        const deltaY = ((e.clientY - move.startY) / rect.height) * 100;
        setAnnotations(prev => prev.map(anno => {
          if (anno.id !== move.selectedId) return anno;
          const wVal = anno.type === 'text' ? (anno.width || 74) : 0;
          const hVal = anno.type === 'text' ? (anno.height || 12) : 0;
          return { ...anno, x: Math.min(100 - wVal, Math.max(0, move.startXVal + deltaX)), y: Math.min(100 - hVal, Math.max(0, move.startYVal + deltaY)) };
        }));
        return;
      }

      if (rotationStateRef.current) {
        const rot = rotationStateRef.current;
        const angle = Math.atan2(e.clientY - rot.centerY, e.clientX - rot.centerX) * 180 / Math.PI;
        let newRot = ((angle - rot.startAngle + rot.startRotation) + 360) % 360;
        setAnnotations(prev => prev.map(anno => anno.id === rot.selectedId ? { ...anno, rotation: Math.round(newRot) } : anno));
        return;
      }

      if (resizeStateRef.current) {
        const resize = resizeStateRef.current;
        const deltaXP = ((e.clientX - resize.startX) / rect.width) * 100;
        const deltaYP = ((e.clientY - resize.startY) / rect.height) * 100;
        const targetAnno = annotationsRef.current.find(a => a.id === selectedIdRef.current);

        if (targetAnno && targetAnno.type === 'text') {
          const { startXVal: sX, startYVal: sY, startWVal: sW = 74, startHVal: sH = 12, handle } = resize;
          let [nX, nY, nW, nH] = [sX, sY, sW, sH];
          if (handle === 'right') nW = Math.max(5, sW + deltaXP);
          else if (handle === 'left') { nX = Math.max(0, Math.min(sX + sW - 5, sX + deltaXP)); nW = Math.max(5, sW - (nX - sX)); }
          else if (handle === 'bottom') nH = Math.max(3, sH + deltaYP);
          else if (handle === 'top') { nY = Math.max(0, Math.min(sY + sH - 3, sY + deltaYP)); nH = Math.max(3, sH - (nY - sY)); }
          else if (handle === 'bottom-right') { nW = Math.max(5, sW + deltaXP); nH = Math.max(3, sH + deltaYP); }
          setAnnotations(prev => prev.map(a => a.id === selectedIdRef.current ? { ...a, x: nX, y: nY, width: nW, height: nH } : a));
          return;
        }

        let nextRx = resize.startRx;
        let nextRy = resize.startRy;
        const { handle } = resize;
        if (handle.includes('right')) nextRx = Math.max(1, resize.startRx + deltaXP / 1.5);
        if (handle.includes('left')) nextRx = Math.max(1, resize.startRx - deltaXP / 1.5);
        if (handle.includes('bottom')) nextRy = Math.max(1, resize.startRy + deltaYP / 1.5);
        if (handle.includes('top')) nextRy = Math.max(1, resize.startRy - deltaYP / 1.5);
        if (e.shiftKey) {
          const ratio = resize.startRx / resize.startRy;
          if (handle.includes('right') || handle.includes('left')) nextRy = nextRx / ratio;
          else nextRx = nextRy * ratio;
        }
        setAnnotations(prev => prev.map(a => a.id === selectedIdRef.current ? { ...a, rx: Math.max(1.5, nextRx), ry: Math.max(1.5, nextRy) } : a));
      }
    };

    const handleGlobalPointerUp = () => {
      if (isCreatingRef.current) {
        setAnnotations(prev => {
          const temp = prev.find(a => a.id === 'temp-circle');
          if (!temp) return prev;
          if (temp.rx < 1 && temp.ry < 1) { temp.rx = 6; temp.ry = 6; }
          const finalId = `cir-${Date.now()}`;
          setSelectedId(finalId);
          return prev.map(a => a.id === 'temp-circle' ? {
            ...a, id: finalId,
            borderColor: activeBorderColorRef.current,
            borderWidth: activeBorderWidthRef.current,
            borderOpacity: activeBorderOpacityRef.current,
            fillColor: activeFillColorRef.current,
            fillOpacity: activeFillOpacityRef.current
          } : a);
        });
        setIsCreating(false);
        setCreationStart(null);
        setCanvasMode('select');
      }
      setResizeState(null);
      setMovementState(null);
      setRotationState(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent | React.PointerEvent) => {
    if (!canvasContainerRef.current || !currentImage) return;
    if (canvasMode === 'circle') {
      e.preventDefault();
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 100;
      const clickY = ((e.clientY - rect.top) / rect.height) * 100;
      setAnnotations(prev => [...prev, {
        id: 'temp-circle', type: 'circle',
        x: clickX, y: clickY, rx: 0.1, ry: 0.1, rotation: 0,
        borderColor: activeBorderColor, borderWidth: activeBorderWidth,
        borderOpacity: activeBorderOpacity, fillColor: activeFillColor, fillOpacity: activeFillOpacity
      }]);
      setIsCreating(true);
      setCreationStart({ x: clickX, y: clickY });
    } else if (canvasMode === 'text') {
      e.preventDefault();
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 100;
      const clickY = ((e.clientY - rect.top) / rect.height) * 100;
      const defaultBoxPixelWidth = 250;
      const widthPercent = Math.min(95, (defaultBoxPixelWidth / rect.width) * 100);
      const x = Math.max(0, Math.min(clickX, 100 - widthPercent));
      const y = Math.max(0, Math.min(clickY, 95));
      const newId = `txt-${Date.now()}`;
      setAnnotations(prev => [...prev, {
        id: newId, type: 'text', text: '', x, y,
        width: widthPercent, height: 12,
        fontColor: activeBorderColorRef.current || '#000000',
        fillColor: 'transparent', fillOpacity: 0.3
      }]);
      setSelectedId(newId);
      setEditingTextId(newId);
      setCanvasMode('select');
    } else {
      if (e.target === e.currentTarget) {
        setSelectedId(null);
        setEditingTextId(null);
      }
    }
  };

  const handleShapeMoveStart = (e: React.MouseEvent | React.PointerEvent, id: string, initialX: number, initialY: number) => {
    e.stopPropagation(); e.preventDefault();
    setSelectedId(id);
    setMovementState({ selectedId: id, startX: e.clientX, startY: e.clientY, startXVal: initialX, startYVal: initialY });
  };

  const handleShapeResizeStart = (e: React.MouseEvent, handle: string, anno: any) => {
    e.stopPropagation(); e.preventDefault();
    setResizeState({ handle, startX: e.clientX, startY: e.clientY, startRx: anno.rx || (anno.r || 8), startRy: anno.ry || (anno.r || 8), startXVal: anno.x, startYVal: anno.y });
  };

  const handleShapeRotateStart = (e: React.MouseEvent, anno: any) => {
    e.stopPropagation(); e.preventDefault();
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + (anno.x / 100) * rect.width;
    const centerY = rect.top + (anno.y / 100) * rect.height;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    setRotationState({ selectedId: anno.id, centerX, centerY, startAngle, startRotation: anno.rotation || 0 });
  };

  // Claim / Drive context for active LPN
  const currentClaimForLpn = matchingClaims.find(c => c.lpn === activeLpn) || sampleClaim;
  const rawFolderLink = currentClaimForLpn?.driveLink || sampleClaim?.driveLink;

  const loadDriveFiles = React.useCallback(async () => {
    if (!rawFolderLink) { setDriveError('No Google Drive folder URL linked to this claim.'); return; }
    setLoadingDriveFiles(true);
    setDriveError(null);
    try {
      let url = `/api/drive/list?driveLink=${encodeURIComponent(rawFolderLink)}`;
      if (accessToken) url += `&accessToken=${encodeURIComponent(accessToken)}`;
      if (googleClientId) url += `&clientId=${encodeURIComponent(googleClientId)}`;
      if (googleClientSecret) url += `&clientSecret=${encodeURIComponent(googleClientSecret)}`;
      if (googleRefreshToken) url += `&refreshToken=${encodeURIComponent(googleRefreshToken)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      } else {
        const errData = await res.json();
        setDriveError(errData.error || 'Failed to retrieve folder contents.');
      }
    } catch (err: any) {
      setDriveError(err.message || 'Network error loading Drive files.');
    } finally {
      setLoadingDriveFiles(false);
    }
  }, [rawFolderLink, accessToken, googleClientId, googleClientSecret, googleRefreshToken]);

  React.useEffect(() => {
    if (isModalOpen) requestAnimationFrame(() => loadDriveFiles());
  }, [isModalOpen, loadDriveFiles]);

  // Selects a Drive file into the RIGHT slot only
  const handleSelectDriveFile = (file: any) => {
    let fileProxyUrl = `/api/drive/file/${file.id}?`;
    const params: string[] = [];
    if (accessToken) params.push(`accessToken=${encodeURIComponent(accessToken)}`);
    if (googleClientId) params.push(`clientId=${encodeURIComponent(googleClientId)}`);
    if (googleClientSecret) params.push(`clientSecret=${encodeURIComponent(googleClientSecret)}`);
    if (googleRefreshToken) params.push(`refreshToken=${encodeURIComponent(googleRefreshToken)}`);
    fileProxyUrl += params.join('&');
    setSelectedSourceImage(file.name);
    setRightDriveImage(fileProxyUrl);
    setIsModalOpen(false);
  };

  // Merges left + right into the single canvas image
  const handleMerge = async () => {
    if (!leftLocalImage || !rightDriveImage) return;
    setIsMerging(true);
    try {
      const merged = await mergeImagesForComposition(leftLocalImage, rightDriveImage);
      setLpnStateMap(prev => {
        const lpn = activeLpnRef.current;
        const existing: LpnState = prev[lpn] || {
          image: null, annotations: [], leftLocalImage: null, rightDriveImage: null, isMerged: false
        };
        return { ...prev, [lpn]: { ...existing, image: merged, isMerged: true } };
      });
    } catch (err: any) {
      alert('Merge failed: ' + err.message);
    } finally {
      setIsMerging(false);
    }
  };

  // Save & upload the annotated merged composition
  const handleSaveCurrentLpn = async () => {
    if (!currentImage) {
      alert('Please merge both images before saving.');
      return;
    }
    setUploadLoading(true);
    try {
      const finalBase64 = await exportAnnotatedCanvas(currentImage, annotations);

      const res = await fetch('/api/claims/upload-annotated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lpn: activeLpn, imageData: finalBase64 })
      });
      if (!res.ok) throw new Error('Local save failed');

      let googleDriveSyncMessage = '';
      if (rawFolderLink) {
        const finalFilename = `step9composition${activeLpn}.jpg`;
        const uploadRes = await fetch('/api/drive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveLink: rawFolderLink,
            filename: finalFilename,
            imageData: finalBase64,
            accessToken,
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            refreshToken: googleRefreshToken,
            lpn: activeLpn
          })
        });
        if (uploadRes.ok) {
          googleDriveSyncMessage = ` (Synced ${finalFilename} to Google Drive!)`;
        } else {
          const errData = await uploadRes.json();
          if (accessToken || googleRefreshToken) {
            throw new Error(`Drive upload failed: ${errData.error || 'Access denied'}`);
          }
        }
      }

      setLpnSaved(prev => ({ ...prev, [activeLpn]: true }));
      alert(`✅ Composition saved${googleDriveSyncMessage}!`);
    } catch (e: any) {
      alert('Error committing composition: ' + e.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const unsavedOtherLpns = finalLpns.filter(l => l !== activeLpn && !lpnSaved[l]);
  const isFinalLpnLoop = unsavedOtherLpns.length === 0;
  const canSubmitFinalFull = finalLpns.every(l => lpnSaved[l]) || (isFinalLpnLoop && currentImage !== null);

  const handleNextOrFinish = async () => {
    await handleSaveCurrentLpn();
    if (isFinalLpnLoop) {
      onClose('complete');
    } else {
      const next = unsavedOtherLpns[0];
      if (next) setActiveLpn(next);
    }
  };

  // Local file reader for the LEFT slot
  const handleLeftLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLeftLocalImage(reader.result);
        // Reset merge state when re-uploading left image
        patchLpnState({ leftLocalImage: reader.result, image: null, isMerged: false, annotations: [] });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col bg-slate-50 text-slate-900 min-h-screen relative p-6 font-sans border-t border-slate-200">

      {/* Top Navigation Row */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onClose('partial')}
            className="flex items-center gap-2 text-[11px] font-extrabold uppercase px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 shadow-sm transition-all hover:scale-105 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#FF6700]" />
            Return to Triage Queue
          </button>
          <div className="h-6 w-[1px] bg-slate-200" />
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-black font-mono text-slate-900 tracking-widest uppercase">SHIPMENT TRIAGE WORKSPACE: {trackingId}</h2>
            <p className="text-[10px] text-slate-500 font-bold">Image Generation Checkpoint — Product Damages Quality Review</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg shadow-sm">
          <Clock className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
          <span className="text-[10px] font-mono text-indigo-700 font-bold uppercase">Session Lock Active</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-5 gap-6">

        {/* Sidebar: LPN list */}
        <div className="col-span-1 border-r border-slate-200 pr-4 flex flex-col gap-3">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">LPN Tracking List</div>
          <div className="flex flex-col gap-2">
            {finalLpns.map(lpnCode => {
              const isSaved = lpnSaved[lpnCode];
              const isActive = activeLpn === lpnCode;
              return (
                <button
                  key={lpnCode}
                  type="button"
                  onClick={() => setActiveLpn(lpnCode)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border font-mono transition-all flex flex-col gap-1 items-start relative overflow-hidden cursor-pointer',
                    isActive
                      ? 'bg-white border-indigo-500 text-indigo-900 shadow-md shadow-indigo-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
                  )}
                >
                  <span className="text-[11px] font-black tracking-tight">{lpnCode}</span>
                  <div className="flex items-center gap-1.5 mt-1 self-stretch justify-between">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400">Inventory</span>
                    {isSaved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main workspace: 80% */}
        <div className="col-span-4 flex flex-col gap-6">

          {/* Top toolbar – locked until merged */}
          <div className={cn(
            'bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-3 shadow-sm transition-opacity',
            !editingEnabled && 'opacity-50 pointer-events-none select-none'
          )}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
              <span className="text-[10px] font-black uppercase text-indigo-600 font-mono tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                Composition Studio Desk
                {!editingEnabled && (
                  <span className="ml-2 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[8px] tracking-widest">
                    🔒 MERGE REQUIRED TO UNLOCK
                  </span>
                )}
              </span>
              <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">
                SKU: {currentClaimForLpn.sku || sampleClaim.sku} | FNSKU: {currentClaimForLpn.fnsku || sampleClaim.fnsku}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Mode Selectors */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400 font-mono">1. Cursor Tool Mode</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setCanvasMode('select')}
                    className={cn('flex-1 flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border cursor-pointer',
                      canvasMode === 'select' ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')}
                    title="Select & Refine Shape"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                    Select ({annotations.length})
                  </button>
                  <button type="button" onClick={() => { setCanvasMode('circle'); setSelectedId(null); }}
                    className={cn('flex-1 flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border cursor-pointer',
                      canvasMode === 'circle' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')}
                    title="Draw circles"
                  >
                    <Circle className="w-3.5 h-3.5 text-red-500 fill-current" />
                    Circle
                  </button>
                  <button type="button" onClick={() => { setCanvasMode('text'); setSelectedId(null); }}
                    className={cn('flex-1 flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border cursor-pointer',
                      canvasMode === 'text' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')}
                    title="Place text box"
                  >
                    <Type className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                    Text
                  </button>
                </div>
              </div>

              {/* Border/Font properties */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4 border-l border-r border-slate-100 px-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 font-mono">
                      {selectedAnno?.type === 'text' ? '2. Font Color' : '2. Border Color'}
                    </span>
                    <span className="text-[9px] font-mono text-indigo-600 font-extrabold">
                      {selectedAnno?.type === 'circle' ? `${selectedAnno?.borderWidth || 4}px` : selectedAnno?.type === 'text' ? '13px font' : `${activeBorderWidth}px`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    {['#ef4444', '#f59e0b', '#10b981', '#000000', '#ffffff'].map(color => {
                      const curColor = selectedAnno ? (selectedAnno.borderColor || selectedAnno.fontColor) : activeBorderColor;
                      return (
                        <button key={color} type="button"
                          onClick={() => {
                            if (selectedAnno) {
                              setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, borderColor: color, fontColor: color } : a));
                            } else setActiveBorderColor(color);
                          }}
                          style={{ backgroundColor: color }}
                          className={cn('w-4 h-4 rounded-full border border-slate-300 transition-all hover:scale-125 focus:outline-none cursor-pointer',
                            curColor === color ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : '')}
                        />
                      );
                    })}
                  </div>
                  {(!selectedAnno || selectedAnno.type === 'circle') && (
                    <input type="range" min="1" max="15"
                      value={selectedAnno?.borderWidth || activeBorderWidth}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        if (selectedAnno) setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, borderWidth: val } : a));
                        else setActiveBorderWidth(val);
                      }}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 font-mono">
                      {selectedAnno?.type === 'text' ? '3. Font BG Opacity' : '3. Fill Tint / Opacity'}
                    </span>
                    <span className="text-[9px] font-mono text-indigo-600 font-extrabold">
                      {Math.round((selectedAnno ? selectedAnno.fillOpacity ?? 0.3 : activeFillOpacity) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <button type="button"
                      onClick={() => {
                        if (selectedAnno) setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, fillColor: 'transparent' } : a));
                        else setActiveFillColor('transparent');
                      }}
                      className={cn('px-1 py-0.5 rounded border border-slate-200 text-[8px] font-bold uppercase cursor-pointer',
                        (selectedAnno ? selectedAnno.fillColor === 'transparent' : activeFillColor === 'transparent') ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white text-slate-500')}
                    >None</button>
                    {['#ef4444', '#f59e0b', '#10b981', '#000000'].map(color => {
                      const curFillColor = selectedAnno ? selectedAnno.fillColor : activeFillColor;
                      return (
                        <button key={color} type="button"
                          onClick={() => {
                            if (selectedAnno) setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, fillColor: color } : a));
                            else setActiveFillColor(color);
                          }}
                          style={{ backgroundColor: color }}
                          className={cn('w-4 h-4 rounded-full border border-slate-300 transition-all hover:scale-125 focus:outline-none cursor-pointer',
                            curFillColor === color ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : '')}
                        />
                      );
                    })}
                  </div>
                  <input type="range" min="1" max="100"
                    value={Math.round((selectedAnno ? selectedAnno.fillOpacity ?? 0.3 : activeFillOpacity) * 100)}
                    onChange={e => {
                      const val = parseFloat(e.target.value) / 100;
                      if (selectedAnno) setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, fillOpacity: val } : a));
                      else setActiveFillOpacity(val);
                    }}
                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              {/* Text overlay adder */}
              <div className="flex flex-col gap-1.5 pl-2">
                <span className="text-[9px] font-black uppercase text-slate-400 font-mono">4. Text Overlay Box</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={adderText}
                    onChange={e => setAdderText(e.target.value)}
                    maxLength={100}
                    placeholder="E.g. OUTER DAMAGED..."
                    className="flex-1 bg-slate-50 border border-slate-200 text-[10px] px-2.5 py-2 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentImage) return;
                      const id = `txt-${Date.now()}`;
                      setAnnotations(prev => [...prev, {
                        id, type: 'text', text: adderText,
                        x: 40 + Math.random() * 10,
                        y: 40 + Math.random() * 10,
                        fontColor: '#000000'
                      }]);
                      setSelectedId(id);
                    }}
                    disabled={!editingEnabled}
                    className="bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white hover:bg-slate-800 p-2 rounded-lg transition-all cursor-pointer"
                    title="Insert text onto canvas"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ─── CENTER STAGE ─── */}
          {!isMerged ? (
            /* PRE-MERGE: dual upload containers + Merge button */
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-6">

                {/* LEFT SLOT: Local file upload */}
                <div className="flex flex-col gap-2">
                  <div className="text-[9px] font-black uppercase text-slate-500 font-mono flex items-center gap-1.5">
                    <Upload className="w-3 h-3" />
                    L1 · ORIGINAL SENT CUBE — Local Upload
                  </div>
                  <div className={cn(
                    'rounded-2xl border-2 border-dashed relative overflow-hidden flex flex-col items-center justify-center shadow-sm transition-all',
                    leftLocalImage
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-300 bg-slate-100 hover:border-indigo-400 hover:bg-slate-50'
                  )} style={{ aspectRatio: '3/4', maxHeight: 520 }}>

                    {leftLocalImage ? (
                      <>
                        <img
                          src={leftLocalImage}
                          alt="Original Sent Cube"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded font-mono uppercase tracking-widest">
                          ✓ ORIGINAL SENT CUBE
                        </div>
                        <label className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 hover:bg-slate-900 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all">
                          <Upload className="w-3 h-3" />
                          Replace
                          <input type="file" accept="image/*" className="hidden" onChange={handleLeftLocalUpload} />
                        </label>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4 p-6 text-center">
                        <ImageIcon className="w-10 h-10 text-slate-400" />
                        <div className="font-mono">
                          <p className="text-[11px] font-black uppercase text-slate-800 tracking-wide">
                            SKU: {currentClaimForLpn.sku || sampleClaim.sku || '—'}
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                            FNSKU: {currentClaimForLpn.fnsku || sampleClaim.fnsku || '—'}
                          </p>
                        </div>
                        <p className="text-[9px] text-slate-400 max-w-[180px] leading-relaxed font-medium">
                          Upload the original cube photo from your local machine.
                        </p>
                        <label className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase px-5 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 transition-all shadow-sm">
                          <Upload className="w-3.5 h-3.5" />
                          Upload Local Image
                          <input type="file" accept="image/*" className="hidden" onChange={handleLeftLocalUpload} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT SLOT: Google Drive download */}
                <div className="flex flex-col gap-2">
                  <div className="text-[9px] font-black uppercase text-slate-500 font-mono flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" />
                    R2 · RECEIVED CUBE — Drive Fetch
                  </div>
                  <div className={cn(
                    'rounded-2xl border relative overflow-hidden flex flex-col items-center justify-center shadow-sm transition-all',
                    rightDriveImage
                      ? 'border-indigo-300 bg-indigo-50/30'
                      : 'border-slate-200 bg-slate-100'
                  )} style={{ aspectRatio: '3/4', maxHeight: 520 }}>

                    {rightDriveImage ? (
                      <>
                        <img
                          src={rightDriveImage}
                          alt="Received Cube"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-3 left-3 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded font-mono uppercase tracking-widest">
                          ✓ RECEIVED CUBE
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(true)}
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 hover:bg-slate-900 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                          <ImageIcon className="w-3 h-3" />
                          Swap Drive Image
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4 p-6 text-center">
                        <ImageIcon className="w-10 h-10 text-slate-400 animate-pulse" />
                        <div>
                          <p className="text-[12px] font-black tracking-widest text-[#FF6700] uppercase font-mono">No Drive Image</p>
                          <p className="text-[9px] text-slate-500 max-w-[180px] mt-1 leading-relaxed font-medium">
                            Fetch the received cube photo from Google Drive.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(true)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 transition-all hover:scale-105 cursor-pointer"
                        >
                          Fetch from Drive
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Merge Images button – gateway to editing */}
              <div className="flex flex-col items-center gap-2 py-2">
                {!canMerge && (
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {!leftLocalImage && !rightDriveImage
                      ? 'Upload left image and fetch right image to enable merge'
                      : !leftLocalImage
                      ? 'Upload original image (left slot) to enable merge'
                      : 'Fetch received image from Drive (right slot) to enable merge'}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={!canMerge || isMerging}
                  className={cn(
                    'flex items-center gap-3 px-10 py-3.5 rounded-2xl font-black uppercase text-sm tracking-wider transition-all border shadow-lg',
                    canMerge && !isMerging
                      ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-700 text-white shadow-indigo-200 hover:scale-105 cursor-pointer'
                      : 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-60'
                  )}
                >
                  <Layers className="w-5 h-5" />
                  {isMerging ? 'Merging Images…' : 'Merge Images'}
                </button>
              </div>
            </div>
          ) : (
            /* POST-MERGE: single annotatable canvas (landscape 3:2) */
            <div
              className="w-full rounded-2xl border border-slate-200 shadow-md overflow-hidden relative bg-white"
              style={{ aspectRatio: '3/2' }}
            >
              <div className="absolute top-3 left-3 bg-white/90 border border-slate-200 text-[9px] font-black px-2 py-0.5 rounded text-indigo-600 uppercase tracking-widest font-mono z-40 shadow-sm">
                Merged Composition Canvas
              </div>
              <div
                ref={canvasContainerRef}
                onPointerDown={handleCanvasMouseDown}
                className={cn(
                  'w-full h-full relative select-none bg-white overflow-hidden',
                  canvasMode === 'circle' ? 'cursor-crosshair' : 'cursor-default'
                )}
              >
                <img
                  src={currentImage!}
                  alt="Merged Composition"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain select-none pointer-events-none"
                />

                {/* Annotation overlay */}
                <div className="absolute inset-0 w-full h-full z-10">
                  {annotations.map(anno => {
                    if (anno.type === 'circle') {
                      const isSelected = selectedId === anno.id;
                      const rx = anno.rx !== undefined ? anno.rx : (anno.r || 8);
                      const ry = anno.ry !== undefined ? anno.ry : (anno.r || 8);
                      const rot = anno.rotation || 0;
                      const bColor = anno.borderColor || '#000000';
                      const bWidth = anno.borderWidth !== undefined ? anno.borderWidth : 4;
                      const bOpacity = anno.borderOpacity !== undefined ? anno.borderOpacity : 1;
                      const fColor = anno.fillColor || 'transparent';
                      const fOpacity = anno.fillOpacity !== undefined ? anno.fillOpacity : 0.3;
                      return (
                        <div
                          key={anno.id}
                          style={{ left: `${anno.x}%`, top: `${anno.y}%`, width: `${rx * 2}%`, height: `${ry * 2}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)`, position: 'absolute' }}
                          className={cn('absolute group/circle z-20 select-none', isSelected ? 'z-30 cursor-move' : 'cursor-pointer')}
                          onPointerDown={e => { if (canvasMode === 'select') handleShapeMoveStart(e, anno.id, anno.x, anno.y); }}
                        >
                          <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: `${bWidth}px solid ${bColor}`, opacity: bOpacity, backgroundColor: 'transparent' }} className="relative w-full h-full shadow-lg">
                            {fColor !== 'transparent' && (
                              <div style={{ backgroundColor: fColor, opacity: fOpacity }} className="absolute inset-0 rounded-full" />
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute -inset-1 border-2 border-dashed border-indigo-500 rounded-lg pointer-events-none" />
                          )}
                          {isSelected && (
                            <>
                              <div style={{ top: '-22px', left: '50%', transform: 'translateX(-50%)' }}
                                onPointerDown={e => handleShapeRotateStart(e, anno)}
                                className="absolute w-4 h-4 bg-indigo-600 rounded-full border border-white cursor-alias flex items-center justify-center shadow-lg active:scale-125 transition-transform">
                                <RotateCw className="w-2.5 h-2.5 text-white" />
                              </div>
                              <div style={{ top: '-11px', left: '50%', transform: 'translateX(-50%)', width: '1px', height: '11px' }} className="absolute bg-indigo-500 pointer-events-none" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'top', anno)} className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ns-resize" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'bottom', anno)} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ns-resize" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'left', anno)} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ew-resize" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'right', anno)} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ew-resize" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'top-left', anno)} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nwse-resize" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'top-right', anno)} className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nesw-resize" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'bottom-left', anno)} className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nesw-resize" />
                              <div onPointerDown={e => handleShapeResizeStart(e, 'bottom-right', anno)} className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nwse-resize" />
                              <div className="absolute top-[108%] left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg shadow-xl z-50">
                                <button type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    const newId = `cir-${Date.now()}`;
                                    setAnnotations(prev => [...prev, { ...anno, id: newId, x: Math.min(95, anno.x + 4), y: Math.min(95, anno.y + 4) }]);
                                    setSelectedId(newId);
                                  }}
                                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer">
                                  <Copy className="w-3 h-3" />
                                </button>
                                <div className="w-[1px] h-3 bg-slate-700" />
                                <button type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setAnnotations(prev => prev.filter(c => c.id !== anno.id));
                                    setSelectedId(null);
                                  }}
                                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors cursor-pointer">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }

                    if (anno.type === 'text') {
                      const isSelected = selectedId === anno.id;
                      const isEditing = editingTextId === anno.id;
                      return (
                        <div
                          key={anno.id}
                          style={{
                            left: `${anno.x}%`, top: `${anno.y}%`,
                            width: `${anno.width || 74}%`,
                            minHeight: anno.height ? `${anno.height}%` : 'auto',
                            position: 'absolute',
                            backgroundColor: anno.fillColor && anno.fillColor !== 'transparent'
                              ? hexToRgba(anno.fillColor, anno.fillOpacity !== undefined ? anno.fillOpacity : 0.3)
                              : 'transparent',
                            border: isSelected
                              ? '1px dashed #6366f1'
                              : anno.fillColor && anno.fillColor !== 'transparent'
                              ? `1px solid ${hexToRgba(anno.fillColor, 0.4)}`
                              : '1px solid transparent'
                          }}
                          className={cn(
                            'group/text flex flex-col items-stretch text-black p-1 select-none z-30 transition-shadow',
                            isSelected ? 'ring-2 ring-indigo-500/10 shadow-lg cursor-move' : 'hover:border-black/10 hover:bg-slate-50/10 rounded cursor-pointer'
                          )}
                          onPointerDown={e => { if (!isEditing) handleShapeMoveStart(e, anno.id, anno.x, anno.y); }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingTextId(anno.id); }}
                        >
                          {isEditing ? (
                            <textarea
                              value={anno.text || ''}
                              onChange={e => setAnnotations(prev => prev.map(a => a.id === anno.id ? { ...a, text: e.target.value } : a))}
                              onBlur={() => setEditingTextId(null)}
                              maxLength={100}
                              placeholder="Type damage text..."
                              ref={el => {
                                if (el) { el.focus(); el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                              }}
                              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                              onPointerDown={e => e.stopPropagation()}
                              className="w-full h-full min-h-[40px] bg-transparent border-none outline-none resize-none overflow-hidden text-[13px] font-bold p-0 text-inherit font-sans leading-relaxed"
                              style={{ color: anno.fontColor || anno.borderColor || '#000000' }}
                            />
                          ) : (
                            <div
                              className="w-full text-left break-words whitespace-pre-wrap text-[13px] font-bold leading-relaxed font-sans min-h-[1.5rem]"
                              style={{ color: anno.fontColor || anno.borderColor || '#000000' }}
                            >
                              {anno.text || <span className="opacity-40 italic text-[11px] font-normal font-sans">(Double-click to type)</span>}
                            </div>
                          )}

                          {isSelected && (
                            <div className="absolute -top-7 right-0 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded shadow-xl flex items-center gap-1 z-50 pointer-events-auto">
                              <button type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setAnnotations(prev => prev.filter(c => c.id !== anno.id));
                                  setSelectedId(null); setEditingTextId(null);
                                }}
                                className="p-1 text-red-400 hover:text-red-300 rounded transition-colors text-[10px] uppercase font-bold flex items-center gap-1 cursor-pointer">
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          )}

                          {isSelected && !isEditing && (
                            <>
                              {[
                                { handle: 'right', cls: 'absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
                                { handle: 'left', cls: 'absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
                                { handle: 'bottom', cls: 'absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
                                { handle: 'top', cls: 'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
                                { handle: 'bottom-right', cls: 'absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize bg-indigo-600' },
                              ].map(({ handle, cls }) => (
                                <div key={handle}
                                  onPointerDown={e => {
                                    e.stopPropagation(); e.preventDefault();
                                    setResizeState({ handle, startX: e.clientX, startY: e.clientY, startRx: 0, startRy: 0, startXVal: anno.x, startYVal: anno.y, startWVal: anno.width || 74, startHVal: anno.height || 12 });
                                  }}
                                  className={cn('w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded shadow hover:scale-125 z-40', cls)}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Toolbar */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!editingEnabled) return;
                  const id = `cir-${Date.now()}`;
                  setAnnotations(prev => [...prev, {
                    id, type: 'circle',
                    x: 45 + Math.random() * 10, y: 45 + Math.random() * 10,
                    rx: 8, ry: 8, rotation: 0,
                    borderColor: activeBorderColor, borderWidth: activeBorderWidth,
                    borderOpacity: activeBorderOpacity, fillColor: activeFillColor, fillOpacity: activeFillOpacity
                  }]);
                  setSelectedId(id);
                }}
                disabled={!editingEnabled}
                className="bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 font-black uppercase text-[10px] px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:scale-105"
              >
                <Circle className="w-4 h-4 text-red-500" />
                Add Circle Highlight
              </button>

              <button
                type="button"
                onClick={() => { setAnnotations([]); setSelectedId(null); }}
                disabled={!editingEnabled || annotations.length === 0}
                className="bg-white hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 hover:border-red-100 text-slate-500 font-extrabold uppercase text-[10px] px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Clear Annotations
              </button>

              {isMerged && (
                <button
                  type="button"
                  onClick={() => {
                    // Re-merge resets to pre-merge state for this LPN
                    patchLpnState({ image: null, isMerged: false, annotations: [] });
                  }}
                  className="text-amber-600 hover:text-amber-700 font-black uppercase text-[10px] ml-1 flex items-center gap-1.5 cursor-pointer border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg transition-all"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Re-Merge
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleNextOrFinish}
                disabled={!editingEnabled || uploadLoading || (isFinalLpnLoop && !canSubmitFinalFull)}
                className={cn(
                  'font-black uppercase text-xs px-8 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 border',
                  uploadLoading
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : !editingEnabled
                    ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-60'
                    : isFinalLpnLoop
                    ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                    : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white shadow-indigo-100 cursor-pointer'
                )}
              >
                {uploadLoading ? (
                  <span>COMMITTING COMPOSITIONS…</span>
                ) : !editingEnabled ? (
                  <span>🔒 Merge First</span>
                ) : isFinalLpnLoop ? (
                  <><Check className="w-4 h-4" /><span>Done and Ready for File</span></>
                ) : (
                  <span>Done</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Google Drive image picker (RIGHT slot only) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-black font-mono tracking-wider text-slate-900 uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  GOOGLE DRIVE — RECEIVED CUBE IMAGE PICKER
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">
                  Active LPN: {activeLpn} · Selecting for R2 (Right Slot)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-mono font-black text-xs cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
              >
                CLOSE
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* Folder link header */}
              <div className="bg-indigo-50/55 border border-indigo-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-indigo-600 font-mono tracking-widest">DRIVE FOLDER LINK</span>
                  <a href={rawFolderLink} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-indigo-800 break-all select-all flex items-center gap-1.5 hover:underline decoration-indigo-400">
                    {rawFolderLink || 'No Folder Linked (Configure driveLink)'}
                  </a>
                </div>
                {accessToken && (
                  <button
                    type="button"
                    onClick={() => { setAccessToken(''); sessionStorage.removeItem('GOOGLE_DRIVE_ACCESS_TOKEN'); setDriveFiles([]); }}
                    className="self-start md:self-auto text-[9px] font-black uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Disconnect Drive
                  </button>
                )}
              </div>

              {/* File grid */}
              {loadingDriveFiles && driveFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Retrieving evidence files…</span>
                </div>
              ) : driveFiles.length > 0 ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Drive files for LPN folder:</span>
                    <button type="button" onClick={() => loadDriveFiles()}
                      className="text-[9px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1 cursor-pointer">
                      🔄 Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-4">
                    {driveFiles.map((file, idx) => {
                      let fileProxyUrl = `/api/drive/file/${file.id}?`;
                      const params: string[] = [];
                      if (accessToken) params.push(`accessToken=${encodeURIComponent(accessToken)}`);
                      if (googleClientId) params.push(`clientId=${encodeURIComponent(googleClientId)}`);
                      if (googleClientSecret) params.push(`clientSecret=${encodeURIComponent(googleClientSecret)}`);
                      if (googleRefreshToken) params.push(`refreshToken=${encodeURIComponent(googleRefreshToken)}`);
                      fileProxyUrl += params.join('&');
                      return (
                        <button key={file.id} type="button" onClick={() => handleSelectDriveFile(file)}
                          className="group text-left border border-slate-200 bg-slate-50 rounded-2xl overflow-hidden hover:border-indigo-500 hover:shadow-md hover:bg-white transition-all flex flex-col items-stretch cursor-pointer">
                          <div className="aspect-[9/16] max-h-[160px] bg-slate-100 overflow-hidden relative">
                            <img src={file.thumbnailLink || fileProxyUrl} alt={file.name} referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute top-2 left-2 bg-slate-900/80 text-[8px] font-black font-mono text-white px-1.5 py-0.5 rounded uppercase">
                              Step Image
                            </div>
                          </div>
                          <div className="p-3">
                            <span className="text-[9px] font-black uppercase text-indigo-500 block font-mono">Stream #{idx + 1}</span>
                            <p className="text-[10px] font-sans text-slate-800 font-extrabold mt-1 line-clamp-1">{file.name}</p>
                            <span className="text-[8px] font-semibold text-slate-400 block mt-0.5 uppercase font-mono">
                              {file.size ? `${(parseInt(file.size) / 1024).toFixed(0)} KB` : 'Drive File'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Auth configuration */
                <div className="border border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white p-6 rounded-2xl flex flex-col items-center text-center gap-4 shadow-sm">
                  {driveError && (
                    <div className="w-full text-left border border-red-100 bg-red-50/70 p-4 rounded-xl flex flex-col gap-2 text-xs mb-2">
                      <span className="font-extrabold uppercase text-red-700 font-mono tracking-wider">Drive Connection Error</span>
                      <p className="text-red-600 font-medium leading-relaxed font-mono text-[11px] bg-red-100/50 p-2 rounded border border-red-200/50 break-words max-h-36 overflow-y-auto">{driveError}</p>
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-1">
                    <ImageIcon className="w-6 h-6 text-indigo-600 animate-pulse" />
                  </div>
                  <div className="max-w-md flex flex-col gap-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 font-mono">Authenticate Google Workspace Drive Link</h3>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                      Connect to the Drive folder containing inspection evidence for return verification.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const clientId = '415052824637-pb4u97184vghsc7gqj8sc9k0bca7bdf6.apps.googleusercontent.com';
                        const scopes = 'https://www.googleapis.com/auth/drive';
                        const redirectUrl = window.location.origin + '/triage';
                        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=token&scope=${encodeURIComponent(scopes)}&prompt=consent`;
                        const width = 600; const height = 650;
                        const left = window.screen.width / 2 - width / 2;
                        const top = window.screen.height / 2 - height / 2;
                        const popup = window.open(oauthUrl, 'GoogleDriveAuth', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`);
                        const timer = setInterval(() => {
                          try {
                            if (!popup || popup.closed) { clearInterval(timer); return; }
                            if (popup.location.href.includes('access_token=')) {
                              const hash = popup.location.hash;
                              const params = new URLSearchParams(hash.substring(1));
                              const token = params.get('access_token');
                              if (token) {
                                setAccessToken(token);
                                sessionStorage.setItem('GOOGLE_DRIVE_ACCESS_TOKEN', token);
                                clearInterval(timer);
                                popup.close();
                              }
                            }
                          } catch (_) {}
                        }, 500);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-5 py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider transition-all shadow-md cursor-pointer"
                    >
                      💡 Option 1: Live Pop-up Authorization (Standard, lasts 60min)
                    </button>
                  </div>

                  <div className="w-full max-w-md flex items-center justify-between my-2 text-slate-300">
                    <div className="h-[1px] bg-slate-200 flex-1" />
                    <span className="text-[9px] font-black uppercase font-mono px-3 text-slate-400">OR PROVIDE CREDENTIALS</span>
                    <div className="h-[1px] bg-slate-200 flex-1" />
                  </div>

                  <div className="w-full max-w-md flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Option 2: Paste short-lived Google Access Token…"
                        id="manual_token_input"
                        className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl text-slate-900 flex-1 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('manual_token_input') as HTMLInputElement;
                          const token = input?.value?.trim();
                          if (token) {
                            setAccessToken(token);
                            sessionStorage.setItem('GOOGLE_DRIVE_ACCESS_TOKEN', token);
                          } else {
                            alert('Please enter a valid Google OAuth access token first!');
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-black uppercase text-[10px] px-4 py-2 rounded-xl"
                      >
                        Activate
                      </button>
                    </div>
                  </div>

                  <div className="w-full max-w-md border border-indigo-100 rounded-xl bg-white text-left overflow-hidden mt-2">
                    <button
                      type="button"
                      onClick={() => setShowRefreshForm(!showRefreshForm)}
                      className="w-full px-4 py-3 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-900 font-extrabold text-[10px] uppercase font-mono tracking-wider flex items-center justify-between border-b border-indigo-100/55 transition-all text-left"
                    >
                      <span>🔄 Option 3: Permanent Auto-Refresh Credentials</span>
                      <span>{showRefreshForm ? '▼' : '▶'}</span>
                    </button>
                    {showRefreshForm && (
                      <div className="p-4 flex flex-col gap-3 animate-fade-in">
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Configure permanent credentials for automatic Access Token renewal.
                        </p>
                        {[
                          { label: 'Google Client ID', key: 'CLIENT_ID', val: googleClientId, setter: setGoogleClientIdState, type: 'text', placeholder: '415052824637-…apps.googleusercontent.com' },
                          { label: 'Google Client Secret', key: 'CLIENT_SECRET', val: googleClientSecret, setter: setGoogleClientSecretState, type: 'password', placeholder: 'GOCSPX-…' },
                          { label: 'Google Refresh Token', key: 'REFRESH_TOKEN', val: googleRefreshToken, setter: setGoogleRefreshTokenState, type: 'password', placeholder: '1//0…' },
                        ].map(({ label, key, val, setter, type, placeholder }) => (
                          <div key={key} className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-600 font-mono">{label}</label>
                            <input
                              type={type}
                              value={val}
                              onChange={e => { const v = e.target.value.trim(); setter(v); localStorage.setItem(`GOOGLE_DRIVE_${key}`, v); }}
                              placeholder={placeholder}
                              className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500 w-full"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <button type="button"
                            onClick={() => {
                              if (googleClientId && googleClientSecret && googleRefreshToken) loadDriveFiles();
                              else alert('Please fill all credentials before testing!');
                            }}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-extrabold uppercase text-[9px] py-1.5 rounded-lg transition-all font-mono cursor-pointer">
                            ⚡ Test & Save Connection
                          </button>
                          {(googleClientId || googleClientSecret || googleRefreshToken) && (
                            <button type="button"
                              onClick={() => {
                                ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'].forEach(k => localStorage.removeItem(`GOOGLE_DRIVE_${k}`));
                                setGoogleClientIdState(''); setGoogleClientSecretState(''); setGoogleRefreshTokenState(''); setDriveFiles([]);
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-extrabold uppercase text-[9px] px-3 py-1.5 rounded-lg transition-all">
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
