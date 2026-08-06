import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
export const adminPin = env.VITE_ADMIN_PIN
