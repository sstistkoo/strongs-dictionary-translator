/** Pomocné parsování odpovědi OpenRouter (více tvarů message.content). */
export function extractOpenRouterText(d) {
  const content = d?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      return '';
    }).join('').trim();
  }
  return '';
}
