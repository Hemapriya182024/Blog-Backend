const express = require('express');
const bcrypt = require('bcrypt'); 
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./Models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Initialize Express app
const app = express();
const secret = process.env.SECRET_KEY;

// Middleware to parse JSON data and enable CORS
const corsOptions = {
  exposedHeaders: ['Authorization'], // Allow Authorization header to be visible to the frontend
};
app.use(express.json());
app.use(cors(corsOptions));

const DB_URI = process.env.DB_URI;
mongoose.connect(DB_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((error) => console.error('Failed to connect to MongoDB:', error));

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
        .header('Authorization', `Bearer ${token}`) // Set the token in the Authorization header
        .status(200)
        .json({ 
          token, // Send token in response body for easier access
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



// Set the port where the server will listen
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
