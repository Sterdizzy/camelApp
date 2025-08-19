// Retry mechanism with exponential backoff
export async function withRetry(fn, tries = 3, baseMs = 800) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) {
        await new Promise(resolve => setTimeout(resolve, baseMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export async function fetchInChunks(items, chunkSize = 40, fetchFn) {
  if (items.length === 0) return {};
  
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  
  const results = await Promise.all(
    chunks.map(chunk => 
      withRetry(() => fetchFn({ symbols: chunk }), 3, 700)
    )
  );
  
  // Merge results from all chunks
  return results.reduce((acc, result) => {
    if (result && result.data && result.data.prices) {
      return Object.assign(acc, result.data.prices);
    }
    return acc;
  }, {});
}