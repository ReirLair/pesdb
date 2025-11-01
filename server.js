import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const BASE_URL = "https://pesdb.net/efootball/";

/** Scrape list of players by name */
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

    players.push({ playerName: name, position, teamName, nationality, age, rating, id });
  });

  return players;
}

/** Scrape single player info by ID */
async function scrapePlayerInfo(id) {
  const url = `${BASE_URL}?id=${id}&mode=max_level`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const info = {};

  // Basic info
  info.imageFront = $(".flip-box-front img").attr("src") || null;
  info.imageBack = $(".flip-box-back img").attr("src") || null;
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
  info.rating = $("th:contains('Rating:')").next("td").text().trim();
  info.position = $("th:contains('Position:')").next("td").text().trim();

  // Detect rarity if visible (Epic, Legendary, etc.)
  const rarityText = $("td[colspan='2']:contains('Epic'), td[colspan='2']:contains('Legendary')").text().trim();
  info.rarity = rarityText || null;

  // Attributes (stats)
  info.attributes = [];
  $("table#table1 tr").each((_, tr) => {
    const statName = $(tr).find("th").text().replace(":", "").trim();
    const valueSpan = $(tr).find("td span[id^='a']");
    const value = valueSpan.text().trim();
    const booster = valueSpan.next("span").text().trim() || null;

    if (statName && value) {
      info.attributes.push({ statName, value, booster: booster || null });
    }
  });

  // Playing Style, Skills, AI Styles
  info.playingStyle = $("table.playing_styles tr:nth-child(2)").text().trim() || null;

  info.playerSkills = [];
  $("table.playing_styles tr")
    .filter((_, el) => $(el).text().trim() && !/Playing Style|Player Skills|AI Playing Styles/i.test($(el).text()))
    .each((_, el) => {
      const text = $(el).text().trim();
      if (text) info.playerSkills.push(text);
    });

  // Split AI styles properly
  const aiSection = $("table.playing_styles tr:contains('AI Playing Styles')").nextAll();
  const aiStyles = [];
  aiSection.each((_, el) => {
    const txt = $(el).text().trim();
    if (!txt || /Playing Style|Player Skills/i.test(txt)) return false;
    aiStyles.push(txt);
  });
  info.aiPlayingStyles = aiStyles;

  return info;
}

/** Routes */
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
