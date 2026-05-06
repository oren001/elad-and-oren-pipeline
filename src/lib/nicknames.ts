const ANIMALS = [
  "ארנב",
  "דביבון",
  "פנדה",
  "חתול",
  "כלב",
  "אריה",
  "נמר",
  "פיל",
  "ג'ירפה",
  "זברה",
  "קוף",
  "תנשמת",
  "ינשוף",
  "צפרדע",
  "דולפין",
  "שועל",
  "ברווז",
  "תרנגול",
  "סנאי",
  "קיפוד",
];

const ADJECTIVES = [
  "מסטול",
  "רגוע",
  "פילוסופי",
  "רעב",
  "פרנואיד",
  "שכחן",
  "חולמני",
  "סקרן",
  "צ'יל",
  "נחמד",
  "עצלן",
  "דמיוני",
  "ירוק",
  "סגול",
  "זהוב",
  "מנומנם",
  "מגניב",
  "מפוזר",
];

export function randomNickname(): string {
  const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const d = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  return `${a} ${d}`;
}
