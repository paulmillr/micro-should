declare const should: {
  (message: string, test: () => void|Promise<void>): void;
  only(message: string, test: () => void|Promise<void>): void;
  skip(message: string, test: () => void|Promise<void>): void;
  run(): void;
}

export {should};