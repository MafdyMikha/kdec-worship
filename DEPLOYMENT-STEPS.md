# KDEC Worship Deployment Steps

This project is a Vite React website connected to Supabase and Vercel.

## What Was Fixed

- Demo login buttons were removed from the login page.
- Login now asks for a real email and password.
- A "Register with invitation" button was added.
- Invitation links open the register screen directly.
- Invited members can create their own email and password.
- Invitations and member profiles now support multiple roles.
- Admins can select and edit multiple roles for a person.
- Supabase SQL was updated for the new `roles` fields and invitation acceptance.

## 1. Upload The Fixed Files To GitHub

Use this if your Vercel project is already connected to GitHub.

1. Open GitHub.
2. Open your KDEC website repository.
3. Click `Add file`.
4. Click `Upload files`.
5. Upload the files from this fixed project folder.
6. Do not upload `node_modules`.
7. Write a commit message like `Fix invitation registration and roles`.
8. Click `Commit changes`.

GitHub says browser uploads can upload existing files, but large or many-file projects are better uploaded with GitHub Desktop or the command line. If GitHub refuses the upload, install GitHub Desktop and open this folder there.

## 2. Update Supabase Database

1. Open Supabase.
2. Open your KDEC project.
3. Go to `SQL Editor`.
4. Open `supabase-schema-FULL.sql` from this project.
5. If your database already exists, run only the safe upgrade part near the invitation policies:

```sql
alter table public.profiles add column if not exists roles text[] default array['Vocalist'];
alter table public.invitations add column if not exists roles text[] default array['Vocalist'];
update public.profiles set roles = array[coalesce(role, 'Vocalist')] where roles is null or array_length(roles, 1) is null;
update public.invitations set roles = array[coalesce(role, 'Vocalist')] where roles is null or array_length(roles, 1) is null;

create policy "Invited users can accept their invitation"
  on public.invitations for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') and status = 'pending')
  with check (lower(email) = lower(auth.jwt() ->> 'email') and status = 'accepted');
```

If Supabase says the policy already exists, that is okay. It means it was already added.

## 3. Check Supabase Keys

1. In Supabase, open `Project Settings`.
2. Open `API Keys`.
3. Copy the client-side public key. Supabase may call it `Publishable key`; older projects may call it `anon public`.
4. Also copy your project URL. It looks like `https://something.supabase.co`.

Do not use the `service_role` or secret key in Vercel for this website.

## 4. Add Vercel Environment Variables

1. Open Vercel.
2. Open your KDEC project.
3. Go to `Settings`.
4. Go to `Environment Variables`.
5. Add these two variables for Production and Preview:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_OR_ANON_KEY
```

6. Save.
7. Redeploy the latest deployment, or push a new GitHub commit.

Vercel applies environment variable changes only to new deployments, not old ones.

## 5. Test The Real Invite Flow

1. Sign in as an admin.
2. Open `People`.
3. Click `Invite Member`.
4. Enter the member email.
5. Select one or more roles, for example `Worship Leader` and `Music Director`.
6. Choose WhatsApp.
7. Send the link.
8. The member opens the link and creates their own account with name, email, and password.

After signup, if Supabase email confirmation is on, they may need to confirm their email before signing in.

