// Shared JSDoc types for the engine (checked with `npm run typecheck`, no build step).

/** @typedef {'RED_A'|'RED_B'|'AMBER'|'WATCH'|'GREEN'} Tier */
/** @typedef {{ resourceType: string, id?: string, [key: string]: any }} FhirResource */

/**
 * @typedef {object} Child
 * @property {string} id
 * @property {string} pseudoId     pseudonymous beneficiary reference (never a name or Aadhaar)
 * @property {'M'|'F'} sex
 * @property {number} dob          ms since epoch
 * @property {string} awcId
 * @property {boolean} [lbw]
 * @property {any} [migration]
 */

/**
 * @typedef {object} MeasurementEvent
 * @property {string} id
 * @property {number} t            measurement time (the clock starts here)
 * @property {number|null} weightKg
 * @property {number|null} heightCm
 * @property {number|null} [muacMm]
 * @property {boolean} [lying]
 * @property {boolean} [oedema]
 * @property {string[]} [danger]
 * @property {'PASS'|'FAIL'|null} [appetite]
 * @property {number} [receivedAt]
 */

/**
 * @typedef {object} Reason
 * @property {Tier} tier
 * @property {string} code         rule identifier, e.g. R3_MUAC_SAM, FORECAST, WEAK_SIGNALS
 * @property {string} rule         human rule reference (Table 2, Rule 1 ...)
 * @property {string} text         explanation shown to the worker
 */

/**
 * @typedef {object} Closure
 * @property {'AWW'|'ASHA'} by
 * @property {number} t
 * @property {'VISITED'|'REFERRED'|'REFUSED'|'MIGRATED'} [outcome]
 * @property {'APP'|'IVR'|'SMS'} [channel]
 * @property {1|2|3|4|number} [dtmf]
 */

/**
 * @typedef {object} RiskContext
 * @property {any} child
 * @property {any} visit
 * @property {any} [ref]
 * @property {{ z: number, grams: number, interval: string }|null} [velocity]
 * @property {{ type: string, t: number }[]} signals
 * @property {number} priorEpisodes
 * @property {any} pack
 */
export {};
