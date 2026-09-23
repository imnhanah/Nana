# Delete Profile Edge Function

Deploy this protected function before enabling live profile deletion:

```bash
supabase functions deploy delete-profile
```

The function verifies the signed-in user from their JWT, removes Storage items
owned by that user, then uses the server-only `SUPABASE_SERVICE_ROLE_KEY` to
delete the auth user. Database rows are removed through the existing cascade
relationships. Never place the service-role key in the web app or `.env` file.
