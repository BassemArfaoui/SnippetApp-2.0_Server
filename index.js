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
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const corsOptions = {
  origin: 'http://localhost:3000' 
};

app.use(cors(corsOptions));





app.get('/', async (req,res)=>{
  res.send('hello')
});



app.get('/posts', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    // Fetch random posts with limit
    const result = await db.query(`
      SELECT * FROM post 
      ORDER BY RANDOM() 
      LIMIT $1
    `, [limit]);

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








app.post('/',async (req,res)=>
{ 
  
})




app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
