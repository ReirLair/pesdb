import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const BASE_URL = "https://pesdb.net/efootball/";

/* ==========================================
   🔍 Scrape list of players by name
========================================== */
async function scrapePlayers(playerName) {
  const url = `${BASE_URL}?name=${encodeURIComponent(playerName)}&mode=max_level&all=1`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const players = [];

  $("table.players tbody tr").each((i, el) => {
    if ($(el).find("th").length) return;

    const position = $(el).find("td").eq(0).text().trim();
    const playerAnchor = $(el).find("td").eq(1).find("a");
    const name = playerAnchor.text().trim();
    const hrefRaw = playerAnchor.attr("href") || "";
    const idMatch = hrefRaw.match(/id=(\d+)/);
    const id = idMatch ? idMatch[1] : null;

    const teamName = $(el).find("td").eq(2).text().trim();
    const nationality = $(el).find("td").eq(3).text().trim();
    const age = $(el).find("td").eq(6).text().trim();
    const rating = $(el).find("td").eq(7).text().trim();

    players.push({
      playerName: name,
      position,
      teamName,
      nationality,
      age,
      rating,
      id,
    });
  });

  return players;
}

/* ==========================================
   🧠 Scrape detailed player info by ID
========================================== */
async function scrapePlayerInfo(id) {
  const url = `${BASE_URL}?id=${id}&mode=max_level`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const info = {};

  // 🖼️ Images
  info.imageFront = $(".flip-box-front img").attr("src") || null;
  info.imageBack = $(".flip-box-back img").attr("src") || null;

  // 📋 Basic details
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
        .toLowerCase();
      info[key] = td;
    });

  // 🌟 Rarity
  info.rarity =
    $("td[colspan='2']:contains('Epic'), td[colspan='2']:contains('Legendary')")
      .text()
      .trim() || null;

  // 🎯 Rating cleanup
  if (info.rating) info.rating = info.rating.replace(/\s+/g, " ").trim();

  // 📊 Attributes
  info.attributes = [];
  $("table[data-style] tr").each((_, tr) => {
    const statName = $(tr).find("th").text().replace(":", "").trim();
    if (!statName) return;

    const booster = $(tr).find("span[title*='Booster']").attr("title") || null;
    const bonus = $(tr).find("small").text().trim() || null;
    const value =
      $(tr).find("span[id^='a']").text().trim() ||
      $(tr).find("td span.c0").text().trim();

    if (value) {
      info.attributes.push({
        statName,
        value,
        booster: booster ? booster.replace("Booster ", "") : null,
        bonus: bonus || null,
      });
    }
  });

  // ⚙️ Playing Style
  info.playingStyle =
    $("table.playing_styles tr:nth-child(2)").text().trim() || null;

  // 🧩 Player Skills
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

  // 🤖 AI Playing Styles
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

/* ==========================================
   🚀 Routes
========================================== */

// 🔍 Search for players
app.get("/api/player", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name)
      return res
        .status(400)
        .json({ success: false, error: "Missing ?name parameter" });

    const players = await scrapePlayers(name);
    res.status(200).json({
      success: true,
      count: players.length,
      players,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🧠 Get player info by ID
app.get("/api/playerinfo", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id)
      return res
        .status(400)
        .json({ success: false, error: "Missing ?id parameter" });

    const info = await scrapePlayerInfo(id);
    res.status(200).json({
      success: true,
      id,
      info,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default app;
