declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    TEXT_MODEL?: string;
    IMAGE_MODEL?: string;
    AI_STATUS?: string;
  }
}
