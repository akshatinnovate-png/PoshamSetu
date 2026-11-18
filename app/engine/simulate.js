// Synthetic pilot district (Paschimi Singhbhum, three blocks) for the prototype — facade.
// ALL RECORDS ARE SYNTHETIC. Distributions are tuned to NFHS-5 / NITI-IFPRI district levels.
//   sim/constants.js   dates, names, places, destinations, vaccine schedule
//   sim/population.js  blocks, AWCs, children with latent truth
//   sim/history.js     12 months of growth, migration, consent, signals, measurements
//   sim/analyse.js     engine over the district, live tasks, bridge replay
//   sim/metrics.js     silent-trial backtest and queue evaluation
export { NOW, SIM_START, SILENT_FROM, LIVE_FROM, DESTINATIONS } from './sim/constants.js';
export { generate } from './sim/population.js';
export { analyse } from './sim/analyse.js';
export { backtest, queueEval } from './sim/metrics.js';
