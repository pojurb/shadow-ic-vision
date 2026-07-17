// Silences dotenv's promotional startup tips. Must be imported before
// `dotenv/config`, which reads this flag but accepts no options of its own.
// Setting the flag (rather than calling dotenv.config({ quiet: true }) here)
// keeps `dotenv/config`'s DOTENV_CONFIG_PATH/OVERRIDE/ENCODING support intact.
process.env.DOTENV_CONFIG_QUIET ??= 'true';
