
export const getStripeCheckoutUrl = (userId: string, email: string) => {
    // TEST LINK ($1.00) - Revert to production link after testing
    const baseUrl = "https://buy.stripe.com/9B6cN67y08Qmc7W4b1dfG0e";
    
    // client_reference_id: passed to Stripe and returned in the webhook (crucial for identifying the user)
    // prefilled_email: purely for user convenience on the checkout page
    return `${baseUrl}?client_reference_id=${userId}&prefilled_email=${encodeURIComponent(email)}`;
};
