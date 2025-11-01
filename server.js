import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

async function scrapePlayers(playerName) {
  const baseUrl = "https://pesdb.net/efootball/";
  const url = `${baseUrl}?name=${encodeURIComponent(playerName)}&mode=max_level&all=1`;

  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const players = [];

  $("table.players tbody tr").each((i, el) => {
    if ($(el).find("th").length) return; // skip header

    const position = $(el).find("td").eq(0).text().trim();
    const playerAnchor = $(el).find("td").eq(1).find("a");
    const name = playerAnchor.text().trim();

    // Extract only the player ID from href (e.g., id=89133456301399)
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
      id
    });
  });

  return players;
}

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

export default app;
