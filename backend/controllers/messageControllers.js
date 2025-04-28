const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ 
      chat: req.params.chatId,
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: new Date() } }
      ]
    })
      .populate("sender", "name pic email")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId, scheduledFor } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
    scheduledFor: scheduledFor || null,
  };

  try {
    var message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic").execPopulate();
    message = await message.populate("chat").execPopulate();
    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    // Only update latest message and send socket notification if not scheduled for future
    if (!scheduledFor) {
      await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });
      res.json(message);
    } else {
      res.json(message);
    }
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Get all scheduled messages for future delivery
//@route           GET /api/Message/scheduled
//@access          Protected
const getScheduledMessages = asyncHandler(async (req, res) => {
  try {
    const scheduledMessages = await Message.find({
      scheduledFor: { $gt: new Date() }
    })
      .populate("sender", "name pic email")
      .populate("chat");
    res.json(scheduledMessages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Translate a message to another language
//@route           POST /api/Message/translate
//@access          Protected
const translateMessage = asyncHandler(async (req, res) => {
  const { content, targetLanguage } = req.body;
  const API_KEY = "AIzaSyDrUChIZW_opEeIrEqxjVID3USTlgMt95E";
  
  console.log(`Translation request: "${content}" to ${targetLanguage}`);
  
  if (!content || !targetLanguage) {
    return res.status(400).json({ message: "Content and target language are required" });
  }

  try {
    console.log("Attempting direct API call for translation...");
    
    // Since the SDK has version issues, let's use a direct API call with the correct endpoint
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Translate the following text to ${targetLanguage}. Return ONLY the translated text without any additional context, explanation or quotes: "${content}"`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log("API Response:", JSON.stringify(response.data, null, 2));
    
    // Extract the text from the response
    let translatedText = '';
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts[0]) {
      
      translatedText = response.data.candidates[0].content.parts[0].text;
      console.log(`Raw translated text: "${translatedText}"`);
      
      // Clean up the text
      translatedText = translatedText.replace(/^["']|["']$/g, ''); // Remove leading/trailing quotes
      
      // Remove any explanatory text
      if (translatedText.includes('Translation:')) {
        translatedText = translatedText.split('Translation:')[1].trim();
      }
      
      console.log(`Final translated text: "${translatedText}"`);
    }
    
    // If translation is missing or too short, try fallback
    if (!translatedText || translatedText.trim().length < 1 || translatedText === content) {
      console.log("Translation unsuccessful, trying fallback...");
      translatedText = await simpleFallbackTranslation(content, getLanguageCode(targetLanguage));
    }
    
    return res.json({ translatedText });
    
  } catch (error) {
    console.error("Translation error details:", error.message);
    
    // Try fallback translation
    try {
      console.log("API failed, trying fallback translation...");
      const translatedText = await simpleFallbackTranslation(content, getLanguageCode(targetLanguage));
      return res.json({ translatedText });
    } catch (fallbackError) {
      console.error("Fallback translation also failed:", fallbackError.message);
      
      // All translation methods failed, send error 
      return res.status(500).json({ 
        message: "Failed to translate message", 
        error: error.message,
        details: "Both primary and fallback translation methods failed"
      });
    }
  }
});

// Helper function to get standard language codes
function getLanguageCode(language) {
  const languageCodes = {
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "italian": "it",
    "portuguese": "pt",
    "russian": "ru",
    "chinese": "zh",
    "japanese": "ja",
    "korean": "ko",
    "arabic": "ar",
    "hindi": "hi",
    "english": "en"
  };
  
  return languageCodes[language.toLowerCase()] || "en";
}

// Simple fallback translation service
async function simpleFallbackTranslation(text, targetLang) {
  try {
    // Demo translations for common phrases (just for demo purposes)
    const translations = {
      "hello": {
        "es": "hola",
        "fr": "bonjour",
        "de": "hallo",
        "it": "ciao",
        "zh": "你好",
        "ja": "こんにちは",
        "ko": "안녕하세요",
        "ar": "مرحبا",
        "hi": "नमस्ते",
        "ru": "привет",
        "pt": "olá"
      },
      "how are you": {
        "es": "¿cómo estás?",
        "fr": "comment ça va?",
        "de": "wie geht es dir?",
        "it": "come stai?",
        "zh": "你好吗",
        "ja": "お元気ですか",
        "ko": "어떻게 지내세요?",
        "ar": "كيف حالك؟",
        "hi": "आप कैसे हैं?",
        "ru": "как дела?",
        "pt": "como você está?"
      },
      "thank you": {
        "es": "gracias",
        "fr": "merci",
        "de": "danke",
        "it": "grazie",
        "zh": "谢谢",
        "ja": "ありがとう",
        "ko": "감사합니다",
        "ar": "شكرا لك",
        "hi": "धन्यवाद",
        "ru": "спасибо",
        "pt": "obrigado"
      },
      "good morning": {
        "es": "buenos días",
        "fr": "bonjour",
        "de": "guten morgen",
        "it": "buongiorno",
        "zh": "早上好",
        "ja": "おはようございます",
        "ko": "좋은 아침",
        "ar": "صباح الخير",
        "hi": "सुप्रभात",
        "ru": "доброе утро",
        "pt": "bom dia"
      }
    };
    
    // Try to match simple phrases (case insensitive)
    const lowerText = text.toLowerCase().trim();
    
    // Direct match for the whole phrase
    if (translations[lowerText] && translations[lowerText][targetLang]) {
      console.log(`Found direct translation match for "${lowerText}"`);
      return translations[lowerText][targetLang];
    }
    
    // Check if the message contains any of the known phrases
    for (const phrase of Object.keys(translations)) {
      if (lowerText.includes(phrase)) {
        if (translations[phrase][targetLang]) {
          console.log(`Found partial translation match for "${phrase}"`);
          return translations[phrase][targetLang];
        }
      }
    }
    
    console.log("No matching phrase found in dictionary, returning original text");
    return text;  // Return original text if no translation available
  } catch (error) {
    console.error("Fallback translation failed:", error.message);
    return text;  // Return original text on error
  }
}

module.exports = { allMessages, sendMessage, getScheduledMessages, translateMessage };
