import { Avatar, Box, Button, Menu, MenuButton, MenuItem, MenuList, Tooltip, Spinner, Text, useToast } from "@chakra-ui/react";
import axios from "axios";
import { useState, useRef, useEffect } from "react";
import ScrollableFeed from "react-scrollable-feed";
import {
  isLastMessage,
  isSameSender,
  isSameSenderMargin,
  isSameUser,
} from "../config/ChatLogics";
import { ChatState } from "../Context/ChatProvider";

const ScrollableChat = ({ messages }) => {
  const { user } = ChatState();
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [loadingTranslations, setLoadingTranslations] = useState({});
  const [translationError, setTranslationError] = useState(null);
  const toast = useToast();
  const scrollRef = useRef();
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Simple client-side translations (as fallback)
  const clientSideTranslations = {
    "hello": {
      "Spanish": "hola",
      "French": "bonjour",
      "German": "hallo",
      "Italian": "ciao",
      "Portuguese": "olá",
      "Chinese": "你好",
      "Japanese": "こんにちは",
      "Russian": "привет",
      "Hindi": "नमस्ते",
    },
    "how are you": {
      "Spanish": "¿cómo estás?",
      "French": "comment ça va?",
      "German": "wie geht es dir?",
      "Italian": "come stai?",
      "Portuguese": "como vai você?",
      "Chinese": "你好吗？",
      "Japanese": "お元気ですか？",
      "Russian": "как дела?",
      "Hindi": "आप कैसे हैं?",
    },
    "thank you": {
      "Spanish": "gracias",
      "French": "merci",
      "German": "danke",
      "Italian": "grazie",
      "Portuguese": "obrigado",
      "Chinese": "谢谢",
      "Japanese": "ありがとう",
      "Russian": "спасибо",
      "Hindi": "धन्यवाद",
    },
  };

  const languages = [
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
  ];

  // Client-side fallback translation function
  const clientSideFallbackTranslation = (text, targetLanguage) => {
    // Simple client-side translations dictionary
    const lowerText = text.toLowerCase().trim();
    if (clientSideTranslations[lowerText] && clientSideTranslations[lowerText][targetLanguage]) {
      return clientSideTranslations[lowerText][targetLanguage];
    }
    
    // Check if text contains any of the phrases
    for (const phrase of Object.keys(clientSideTranslations)) {
      if (lowerText.includes(phrase)) {
        if (clientSideTranslations[phrase][targetLanguage]) {
          return clientSideTranslations[phrase][targetLanguage];
        }
      }
    }
    
    return null; // No translation available
  };

  const translateMessage = async (messageId, content, targetLanguage) => {
    try {
      // First, try client-side translation for common phrases
      const fallbackTranslation = clientSideFallbackTranslation(content, targetLanguage);
      
      // Set loading state for this specific message and language
      const loadingKey = `${messageId}-${targetLanguage}`;
      setLoadingTranslations({
        ...loadingTranslations,
        [loadingKey]: true
      });
      
      // Clear any previous translation errors
      setTranslationError(null);
      
      console.log(`Requesting translation to ${targetLanguage} for: "${content}"`);
      
      try {
        // If we have a client-side translation, use it immediately
        if (fallbackTranslation) {
          console.log(`Using client-side translation: "${fallbackTranslation}"`);
          setTranslatedMessages({
            ...translatedMessages,
            [messageId]: fallbackTranslation,
          });
          return; // Exit early, no need to call the API
        }
        
        // Otherwise, proceed with API call
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };

        // Set longer timeout for translation requests
        const axiosInstance = axios.create({
          timeout: 15000 // 15 seconds
        });

        const { data } = await axiosInstance.post(
          "/api/message/translate",
          {
            content,
            targetLanguage,
          },
          config
        );

        console.log("Translation API response:", data);

        if (data.translatedText) {
          // Check if the translation is significantly different from the original
          if (data.translatedText.toLowerCase() === content.toLowerCase()) {
            console.warn("Translation looks identical to original text");
            // Try client-side fallback if available
            if (fallbackTranslation) {
              setTranslatedMessages({
                ...translatedMessages,
                [messageId]: fallbackTranslation + " (local translation)",
              });
            } else {
              // Show a warning but still display the "translation"
              toast({
                title: "Translation Notice",
                description: "The translation looks similar to the original text.",
                status: "warning",
                duration: 3000,
                isClosable: true,
                position: "bottom",
              });
              setTranslatedMessages({
                ...translatedMessages,
                [messageId]: data.translatedText,
              });
            }
          } else {
            // Normal case - translation is different from original
            setTranslatedMessages({
              ...translatedMessages,
              [messageId]: data.translatedText,
            });
          }
        } else {
          throw new Error(data.message || "No translation received");
        }
      } catch (error) {
        console.error("Translation API error:", error);
        
        setTranslationError(`Translation service error: ${error.message || "Unknown error"}`);
        
        // If server-side translation failed but we have a client-side fallback, use it
        if (fallbackTranslation) {
          console.log(`Using client-side fallback after API error: "${fallbackTranslation}"`);
          setTranslatedMessages({
            ...translatedMessages,
            [messageId]: fallbackTranslation + " (local translation)",
          });
          return;
        }
        
        // If we don't have a fallback either, show the error
        throw error;
      }
    } catch (error) {
      console.error("Translation error:", error);
      
      // Extract detailed error information
      let errorDetails = "Unknown error";
      if (error.response && error.response.data) {
        console.error("Error response data:", error.response.data);
        errorDetails = error.response.data.message || error.response.data.error || error.message;
      } else if (error.message) {
        errorDetails = error.message;
      }
      
      toast({
        title: "Translation Error",
        description: `Failed to translate: ${errorDetails}`,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      // Clear loading state
      const updatedLoadingState = { ...loadingTranslations };
      Object.keys(updatedLoadingState).forEach(key => {
        if (key.startsWith(`${messageId}-`)) {
          delete updatedLoadingState[key];
        }
      });
      setLoadingTranslations(updatedLoadingState);
    }
  };

  const resetTranslation = (messageId) => {
    const updatedTranslations = { ...translatedMessages };
    delete updatedTranslations[messageId];
    setTranslatedMessages(updatedTranslations);
  };

  const isLanguageLoading = (messageId, langName) => {
    return loadingTranslations[`${messageId}-${langName}`] === true;
  };

  return (
    <ScrollableFeed ref={scrollRef}>
      {/* Display translation error if any */}
      {translationError && (
        <Box 
          bg="red.100" 
          p={2} 
          mb={2} 
          borderRadius="md" 
          fontSize="sm"
          textAlign="center"
        >
          <Text color="red.600">{translationError}</Text>
          <Text fontSize="xs" mt={1}>
            Note: Simple phrases like "hello", "thank you", and "how are you" work offline
          </Text>
        </Box>
      )}
      
      {messages &&
        messages.map((m, i) => (
          <div key={m._id} style={{ display: "flex" }}>
            {(isSameSender(messages, m, i, user._id) ||
              isLastMessage(messages, i, user._id)) && (
              <Tooltip label={m.sender.name} placement="bottom-start" hasArrow>
                <Avatar
                  mt="7px"
                  mr={1}
                  size="sm"
                  cursor="pointer"
                  name={m.sender.name}
                  src={m.sender.pic}
                />
              </Tooltip>
            )}
            <span
              style={{
                backgroundColor: `${
                  m.sender._id === user._id ? "#BEE3F8" : "#B9F5D0"
                }`,
                color: m.isScheduledMessage ? "gray.600" : "black",
                borderRadius: "20px",
                padding: "5px 15px",
                maxWidth: "75%",
                marginLeft: isSameSenderMargin(messages, m, i, user._id),
                marginTop: isSameUser(messages, m, i, user._id) ? 3 : 10,
                fontStyle: m.isScheduledMessage ? "italic" : "normal",
              }}
            >
              {translatedMessages[m._id] || m.content}
              
              {/* Translation menu */}
              <Menu>
                <MenuButton
                  as={Button}
                  size="xs"
                  colorScheme="blue"
                  variant="ghost"
                  ml={2}
                >
                  Translate
                </MenuButton>
                <MenuList>
                  {translatedMessages[m._id] && (
                    <MenuItem onClick={() => resetTranslation(m._id)}>
                      Original
                    </MenuItem>
                  )}
                  {languages.map((lang) => (
                    <MenuItem
                      key={lang.code}
                      onClick={() => translateMessage(m._id, m.content, lang.name)}
                      isDisabled={isLanguageLoading(m._id, lang.name)}
                    >
                      {isLanguageLoading(m._id, lang.name) ? (
                        <Spinner size="xs" mr={2} />
                      ) : null}
                      {lang.name}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>
            </span>
          </div>
        ))}

      {/* Invisible element at the bottom for scrolling */}
      <div ref={messagesEndRef} style={{ height: "1px" }} />
    </ScrollableFeed>
  );
};

export default ScrollableChat;
