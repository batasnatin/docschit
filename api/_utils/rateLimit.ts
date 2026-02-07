import { createClient } from '@supabase/supabase-js';
import type { VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing server-side Supabase environment variables (SUPABASE_URL / SUPABASE_ANON_KEY)');
}

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  chat: { maxRequests: 20, windowSeconds: 60 },
  suggestions: { maxRequests: 10, windowSeconds: 60 },
};

export const checkRateLimit = async (
  userId: string,
  endpoint: string,
  res: VercelResponse,
): Promise<boolean> => {
  const config = DEFAULTS[endpoint] ?? { maxRequests: 20, windowSeconds: 60 };

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.rpc('docschat_check_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_max_requests: config.maxRequests,
      p_window_seconds: config.windowSeconds,
    });

    if (error) {
      console.error('Rate limit check failed:', error.message);
      // Fail open — allow request if rate limiter is unavailable
      return true;
    }

    if (data === false) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
      return false;
    }

    return true;
  } catch (err) {
    console.error('Rate limit error:', err);
    // Fail open
    return true;
  }
};
