export const QSTASH_CONFIG = {
  baseUrl: 'https://qstash.upstash.io',
  publishUrl: 'https://qstash.upstash.io/v1/publish',
  scheduleUrl: 'https://qstash.upstash.io/v1/schedules',
  messagesUrl: 'https://qstash.upstash.io/v1/messages',

  defaults: {
    timeout: 30000, // 30 segundos
    maxRetries: 3,
    retryBackoff: 'exponential' as const,
    contentType: 'application/json',
  },

  rateLimits: {
    requestsPerSecond: 10,
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
  },

  headers: {
    userAgent: 'QStash-Service/1.0.0',
    acceptEncoding: 'gzip, deflate',
  },

  allowedWebhookUrls: [
    process.env.WEBHOOK_URL,
  ],

  retryConfig: {
    initialDelay: 1000, // 1 segundo
    maxDelay: 32000, // 32 segundos
    multiplier: 2,
    maxAttempts: 5,
  },

  scheduling: {
    maxScheduleAhead: 365 * 24 * 60 * 60, // 1 ano em segundos
    minScheduleAhead: 60, // 1 minuto em segundos
  },
} as const;
