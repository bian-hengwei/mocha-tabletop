import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DrawRelayCanvas} from '../../src/ui/DrawRelayCanvas';

function Fixture(){
 const [strokes,setStrokes]=useState<string[]>([]),[enabled,setEnabled]=useState(true),[seat,setSeat]=useState(0);
 return <><main onContextMenu={event=>event.preventDefault()}><DrawRelayCanvas key={seat} strokes={strokes} enabled={enabled} color={4} width={1} onStroke={stroke=>setStrokes(previous=>[...previous,stroke])}/></main>
  <button onClick={()=>setEnabled(value=>!value)}>Toggle permission</button><button onClick={()=>setSeat(value=>value+1)}>New seat</button><button onClick={()=>{setStrokes([]);setSeat(value=>value+1);}}>Clear</button><output>{JSON.stringify(strokes)}</output>
  <style>{'main{width:500px;height:375px;background:#f6eedc}svg{width:100%;height:100%;display:block;touch-action:none}button{min-height:44px}output{display:block}'}</style>
 </>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
