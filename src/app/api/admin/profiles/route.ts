// api/admin/profiles/route.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    // 1. Create Supabase Auth user
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
      });

    if (authError) throw new Error(authError.message);
    if (!authUser?.user) throw new Error("Auth user not created");

    const userId = authUser.user.id;

    // 2. Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (checkError) throw new Error(checkError.message);

    let profile = existingProfile;

    // 3. Insert profile only if not exists
    if (!existingProfile) {
      const { full_name, email, role, subscription_status } = body;

      const { data: newProfile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert([
          {
            id: userId, // must match auth.users.id
            full_name,
            email,
            role: role || "student",
            subscription_status: subscription_status || "inactive",

            // optional fields (null/default handled by DB)
            institution: body.institution || null,
            subjects: body.subjects || [],
            cellno: body.cellno || null,
            logo: body.logo || null,
            trial_ends_at: body.trial_ends_at || null,
            papers_generated: 0,
          },
        ])
        .select()
        .single();

      if (profileError) throw new Error(profileError.message);
      profile = newProfile;
    }

    // 4. If package selected → insert into user_packages
    if (body.package_id) {
      const { error: pkgError } = await supabaseAdmin
        .from("user_packages")
        .insert([
          {
            user_id: userId,
            package_id: body.package_id,
            papers_remaining: null, // optional
            expires_at: null, // optional (can calculate based on package duration)
            is_trial: body.subscription_status === "trial",
            is_active: body.subscription_status === "active",
          },
        ]);

      if (pkgError) throw new Error(pkgError.message);
    }

    return Response.json(profile);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}
