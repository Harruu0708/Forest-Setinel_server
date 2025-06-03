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
    // Lấy tất cả ảnh bằng pagination
    let allResources = [];
    let nextCursor = null;
    
    do {
      const result = await cloudinary.api.resources({
        type: "upload",
        resource_type: "image",
        max_results: 500,
        next_cursor: nextCursor
      });
      
      allResources = allResources.concat(result.resources);
      nextCursor = result.next_cursor;
      
      console.log(`Đã lấy ${allResources.length} ảnh...`);
    } while (nextCursor);

    console.log(`Tổng số ảnh tìm thấy: ${allResources.length}`);

    const results = {};
    for (const resource of allResources) {
      const publicId = resource.public_id;
      const parts = publicId.split("/");

      const dateFolder = parts[2]; // phần thứ 3 là ngày tháng
      let filename = parts[parts.length - 1]; // "rgb", "mask", hoặc "mask_0_0"
      
      // Loại bỏ extension
      filename = filename.replace(/\.(png|jpg|jpeg)$/i, "");

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
        try {
          results[dateFolder].forestCoverage = await calculateForestCoverage(
            resource.secure_url,
            config.x_split,
            config.y_split
          );
        } catch (error) {
          console.error(`Lỗi tính forest coverage cho ${dateFolder}:`, error);
          results[dateFolder].forestCoverage = null;
        }
      }

      // Ảnh chia theo grid: mask_0_0, mask_1_2,...
      else if (/^mask_\d+_\d+$/.test(filename)) {
        const coords = filename.replace("mask_", "");
        results[dateFolder].masks[coords] = resource.secure_url;
      }
    }

    console.log("Các năm tìm thấy:", Object.keys(results).sort());
    res.json(results);
  } catch (error) {
    console.error("Lỗi:", error);
    res.status(500).json({ error: "Không thể xử lý yêu cầu" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});