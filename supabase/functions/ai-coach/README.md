# AI Coach Edge Function

Deploy this function after the app is published:

```sh
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set OPENAI_MODEL=gpt-5-mini
supabase functions deploy ai-coach
```

The browser never receives the OpenAI key. The function verifies the signed-in
Supabase user, reads only that user's selected account through Row Level
Security, summarizes journal data on the server, and sends that summary to the
AI service.
