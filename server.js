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
  const region = req.query.region;

  if (!region) {
    return res.status(400).json({ error: "Thiếu tham số 'region'" });
  }

  try {
    // Lấy tất cả ảnh bằng pagination
    let allResources = [];
    let nextCursor = null;

    do {
      const result = await cloudinary.api.resources({
        type: "upload",
        resource_type: "image",
        prefix: `${region}/`, // Chỉ lấy ảnh trong khu vực này
        max_results: 500,
        next_cursor: nextCursor,
      });

      allResources = allResources.concat(result.resources);
      nextCursor = result.next_cursor;

      console.log(`Đã lấy ${allResources.length} ảnh cho khu vực ${region}...`);
    } while (nextCursor);

    console.log(`Tổng số ảnh khu vực ${region}: ${allResources.length}`);

    const results = {};
    for (const resource of allResources) {
      const publicId = resource.public_id;
      const parts = publicId.split("/");

      if (parts[0] !== region) continue; // Đảm bảo đúng khu vực truyền vào

      const dateFolder = parts[1]; // VD: "2025"
      let filename = parts[parts.length - 1]; // "rgb", "mask", hoặc "mask_0_0"

      // Bỏ đuôi ảnh
      filename = filename.replace(/\.(png|jpg|jpeg)$/i, "");

      if (!results[dateFolder]) {
        results[dateFolder] = { masks: {} };
      }

      if (filename === "rgb") {
        results[dateFolder].rgb = resource.secure_url;
      } else if (filename === "mask") {
        results[dateFolder].mask = resource.secure_url;

        // Tính toán mật độ rừng
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
      } else if (/^mask_\d+_\d+$/.test(filename)) {
        const coords = filename.replace("mask_", "");
        results[dateFolder].masks[coords] = resource.secure_url;
      }
    }

    console.log(`Các năm trong khu vực ${region}:`, Object.keys(results).sort());
    res.json(results);
  } catch (error) {
    console.error("Lỗi:", error);
    res.status(500).json({ error: "Không thể xử lý yêu cầu" });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});