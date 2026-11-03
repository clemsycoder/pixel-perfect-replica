import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProfileDTO {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  accountType: string;
  country: string;
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" as never }),
    ]);
    if (profileRes.error) throw new Error("Failed to load profile");
    const p = profileRes.data;
    const profile: ProfileDTO = {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      phone: p.phone,
      avatarUrl: p.avatar_url,
      accountType: p.account_type,
      country: p.country,
      twoFactorEnabled: p.two_factor_enabled,
      emailNotifications: p.email_notifications,
      pushNotifications: p.push_notifications,
    };
    return { profile, isAdmin: roleRes.data === true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      fullName?: string;
      phone?: string;
      accountType?: string;
      emailNotifications?: boolean;
      pushNotifications?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.fullName !== undefined) update.full_name = data.fullName.trim() || null;
    if (data.phone !== undefined) update.phone = data.phone.trim() || null;
    if (data.accountType !== undefined) update.account_type = data.accountType;
    if (data.emailNotifications !== undefined) update.email_notifications = data.emailNotifications;
    if (data.pushNotifications !== undefined) update.push_notifications = data.push_notifications;
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) throw new Error("Could not save your profile");
    return { ok: true };
  });
