/**
 * Global property the main bundle shares its React instance on, for the `react-dom` chunk. Kept in
 * a module without dependencies, as it’s imported by the build configuration as well as the app, so
 * the two sides can’t drift apart.
 */
export const SHARED_REACT_KEY = '__SVELTIA_CMS_REACT__';
