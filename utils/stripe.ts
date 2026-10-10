
export const getStripeCheckoutUrl = (userId: string, email: string) => {
    // Payment Link for the Standard plan ($97/month, price_1UP01ZIUenQOhKtNuC89Gxac). VITE_STRIPE_CHECKOUT_URL in
    // Vercel overrides it; keep the two in sync (the old $199 link 9B6cN67y08… is deactivated).
    const baseUrl = (import.meta as any).env?.VITE_STRIPE_CHECKOUT_URL || "https://buy.stripe.com/6oU7sMf0sfeK9ZO9vldfG0f";
    
    // client_reference_id: passed to Stripe and returned in the webhook (crucial for identifying the user)
    // prefilled_email: purely for user convenience on the checkout page
    return `${baseUrl}?client_reference_id=${userId}&prefilled_email=${encodeURIComponent(email)}`;
};
