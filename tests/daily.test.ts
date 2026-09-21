import { describe, expect, it } from 'vitest';
import { getDayNumber, getRotationIndex } from '../src/lib/daily';

describe('getDayNumber', () => {
    it('is 0 on launch day, at any local time', () => {
        expect(getDayNumber(new Date(2026, 0, 25, 0, 0))).toBe(0);
        expect(getDayNumber(new Date(2026, 0, 25, 23, 59))).toBe(0);
    });

    it('advances exactly at local midnight', () => {
        expect(getDayNumber(new Date(2026, 0, 26, 0, 0))).toBe(1);
    });

    it('counts calendar days across DST changes and leap years', () => {
        expect(getDayNumber(new Date(2026, 2, 29, 12))).toBe(63); // EU DST starts Mar 29
        expect(getDayNumber(new Date(2026, 9, 25, 12))).toBe(273); // EU DST ends Oct 25
        expect(getDayNumber(new Date(2028, 2, 1))).toBe(766); // spans Feb 29, 2028
    });

    it('clamps dates before launch to day 0', () => {
        expect(getDayNumber(new Date(2025, 11, 31))).toBe(0);
    });
});

describe('getRotationIndex', () => {
    it('wraps around the catalog', () => {
        expect(getRotationIndex(0, 365)).toBe(0);
        expect(getRotationIndex(364, 365)).toBe(364);
        expect(getRotationIndex(365, 365)).toBe(0);
        expect(getRotationIndex(-1, 365)).toBe(364);
    });

    it('rejects an empty catalog', () => {
        expect(() => getRotationIndex(3, 0)).toThrow();
    });
});
