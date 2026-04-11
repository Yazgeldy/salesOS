import type { ApiResponse } from './types';

export async function fetchSalesData(): Promise<ApiResponse> {
  const res = await fetch('/api/sales', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load data (HTTP ${res.status})`);
  }
  const json = await res.json();
  // Graceful fallback if Modal API is not yet configured
  return {
    data: json.data ?? [],
    last_sync: json.last_sync ?? '',
    count: json.count ?? 0,
  };
}
