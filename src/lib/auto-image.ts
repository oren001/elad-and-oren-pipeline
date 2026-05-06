const PREFIXES = [
  "Hilarious surreal cartoon scene depicting:",
  "Absurd stoner comic strip panel showing:",
  "Witty meme-style illustration of:",
  "Satirical political cartoon parody of:",
  "Dramatic over-the-top emotional moment of:",
  "Absurd commercial poster from the 1970s for:",
  "Cinematic still from an imaginary stoner film about:",
  "Children's storybook illustration with absurd twist of:",
  "Dramatic Renaissance painting reimagined as:",
  "Soviet propaganda poster about:",
];

const SUFFIXES = [
  ", smoky green haze, exaggerated faces, hand-drawn style, surreal humor, soft 35mm film grain",
  ", saturated colors, comic book panels, dramatic lighting, witty visual gag",
  ", vintage cartoon, dreamy smoky atmosphere, expressive eyes, subtle Israeli vibe",
  ", trippy psychedelic edges, bold linework, slightly absurd proportions",
  ", retro 80s movie poster aesthetic, smoky background, dramatic poses, deadpan humor",
  ", soft watercolor textures, magical realism, slight green tint, cozy melancholy",
  ", graphic novel inking, high contrast, ridiculous facial expressions",
];

const ERAN_FLAVOR = [
  "Eran (a sad guy clutching only 1.5g of weed) is also visible in the background looking jealous",
  "Eran is somewhere in the corner with a tear in his eye holding a tiny bag of 1.5g",
  "and Eran is sulking nearby with his pathetic 1.5g while everyone else has 3g",
];

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function buildAutoPrompt(text: string): string {
  const cleaned = text.replace(/@\S+/g, "").trim().slice(0, 200);
  const prefix = pickOne(PREFIXES);
  const suffix = pickOne(SUFFIXES);
  const mentionsEran = /ערן/.test(text);
  const eranBit = mentionsEran ? `. ${pickOne(ERAN_FLAVOR)}` : "";
  return `${prefix} ${cleaned}${eranBit}${suffix}`;
}
