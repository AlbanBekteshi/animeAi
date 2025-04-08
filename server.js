import express from "express";
import multer from "multer";
import { Client } from "@gradio/client";
import fs from "fs";

// === CONFIGURATION ===
const app = express();
const port = 3000;
const HF_TOKEN = "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"; // <-- Ton token Hugging Face ici

// === MULTER POUR UPLOAD DE FICHIERS ===
const upload = multer({ dest: "uploads/" });

// === ROUTE POUR GÉNÉRER UNE IMAGE ===
app.post("/generate", upload.single("image"), async (req, res) => {
    try {
        const prompt = "Ghibli Studio style, Charming hand-drawn anime-style illustration";
        const controlType = req.body.control_type || "Ghibli";
        const height = parseInt(req.body.height) || 256;
        const width = parseInt(req.body.width) || 256;
        const seed = parseInt(req.body.seed) || 3;

        const imagePath = req.file.path;
        const imageBlob = fs.readFileSync(imagePath);
        const blob = new Blob([imageBlob], { type: req.file.mimetype });

        // Utiliser le token Hugging Face ici
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

        fs.unlinkSync(imagePath);

        res.json({
            success: true,
            data: result.data,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
});
