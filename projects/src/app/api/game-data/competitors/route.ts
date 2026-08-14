import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { PROJECT_ONE_COMPETITORS } from '@/lib/game/project-one';

// GET /api/game-data/competitors?project_id=1 - 获取项目一竞品（可用游戏依赖，保留真实内容）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  if (projectId === '1') {
    return NextResponse.json({ success: true, data: PROJECT_ONE_COMPETITORS });
  }

  // 非项目一的竞品表尚未建模，先干净降级。
  return NextResponse.json({ error: '功能未实现' }, { status: 501 });
}

// POST /api/game-data/competitors - 新增竞品（设计师 CRUD，尚未建模）
export async function POST(request: NextRequest) {
  const g = authGuard(request);
  if (!g.ok) return g.response;
  return NextResponse.json({ error: '功能未实现' }, { status: 501 });
}

// PUT /api/game-data/competitors/:id - 修改竞品
export async function PUT(request: NextRequest) {
  const g = authGuard(request);
  if (!g.ok) return g.response;
  return NextResponse.json({ error: '功能未实现' }, { status: 501 });
}

// DELETE /api/game-data/competitors/:id - 删除竞品
export async function DELETE(request: NextRequest) {
  const g = authGuard(request);
  if (!g.ok) return g.response;
  return NextResponse.json({ error: '功能未实现' }, { status: 501 });
}
