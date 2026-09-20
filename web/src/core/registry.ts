import type { GameKind, GameModule } from './types';
import { gems } from './games/gems';
import { bombs } from './games/bombs';
import { werewolf } from './games/werewolf';
import { avalon } from './games/avalon';
export const modules:Record<GameKind,GameModule>={gems,bombs,werewolf,avalon};
