import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type City = {
  id: string; name: string; uf: string; ibge_code: string | null;
  contact_name: string | null; contact_role: string | null; contact_email: string | null;
  contact_phone: string | null; notes: string | null; active: boolean;
};

export type Opportunity = {
  id: string; city_id: string; run_id: string | null; kind: string; product: string | null;
  title: string; summary: string | null; why_it_matters: string | null; suggested_action: string | null;
  neighborhood: string | null; source_url: string | null; source_name: string | null;
  published_at: string | null; deadline_at: string | null; deadline_verified: boolean;
  business_days_left: number | null; eligible: boolean | null; score: number; confidence: string | null;
  extra: any; status: string; fingerprint: string; first_seen: string; last_seen: string;
};

export type EmailDraft = {
  id: string; city_id: string; opportunity_ids: string[]; intent: string | null; briefing: string | null;
  to_email: string | null; cc: string | null; subject: string | null; body: string | null;
  status: string; message_id: string | null; error: string | null; created_at: string; sent_at: string | null;
};
