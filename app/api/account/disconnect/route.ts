// app/api/account/disconnect/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteSession } from '@/lib/services/accountService';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await deleteSession(user.id);
  if (error) {
    return NextResponse.json({ error: 'Gagal memutus koneksi' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
