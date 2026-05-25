function wantsJson(req) {
  return (
    req.is('application/json') ||
    (req.get('accept') || '').includes('application/json')
  );
}

module.exports = { wantsJson };
