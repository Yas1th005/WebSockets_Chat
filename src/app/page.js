"use client"
import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, MessageCircle, Search, Send, User, Users, Moon, Menu, X, LogOut, Settings, HelpCircle, Plus, UserPlus } from 'lucide-react';
import socket from "@/utils/Socket";

// Initial state
const initialContacts = [];

// User profile data
const userProfile = {
  name: 'Guest User',
  userId: '',
  avatar: null,
};

// Login/Signup Modal Component
const AuthModal = ({ isOpen, onClose, setContacts, setUserId }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  
  if (!isOpen) return null;

  const getUsername = (userId) => {
    return new Promise((resolve) => {
      const handler = ({ userId: returnedId, name }) => {
        if (returnedId.userId === userId) {
          resolve(name);
          socket.off("receiver-userName", handler);
        }
      };

      socket.on("receiver-userName", handler);
      socket.emit("get-userName", { userId: userId });
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      // Login logic
      socket.emit("user-login", { email, password });
      
      // Cleanup existing listeners before adding new ones
      socket.off("login-success");
      socket.off("login-failure");
      socket.off("receiver-contacts");
      
      socket.on("login-success", (user) => {
        // console.log("Login successful:", user);
        socket.emit("user-online", user._id);
        setUserId(user);
        userProfile.name = user.username;
        userProfile.userId = user.email;
        
        socket.emit("get-contacts", { userId: user._id });
        
        socket.on("receiver-contacts", async (convos) => {
          if (!Array.isArray(convos)) {
            // console.error("convos is not an array:", convos);
            return;
          }

          const contactsWithNames = await Promise.all(
            convos.map(async (convo, ind) => {
              const name = await getUsername(convo.otherUserId);
              return {
                id: ind + 1,
                convo_id: convo.convoId,
                other_id: convo.otherUserId,
                other_name: name,
              };
            })
          );

          setContacts(contactsWithNames);
        });

        onClose();
      });
      
      socket.on("login-failure", (msg) => {
        setError(msg);
      });
    } else {
      // Signup logic
      if (!name.trim()) {
        setError('Name is required');
        return;
      }
      
      // Add new user
      const newUser = { name, email, password };
      socket.emit("user-signup", newUser);

      // Set this user as current user
      userProfile.name = name;
      userProfile.userId = email;

      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{isLogin ? 'Login' : 'Sign Up'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-800 text-red-300 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700 transition-colors"
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 hover:text-blue-300"
          >
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Member Modal Component
const AddMemberModal = ({ isOpen, onClose, contacts, setContacts, senderId }) => {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!userId.trim()) {
      setError('User ID is required');
      return;
    }

    // Clean up existing listeners before adding new ones
    socket.off("receiver-id");
    socket.off("chat-started");
    socket.off("receiver-userName");
    socket.off("no-user");

    socket.emit("first-start", { senderId, userId });
    
    socket.on("receiver-id", (rec_id) => {
      socket.emit("start-chat", { senderId: senderId._id, receiverId: rec_id });
      
      socket.on("chat-started", (convoId) => {
        socket.emit("get-userName", { userId: rec_id });
        
        socket.once("receiver-userName", (name) => {
          const newContact = {
            id: contacts.length + 1,
            convo_id: convoId,
            other_id: rec_id,
            other_name: name.name,
          };

          setContacts([...contacts, newContact]);
        });
      });
    });
    
    socket.on("no-user", (msg) => {
      setError(msg);
    });

    setUserId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Add New Contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-800 text-red-300 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">User ID or Email</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter user ID or email"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700 transition-colors"
          >
            Add Contact
          </button>
        </form>
      </div>
    </div>
  );
};

// Profile Dropdown Component
const ProfileDropdown = ({ isOpen, onClose, profile }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-14 right-4 w-60 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50 animate-fadeIn">
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-lg font-medium text-white">{profile.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{profile.name}</p>
            <p className="text-sm text-gray-400 truncate">{profile.userId}</p>
          </div>
        </div>
      </div>
      
      <div className="py-1">
        <button className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-3">
          <User size={16} />
          <span>My Profile</span>
        </button>
        <button className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-3">
          <Settings size={16} />
          <span>Settings</span>
        </button>
        <button className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-3">
          <HelpCircle size={16} />
          <span>Help & Support</span>
        </button>
      </div>
      
      <div className="pt-1 border-t border-gray-700">
        <button className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center space-x-3">
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

// Toast notification component
const Toast = ({ message, onClose, onClick }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div 
      className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 z-50 cursor-pointer hover:bg-gray-700"
      style={{
        animation: 'slideUp 0.3s ease-out forwards'
      }}
      onClick={onClick}
    >
      <Bell size={18} className="text-blue-400" />
      <div>
        <p className="font-medium">{message.title}</p>
        <p className="text-sm text-gray-300">{message.body}</p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }} 
        className="ml-4 text-gray-400 hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  );
};

// Main ChatApp component
const ChatApp = () => {
  const [contacts, setContacts] = useState(initialContacts);
  const [activeContact, setActiveContact] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(contacts.length === 0);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const profileDropdownRef = useRef(null);
  const [userId, setUserId] = useState("");
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingSender, setTypingSender] = useState(null);
  const [conversationId, setConversationId] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownRef]);


  // Effect to scroll to bottom of messages when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingSender]);


  // Handle clicking on a contact
  const handleContactClick = (contact) => {
    setActiveContact(contact);
    setConversationId(contact.convo_id);
    
    // Mark messages as read when opening conversation
    socket.emit('mark-as-read', { conversationId: contact.convo_id, userId: userId._id });
    
    // Clear unread count for this conversation
    setUnreadCounts(prev => ({
      ...prev,
      [contact.convo_id]: 0
    }));
    
    // Clear previous messages when changing contacts
    setMessages([]);
    
    // IMPORTANT: Join the conversation room
    socket.emit("join-room", { conversationId: contact.convo_id });
    
    // Then fetch messages for this conversation
    socket.emit("get-messages", { conversationId: contact.convo_id });
    
    // Clean up previous listener to avoid duplicate messages
    socket.off("messages-history");
    
    socket.on("messages-history", (messageHistory) => {
      // console.log("Received message history:", messageHistory);
      if (Array.isArray(messageHistory)) {
        setMessages(messageHistory);
      }
    });
    
    setMobileMenuOpen(false);
  };

  // Fix for the useEffect that handles socket events
  useEffect(() => {
    // Make sure socket is defined here
    
    // Setup socket listeners
    socket.on("receive-message", (message) => {
      // console.log("Received message:", message);
      setMessages((prev) => [...prev, message]);
      
      // If this is the active conversation, mark as read
      if (conversationId === message.conversationId && message.sender !== userId._id) {
        socket.emit('mark-as-read', { conversationId, userId: userId._id });
      }
    });
    
    socket.on("typing", ({ senderId }) => {
      setTypingSender(senderId);
    });
    
    socket.on("stop-typing", () => {
      setTypingSender(null);
    });

    socket.on("show-online", (users) => {
      // console.log("Online users:", users);
      setOnlineUsers(users);
    });

    // Listen for new message alerts
    socket.on("new-message-alert", ({ conversationId, unreadCount }) => {
      if (activeContact?.convo_id !== conversationId) {
        setUnreadCounts(prev => ({
          ...prev,
          [conversationId]: unreadCount
        }));
        
        // Find the contact for this conversation
        const contact = contacts.find(c => c.convo_id === conversationId);
        if (contact) {
          // Show toast notification with the contact info
          setToast({
            title: `New message from ${contact.other_name}`,
            body: `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`,
            contactId: contact.id,
            conversationId
          });
        }
      }
    });
    
    // Listen for initial unread counts
    socket.on("unread-counts", (counts) => {
      setUnreadCounts(counts);
    });
    
    return () => {
      socket.off("receive-message");
      socket.off("typing");
      socket.off("stop-typing");
      socket.off("show-online");
      socket.off("new-message-alert");
      socket.off("unread-counts");
      // Don't disconnect the socket here - just remove listeners
    };
  }, [conversationId, activeContact, userId, contacts]);

  // Fix for the sendMessage function
  const sendMessage = () => {
    if (!msg.trim() || !conversationId) return;
    
    // console.log("Sending message:", {
    //   conversationId,
    //   senderId: userId._id,
    //   content: msg,
    // });
    
    socket.emit("send-message", {
      conversationId,
      senderId: userId._id,
      content: msg,
    });
    
    // Add message to local state immediately for better UX

    setMsg("");
    
    if (typing) {
      setTyping(false);
      socket.emit("stop-typing", { conversationId, senderId: userId._id });
    }
  };
  
  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };
  
  // App introduction content
  const IntroContent = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <MessageCircle size={36} className="text-blue-500" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Welcome to NextChat</h1>
      <p className="text-gray-400 max-w-md mb-8">
        A modern, secure messaging platform built with Next.js and Tailwind CSS.
        {contacts.length > 0 ? " Select a conversation from the sidebar to get started." : " Please login to get started."}
      </p>
      {contacts.length === 0 && (
        <button
          onClick={() => setShowAuthModal(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Login / Sign Up
        </button>
      )}
      {contacts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell size={20} className="text-blue-500" />
            </div>
            <h3 className="font-medium text-white">Instant Notifications</h3>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={20} className="text-blue-500" />
            </div>
            <h3 className="font-medium text-white">Group Chats</h3>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <Moon size={20} className="text-blue-500" />
            </div>
            <h3 className="font-medium text-white">Dark Mode</h3>
          </div>
        </div>
      )}
    </div>
  );
  
  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact => 
    contact.other_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Login/Signup Modal */}
      {showAuthModal && (
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
          setContacts={setContacts}
          setUserId={setUserId}
        />
      )}
      
      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal 
          isOpen={showAddMemberModal} 
          onClose={() => setShowAddMemberModal(false)}
          contacts={contacts}
          setContacts={setContacts}
          senderId={userId}
        />
      )}
      
      {/* Sidebar toggle for mobile */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-gray-800 rounded-full"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      
      {/* Contacts sidebar */}
      <div 
        className={`w-full md:w-80 bg-gray-900 flex flex-col border-r border-gray-800 ${
          mobileMenuOpen ? 'fixed inset-0 z-20' : 'hidden md:flex'
        }`}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h1 className="text-xl font-bold">NextChat</h1>
          <div className="flex items-center">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="bg-gray-800 rounded-full p-2 mr-2"
            >
              <Moon size={18} />
            </button>
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={toggleProfileDropdown}
                className="bg-gray-800 rounded-full p-2 hover:bg-gray-700 transition-colors"
              >
                <User size={18} />
              </button>
              <ProfileDropdown 
                isOpen={profileDropdownOpen} 
                onClose={() => setProfileDropdownOpen(false)}
                profile={userProfile}
              />
            </div>
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="bg-gray-800 rounded-full p-6 mb-4">
              <Users size={32} className="text-blue-500" />
            </div>
            <p className="text-center text-gray-400 mb-4">No contacts yet</p>
            <button 
              onClick={() => setShowAuthModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Login to Get Started
            </button>
          </div>
        ) : (
          <>
            <div className="p-4">
              <div className="relative mb-3">
                <input 
                  type="text" 
                  placeholder="Search contacts..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800 rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <Search size={16} className="absolute left-3 top-3 text-gray-500" />
              </div>
              
              {/* Add Member button */}
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="flex items-center justify-center w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2 px-4 transition-colors"
              >
                <UserPlus size={18} className="mr-2" />
                <span>Add New Contact</span>
              </button>
            </div>
            
            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${
                    activeContact?.id === contact.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                        <span className="text-lg font-medium">
                          {contact.other_name.charAt(0)}
                        </span>
                      </div>
                      {onlineUsers.includes(contact.other_id) && (
                        <div className="absolute bottom-0 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <h3 className="font-medium truncate">{contact.other_name}</h3>
                        <div className="flex items-center">
                          {onlineUsers.includes(contact.other_id) && (
                            <span className="text-xs text-green-400 mr-2">online</span>
                          )}
                          {/* Unread message count badge */}
                          {unreadCounts[contact.convo_id] > 0 && (
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {unreadCounts[contact.convo_id]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {activeContact ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-gray-800 flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                <span className="font-medium">{activeContact.other_name.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <h2 className="font-medium">{activeContact.other_name}</h2>
              </div>
            </div>
            
            {/* Messages area */}
            <div className="flex-1 p-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m._id} className={`mb-4 flex ${m.sender === userId._id ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`max-w-[20%] px-4 py-2 rounded-lg shadow ${
                        m.sender === userId._id 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : 'bg-gray-800 text-white rounded-bl-none'
                      }`}
                    >
                      <p className={`text-xs text-gray-300 underline ${m.sender === userId._id ? 'text-right' : 'text-left'}`}>{m.sender === userId._id ? 'You' : activeContact.other_name}</p>
                      <p className={`break-words text-left`}>{m.content}</p>
                      <p className="text-[10px] text-right mt-1 opacity-70">
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'sending...'}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {typingSender && (
                <div className="flex mb-4">
                  <div className="bg-gray-800 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Chat input */}
            <div className="border-t border-gray-800 p-4">
              <div className="flex items-center">
                <input
                  type="text"
                  value={msg}
                  onChange={(e) => {
                    setMsg(e.target.value);
                    if (!typing && e.target.value) {
                      setTyping(true);
                      socket.emit("typing", { conversationId, senderId: userId._id });
                    } else if (typing && !e.target.value) {
                      setTyping(false);
                      socket.emit("stop-typing", { conversationId, senderId: userId._id });
                    }
                  }}
                  onBlur={() => {
                    if (typing) {
                      setTyping(false);
                      socket.emit("stop-typing", { conversationId, senderId: userId._id });
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-grow bg-gray-800 text-white rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={sendMessage}
                  className="ml-2 bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Send size={18} />
                </button>
              </div>
              </div>
          </>
        ) : (
          <IntroContent />
        )}
      </div>
      
      {/* Toast notifications */}
      {toast && (
        <Toast 
          message={toast} 
          onClose={() => setToast(null)} 
          onClick={() => {
            if (toast.contactId) {
              const contact = contacts.find(c => c.id === toast.contactId);
              if (contact) {
                handleContactClick(contact);
                setToast(null);
              }
            }
          }}
        />
      )}
      
      {/* Global styles */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        
        .animate-bounce {
          animation: bounce 1s infinite;
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
      
    </div>
  );
};

export default ChatApp;


