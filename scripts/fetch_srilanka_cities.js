import fs from 'fs';

async function fetchCities() {
    console.log(">>> Downloading srilanka-cities data...");
    const res = await fetch("https://raw.githubusercontent.com/aslamanver/srilanka-cities/master/cities.sql");
    if (!res.ok) {
        throw new Error("Failed to download cities.sql: " + res.statusText);
    }
    const sqlText = await res.text();
    console.log(">>> Download complete. Parsing SQL inserts...");

    // The SQL values are in format: (id, district_id, 'name_en', 'name_si', ...)
    // Let's use a regex to match all values patterns
    // e.g. (1, 1, 'Akkaraipattu', 'අක්කරපත්තුව', NULL, NULL, NULL, NULL, '32400', 7.2167, 81.85)
    // We can match: \(\d+,\s*\d+,\s*'([^']+)'
    const regex = /\(\d+,\s*\d+,\s*'([^']+)'/g;
    const citiesSet = new Set();
    let match;
    while ((match = regex.exec(sqlText)) !== null) {
        citiesSet.add(match[1].trim());
    }

    const cities = Array.from(citiesSet).sort();
    console.log(`>>> Successfully parsed ${cities.length} unique Sri Lankan towns/cities!`);

    fs.writeFileSync("./cities.json", JSON.stringify(cities, null, 2));
    console.log(">>> Saved list to ./cities.json");
}

fetchCities().catch(err => {
    console.error(">>> Error fetching cities:", err);
    process.exit(1);
});
