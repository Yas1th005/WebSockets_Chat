const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const socketIo = require('socket.io');
const ObjectId = mongoose.Types.ObjectId;

const User = require('./User');
const Conversation = require('./Conversation');
const Message = require('./Message');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  }
});

// MongoDB connection
mongoose.connect('mongodb+srv://Yaswanth:dOElwEk4mVW953f9@yaswanthcluster.dr5kui4.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"));

let onlineUsers = {};
let showOnline = [];
let unreadMessages = {}; // Format: { userId: { conversationId: count } }

io.on('connection', (socket) => { //WE CAN ADD PARAMETERS TO THE SOCKET TO IDENTIFY A PARTICULAR USER'S SOCKET
  console.log('Socket connected:', socket.id);

  socket.on('join-room', ({ conversationId }) => {
    console.log(`Socket ${socket.id} joining room ${conversationId}`);
    socket.join(conversationId);  //HERE WE ARE JOINING THE SOCKET TO A PARTICULAR ROOM (OR ELSE WE CAN DO SOCKET.USERID TO TELL THAT THIS SOCKET IS OF THIS USER AND SEND THE MESSAGE TO THAT USER)
  });

  socket.on("user-signup", async (new_user) => {
  try {
    const existingUser = await User.findOne({ username: new_user.name });
    if (existingUser) {
      console.log("User already exists");
    } else {
      const lastUser = await User.findOne().sort({ _id: -1 });
      let newUserID = 'user01';

      if (lastUser && lastUser.userid) {
        const lastNum = parseInt(lastUser.userid.replace('user', '')) || 0;
        const nextNum = lastNum + 1;
        newUserID = 'user' + nextNum.toString().padStart(2, '0');
      }

      const newUser = new User({
        username: new_user.name,
        email: new_user.email,
        password: new_user.password,
        userid: newUserID
      });

      await newUser.save();
      console.log("User created");
    }
  } catch (err) {
    console.log("Error in user-signup:", err);
  }
});


  socket.on("user-login", async (new_user) => {
  try {

    const user = await User.findOne({ email: new_user.email });
    console.log(user)
    if (!user) {
      socket.emit("login-failure","User not found");
    } else if (user.password === new_user.password) {
      onlineUsers[user._id] = socket.id;
      socket._id = user._id;
      
      // Send unread message counts
      socket.emit("unread-counts", unreadMessages[user._id] || {});
      
      socket.emit("login-success", user);
    } else {
      socket.emit("login-failure","Incorrect Password");
    }
  } catch (err) {
    console.log("Error in user-login:", err);
  }
});

  socket.on("first-start", async ({senderId,userId}) => {
  try {
    const user = await User.findOne({ userid: userId });
    if (!user) {
      socket.emit("no-user","User not found");
    } else {
      // socket.emit("start-chat", {senderId: senderId._id,receiverId: user._id.toString()});

      socket.emit("receiver-id",(user._id.toString()));
    }
  } catch (err) {
    console.log("Error in user-login:", err);
  }
});

socket.on("get-contacts", async ({ userId }) => {
  try {
    const objectId = new ObjectId(userId);
    const conversations = await Conversation.find({ participants: objectId });
    if (!conversations.length) {
      socket.emit("no-conversations", "No conversations found for this user");
      return;
    }

    // Prepare list of { convoId, otherUserId }
    const contacts = conversations.map((convo) => {
      const otherUserId = convo.participants.find(id => id.toString() !== userId);
      return {
        convoId: convo._id,
        otherUserId,
        };
      });

        socket.emit("receiver-contacts", contacts);
      } catch (err) {
        console.log("Error in get-contacts:", err);
        socket.emit("error", "Failed to fetch conversations");
      }
    });

  socket.on('user-online', (userId) => {
    onlineUsers[userId] = socket.id;
    showOnline.push(userId);
    socket.userId = userId;
    io.emit("show-online",showOnline);
  });

  // socket.on("get-userName",async (userId)=>{
  //   const objectId = new ObjectId(userId.userId);
  //   const user = await User.findById(objectId);
  //   socket.emit("receiver-userName", user.username);
  // })

  socket.on("get-userName", async (userId) => {
    try {
      const objectId = new ObjectId(userId.userId);
      const user = await User.findById(objectId); // or findById if you're using _id
      socket.emit("receiver-userName", {
        userId,
        name: user ? user.username : "Unknown",
      });
    } catch (err) {
      socket.emit("receiver-userName", {
        userId,
        name: "Unknown",
      });
    }
  });

  
  socket.on('start-chat', async ({ senderId, receiverId }) => {
    let convo = await Conversation.findOne({ participants: { $all: [senderId, receiverId] } });
    if (!convo) {
      convo = new Conversation({ participants: [senderId, receiverId] });
      await convo.save();
    }

    socket.join(convo._id.toString());
    socket.emit('chat-started', convo._id.toString());
  });


  socket.on("get-messages",async (convoId)=>{
    let messages = await Message.find({conversationId:new ObjectId(convoId.conversationId)});
    socket.emit("messages-history",(messages))
  })

  socket.on('send-message', async ({ conversationId, senderId, content }) => {
    try {
      const message = new Message({ 
        conversationId: new ObjectId(conversationId), 
        sender: senderId, 
        content 
      });
      
      await message.save();
      
      // Important: emit to the conversation room
      io.to(conversationId).emit('receive-message', {
        _id: message._id,
        sender: senderId, // Make sure field names match
        content,
        createdAt: message.createdAt,
        isRead: false
      });

      // Get conversation to find recipient
      const convo = await Conversation.findById(conversationId);
      if (convo) {
        const recipientId = convo.participants.find(id => id.toString() !== senderId);
        
        // Increment unread count for recipient
        if (!unreadMessages[recipientId]) {
          unreadMessages[recipientId] = {};
        }
        if (!unreadMessages[recipientId][conversationId]) {
          unreadMessages[recipientId][conversationId] = 0;
        }
        unreadMessages[recipientId][conversationId]++;
        
        // Notify recipient about new message
        if (onlineUsers[recipientId]) {
          io.to(onlineUsers[recipientId]).emit('new-message-alert', { 
            conversationId,
            unreadCount: unreadMessages[recipientId][conversationId]
          });
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });


  socket.on("get-messages", async (convoData) => {
    try {
      const messages = await Message.find({
        conversationId: new ObjectId(convoData.conversationId)
      }).sort({ createdAt: 1 }); // Sort by creation time
      
      socket.emit("messages-history", messages);
    } catch (err) {
      console.error("Error fetching messages:", err);
      socket.emit("messages-history", []);
    }
  });

  socket.on('typing', ({ conversationId, senderId }) => {
    socket.to(conversationId).emit('typing', { senderId });
  });

  socket.on('stop-typing', ({ conversationId, senderId }) => {
    socket.to(conversationId).emit('stop-typing', { senderId });
  });

  socket.on('mark-as-read', async ({ conversationId, userId }) => {
    await Message.updateMany(
      { conversationId, sender: { $ne: userId }, isRead: false },
      { $set: { isRead: true } }
    );
    
    // Reset unread count for this conversation
    if (unreadMessages[userId] && unreadMessages[userId][conversationId]) {
      unreadMessages[userId][conversationId] = 0;
    }
    
    socket.to(conversationId).emit('messages-read', { userId });
  });

  socket.on('disconnect', () => {
    console.log("Socket disconnected:", socket.id);
    delete onlineUsers[socket.userId];
    showOnline.splice(showOnline.indexOf(socket.userId),1)
    io.emit("show-online",showOnline);
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});

















// const express = require('express');
// const mongoose = require('mongoose');
// const User = require('./backend/User'); // Import the model
// const app = express();

// app.use(express.json()); // Middleware to parse JSON

// const connectDB = async () => {
//   try {
//     await mongoose.connect('mongodb://127.0.0.1:27017/chat_app', {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('MongoDB connected successfully');
//   } catch (err) {
//     console.error('MongoDB connection error:', err);
//     process.exit(1);
//   }
// };

// connectDB();


// // Signup Route with auto-generated userID
// app.post('/signup', async (req, res) => {
//   try {
//     const { name, email, pswd } = req.body;

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ error: 'User already exists' });
//     }

//     // Get last user and extract numeric ID
    // const lastUser = await User.findOne().sort({ _id: -1 });
    // let newUserID = 'user01'; // default if no users

    // if (lastUser && lastUser.userID) {
    //   const lastNum = parseInt(lastUser.userID.replace('user', '')) || 0;
    //   const nextNum = lastNum + 1;
    //   newUserID = 'user' + nextNum.toString().padStart(2, '0');
    // }

    // // Create and save user
    // const newUser = new User({ name, email, pswd, userID: newUserID });
    // await newUser.save();

//     res.status(201).json({ message: 'User registered successfully', user: { name, email, userID: newUserID } });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Signup failed' });
//   }
// });


// // Login Route
// app.post('/login', async (req, res) => {
//   try {
//     const { email, pswd } = req.body;

//     const user = await User.findOne({ email });
//     if (!user || user.pswd !== pswd) {
//       return res.status(401).json({ error: 'Invalid email or password' });
//     }

//     res.status(200).json({ message: 'Login successful', user: { name: user.name, email: user.email, userID: user.userID } });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Login failed' });
//   }
// });

// app.get('/', (req, res) => {
//   res.send('MongoDB Connection Successful!');
// });

// app.listen(5000, () => {
//   console.log('Server is running on port 5000');
// });
