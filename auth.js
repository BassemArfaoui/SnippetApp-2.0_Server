import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv"
import cors from 'cors';
import bcrypt from "bcrypt"


const app = express();
const port = 5000;
const saltRounds = 10;
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
  origin: ['http://localhost:3000','http://localhost:3001' ]
};
app.use(cors(corsOptions));


async function isEmailUsed(email)
{
  const result= await db.query('select * from users where email=$1', [email]);
  return result.rows.length > 0;
}


async function addUser(name, email, password,code)
{
  const result= await db.query('insert into users (username, email, password,verif_code) values ($1, $2, $3, $4) returning *', [name, email, password,code]);
  return result.rows[0];
}

function isValidUsername(username) {
  const regex = /^[a-zA-Z0-9._]+$/;
  const isValidLength = username.length >= 6;
  const isValidCharacters = regex.test(username);
  return isValidLength && isValidCharacters;
}


function isStrongPassword(password) {
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLowercase && hasUppercase && hasNumber && password.length >= 8;
}




app.get('/', async (req,res)=>{
  res.send('test')
});


app.post('/register',async (req, res)=>
{ let alerts = [] ;
  try
  {
    const {username, email, password ,firstname , lastname }= req.body;


    if(!username || !email || !password || !firstname || !lastname)
    {
      alerts.push({error:'some fields are missing'})
    }

    if(await isEmailUsed(email))
    {
      alerts.push({error:"Email already used"})
    }

    if(!isValidUsername(username))
    {
      alerts.push({error:'Invalid username : Username must be 6 charachters long and Can only contain Letters , Numbers , Underscores (_) and Dots (.)'})
    }

    
    if(!isStrongPassword(password))
    {
      alerts.push({error:'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number'})
    }


    if(alerts.length>0)
    {
      res.status(401).json(alerts);
    }
    else
    {
    //   const code=generateCode(6);
    //   const ejsFilePath = path.join(process.cwd(),'views', 'emails' ,'verifCodeEmail.ejs');
    //   const html = await ejs.renderFile(ejsFilePath, { name: name , code : code});
    //   const options = {
    //     from: `SnippetApp Team <${process.env.MAIL}>`,
    //     to: email,
    //     subject: 'SnippetApp Email Verification',
    //     html:html};

        try
        { 
          const hash= await bcrypt.hash(password, saltRounds);
          const user= await addUser(username, email, hash, "000000");
          // const info =await transporter.sendMail(options);
          console.log('Email sent: ' + info.response);
          alerts.push({test:true , user:user})
          res.status(200).json(alerts);
        }
        catch(err)
        {
          throw err;
        }

        }
    


  }
  catch(err)
  {
    alerts=[{message:'Inertnal Server Error'}];
    console.log(err);
    res.status(500).json(alerts);
  }
})








app.post('/login', async (req,res)=>{

})







app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
