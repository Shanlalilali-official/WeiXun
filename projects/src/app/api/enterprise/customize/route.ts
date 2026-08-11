import { NextResponse } from 'next/server';
import { createServerClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: customizations, error } = await supabase
      .from('enterprise_customizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ customizations: customizations || [] });
  } catch (error) {
    console.error('Failed to fetch customizations:', error);
    return NextResponse.json({ customizations: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, name, description, details, created_by } = body;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('enterprise_customizations')
      .insert({
        type,
        name,
        description,
        details,
        created_by,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, customization: data });
  } catch (error) {
    console.error('Failed to create customization:', error);
    return NextResponse.json({ error: 'Failed to create customization' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('enterprise_customizations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete customization:', error);
    return NextResponse.json({ error: 'Failed to delete customization' }, { status: 500 });
  }
}
