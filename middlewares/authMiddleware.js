import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log('authHeader', authHeader)


  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Unauthorized: No token provided')
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('decoded', decoded)
    req.user = decoded; 
    next();
  } catch (error) {
    console.error('Unauthorized')
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });

  }
};

export default authMiddleware;
