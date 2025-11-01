import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const BASE_URL = "https://pesdb.net/efootball/";

async function scrapePlayerInfo(id) {
  const url = `${BASE_URL}?id=${id}&mode=max_level`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const info = {};

  // Basic info
  info.imageFront = $(".flip-box-front img").attr("src") || null;
  info.imageBack = $(".flip-box-back img").attr("src") || null;

  // Loop through info table instead of hardcoding
  $("table.player table")
    .first()
    .find("tr")
    .each((_, tr) => {
      const th = $(tr).find("th").text().trim().replace(":", "");
      const td = $(tr).find("td span, td div, td a").first().text().trim();
      if (!th || !td) return;

      const key = th
        .replace(/\s+/g, "")
        .replace(/[^a-zA-Z]/g, "")
        .toLowerCase(); // normalize keys
      info[key] = td;
    });

  // Extract rarity (Epic, Legendary, etc.)
  info.rarity =
    $("td[colspan='2']:contains('Epic'), td[colspan='2']:contains('Legendary')")
      .text()
      .trim() || null;

  // Rating sometimes has "B(+15) 103" format → cleanly split
  if (info.rating) {
    info.rating = info.rating.replace(/\s+/g, " ").trim();
  }

  // Attributes table
  info.attributes = [];
  $("table[data-style] tr").each((_, tr) => {
    const statName = $(tr).find("th").text().replace(":", "").trim();
    if (!statName) return;

    const booster = $(tr).find("span[title*='Booster']").attr("title") || null;
    const smallBonus = $(tr).find("small").text().trim() || null;
    const value = $(tr).find("span[id^='a']").text().trim() || $(tr).find("td span.c0").text().trim();

    if (value) {
      info.attributes.push({
        statName,
        value,
        booster: booster ? booster.replace("Booster ", "") : null,
        bonus: smallBonus || null,
      });
    }
  });

  // Playing Style
  info.playingStyle = $("table.playing_styles tr:nth-child(2)").text().trim() || null;

  // Player Skills
  info.playerSkills = [];
  let collectingSkills = false;
  $("table.playing_styles tr").each((_, el) => {
    const text = $(el).text().trim();
    if (!text) return;
    if (text === "Player Skills") {
      collectingSkills = true;
      return;
    }
    if (text === "AI Playing Styles") {
      collectingSkills = false;
      return;
    }
    if (collectingSkills && !/Playing Style/.test(text)) {
      info.playerSkills.push(text);
    }
  });

  // AI Playing Styles
  info.aiPlayingStyles = [];
  $("table.playing_styles tr:contains('AI Playing Styles')")
    .nextAll()
    .each((_, el) => {
      const txt = $(el).text().trim();
      if (!txt || /Player Skills|Playing Style/i.test(txt)) return false;
      info.aiPlayingStyles.push(txt);
    });

  return info;
}

app.get("/api/playerinfo", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing ?id parameter" });

    const info = await scrapePlayerInfo(id);
    res.json({ success: true, id, info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default app;
