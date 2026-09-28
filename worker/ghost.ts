import type { Env } from './env';
import type { Room, BoardResult, BattlePlayer } from '../src/lib/battle';

export async function recordGhostRuns(env: Env, room: Room): Promise<void> {
    const runs = [];
    const now = Date.now();
    const board_ids = JSON.stringify(room.boards.map(b => b.id));
    const board_count = room.boards.length;
    
    for (const player of room.players) {
        if (player.left) continue;
        
        const format = room.format;
        const display_name = player.name;
        const results = JSON.stringify(player.results);
        const total_points = player.results.reduce((sum, r) => sum + r.points, 0);
        const boards_solved = player.results.filter(r => r.outcome === 'won').length;
        
        runs.push({
            format,
            board_ids,
            display_name,
            results,
            total_points,
            boards_solved,
            board_count,
            recorded_at: now
        });
    }

    if (runs.length === 0) return;

    const stmt = env.DB.prepare(
        `INSERT INTO ghost_runs (format, board_ids, display_name, results, total_points, boards_solved, board_count, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const batch = runs.map(r => stmt.bind(
        r.format,
        r.board_ids,
        r.display_name,
        r.results,
        r.total_points,
        r.boards_solved,
        r.board_count,
        r.recorded_at
    ));

    await env.DB.batch(batch);
}
