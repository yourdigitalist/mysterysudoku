import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const themePath = path.resolve(here, "../../../themes/murder-mystery/theme.json");
