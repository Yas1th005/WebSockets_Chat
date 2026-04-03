"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CirclePlus,
  LogOut,
  Menu,
  MessageSquareDot,
  Search,
  Send,
  User,
  UserRoundPlus,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import socket from "@/utils/Socket";

const USER_STORAGE_KEY = "nextchat.user";

const getInitials = (name = "?") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const sortContacts = (items) =>
  [...items].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      socket.off("login-success");
      socket.off("login-failure");
      socket.off("signup-success");
      socket.off("signup-failure");
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      socket.off("login-success");
      socket.off("login-failure");

      socket.once("login-success", (user) => {
        setLoading(false);
        onLoginSuccess(user);
      });

      socket.once("login-failure", (message) => {
        setLoading(false);
        setError(message || "Login failed");
      });

      socket.emit("user-login", { email: email.trim(), password });
      return;
    }

    if (!name.trim()) {
      setLoading(false);
      setError("Name is required");
      return;
    }

    socket.off("signup-success");
    socket.off("signup-failure");

    socket.once("signup-success", (message) => {
      setLoading(false);
      setMode("login");
      setName("");
      setPassword("");
      setError(message || "Account created. Please log in.");
    });

    socket.once("signup-failure", (message) => {
      setLoading(false);
      setError(message || "Signup failed");
    });

    socket.emit("user-signup", { name: name.trim(), email: email.trim(), password });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-[var(--panel-soft)] p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <button
            className="rounded-full p-2 text-white/80 transition hover:bg-white/10"
            onClick={onClose}
            aria-label="Close auth modal"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{error}</p>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <label className="block">
              <span className="mb-1 block text-sm text-white/80">Display name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-2.5 text-white outline-none ring-cyan-400/60 transition focus:ring"
                placeholder="Aster Nova"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-2.5 text-white outline-none ring-cyan-400/60 transition focus:ring"
              placeholder="you@domain.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-white/80">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-2.5 text-white outline-none ring-cyan-400/60 transition focus:ring"
              placeholder="Your secret"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 font-semibold text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={loading}
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-sm text-cyan-200 transition hover:text-cyan-100"
        >
          {mode === "login" ? "New here? Create an account" : "Already a member? Log in"}
        </button>
      </div>
    </div>
  );
}

function AddContactModal({ isOpen, onClose, onAdd, senderId }) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIdentifier("");
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    if (!identifier.trim()) {
      setError("Enter a userid, username or email");
      return;
    }

    setLoading(true);

    socket.off("receiver-id");
    socket.off("no-user");
    socket.off("chat-started");

    socket.once("receiver-id", (receiverId) => {
      socket.emit("start-chat", { senderId, receiverId });
    });

    socket.once("chat-started", (convoId) => {
      setLoading(false);
      onAdd(convoId);
      onClose();
    });

    socket.once("no-user", (message) => {
      setLoading(false);
      setError(message || "User not found");
    });

    socket.emit("first-start", { userId: identifier.trim(), requesterId: senderId });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-[var(--panel-soft)] p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Start a new conversation</h2>
          <button
            className="rounded-full p-2 text-white/80 transition hover:bg-white/10"
            onClick={onClose}
            aria-label="Close add contact modal"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/80">User ID, username or email</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-2.5 text-white outline-none ring-cyan-400/60 transition focus:ring"
              placeholder="user09 or someone@email.com"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-2.5 font-semibold text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={loading}
          >
            {loading ? "Connecting..." : "Create chat"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState("");
  const [searchContacts, setSearchContacts] = useState("");
  const [searchInChat, setSearchInChat] = useState("");
  const [drafts, setDrafts] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [typingSender, setTypingSender] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeConvoRef = useRef("");
  const userRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    activeConvoRef.current = activeConvoId;
  }, [activeConvoId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const upsertContactPreview = useCallback((conversationId, content, createdAt, senderId) => {
    setContacts((prev) => {
      const updated = prev.map((contact) =>
        contact.convoId === conversationId
          ? {
              ...contact,
              lastMessage: content,
              lastMessageAt: createdAt,
              lastMessageSender: senderId,
            }
          : contact,
      );

      return sortContacts(updated);
    });
  }, []);

  const fetchContacts = useCallback(
    (uid, preferredConvoId) => {
      if (!uid) return;

      socket.off("receiver-contacts");
      socket.once("receiver-contacts", (convos) => {
        const normalized = (Array.isArray(convos) ? convos : []).map((convo, index) => ({
          id: convo.convoId || `${index + 1}`,
          convoId: convo.convoId,
          otherId: convo.otherUserId,
          otherName: convo.otherName || "Unknown",
          unreadCount: typeof convo.unreadCount === "number" ? convo.unreadCount : 0,
          lastMessage: convo.lastMessage || "",
          lastMessageAt: convo.lastMessageAt || null,
          lastMessageSender: convo.lastMessageSender || null,
        }));

        const sorted = sortContacts(normalized);
        setContacts(sorted);

        const unreadFromContacts = {};
        normalized.forEach((item) => {
          if (typeof item.unreadCount === "number" && item.unreadCount > 0) {
            unreadFromContacts[item.convoId] = item.unreadCount;
          }
        });

        if (Object.keys(unreadFromContacts).length > 0) {
          setUnreadCounts((prev) => ({ ...prev, ...unreadFromContacts }));
        }

        if (sorted.length === 0) {
          setActiveConvoId("");
          return;
        }

        const target =
          sorted.find((contact) => contact.convoId === preferredConvoId) ||
          sorted.find((contact) => contact.convoId === activeConvoRef.current) ||
          sorted[0];

        setActiveConvoId(target.convoId);
      });

      socket.emit("get-contacts", { userId: uid });
    },
    [],
  );

  useEffect(() => {
    try {
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      if (!cached) {
        setShowAuthModal(true);
        return;
      }

      const parsed = JSON.parse(cached);
      if (!parsed?._id) {
        setShowAuthModal(true);
        return;
      }

      setUser(parsed);
      setShowAuthModal(false);
      socket.emit("user-online", parsed._id);
      fetchContacts(parsed._id);
    } catch {
      setShowAuthModal(true);
    }
  }, [fetchContacts]);

  useEffect(() => {
    setConnectionStatus(socket.connected ? "connected" : "disconnected");

    const handleConnect = () => {
      setConnectionStatus("connected");
      const currentUser = userRef.current;
      if (currentUser?._id) {
        socket.emit("user-online", currentUser._id);
        fetchContacts(currentUser._id, activeConvoRef.current);
      }
    };

    const handleDisconnect = () => setConnectionStatus("disconnected");
    const handleReconnectAttempt = () => setConnectionStatus("reconnecting");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("reconnect_attempt", handleReconnectAttempt);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("reconnect_attempt", handleReconnectAttempt);
    };
  }, [fetchContacts]);

  useEffect(() => {
    const handleHistory = (history) => {
      setMessages(Array.isArray(history) ? history : []);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleIncomingMessage = (message) => {
      const currentUser = userRef.current;
      if (!currentUser?._id) return;

      upsertContactPreview(message.conversationId, message.content, message.createdAt, message.sender);

      if (message.conversationId === activeConvoRef.current) {
        setMessages((prev) => [...prev, message]);
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

        if (message.sender !== currentUser._id) {
          socket.emit("mark-as-read", { conversationId: message.conversationId, userId: currentUser._id });
          setUnreadCounts((prev) => ({ ...prev, [message.conversationId]: 0 }));
        }
      }
    };

    const handleTyping = ({ senderId }) => {
      if (senderId === userRef.current?._id) return;

      setTypingSender(senderId);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setTypingSender(null);
      }, 2200);
    };

    const handleStopTyping = () => setTypingSender(null);

    const handleOnline = (users) => setOnlineUsers(Array.isArray(users) ? users : []);
    const handleUnread = (counts) => setUnreadCounts(counts || {});

    const handleMessageAlert = ({ conversationId, unreadCount }) => {
      if (conversationId === activeConvoRef.current) return;
      setUnreadCounts((prev) => ({ ...prev, [conversationId]: unreadCount }));
    };

    socket.on("messages-history", handleHistory);
    socket.on("receive-message", handleIncomingMessage);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);
    socket.on("show-online", handleOnline);
    socket.on("unread-counts", handleUnread);
    socket.on("new-message-alert", handleMessageAlert);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      socket.off("messages-history", handleHistory);
      socket.off("receive-message", handleIncomingMessage);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
      socket.off("show-online", handleOnline);
      socket.off("unread-counts", handleUnread);
      socket.off("new-message-alert", handleMessageAlert);
    };
  }, [upsertContactPreview]);

  useEffect(() => {
    const currentUser = userRef.current;
    if (!activeConvoId || !currentUser?._id) return;

    socket.emit("join-room", { conversationId: activeConvoId });
    socket.emit("get-messages", { conversationId: activeConvoId });
    socket.emit("mark-as-read", { conversationId: activeConvoId, userId: currentUser._id });
    setUnreadCounts((prev) => ({ ...prev, [activeConvoId]: 0 }));
  }, [activeConvoId]);

  const activeContact = useMemo(
    () => contacts.find((contact) => contact.convoId === activeConvoId) || null,
    [contacts, activeConvoId],
  );

  const filteredContacts = useMemo(() => {
    const query = searchContacts.trim().toLowerCase();
    if (!query) return contacts;

    return contacts.filter((contact) => {
      const haystack = `${contact.otherName} ${contact.otherId || ""} ${contact.lastMessage || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, searchContacts]);

  const filteredMessages = useMemo(() => {
    const query = searchInChat.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => String(message.content || "").toLowerCase().includes(query));
  }, [messages, searchInChat]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
    setShowAuthModal(false);
    socket.emit("user-online", loggedInUser._id);
    fetchContacts(loggedInUser._id);
  };

  const handleLogout = () => {
    if (user?._id) {
      socket.emit("user-offline", user._id);
    }

    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setContacts([]);
    setMessages([]);
    setActiveConvoId("");
    setUnreadCounts({});
    setShowAuthModal(true);
  };

  const handleAddContact = (convoId) => {
    if (!user?._id) return;
    fetchContacts(user._id, convoId);
  };

  const currentDraft = drafts[activeConvoId] || "";

  const setCurrentDraft = (value) => {
    if (!activeConvoId) return;

    setDrafts((prev) => ({ ...prev, [activeConvoId]: value }));

    if (!user?._id) return;

    if (value.trim()) {
      socket.emit("typing", { conversationId: activeConvoId, senderId: user._id });
      return;
    }

    socket.emit("stop-typing", { conversationId: activeConvoId, senderId: user._id });
  };

  const sendMessage = () => {
    if (!activeConvoId || !user?._id || !currentDraft.trim()) return;

    const content = currentDraft.trim();
    socket.emit("send-message", {
      conversationId: activeConvoId,
      senderId: user._id,
      content,
    });

    setDrafts((prev) => ({ ...prev, [activeConvoId]: "" }));
    socket.emit("stop-typing", { conversationId: activeConvoId, senderId: user._id });
  };

  const renderConnectionStatus = () => {
    if (connectionStatus === "connected") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/35 bg-emerald-400/20 px-2 py-1 text-xs text-emerald-100">
          <Wifi size={12} /> Live
        </span>
      );
    }

    if (connectionStatus === "reconnecting") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-amber-300/20 px-2 py-1 text-xs text-amber-100">
          <WifiOff size={12} /> Reconnecting
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/35 bg-rose-400/20 px-2 py-1 text-xs text-rose-100">
        <WifiOff size={12} /> Offline
      </span>
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] text-white">
      <div className="pointer-events-none absolute -left-32 -top-24 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-orange-300/15 blur-3xl" />

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onLoginSuccess={handleLoginSuccess} />
      <AddContactModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddContact}
        senderId={user?._id}
      />

      <div className="relative z-10 mx-auto flex h-screen max-w-[1500px] gap-4 p-3 md:p-6">
        <aside
          className={`absolute inset-y-3 left-3 z-20 w-[86%] max-w-sm rounded-3xl border border-white/15 bg-[var(--panel)] p-4 shadow-2xl shadow-black/35 backdrop-blur transition duration-300 md:static md:w-[360px] ${
            sidebarOpen ? "translate-x-0" : "-translate-x-[110%] md:translate-x-0"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-white">WebChat</h1>
              <p className="text-sm text-white/65">Conversations with momentum</p>
            </div>
            <button className="rounded-full p-2 text-white/80 hover:bg-white/10 md:hidden" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300/30 text-cyan-100">
                {user ? getInitials(user.username) : <User size={14} />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.username || "Guest"}</p>
                <p className="truncate text-xs text-white/60">{user?.email || "Sign in to start"}</p>
              </div>
            </div>
            {renderConnectionStatus()}
          </div>

          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
              <input
                className="w-full rounded-xl border border-white/15 bg-black/25 py-2 pl-9 pr-3 text-sm text-white outline-none ring-cyan-400/50 transition focus:ring"
                placeholder="Search contacts"
                value={searchContacts}
                onChange={(event) => setSearchContacts(event.target.value)}
              />
            </div>
            <button
              className="rounded-xl border border-white/15 bg-white/10 p-2 text-cyan-100 transition hover:bg-white/20"
              onClick={() => setShowAddModal(true)}
              disabled={!user}
              title="Add contact"
            >
              <UserRoundPlus size={18} />
            </button>
          </div>

          <div className="chat-scroll h-[calc(100%-210px)] space-y-2 overflow-y-auto pr-1">
            {filteredContacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-black/15 p-5 text-sm text-white/75">
                {user ? "No conversations yet. Add someone to begin." : "Sign in to view your conversations."}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isActive = contact.convoId === activeConvoId;
                const isOnline = onlineUsers.includes(contact.otherId);
                const unread = unreadCounts[contact.convoId] || 0;

                return (
                  <button
                    key={contact.convoId}
                    onClick={() => {
                      setActiveConvoId(contact.convoId);
                      setSidebarOpen(false);
                    }}
                    className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? "border-cyan-200/45 bg-cyan-300/15 shadow-lg shadow-cyan-500/10"
                        : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/10"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-orange-200/40 to-cyan-300/40 text-xs font-semibold">
                          {getInitials(contact.otherName)}
                        </span>
                        <span className="max-w-[150px] truncate text-sm font-semibold text-white">{contact.otherName}</span>
                        {isOnline ? <span className="h-2 w-2 rounded-full bg-emerald-300" /> : null}
                      </div>
                      <span className="text-[11px] text-white/55">{formatTime(contact.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-white/65">{contact.lastMessage || "No messages yet"}</p>
                      {unread > 0 ? (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-400 px-1 text-[11px] font-semibold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/30 bg-rose-500/20 py-2 text-sm text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleLogout}
            disabled={!user}
          >
            <LogOut size={15} /> Log out
          </button>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-3xl border border-white/15 bg-[var(--panel)] shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded-full p-2 text-white/90 hover:bg-white/10 md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu size={18} />
              </button>

              {activeContact ? (
                <>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-300/35 to-orange-200/40 font-semibold">
                    {getInitials(activeContact.otherName)}
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-white">{activeContact.otherName}</h2>
                    <p className="text-xs text-white/60">{onlineUsers.includes(activeContact.otherId) ? "Online" : "Offline"}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
                    <MessageSquareDot size={18} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-white">Conversation Space</h2>
                    <p className="text-xs text-white/60">Select a chat to start messaging</p>
                  </div>
                </>
              )}
            </div>

            {activeContact ? (
              <div className="relative w-44 md:w-72">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
                <input
                  className="w-full rounded-xl border border-white/15 bg-black/25 py-2 pl-8 pr-3 text-sm text-white outline-none ring-cyan-400/50 transition focus:ring"
                  value={searchInChat}
                  onChange={(event) => setSearchInChat(event.target.value)}
                  placeholder="Search messages"
                />
              </div>
            ) : null}
          </div>

          <div className="chat-scroll relative flex-1 overflow-y-auto px-4 py-5 md:px-6">
            {!activeContact ? (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-md rounded-3xl border border-white/15 bg-black/20 p-8">
                  <h3 className="font-display mb-2 text-3xl text-white">Make your chat extraordinary</h3>
                  <p className="text-sm text-white/70">
                    Real-time typing indicators, unread tracking, reconnect awareness, and sleek mobile behavior are now built in.
                  </p>
                  <button
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 font-semibold text-slate-900 transition hover:brightness-110"
                    onClick={() => {
                      if (!user) {
                        setShowAuthModal(true);
                        return;
                      }
                      setShowAddModal(true);
                    }}
                  >
                    <CirclePlus size={17} /> Start a chat
                  </button>
                </div>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="grid h-full place-items-center text-center text-white/65">
                {searchInChat ? "No messages matched your search." : "No messages yet. Say hello."}
              </div>
            ) : (
              filteredMessages.map((message) => {
                const mine = message.sender === user?._id;

                return (
                  <div key={message._id} className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
                    <article
                      className={`max-w-[86%] rounded-2xl px-4 py-2.5 shadow-lg md:max-w-[65%] ${
                        mine
                          ? "rounded-br-sm bg-gradient-to-br from-cyan-300 to-emerald-300 text-slate-900"
                          : "rounded-bl-sm border border-white/15 bg-white/10 text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                      <p className={`mt-1 text-[11px] ${mine ? "text-slate-700/80" : "text-white/60"}`}>{formatTime(message.createdAt)}</p>
                    </article>
                  </div>
                );
              })
            )}

            {typingSender && activeContact ? (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                typing...
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-white/10 px-4 py-3 md:px-6">
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={currentDraft}
                onChange={(event) => setCurrentDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                className="max-h-36 min-h-[46px] flex-1 resize-y rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none ring-cyan-400/60 transition focus:ring"
                placeholder={activeContact ? "Type a message (Enter to send, Shift+Enter for new line)" : "Select a conversation first"}
                disabled={!activeContact || !user}
              />
              <button
                onClick={sendMessage}
                className="rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 p-3 text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeContact || !user || !currentDraft.trim()}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
