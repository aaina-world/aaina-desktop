// Ported from Aaina (packages/contracts/src/searchText.ts): the forgiving search used by every picker.
/**
 * One forgiving search for every picker (scenes, models, poses) on the website, the phone and
 * Aaina in ChatGPT: every typed word must appear, or the whole query must, once spaces, hyphens,
 * accents and case are ignored. So "bigsur", "Big Sur" and "big-sur" find the same scene, and
 * "tshirt" finds "T-shirt".
 */
export function squashText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function plain(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const SHORT_WORD = 3;

function tokensOf(value: string): string[] {
  return plain(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Every typed word must match the START of a word in the text (a word of 3 letters or fewer, a
 * whole word or its plural, so "man" is not "Mannequin"): "tree" does not
 * find "Street", "men" does not find "Women's", "man" not "Mannequin", "ring" not "Earrings",
 * "red" not "tailored". Accents and case are ignored.
 *
 * One forgiving fallback keeps names typed run together: a query with no spaces may also equal or
 * start a run of whole words ("bigsur" finds "Big Sur", "tshirt" finds "T-shirt"); a query with
 * spaces may equal such a run ("big sur" finds the single word "Bigsur"). Never the middle of a word.
 */
export function matchesSearch(text: string, query: string): boolean {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const tokens = tokensOf(text);
  // A very short word ("man", "men", "uk") must be a whole word (or its plural): "man" is not "Mannequin".
  const startsWord = (word: string) =>
    word.length <= SHORT_WORD
      ? tokens.some((token) => token === word || token === `${word}s` || token === `${word}es`)
      : tokens.some((token) => token.startsWith(word));
  // A word with no letters or digits ("%", "_") finds nothing.
  if (
    words.every((word) => {
      const parts = tokensOf(word);
      return parts.length > 0 && parts.every(startsWord);
    })
  )
    return true;
  const squashedQuery = squashText(query);
  if (!squashedQuery) return false;
  const spaced = words.length > 1;
  for (let from = 0; from < tokens.length; from += 1) {
    let run = "";
    for (let to = from; to < tokens.length; to += 1) {
      run += tokens[to];
      // A run of one word was judged above (a short word is never the start of a longer one).
      if (to > from ? (spaced ? run === squashedQuery : run.startsWith(squashedQuery)) : run === squashedQuery) return true;
      if (run.length >= squashedQuery.length) break;
    }
  }
  return false;
}
