import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
})

const result = envSchema.safeParse(import.meta.env)

export const env = result.success ? result.data : null
export const envError = result.success
  ? null
  : result.error.issues.map((issue) => issue.message).join('; ')
