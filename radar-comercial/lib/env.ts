// Leitura centralizada das variáveis de ambiente (lidas sob demanda, não no build).
const num = (v: string | undefined, d: number) => (v && !isNaN(Number(v)) ? Number(v) : d);

export const env = {
  get anthropicKey() { return req('ANTHROPIC_API_KEY'); },
  get modelResearch() { return process.env.CLAUDE_MODEL_RESEARCH || 'claude-sonnet-5'; },
  get modelWriting() { return process.env.CLAUDE_MODEL_WRITING || 'claude-sonnet-5'; },
  get maxSearches() { return num(process.env.MAX_SEARCHES_PER_CITY, 6); },
  get maxSearchesPerDay() { return num(process.env.MAX_SEARCHES_PER_DAY, 80); },
  get concurrency() { return Math.max(1, Math.min(5, num(process.env.RESEARCH_CONCURRENCY, 2))); },
  get supabaseUrl() { return req('SUPABASE_URL'); },
  get supabaseKey() { return req('SUPABASE_SERVICE_ROLE_KEY'); },
  get appPassword() { return req('APP_PASSWORD'); },
  get authSecret() { return req('AUTH_SECRET'); },
  get cronSecret() { return req('CRON_SECRET'); },
  get appUrl() {
    return (process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
  },
  get minMargin() { return num(process.env.MIN_MARGIN_BUSINESS_DAYS, 3); },
  get maxActiveCities() { return num(process.env.MAX_ACTIVE_CITIES, 15); },
  get maxNewCitiesPerDay() { return num(process.env.MAX_NEW_CITIES_PER_DAY, 1); },
  get emailCooldownDays() { return num(process.env.EMAIL_COOLDOWN_DAYS, 10); },
  get maxEmailsPerDay() { return num(process.env.MAX_EMAILS_PER_DAY, 20); },
  get reportEmail() { return process.env.REPORT_EMAIL || ''; },
};

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}. Configure no painel da Vercel ou no .env.local.`);
  return v;
}
