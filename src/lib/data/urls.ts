// How a stored relative path becomes something the page can show. Injected so repositories stay testable.
export type Urls = {
  /** A file under the app data folder. */
  app(relative: string): Promise<string>;
  /** A finished photo: `root` is the photos folder it was written to. */
  photo(root: string, relative: string): Promise<string>;
};
