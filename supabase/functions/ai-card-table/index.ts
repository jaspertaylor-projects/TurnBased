// Match the existing Edge Functions' pinned remote runtime imports.
// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createCardTableHandler } from "./handler.ts";

serve(
  createCardTableHandler({
    createClient,
    env: (name) => Deno.env.get(name),
    fetch,
  }),
);
