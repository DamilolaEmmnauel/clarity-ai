export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '';
  const numOfDays = searchParams.get('days') ?? '3';

  const token = process.env.CLARITY_API_TOKEN;
  const projectId = process.env.CLARITY_PROJECT_ID;

  if (!token || !projectId) {
    return Response.json(
      { error: 'CLARITY_API_TOKEN or CLARITY_PROJECT_ID not configured' },
      { status: 400 }
    );
  }

  const url = new URL(
    `https://www.clarity.ms/export-data/api/v1/${projectId}/live-insights`
  );
  if (page) url.searchParams.set('pageFilter', page);
  if (numOfDays) url.searchParams.set('numOfDays', numOfDays);
  url.searchParams.set('projectId', projectId);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to reach Clarity API', detail: String(err) },
      { status: 502 }
    );
  }

  if (!response.ok) {
    return Response.json(
      { error: `Clarity API error: ${response.status} ${response.statusText}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  return Response.json(data);
}
