// Native default: AsyncStorage's real native (SQLite/file-based) backing —
// this is what actually runs on iOS/Android and is unaffected by anything
// web-specific. Web gets a separate IndexedDB-backed implementation (see
// persistentStorage.web.ts) — see that file for why.
import AsyncStorage from '@react-native-async-storage/async-storage';

export default AsyncStorage;
