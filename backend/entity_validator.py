"""Player name whitelist validator with Levenshtein fuzzy matching."""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# ---------------------------------------------------------------------------
# Load canonical names from players.json + extended whitelist
# ---------------------------------------------------------------------------
_EXTRA_PLAYERS = {
    # 2010-2014 starters / rotation players / notable rookies
    "kyrie-irving", "anthony-davis", "damian-lillard", "bradley-beal",
    "andre-drummond", "harrison-barnes", "draymond-green", "klay-thompson",
    "kawhi-leonard", "jimmy-butler", "isaiah-thomas", "rudy-gobert",
    "giannis-antetokounmpo", "victor-oladipo", "cj-mccollum",
    "steven-adams", "nerlens-noel", "michael-carter-williams",
    "rajon-rondo", "pau-gasol", "andrew-bynum", "lamar-odom",
    "ron-artest", "metta-world-peace", "kevin-garnett", "paul-pierce",
    "ray-allen", "tony-parker", "manu-ginobili", "tim-duncan",
    "russell-westbrook", "james-harden", "serge-ibaka", "kendrick-perkins",
    "jason-kidd", "vince-carter", "shawn-marion", "jason-terry",
    "tyson-chandler", "joe-johnson", "josh-smith", "al-horford",
    "jeff-teague", "brandon-jennings", "monta-ellis", "stephen-curry",
    "david-lee", "kevin-love", "ricky-rubio", "derrick-williams",
    "michael-beasley", "mario-chalmers", "udonis-haslem", "wilson-chandler",
    "tony-douglas", "antawn-jamison", "mo-williams", "anderson-varejao",
    "jj-hickson", "danilo-gallinari", "landry-fields", "andrew-bogut",
    "brandon-roy", "lamarcus-aldridge", "nicolas-batum", "wesley-matthews",
    "zach-randolph", "marc-gasol", "mike-conley", "rudy-gay",
    "tyreke-evans", "eric-gordon", "anthony-morrow", "chris-kaman",
    "blake-griffin", "deandre-jordan", "eric-bledsoe", "goran-dragic",
    "marcin-gortat", "luis-scola", "kevin-martin", "aaron-brooks",
    "kyle-lowry", "demar-derozan", "andrea-bargnani", "brook-lopez",
    "deron-williams", "gerald-wallace", "kris-humphries", "jarrett-jack",
    "carl-landry", "david-west", "roy-hibbert", "danny-granger",
    "george-hill", "jr-smith", "kenneth-faried", "ty-lawson",
    "andre-iguodala", "thaddeus-young", "evan-turner", "jrue-holiday",
    "spencer-hawes", "elton-brand", "chris-bosh", "dwyane-wade",
    "lebron-james", "carmelo-anthony", "derrick-rose", "chris-paul",
    "dwight-howard", "dirk-nowitzki", "kevin-durant", "kobe-bryant",
    "paul-george", "stephen-curry", "kyrie-irving",
    "john-wall", "demarcus-cousins", "gordon-hayward",
    "andrew-wiggins", "jabari-parker", "joel-embiid", "aaron-gordon",
    "marcus-smart", "julius-randle", "zach-lavine", "nikola-jokic",
    "clint-capela", "jae-crowder", "kelly-olynyk",
    "reggie-jackson", "dion-waiters", "tristan-thompson",
    "matthew-dellavedova", "iman-shumpert", "timofey-mozgov",
    "channing-frye", "richard-jefferson",
    # coaches / execs
    "pat-riley", "erik-spoelstra", "mike-dantoni", "phil-jackson",
    "gregg-popovich", "doc-rivers", "tom-thibodeau",
}


def _load_canonical_names() -> set[str]:
    """Merge players.json keys with the extended whitelist."""
    names: set[str] = set()
    players_path = DATA_DIR / "players.json"
    if players_path.exists():
        with open(players_path, "r", encoding="utf-8") as f:
            names.update(json.load(f).keys())
    names.update(_EXTRA_PLAYERS)
    return names


CANONICAL_NAMES: set[str] = _load_canonical_names()


def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    curr = [0] * (len(s2) + 1)
    for i, c1 in enumerate(s1, 1):
        curr[0] = i
        for j, c2 in enumerate(s2, 1):
            curr[j] = min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + (0 if c1 == c2 else 1),
            )
        prev, curr = curr, prev
    return prev[len(s2)]


def fuzzy_match(name: str, threshold: int = 2) -> str | None:
    """Return canonical name if fuzzy match found within threshold, else None."""
    name_lower = name.lower().strip().replace(" ", "-")
    if name_lower in CANONICAL_NAMES:
        return name_lower
    for canonical in CANONICAL_NAMES:
        if levenshtein_distance(name_lower, canonical) <= threshold:
            return canonical
    return None


def extract_player_names(text: str) -> list[str]:
    """Extract potential player name strings from event text."""
    import re
    candidates = re.findall(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+', text)
    results = []
    for c in candidates:
        slug = c.lower().strip().replace(" ", "-")
        matched = fuzzy_match(slug)
        if matched:
            results.append(matched)
        else:
            results.append(slug)
    return results


def validate_events(
    events: list[dict],
) -> tuple[list[dict], list[str]]:
    """Validate AI-generated events against the player whitelist.

    Returns:
        (accepted_events, rejected_names)
    """
    accepted: list[dict] = []
    rejected_names: list[str] = []

    for event in events:
        desc = event.get("description", "")
        title = event.get("title", "")
        key_players = event.get("key_players", [])

        unknown = [p for p in key_players if p.lower().replace(" ", "-") not in CANONICAL_NAMES]

        text_names = extract_player_names(f"{title} {desc}")
        for n in text_names:
            if n not in CANONICAL_NAMES and n not in unknown:
                unknown.append(n)

        if unknown:
            rejected_names.extend(unknown)
        else:
            accepted.append(event)

    return accepted, rejected_names
