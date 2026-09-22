export type Bindings = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  VOICEVOX_API_ROOT_URL: string;
  ORCAROUTER_API_KEY?: string;
  ORCAROUTER_MODEL?: string;
  ORCAROUTER_BASE_URL?: string;
  ADMIN_ORIGIN?: string;
};
