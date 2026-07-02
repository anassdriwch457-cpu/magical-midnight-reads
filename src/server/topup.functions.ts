import { createServerFn } from "@tanstack/react-start";

export const COIN_PACKAGES = [
  { id: "starter", coins: 100, bonus: 0, price: 1.0, label: "Starter" },
  { id: "popular", coins: 500, bonus: 50, price: 4.5, label: "Popular", popular: true },
  { id: "value", coins: 1200, bonus: 200, price: 9.99, label: "Value" },
  { id: "ultimate", coins: 3500, bonus: 750, price: 24.99, label: "Ultimate" },
] as const;

export type CoinPackage = (typeof COIN_PACKAGES)[number];

export const createCoinCheckout = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("Coin checkout is handled directly through the Laravel API now.");
});

export const verifyCoinCheckout = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("Checkout verification is handled directly through the Laravel API now.");
});
