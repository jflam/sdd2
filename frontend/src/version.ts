export const VERSION = {
  major: 1,
  minor: 0,
  build: 1
};

export const getVersionString = (): string => {
  return `${VERSION.major}.${VERSION.minor}.${VERSION.build}`;
};

export const EXTENSION_NAME = 'Safari Extension Unified Logging';