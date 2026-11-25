// Entrada do pacote do servidor (F10.1): `scripts/build-engine.mjs` empacota daqui `api/_lib/builder-engine.gen.js`.
// O servidor é JS puro e não importa TS; o pacote é gerado e conferido pelo `check-builder` (precisa estar em dia).
export { compileFromCatalog, featListPaths, needsOf } from './catalog'
export { exportBuild } from './export'
