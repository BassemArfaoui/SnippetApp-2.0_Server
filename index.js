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
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});




//route to get the notifications
app.get('/notifications/:id', async (req, res) => {
  const userId = req.params.id;
  const limit = parseInt(req.query.limit) || 10; 
  const offset = parseInt(req.query.offset) || 0; 

  try {
    const notifications = await db.query(
      `SELECT 
         n.*, 
         p.title AS post_title,
         u.firstname AS from_firstname,
         u.lastname AS from_lastname
       FROM notification n
       LEFT JOIN post p ON n.post_id = p.id
       LEFT JOIN users u ON n.from_id = u.id
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
  const limit = parseInt(req.query.limit) || 20;
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
      AND c.is_reply = false
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
    await db.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT (comment_id, user_id) DO NOTHING', [commentId, userId]);

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
    await db.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);

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
    await db.query('INSERT INTO comment_dislikes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT (comment_id, user_id) DO NOTHING', [commentId, userId]);

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
    await db.query('DELETE FROM comment_dislikes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);

    await db.query('UPDATE comments SET dislike_count = dislike_count - 1 WHERE id = $1', [commentId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Route to get the replies of a comment with pagination and total count
app.get('/comments/:commentId/replies', async (req, res) => {
  const commentId = req.params.commentId;
  const limit = parseInt(req.query.limit) || 2;  // Number of replies per page
  const offset = parseInt(req.query.offset) || 0; // Page offset (starting point for this page)

  try {
    // Query to get the paginated replies
    const repliesQuery = `
      SELECT
        c.id,
        c.user_id,
        c.content,
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
      LEFT JOIN comment_likes cl_liked ON cl_liked.comment_id = c.id
      LEFT JOIN comment_dislikes cl_disliked ON cl_disliked.comment_id = c.id
      WHERE c.is_reply = true AND c.reply_to_id = $1
      ORDER BY c.commented_at ASC
      LIMIT $2 OFFSET $3
    `;

    // Query to get the total count of replies
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM comments
      WHERE is_reply = true AND reply_to_id = $1
    `;

    // Execute the queries in parallel
    const [repliesResult, countResult] = await Promise.all([
      db.query(repliesQuery, [commentId, limit, offset]),
      db.query(countQuery, [commentId])
    ]);

    const totalReplies = countResult.rows[0].total;
    const replies = repliesResult.rows;

    res.json({ totalReplies, replies });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Error fetching replies' });
  }
});


// Route to get the total replies count of a comment
app.get('/comments/:commentId/repliesCount', async (req, res) => {
  const commentId = req.params.commentId;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM comments
      WHERE is_reply = true AND reply_to_id = $1
    `;
    
    const countResult = await db.query(countQuery, [commentId]);
    const totalReplies = countResult.rows[0].total;

    res.json({ totalReplies });
  } catch (error) {
    console.error('Error fetching replies count:', error);
    res.status(500).json({ message: 'Error fetching replies count' });
  }
});



app.post('/add/comment', async (req, res) => {
  const { userId, postId, content, isReply, replyToId } = req.body;

  try {
    if (!userId || !postId || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Insert comment into the database
    const insertCommentQuery = `
      INSERT INTO comments (user_id, post_id, content, is_reply, reply_to_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING * ;
    `;

    const result = await db.query(insertCommentQuery, [
      userId,
      postId,
      content,
      isReply , 
      replyToId, 
    ]);

    await db.query('UPDATE post SET comment_count = comment_count + 1 WHERE id = $1', [postId]);

    const newComment = result.rows[0];

    res.status(201).json({ message: 'Comment added successfully', comment: newComment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
});


// Get a post by its ID
app.get('/post/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const queryText = `
      SELECT p.*, u.username, u.firstname, u.lastname 
      FROM post p
      JOIN users u ON p.poster_id = u.id
      WHERE p.id = $1
    `;

    const postResult = await db.query(queryText, [id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = postResult.rows[0];
    res.json(post);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/:userId/saved-posts', async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10; 
  const page = parseInt(req.query.page) || 1;    
  const offset = (page - 1) * limit;             

  console.log('saved route is called ')

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
             s.saved_at,
             CASE 
               WHEN i.interested_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "isInterested"
      FROM saves s
      JOIN post p ON p.id = s.post_id
      LEFT JOIN users u ON p.poster_id = u.id
      LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $1
      LEFT JOIN dislikes d ON d.post_id = p.id AND d.user_id = $1
      LEFT JOIN interests i ON i.interested_id = $1 AND i.interesting_id = p.poster_id
      WHERE s.user_id = $1
      ORDER BY s.saved_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while fetching saved posts' });
  }
});

app.get('/:userId/search-saved-posts', async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10; 
  const page = parseInt(req.query.page) || 1;    
  const keyword = req.query.keyword || '';       // Search keyword from query params
  const offset = (page - 1) * limit;             

  console.log('Search saved posts route is called');

  try {
    const result = await db.query(`
      SELECT p.*, 
             u.firstname AS "poster_firstname",
             u.lastname AS "poster_lastname",
             u.username AS "poster_username",
             CASE 
               WHEN l.post_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_liked",
             CASE 
               WHEN d.post_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_disliked",
             CASE 
               WHEN s.post_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_saved",
             s.saved_at,
             CASE 
               WHEN i.interested_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_interested"
      FROM saves s
      JOIN post p ON p.id = s.post_id
      LEFT JOIN users u ON p.poster_id = u.id
      LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $1
      LEFT JOIN dislikes d ON d.post_id = p.id AND d.user_id = $1
      LEFT JOIN interests i ON i.interested_id = $1 AND i.interesting_id = p.poster_id
      WHERE s.user_id = $1
      AND (p.title ILIKE $2)  
      ORDER BY s.saved_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, `%${keyword}%`, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while fetching search results for saved posts' });
  }
});


app.get('/:userId/saved-posts/filter', async (req, res) => {
  const { userId } = req.params;
  const { title, language, content, limit = 10, page = 1 } = req.query;

  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT p.*, 
             u.firstname AS "poster_firstname",
             u.lastname AS "poster_lastname",
             u.username AS "poster_username",
             CASE 
               WHEN l.post_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_liked",
             CASE 
               WHEN d.post_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_disliked",
             CASE 
               WHEN s.post_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_saved",
             s.saved_at,
             CASE 
               WHEN i.interested_id IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END AS "is_interested"
      FROM saves s
      JOIN post p ON p.id = s.post_id
      LEFT JOIN users u ON p.poster_id = u.id
      LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $1
      LEFT JOIN dislikes d ON d.post_id = p.id AND d.user_id = $1
      LEFT JOIN interests i ON i.interested_id = $1 AND i.interesting_id = p.poster_id
      WHERE s.user_id = $1
    `;

    const queryParams = [userId];

    // Add filters if provided
    if (title) {
      queryParams.push(`%${title}%`);
      query += ` AND p.title ILIKE $${queryParams.length}`;
    }
    if (language) {
      queryParams.push(`%${language}%`);
      query += ` AND p.language ILIKE $${queryParams.length}`;
    }
    if (content) {
      queryParams.push(`%${content}%`);
      query += ` AND p.snippet ILIKE $${queryParams.length}`;
    }

    query += `
      ORDER BY s.saved_at DESC
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limit, offset);

    // Log the query and the parameters to troubleshoot
    console.log('Executing query:', query);
    console.log('With parameters:', queryParams);

    const result = await db.query(query, queryParams);

    // Log the result to see what is returned from the database
    console.log('Query result:', result.rows);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error filtering saved posts:', error);
    res.status(500).json({ message: 'Error filtering saved posts' });
  }
});














app.post('/',async (req,res)=>
{ 
  
})




app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
