/**
 * Just enough team knowledge to answer one narrow question: does this card's team
 * clearly belong to a *different* sport than its category says?
 *
 * Deliberately conservative. The check only fires when a team is confidently
 * recognised as belonging to the other sport — an unrecognised team produces no
 * finding at all, because "I have never heard of this club" is not evidence that
 * the card is wrong. There are thousands of football clubs and this list will
 * never be complete; a false "LIKELY_INCORRECT" on a real card is far more
 * damaging than a missed catch, since it trains the user to ignore the flag.
 *
 * Historical and relocated names are included so a vintage card is not flagged
 * for naming a team that no longer exists.
 */

/** NBA franchises, current and historical, by the name fragment sellers actually type. */
const NBA_TEAMS = [
  // Current 30
  "hawks", "celtics", "nets", "hornets", "bulls", "cavaliers", "cavs", "mavericks", "mavs",
  "nuggets", "pistons", "warriors", "rockets", "pacers", "clippers", "lakers", "grizzlies",
  "heat", "bucks", "timberwolves", "wolves", "pelicans", "knicks", "thunder", "magic",
  "76ers", "sixers", "suns", "trail blazers", "blazers", "kings", "spurs", "raptors",
  "jazz", "wizards",
  // Historical / relocated — a 1995 card naming these is correct, not broken.
  "supersonics", "sonics", "bullets", "bobcats", "new jersey nets", "seattle supersonics",
  "vancouver grizzlies", "kansas city kings", "washington bullets", "san diego clippers",
  "buffalo braves", "syracuse nationals", "fort wayne pistons", "minneapolis lakers",
];

/**
 * Association-football clubs and national sides. Only well-known ones: this list
 * exists to catch "Lakers" filed under Football, not to validate club names.
 */
const FOOTBALL_TEAMS = [
  // England
  "arsenal", "aston villa", "chelsea", "everton", "fulham", "liverpool", "man city",
  "manchester city", "man utd", "man united", "manchester united", "newcastle",
  "tottenham", "spurs fc", "west ham", "leicester", "brighton", "brentford",
  "crystal palace", "wolves fc", "nottingham forest", "leeds", "southampton",
  // Spain
  "real madrid", "barcelona", "barca", "atletico madrid", "atletico", "sevilla",
  "valencia", "villarreal", "real sociedad", "athletic bilbao", "real betis",
  // Italy
  "juventus", "inter milan", "internazionale", "ac milan", "napoli", "roma", "as roma",
  "lazio", "atalanta", "fiorentina",
  // Germany
  "bayern", "bayern munich", "borussia dortmund", "dortmund", "leipzig", "rb leipzig",
  "leverkusen", "bayer leverkusen", "schalke",
  // France / Portugal / Netherlands / rest
  "psg", "paris saint germain", "paris saint-germain", "marseille", "lyon", "monaco",
  "benfica", "porto", "sporting", "sporting cp", "ajax", "psv", "feyenoord",
  "celtic", "rangers", "galatasaray", "fenerbahce", "al nassr", "al hilal",
  "inter miami", "la galaxy", "lafc",
  // National sides
  "argentina", "brazil", "france", "england", "portugal", "spain", "germany",
  "netherlands", "italy", "belgium", "croatia", "uruguay", "morocco", "japan",
];

/** Normalises the way a seller writes a team so "Man. City" and "man city" agree. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Matches on whole-word containment rather than equality: sellers write
 * "LA Lakers", "Los Angeles Lakers" and "Lakers" for the same team.
 *
 * Word-boundary matching matters — plain substring search makes "Inter Miami"
 * (football) match "inter milan" on the shared "inter", and files it as the
 * wrong sport.
 */
function mentions(haystack: string, needle: string): boolean {
  const words = haystack.split(" ");
  const parts = needle.split(" ");
  if (parts.length === 1) return words.includes(parts[0]);
  // Multi-word names must appear as a consecutive run.
  for (let i = 0; i + parts.length <= words.length; i++) {
    if (parts.every((part, j) => words[i + j] === part)) return true;
  }
  return false;
}

export type InferredSport = "nba" | "football" | "unknown";

/**
 * Which sport this team name belongs to, or "unknown".
 *
 * A name matching both lists resolves to "unknown" rather than picking a winner —
 * "Spurs" is genuinely both San Antonio and Tottenham, and guessing would produce
 * exactly the confidently-wrong flag this whole module is built to avoid.
 */
export function inferSportFromTeam(team: string): InferredSport {
  const value = normalize(team);
  if (!value) return "unknown";

  const isNba = NBA_TEAMS.some((name) => mentions(value, normalize(name)));
  const isFootball = FOOTBALL_TEAMS.some((name) => mentions(value, normalize(name)));

  if (isNba && isFootball) return "unknown";
  if (isNba) return "nba";
  if (isFootball) return "football";
  return "unknown";
}

/** The sport a category is about, for categories where that is knowable. */
export function sportForCategory(category: string): InferredSport {
  const key = category.trim().toLowerCase();
  if (key === "nba" || key === "basketball") return "nba";
  if (key === "football" || key === "soccer") return "football";
  return "unknown";
}
