export function sanitizeForWikipedia(location) {
  const stateAbbreviations = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
    MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
    NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
    OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
    VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
  };

  let cleaned = location.trim().replace(/,\s*USA$/, "");
  const stateMatch = cleaned.match(/,\s*([A-Z]{2})$/);
  if (stateMatch && stateAbbreviations[stateMatch[1]]) {
    cleaned = cleaned.replace(/,\s*[A-Z]{2}$/, `, ${stateAbbreviations[stateMatch[1]]}`);
  }

  return cleaned;
}

export function isSight(place) {
  const types = place.types || [];
  const blacklist = ["restaurant", "food", "cafe", "bar"];
  const whitelist = [
    "tourist_attraction", "point_of_interest", "park", "museum", "winery",
    "natural_feature", "amusement_park", "zoo", "aquarium", "art_gallery"
  ];

  return whitelist.some(type => types.includes(type)) &&
         !blacklist.some(type => types.includes(type));
}
