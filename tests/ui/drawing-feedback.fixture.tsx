import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DrawGuessCanvas, type DrawGuessStroke} from '../../src/ui/DrawGuessCanvas';

function Fixture() {
 const [strokes, setStrokes] = useState<DrawGuessStroke[]>([]), [enabled, setEnabled] = useState(true), [session, setSession] = useState(0);
 return <><div style={{width: 500, height: 300, background: '#f6eedc'}}><DrawGuessCanvas key={session} strokes={strokes} enabled={enabled} color="#246a8b"
  onStroke={(points, color) => setStrokes(previous => [...previous, {points, color}])}/></div>
  <button onClick={() => setEnabled(value => !value)}>Toggle permission</button>
  <button onClick={() => setSession(value => value + 1)}>New seat</button>
  <button onClick={() => { setStrokes([]); setSession(value => value + 1); }}>Clear</button>
  <output>{JSON.stringify(strokes)}</output>
  <style>{'canvas{width:100%;height:100%;display:block;touch-action:none}button{min-height:44px}output{display:block}'}</style></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
