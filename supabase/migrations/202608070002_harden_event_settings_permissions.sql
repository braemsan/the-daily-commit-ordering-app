-- Supabase projects may grant function execution to API roles through schema defaults.
-- Keep the admin guard inside the function and also remove anonymous invocation entirely.

revoke execute on function public.update_event_settings(
  boolean, text, text, text, timestamptz, timestamptz
) from anon;

revoke execute on function public.update_event_settings(
  boolean, text, text, text, timestamptz, timestamptz
) from public;

grant execute on function public.update_event_settings(
  boolean, text, text, text, timestamptz, timestamptz
) to authenticated;
