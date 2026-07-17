import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-only list of emails allowed to bypass the drip schedule.
// Kept off the client bundle so real user emails aren't shipped to visitors.
const DRIP_BYPASS_EMAILS = new Set<string>([
  "owen.affaire@gmail.com",
  "ibrahima.rafion@yahoo.com",
  "zakoulazakou@gmail.com",
  "amazafba@gmail.com",
  "couronnedigitale@gmail.com",
  "elodie.floch.pro@gmail.com",
  "gfx.free.gelbie@gmail.com",
]);

export const getDripBypassFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = data?.user?.email?.toLowerCase() ?? "";
    return { bypass: DRIP_BYPASS_EMAILS.has(email) };
  });
