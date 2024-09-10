import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv"
import cors from 'cors';


const app = express();
const port = 4000;
dotenv.config();


//database connection
const db = new pg.Client({
  user:process.env.DB_user,
  host:process.env.DB_host,
  database:process.env.Db_name,
  password:process.env.PG_password, 
  port:process.env.port
});
db.connect();


//middlewares
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const corsOptions = {
  origin: 'http://localhost:3000' 
};
app.use(cors(corsOptions));





app.get('/', async (req,res)=>{
  res.send('hello')
});


//route to get the posts
app.get('/:userId/posts', async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await db.query(`
      SELECT p.*, 
      CASE 
        WHEN l.post_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
      END AS "isLiked",
      CASE 
        WHEN d.post_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
      END AS "isDisliked",
      CASE 
        WHEN s.post_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
      END AS "isSaved"
      FROM post p
      LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $1
      LEFT JOIN dislikes d ON d.post_id = p.id AND d.user_id = $1
      LEFT JOIN saves s ON s.post_id = p.id AND s.user_id = $1
      ORDER BY RANDOM()
      LIMIT $2
    `, [userId, limit]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});


//route to get the notifications
app.get('/notifications/:id', async (req, res) => {
  const userId = req.params.id;
  const limit = parseInt(req.query.limit) || 10; // Default to 10 if not provided
  const offset = parseInt(req.query.offset) || 0; // Default to 0 (start from the first notification)

  try {
    const notifications = await db.query(
      `SELECT n.*, p.title as post_title
       FROM notification n
       LEFT JOIN post p ON n.post_id = p.id
       WHERE n.to_id = $1
       ORDER BY n.time DESC
       LIMIT $2 OFFSET $3`, 
      [userId, limit, offset]
    );
    res.json(notifications.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});


// Route to like a post
app.get('/like/:userId/:postId', async (req, res) => {
   const  userId  = req.params.userId;
    const  postId  = req.params.postId;

    try {
        await db.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId,userId])
        await db.query('UPDATE post SET like_count = like_count + 1 WHERE id = $1', [postId]);
        res.status(200).json({ success:true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success:false });
    }
});


// Route to unlike a post
app.get('/unlike/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);

    await db.query('UPDATE post SET like_count = like_count - 1 WHERE id = $1', [postId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Route to dislike a post
app.get('/dislike/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('INSERT INTO dislikes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);

    await db.query('UPDATE post SET dislike_count = dislike_count + 1 WHERE id = $1', [postId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Route to undislike a post
app.get('/undislike/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('DELETE FROM dislikes WHERE post_id = $1 AND user_id = $2', [postId, userId]);

    await db.query('UPDATE post SET dislike_count = dislike_count - 1 WHERE id = $1', [postId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Route to unsave a post
app.get('/unsave/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('DELETE FROM saves WHERE user_id = $1 AND post_id = $2', [userId, postId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});



// Route to save a post
app.get('/save/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('INSERT INTO saves (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});





app.post('/',async (req,res)=>
{ 
  
})




app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
