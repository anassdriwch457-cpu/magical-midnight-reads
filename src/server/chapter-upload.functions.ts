import { createServerFn } from "@tanstack/react-start";

export const uploadChapterFromUrls = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("Bulk chapter URL import is not available yet.");
});

export const listSeriesForUpload = createServerFn({ method: "GET" }).handler(async () => {
  throw new Error("Bulk chapter URL import is not available yet.");
});
