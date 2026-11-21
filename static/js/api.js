export class APIClient {
  static async getJSON(endpoint) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[API Error] Request failed for ${endpoint}:`, error);
      return null;
    }
  }

  static async postJSON(endpoint, payload) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (error) {
      console.error(`[API Error] POST request failed for ${endpoint}:`, error);
      return null;
    }
  }
}