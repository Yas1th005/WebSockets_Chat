// "use client"
// import { useEffect, useState } from "react";
// import axios from "axios";
// import socket from "@/utils/Socket";

// export default function Chat() {
//   const [userId, setUserId] = useState("");
//   const [onlineUsers, setOnlineUsers] = useState({});
//   const [receiverId, setReceiverId] = useState("");
//   const [conversationId, setConversationId] = useState("");
//   const [messages, setMessages] = useState([]);
//   const [msg, setMsg] = useState("");
//   const [typing, setTyping] = useState(false);
//   const [typingSender, setTypingSender] = useState(null);

//   useEffect(() => {
//     const uid = localStorage.getItem("userId");
//     if (!uid) return;
//     setUserId(uid);
//     socket.emit("user-online", uid);

//     socket.on("chat-started", (cid) => setConversationId(cid));
//     socket.on("receive-message", (message) => {
//       setMessages((prev) => [...prev, message]);
//     });
//     socket.on("typing", ({ senderId }) => {
//       setTypingSender(senderId);
//     });
//     socket.on("stop-typing", () => {
//       setTypingSender(null);
//     });
//     socket.on("messages-read", ({ userId }) => {
//       console.log(`Messages read by ${userId}`);
//     });

//     return () => {
//       socket.disconnect();
//     };
//   }, []);


//   const startChat = () => {
//     socket.emit("start-chat", { senderId: userId, receiverId });
//   };

//   const sendMessage = () => {
//     if (!msg || !conversationId) return;
//     socket.emit("send-message", {
//       conversationId,
//       senderId: userId,
//       content: msg,
//     });
//     setMsg("");
//     socket.emit("stop-typing", { conversationId, senderId: userId });
//   };

//   const markAsRead = () => {
//     socket.emit("mark-as-read", { conversationId, userId });
//   };

//   return (
//     <div style={{ padding: 20 }}>
//       <h2>Welcome, {userId}</h2>

//       <div>
//         <input
//           placeholder="Receiver ID"
//           value={receiverId}
//           onChange={(e) => setReceiverId(e.target.value)}
//         />
//         <button onClick={startChat}>Start Chat</button>
//       </div>

//       <div>
//         <h3>Conversation</h3>
//         <div style={{ border: "1px solid #ccc", padding: 10, minHeight: 100 }}>
//           {messages.map((m) => (
//             <div key={m._id}>
//               <b>{m.senderId === userId ? "You" : m.senderId}:</b> {m.content}
//             </div>
//           ))}
//           {typingSender && <p>{typingSender} is typing...</p>}
//         </div>
//         <input
//           placeholder="Type a message"
//           value={msg}
//           onChange={(e) => {
//             setMsg(e.target.value);
//             if (!typing) {
//               setTyping(true);
//               socket.emit("typing", { conversationId, senderId: userId });
//             }
//           }}
//           onBlur={() => {
//             setTyping(false);
//             socket.emit("stop-typing", { conversationId, senderId: userId });
//           }}
//         />
//         <button onClick={sendMessage}>Send</button>
//         <button onClick={markAsRead}>Mark All as Read</button>
//       </div>
//     </div>
//   );
// }
