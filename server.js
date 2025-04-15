import express from "express";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import { Client } from "@gradio/client";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN; // Token Hugging Face
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Assure-toi qu’il est bien défini dans ton .env

app.use(cors({
    origin: "*", // ⚠️ en production, mets l’URL de ta boutique pour sécuriser !
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"]
}));

app.get("/", (req, res) => {
    res.send("Hello depuis Render 🚀");
});
app.post("/generate", upload.single("image"), async (req, res) => {
    console.log("Début traitement");
    const style = req.body.style || "Ghibli";
    const imagePath = req.file.path;

    try {
        if (style.toLowerCase() === "ghibli") {
            // === Traitement via Hugging Face ===
            const prompt = "Ghibli Studio style, Charming hand-drawn anime-style illustration";
            const controlType = req.body.control_type || "Ghibli";
            const height = 256;
            const width = 256;
            const seed = 3;

            const imageBlob = fs.readFileSync(imagePath);
            const blob = new Blob([imageBlob], { type: req.file.mimetype });

            const client = await Client.connect("jamesliu1217/EasyControl_Ghibli", {
                hf_token: HF_TOKEN,
            });

            const result = await client.predict("/single_condition_generate_image", {
                prompt,
                spatial_img: blob,
                height,
                width,
                seed,
                control_type: controlType,
            });

            res.json({
                success: true,
                data: result.data,
            });
        } else {
            // === Traitement via GPT + DALL·E ===
            const base64Image = fs.readFileSync(imagePath).toString("base64");

            // Étape 1 : description GPT-4o
            const gptDescription = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Décris cette image de manière très détaillée : posture, vêtements, ambiance, fond. Ne donne que la description, sans analyse ni avertissement."
                                },
                                {
                                    type: "image_url",
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
                        Authorization: `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const description = gptDescription.data.choices[0].message.content.trim();
            console.log("📝 Description : ", description);

            // Étape 2 : génération du prompt stylisé
            const gptStyledPrompt = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Voici une description d'image : "${description}". Génère un prompt à utiliser avec DALL·E 3 pour transformer cette scène dans un style ${style}, en gardant la pose, les vêtements, et l'expression du personnage.`
                        }
                    ],
                    max_tokens: 500
                },
                {
                    headers: {
                        Authorization: `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const dallePrompt = gptStyledPrompt.data.choices[0].message.content.trim();
            console.log("🎨 Prompt DALL·E : ", dallePrompt);

            // Étape 3 : génération image DALL·E 3
            const dalleResponse = await axios.post(
                "https://api.openai.com/v1/images/generations",
                {
                    model: "dall-e-3",
                    prompt: dallePrompt,
                    n: 1,
                    size: "1024x1024"
                },
                {
                    headers: {
                        Authorization: `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const imageUrl = dalleResponse.data.data[0].url;
            res.json({ success: true, imageUrl });
            console.log(imageUrl)
            console.log("Réponse envoyée");
        }

    } catch (error) {
        console.error("❌ Erreur :", error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Erreur lors de la génération de l’image." });
    } finally {
        fs.unlinkSync(imagePath); // Nettoyage
    }
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Serveur lancé sur http://0.0.0.0:${port}`);
});
