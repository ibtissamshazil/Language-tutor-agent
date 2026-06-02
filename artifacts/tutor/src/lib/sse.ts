export async function* parseSSEStream(response: Response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === "[DONE]") continue;
        try {
          const data = JSON.parse(dataStr);
          yield data;
        } catch (e) {
          console.error("Failed to parse SSE JSON", e, dataStr);
        }
      }
    }
  }
}