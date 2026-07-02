import { createServerFn } from "@tanstack/react-start";

export const setUserBan = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("User ban handling has moved to the Laravel admin API.");
});
