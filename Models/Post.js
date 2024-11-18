const mongoose = require('mongoose');
const { Schema } = mongoose; 

// Define the Post schema
const postSchema = new Schema({
  title: String,
  summary: String,
  content: String,
  cover: String,
  author: { type: Schema.Types.ObjectId, ref: 'User' }, 
}, {
  timestamps: true, 
});

// Create a model for the post
const Post = mongoose.model('Post', postSchema);

module.exports = Post;
