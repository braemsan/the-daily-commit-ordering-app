import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_ADMIN_PIN: z.string().regex(/^\d{4,12}$/, 'VITE_ADMIN_PIN must contain 4 to 12 digits'),
})

const result = envSchema.safeParse(import.meta.env)

if (!result.success) {
  const details = result.error.issues.map((issue) => issue.message).join('; ')
  throw new Error(`Invalid environment configuration: ${details}. Check your .env file.`)
}

export const env = result.data
