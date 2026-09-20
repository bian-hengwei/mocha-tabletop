/** CC0 artwork by Adrian Kennard and FluffyStuff. Provenance: public/art/classic/SOURCES.json. */
export function PokerArt({rank,suit,back=false}:{rank?:number;suit?:number;back?:boolean}){
 const r=rank||0,label=r===14?'A':r===15?'2':r===10?'T':r===11?'J':r===12?'Q':r===13?'K':String(r);
 const face=back?'1B':r>=16?(r===16?'2J':'1J'):`${label}${['S','H','C','D'][suit||0]}`;
 return <img className="classic-card-art poker-art" src={`/art/classic/poker/${face}.svg`} alt="" aria-hidden="true" draggable={false} data-rank={r} data-suit={suit} width={240} height={336}/>;
}
export function MahjongArt({value,back=false}:{value?:number;back?:boolean}){
 return <svg className="classic-card-art mahjong-art" viewBox="0 0 300 400" aria-hidden="true" focusable="false" data-tile={value}><image href="/art/classic/mahjong/front.svg" width="300" height="400"/>{back?<rect x="15" y="15" width="270" height="365" rx="34" fill="#205847"/>:<image href={`/art/classic/mahjong/${value??0}.svg`} width="300" height="400"/>}</svg>;
}
