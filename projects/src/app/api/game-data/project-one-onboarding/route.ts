import { NextResponse } from 'next/server';
import { getProjectOneOnboardingCatalog } from '@/lib/game/project-one-onboarding';

export function GET() {
  return NextResponse.json({ catalog: getProjectOneOnboardingCatalog() });
}
