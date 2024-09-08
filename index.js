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

app.get('/posts', async (req, res)=>{
  const result = await db.query("SELECT * FROM post order by id asc");
  res.json(result.rows)
});





app.post('/',async (req,res)=>
{ 
  
})




app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
