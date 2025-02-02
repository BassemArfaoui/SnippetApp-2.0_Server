


async function checkToken(req,res,next)
{
  const bearer = req.headers['authorization'];
  if (!bearer) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token=bearer.split(' ')[1];
    req.token=token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}


export default checkToken;