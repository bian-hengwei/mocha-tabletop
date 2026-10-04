import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {modules} from '../../src/core/registry';
import type {Command,Player} from '../../src/core/types';
import type {DrawGuessState} from '../../src/core/games/drawguess';
import {DrawGuessTable} from '../../src/ui/DrawGuessTable';
import '../../src/ui/style.css';

const players:Player[]=[
 {id:'rejection-drawer',name:'Drawer',avatar:'🦊'},
 {id:'rejection-guesser',name:'Guesser',avatar:'🐼'},
 {id:'rejection-third',name:'Third',avatar:'🐱'}
];
function start():DrawGuessState{const game=modules.drawguess.create(players,17,{language:'en'}),choice=modules.drawguess.view(game,players[0].id).actions.find(action=>action.id==='choose')!;return modules.drawguess.apply(game,players[0].id,{action:'choose',values:[choice.choices[0].id]});}
function filled(uniform=false):DrawGuessState{let game=start();for(let index=0;index<24;index++){const player=uniform?players[1]:players[index%2+1],text=uniform?'repeat':index%3===0?'repeat':`crowd ${index}`;game=modules.drawguess.apply(game,player.id,{action:'guess',values:[],text});}return game;}
function Fixture(){
 const [game,setGame]=useState<DrawGuessState>(start),[viewer,setViewer]=useState(players[1].id),[mode,setMode]=useState<'reject'|'accept'>('reject'),[pending,setPending]=useState(false),[feedback,setFeedback]=useState('idle'),[acknowledgements,setAcknowledgements]=useState(0);
 const view=modules.drawguess.view(game,viewer),answer=game.answer?.en||'';
 // This models callback timing only: no room, socket, retry, or transport is used here.
 const command=(command:Command)=>{setPending(true);setFeedback('pending');setTimeout(()=>{if(mode==='accept')setGame(previous=>modules.drawguess.apply(previous,viewer,command));setPending(false);setFeedback(mode==='accept'?'accepted':'rejected');setAcknowledgements(count=>count+1);},100);};
 const crowd=()=>setGame(previous=>{let next=previous;for(const [player,text] of [[players[2],'repeat'],[players[1],'crowd from self']] as const)next=modules.drawguess.apply(next,player.id,{action:'guess',values:[],text});return next;});
 const reset=()=>{setGame(start());setViewer(players[1].id);setPending(false);setFeedback('idle');};
 return <main className="app in-game game-drawguess"><header><button type="button" onClick={()=>setMode('reject')}>Reject next</button><button type="button" onClick={()=>setMode('accept')}>Accept next</button><button type="button" onClick={()=>setViewer(id=>id===players[1].id?players[2].id:players[1].id)}>Switch seat</button><button type="button" onClick={reset}>Reset</button><button type="button" onClick={()=>setGame(filled())}>Fill mixed window</button><button type="button" onClick={()=>setGame(filled(true))}>Fill ambiguous window</button><button type="button" onClick={crowd}>Crowd remote</button><output data-testid="feedback">{feedback}</output><output data-testid="acknowledgements">{acknowledgements}</output><output data-testid="answer">{answer}</output><output data-testid="guess-count">{view.board.guesses.length}</output></header><DrawGuessTable view={view} selfID={viewer} command={command} commandPending={pending} open={()=>{}}/></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
