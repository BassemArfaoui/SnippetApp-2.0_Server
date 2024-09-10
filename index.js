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
    // Fetch random posts with an additional isLiked field
    const result = await db.query(`
      SELECT p.*, 
      CASE 
        WHEN l.post_id IS NOT NULL THEN TRUE 
        ELSE FALSE 
      END AS "isLiked"
      FROM post p
      LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $1
      ORDER BY RANDOM()
      LIMIT $2
    `, [userId, limit]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});



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


// Route to dislike a post
app.get('/dislike/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('UPDATE post SET dislike_count = dislike_count + 1 WHERE id = $1', [id]);
        res.status(200).json({ message: 'Disliked post' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
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


// Route to remove dislike from a post
app.get('/undislike/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('UPDATE post SET dislike_count = dislike_count - 1 WHERE id = $1', [id]);
        res.status(200).json({ message: 'Undisliked post' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/check/like/:userId/:postId',async (req,res)=>{
  const userId = req.params.userId;
  const postId = req.params.postId;

  try
  {
      const result=await db.query('SELECT * FROM likes WHERE post_id = $1 AND user_id = $2',[postId,userId])
      if(result.rows.length>0){
        res.status(200).json({liked:true})
      }else{
        res.status(200).json({liked:false})
      }
    
  }
  catch(err)
  {
    console.error(err);
    res.status(500).json({error:'Server error'})
  }

})


app.post('/',async (req,res)=>
{ 
  
})




app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
