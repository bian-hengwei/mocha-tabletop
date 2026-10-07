import './ui/style.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import {ReactionAdmin} from './ui/ReactionAdmin';

createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.pathname==='/admin/reactions'?<ReactionAdmin/>:<App />}</React.StrictMode>);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.warn));
}
