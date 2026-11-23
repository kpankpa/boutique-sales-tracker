async function request(method, path, body) {
  const options = {
    method,
    cache: 'no-store',
    headers: {}
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const failure = new Error(data.error || 'The request could not be completed.');
    failure.code = data.code;
    failure.details = data.details;
    failure.status = response.status;
    throw failure;
  }
  return data;
}

export function apiGet(path) {
  return request('GET', path);
}

export function apiPost(path, body) {
  return request('POST', path, body);
}
