import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import { calculateForestCoverage } from "./utils.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("./config.json");

const app = express();
const PORT = 3000;

app.use(cors());

cloudinary.config({
  cloud_name: "dndoab4ux",
  api_key: "869142631932877",
  api_secret: "uYDAP5qqtwQbzimq32dlp0y51To",
});

app.get("/api/cloudinary/images", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      max_results: 500,
    });

    const results = {};
    for (const resource of result.resources) {
      const publicId = resource.public_id;
      const parts = publicId.split("/");

      const dateFolder = parts[2]; // phần thứ 3 là ngày tháng
      const filename = parts[parts.length - 1]; // "rgb", "mask", hoặc "mask_0_0"

      if (!results[dateFolder]) {
        results[dateFolder] = {
          masks: {}, // chứa mask_x_y
        };
      }

      // Ảnh rgb
      if (filename === "rgb") {
        results[dateFolder].rgb = resource.secure_url;
      }

      // Ảnh mask.png gốc
      else if (filename === "mask") {
        results[dateFolder].mask = resource.secure_url;
        // Tính forest coverage cho ảnh mask gốc
        results[dateFolder].forestCoverage = await calculateForestCoverage(
          resource.secure_url,
          config.x_split,
          config.y_split
        );
      }

      // Ảnh chia theo grid: mask_0_0, mask_1_2,...
      else if (/^mask_\d+_\d+$/.test(filename)) {
        const coords = filename.replace("mask_", "").replace(".png", "");
        results[dateFolder].masks[coords] = resource.secure_url;
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Lỗi:", error);
    res.status(500).json({ error: "Không thể xử lý yêu cầu" });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
