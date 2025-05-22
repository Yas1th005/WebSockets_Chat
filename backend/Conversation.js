const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);




// const mongoose = require('mongoose');

// const conversationSchema = new mongoose.Schema({
//   participants: [
//     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
//   ],
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model('Conversation', conversationSchema);
