import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { role, adminRole } = await req.json();

    const response = NextResponse.json({ success: true, role, adminRole });

    // Set cookie valid for 7 days
    const maxAge = 60 * 60 * 24 * 7;

    if (role === 'admin') {
      response.cookies.set({
        name: 'pilar_admin_session',
        value: 'true',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: maxAge,
      });
      if (adminRole) {
        response.cookies.set({
          name: 'pilar_admin_role',
          value: adminRole,
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
          maxAge: maxAge,
        });
      }
      // Clear employee session if any
      response.cookies.delete('pilar_employee_session');
    } else if (role === 'karyawan') {
      response.cookies.set({
        name: 'pilar_employee_session',
        value: 'true',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: maxAge,
      });
      // Clear admin session if any
      response.cookies.delete('pilar_admin_session');
      response.cookies.delete('pilar_admin_role');
    }

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to set session' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Sessions cleared' });
  response.cookies.delete('pilar_admin_session');
  response.cookies.delete('pilar_admin_role');
  response.cookies.delete('pilar_employee_session');
  return response;
}
