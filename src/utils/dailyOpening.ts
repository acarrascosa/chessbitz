import openings from '../data/openings.json';

export interface Opening {
  id: number;
  eco: string;
  name: string;
  pgn: string;
  fen: string;
  content: {
    es: {
      name: string;
      description: string;
    };
    en: {
      name: string;
      description: string;
    };
  };
}

const LAUNCH_DATE = '2024-01-01';

export function getDailyOpening(date: Date = new Date()): Opening {
  const launchDate = new Date(LAUNCH_DATE);
  // Reset hours to avoid timezone issues affecting the day calculation difference
  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const d1 = normalizeDate(launchDate);
  const d2 = normalizeDate(date);

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const index = diffDays % openings.length;
  // Handle case where openings might be empty even though we know it isn't
  if (openings.length === 0) {
      throw new Error("No openings found");
  }
  return openings[index] as Opening;
}
