
export const getStripeCheckoutUrl = (userId: string, email: string) => {
    // Payment Link for the monthly plan. Set VITE_STRIPE_CHECKOUT_URL in Vercel to the production link;
    // the fallback below is the link the app has used so far (marked in the past as a $1 test link: check its price).
    const baseUrl = (import.meta as any).env?.VITE_STRIPE_CHECKOUT_URL || "https://buy.stripe.com/9B6cN67y08Qmc7W4b1dfG0e";
    
    // client_reference_id: passed to Stripe and returned in the webhook (crucial for identifying the user)
    // prefilled_email: purely for user convenience on the checkout page
    return `${baseUrl}?client_reference_id=${userId}&prefilled_email=${encodeURIComponent(email)}`;
};
