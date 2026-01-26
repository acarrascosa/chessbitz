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
  // Use a fixed launch date in UTC
  const launchDate = new Date(Date.UTC(2024, 0, 1)); // Jan 1, 2024 UTC

  // Create a UTC date for "now" (ignoring time)
  // We grab the user's local year/month/date but pretend it's UTC
  // to ensure "days" are counted by local calendar days, not 24h chunks that might drift.
  // Actually, usually simpler: difference in timestamps / 86400000 

  // Better approach: Calculate days passed since launch using UTC timestamps of the *dates* (midnight)
  const now = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  const diffTime = now.getTime() - launchDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Handle negative difference if system time is somehow before launch
  const normalizedIndex = diffDays < 0 ? 0 : diffDays;

  const index = normalizedIndex % openings.length;

  if (openings.length === 0) {
    throw new Error("No openings found");
  }
  return openings[index] as Opening;
}
