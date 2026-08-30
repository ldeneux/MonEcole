import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase "service role" — à utiliser UNIQUEMENT côté serveur
 * (Server Actions / Route Handlers), jamais dans un composant client, et
 * jamais exposé au navigateur. Il contourne le RLS : ne l'utilise que pour
 * des opérations précises et vérifiées manuellement (ici : la signature
 * d'une demande via un jeton secret, sans session utilisateur).
 *
 * Nécessite la variable d'environnement SUPABASE_SERVICE_ROLE_KEY
 * (Project Settings > API > service_role dans Supabase) — à ajouter sur
 * Vercel SANS le préfixe NEXT_PUBLIC_ pour qu'elle reste côté serveur.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
