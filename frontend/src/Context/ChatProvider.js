import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const ChatContext = createContext();

const ChatProvider = ({ children }) => {
  const [selectedChat, setSelectedChat] = useState();
  const [user, setUser] = useState(() => {
    // Initialize user state from localStorage on component mount
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    return userInfo;
  });
  const [notification, setNotification] = useState([]);
  const [chats, setChats] = useState();

  const navigate = useNavigate();

  // Set up axios interceptor for handling auth errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("userInfo");
          setUser(null);
          navigate("/");
        }
        return Promise.reject(error);
      }
    );

    // Redirect to login if no user
    if (!user) navigate("/");

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <ChatContext.Provider
      value={{
        selectedChat,
        setSelectedChat,
        user,
        setUser,
        notification,
        setNotification,
        chats,
        setChats,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const ChatState = () => {
  return useContext(ChatContext);
};

export default ChatProvider;
