import { NextResponse } from 'next/server';
import { createServerClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: history, error } = await supabase
      .from('coach_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ history: history || [] });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json({ history: [] });
  }
}
