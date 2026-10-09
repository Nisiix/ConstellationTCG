# Configurazione Auth nel dashboard Supabase

Type: task
Status: open
Blocked by: —
Owner: proprietario del repository (nessuno strumento MCP configura l'Auth)

## Question

Far sì che i link di accesso tornino direttamente a `/auth/callback` dell'app, in locale e in
produzione.

## Checklist

1. Dashboard → Authentication → URL Configuration.
2. **Site URL**: l'origine pubblica del sito (in attesa del deploy, `http://localhost:3000`).
3. **Redirect URLs**: aggiungere `http://localhost:3000/**` e, al deploy, `https://<sito>/auth/callback`.
4. Facoltativo: Authentication → Email Templates, modello "Magic Link", verificare che il link
   usi `{{ .RedirectTo }}`; con `{{ .SiteURL }}` l'app recupera comunque il codice (catcher).
5. Provare: `/explore` → My Constellation → email → il link apre `/explore` con il pannello aperto.

## Answer

(da compilare alla chiusura)
