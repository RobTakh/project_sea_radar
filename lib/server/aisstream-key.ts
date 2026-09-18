export const getAisstreamApiKey = (): string | null => {
  const apiKey = process.env.AISSTREAM_API_KEY?.trim();
  return apiKey || null;
};
