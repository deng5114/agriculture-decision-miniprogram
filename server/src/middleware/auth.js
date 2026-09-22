function requireLogin(req, res, next) {
  const userId = req.header('x-demo-user-id');

  if (!userId) {
    return res.status(401).json({
      code: 401,
      message: '请先登录',
      data: null
    });
  }

  req.user = { id: Number(userId), role: req.header('x-demo-role') };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.header('x-demo-role');
    if (!role || !roles.includes(role)) {
      return res.status(403).json({
        code: 403,
        message: '当前角色无权执行此操作',
        data: null
      });
    }
    req.user.role = role;
    next();
  };
}

module.exports = { requireLogin, requireRole };
