
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// For health checks (Render requires this)
app.get("/", (req, res) => {
  res.json({ 
    status: "active", 
    service: "WhatsApp GST Bot",
    message: "Webhook is running successfully"
  });
});

/* 🔹 Webhook Verification */
app.get("/webhook", (req, res) => {
  console.log("Webhook verification attempt:", req.query);
  
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook verified successfully!");
    return res.status(200).send(challenge);
  }
  
  console.log("Webhook verification failed. Check VERIFY_TOKEN.");
  return res.sendStatus(403);
});

/* 🔹 Receive Messages */
app.post("/webhook", async (req, res) => {
  console.log("Received webhook:", JSON.stringify(req.body, null, 2));
  
  // Always respond immediately (Meta requirement)
  res.sendStatus(200);
  
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (!message) {
      console.log("No message found in webhook payload");
      return;
    }

    const from = message.from;
    const text = message.text?.body?.trim();

    if (!text) {
      console.log("No text in message");
      return;
    }

    console.log(`Message from ${from}: ${text}`);
    
    // Check if message is a GST number
    const gstNumber = extractGSTNumber(text);
    
    if (gstNumber) {
      console.log(`Processing GST number: ${gstNumber}`);
      await handleGSTRequest(from, gstNumber);
    } else {
      // Send help message
      await sendMessage(from, 
        `📋 *Welcome to GST Verification Bot*\n\n` +
        `Please send a valid GST number (15 characters).\n` +
        `Example: *29AADCB2230M1Z2*\n\n` +
        `I will check the filing status and provide details.`
      );
    }
    
  } catch (error) {
    console.error("Error processing webhook:", error);
  }
});

/* 🔹 Handle GST Number Request */
async function handleGSTRequest(userPhone, gstNumber) {
  try {
    // Send "processing" message
    await sendMessage(userPhone, `🔍 Checking GST: ${gstNumber}\nPlease wait...`);

    // 1. Validate GST format
    if (!isValidGSTFormat(gstNumber)) {
      await sendMessage(userPhone, 
        `❌ *Invalid GST Format*\n\n` +
        `GST Number: ${gstNumber}\n` +
        `Please send a valid 15-character GST number.\n` +
        `Format: 2 digits + 10 chars + 3 digits\n` +
        `Example: 29AADCB2230M1Z2`
      );
      return;
    }

    // 2. Call GST API or Database (Replace with your actual API)
    const gstDetails = await fetchGSTDetails(gstNumber);
    
    if (!gstDetails || gstDetails.error) {
      await sendMessage(userPhone, 
        `❌ *GST Not Found*\n\n` +
        `GST Number: *${gstNumber}*\n` +
        `This GST number is not registered or not found in our database.\n\n` +
        `Please verify the number and try again.`
      );
      return;
    }

    // 3. Format and send response based on filing status
    const responseMessage = formatGSTResponse(gstNumber, gstDetails);
    await sendMessage(userPhone, responseMessage);

    // 4. Send alert if not filed
    if (!gstDetails.isFiled && gstDetails.dueDate) {
      const today = new Date();
      const dueDate = new Date(gstDetails.dueDate);
      const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining <= 7) {
        await sendMessage(userPhone,
          `🚨 *URGENT ALERT*\n\n` +
          `GST: *${gstNumber}*\n` +
          `Status: *NOT FILED*\n` +
          `Due Date: *${gstDetails.dueDate}*\n` +
          `Days Remaining: *${daysRemaining}*\n\n` +
          `Please file immediately to avoid penalties!`
        );
      }
    }

  } catch (error) {
    console.error("Error in handleGSTRequest:", error);
    await sendMessage(userPhone,
      `⚠️ *Service Temporarily Unavailable*\n\n` +
      `We encountered an error while processing GST: ${gstNumber}\n` +
      `Please try again in a few minutes.`
    );
  }
}

/* 🔹 Helper Functions */

// Extract GST number from text (could be in a sentence)
function extractGSTNumber(text) {
  // Remove all spaces and special characters
  const cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Check if it looks like a GST number (15 characters, starts with 2 digits)
  if (cleaned.length === 15 && /^\d{2}/.test(cleaned)) {
    return cleaned;
  }
  
  // Try to find GST pattern in longer text
  const gstPattern = /(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})/i;
  const match = text.match(gstPattern);
  return match ? match[1].toUpperCase() : null;
}

// Validate GST number format
function isValidGSTFormat(gst) {
  // GST format: 29AADCB2230M1Z2 (2 digits + 10 chars + 3 digits)
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
}

// Fetch GST details from API (REPLACE THIS WITH YOUR ACTUAL API)
async function fetchGSTDetails(gstNumber) {
  try {
    console.log(`Fetching GST details for: ${gstNumber}`);
    
    // 🔹 REPLACE THIS WITH YOUR TEAMMATE'S ACTUAL API ENDPOINT 🔹
    // Example API call:
    // const response = await axios.get(`https://your-gst-api.com/v1/gst/${gstNumber}`, {
    //   headers: { 'Authorization': `Bearer ${process.env.GST_API_KEY}` }
    // });
    // return response.data;
    
    // 🔹 TEMPORARY MOCK DATA - REMOVE THIS IN PRODUCTION 🔹
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock response - Replace with actual API response
    const mockData = {
      gstNumber: gstNumber,
      businessName: "SAMPLE BUSINESS PRIVATE LIMITED",
      legalName: "Sample Business Pvt Ltd",
      stateCode: gstNumber.substring(0, 2),
      registrationDate: "2022-05-15",
      businessType: "Regular",
      status: "Active",
      isFiled: Math.random() > 0.3, // 70% chance of filed
      lastFiled: "2024-01-25",
      dueDate: "2024-02-20",
      address: "123 Business Street, Mumbai, Maharashtra 400001",
      contact: "9876543210",
      turnover: "₹5.2 Cr (2023-24)",
      complianceScore: Math.floor(Math.random() * 30) + 70 // 70-100
    };
    
    return mockData;
    
  } catch (error) {
    console.error("GST API Error:", error.message);
    return { error: "API not available", message: error.message };
  }
}

// Format GST response message
function formatGSTResponse(gstNumber, details) {
  const statusEmoji = details.isFiled ? "✅" : "❌";
  const statusText = details.isFiled ? "FILED" : "NOT FILED";
  
  return `
📄 *GST Verification Results*

*GST Number:* ${gstNumber}
*Business Name:* ${details.businessName}
*Legal Name:* ${details.legalName}
*State Code:* ${details.stateCode}
*Status:* ${statusEmoji} ${statusText}

📅 *Filing Details:*
• Registration Date: ${details.registrationDate}
• Last Filed: ${details.lastFiled || 'N/A'}
• Due Date: ${details.dueDate || 'N/A'}
• Business Type: ${details.businessType}
• Compliance Score: ${details.complianceScore || 'N/A'}%

🏢 *Business Info:*
• Address: ${details.address}
• Contact: ${details.contact || 'N/A'}
• Turnover: ${details.turnover || 'N/A'}

${details.isFiled ? 
  '✅ *All GST returns are filed up to date.*' : 
  '⚠️ *GST returns are pending. Please file immediately.*'}
  `.trim();
}

/* 🔹 Send Message Function */
async function sendMessage(to, text) {
  try {
    console.log(`Sending message to ${to}: ${text.substring(0, 50)}...`);
    
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { 
          body: text,
          preview_url: false
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    console.log("Message sent successfully:", response.data);
    return response.data;
    
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error.message);
    throw error;
  }
}

/* 🔹 Error Handling Middleware */
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* 🔹 Start Server */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`
  🚀 WhatsApp GST Bot Started!
  ✅ Port: ${PORT}
  ✅ Webhook: http://localhost:${PORT}/webhook
  ✅ Health: http://localhost:${PORT}/
  ✅ Environment: ${process.env.NODE_ENV || 'development'}
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
