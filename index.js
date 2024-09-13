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


app.get('/:userId/posts', async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await db.query(`
      SELECT p.*, 
             u.firstname AS "poster_firstname",
             u.lastname AS "poster_lastname",
             u.username AS "poster_username",
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
             END AS "isSaved",
             CASE 
               WHEN i.interested_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "isInterested"
      FROM post p
      LEFT JOIN users u ON p.poster_id = u.id
      LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $1
      LEFT JOIN dislikes d ON d.post_id = p.id AND d.user_id = $1
      LEFT JOIN saves s ON s.post_id = p.id AND s.user_id = $1
      LEFT JOIN interests i ON i.interested_id = $1 AND i.interesting_id = p.poster_id
      ORDER BY RANDOM()
      LIMIT $2
    `, [userId, limit]);
    console.log('i am called')
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
        await db.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING', [postId,userId])
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
    await db.query('INSERT INTO dislikes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING', [postId, userId]);

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


// Route to save a post
app.get('/save/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('INSERT INTO saves (user_id, post_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING', [userId, postId]);
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


// Route to express interest
app.get('/interested/:interestedId/:interestingId', async (req, res) => {
  const { interestedId, interestingId } = req.params;

  try {
   await db.query(` INSERT INTO interests (interested_id, interesting_id) VALUES ($1, $2) ON CONFLICT (interested_id, interesting_id) DO NOTHING`, [interestedId, interestingId]);

    res.status(200).json({ success: true});
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false});
  }
});


// Route to remove interest
app.get('/uninterested/:interestedId/:interestingId', async (req, res) => {
  const { interestedId, interestingId } = req.params;

  try {
   await db.query(` delete from interests where interested_id = $1 and  interesting_id=$2 `, [interestedId, interestingId]);

    res.status(200).json({ success: true});
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false});
  }
});


app.get('/:postId/:userId/comments', async (req, res) => {
  const { postId, userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const result = await db.query(
      `
      SELECT
        c.id,
        c.user_id,
        c.content,
        c.is_reply,
        c.reply_to_id,
        c.like_count,
        c.dislike_count,
        c.commented_at,
        u.firstname,
        u.lastname,
        u.profile_pic,
        COALESCE(cl_liked.id IS NOT NULL, false) AS liked,
        COALESCE(cl_disliked.id IS NOT NULL, false) AS disliked
      FROM comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN comment_likes cl_liked ON cl_liked.comment_id = c.id AND cl_liked.user_id = $2
      LEFT JOIN comment_dislikes cl_disliked ON cl_disliked.comment_id = c.id AND cl_disliked.user_id = $2
      WHERE c.post_id = $1
      ORDER BY c.commented_at DESC
      LIMIT $3 OFFSET $4
      `,
      [postId, userId, limit, offset]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'An error occurred while fetching comments' });
  }
});



// Route to like a comment
app.get('/likeComment/:userId/:commentId', async (req, res) => {
  const userId = req.params.userId;
  const commentId = req.params.commentId;

  try {
    // Insert into the comment_likes table
    await db.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT (comment_id, user_id) DO NOTHING', [commentId, userId]);

    // Update the like_count in the comments table
    await db.query('UPDATE comments SET like_count = like_count + 1 WHERE id = $1', [commentId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Route to unlike a comment
app.get('/unlikeComment/:userId/:commentId', async (req, res) => {
  const { userId, commentId } = req.params;

  try {
    // Remove from the comment_likes table
    await db.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);

    // Update the like_count in the comments table
    await db.query('UPDATE comments SET like_count = like_count - 1 WHERE id = $1', [commentId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Route to dislike a comment
app.get('/dislikeComment/:userId/:commentId', async (req, res) => {
  const { userId, commentId } = req.params;


  try {
    // Insert into the comment_dislikes table
    await db.query('INSERT INTO comment_dislikes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT (comment_id, user_id) DO NOTHING', [commentId, userId]);

    // Update the dislike_count in the comments table
    await db.query('UPDATE comments SET dislike_count = dislike_count + 1 WHERE id = $1', [commentId]);

    res.status(200).json({ success: true });
    console.log('dislike called')
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Route to undislike a comment
app.get('/undislikeComment/:userId/:commentId', async (req, res) => {
  const { userId, commentId } = req.params;

  try {
    // Remove from the comment_dislikes table
    await db.query('DELETE FROM comment_dislikes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);

    // Update the dislike_count in the comments table
    await db.query('UPDATE comments SET dislike_count = dislike_count - 1 WHERE id = $1', [commentId]);

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
