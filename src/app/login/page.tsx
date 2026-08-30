import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function signIn(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}

async function signUp(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const full_name = formData.get("full_name") as string;
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } }
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/login?message=${encodeURIComponent("Compte créé. Vérifiez vos emails si la confirmation est activée, puis connectez-vous.")}`);
}

export default function LoginPage({
  searchParams
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ardoise-900 px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center font-display text-3xl text-craie">Classe</h1>
        <p className="mb-8 text-center text-sm text-ardoise-200">
          Cahier de bord numérique de l'enseignant
        </p>

        <div className="card">
          {searchParams.error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchParams.error}
            </p>
          )}
          {searchParams.message && (
            <p className="mb-4 rounded-lg bg-ardoise-50 px-3 py-2 text-sm text-ardoise-700">
              {searchParams.message}
            </p>
          )}

          <form action={signIn} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" name="email" required />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input className="input" type="password" name="password" required />
            </div>
            <button className="btn-primary w-full" type="submit">Se connecter</button>
          </form>

          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-ardoise-500">
              Première visite ? Créer un compte enseignant
            </summary>
            <form action={signUp} className="mt-4 space-y-4">
              <div>
                <label className="label">Nom complet</label>
                <input className="input" type="text" name="full_name" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" name="email" required />
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <input className="input" type="password" name="password" required minLength={6} />
              </div>
              <button className="btn-ghost w-full border border-ardoise-200" type="submit">
                Créer le compte
              </button>
              <p className="text-xs text-ardoise-400">
                Le premier compte créé n'est pas admin par défaut : passez son rôle à
                "admin" dans la table <code>profiles</code> sur Supabase pour obtenir
                les droits complets.
              </p>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
