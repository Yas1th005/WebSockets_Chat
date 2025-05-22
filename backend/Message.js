const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);




// const mongoose = require('mongoose');

// const messageSchema = new mongoose.Schema({
//   conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
//   sender:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   content:        { type: String },
//   isRead:         { type: Boolean, default: false },
//   createdAt:      { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Message', messageSchema);
