import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard";

export const hideMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { messageId } = (data as unknown) as { messageId: string };
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("group_messages")
      .update({ hidden_by_admin: true })
      .eq("id", messageId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

export const restoreMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { messageId } = (data as unknown) as { messageId: string };
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("group_messages")
      .update({ hidden_by_admin: false })
      .eq("id", messageId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });
