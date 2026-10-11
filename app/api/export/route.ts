import { readData } from "@/lib/store";

export async function POST() {
  const data = await readData();
  const exportData = {
    ...data,
    settings: {
      provider: data.settings.provider,
      baseUrl: data.settings.baseUrl,
      model: data.settings.model,
      hasApiKey: Boolean(data.settings.apiKey)
    },
  };
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=mail-reply-studio-export.json"
    }
  });
}
