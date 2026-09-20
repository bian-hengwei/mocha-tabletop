type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
let pending:InstallPrompt|null=null;
let installed=matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
let busy=false;
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(fn=>fn());
// Capture once, before React mounts; all install buttons share the one-use event.
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event as InstallPrompt;emit();});
window.addEventListener('appinstalled',()=>{installed=true;pending=null;busy=false;emit();});
const standalone=matchMedia('(display-mode: standalone)');
standalone.addEventListener('change',()=>{installed=standalone.matches;emit();});
export const installState={subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},snapshot:()=>`${installed}:${!!pending}:${busy}`,get installed(){return installed;},get available(){return !!pending;},get busy(){return busy;},async request(){
 if(installed)return 'installed';if(busy)return 'busy';if(!pending)return 'unavailable';
 const event=pending;pending=null;busy=true;emit();
 try{await event.prompt();const choice=await event.userChoice;return choice.outcome;}finally{busy=false;emit();}
}};
