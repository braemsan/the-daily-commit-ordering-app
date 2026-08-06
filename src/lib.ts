import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  console.warn('Supabase environment variables are missing. Copy .env.example to .env and add your values.')
}

export const supabase = createClient(url ?? 'https://example.supabase.co', key ?? 'missing-key')
export const adminPin = (import.meta.env.VITE_ADMIN_PIN as string | undefined) ?? '2468'
