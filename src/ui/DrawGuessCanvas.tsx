import {useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent} from 'react';
import {t} from '../i18n';

type Point = [number, number];
export type DrawGuessStroke = {points: Point[]; color: string; width?:number};
type Props = {
 strokes: DrawGuessStroke[];
 enabled: boolean;
 color: string;
 width?:number;
 onStroke: (points: Point[], color: string, width?:number) => void;
};

function sample(points: Point[], limit: number): Point[] {
 if (points.length <= limit) return points;
 return Array.from({length: limit}, (_, i) => points[Math.round(i * (points.length - 1) / (limit - 1))]);
}

export function DrawGuessCanvas({strokes, enabled, color, width=9, onStroke}: Props) {
 const canvas = useRef<HTMLCanvasElement>(null);
 const draft = useRef<Point[]>([]), pointer = useRef<number | null>(null);
 const draftWidth=useRef(width), draftColor = useRef(color), keyboardPoint = useRef<Point>([500, 500]);
 const frame = useRef<number | null>(null), previousCount = useRef(strokes.length);
 const paint = useRef(() => {});
 paint.current = () => {
  const node = canvas.current;
  if (!node) return;
  const rect = node.getBoundingClientRect(), scale = Math.max(1, devicePixelRatio || 1);
  node.width = Math.round(rect.width * scale); node.height = Math.round(rect.height * scale);
  const ctx = node.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, Math.min(8, rect.width / 70));
  for (const stroke of [...strokes, ...(draft.current.length ? [{points: draft.current, color: draftColor.current,width:draftWidth.current}] : [])]) {
   ctx.lineWidth=stroke.width?stroke.width/1000*rect.width:Math.max(3,Math.min(8,rect.width/70));
   ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color;
   if (stroke.points.every(point => point[0] === stroke.points[0][0] && point[1] === stroke.points[0][1])) {
    const [x, y] = stroke.points[0];
    ctx.beginPath(); ctx.arc(x / 1000 * rect.width, y / 1000 * rect.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
   } else {
    ctx.beginPath();
    stroke.points.forEach(([x, y], i) => {
     const px = x / 1000 * rect.width, py = y / 1000 * rect.height;
     if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.stroke();
   }
  }
 };
 const drawSoon = () => {
  if (frame.current !== null) return;
  frame.current = requestAnimationFrame(() => { frame.current = null; paint.current(); });
 };
 const cancel = () => {
  const id = pointer.current; pointer.current = null; draft.current = [];
  if (id !== null && canvas.current?.hasPointerCapture(id)) canvas.current.releasePointerCapture(id);
  drawSoon();
 };
 useLayoutEffect(() => {
  if (!enabled || strokes.length < previousCount.current) cancel();
  previousCount.current = strokes.length;
  paint.current();
 }, [enabled, strokes]);
 useEffect(() => {
  const node = canvas.current;
  if (!node) return;
  const observer = new ResizeObserver(drawSoon); observer.observe(node);
  const hide = () => { if (document.hidden) cancel(); };
  window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hide);
  return () => {
   observer.disconnect(); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hide);
   const id = pointer.current; pointer.current = null; draft.current = [];
   if (id !== null && node.hasPointerCapture(id)) node.releasePointerCapture(id);
   if (frame.current !== null) cancelAnimationFrame(frame.current);
  };
 }, []);
 const position = (event: PointerEvent<HTMLCanvasElement>): Point => {
  const rect = event.currentTarget.getBoundingClientRect();
  return [Math.max(0, Math.min(1000, Math.round((event.clientX - rect.left) / rect.width * 1000))),
   Math.max(0, Math.min(1000, Math.round((event.clientY - rect.top) / rect.height * 1000)))];
 };
 const append = (point: Point) => {
  const last = draft.current.at(-1);
  if (last && last[0] === point[0] && last[1] === point[1]) return;
  // Bound the local draft while retaining both ends of a long gesture.
  if (draft.current.length >= 512) draft.current = sample(draft.current, 256);
  draft.current.push(point);
 };
 const finish = (event: PointerEvent<HTMLCanvasElement>) => {
  if (pointer.current !== event.pointerId) return;
  if (!enabled) { cancel(); return; }
  append(position(event));
  const points = sample(draft.current, 32), strokeColor = draftColor.current,strokeWidth=draftWidth.current;
  cancel();
  if (points.length === 1) points.push(points[0]);
  if (points.length) onStroke(points, strokeColor,strokeWidth);
 };
 const keyboard = (event: KeyboardEvent<HTMLCanvasElement>) => {
  if (!enabled || pointer.current !== null) return;
  const delta: Record<string, Point> = {ArrowUp: [0, -40], ArrowDown: [0, 40], ArrowLeft: [-40, 0], ArrowRight: [40, 0]};
  if (event.key === 'Enter' || event.key === ' ') {
   event.preventDefault(); onStroke([keyboardPoint.current, keyboardPoint.current], color,width); return;
  }
  const move = delta[event.key]; if (!move) return;
  event.preventDefault();
  const previous = keyboardPoint.current;
  const next: Point = [Math.max(0, Math.min(1000, previous[0] + move[0])), Math.max(0, Math.min(1000, previous[1] + move[1]))];
  keyboardPoint.current = next; onStroke([previous, next], color,width);
 };
 return <canvas ref={canvas} className={`dg-canvas ${enabled ? 'dg-can-draw' : ''}`}
  aria-label={t(enabled ? '作画区域' : '共享画板')} aria-description={enabled ? t('方向键作画，回车落点') : undefined}
  tabIndex={enabled ? 0 : -1} onKeyDown={keyboard}
  onPointerDown={event => {
   if (!enabled || pointer.current !== null || event.button !== 0 || !event.isPrimary) return;
   event.preventDefault(); event.currentTarget.focus({preventScroll: true}); event.currentTarget.setPointerCapture(event.pointerId);
   pointer.current = event.pointerId; draftColor.current = color; draftWidth.current=width; draft.current = [position(event)]; drawSoon();
  }}
  onPointerMove={event => {
   if (!enabled || pointer.current !== event.pointerId) return;
   if (event.pointerType === 'mouse' && !(event.buttons & 1)) { cancel(); return; }
   append(position(event)); drawSoon();
  }}
  onPointerUp={finish}
  onPointerCancel={event => { if (pointer.current === event.pointerId) cancel(); }}
  onLostPointerCapture={event => { if (pointer.current === event.pointerId) cancel(); }}/>
}
