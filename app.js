import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import * as googleTTS from 'google-tts-api';

const app = express();
app.use(bodyParser.json());

// Pulling keys directly from Render environment variables
const PORT = process.env.PORT || 5000;
const PAGE_ACCESS_TOKEN = process.env.TOKEN; 
const VERIFY_TOKEN = process.env.KEY;

// 1. Webhook Verification for Facebook (GET Request)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 2. Handling Incoming Messages (POST Request)
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(entry => {
            if (!entry.messaging) return;

            entry.messaging.forEach(async (event) => {
                const senderId = event.sender.id;

                if (event.message && event.message.text) {
                    const incomingText = event.message.text;
                    console.log(`Received: "${incomingText}" from user: ${senderId}`);

                    // Create the requested text notification format
                    const textNotification = `generating VM for "${incomingText}" please wait while we generate it...`;

                    // Send the plain text confirmation first
                    await sendTextMessage(senderId, textNotification);

                    // Convert text to voice track (bypassing "You said:") and send the .mp3 file
                    await sendVoiceMessage(senderId, incomingText);
                }
            });
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// 3. Official Facebook Graph API - Text Sender
async function sendTextMessage(recipientId, textToSend) {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    const payload = {
        recipient: { id: recipientId },
        message: { text: textToSend }
    };

    try {
        await axios.post(url, payload);
    } catch (error) {
        console.error('Text Send Error:', error.response ? error.response.data : error.message);
    }
}

// 4. Official Facebook Graph API - Voice Note Sender
async function sendVoiceMessage(recipientId, textToSpeak) {
    try {
        // Generate raw Google TTS voice file link 
        // Note: Change 'en' to 'tl' if you want a Tagalog voice accent later
        const audioUrl = googleTTS.getAudioUrl(textToSpeak, {
            lang: 'tl',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
        const payload = {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "audio",
                    payload: {
                        url: audioUrl,
                        is_reusable: true
                    }
                }
            }
        };

        await axios.post(url, payload);
        console.log(`Voice note successfully pushed to user: ${recipientId}`);
    } catch (error) {
        console.error('Voice Send Error:', error.response ? error.response.data : error.message);
    }
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
