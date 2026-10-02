/** iPhone, iPod and iPad (which has reported itself as a Mac since iPadOS 13): no install API, only "Add to Home Screen". */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
    return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
