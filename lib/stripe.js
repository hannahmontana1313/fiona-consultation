import { loadStripe } from '@stripe/stripe-js';

let stripePromise;
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

// Tarif dynamique semaine/week-end
export const getTarifActuel = () => {
  const jour = new Date().getDay();
  return jour === 0 || jour === 6 ? 5 : 2; // 5€ week-end, 2€ semaine
};

export const calculerPrix = (minutes, avecFraisStripe = true) => {
  const tarif = getTarifActuel();
  const base = minutes * tarif;
  if (!avecFraisStripe) return base;
  // Frais Stripe : 1.4% + 0.25€ (cartes européennes)
  return Math.ceil((base + 0.25) / (1 - 0.014) * 100) / 100;
};
