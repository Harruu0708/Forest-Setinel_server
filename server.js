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
      const publicId = resource.public_id; // ví dụ: forest/2024-05-24/mask_1_2
      const parts = publicId.split("/");
      const dateFolder = parts[2]; // Thư mục ngày tháng

      if (!results[dateFolder]) {
        results[dateFolder] = {
          rgb: null,
          masks: {}, // lưu ảnh theo tọa độ x_y
          forestCoverage: {},
        };
      }

      const filename = parts[parts.length - 1]; // ví dụ: mask_1_2 hoặc rgb
      if (filename === "rgb") {
        results[dateFolder].rgb = resource.secure_url;
      } else if (filename.startsWith("mask_")) {
        // Parse x_y từ tên file
        const coordMatch = filename.match(/^mask_(\d+)_(\d+)$/);
        if (coordMatch) {
          const x = parseInt(coordMatch[1]);
          const y = parseInt(coordMatch[2]);
          const coord = `${x},${y}`;
          results[dateFolder].masks[coord] = resource.secure_url;

          // Gọi calculateForestCoverage cho từng patch nếu cần
          const coverage = await calculateForestCoverage(
            resource.secure_url,
            1,
            1 // mỗi mask là một ô grid, không cần chia nhỏ nữa
          );
          results[dateFolder].forestCoverage[coord] = coverage["0,0"]; // Vì 1x1 thì chỉ có 1 ô
        }
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
