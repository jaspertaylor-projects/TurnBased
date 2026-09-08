import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createRulesWriterHandler } from "./handler.ts";

serve(
  createRulesWriterHandler({
    createClient,
    env: (name) => Deno.env.get(name),
    fetch,
  }),
);
