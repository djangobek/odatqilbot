import { NextResponse } from 'next/server';
import { publicConfig } from '../../../lib/env';

export const dynamic = 'force-dynamic';

/** Non-secret runtime configuration (all links come from environment variables). */
export function GET() {
  return NextResponse.json(publicConfig(), { headers: { 'Cache-Control': 'no-store' } });
}
