import { createServerFn } from "@tanstack/react-start";

export const hideMessageFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { messageId, callerId } = (data as unknown) as { messageId: string; callerId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify caller is admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roleData } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Unauthorized: admin only");

    // UPDATE with service role — bypasses RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("group_messages")
      .update({ hidden_by_admin: true })
      .eq("id", messageId);

    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

