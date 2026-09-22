import type { APIRoute } from 'astro';
import { manifestResponse } from '../../lib/manifest';

export const GET: APIRoute = () => manifestResponse('en');
