import { NextRequest, NextResponse } from 'next/server';
import { createSession, type Role, type SubRole } from '@/lib/auth/identity';

export const runtime = 'nodejs';

interface LoginRequest {
  phone?: string;
  code?: string;
  username?: string;
  password?: string;
}

interface SelectRoleRequest {
  userId: string;
  role: Role;
  subRole?: SubRole;
  inviteCode?: string;
  enterpriseId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'send_code') {
      const { phone } = body as LoginRequest & { action: string };
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return NextResponse.json({ error: '手机号格式错误' }, { status: 400 });
      }
      // 真实场景：调用短信网关；这里返回成功
      return NextResponse.json({ success: true, message: '验证码已发送', cooldown: 60 });
    }

    if (action === 'login') {
      const { phone, code, username, password } = body as LoginRequest & { action: string };
      if (phone && code) {
        // 手机验证码登录：demo 默认通过（code=0000 或任意 4 位数）
        if (!/^\d{4,6}$/.test(code)) {
          return NextResponse.json({ error: '验证码错误' }, { status: 400 });
        }
        const userId = `u_${phone}`;
        return NextResponse.json({
          success: true,
          userId,
          needSelectRole: true,
        });
      }
      if (username && password) {
        if (password.length < 4) {
          return NextResponse.json({ error: '密码错误' }, { status: 400 });
        }
        const userId = `u_${username}`;
        return NextResponse.json({ success: true, userId, needSelectRole: true });
      }
      return NextResponse.json({ error: '请输入账号密码或手机号' }, { status: 400 });
    }

    if (action === 'select_role') {
      const { userId, role, subRole, inviteCode, enterpriseId } = body as SelectRoleRequest & { action: string };

      // 玩家二级细分校验（邀请码校验暂放宽，任意非空即可）
      // if (role === 'player' && subRole === 'enterprise_employee' && !inviteCode) {
      //   return NextResponse.json({ error: '企业员工需要提供邀请码' }, { status: 400 });
      // }

      const session = createSession(userId, role, subRole, enterpriseId);
      const token = Buffer.from(JSON.stringify(session)).toString('base64');

      // 根据角色返回对应的重定向路径
      let redirect = '/home';
      if (role === 'enterprise_admin') {
        redirect = '/enterprise-admin';
      } else if (role === 'trainer') {
        redirect = '/coach';
      } else if (role === 'platform_designer') {
        redirect = '/designer';
      }

      return NextResponse.json({
        success: true,
        token,
        session,
        redirect,
      });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: '请求失败' }, { status: 500 });
  }
}
