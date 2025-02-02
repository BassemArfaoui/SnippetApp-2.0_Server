import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv"
import cors from 'cors';
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken";
import upload from "./config/cloudinary.mjs";
import db from "./config/postgres.mjs";
import checkToken from "./middlewares/checkToken.mjs";
import { addPostToAlgolia , updatePostInAlgolia , deletePostFromAlgolia , addUserToAlgolia} from './config/algolia.mjs'; 






//initialize
const app = express();
dotenv.config();
db.connect();



//constants
const port = 4000;
const saltRounds =10 ;
const jwtSecret = process.env.JWT_SECRET;



//middlewares
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const corsOptions = {
  origin: ['http://localhost:3000','http://localhost:3001' ]
};
app.use(cors(corsOptions));



//functions
async function isEmailUsed(email)
{
  const result= await db.query('select * from users where email=$1', [email]);
  return result.rows.length > 0;
}

async function isUsernameUsed(username)
{
  const result= await db.query('select * from users where username=$1', [username]);
  return result.rows.length > 0;
}

async function addUser(name, email, password , firstname , lastname)
{
  const result= await db.query('insert into users (username, email, password, firstname, lastname) values ($1, $2, $3 , $4 , $5) returning *', [name, email, password , firstname , lastname]);
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

async function getUserByEmail(email)
{
  const result= await db.query('select * from users where email=$1', [email]);
  return result.rows;
}

async function updateTokenById(id,token)
{
  const result= await db.query('update users set jwt_token=$1 where id=$2 returning jwt_token', [token, id]);
  return result.rows[0].token;
}

async function resetPassword(password,id)
{
  const result=db.query(`update  users set password = $1 where id=$2 returning * `,[password , id])
  return result.rows;
}





//routes
app.get('/', async (req,res)=>{
  res.send('hello')
});


//auth 
app.post('/register', async (req, res) => {
  let alerts = [];
  try {
    const { username, email, password, firstname, lastname } = req.body;

    console.log(req.body);

    if (!username || !email || !password || !firstname || !lastname) {
      alerts.push({ error: 'Some fields are missing' });
    }

    if (await isUsernameUsed(username)) {
      alerts.push({ error: 'Username already used' });
    }

    if (!isValidUsername(username)) {
      alerts.push({
        error:
          'Invalid username: Username must be 6 characters long and can only contain letters, numbers, underscores (_) and dots (.)',
      });
    }

    if (!isStrongPassword(password)) {
      alerts.push({
        error:
          'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number',
      });
    }

    if (alerts.length > 0) {
      return res.status(401).json(alerts);
    } else {
      // const code = generateCode(6);
      // const ejsFilePath = path.join(process.cwd(), 'views', 'emails', 'verifCodeEmail.ejs');
      // const html = await ejs.renderFile(ejsFilePath, { name: name , code : code});
      // const options = {
      //   from: `SnippetApp Team <${process.env.MAIL}>`,
      //   to: email,
      //   subject: 'SnippetApp Email Verification',
      //   html: html
      // };

      try {
        await db.query('BEGIN');

        const hash = await bcrypt.hash(password, saltRounds);

        const user = await addUser(username, email, hash, firstname, lastname);

        await addUserToAlgolia(user);

        await db.query('COMMIT');

        // Send email verification (commented as per original code)
        // const info = await transporter.sendMail(options);
        // console.log('Email sent: ' + info.response);

        alerts.push({ success: true, user: user });
        return res.status(200).json(alerts[0]);
      } catch (err) {
        await db.query('ROLLBACK');
        throw err;
      }
    }
  } catch (err) {
    alerts = [{ message: 'Internal Server Error' }];
    console.log(err);
    return res.status(500).json(alerts);
  }
});



app.post('/login',async (req, res)=>
{
  try
  {const {email, password}= req.body;
  console.log(email, password);
  const user_arr= await getUserByEmail(email);
  if(user_arr.length===0)
  {
    res.json({error:'Wrong Email or Password'})
  }else
  {
    // const isVerified=user_arr[0].is_verified;
    if(1==50)
    {
      res.json({error:'Email not verified'})
    }else
    {
      const isPasswordCorrect=await bcrypt.compare(password, user_arr[0].password);
      if(isPasswordCorrect)
      {
        const payload={id:user_arr[0].id,username : user_arr[0].username, email:user_arr[0].email};
        console.log(payload);
        const token=jwt.sign(payload, jwtSecret, {expiresIn:'1d'});
        await updateTokenById(user_arr[0].id, token);
        res.json({success:true , token:token,user:{id:user_arr[0].id,username:user_arr[0].username , email:user_arr[0].email}});
      }else
      {
        res.json({error:'Wrong Email or Password'})
      }
    }
  }

  }
  catch(err)
  {
    console.log(err);
    res.status(500).json({error:'Internal Server Error'})
  }
})

app.get('/check/token',checkToken,(req,res)=>{
  try {
    const token = req.token;
    const decoded = jwt.verify(token, jwtSecret);
    res.status(200).json({ valid: true });
  } catch (err) {
    res.json({ valid: false });
  }
})

app.post('/username-used',async (req, res)=>
{
  try
  {const {username}= req.body;
  console.log(username);
  const is_username_used = await isUsernameUsed(username);
  
  res.json({ is_username_used : is_username_used })

  }
  catch(err)
  {
    console.log(err);
    res.status(500).json({error:'Internal Server Error'})
  }
})

app.post('/reset/password/:id' ,async (req, res)=>
{
  try
  {
    const password= req.body.password;
    const id= req.params.id;
    if(password)
   {
    const hash=bcrypt.hashSync(password, saltRounds);
    const result=await resetPassword( hash,id);
    res.json({success:true});
  }
  else 
  {
    throw new Error('Invalid Password')
  }

  }
  catch(err)
  {
    console.log(err.message);
    res.status(500).json({error:err.message || 'Invalid or Expired Token'})
  }
})



//cloud
app.post("/:userId/upload", upload.single("profilePic"), async (req, res) => {
  try {
    const { userId } = req.params;
    const imageUrl = req.file.path; 
    await db.query("UPDATE users SET profile_pic = $1 WHERE id = $2", [imageUrl, userId]);

    res.json({ success: true, imageUrl }); 
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});


//services
app.get('/:userId/posts', async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await db.query(`
      SELECT p.*, 
             u.firstname AS "poster_firstname",
             u.lastname AS "poster_lastname",
             u.username AS "poster_username",
             u.profile_pic AS "poster_profile_pic",
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


app.get('/like/:userId/:postId', async (req, res) => {
  const userId = req.params.userId;
  const postId = req.params.postId;

  try {
    await db.query('BEGIN'); 

    await db.query(
      'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING',
      [postId, userId]
    );

    await db.query('UPDATE post SET like_count = like_count + 1 WHERE id = $1', [postId]);

    await db.query(
      `
      UPDATE users
      SET credit = credit + 3
      WHERE id = (SELECT poster_id FROM post WHERE id = $1)
      `,
      [postId]
    );

    await db.query('COMMIT');

    res.status(200).json({ success: true });

  } catch (err) {
    await db.query('ROLLBACK'); 
    console.error(err);
    res.status(500).json({ success: false });
  }
});



app.get('/unlike/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('BEGIN'); 

    await db.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);

    await db.query('UPDATE post SET like_count = like_count - 1 WHERE id = $1', [postId]);

    await db.query(
      `
      UPDATE users
      SET credit = credit - 3
      WHERE id = (SELECT poster_id FROM post WHERE id = $1)
      `,
      [postId]
    );

    await db.query('COMMIT'); 

    res.status(200).json({ success: true });

  } catch (err) {
    await db.query('ROLLBACK'); 
    console.error(err);
    res.status(500).json({ success: false });
  }
});



app.get('/dislike/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('BEGIN'); 

    await db.query(
      'INSERT INTO dislikes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING',
      [postId, userId]
    );

    await db.query('UPDATE post SET dislike_count = dislike_count + 1 WHERE id = $1', [postId]);

    await db.query(
      `
      UPDATE users
      SET credit = credit - 1
      WHERE id = (SELECT poster_id FROM post WHERE id = $1)
      `,
      [postId]
    );

    await db.query('COMMIT'); 

    res.status(200).json({ success: true });

  } catch (err) {
    await db.query('ROLLBACK'); 
    console.error(err);
    res.status(500).json({ success: false });
  }
});


app.get('/undislike/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;

  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM dislikes WHERE post_id = $1 AND user_id = $2', [postId, userId]);

    await db.query('UPDATE post SET dislike_count = dislike_count - 1 WHERE id = $1', [postId]);

    await db.query(
      `
      UPDATE users
      SET credit = credit + 1
      WHERE id = (SELECT poster_id FROM post WHERE id = $1)
      `,
      [postId]
    );

    await db.query('COMMIT'); 

    res.status(200).json({ success: true });

  } catch (err) {
    await db.query('ROLLBACK'); 
    console.error(err);
    res.status(500).json({ success: false });
  }
});


app.get('/save/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;
  let collection;

  if(req.query.collection && req.query.collection.trim())
  {
    collection=req.query.collection.trim().toLowerCase();
  }
  else
  {
    collection='no collection'
  }
  

  try {
    await db.query('INSERT INTO saves (user_id, post_id , collection) VALUES ($1, $2 , $3) ON CONFLICT (post_id, user_id) DO NOTHING', [userId, postId,collection]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


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


app.get('/interested/:interestedId/:interestingId', async (req, res) => {
  const { interestedId, interestingId } = req.params;

  try {
    await db.query(
      `
      WITH inserted AS (
        INSERT INTO interests (interested_id, interesting_id)
        VALUES ($1, $2)
        ON CONFLICT (interested_id, interesting_id) DO NOTHING
        RETURNING interesting_id
      )
      UPDATE users
      SET subs_count = subs_count + 1
      WHERE id = $2 AND EXISTS (SELECT 1 FROM inserted);
      `,
      [interestedId, interestingId]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


app.get('/uninterested/:interestedId/:interestingId', async (req, res) => {
  const { interestedId, interestingId } = req.params;

  try {
    const result = await db.query(
      `
      WITH deleted AS (
        DELETE FROM interests
        WHERE interested_id = $1 AND interesting_id = $2
        RETURNING interesting_id
      )
      UPDATE users
      SET subs_count = subs_count - 1
      WHERE id = $2 AND EXISTS (SELECT 1 FROM deleted);
      `,
      [interestedId, interestingId]
    );

    if (result.rowCount > 0) {
      res.status(200).json({ success: true, message: 'Subscription removed and subs_count decremented.' });
    } else {
      res.status(200).json({ success: false, message: 'No such interest found or already removed.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
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
        u.username,
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


app.get('/dislikeComment/:userId/:commentId', async (req, res) => {
  const { userId, commentId } = req.params;


  try {
    await db.query('INSERT INTO comment_dislikes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT (comment_id, user_id) DO NOTHING', [commentId, userId]);

    await db.query('UPDATE comments SET dislike_count = dislike_count + 1 WHERE id = $1', [commentId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


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


app.get('/comments/:commentId/replies', async (req, res) => {
  const commentId = req.params.commentId;
  const limit = parseInt(req.query.limit) || 2;  
  const offset = parseInt(req.query.offset) || 0; 

  try {

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
        u.username,
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

   
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM comments
      WHERE is_reply = true AND reply_to_id = $1
    `;

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

  if (!userId || !postId || !content) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    await db.query('BEGIN');

    const insertCommentQuery = `
      INSERT INTO comments (user_id, post_id, content, is_reply, reply_to_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await db.query(insertCommentQuery, [
      userId,
      postId,
      content,
      isReply,
      replyToId,
    ]);

    await db.query(
      'UPDATE post SET comment_count = comment_count + 1 WHERE id = $1',
      [postId]
    );

    await db.query('COMMIT');

    const newComment = result.rows[0];
    res.status(201).json({ message: 'Comment added successfully', comment: newComment });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
});


app.delete('/:userId/delete-comment/:commentId', async (req, res) => {
  const { userId, commentId } = req.params;

  try {
    if (!userId || !commentId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await db.query('BEGIN');

    const getPostIdQuery = 'SELECT post_id FROM comments WHERE id = $1 AND user_id = $2';
    const postResult = await db.query(getPostIdQuery, [commentId, userId]);

    if (postResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ message: 'Comment not found or unauthorized' });
    }

    const postId = postResult.rows[0].post_id;

    const getRepliesQuery = 'SELECT COUNT(*) FROM comments WHERE reply_to_id = $1 AND is_reply = true';
    const repliesResult = await db.query(getRepliesQuery, [commentId]);
    const repliesCount = parseInt(repliesResult.rows[0].count, 10);

    const deleteLikesQuery = 'DELETE FROM comment_likes WHERE comment_id = $1';
    const deleteDislikesQuery = 'DELETE FROM comment_dislikes WHERE comment_id = $1';

    await db.query(deleteLikesQuery, [commentId]);
    await db.query(deleteDislikesQuery, [commentId]);

    const deleteLikesRepliesQuery = 'DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE reply_to_id = $1)';
    const deleteDislikesRepliesQuery = 'DELETE FROM comment_dislikes WHERE comment_id IN (SELECT id FROM comments WHERE reply_to_id = $1)';
    
    await db.query(deleteLikesRepliesQuery, [commentId]);
    await db.query(deleteDislikesRepliesQuery, [commentId]);

    const deleteRepliesQuery = 'DELETE FROM comments WHERE reply_to_id = $1 AND is_reply = true';
    await db.query(deleteRepliesQuery, [commentId]);

    const deleteCommentQuery = 'DELETE FROM comments WHERE id = $1 AND user_id = $2';
    await db.query(deleteCommentQuery, [commentId, userId]);

    const decrementCommentCountQuery = `
      UPDATE post 
      SET comment_count = comment_count - $1
      WHERE id = $2
    `;
    await db.query(decrementCommentCountQuery, [repliesCount + 1, postId]);

    await db.query('COMMIT');

    res.status(200).json({ message: 'Comment, replies, and associated likes/dislikes deleted successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment' });
  }
});


app.delete('/:userId/delete-reply/:commentId', async (req, res) => {
  const { userId, commentId } = req.params;

  try {
    if (!userId || !commentId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await db.query('BEGIN');

    const getPostIdQuery = `
      SELECT post_id 
      FROM comments 
      WHERE id = $1 AND user_id = $2 AND is_reply = true
    `;
    const postResult = await db.query(getPostIdQuery, [commentId, userId]);

    if (postResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ message: 'Reply not found or unauthorized' });
    }

    const postId = postResult.rows[0].post_id;

    const deleteLikesQuery = 'DELETE FROM comment_likes WHERE comment_id = $1';
    const deleteDislikesQuery = 'DELETE FROM comment_dislikes WHERE comment_id = $1';
    await db.query(deleteLikesQuery, [commentId]);
    await db.query(deleteDislikesQuery, [commentId]);

    const deleteCommentQuery = `
      DELETE FROM comments 
      WHERE id = $1 AND user_id = $2 AND is_reply = true
    `;
    await db.query(deleteCommentQuery, [commentId, userId]);

    const decrementCommentCountQuery = `
      UPDATE post 
      SET comment_count = comment_count - 1 
      WHERE id = $1
    `;
    await db.query(decrementCommentCountQuery, [postId]);

    await db.query('COMMIT');

    res.status(200).json({ message: 'Reply and associated likes/dislikes deleted successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error deleting reply:', error);
    res.status(500).json({ message: 'Error deleting reply' });
  }
});


app.put('/:userId/edit-comment/:commentId', async (req, res) => {
  const {userId , commentId} = req.params ;
  const { content } = req.body;

  if (!userId || !commentId || !content) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
 

    const editCommentQuery = `
      update comments set content = $1  where id = $2 and user_id = $3 ;
    `;
    await db.query(editCommentQuery, [
      content,
      commentId,
      userId,
    ]);

    res.status(201).json({ message: 'Comment updated successfully'});
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Error updating comment' });
  }
});


app.get('/post/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const queryText = `
      SELECT p.*, u.username, u.firstname, u.lastname , u.profile_pic
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


  try {
    const result = await db.query(`
      SELECT p.*, 
             u.firstname AS "poster_firstname",
             u.lastname AS "poster_lastname",
             u.username AS "poster_username",
             u.profile_pic AS "poster_profile_pic",
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
  const keyword = req.query.keyword || '';       
  const offset = (page - 1) * limit;             


  try {
    const result = await db.query(`
      SELECT p.*, 
             u.firstname AS "poster_firstname",
             u.lastname AS "poster_lastname",
             u.username AS "poster_username",
             u.profile_pic AS "poster_profile_pic",
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
              u.profile_pic AS "poster_profile_pic",
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


    const result = await db.query(query, queryParams);


    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error filtering saved posts:', error);
    res.status(500).json({ message: 'Error filtering saved posts' });
  }
});


app.get('/:userId/collections', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      `SELECT collection
       FROM (
         SELECT DISTINCT ON (collection) collection, id
         FROM saves
         WHERE user_id = $1 AND collection IS NOT NULL
         ORDER BY collection, id DESC
       ) subquery
       ORDER BY CASE WHEN collection = 'no collection' THEN 0 ELSE 1 END, collection ASC`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'No collections found for this user.' });
    }

    res.json(result.rows.map(row => row.collection));

  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
});


app.get('/:userId/collection/posts/:collectionName', async (req, res) => {
  const { userId, collectionName } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;


  try {
    const result = await db.query(`
      SELECT p.*, 
             u.firstname AS "poster_firstname",
             u.lastname AS "poster_lastname",
             u.username AS "poster_username",
              u.profile_pic AS "poster_profile_pic",
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
      AND s.collection = $2
      ORDER BY s.saved_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, collectionName, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while fetching saved posts by collection' });
  }
});


app.get('/:userId/snippets', async (req, res) => {
  try {
    const userId=req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT id, title, content, language,is_posted, created_at, modified_at
      FROM snippet
      where user_id=$3
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset,userId]);

    const countResult = await db.query('SELECT COUNT(*) FROM snippet');
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      totalPages,
      snippets: result.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


app.delete('/:userId/delete/snippet/:snippetId',async (req,res)=>
{
  const snippetId=req.params.snippetId;
  const userId=req.params.userId;

  try{
    await db.query('DELETE FROM snippet WHERE id=$1 AND user_id=$2',[snippetId,userId]);
    res.status(200).json({message:'Snippet deleted successfully'});
  }
  catch(err)
  {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
  
})


app.put('/:userId/edit/snippet/:snippetId', async (req, res) => {
  const snippetId = req.params.snippetId;
  const userId = req.params.userId;
  const { title, content, language } = req.body;
  
  try {

    if(!title || !content || !language || !title.trim() || !content.trim() || !language.trim()) throw new Error('Please provide all the required fields');
    // Update snippet in the database
    await db.query(
      'UPDATE snippet SET title = $1, content = $2, language = $3, modified_at = NOW() WHERE id = $4 AND user_id = $5',
      [title, content, language, snippetId, userId]
    );

    res.status(200).json({ message: 'Snippet Updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


app.post('/:userId/add/snippet', async (req, res) => {
  const userId = req.params.userId;
  const { title, content, language } = req.body;

  try {
    
    if(!title || !content || !language || !title.trim() || !content.trim() || !language.trim()) throw new Error('Please provide all the required fields');

    // Add snippet to the database
    await db.query(
      'INSERT INTO snippet (title, content, language, user_id) VALUES ($1 ,$2 ,$3 , $4);',
      [title, content, language, userId]
    );

    res.status(200).json({ message: 'Snippet Added successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


app.post('/:userId/add/post/:snippetId', async (req, res) => {
  const userId = req.params.userId;
  const snippetId = req.params.snippetId;
  const { title, content, language, description, gitHubLink } = req.body;

  try {
    if (!title || !content || !language || !title.trim() || !content.trim() || !language.trim()) {
      throw new Error('Please provide all the required fields');
    }

    await db.query('BEGIN');

    const result = await db.query(
      `INSERT INTO post (title, snippet, language, poster_id, description, github_link) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, title, snippet, language, description, github_link, posted_at;`,
      [title, content, language, userId, description, gitHubLink]
    );

    const newPost = result.rows[0];

    await db.query('UPDATE snippet SET is_posted = true WHERE id = $1;', [snippetId]);

    await db.query('UPDATE users SET posts_count = posts_count + 1, credit = credit + 20 WHERE id = $1',[userId])

    await addPostToAlgolia(newPost);

    await db.query('COMMIT'); 

    res.status(200).json({ message: 'Post uploaded successfully', post: newPost });
  } catch (err) {
    await db.query('ROLLBACK'); 
    console.error(err.stack);
    res.status(500).json({ error: 'Server error' });
  } 
});


app.post('/:userId/add-post/', async (req, res) => {
  const userId = req.params.userId;
  const { title, content, language, description, gitHubLink } = req.body;

  try {
    if (!title || !content || !language || !title.trim() || !content.trim() || !language.trim()) {
      throw new Error('Please provide all the required fields');
    }


    const result = await db.query(
      `
      WITH inserted_post AS (
        INSERT INTO post (title, snippet, language, poster_id, description, github_link)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, title, snippet, language, description, github_link, posted_at
      ),
      update_user AS (
        UPDATE users
        SET posts_count = posts_count + 1, credit = credit + 20
        WHERE id = $4
      )
      SELECT * FROM inserted_post;
      `,
      [title, content, language, userId, description, gitHubLink]
    );

    const newPost = result.rows[0];  

    await addPostToAlgolia(newPost);

    res.status(200).json({ message: 'Post uploaded and posts count updated successfully', post: newPost });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/sync-posts', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, snippet, language, description, github_link, posted_at FROM post order by id`
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'No posts found in the database' });
    }

    for (const post of rows) {
      await addPostToAlgolia(post);
      console.log(`Successfully uploaded post with ID ${post.id} to Algolia.`);
    }

    res.status(200).json({ message: 'All posts have been synchronized and uploaded to Algolia' });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/sync-users', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, username, firstname, lastname, profile_pic  , created_at FROM users ORDER BY id`
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'No users found in the database' });
    }

    for (const user of rows) {
     
      await addUserToAlgolia(user);
      console.log(`Successfully uploaded user with ID ${user.id} to Algolia.`);
    }

    res.status(200).json({ message: 'All users have been synchronized and uploaded to Algolia' });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});



app.put('/:userId/edit-post/:postId', async (req, res) => {
  const userId = req.params.userId;
  const postId = req.params.postId;
  const { title, content, language, description, gitHubLink } = req.body;

  try {
    if (!title || !content || !language || !title.trim() || !content.trim() || !language.trim()) {
      throw new Error('Please provide all the required fields');
    }

    await db.query('BEGIN');
    
    const result = await db.query(
      `
      UPDATE post  
      SET title = $1, snippet = $2, language = $3, description = $4, github_link = $5
      WHERE id = $6 AND poster_id = $7
      RETURNING id, title, snippet, language, description, github_link, posted_at
      `,
      [title, content, language, description, gitHubLink, postId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Post not found or you do not have permission to edit it.');
    }

    const updatedPost = result.rows[0];

    await updatePostInAlgolia(updatedPost);

    await db.query('COMMIT');

    res.status(200).json({ message: 'Post updated successfully', post: updatedPost });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});


app.delete('/:userId/delete-post/:postId', async (req, res) => {
  const postId = req.params.postId;
  const userId = req.params.userId;

  try {
    await db.query('BEGIN');

    // Step 1: Check if the post exists and belongs to the user
    const deleteResult = await db.query(
      'DELETE FROM post WHERE id = $1 AND poster_id = $2 RETURNING id',
      [postId, userId]
    );

    if (deleteResult.rowCount === 0) {
      throw new Error('Post not found or unauthorized action');
    }

    // Step 2: Delete all comments related to the post and their likes/dislikes
    await db.query(
      `DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
      [postId]
    );

    await db.query(
      `DELETE FROM comment_dislikes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
      [postId]
    );

    await db.query('DELETE FROM comments WHERE post_id = $1', [postId]);

    const { rows: likes } = await db.query(
      'SELECT COUNT(*) AS like_count FROM likes WHERE post_id = $1',
      [postId]
    );
    const { rows: dislikes } = await db.query(
      'SELECT COUNT(*) AS dislike_count FROM dislikes WHERE post_id = $1',
      [postId]
    );

    const likeCount = parseInt(likes[0].like_count, 10);
    const dislikeCount = parseInt(dislikes[0].dislike_count, 10);

    await db.query('DELETE FROM likes WHERE post_id = $1', [postId]);
    await db.query('DELETE FROM dislikes WHERE post_id = $1', [postId]);

    await db.query('DELETE FROM saves WHERE post_id = $1', [postId]);

    const creditAdjustment = -20 - likeCount * 3 + dislikeCount;
    await db.query(
      'UPDATE users SET posts_count = posts_count - 1, credit = credit + $1 WHERE id = $2',
      [creditAdjustment, userId]
    );

    await deletePostFromAlgolia(postId);

    await db.query('COMMIT');

    res.status(200).json({ message: 'Post and related data deleted successfully, user stats updated' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get("/profile/:username", async (req, res) => {
        const username = req.params.username;
    const uid = req.query.uid;
  
    if (!uid) {
      return res.status(400).json({ message: "User ID (uid) is required as a query parameter" });
    }
  
    try {
      const userQuery = `
        SELECT id, firstname, lastname, username, email, created_at, profile_pic, subs_count, posts_count, credit 
        FROM users 
        WHERE username = $1
      `;
      const user = await db.query(userQuery, [username]);
  
      if (user.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const profile = user.rows[0]; 
  
      const subscriptionQuery = `
        SELECT * 
        FROM interests 
        WHERE interested_id = $1 AND interesting_id = $2
      `;
      const subscription = await db.query(subscriptionQuery, [uid, profile.id]);
  
      const is_subscribed = subscription.rows.length > 0;
  
      res.status(200).json({
        ...profile,
        is_subscribed,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "An error occurred while fetching the profile" });
    }
  });
  

app.get('/published/posts/:username/', async (req, res) => {
    const { username } = req.params;
    const uid = parseInt(req.query.uid); 
    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 10;  
    const offset = (page - 1) * limit; 
  
    if (!uid) {
      return res.status(400).json({ error: 'Missing logged-in user ID (uid)' });
    }
  
    try {
      const userResult = await db.query(`
        SELECT id FROM users WHERE username = $1
      `, [username]);
  
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const profileUserId = userResult.rows[0].id;
  
      const result = await db.query(`
        SELECT p.*, 
               u.firstname AS "poster_firstname",
               u.lastname AS "poster_lastname",
               u.username AS "poster_username",
                u.profile_pic AS "poster_profile_pic",
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
        LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $1 -- Use logged-in user's ID
        LEFT JOIN dislikes d ON d.post_id = p.id AND d.user_id = $1 -- Use logged-in user's ID
        LEFT JOIN saves s ON s.post_id = p.id AND s.user_id = $1 -- Use logged-in user's ID
        LEFT JOIN interests i ON i.interested_id = $1 AND i.interesting_id = p.poster_id -- Use logged-in user's ID
        WHERE p.poster_id = $2
        ORDER BY p.posted_at DESC
        LIMIT $3 OFFSET $4
      `, [uid, profileUserId, limit, offset]);
  
      const countResult = await db.query(`
        SELECT COUNT(*) FROM post WHERE poster_id = $1
      `, [profileUserId]);
  
      const totalPosts = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalPosts / limit);
  
      res.json({
        totalPages,
        currentPage: page,
        posts: result.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'An error occurred' });
    }
  });
  








//serve
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
