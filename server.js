import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const BASE_URL = "https://pesdb.net/efootball/";

/** 🔍 Scrape list of players by name */
async function scrapePlayers(playerName) {
  const url = `${BASE_URL}?name=${encodeURIComponent(playerName)}&mode=max_level&all=1`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const players = [];

  $("table.players tbody tr").each((_, el) => {
    if ($(el).find("th").length) return;

    const position = $(el).find("td").eq(0).text().trim();
    const playerAnchor = $(el).find("td").eq(1).find("a");
    const playerName = playerAnchor.text().trim();
    const href = playerAnchor.attr("href") || "";
    const idMatch = href.match(/id=(\d+)/);
    const id = idMatch ? idMatch[1] : null;

    const teamName = $(el).find("td").eq(2).text().trim();
    const nationality = $(el).find("td").eq(3).text().trim();
    const age = $(el).find("td").eq(6).text().trim();
    const rating = $(el).find("td").eq(7).text().trim();

    players.push({ playerName, position, teamName, nationality, age, rating, id });
  });

  return players;
}

/** 🧠 Scrape single player details by ID */
async function scrapePlayerInfo(id) {
  const url = `${BASE_URL}?id=${id}&mode=max_level`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const info = {};

  // ✅ Images
  info.imageFront = $(".flip-box-front img").attr("src") || null;
  info.imageBack = $(".flip-box-back img").attr("src") || null;

  // ✅ Basic info
  info.playerName = $("th:contains('Player Name:')").next("td").text().trim();
  info.teamName = $("th:contains('Team Name:')").next("td").text().trim();
  info.league = $("th:contains('League:')").next("td").text().trim();
  info.nationality = $("th:contains('Nationality:')").next("td").text().trim();
  info.region = $("th:contains('Region:')").next("td").text().trim();
  info.height = $("th:contains('Height:')").next("td").text().trim();
  info.weight = $("th:contains('Weight:')").next("td").text().trim();
  info.age = $("th:contains('Age:')").next("td").text().trim();
  info.foot = $("th:contains('Foot:')").next("td").text().trim();
  info.maxLevel = $("th:contains('Maximum Level:')").next("td").text().trim();
  info.rating = $("th:contains('Overall Rating:')").next("td").text().trim();
  info.position = $("th:contains('Position:')").next("td").text().trim();
  info.rarity = $("td[colspan='2']").text().trim().split("\n").pop().trim() || null;

  // ✅ Attributes (with boosters)
  info.attributes = [];
  $("table.player tr").each((_, tr) => {
    const label = $(tr).find("th").text().trim().replace(":", "");
    const stat = $(tr).find("td span[id^='a']").text().trim();
    const booster = $(tr).find("td span[title*='Booster']").attr("title") || null;
    if (label && stat) info.attributes.push({ statName: label, value: stat, booster });
  });

  // ✅ Playing style + skills
  info.playingStyle = "";
  info.playerSkills = [];
  info.aiPlayingStyles = [];

  const table = $("table.playing_styles");
  let section = null;

  table.find("tr").each((_, tr) => {
    const th = $(tr).find("th").text().trim();
    const td = $(tr).find("td").text().trim();

    if (th === "Playing Style") section = "style";
    else if (th === "Player Skills") section = "skills";
    else if (th === "AI Playing Styles") section = "ai";
    else if (section === "style" && td) info.playingStyle = td;
    else if (section === "skills" && td) info.playerSkills.push(td);
    else if (section === "ai" && td) info.aiPlayingStyles.push(td);
  });

  return info;
}

/** 🔎 /api/player?name=Neymar */
app.get("/api/player", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: "Missing ?name parameter" });

    const players = await scrapePlayers(name);
    res.json({ success: true, count: players.length, players });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 🧩 /api/playerinfo?id=12345 */
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

// ✅ Export for Vercel
export default app;
