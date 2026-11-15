import { parseEnvironment } from "@/config/env-schema";
import "server-only";

export const env = parseEnvironment(process.env);
