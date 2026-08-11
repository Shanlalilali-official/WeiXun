import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/storage/database/supabase-client';
import { authGuard } from '@/lib/auth/guard';
import { PROJECT_ONE_NPCS } from '@/lib/game/project-one';
import { getOwnedGameSession } from '@/lib/game/repository';

// GET /api/game-data/npcs?project_id=1 - 获取某项目的人物表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (projectId === '1') {
      const gameSessionId = searchParams.get('game_session_id');
      let unlockedNpcIds = PROJECT_ONE_NPCS.filter((npc) => npc.initiallyVisible).map((npc) => npc.id);
      let npcAffinity: Record<string, number> = {};
      let personalInterestUnlocked = false;

      if (gameSessionId) {
        const guard = authGuard(request);
        if (!guard.ok || !guard.session) return guard.response!;
        try {
          const gameSession = await getOwnedGameSession(gameSessionId, guard.session.userId);
          unlockedNpcIds = gameSession.state.unlockedNpcIds;
          npcAffinity = gameSession.state.npcAffinity;
          personalInterestUnlocked = gameSession.state.unlockedClues.includes('personal_interest');
        } catch {
          return NextResponse.json({ error: '对局不存在或无权访问' }, { status: 404 });
        }
      }

      const data = PROJECT_ONE_NPCS
        .filter((npc) => unlockedNpcIds.includes(npc.id))
        .map((npc) => ({
          id: npc.id,
          project_id: npc.projectId,
          category: npc.category,
          name: npc.name,
          title: npc.title,
          gender: npc.gender,
          age: npc.age,
          hometown: npc.hometown,
          personality: npc.personality,
          weakness: personalInterestUnlocked && (npcAffinity[npc.id] ?? 0) >= 50 ? npc.weakness : null,
        }));
      return NextResponse.json({ success: true, data });
    }

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
