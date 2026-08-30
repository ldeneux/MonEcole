import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
