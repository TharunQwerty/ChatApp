import { ArrowBackIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  FormControl,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Spinner,
  Text,
  useToast,
  Tooltip,
} from "@chakra-ui/react";
import { CalendarIcon, TimeIcon } from "@chakra-ui/icons";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { ChatState } from "../Context/ChatProvider";
import ScrollableChat from "./ScrollableChat";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import io from "socket.io-client";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";
import ProfileModal from "./miscellaneous/ProfileModal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Use relative URL in production, localhost in development
const ENDPOINT = window.location.hostname === "localhost" 
  ? "http://localhost:5000" 
  : window.location.origin;

var socket, selectedChatCompare;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [istyping, setIsTyping] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState(null);
  const toast = useToast();

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  const { selectedChat, setSelectedChat, user, notification, setNotification } =
    ChatState();

  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      setLoading(true);

      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );
      setMessages(data);
      setLoading(false);

      socket.emit("join chat", selectedChat._id);
    } catch (error) {
      toast({
        title: "Error Occurred!",
        description: "Failed to Load the Messages",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  const sendMessage = async (event) => {
    if ((event.key === "Enter" || event.type === "click") && newMessage) {
      socket.emit("stop typing", selectedChat._id);
      try {
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        setNewMessage("");

        // If there's a scheduled time, send it with the message
        const messageData = {
          content: newMessage,
          chatId: selectedChat,
        };

        // Handle scheduled messages
        if (scheduledDateTime) {
          messageData.scheduledFor = scheduledDateTime;

          // Create a visual indicator for the scheduled message
          const tempScheduledMessage = {
            _id: `scheduled-${Date.now()}`,
            sender: {
              _id: user._id,
              name: user.name,
              pic: user.pic,
            },
            content: `[Scheduled for ${new Date(
              scheduledDateTime
            ).toLocaleString()}] ${newMessage}`,
            chat: selectedChat,
            isScheduledMessage: true,
            createdAt: new Date(),
          };

          // Add a visual indicator to the messages list
          setMessages([...messages, tempScheduledMessage]);

          // Reset the scheduled datetime
          setScheduledDateTime(null);
        }

        const { data } = await axios.post("/api/message", messageData, config);

        // Only emit socket event if message is not scheduled
        if (!messageData.scheduledFor) {
          console.log("Emitting new regular message");
          socket.emit("new message", data);
          setMessages((prevMessages) => {
            // Filter out any temporary scheduled message indicators that might be duplicates
            const filteredMessages = prevMessages.filter(
              (m) => !m.isScheduledMessage
            );
            return [...filteredMessages, data];
          });
        } else {
          toast({
            title: "Message Scheduled",
            description: `Your message will be sent on ${new Date(
              messageData.scheduledFor
            ).toLocaleString()}`,
            status: "success",
            duration: 5000,
            isClosable: true,
            position: "bottom",
          });
        }
      } catch (error) {
        toast({
          title: "Error Occurred!",
          description: "Failed to send the Message",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      }
    }
  };

  useEffect(() => {
    socket = io(ENDPOINT, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.emit("setup", user);
    
    socket.on("connected", () => {
      console.log("Socket connected successfully");
      setSocketConnected(true);
    });
    
    socket.on("connect_error", (error) => {
      console.log("Socket connection error:", error);
      toast({
        title: "Connection Error",
        description: "Trying to reconnect to chat service...",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
    });
    
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    // Clean up function
    return () => {
      socket.off("connected");
      socket.off("connect_error");
      socket.off("typing");
      socket.off("stop typing");
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    fetchMessages();

    selectedChatCompare = selectedChat;
    // eslint-disable-next-line
  }, [selectedChat]);

  // Separate effect to handle message reception via socket
  useEffect(() => {
    const messageHandler = (newMessageRecieved) => {
      console.log("New message received via socket:", newMessageRecieved);

      if (
        !selectedChatCompare || // if chat is not selected or doesn't match current chat
        selectedChatCompare._id !== newMessageRecieved.chat._id
      ) {
        // Add notification
        if (!notification.includes(newMessageRecieved)) {
          setNotification([newMessageRecieved, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        // Add message to current chat
        console.log("Adding message to current chat");
        setMessages((prevMessages) => [...prevMessages, newMessageRecieved]);
      }
    };

    // Set up the event listener
    socket.on("message recieved", messageHandler);

    // Clean up function to prevent memory leaks
    return () => {
      socket.off("message recieved", messageHandler);
    };
  }, [notification, fetchAgain, selectedChat, setFetchAgain, setNotification]);

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }
    let lastTypingTime = new Date().getTime();
    var timerLength = 3000;
    setTimeout(() => {
      var timeNow = new Date().getTime();
      var timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  // Function to handle datetime selection
  const handleSchedule = (date) => {
    // Ensure selected datetime is in the future
    const now = new Date();
    if (date <= now) {
      toast({
        title: "Invalid Time",
        description: "Please select a future date and time.",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    setScheduledDateTime(date);
    toast({
      title: "Message Scheduled",
      description: `Your message will be scheduled for ${date.toLocaleString()}`,
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "bottom",
    });
  };

  return (
    <>
      {selectedChat ? (
        <>
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={3}
            px={2}
            w="100%"
            fontFamily="Work sans"
            display="flex"
            justifyContent={{ base: "space-between" }}
            alignItems="center"
          >
            <IconButton
              display={{ base: "flex" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
            />
            {messages &&
              (!selectedChat.isGroupChat ? (
                <>
                  {getSender(user, selectedChat.users)}
                  <ProfileModal
                    user={getSenderFull(user, selectedChat.users)}
                  />
                </>
              ) : (
                <>
                  {selectedChat.chatName.toUpperCase()}
                  <UpdateGroupChatModal
                    fetchMessages={fetchMessages}
                    fetchAgain={fetchAgain}
                    setFetchAgain={setFetchAgain}
                  />
                </>
              ))}
          </Text>
          <Box
            display="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#E8E8E8"
            w="100%"
            h="100%"
            borderRadius="lg"
            overflowY="hidden"
          >
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Tooltip label="Check for scheduled messages" placement="top">
                <IconButton
                  size="sm"
                  icon={<i className="fas fa-sync-alt"></i>}
                  onClick={fetchMessages}
                  aria-label="Refresh messages"
                  colorScheme="blue"
                />
              </Tooltip>
            </Box>

            {loading ? (
              <Spinner
                size="xl"
                w={20}
                h={20}
                alignSelf="center"
                margin="auto"
              />
            ) : (
              <div className="messages">
                <ScrollableChat messages={messages} />
              </div>
            )}

            <FormControl
              onKeyDown={sendMessage}
              id="first-name"
              isRequired
              mt={3}
            >
              {istyping ? (
                <div>
                  <Lottie
                    options={defaultOptions}
                    width={70}
                    style={{ marginBottom: 15, marginLeft: 0 }}
                  />
                </div>
              ) : (
                <></>
              )}
              <Box display="flex" alignItems="center">
                <Input
                  variant="filled"
                  bg="#E0E0E0"
                  placeholder="Enter a message.."
                  value={newMessage}
                  onChange={typingHandler}
                  style={{ marginRight: "10px" }}
                />
                <Popover placement="top">
                  <PopoverTrigger>
                    <IconButton
                      colorScheme="blue"
                      aria-label="Schedule message"
                      icon={<CalendarIcon />}
                      style={{ marginRight: "10px" }}
                    />
                  </PopoverTrigger>
                  <PopoverContent width="300px">
                    <PopoverArrow />
                    <PopoverCloseButton />
                    <PopoverHeader>Schedule your message</PopoverHeader>
                    <PopoverBody>
                      <Box display="flex" flexDirection="column">
                        <DatePicker
                          selected={scheduledDateTime}
                          onChange={handleSchedule}
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={5}
                          timeCaption="time"
                          dateFormat="MMMM d, yyyy h:mm aa"
                          minDate={new Date()}
                          inline
                        />
                      </Box>
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
                <Button colorScheme="blue" onClick={sendMessage}>
                  Send
                </Button>
              </Box>
            </FormControl>
          </Box>
        </>
      ) : (
        // to get socket.io on same page
        <Box d="flex" alignItems="center" justifyContent="center" h="100%">
          <Text fontSize="3xl" pb={3} fontFamily="Work sans">
            Click on a user to start chatting
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
