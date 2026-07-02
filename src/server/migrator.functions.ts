import { createServerFn } from "@tanstack/react-start";

export const createImportJob = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("The migrator is not available yet.");
});

export const listImportJobs = createServerFn({ method: "GET" }).handler(async () => {
  return { jobs: [] };
});

export const getImportJob = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("The migrator is not available yet.");
});

export const runImportStep = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("The migrator is not available yet.");
});

export const cancelImportJob = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("The migrator is not available yet.");
});
