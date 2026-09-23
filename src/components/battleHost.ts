import { createContext, useContext } from 'react';

/**
 * Where the battle is running. On chessbitz.com (the default) players type a name
 * and share a link; inside the Discord Activity the name comes from Discord,
 * invites go through Discord's dialog and external links must open through the SDK.
 */
export interface BattleHost {
    discord?: {
        invite: () => void;
        openExternal: (url: string) => void;
    };
}

export const BattleHostContext = createContext<BattleHost>({});
export const useBattleHost = () => useContext(BattleHostContext);
