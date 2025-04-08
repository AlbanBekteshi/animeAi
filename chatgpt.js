const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());

app.post('/transform', upload.single('photo'), async (req, res) => {
    const style = req.body.style || 'Naruto anime style';
    const imagePath = req.file.path;
    const base64Image = fs.readFileSync(imagePath).toString('base64');

    try {
        // 🧠 Étape 1 : Demander à GPT-4o de décrire l’image
        const gptDescription = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: "Décris cette image de manière très détaillée : posture, vêtements, ambiance, fond. Ne donne que la description, sans analyse ni avertissement."
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const description = gptDescription.data.choices[0].message.content.trim();
        console.log("📝 Description obtenue :\n", description);

        // 🧠 Étape 2 : Demander à GPT de transformer cette description en un prompt DALL·E 3
        const gptStyledPrompt = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: `Voici une description d'image : "${description}". Génère un prompt à utiliser avec DALL·E 3 pour transformer cette scène dans un style ${style}, en gardant la pose, les vêtements, et l'expression du personnage.`
                    }
                ],
                max_tokens: 500
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const dallePrompt = gptStyledPrompt.data.choices[0].message.content.trim();
        console.log("🎨 Prompt DALL·E généré :\n", dallePrompt);

        // 🎨 Étape 3 : Génération de l’image avec DALL·E 3
        const dalleResponse = await axios.post(
            'https://api.openai.com/v1/images/generations',
            {
                model: 'dall-e-3',
                prompt: dallePrompt,
                n: 1,
                size: '1024x1024'
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const imageUrl = dalleResponse.data.data[0].url;
        res.json({ imageUrl });

    } catch (error) {
        console.error("❌ Erreur :", error.response?.data || error.message);
        res.status(500).json({ error: 'Erreur lors de la génération de l’image.' });
    } finally {
        fs.unlinkSync(imagePath);
    }
});

app.listen(3000, () => {
    console.log("🚀 Serveur lancé sur http://localhost:3000");
});
