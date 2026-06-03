export const PROMPTS = {
  translateProduct: (name: string, targetLang: string) =>
    `Translate this product name to ${targetLang}, keep it concise and suitable for e-commerce listing:\n\n${name}\n\nTranslation:`,

  classifyRefundReason: (reason: string) =>
    `Classify this refund/return reason into exactly one category: "quality" (product defect/damage), "logistics" (late/damaged in transit), "buyer" (changed mind/wrong order), or "other". Reply with only the category name.\n\nReason: ${reason}\n\nCategory:`,

  anomalyAlert: (context: string) =>
    `Based on this e-commerce data, write a concise alert message in Chinese for the seller (1-2 sentences max, no greeting):\n\n${context}\n\nAlert:`,
};
