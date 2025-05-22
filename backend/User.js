const mongoose = require('mongoose');
const { unique } = require('next/dist/build/utils');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }, // optional if you're not handling auth now
  userid:{type:String,required:true, unique:true}
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);




// const mongoose = require('mongoose');

// const userSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true },
//   email:    { type: String, required: true, unique: true },
//   password: { type: String, required: true }, // hashed password
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model('User', userSchema);
