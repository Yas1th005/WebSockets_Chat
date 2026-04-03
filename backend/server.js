const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootEnvLocalPath = path.resolve(__dirname, '../.env.local');
const rootEnvPath = path.resolve(__dirname, '../.env');
const backendEnvPath = path.resolve(__dirname, '.env');

if (fs.existsSync(rootEnvLocalPath)) {
  dotenv.config({ path: rootEnvLocalPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const USERS_TABLE = process.env.SUPABASE_USERS_TABLE || 'users';
const CONVERSATIONS_TABLE = process.env.SUPABASE_CONVERSATIONS_TABLE || 'conversations';
const MESSAGES_TABLE = process.env.SUPABASE_MESSAGES_TABLE || 'messages';
const PORT = Number(process.env.PORT) || 5000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

let onlineUsers = {};
let showOnline = [];
let unreadMessages = {}; // Format: { userId: { conversationId: count } }

const safeStr = (value) => String(value || '').trim();

const findUserByIdentifier = async (identifier) => {
  const lookup = safeStr(identifier);
  if (!lookup) {
    return null;
  }

  const { data: users, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .or(`userid.eq.${lookup},email.eq.${lookup},username.eq.${lookup}`)
    .limit(1);

  if (error || !users || users.length === 0) {
    return null;
  }

  return mapUserRow(users[0]);
};

const getLatestMessageByConversationId = async (conversationId) => {
  const { data: rows, error } = await supabase
    .from(MESSAGES_TABLE)
    .select('content,created_at,sender')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !rows || rows.length === 0) {
    return null;
  }

  return rows[0];
};

const mapUserRow = (row) => ({
  _id: row.id,
  username: row.username,
  email: row.email,
  password: row.password,
  userid: row.userid,
});

const mapMessageRow = (row) => ({
  _id: row.id,
  conversationId: row.conversation_id,
  sender: row.sender,
  content: row.content,
  createdAt: row.created_at,
  isRead: row.is_read,
});

const getNextUserId = async () => {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('userid')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0 || !data[0].userid) {
    return 'user01';
  }

  const lastNum = parseInt(String(data[0].userid).replace('user', ''), 10) || 0;
  return `user${String(lastNum + 1).padStart(2, '0')}`;
};

const getConversationByParticipants = async (senderId, receiverId) => {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select('*')
    .contains('participants', [senderId, receiverId])
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-room', ({ conversationId }) => {
    console.log(`Socket ${socket.id} joining room ${conversationId}`);
    socket.join(conversationId);
  });

  socket.on('user-signup', async (new_user) => {
    try {
      if (!safeStr(new_user?.name) || !safeStr(new_user?.email) || !safeStr(new_user?.password)) {
        socket.emit('signup-failure', 'Name, email and password are required');
        return;
      }

      const { data: existingUsers, error: existingUserError } = await supabase
        .from(USERS_TABLE)
        .select('id')
        .or(`username.eq.${safeStr(new_user.name)},email.eq.${safeStr(new_user.email)}`)
        .limit(1);

      if (existingUserError) {
        console.error('Error checking existing user:', existingUserError.message);
        return;
      }

      if (existingUsers && existingUsers.length > 0) {
        socket.emit('signup-failure', 'User with this email or name already exists');
        return;
      }

      const newUserID = await getNextUserId();

      const { error: insertError } = await supabase
        .from(USERS_TABLE)
        .insert({
          username: new_user.name,
          email: new_user.email,
          password: new_user.password,
          userid: newUserID,
        });

      if (insertError) {
        console.error('Error creating user:', insertError.message);
        socket.emit('signup-failure', 'Failed to create account');
        return;
      }

      console.log('User created');
      socket.emit('signup-success', 'Account created successfully');
    } catch (err) {
      console.log('Error in user-signup:', err);
      socket.emit('signup-failure', 'Failed to create account');
    }
  });

  socket.on('user-login', async (new_user) => {
    try {
      const { data: users, error } = await supabase
        .from(USERS_TABLE)
        .select('*')
        .eq('email', new_user.email)
        .limit(1);

      if (error) {
        console.error('Error in user-login:', error.message);
        socket.emit('login-failure', 'Login failed');
        return;
      }

      const user = users && users.length > 0 ? mapUserRow(users[0]) : null;

      if (!user) {
        socket.emit('login-failure', 'User not found');
      } else if (user.password === new_user.password) {
        onlineUsers[user._id] = socket.id;
        socket.userId = user._id;

        socket.emit('unread-counts', unreadMessages[user._id] || {});
        socket.emit('login-success', user);
      } else {
        socket.emit('login-failure', 'Incorrect Password');
      }
    } catch (err) {
      console.log('Error in user-login:', err);
      socket.emit('login-failure', 'Login failed');
    }
  });

  socket.on('first-start', async ({ userId, requesterId }) => {
    try {
      const user = await findUserByIdentifier(userId);

      if (!user) {
        socket.emit('no-user', 'User not found');
      } else if (requesterId && user._id === requesterId) {
        socket.emit('no-user', 'You cannot start a chat with yourself');
      } else {
        socket.emit('receiver-id', user._id);
      }
    } catch (err) {
      console.log('Error in first-start:', err);
      socket.emit('no-user', 'User not found');
    }
  });

  socket.on('get-contacts', async ({ userId }) => {
    try {
      const { data: conversations, error } = await supabase
        .from(CONVERSATIONS_TABLE)
        .select('*')
        .contains('participants', [userId]);

      if (error) {
        console.log('Error in get-contacts:', error.message);
        socket.emit('error', 'Failed to fetch conversations');
        return;
      }

      if (!conversations || conversations.length === 0) {
        socket.emit('no-conversations', 'No conversations found for this user');
        return;
      }

      const contacts = await Promise.all(conversations.map(async (convo) => {
        const otherUserId = (convo.participants || []).find((id) => id !== userId);
        let otherName = 'Unknown';

        if (otherUserId) {
          const { data: users } = await supabase
            .from(USERS_TABLE)
            .select('username')
            .eq('id', otherUserId)
            .limit(1);

          if (users && users.length > 0) {
            otherName = users[0].username;
          }
        }

        const lastMessage = await getLatestMessageByConversationId(convo.id);

        return {
          convoId: convo.id,
          otherUserId,
          otherName,
          unreadCount: unreadMessages[userId]?.[convo.id] || 0,
          lastMessage: lastMessage?.content || '',
          lastMessageAt: lastMessage?.created_at || convo.created_at || null,
          lastMessageSender: lastMessage?.sender || null,
        };
      }));

      socket.emit('receiver-contacts', contacts);
    } catch (err) {
      console.log('Error in get-contacts:', err);
      socket.emit('error', 'Failed to fetch conversations');
    }
  });

  socket.on('user-online', (userId) => {
    onlineUsers[userId] = socket.id;
    if (!showOnline.includes(userId)) {
      showOnline.push(userId);
    }
    socket.userId = userId;
    io.emit('show-online', showOnline);
  });

  socket.on('get-userName', async (userId) => {
    try {
      const { data: users, error } = await supabase
        .from(USERS_TABLE)
        .select('username')
        .eq('id', userId.userId)
        .limit(1);

      if (error || !users || users.length === 0) {
        socket.emit('receiver-userName', {
          userId,
          name: 'Unknown',
        });
        return;
      }

      socket.emit('receiver-userName', {
        userId,
        name: users[0].username,
      });
    } catch (err) {
      socket.emit('receiver-userName', {
        userId,
        name: 'Unknown',
      });
    }
  });

  socket.on('start-chat', async ({ senderId, receiverId }) => {
    try {
      let convo = await getConversationByParticipants(senderId, receiverId);

      if (!convo) {
        const { data: insertedRows, error: insertError } = await supabase
          .from(CONVERSATIONS_TABLE)
          .insert({ participants: [senderId, receiverId] })
          .select()
          .limit(1);

        if (insertError || !insertedRows || insertedRows.length === 0) {
          console.error('Error creating conversation:', insertError?.message || 'No conversation row returned');
          return;
        }

        convo = insertedRows[0];
      }

      socket.join(convo.id);
      socket.emit('chat-started', convo.id);
    } catch (err) {
      console.error('Error in start-chat:', err);
    }
  });

  socket.on('get-messages', async (convoData) => {
    try {
      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .select('*')
        .eq('conversation_id', convoData.conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error.message);
        socket.emit('messages-history', []);
        return;
      }

      socket.emit('messages-history', data.map(mapMessageRow));
    } catch (err) {
      console.error('Error fetching messages:', err);
      socket.emit('messages-history', []);
    }
  });

  socket.on('send-message', async ({ conversationId, senderId, content }) => {
    try {
      const { data: insertedRows, error: insertError } = await supabase
        .from(MESSAGES_TABLE)
        .insert({
          conversation_id: conversationId,
          sender: senderId,
          content,
          is_read: false,
        })
        .select()
        .limit(1);

      if (insertError || !insertedRows || insertedRows.length === 0) {
        console.error('Error saving message:', insertError?.message || 'No row returned from Supabase');
        return;
      }

      const message = mapMessageRow(insertedRows[0]);

      io.to(conversationId).emit('receive-message', {
        _id: message._id,
        conversationId,
        sender: senderId,
        content,
        createdAt: message.createdAt,
        isRead: false,
      });

      const { data: convoRows, error: convoError } = await supabase
        .from(CONVERSATIONS_TABLE)
        .select('participants')
        .eq('id', conversationId)
        .limit(1);

      if (convoError || !convoRows || convoRows.length === 0) {
        return;
      }

      const participants = convoRows[0].participants || [];
      const recipientId = participants.find((id) => id !== senderId);

      if (!recipientId) {
        return;
      }

      if (!unreadMessages[recipientId]) {
        unreadMessages[recipientId] = {};
      }
      if (!unreadMessages[recipientId][conversationId]) {
        unreadMessages[recipientId][conversationId] = 0;
      }
      unreadMessages[recipientId][conversationId]++;

      if (onlineUsers[recipientId]) {
        io.to(onlineUsers[recipientId]).emit('new-message-alert', {
          conversationId,
          unreadCount: unreadMessages[recipientId][conversationId],
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('typing', ({ conversationId, senderId }) => {
    socket.to(conversationId).emit('typing', { senderId });
  });

  socket.on('user-offline', (userId) => {
    delete onlineUsers[userId];

    const idx = showOnline.indexOf(userId);
    if (idx !== -1) {
      showOnline.splice(idx, 1);
    }

    io.emit('show-online', showOnline);
  });

  socket.on('stop-typing', ({ conversationId, senderId }) => {
    socket.to(conversationId).emit('stop-typing', { senderId });
  });

  socket.on('mark-as-read', async ({ conversationId, userId }) => {
    const { error } = await supabase
      .from(MESSAGES_TABLE)
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error.message);
    }

    if (unreadMessages[userId] && unreadMessages[userId][conversationId]) {
      unreadMessages[userId][conversationId] = 0;
    }

    socket.to(conversationId).emit('messages-read', { userId });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    delete onlineUsers[socket.userId];

    const idx = showOnline.indexOf(socket.userId);
    if (idx !== -1) {
      showOnline.splice(idx, 1);
    }

    io.emit('show-online', showOnline);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
