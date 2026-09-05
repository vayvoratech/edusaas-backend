
module.exports = (req, res, next) => {
  if (req.path.includes('/api/users/search')) {
    console.log('[SEARCH REQUEST]', req.method, req.url);
    const oldSend = res.json;
    res.json = function(data) {
      console.log('[SEARCH RESPONSE]', JSON.stringify(data).substring(0, 200));
      oldSend.apply(res, arguments);
    };
  }
  next();
};
