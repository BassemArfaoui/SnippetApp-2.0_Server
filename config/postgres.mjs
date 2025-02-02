import pg from "pg";
import dotenv from "dotenv"


dotenv.config();

//database config
const db = new pg.Client({
    user:process.env.DB_user,
    host:process.env.DB_host,
    database:process.env.Db_name,
    password:process.env.PG_password, 
    port:process.env.port
  });


  export default db;