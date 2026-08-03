import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  server: {
    ARCJET_KEY: z.string().startsWith('ajkey_').optional(),
    CLERK_SECRET_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    // Optional until the feature that needs them ships, so a deploy never
    // fails on a variable nothing reads yet.
    CLERK_WEBHOOK_SECRET: z.string().optional(),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    /** Price the Standard plan checks out against. From the Stripe dashboard. */
    STRIPE_STANDARD_PRICE_ID: z.string().startsWith('price_').optional(),
    // Planning model. Prefixed check catches a pasted placeholder early.
    ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
    // Stock photography. Unsplash terms require the download trigger to fire.
    UNSPLASH_ACCESS_KEY: z.string().optional(),
    /** Graph API token with ads_read, for the public Ad Library search. */
    META_AD_LIBRARY_TOKEN: z.string().optional(),
    /** 32 bytes, base64. Encrypts stored third-party access tokens. */
    TOKEN_ENCRYPTION_KEY: z.string().optional(),
    /** Meta app used for the account connection flow. */
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    // Generative imagery, `<uuid>:<secret>`.
    FAL_KEY: z.string().includes(':').optional(),
    // Batch generation queue. Deploys carry this; local dev runs tasks inline.
    TRIGGER_SECRET_KEY: z.string().startsWith('tr_').optional(),
    // Render service, a separate process on its own host.
    RENDER_SERVICE_URL: z.url().optional(),
    RENDER_SERVICE_TOKEN: z.string().min(32).optional(),
    RESEND_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_LOGGING_LEVEL: z
      .enum(['error', 'info', 'debug', 'warning', 'trace', 'fatal'])
      .default('info'),
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  // You need to destructure all the keys manually
  runtimeEnv: {
    ARCJET_KEY: process.env.ARCJET_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_STANDARD_PRICE_ID: process.env.STRIPE_STANDARD_PRICE_ID,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    META_AD_LIBRARY_TOKEN: process.env.META_AD_LIBRARY_TOKEN,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    FAL_KEY: process.env.FAL_KEY,
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
    RENDER_SERVICE_URL: process.env.RENDER_SERVICE_URL,
    RENDER_SERVICE_TOKEN: process.env.RENDER_SERVICE_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_LOGGING_LEVEL: process.env.NEXT_PUBLIC_LOGGING_LEVEL,
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST: process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NODE_ENV: process.env.NODE_ENV,
  },
});
