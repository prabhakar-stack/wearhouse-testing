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
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Claim } from '../types';

export interface ImageGenerationWorkspaceProps {
  trackingId: string;
  claims: Claim[];
  onClose: (exitType: 'complete' | 'partial') => void;
}

const STREAM_OPTIONS = [
  { name: "Damaged Outer Box Parcel View", url: "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=600&auto=format&fit=crop" },
  { name: "Returned Rubik's Cube Scratches", url: "https://images.unsplash.com/photo-1591951425328-48c1fe7179cd?w=600&auto=format&fit=crop" },
  { name: "Product Packaging Detached Seal", url: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop" },
  { name: "Broken Hardware Chassis Inspection", url: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop" }
];

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

const exportAnnotatedCanvas = (imageSrc: string, annotations: any[]): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      const W = img.naturalWidth || 800;
      const H = img.naturalHeight || 600;
      
      // Target aspect ratio is 9:16 (0.5625)
      const targetRatio = 9 / 16;
      const currentRatio = W / H;
      
      let canvasW = W;
      let canvasH = H;
      let imgX = 0;
      let imgY = 0;
      let drawW = W;
      let drawH = H;
      
      if (Math.abs(currentRatio - targetRatio) < 0.001) {
        canvasW = W;
        canvasH = H;
        imgX = 0;
        imgY = 0;
        drawW = W;
        drawH = H;
      } else if (currentRatio > targetRatio) {
        // Landscape or wider -> keep width, pad height (letterbox)
        canvasW = W;
        canvasH = Math.round(W / targetRatio);
        imgX = 0;
        imgY = Math.round((canvasH - H) / 2);
        drawW = W;
        drawH = H;
      } else {
        // Narrow portrait -> keep height, pad width (pillarbox)
        canvasH = H;
        canvasW = Math.round(H * targetRatio);
        imgX = Math.round((canvasW - W) / 2);
        imgY = 0;
        drawW = W;
        drawH = H;
      }
      
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Paint blank padding with white background (Default padding background is white)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, imgX, imgY, drawW, drawH);
        
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        annotations.forEach(anno => {
          if (anno.type === 'circle') {
            const cx = (anno.x / 100) * canvas.width;
            const cy = (anno.y / 100) * canvas.height;
            const rx = anno.rx !== undefined ? (anno.rx / 100) * canvas.width : ((anno.r || 8) / 100) * canvas.width;
            const ry = anno.ry !== undefined ? (anno.ry / 100) * canvas.height : ((anno.r || 8) / 100) * canvas.height;
            const rotation = (anno.rotation || 0) * Math.PI / 180;
            
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.beginPath();
            
            // Draw ellipse at (0, 0)
            ctx.ellipse(0, 0, rx, ry, 0, 0, 2 * Math.PI);
            
            // Proportional border width scaling based on canvas width vs mock editor viewport (337px wide)
            const bWidth = anno.borderWidth !== undefined ? anno.borderWidth : 4;
            ctx.lineWidth = bWidth * (canvas.width / 337);
            
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
            const tx = (anno.x / 100) * canvas.width;
            const ty = (anno.y / 100) * canvas.height;
            const tW = ((anno.width || 74) / 100) * canvas.width;
            
            // Scaled font metrics based on canvas dimensions vs editor container (337px base width)
            const fontSize = 13 * (canvas.width / 337);
            const lineHeight = fontSize * 1.4;
            const padding = fontSize * 0.4;
            
            ctx.save();
            ctx.font = `bold ${fontSize}px sans-serif`;
            
            // Wrap text multi-line
            const paragraphLines = (anno.text || '').split('\n');
            const wrappedLines: string[] = [];
            
            paragraphLines.forEach(paragraph => {
              const words = paragraph.split(' ');
              let currentLine = '';
              for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine ? currentLine + ' ' + word : word;
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > tW - padding * 2 && i > 0) {
                  wrappedLines.push(currentLine);
                  currentLine = word;
                } else {
                  currentLine = testLine;
                }
              }
              if (currentLine !== undefined && currentLine !== '') {
                wrappedLines.push(currentLine);
              }
            });
            
            const totalLinesHeight = wrappedLines.length * lineHeight;
            const contentHeight = totalLinesHeight + padding * 2;
            const manualHeightPx = anno.height ? (anno.height / 100) * canvas.height : 0;
            const boxHeight = Math.max(contentHeight, manualHeightPx);
            
            // Render background if custom background was supplied
            if (anno.fillColor && anno.fillColor !== 'transparent') {
              ctx.fillStyle = hexToRgba(anno.fillColor, anno.fillOpacity !== undefined ? anno.fillOpacity : 0.3);
              ctx.fillRect(tx, ty, tW, boxHeight);
              ctx.strokeStyle = hexToRgba(anno.fillColor, 0.4);
              ctx.lineWidth = 1 * (canvas.width / 337);
              ctx.strokeRect(tx, ty, tW, boxHeight);
            }
            
            // Draw text lines
            ctx.fillStyle = anno.fontColor || anno.borderColor || '#ef4444';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            
            wrappedLines.forEach((line, index) => {
              const lineY = ty + padding + (index * lineHeight);
              ctx.fillText(line, tx + padding, lineY);
            });
            
            ctx.restore();
          }
        });
      }
      resolve(canvas.toDataURL("image/jpeg", 1.0));
    };
    img.onerror = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        annotations.forEach(anno => {
          if (anno.type === 'circle') {
            const cx = (anno.x / 100) * canvas.width;
            const cy = (anno.y / 100) * canvas.height;
            const rx = anno.rx !== undefined ? (anno.rx / 100) * canvas.width : ((anno.r || 8) / 100) * canvas.width;
            const ry = anno.ry !== undefined ? (anno.ry / 100) * canvas.height : ((anno.r || 8) / 100) * canvas.height;
            const rotation = (anno.rotation || 0) * Math.PI / 180;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, 2 * Math.PI);
            
            const bWidth = anno.borderWidth !== undefined ? anno.borderWidth : 4;
            ctx.lineWidth = bWidth * (canvas.width / 337);
            
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
            const tx = (anno.x / 100) * canvas.width;
            const ty = (anno.y / 100) * canvas.height;
            const tW = ((anno.width || 74) / 100) * canvas.width;
            
            // Scaled font metrics based on canvas dimensions vs editor container (337px base width)
            const fontSize = 13 * (canvas.width / 337);
            const lineHeight = fontSize * 1.4;
            const padding = fontSize * 0.4;
            
            ctx.save();
            ctx.font = `bold ${fontSize}px sans-serif`;
            
            // Wrap text multi-line
            const paragraphLines = (anno.text || '').split('\n');
            const wrappedLines: string[] = [];
            
            paragraphLines.forEach(paragraph => {
              const words = paragraph.split(' ');
              let currentLine = '';
              for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine ? currentLine + ' ' + word : word;
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > tW - padding * 2 && i > 0) {
                  wrappedLines.push(currentLine);
                  currentLine = word;
                } else {
                  currentLine = testLine;
                }
              }
              if (currentLine !== undefined && currentLine !== '') {
                wrappedLines.push(currentLine);
              }
            });
            
            const totalLinesHeight = wrappedLines.length * lineHeight;
            const contentHeight = totalLinesHeight + padding * 2;
            const manualHeightPx = anno.height ? (anno.height / 100) * canvas.height : 0;
            const boxHeight = Math.max(contentHeight, manualHeightPx);
            
            // Render background if custom background was supplied
            if (anno.fillColor && anno.fillColor !== 'transparent') {
              ctx.fillStyle = hexToRgba(anno.fillColor, anno.fillOpacity !== undefined ? anno.fillOpacity : 0.3);
              ctx.fillRect(tx, ty, tW, boxHeight);
              ctx.strokeStyle = hexToRgba(anno.fillColor, 0.4);
              ctx.lineWidth = 1 * (canvas.width / 337);
              ctx.strokeRect(tx, ty, tW, boxHeight);
            }
            
            // Draw text lines
            ctx.fillStyle = anno.fontColor || anno.borderColor || '#ef4444';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            
            wrappedLines.forEach((line, index) => {
              const lineY = ty + padding + (index * lineHeight);
              ctx.fillText(line, tx + padding, lineY);
            });
            
            ctx.restore();
          }
        });
      }
      resolve(canvas.toDataURL("image/jpeg", 1.0));
    };
    img.src = imageSrc;
  });
};

const createCombinedImage = (compositionBase64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (img.naturalWidth || 800) * 2;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // L1: Left half - Reference Image (plain slate color block)
        ctx.fillStyle = '#cbd5e1'; // slate-300
        ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
        
        ctx.fillStyle = '#475569'; // slate-600
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('L1: REFERENCE IMAGE', canvas.width / 4, canvas.height / 2);
        
        // R2: Right half - Composition Edit Created
        ctx.drawImage(img, canvas.width / 2, 0, canvas.width / 2, canvas.height);
      }
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => {
      resolve(compositionBase64);
    };
    img.src = compositionBase64;
  });
};

export default function ImageGenerationWorkspace({ trackingId, claims, onClose }: ImageGenerationWorkspaceProps) {
  const matchingClaims = claims.filter(c => c.trackingId === trackingId);
  const sampleClaim = matchingClaims[0] || {} as Claim;

  const orderLpns = React.useMemo(() => {
    const list = matchingClaims.map(c => c.lpn);
    return Array.from(new Set(list)).filter(Boolean) as string[];
  }, [matchingClaims]);

  const finalLpns = orderLpns.length > 0 ? orderLpns : ["LPN_MOCK_FALLBACK"];

  const [activeLpn, setActiveLpn] = useState<string>(finalLpns[0] || "");
  const [lpnStateMap, setLpnStateMap] = useState<Record<string, {
    image: string | null;
    annotations: any[];
  }>>({});
  const [lpnSaved, setLpnSaved] = useState<Record<string, boolean>>({});
  
  const [adderText, setAdderText] = useState("DAMAGE LOCATION");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Google Drive integration states
  const [accessToken, setAccessToken] = useState<string>(() => {
    return sessionStorage.getItem("GOOGLE_DRIVE_ACCESS_TOKEN") || "";
  });
  const [googleClientId, setGoogleClientIdState] = useState<string>(() => {
    return localStorage.getItem("GOOGLE_DRIVE_CLIENT_ID") || "";
  });
  const [googleClientSecret, setGoogleClientSecretState] = useState<string>(() => {
    return localStorage.getItem("GOOGLE_DRIVE_CLIENT_SECRET") || "";
  });
  const [googleRefreshToken, setGoogleRefreshTokenState] = useState<string>(() => {
    return localStorage.getItem("GOOGLE_DRIVE_REFRESH_TOKEN") || "";
  });
  const [showRefreshForm, setShowRefreshForm] = useState<boolean>(false);

  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [selectedSourceImage, setSelectedSourceImage] = useState<string | null>(null);

  // Shape Overlay, Selection, and Microsoft Paint-like Properties States
  const [canvasMode, setCanvasMode] = useState<'select' | 'circle' | 'text'>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Styling Defaults
  const [activeBorderColor, setActiveBorderColor] = useState<string>('#000000'); // Black default border color
  const [activeBorderWidth, setActiveBorderWidth] = useState<number>(4); // Thickness slider (1-20px)
  const [activeBorderOpacity, setActiveBorderOpacity] = useState<number>(1.0); // Opacity (0.0 - 1.0)
  const [activeFillColor, setActiveFillColor] = useState<string>('transparent'); // Transparent fill (default)
  const [activeFillOpacity, setActiveFillOpacity] = useState<number>(0.3); // Transparency (0.0 - 1.0)

  // Drag creation tracker states
  const [isCreating, setIsCreating] = useState(false);
  const [creationStart, setCreationStart] = useState<{ x: number; y: number } | null>(null);

  interface ResizeState {
    handle: string;
    startX: number;
    startY: number;
    startRx: number;
    startRy: number;
    startXVal: number;
    startYVal: number;
    startWVal?: number;
    startHVal?: number;
  }
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  interface MovementState {
    selectedId: string;
    startX: number;
    startY: number;
    startXVal: number;
    startYVal: number;
  }
  const [movementState, setMovementState] = useState<MovementState | null>(null);

  interface RotationState {
    selectedId: string;
    centerX: number;
    centerY: number;
    startAngle: number;
    startRotation: number;
  }
  const [rotationState, setRotationState] = useState<RotationState | null>(null);

  const canvasContainerRef = React.useRef<HTMLDivElement>(null);

  // Keep references to prevent window event listeners from tearing down and rebuilding constantly
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

  // Active state selectors
  const activeState = lpnStateMap[activeLpn] || { image: null, annotations: [] };
  const currentImage = activeState.image;
  const annotations = activeState.annotations;
  const selectedAnno = selectedId ? annotations.find(a => a.id === selectedId) : null;

  // Synchronize ref nodes in sync with render cycles
  React.useEffect(() => { 
    activeLpnRef.current = activeLpn; 
    requestAnimationFrame(() => {
      setSelectedId(null); // Clear active item focus on LPN swap
    });
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

  const setAnnotations = (newAnnos: any[] | ((prev: any[]) => any[])) => {
    setLpnStateMap(prev => {
      const targetLpn = activeLpnRef.current;
      const existing = prev[targetLpn] || { image: null, annotations: [] };
      const updated = typeof newAnnos === 'function' ? newAnnos(existing.annotations) : newAnnos;
      return {
        ...prev,
        [targetLpn]: { ...existing, annotations: updated }
      };
    });
  };

  // Keyboard support: Delete / Copy / Paste / Arrow Movements
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (!selectedId) return;

      const activeAnno = annotations.find(a => a.id === selectedId);
      if (!activeAnno) return;

      const step = e.shiftKey ? 10 : 1; 
      const stepPercent = step * 0.4; // maps 1px bounds to visual percent coordinates

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
            const pasted = {
              ...copied,
              id: newId,
              x: Math.min(95, Math.max(5, (copied.x || 45) + 4)),
              y: Math.min(95, Math.max(5, (copied.y || 45) + 4))
            };
            setAnnotations(prev => [...prev, pasted]);
            setSelectedId(newId);
          } catch (err) {}
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

  // Mouse / Touch Pointer drag, move, resize, and rotation gesture hooks using unified pointer handlers
  React.useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (
        !resizeStateRef.current && 
        !movementStateRef.current && 
        !rotationStateRef.current && 
        !(isCreatingRef.current && creationStartRef.current)
      ) {
        return;
      }

      if (!canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const currPercentX = ((e.clientX - rect.left) / rect.width) * 100;
      const currPercentY = ((e.clientY - rect.top) / rect.height) * 100;

      // 1. LIVE SHAPE CREATION (DRAW & DRAG)
      if (isCreatingRef.current && creationStartRef.current) {
        const start = creationStartRef.current;
        setAnnotations(prev => prev.map(anno => {
          if (anno.id === 'temp-circle') {
            const downX = start.x;
            const downY = start.y;

            let rx = Math.abs(currPercentX - downX) / 2;
            let ry = Math.abs(currPercentY - downY) / 2;

            if (e.shiftKey) {
              // Perfect circle constraint: adapt aspect-ratio
              const ratio = rect.height / rect.width;
              ry = rx * (1 / ratio);
            }

            return {
              ...anno,
              x: downX + (currPercentX - downX) / 2,
              y: downY + (currPercentY - downY) / 2,
              rx: Math.max(0.5, rx),
              ry: Math.max(0.5, ry)
            };
          }
          return anno;
        }));
        return;
      }

      // 2. MOVE EXISTING SHAPE / TEXT OVERLAY
      if (movementStateRef.current) {
        const move = movementStateRef.current;
        const deltaPercentX = ((e.clientX - move.startX) / rect.width) * 100;
        const deltaPercentY = ((e.clientY - move.startY) / rect.height) * 100;

        setAnnotations(prev => prev.map(anno => {
          if (anno.id === move.selectedId) {
            const widthVal = anno.type === 'text' ? (anno.width || 74) : 0;
            const heightVal = anno.type === 'text' ? (anno.height || 12) : 0;
            return {
              ...anno,
              x: Math.min(100 - widthVal, Math.max(0, move.startXVal + deltaPercentX)),
              y: Math.min(100 - heightVal, Math.max(0, move.startYVal + deltaPercentY))
            };
          }
          return anno;
        }));
        return;
      }

      // 3. FREE ROTATION
      if (rotationStateRef.current) {
        const rot = rotationStateRef.current;
        const angle = Math.atan2(e.clientY - rot.centerY, e.clientX - rot.centerX) * 180 / Math.PI;
        let newRot = angle - rot.startAngle + rot.startRotation;
        newRot = (newRot + 360) % 360;
        setAnnotations(prev => prev.map(anno => {
          if (anno.id === rot.selectedId) {
            return {
              ...anno,
              rotation: Math.round(newRot)
            };
          }
          return anno;
        }));
        return;
      }

      // 4. MULTI-HANDLE RESIZING
      if (resizeStateRef.current) {
        const resize = resizeStateRef.current;
        const deltaXPercent = ((e.clientX - resize.startX) / rect.width) * 100;
        const deltaYPercent = ((e.clientY - resize.startY) / rect.height) * 100;

        const targetAnno = annotationsRef.current.find(a => a.id === selectedIdRef.current);
        if (targetAnno && targetAnno.type === 'text') {
          const startX = resize.startXVal;
          const startY = resize.startYVal;
          const startW = resize.startWVal ?? 74;
          const startH = resize.startHVal ?? 12;
          const handle = resize.handle;

          let nextX = startX;
          let nextY = startY;
          let nextW = startW;
          let nextH = startH;

          if (handle === 'right') {
            nextW = Math.max(5, startW + deltaXPercent);
          } else if (handle === 'left') {
            nextX = Math.max(0, Math.min(startX + startW - 5, startX + deltaXPercent));
            nextW = Math.max(5, startW - (nextX - startX));
          } else if (handle === 'bottom') {
            nextH = Math.max(3, startH + deltaYPercent);
          } else if (handle === 'top') {
            nextY = Math.max(0, Math.min(startY + startH - 3, startY + deltaYPercent));
            nextH = Math.max(3, startH - (nextY - startY));
          } else if (handle === 'bottom-right') {
            nextW = Math.max(5, startW + deltaXPercent);
            nextH = Math.max(3, startH + deltaYPercent);
          }

          setAnnotations(prev => prev.map(anno => {
            if (anno.id === selectedIdRef.current) {
              return {
                ...anno,
                x: nextX,
                y: nextY,
                width: nextW,
                height: nextH
              };
            }
            return anno;
          }));
          return;
        }

        let nextRx = resize.startRx;
        let nextRy = resize.startRy;
        const handle = resize.handle;

        // Resize relative to the center
        if (handle.includes('right')) {
          nextRx = Math.max(1, resize.startRx + (deltaXPercent / (e.shiftKey ? 1 : 1.5)));
        }
        if (handle.includes('left')) {
          nextRx = Math.max(1, resize.startRx - (deltaXPercent / (e.shiftKey ? 1 : 1.5)));
        }
        if (handle.includes('bottom')) {
          nextRy = Math.max(1, resize.startRy + (deltaYPercent / (e.shiftKey ? 1 : 1.5)));
        }
        if (handle.includes('top')) {
          nextRy = Math.max(1, resize.startRy - (deltaYPercent / (e.shiftKey ? 1 : 1.5)));
        }

        if (e.shiftKey) {
          // Lock Aspect Ratio
          const ratio = resize.startRx / resize.startRy;
          if (handle.includes('right') || handle.includes('left')) {
            nextRy = nextRx / ratio;
          } else {
            nextRx = nextRy * ratio;
          }
        }

        setAnnotations(prev => prev.map(anno => {
          if (anno.id === selectedIdRef.current) {
            return {
              ...anno,
              rx: Math.max(1.5, nextRx),
              ry: Math.max(1.5, nextRy)
            };
          }
          return anno;
        }));
      }
    };

    const handleGlobalPointerUp = () => {
      if (isCreatingRef.current) {
        setAnnotations(prev => {
          const temp = prev.find(a => a.id === 'temp-circle');
          if (!temp) return prev;
          if (temp.rx < 1 && temp.ry < 1) {
            // default size if tapped instead of dragged
            temp.rx = 6;
            temp.ry = 6;
          }
          const finalizedId = `cir-${Date.now()}`;
          setSelectedId(finalizedId);
          // Auto-sync styling defaults onto newly drawn active circle
          return prev.map(anno => anno.id === 'temp-circle' ? { 
            ...anno, 
            id: finalizedId,
            borderColor: activeBorderColorRef.current,
            borderWidth: activeBorderWidthRef.current,
            borderOpacity: activeBorderOpacityRef.current,
            fillColor: activeFillColorRef.current,
            fillOpacity: activeFillOpacityRef.current
          } : anno);
        });
        setIsCreating(false);
        setCreationStart(null);
        setCanvasMode('select'); // fall back to selector mode for immediate properties tuning
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

  // Click down within the compositions layer: draws shape if mode is "circle", otherwise handles clicks
  const handleCanvasMouseDown = (e: React.MouseEvent | React.PointerEvent) => {
    if (!canvasContainerRef.current || !currentImage) return;

    if (canvasMode === 'circle') {
      e.preventDefault();
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 100;
      const clickY = ((e.clientY - rect.top) / rect.height) * 100;

      const tempCircle = {
        id: 'temp-circle',
        type: 'circle',
        x: clickX,
        y: clickY,
        rx: 0.1,
        ry: 0.1,
        rotation: 0,
        borderColor: activeBorderColor,
        borderWidth: activeBorderWidth,
        borderOpacity: activeBorderOpacity,
        fillColor: activeFillColor,
        fillOpacity: activeFillOpacity
      };

      setAnnotations(prev => [...prev, tempCircle]);
      setIsCreating(true);
      setCreationStart({ x: clickX, y: clickY });
    } else if (canvasMode === 'text') {
      e.preventDefault();
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 100;
      const clickY = ((e.clientY - rect.top) / rect.height) * 100;

      const defaultBoxPixelWidth = 250;
      const widthPercent = Math.min(95, (defaultBoxPixelWidth / rect.width) * 100);

      // Clamp coordinates to keep text box nicely in view
      const x = Math.max(0, Math.min(clickX, 100 - widthPercent));
      const y = Math.max(0, Math.min(clickY, 95));

      const newId = `txt-${Date.now()}`;
      const newTextAnno = {
        id: newId,
        type: 'text',
        text: '', // Start with empty so they immediately start typing
        x,
        y,
        width: widthPercent,
        height: 12, // default height percent
        fontColor: activeBorderColorRef.current || '#000000',
        fillColor: 'transparent',
        fillOpacity: 0.3
      };

      setAnnotations(prev => [...prev, newTextAnno]);
      setSelectedId(newId);
      setEditingTextId(newId);
      setCanvasMode('select'); // drop immediately into select / edit mode for typing
    } else {
      // De-select if clicking directly on empty slot space
      if (e.target === e.currentTarget) {
        setSelectedId(null);
        setEditingTextId(null);
      }
    }
  };

  // Drag interaction starters
  const handleShapeMoveStart = (e: React.MouseEvent | React.PointerEvent, id: string, initialX: number, initialY: number) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    setMovementState({
      selectedId: id,
      startX: e.clientX,
      startY: e.clientY,
      startXVal: initialX,
      startYVal: initialY
    });
  };

  const handleShapeResizeStart = (e: React.MouseEvent, handle: string, anno: any) => {
    e.stopPropagation();
    e.preventDefault();
    setResizeState({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRx: anno.rx || (anno.r || 8),
      startRy: anno.ry || (anno.r || 8),
      startXVal: anno.x,
      startYVal: anno.y
    });
  };

  const handleShapeRotateStart = (e: React.MouseEvent, anno: any) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + (anno.x / 100) * rect.width;
    const centerY = rect.top + (anno.y / 100) * rect.height;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;

    setRotationState({
      selectedId: anno.id,
      centerX,
      centerY,
      startAngle,
      startRotation: anno.rotation || 0
    });
  };

  const setCurrentImage = (img: string | null) => {
    setLpnStateMap(prev => {
      const targetLpn = activeLpnRef.current;
      const existing = prev[targetLpn] || { image: null, annotations: [] };
      return {
        ...prev,
        [targetLpn]: { ...existing, image: img }
      };
    });
  };

  // Google Drive connection and folder ID resolution
  // Priority: matching LPN claim's orderDriveLink -> matching LPN claim's driveLink -> sampleClaim's orderDriveLink -> sampleClaim's driveLink
  const currentClaimForLpn = matchingClaims.find(c => c.lpn === activeLpn) || sampleClaim;
  const rawFolderLink = currentClaimForLpn?.driveLink || sampleClaim?.driveLink;

  const loadDriveFiles = React.useCallback(async () => {
    if (!rawFolderLink) {
      setDriveError("No Google Drive folder URL linked to this claim or order.");
      return;
    }

    setLoadingDriveFiles(true);
    setDriveError(null);
    try {
      let url = `/api/drive/list?driveLink=${encodeURIComponent(rawFolderLink)}`;
      if (accessToken) {
        url += `&accessToken=${encodeURIComponent(accessToken)}`;
      }
      if (googleClientId) {
        url += `&clientId=${encodeURIComponent(googleClientId)}`;
      }
      if (googleClientSecret) {
        url += `&clientSecret=${encodeURIComponent(googleClientSecret)}`;
      }
      if (googleRefreshToken) {
        url += `&refreshToken=${encodeURIComponent(googleRefreshToken)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      } else {
        const errData = await res.json();
        setDriveError(errData.error || "Failed to retrieve folder contents from Google Drive API.");
      }
    } catch (err: any) {
      setDriveError(err.message || "Network error loading files from Google Drive.");
    } finally {
      setLoadingDriveFiles(false);
    }
  }, [rawFolderLink, accessToken, googleClientId, googleClientSecret, googleRefreshToken]);

  React.useEffect(() => {
    if (isModalOpen) {
      requestAnimationFrame(() => {
        loadDriveFiles();
      });
    }
  }, [isModalOpen, loadDriveFiles]);

  const handleSelectDriveFile = (file: any) => {
    let fileProxyUrl = `/api/drive/file/${file.id}?`;
    const params: string[] = [];
    if (accessToken) params.push(`accessToken=${encodeURIComponent(accessToken)}`);
    if (googleClientId) params.push(`clientId=${encodeURIComponent(googleClientId)}`);
    if (googleClientSecret) params.push(`clientSecret=${encodeURIComponent(googleClientSecret)}`);
    if (googleRefreshToken) params.push(`refreshToken=${encodeURIComponent(googleRefreshToken)}`);
    
    fileProxyUrl += params.join("&");
    setSelectedSourceImage(file.name);
    setCurrentImage(fileProxyUrl);
    setIsModalOpen(false);
    console.log(`[Google Drive Picker] Selected: LPN ${activeLpn}, File: ${file.name}, ID: ${file.id}`);
  };

  // Toggle saving progress on the current LPN and sync matching images to Google Drive
  const handleSaveCurrentLpn = async () => {
    if (!currentImage) {
      alert("Please load an evidence image from Google Drive streams or local upload first!");
      return;
    }
    setUploadLoading(true);
    try {
      const finalBase64 = await exportAnnotatedCanvas(currentImage, annotations);
      
      // Create combined image structure: Left (L1 reference) and Right (R2 annotated composition)
      const combinedBase64 = await createCombinedImage(finalBase64);
      
      // 1. Submit local annotated asset
      const res = await fetch("/api/claims/upload-annotated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpn: activeLpn, imageData: combinedBase64 })
      });
      
      if (!res.ok) {
        throw new Error("Local save operation failed");
      }

      // 2. Sync to Google Drive if rawFolderLink is provided
      let googleDriveSyncMessage = "";
      if (rawFolderLink) {
        const finalFilename = `step9composition${activeLpn}.jpg`;
        console.log(`[Google Drive Sync Audit] Syncing combined composition image. Filename: ${finalFilename}, Folder: ${rawFolderLink}`);
        
        const uploadRes = await fetch("/api/drive/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driveLink: rawFolderLink,
            filename: finalFilename,
            imageData: combinedBase64,
            accessToken,
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            refreshToken: googleRefreshToken,
            lpn: activeLpn
          })
        });

        if (uploadRes.ok) {
          googleDriveSyncMessage = ` (Successfully synced ${finalFilename} to Google Drive folder!)`;
        } else {
          const errData = await uploadRes.json();
          if (accessToken || googleRefreshToken) {
            throw new Error(`Google Drive upload failing: ${errData.error || "Access denied"}`);
          } else {
            console.warn(`[Google Drive Sync Fail] No active authentication: ${errData.error}`);
          }
        }
      }

      setLpnSaved(prev => ({ ...prev, [activeLpn]: true }));
      alert(`✅ Composition successfully saved locally${googleDriveSyncMessage}!`);
    } catch (e: any) {
      alert("Error committing composition: " + e.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const unsavedOtherLpns = finalLpns.filter(l => l !== activeLpn).filter(l => !lpnSaved[l]);
  const isFinalLpnLoop = unsavedOtherLpns.length === 0;
  
  // Can submit final only of all OTHER LPNs are saved and current has an image
  const canSubmitFinalFull = finalLpns.every(l => lpnSaved[l]) || (isFinalLpnLoop && currentImage !== null);

  const handleNextOrFinish = async () => {
    await handleSaveCurrentLpn();

    if (isFinalLpnLoop) {
      // Complete transaction: Bulk advance order to Ready for claim
      onClose('complete');
    } else {
      // Cycle to the next unsaved LPN code
      const nextUnsaved = unsavedOtherLpns[0];
      if (nextUnsaved) {
        setActiveLpn(nextUnsaved);
      }
    }
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
        {/* Sidebar Left: 20% Width */}
        <div className="col-span-1 border-r border-slate-200 pr-4 flex flex-col gap-3">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">LPN Tracking List</div>
          <div className="flex flex-col gap-2">
            {finalLpns.map((lpnCode) => {
              const isSaved = lpnSaved[lpnCode];
              const isActive = activeLpn === lpnCode;
              return (
                <button
                  key={lpnCode}
                  type="button"
                  onClick={() => setActiveLpn(lpnCode)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border font-mono transition-all flex flex-col gap-1 items-start relative overflow-hidden cursor-pointer",
                    isActive 
                      ? "bg-white border-indigo-500 text-indigo-900 shadow-md shadow-indigo-100" 
                      : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
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

        {/* Workspace Right: 80% Width */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* Top Layer: Adobe-style Toolbar / Properties Inspector */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
            {/* Quick Stats Line */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
              <span className="text-[10px] font-black uppercase text-indigo-600 font-mono tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                Composition Studio Desk
              </span>
              <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">
                SKU: {currentClaimForLpn.sku || sampleClaim.sku} | FNSKU: {currentClaimForLpn.fnsku || sampleClaim.fnsku}
              </div>
            </div>

            {/* Controls Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Col 1: Mode Selectors */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400 font-mono">1. Cursor Tool Mode</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setCanvasMode('select'); }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border cursor-pointer",
                      canvasMode === 'select'
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                    title="Select & Refine Shape (Delete / Clear / Move / Style)"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                    Select ({annotations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setCanvasMode('circle'); 
                      setSelectedId(null); 
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border cursor-pointer",
                      canvasMode === 'circle'
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                    title="Draw circles and ellipses directly onto the composition canvas"
                  >
                    <Circle className="w-3.5 h-3.5 text-red-500 fill-current" />
                    Circle
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setCanvasMode('text'); 
                      setSelectedId(null); 
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border cursor-pointer",
                      canvasMode === 'text'
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                    title="Click anywhere on the image to place a multi-line auto-wrapping text box"
                  >
                    <Type className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                    Text
                  </button>
                </div>
              </div>

              {/* Col 2 & 3: Properties Panel for Border and Fills */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4 border-l border-r border-slate-100 px-4">
                {/* Border / Font Settings */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 font-mono">
                      {selectedAnno?.type === 'text' ? '2. Font Color' : '2. Border Color'}
                    </span>
                    <span className="text-[9px] font-mono text-indigo-600 font-extrabold">
                      {selectedAnno?.type === 'circle' 
                        ? `${selectedAnno?.borderWidth || 4}px` 
                        : selectedAnno?.type === 'text'
                        ? '13px font'
                        : `${activeBorderWidth}px`}
                    </span>
                  </div>
                  {/* Preset Buttons for borders/fonts */}
                  <div className="flex items-center gap-1 mb-1">
                    {['#ef4444', '#f59e0b', '#10b981', '#000000', '#ffffff'].map(color => {
                      const curColor = selectedAnno
                        ? (selectedAnno.borderColor || selectedAnno.fontColor)
                        : activeBorderColor;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            if (selectedAnno) {
                              setAnnotations(prev => prev.map(a => a.id === selectedId ? { 
                                ...a, 
                                borderColor: color,
                                fontColor: color 
                              } : a));
                            } else {
                              setActiveBorderColor(color);
                            }
                          }}
                          style={{ backgroundColor: color }}
                          className={cn(
                            "w-4 h-4 rounded-full border border-slate-300 transition-all hover:scale-125 focus:outline-none cursor-pointer",
                            curColor === color ? "ring-2 ring-indigo-500 ring-offset-1 scale-110" : ""
                          )}
                        />
                      );
                    })}
                  </div>
                  {/* Thickness Slider (Only for circular annotations) */}
                  {(!selectedAnno || selectedAnno.type === 'circle') && (
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={selectedAnno?.borderWidth || activeBorderWidth}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (selectedAnno) {
                          setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, borderWidth: val } : a));
                        } else {
                          setActiveBorderWidth(val);
                        }
                      }}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  )}
                </div>

                {/* Fill / Background Settings */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 font-mono">
                      {selectedAnno?.type === 'text' ? '3. Font BG Opacity' : '3. Fill Tint / Opacity'}
                    </span>
                    <span className="text-[9px] font-mono text-indigo-600 font-extrabold">
                      {Math.round((selectedAnno
                        ? selectedAnno.fillOpacity ?? 0.3
                        : activeFillOpacity) * 100)}%
                    </span>
                  </div>
                  {/* Presets and Off switch */}
                  <div className="flex items-center gap-1 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedAnno) {
                          setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, fillColor: 'transparent' } : a));
                        } else {
                          setActiveFillColor('transparent');
                        }
                      }}
                      className={cn(
                        "px-1 py-0.5 rounded border border-slate-200 text-[8px] font-bold uppercase cursor-pointer",
                        (selectedAnno
                          ? selectedAnno.fillColor === 'transparent'
                          : activeFillColor === 'transparent') ? "bg-slate-900 border-slate-900 text-white" : "bg-white text-slate-500"
                      )}
                    >
                      None
                    </button>
                    {['#ef4444', '#f59e0b', '#10b981', '#000000'].map(color => {
                      const curFillColor = selectedAnno
                        ? selectedAnno.fillColor
                        : activeFillColor;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            if (selectedAnno) {
                              setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, fillColor: color } : a));
                            } else {
                              setActiveFillColor(color);
                            }
                          }}
                          style={{ backgroundColor: color }}
                          className={cn(
                            "w-4 h-4 rounded-full border border-slate-300 transition-all hover:scale-125 focus:outline-none cursor-pointer",
                            curFillColor === color ? "ring-2 ring-indigo-500 ring-offset-1 scale-110" : ""
                          )}
                        />
                      );
                    })}
                  </div>
                  {/* Fill Opacity slider */}
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={
                      Math.round((selectedAnno
                        ? selectedAnno.fillOpacity ?? 0.3
                        : activeFillOpacity) * 100)
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) / 100;
                      if (selectedAnno) {
                        setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, fillOpacity: val } : a));
                      } else {
                        setActiveFillOpacity(val);
                      }
                    }}
                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              {/* Col 4: Text overlay adder box */}
              <div className="flex flex-col gap-1.5 pl-2">
                <span className="text-[9px] font-black uppercase text-slate-400 font-mono">4. Text Overlay Box</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={adderText}
                    onChange={(e) => setAdderText(e.target.value)}
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
                        id,
                        type: "text",
                        text: adderText,
                        x: 40 + Math.random() * 10,
                        y: 40 + Math.random() * 10
                      }]);
                      setSelectedId(id);
                    }}
                    disabled={!currentImage}
                    className="bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white hover:bg-slate-800 p-2 rounded-lg transition-all cursor-pointer"
                    title="Insert dynamic text string onto preview"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Center Stage: Dual-Canvas Workspace */}
          <div className="grid grid-cols-2 gap-6 items-stretch">
            {/* Left Slot: Original Product Card styling */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-800 relative overflow-hidden shadow-sm aspect-[9/16] max-h-[600px] w-full max-w-[337px] mx-auto">
              <div className="absolute top-4 left-4 font-mono text-[9px] font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                L1: REFERENCE TEMPLATE
              </div>
              <div className="flex flex-col items-center gap-3 text-center my-auto">
                <ImageIcon className="w-12 h-12 text-amber-600" />
                <span className="text-xs font-black font-mono tracking-widest text-[#FF6700] uppercase leading-none">PRODUCT ORIGINAL MASTER</span>
                <div className="flex flex-col gap-1 mt-1 bg-white border border-amber-100 p-3 rounded-xl font-mono shadow-sm pb-4">
                  <span className="text-[11px] font-black uppercase text-slate-800">SKU: {currentClaimForLpn.sku || sampleClaim.sku}</span>
                  <span className="text-[9px] text-slate-500 font-bold">FNSKU: {currentClaimForLpn.fnsku || sampleClaim.fnsku}</span>
                  <p className="text-[9px] text-slate-600 mt-1 max-w-[200px] leading-tight font-bold">
                    This represents the original undamaged reference blueprint for returned inventory classification.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Slot: Annotation workspace Canvas */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl flex flex-col relative overflow-hidden aspect-[9/16] max-h-[600px] w-full max-w-[337px] mx-auto shadow-md">
              <div className="absolute top-4 left-4 bg-white/90 border border-slate-200 text-[9px] font-black px-2 py-0.5 rounded text-indigo-600 uppercase tracking-widest font-mono z-40 shadow-sm">
                R2: COMPOSITIONS LAYER
              </div>
              
              {currentImage ? (
                <div 
                  ref={canvasContainerRef}
                  onPointerDown={handleCanvasMouseDown}
                  className={cn(
                    "w-full h-full relative select-none bg-white overflow-hidden",
                    canvasMode === 'circle' ? "cursor-crosshair" : "cursor-default"
                  )}
                >
                  <img 
                    src={currentImage} 
                    alt="Damaged Product" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain select-none pointer-events-none" 
                  />
                  
                  {/* Absolute positioning vector shape overlay */}
                  <div className="absolute inset-0 w-full h-full z-10">
                    {annotations.map(anno => {
                      if (anno.type === 'circle') {
                        const isSelected = selectedId === anno.id;
                        
                        // Fall back to default radii if it was simple r coordinates
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
                            style={{
                              left: `${anno.x}%`,
                              top: `${anno.y}%`,
                              width: `${rx * 2}%`,
                              height: `${ry * 2}%`,
                              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                              position: "absolute"
                            }}
                            className={cn(
                              "absolute group/circle z-20 select-none",
                              isSelected ? "z-30 cursor-move" : "cursor-pointer"
                            )}
                            onPointerDown={(e) => {
                              if (canvasMode === 'select') {
                                handleShapeMoveStart(e, anno.id, anno.x, anno.y);
                              }
                            }}
                          >
                            {/* Visual circle ellipse wrapper */}
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                border: `${bWidth}px solid ${bColor}`,
                                opacity: bOpacity,
                                backgroundColor: 'transparent'
                              }}
                              className="relative w-full h-full shadow-lg"
                            >
                              {/* Internal filled accent tinted layer for translucency */}
                              {fColor !== 'transparent' && (
                                <div 
                                  style={{
                                    backgroundColor: fColor,
                                    opacity: fOpacity,
                                  }}
                                  className="absolute inset-0 rounded-full"
                                />
                              )}
                            </div>

                            {/* Selection border indicator & rotation knob */}
                            {isSelected && (
                              <div className="absolute -inset-1 border-2 border-dashed border-indigo-500 rounded-lg pointer-events-none" />
                            )}

                            {isSelected && (
                              <>
                                {/* Rotation handle knob */}
                                <div 
                                  style={{
                                    top: '-22px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                  }}
                                  onPointerDown={(e) => handleShapeRotateStart(e, anno)}
                                  className="absolute w-4 h-4 bg-indigo-600 rounded-full border border-white cursor-alias flex items-center justify-center shadow-lg active:scale-125 transition-transform"
                                  title="Drag / Move cursor to rotate shape"
                                >
                                  <RotateCw className="w-2.5 h-2.5 text-white" />
                                </div>
                                
                                {/* Stem connector */}
                                <div 
                                  style={{
                                    top: '-11px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '1px',
                                    height: '11px'
                                  }}
                                  className="absolute bg-indigo-500 pointer-events-none" 
                                />

                                {/* Side width/height resize grips */}
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'top', anno)}
                                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ns-resize"
                                />
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'bottom', anno)}
                                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ns-resize"
                                />
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'left', anno)}
                                  className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ew-resize"
                                />
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'right', anno)}
                                  className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-600 rounded shadow-sm hover:scale-125 cursor-ew-resize"
                                />

                                {/* Proportional corner scaling handles */}
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'top-left', anno)}
                                  className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nwse-resize"
                                  title="Scale Proportional (Hold Shift)"
                                />
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'top-right', anno)}
                                  className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nesw-resize"
                                  title="Scale Proportional (Hold Shift)"
                                />
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'bottom-left', anno)}
                                  className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nesw-resize"
                                  title="Scale Proportional (Hold Shift)"
                                />
                                <div
                                  onPointerDown={(e) => handleShapeResizeStart(e, 'bottom-right', anno)}
                                  className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow-sm hover:scale-125 cursor-nwse-resize"
                                  title="Scale Proportional (Hold Shift)"
                                />

                                {/* Floating control strip beneath */}
                                <div className="absolute top-[108%] left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg shadow-xl z-50">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newId = `cir-${Date.now()}`;
                                      setAnnotations(prev => [...prev, {
                                        ...anno,
                                        id: newId,
                                        x: Math.min(95, anno.x + 4),
                                        y: Math.min(95, anno.y + 4)
                                      }]);
                                      setSelectedId(newId);
                                    }}
                                    className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="Duplicate Shape (Ctrl+C, Ctrl+V)"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <div className="w-[1px] h-3 bg-slate-700" />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAnnotations(prev => prev.filter(c => c.id !== anno.id));
                                      setSelectedId(null);
                                    }}
                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                    title="Delete Circle Shape"
                                  >
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
                              left: `${anno.x}%`,
                              top: `${anno.y}%`,
                              width: `${anno.width || 74}%`,
                              minHeight: anno.height ? `${anno.height}%` : 'auto',
                              position: "absolute",
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
                              "group/text flex flex-col items-stretch text-black p-1 select-none z-30 transition-shadow",
                              isSelected 
                                ? "ring-2 ring-indigo-500/10 shadow-lg cursor-move" 
                                : "hover:border-black/10 hover:bg-slate-50/10 rounded cursor-pointer"
                            )}
                            onPointerDown={(e) => {
                              if (!isEditing) {
                                handleShapeMoveStart(e, anno.id, anno.x, anno.y);
                              }
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingTextId(anno.id);
                            }}
                          >
                            {isEditing ? (
                              <textarea
                                value={anno.text || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAnnotations(prev => prev.map(a => a.id === anno.id ? { ...a, text: val } : a));
                                }}
                                onBlur={() => setEditingTextId(null)}
                                maxLength={100}
                                placeholder="Type damage text..."
                                ref={(el) => {
                                  if (el) {
                                    el.focus();
                                    // Auto-adjust height to fit text perfectly
                                    el.style.height = 'auto';
                                    el.style.height = el.scrollHeight + 'px';
                                  }
                                }}
                                onInput={(e) => {
                                  const target = e.currentTarget;
                                  target.style.height = 'auto';
                                  target.style.height = target.scrollHeight + 'px';
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="w-full h-full min-h-[40px] bg-transparent border-none outline-none resize-none overflow-hidden text-[13px] font-bold p-0 text-inherit font-sans leading-relaxed"
                                style={{
                                  color: anno.fontColor || anno.borderColor || '#ef4444',
                                }}
                              />
                            ) : (
                              <div 
                                className="w-full text-left break-words whitespace-pre-wrap text-[13px] font-bold leading-relaxed font-sans min-h-[1.5rem]"
                                style={{
                                  color: anno.fontColor || anno.borderColor || '#ef4444',
                                }}
                              >
                                {anno.text || <span className="opacity-40 italic text-[11px] font-normal font-sans">(Double-click to type text)</span>}
                              </div>
                            )}

                            {/* Floating small delete box if selected */}
                            {isSelected && (
                              <div className="absolute -top-7 right-0 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded shadow-xl flex items-center gap-1 z-50 pointer-events-auto">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAnnotations(prev => prev.filter(c => c.id !== anno.id));
                                    setSelectedId(null);
                                    setEditingTextId(null);
                                  }}
                                  className="p-1 text-red-400 hover:text-red-300 rounded transition-colors text-[10px] uppercase font-bold flex items-center gap-1 cursor-pointer"
                                  title="Delete Text Box"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            )}

                            {/* Resize Handles (Only show when selected and NOT actively editing) */}
                            {isSelected && !isEditing && (
                              <>
                                {/* Mid-Right vertical handle */}
                                <div
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setResizeState({
                                      handle: 'right',
                                      startX: e.clientX,
                                      startY: e.clientY,
                                      startRx: 0,
                                      startRy: 0,
                                      startXVal: anno.x,
                                      startYVal: anno.y,
                                      startWVal: anno.width || 74,
                                      startHVal: anno.height || 12
                                    });
                                  }}
                                  className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded shadow hover:scale-125 cursor-ew-resize z-40"
                                  title="Drag to resize width"
                                />
                                {/* Mid-Left vertical handle */}
                                <div
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setResizeState({
                                      handle: 'left',
                                      startX: e.clientX,
                                      startY: e.clientY,
                                      startRx: 0,
                                      startRy: 0,
                                      startXVal: anno.x,
                                      startYVal: anno.y,
                                      startWVal: anno.width || 74,
                                      startHVal: anno.height || 12
                                    });
                                  }}
                                  className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded shadow hover:scale-125 cursor-ew-resize z-40"
                                  title="Drag to resize width"
                                />
                                {/* Bottom handle */}
                                <div
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setResizeState({
                                      handle: 'bottom',
                                      startX: e.clientX,
                                      startY: e.clientY,
                                      startRx: 0,
                                      startRy: 0,
                                      startXVal: anno.x,
                                      startYVal: anno.y,
                                      startWVal: anno.width || 74,
                                      startHVal: anno.height || 12
                                    });
                                  }}
                                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded shadow hover:scale-125 cursor-ns-resize z-40"
                                  title="Drag to resize height"
                                />
                                {/* Top handle */}
                                <div
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setResizeState({
                                      handle: 'top',
                                      startX: e.clientX,
                                      startY: e.clientY,
                                      startRx: 0,
                                      startRy: 0,
                                      startXVal: anno.x,
                                      startYVal: anno.y,
                                      startWVal: anno.width || 74,
                                      startHVal: anno.height || 12
                                    });
                                  }}
                                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded shadow hover:scale-125 cursor-ns-resize z-40"
                                  title="Drag to resize height"
                                />
                                {/* Bottom-Right handle */}
                                <div
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setResizeState({
                                      handle: 'bottom-right',
                                      startX: e.clientX,
                                      startY: e.clientY,
                                      startRx: 0,
                                      startRy: 0,
                                      startXVal: anno.x,
                                      startYVal: anno.y,
                                      startWVal: anno.width || 74,
                                      startHVal: anno.height || 12
                                    });
                                  }}
                                  className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-indigo-600 rounded shadow hover:scale-125 cursor-nwse-resize z-40"
                                  title="Resize Width and Height"
                                />
                              </>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              ) : (
                <div className="my-auto flex flex-col items-center justify-center p-8 text-slate-500 text-center select-none gap-4">
                  <ImageIcon className="w-16 h-16 text-slate-400 animate-pulse" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-black tracking-widest text-[#FF6700] uppercase font-mono">No Image Stream Active</span>
                    <p className="text-[10px] text-slate-500 max-w-sm font-bold">
                      Launch Google Drive streams to load high-resolution evidence, or fallback on local upload.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-100 transition-all hover:scale-105 cursor-pointer"
                  >
                    Launch Image Streams / Upload
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Toolbar: Visual actions & Proceed belt */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const id = `cir-${Date.now()}`;
                  setAnnotations(prev => [...prev, {
                    id,
                    type: "circle",
                    x: 45 + Math.random() * 10,
                    y: 45 + Math.random() * 10,
                    rx: 8,
                    ry: 8,
                    rotation: 0,
                    borderColor: activeBorderColor,
                    borderWidth: activeBorderWidth,
                    borderOpacity: activeBorderOpacity,
                    fillColor: activeFillColor,
                    fillOpacity: activeFillOpacity
                  }]);
                  setSelectedId(id);
                }}
                disabled={!currentImage}
                className="bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 font-black uppercase text-[10px] px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:scale-105"
              >
                <Circle className="w-4 h-4 text-red-500" />
                Add Circle Highlight
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setAnnotations([]);
                  setSelectedId(null);
                }}
                disabled={!currentImage || annotations.length === 0}
                className="bg-white hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 hover:border-red-100 text-slate-500 font-extrabold uppercase text-[10px] px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Clear Annotations
              </button>
              
              {currentImage && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="text-indigo-600 hover:text-indigo-700 font-black uppercase text-[10px] ml-1 flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Swap Stream Image
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleNextOrFinish}
                disabled={uploadLoading || (isFinalLpnLoop && !canSubmitFinalFull)}
                className={cn(
                  "font-black uppercase text-xs px-8 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer border",
                  uploadLoading 
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : isFinalLpnLoop 
                      ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white shadow-indigo-100"
                )}
              >
                {uploadLoading ? (
                  <span>COMMITTING COMPOSITIONS...</span>
                ) : isFinalLpnLoop ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Done and Ready for File</span>
                  </>
                ) : (
                  <>
                    <span>Done</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL POPUP: GOOGLE DRIVE IMAGE STREAM PROVIDER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-black font-mono tracking-wider text-slate-900 uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  GOOGLE DRIVE CLOUD IMAGE STREAM PIPELINE
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Active LPN Instance: {activeLpn}</span>
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
              {/* Folder URL Info header */}
              <div className="bg-indigo-50/55 border border-indigo-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-indigo-600 font-mono tracking-widest">DRIVE TARGET DIRECTORY LINK</span>
                  <a href={rawFolderLink} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-indigo-800 break-all select-all flex items-center gap-1.5 hover:underline decoration-indigo-400">
                    {rawFolderLink || "No Folder Linked (Configure driveLink)"}
                  </a>
                </div>
                {accessToken && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccessToken("");
                      sessionStorage.removeItem("GOOGLE_DRIVE_ACCESS_TOKEN");
                      setDriveFiles([]);
                    }}
                    className="self-start md:self-auto text-[9px] font-black uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Disconnect Drive
                  </button>
                )}
              </div>

              {/* MAIN CONTENT AREA */}
              {loadingDriveFiles && driveFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Retrieving evidence files step2 to step6...</span>
                </div>
              ) : driveFiles.length > 0 ? (
                /* LIVE STREAMS LOADED */
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Stream options from LPN's Drive Folder:</span>
                    <button
                      type="button"
                      onClick={() => loadDriveFiles()}
                      className="text-[9px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1 cursor-pointer"
                    >
                      🔄 Force Refresh
                    </button>
                  </div>

                  {/* Display files (Thumbnails) */}
                  <div className="grid grid-cols-5 gap-4">
                    {driveFiles.map((file, idx) => {
                      let fileProxyUrl = `/api/drive/file/${file.id}?`;
                      const params: string[] = [];
                      if (accessToken) params.push(`accessToken=${encodeURIComponent(accessToken)}`);
                      if (googleClientId) params.push(`clientId=${encodeURIComponent(googleClientId)}`);
                      if (googleClientSecret) params.push(`clientSecret=${encodeURIComponent(googleClientSecret)}`);
                      if (googleRefreshToken) params.push(`refreshToken=${encodeURIComponent(googleRefreshToken)}`);
                      fileProxyUrl += params.join("&");

                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => handleSelectDriveFile(file)}
                          className="group text-left border border-slate-200 bg-slate-50 rounded-2xl overflow-hidden hover:border-indigo-500 hover:shadow-md hover:bg-white transition-all flex flex-col items-stretch cursor-pointer"
                        >
                          <div className="aspect-[9/16] max-h-[160px] bg-slate-100 overflow-hidden relative">
                            <img 
                              src={file.thumbnailLink || fileProxyUrl} 
                              alt={file.name} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            />
                            <div className="absolute top-2 left-2 bg-slate-900/80 text-[8px] font-black font-mono text-white px-1.5 py-0.5 rounded uppercase font-mono">
                              Step Image
                            </div>
                          </div>
                          <div className="p-3">
                            <span className="text-[9px] font-black uppercase text-indigo-500 block font-mono">Stream Option #{idx + 1}</span>
                            <p className="text-[10px] font-sans text-slate-800 font-extrabold mt-1 line-clamp-1">{file.name}</p>
                            <span className="text-[8px] font-semibold text-slate-400 block mt-0.5 uppercase font-mono">
                              {(file.size ? `${(parseInt(file.size)/1024).toFixed(0)} KB` : "Drive File")}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* AUTH CONFIGURATION CONTROL (SHAKER CARD) */
                <div className="border border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white p-6 rounded-2xl flex flex-col items-center text-center gap-4 shadow-sm">
                  {driveError && (
                    <div className="w-full text-left border border-red-100 bg-red-50/70 p-4 rounded-xl flex flex-col gap-2 text-xs mb-2">
                      <span className="font-extrabold uppercase text-red-700 font-mono tracking-wider">Drive Connection Error Info</span>
                      <p className="text-red-600 font-medium leading-relaxed font-mono text-[11px] bg-red-100/50 p-2 rounded border border-red-200/50 break-words max-h-36 overflow-y-auto">{driveError}</p>
                    </div>
                  )}

                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-1">
                    <ImageIcon className="w-6 h-6 text-indigo-600 animate-pulse" />
                  </div>
                  <div className="max-w-md flex flex-col gap-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 font-mono">Authenticate Google Workspace Drive Link</h3>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                      This folder contains specific quality inspection evidence (step2.jpg - step6.jpg) for return verification. Choose your preferred connection solution:
                    </p>
                  </div>

                  {/* Standard OAuth popup helper */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const clientId = "415052824637-pb4u97184vghsc7gqj8sc9k0bca7bdf6.apps.googleusercontent.com";
                        const scopes = "https://www.googleapis.com/auth/drive";
                        const redirectUrl = window.location.origin + "/triage";
                        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=token&scope=${encodeURIComponent(scopes)}&prompt=consent`;
                        
                        const width = 600;
                        const height = 650;
                        const left = window.screen.width / 2 - width / 2;
                        const top = window.screen.height / 2 - height / 2;
                        const popup = window.open(oauthUrl, "GoogleDriveAuth", `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`);
                        
                        const timer = setInterval(() => {
                          try {
                            if (!popup || popup.closed) {
                              clearInterval(timer);
                              return;
                            }
                            if (popup.location.href.includes("access_token=")) {
                              const hash = popup.location.hash;
                              const params = new URLSearchParams(hash.substring(1));
                              const token = params.get("access_token");
                              if (token) {
                                setAccessToken(token);
                                sessionStorage.setItem("GOOGLE_DRIVE_ACCESS_TOKEN", token);
                                clearInterval(timer);
                                popup.close();
                              }
                            }
                          } catch (e) {}
                        }, 500);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-5 py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider transition-all shadow-md cursor-pointer"
                    >
                      💡 Option 1: Live Pop-up authorization (Standard, lasts 60min)
                    </button>
                  </div>

                  <div className="w-full max-w-md flex items-center justify-between my-2 text-slate-300">
                    <div className="h-[1px] bg-slate-200 flex-1" />
                    <span className="text-[9px] font-black uppercase font-mono px-3 text-slate-400">OR PROVIDE ACCESS CREDENTIALS</span>
                    <div className="h-[1px] bg-slate-200 flex-1" />
                  </div>

                  {/* Manual Paste Access Token Form (Option 2) */}
                  <div className="w-full max-w-md flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Option 2: Paste short-lived Google Access Token..."
                        id="manual_token_input"
                        className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl text-slate-900 flex-1 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("manual_token_input") as HTMLInputElement;
                          const token = input?.value?.trim();
                          if (token) {
                            setAccessToken(token);
                            sessionStorage.setItem("GOOGLE_DRIVE_ACCESS_TOKEN", token);
                          } else {
                            alert("Please enter a valid Google OAuth access token first!");
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-black uppercase text-[10px] px-4 py-2 rounded-xl"
                      >
                        Activate
                      </button>
                    </div>
                  </div>

                  {/* Indefinite Refresh Token Accordion Setup Form (Option 3) */}
                  <div className="w-full max-w-md border border-indigo-100 rounded-xl bg-white text-left overflow-hidden mt-2">
                    <button
                      type="button"
                      onClick={() => setShowRefreshForm(!showRefreshForm)}
                      className="w-full px-4 py-3 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-900 font-extrabold text-[10px] uppercase font-mono tracking-wider flex items-center justify-between border-b border-indigo-100/55 transition-all text-left"
                    >
                      <span>🔄 Option 3: Permanent Auto-Refresh Credentials</span>
                      <span>{showRefreshForm ? "▼" : "▶"}</span>
                    </button>
                    
                    {showRefreshForm && (
                      <div className="p-4 flex flex-col gap-3 animate-fade-in animate-duration-150">
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Configure permanent client credentials to authorize backend <strong>Access Token auto-renewal</strong> indefinitely. Your credentials will remain securely in your local browser workspace.
                        </p>
                        
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-600 font-mono">Google Client ID</label>
                          <input
                            type="text"
                            value={googleClientId}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              setGoogleClientIdState(val);
                              localStorage.setItem("GOOGLE_DRIVE_CLIENT_ID", val);
                            }}
                            placeholder="415052824637-...apps.googleusercontent.com"
                            className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500 w-full"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-600 font-mono">Google Client Secret</label>
                          <input
                            type="password"
                            value={googleClientSecret}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              setGoogleClientSecretState(val);
                              localStorage.setItem("GOOGLE_DRIVE_CLIENT_SECRET", val);
                            }}
                            placeholder="GOCSPX-..."
                            className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500 w-full"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-600 font-mono">Google Refresh Token</label>
                          <input
                            type="password"
                            value={googleRefreshToken}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              setGoogleRefreshTokenState(val);
                              localStorage.setItem("GOOGLE_DRIVE_REFRESH_TOKEN", val);
                            }}
                            placeholder="1//0..."
                            className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500 w-full"
                          />
                        </div>

                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (googleClientId && googleClientSecret && googleRefreshToken) {
                                loadDriveFiles();
                              } else {
                                alert("Please fill out all Google credentials (Client ID, Secret, and Refresh Token) before testing connection!");
                              }
                            }}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-extrabold uppercase text-[9px] py-1.5 rounded-lg transition-all font-mono cursor-pointer"
                          >
                            ⚡ Test & Save Connection
                          </button>
                          {(googleClientId || googleClientSecret || googleRefreshToken) && (
                            <button
                              type="button"
                              onClick={() => {
                                localStorage.removeItem("GOOGLE_DRIVE_CLIENT_ID");
                                localStorage.removeItem("GOOGLE_DRIVE_CLIENT_SECRET");
                                localStorage.removeItem("GOOGLE_DRIVE_REFRESH_TOKEN");
                                setGoogleClientIdState("");
                                setGoogleClientSecretState("");
                                setGoogleRefreshTokenState("");
                                setDriveFiles([]);
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-extrabold uppercase text-[9px] px-3 py-1.5 rounded-lg transition-all"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Alternative local file upload container */}
              <div className="border border-dashed border-slate-200 bg-slate-50 p-5 rounded-2xl flex flex-col items-center text-center gap-2">
                <span className="text-[9px] font-black uppercase font-mono text-slate-400">ALTERNATIVE MANUAL COMPORT CONTAINER</span>
                <p className="text-[9px] text-slate-500 max-w-lg leading-tight font-bold">
                  Inspectors can bypass cloud streaming sync entirely at any time and load local physical photos.
                </p>
                <div className="h-[1px] w-full max-w-sm bg-slate-200/50 my-1" />
                <label className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-xl px-5 py-2 text-[10px] font-black tracking-wider uppercase transition-all shadow-sm flex items-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-white" />
                  UPLOAD LOCAL PHYSICAL IMAGE
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === "string") {
                            setSelectedSourceImage(file.name);
                            setCurrentImage(reader.result);
                            setIsModalOpen(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
