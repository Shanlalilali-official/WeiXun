import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/storage/database/supabase-client';

// GET /api/game-data/npcs?project_id=1 - 获取某项目的人物表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    const supabase = createServerClient();

    let query = supabase.from('npc_profiles').select('*').order('project_id').order('category');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/game-data/npcs - 新增人物
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('npc_profiles')
      .insert({
        project_id: body.project_id,
        category: body.category,
        name: body.name,
        title: body.title,
        gender: body.gender,
        age: body.age,
        hometown: body.hometown,
        personality: body.personality,
        weakness: body.weakness,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/game-data/npcs/:id - 修改人物
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const body = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('npc_profiles')
      .update({
        category: body.category,
        name: body.name,
        title: body.title,
        gender: body.gender,
        age: body.age,
        hometown: body.hometown,
        personality: body.personality,
        weakness: body.weakness,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/game-data/npcs/:id - 删除人物
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { error } = await supabase
      .from('npc_profiles')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
