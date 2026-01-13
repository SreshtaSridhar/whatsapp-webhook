import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// Green API Credentials
const ID_INSTANCE = process.env.ID_INSTANCE || "7105466322";
const API_TOKEN_INSTANCE = process.env.API_TOKEN_INSTANCE;
const GREEN_API_URL = "https://7105.api.green-api.com";

// Store last processed messages (to avoid duplicates)
const processedMessages = new Set();

// ====================
// HEALTH CHECK
// ====================
app.get("/", (req, res) => {
  res.json({
    status: "active",
    service: "WhatsApp GST Bot (Green API Polling)",
    idInstance: ID_INSTANCE,
    polling: "Every 5 seconds"
  });
});

// ====================
// POLL FOR NEW MESSAGES
// ====================
async function pollMessages() {
  try {
    console.log("🔍 Checking for new WhatsApp messages...");
    
    // 1. RECEIVE NOTIFICATION
    const receiveUrl = `${GREEN_API_URL}/waInstance${ID_INSTANCE}/receiveNotification/${API_TOKEN_INSTANCE}`;
    const notificationResponse = await axios.get(receiveUrl, {
      timeout: 10000
    });
    
    const notification = notificationResponse.data;
    
    if (!notification || !notification.body) {
      console.log("⏳ No new messages");
      return;
    }
    
    console.log("📩 New notification received:", JSON.stringify(notification, null, 2));
    
    const receiptId = notification.receiptId;
    const messageData = notification.body;
    
    // 2. PROCESS THE MESSAGE
    if (messageData.typeWebhook === "incomingMessageReceived") {
      const messageType = messageData.messageData.typeMessage;
      
      if (messageType === "textMessage") {
        const userPhone = messageData.senderData.senderId.replace("@c.us", "");
        const userMessage = messageData.messageData.textMessageData.textMessage;
        const messageId = messageData.idMessage;
        
        // Check if already processed
        if (!processedMessages.has(messageId)) {
          console.log(`💬 New message from ${userPhone}: "${userMessage}"`);
          processedMessages.add(messageId);
          
          // Process in background
          processMessage(userPhone, userMessage);
        }
      }
    }
    
    // 3. DELETE NOTIFICATION (IMPORTANT!)
    if (receiptId) {
      await deleteNotification(receiptId);
      console.log(`✅ Deleted notification: ${receiptId}`);
    }
    
  } catch (error) {
    console.error("❌ Polling error:", error.message);
  }
}

// ====================
// DELETE NOTIFICATION
// ====================
async function deleteNotification(receiptId) {
  try {
    const deleteUrl = `${GREEN_API_URL}/waInstance${ID_INSTANCE}/deleteNotification/${API_TOKEN_INSTANCE}/${receiptId}`;
    await axios.delete(deleteUrl);
  } catch (error) {
    console.error("❌ Delete notification error:", error.message);
  }
}

// ====================
// PROCESS MESSAGE
// ====================
async function processMessage(userPhone, message) {
  try {
    const cleanMessage = message.trim();
    
    // Check if it's a GST number
    if (isGSTNumber(cleanMessage)) {
      console.log(`🔍 Processing GST: ${cleanMessage}`);
      await handleGSTRequest(userPhone, cleanMessage);
    } else {
      // Send help message
      await sendWhatsAppMessage(userPhone,
        `📋 *GST Verification Bot*\n\n` +
        `Send a 15-digit GST number to check:\n` +
        `• Filing Status\n` +
        `• Business Details\n` +
        `• Alert if not filed\n\n` +
        `Example: *29AADCB2230M1Z2*`
      );
    }
    
  } catch (error) {
    console.error("Process message error:", error);
  }
}

// ====================
// HANDLE GST REQUEST
// ====================
async function handleGSTRequest(userPhone, gstNumber) {
  try {
    // Send "processing" message
    await sendWhatsAppMessage(userPhone, `🔍 Checking GST: ${gstNumber}\nPlease wait...`);
    
    // Validate GST format
    if (!isValidGSTFormat(gstNumber)) {
      await sendWhatsAppMessage(userPhone,
        `❌ *Invalid GST Format*\n\n` +
        `Please send a valid 15-digit GST number.\n` +
        `Format: 29AADCB2230M1Z2`
      );
      return;
    }
    
    // Call GST API (Replace with your teammate's API)
    const gstDetails = await fetchGSTDetails(gstNumber);
    
    if (!gstDetails || gstDetails.error) {
      await sendWhatsAppMessage(userPhone,
        `❌ *GST Not Found*\n\n` +
        `GST: ${gstNumber}\n` +
        `Not found in database.\n` +
        `Please verify and try again.`
      );
      return;
    }
    
    // Send GST details
    const response = formatGSTResponse(gstNumber, gstDetails);
    await sendWhatsAppMessage(userPhone, response);
    
    // Send alert if not filed
    if (!gstDetails.isFiled) {
      await sendAlert(userPhone, gstNumber, gstDetails);
    }
    
  } catch (error) {
    console.error("GST request error:", error);
    await sendWhatsAppMessage(userPhone,
      `⚠️ Service temporarily unavailable.\nPlease try again later.`
    );
  }
}

// ====================
// HELPER FUNCTIONS
// ====================

// Check if text is GST number
function isGSTNumber(text) {
  const clean = text.replace(/[^a-zA-Z0-9]/g, '');
  return clean.length === 15 && /^\d{2}/.test(clean);
}

// Validate GST format
function isValidGSTFormat(gst) {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
}

// Fetch GST details (REPLACE WITH TEAMMATE'S API)
async function fetchGSTDetails(gstNumber) {
  try {
    console.log(`🌐 Fetching GST: ${gstNumber}`);
    
    // ⚠️ REPLACE THIS WITH YOUR TEAMMATE'S API ⚠️
    // Example:
    // const response = await axios.get(`https://teammate-api.com/gst/${gstNumber}`);
    // return response.data;
    
    // Mock data for testing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      gstNumber: gstNumber,
      businessName: "SAMPLE BUSINESS PVT LTD",
      status: "Active",
      isFiled: Math.random() > 0.4,
      lastFiled: "2024-01-20",
      dueDate: "2024-02-25",
      address: "Mumbai, Maharashtra",
      turnover: "₹5.2 Cr"
    };
    
  } catch (error) {
    console.error("GST API error:", error);
    return null;
  }
}

// Format GST response
function formatGSTResponse(gstNumber, details) {
  const status = details.isFiled ? "✅ FILED" : "❌ NOT FILED";
  
  return `📄 *GST VERIFICATION*\n\n` +
         `*GST:* ${gstNumber}\n` +
         `*Business:* ${details.businessName}\n` +
         `*Status:* ${status}\n\n` +
         `*Last Filed:* ${details.lastFiled || 'N/A'}\n` +
         `*Due Date:* ${details.dueDate || 'N/A'}\n` +
         `*Turnover:* ${details.turnover || 'N/A'}\n\n` +
         `${details.isFiled ? '✅ All returns filed' : '⚠️ Returns pending'}`;
}

// Send alert for unfiled GST
async function sendAlert(userPhone, gstNumber, details) {
  if (details.dueDate) {
    const today = new Date();
    const dueDate = new Date(details.dueDate);
    const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 7) {
      await sendWhatsAppMessage(userPhone,
        `🚨 *ALERT: GST NOT FILED*\n\n` +
        `GST: ${gstNumber}\n` +
        `Due: ${details.dueDate}\n` +
        `Days left: ${daysLeft}\n\n` +
        `File immediately to avoid penalty!`
      );
    }
  }
}

// ====================
// SEND WHATSAPP MESSAGE
// ====================
async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    const chatId = `${phoneNumber}@c.us`;
    
    console.log(`📤 Sending to ${chatId}: ${message.substring(0, 30)}...`);
    
    const response = await axios.post(
      `${GREEN_API_URL}/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`,
      {
        chatId: chatId,
        message: message
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("✅ Message sent, ID:", response.data?.idMessage);
    return response.data;
    
  } catch (error) {
    console.error("❌ Send error:", error.response?.data || error.message);
    throw error;
  }
}

// ====================
// CHECK GREEN API STATUS
// ====================
app.get("/check-status", async (req, res) => {
  try {
    // Check account state
    const stateUrl = `${GREEN_API_URL}/waInstance${ID_INSTANCE}/getStateInstance/${API_TOKEN_INSTANCE}`;
    const stateResponse = await axios.get(stateUrl);
    
    // Check settings (webhook)
    const settingsUrl = `${GREEN_API_URL}/waInstance${ID_INSTANCE}/getSettings/${API_TOKEN_INSTANCE}`;
    const settingsResponse = await axios.get(settingsUrl);
    
    res.json({
      state: stateResponse.data,
      settings: settingsResponse.data,
      instanceId: ID_INSTANCE,
      pollingActive: true
    });
    
  } catch (error) {
    res.status(500).json({
      error: "Green API check failed",
      details: error.message
    });
  }
});

// ====================
// START POLLING & SERVER
// ====================
const PORT = process.env.PORT || 10000;

// Start polling every 5 seconds
setInterval(pollMessages, 5000);

app.listen(PORT, () => {
  console.log(`
  🟢 GREEN API WHATSAPP BOT (POLLING)
  ═══════════════════════════════════
  ✅ Port: ${PORT}
  ✅ ID Instance: ${ID_INSTANCE}
  ✅ Polling: Every 5 seconds
  ✅ Health: http://localhost:${PORT}/
  ✅ Status: http://localhost:${PORT}/check-status
  ═══════════════════════════════════
  `);
  
  // Initial poll
  setTimeout(pollMessages, 1000);
});
