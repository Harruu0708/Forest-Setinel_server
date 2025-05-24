const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const { calculateForestCoverage } = require("./utils");
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
      const filename = parts[parts.length - 1]; // phần cuối: "rgb" hoặc "mask"
      const dateFolder = parts[2]; // phần thứ 3 là ngày tháng

      if (!results[dateFolder]) {
        results[dateFolder] = {};
      }

      if (filename === "rgb") {
        results[dateFolder].rgb = resource.secure_url;
      } else if (filename === "mask") {
        results[dateFolder].mask = resource.secure_url;
        // Get forest coverage
        results[dateFolder].forestCoverage = await calculateForestCoverage(
          resource.secure_url,
          6,
          8
        );
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
