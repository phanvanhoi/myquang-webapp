async function fetchMoveJson(url, options = {}) {
  const resp = await fetch(url, options);
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || `Lỗi ${resp.status}`);
    }
    return data;
  }
  if (!resp.ok) {
    throw new Error(`Lỗi ${resp.status}`);
  }
  throw new Error('Phản hồi không hợp lệ');
}
