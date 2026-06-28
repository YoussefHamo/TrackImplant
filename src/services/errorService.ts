// Centralized Error Monitoring Node
export const errorService = {
  log: (error: unknown, context: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 1. طباعة الخطأ في الـ Terminal للمطورين بتنسيق واضح
    console.error(`%c[CRITICAL ERROR] [Context: ${context}]`, 'color: #ff0055; font-weight: bold;', errorMessage);

    // 2. 🚀 هنا يتم ربط Sentry أو LogRocket في إنتاج الشركات (Enterprise Integration)
    // if (import.meta.env.PROD) {
    //   Sentry.captureException(error, { tags: { context } });
    // }
  },

  formatMessage: (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return "Unknown system core exception detected.";
  }
};