const express = require('express');
const bcrypt = require('bcrypt'); 
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./Models/User');
const Post = require('./Models/Post');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');

// Initialize Express app
const app = express();
const secret = process.env.SECRET_KEY;

// Middleware to parse JSON data and enable CORS
const corsOptions = {
  origin: 'https://blog-frontend-kappa-one.vercel.app', 
  exposedHeaders: ['Authorization'], 
  credentials: true,
};
app.use(express.json());
app.use(cors(corsOptions));
app.use('/uploads', express.static('uploads'));

const DB_URI = process.env.DB_URI;
mongoose.connect(DB_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((error) => console.error('Failed to connect to MongoDB:', error));


app.get('/' ,(req,res)=>{
  res.json({
    message:"Api is working"
  })

})
// Register route to create a new user
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const userDoc = await User.create({ username, password: hashedPassword });
    res.status(200).json({ username: userDoc.username, id: userDoc._id });
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Login route to authenticate the user
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const userDoc = await User.findOne({ username });
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordMatch = await bcrypt.compare(password, userDoc.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) {
        throw err;
      }

      res
        .header('Authorization', `Bearer ${token}`) 
        .status(200)
        .json({ 
          token,
          message: 'Login successful', 
          username: userDoc.username, 
          id: userDoc._id 
        });
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: error.message });
  }
});
// Profile route to get user details using the token
app.get('/profile', (req, res) => {
  try {
    const authHeader = req.headers['authorization']; // Get the Authorization header
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1]; // Extract the token from the Bearer scheme
    if (!token) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
      }

      // If token is valid, send back user details
      res.status(200).json({ message: 'Profile fetched successfully', user: decoded });
    });
  } catch (error) {
    console.error('Error in profile endpoint:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
  const {originalname,path} = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path+'.'+ext;
  fs.renameSync(path, newPath);

  const authHeader = req.headers['authorization']; 
  const token = authHeader.split(' ')[1];

  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover:newPath,
      author:info.id,
    });
    res.json(postDoc);
  });

});

app.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'username') // Populates the author field to include the username
      .sort({ createdAt: -1 }); // Sorts posts by newest first
    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});



app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;

  // Handle file renaming and ensure the file is valid
  if (req.file) {
    const { originalname, path } = req.file;
    const ext = originalname.split('.').pop(); // Get file extension
    newPath = `${path}.${ext}`; // Create new path with extension
    try {
      fs.renameSync(path, newPath); // Rename file with extension
    } catch (error) {
      console.error('Error renaming file:', error);
      return res.status(500).json('Error renaming file');
    }
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json('Authorization header missing');
  }
 
  const token = authHeader.split(' ')[1]; // Extract token from Authorization header
  try {
    const decoded = jwt.verify(token, secret);
    const { id, title, summary, content } = req.body;

    // Find post by ID
    const postDoc = await Post.findById(id);
    if (!postDoc) {
      return res.status(404).json('Post not found');
    }
    console.log(req.headers['authorization']); // Backend: Check if the token is reaching the server
    console.log(token);
    // Check if the logged-in user is the author of the post
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(decoded.id);
    if (!isAuthor) {
      return res.status(400).json('You are not the author');
    }

    // Update post details
    postDoc.set({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover, // Update cover image path if new file is uploaded
    });
    
    await postDoc.save(); // Save the updated post
    res.json(postDoc); // Send updated post details back to the client
  } catch (error) {
    console.error('Error verifying JWT:', error);
    res.status(401).json('Unauthorized');
  }
});

app.get('/post/:id', async (req, res) => {
  try {
    const { id } = req.params; // Extract the id from route params
    const post = await Post.findById(id).populate('author', 'username'); // Find post by id and populate the author field
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' }); // Return 404 if no post found
    }

    res.status(200).json(post); // Send the found post
  } catch (error) {
    console.error('Error fetching post by ID:', error);
    res.status(500).json({ message: 'Failed to fetch post' });
  }
});




// Set the port where the server will listen
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
