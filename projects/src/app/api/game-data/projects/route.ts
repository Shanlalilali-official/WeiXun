import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/storage/database/supabase-client';

// GET /api/game-data/projects - 获取项目难度
// GET /api/game-data/projects?project_id=1 - 获取单个项目
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    const supabase = createServerClient();

    if (projectId) {
      const { data, error } = await supabase
        .from('project_difficulties')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase
      .from('project_difficulties')
      .select('*')
      .order('project_id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/game-data/projects/:id - 修改项目难度
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: '缺少 project_id' }, { status: 400 });
    }

    const body = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('project_difficulties')
      .update({
        name: body.name,
        difficulty: body.difficulty,
        description: body.description,
      })
      .eq('project_id', projectId)
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
