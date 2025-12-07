export async function handler(event, context) {
  return {
    body: 'Hello from Code Risk Radar!',
    headers: { 'Content-Type': ['text/plain'] },
    statusCode: 200
  };
}
