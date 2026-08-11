import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/storage/database/supabase-client';

// GET /api/enterprise/players - 获取企业玩家列表
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_identities')
      .select('*')
      .eq('role', 'player')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST /api/enterprise/players - 添加玩家
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username } = body;
    if (!username) {
      return NextResponse.json({ success: false, error: '用户名不能为空' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_identities')
      .insert({
        username,
        role: 'player',
        level: 1,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PUT /api/enterprise/players - 更新玩家
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, username, level } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID 不能为空' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_identities')
      .update({ username, level })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/enterprise/players - 删除玩家
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID 不能为空' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('user_identities')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
