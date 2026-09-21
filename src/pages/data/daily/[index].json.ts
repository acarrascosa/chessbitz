import type { APIRoute, GetStaticPaths } from 'astro';
import { scheduledOpenings } from '../../../lib/catalog';

export const getStaticPaths = (() =>
    scheduledOpenings.map((opening, index) => ({ params: { index: String(index) }, props: { opening } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
    new Response(JSON.stringify(props.opening), { headers: { 'Content-Type': 'application/json' } });
